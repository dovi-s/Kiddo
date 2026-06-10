// Tax-season prep worker. Fires twice: once in mid-January (heads-
// up the docs are coming), once in mid-February (docs should be
// available now). File-backed idempotence at
// .local/tax-season-sends.json keyed by fundId:year:phase.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildTaxSeasonPrepEmail } from "./templates/taxSeasonPrep";
import { isCategoryEnabled } from "@shared/emailPreferences";
import { buildEmailUnsubscribeUrl } from "./emailUnsubscribeToken";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "tax-season-worker";
const SENDS_PATH = path.join(process.cwd(), ".local", "tax-season-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type State = { sentByFundYearPhase: Record<string, string> };
async function loadState(): Promise<State> {
  try { const raw = await fs.readFile(SENDS_PATH, "utf8"); return { sentByFundYearPhase: JSON.parse(raw)?.sentByFundYearPhase || {} }; }
  catch (err: any) { if (err?.code === "ENOENT") return { sentByFundYearPhase: {} }; throw err; }
}
async function saveState(s: State): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_PATH), { recursive: true });
  await fs.writeFile(SENDS_PATH, JSON.stringify(s, null, 2), "utf8");
}
function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}
function getTodayParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  let y = 0, m = 0, d = 0;
  for (const p of parts) { if (p.type === "year") y = parseInt(p.value, 10); else if (p.type === "month") m = parseInt(p.value, 10); else if (p.type === "day") d = parseInt(p.value, 10); }
  return { year: y, month: m, day: d };
}
// Phase 1: mid-January (Jan 15). Phase 2: mid-February (Feb 15).
function detectPhase(t: { month: number; day: number }): "heads-up" | "docs-ready" | null {
  if (t.month === 1 && t.day === 15) return "heads-up";
  if (t.month === 2 && t.day === 15) return "docs-ready";
  return null;
}

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const today = getTodayParts(now);
  const phase = detectPhase(today);
  if (!phase) return;
  // The previous tax year is what we're talking about.
  const taxYear = today.year - 1;
  let rows: any[] = [];
  try {
    const result = await pool.query(`
      SELECT f.id AS fund_id, f.recipient_first_name AS child_first_name,
             u.email AS parent_email, u.first_name AS parent_first_name,
             u.email_preferences AS parent_email_preferences
      FROM funds f
      JOIN users u ON u.id = f.user_id
      WHERE f.transferred_at IS NULL
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL
        AND f.account_type = 'UTMA'
        AND f.drivewealth_account_id IS NOT NULL
        AND f.created_at < (TIMESTAMP '${today.year}-01-01')
      LIMIT 2000
    `);
    rows = result.rows;
  } catch (err: any) {
    log(`tax-season query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;
  const state = await loadState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  for (const row of rows) {
    if (!row.parent_email || !row.child_first_name) continue;
    if (!isCategoryEnabled(row.parent_email_preferences, "taxPrep")) continue;
    const key = `${row.fund_id}:${taxYear}:${phase}`;
    if (state.sentByFundYearPhase[key]) continue;
    try {
      await sendEmail(buildTaxSeasonPrepEmail({
        to: row.parent_email,
        unsubscribeUrl: buildEmailUnsubscribeUrl(baseUrl, row.parent_email, "taxPrep"),
        parentFirstName: row.parent_first_name,
        childFirstName: row.child_first_name,
        taxYear,
        dashboardUrl: `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fund_id)}`,
        taxDocsUrl: `${baseUrl}/tax-documents?fund=${encodeURIComponent(row.fund_id)}`,
      }));
      state.sentByFundYearPhase[key] = new Date().toISOString();
      sent += 1;
    } catch (err: any) {
      log(`tax-season send failed for fund ${row.fund_id}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveState(state);
    log(`tick done: tax-season ${phase} ${taxYear} sent ${sent}`, WORKER_SOURCE);
  }
}

export function startTaxSeasonPrepWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 125_000);
  log(`started (daily, fires Jan 15 + Feb 15 in ${APP_TIMEZONE})`, WORKER_SOURCE);
}
