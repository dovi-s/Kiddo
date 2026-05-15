// Fund anniversary worker. Fires the once-a-year fund-anniversary
// email on the calendar anniversary of fund creation. Same shape
// and same idempotence pattern as fundBirthdayWorker — the only
// difference is the trigger date (fund.created_at month+day vs
// kid recipient_birthdate month+day).
//
// File-backed per-fund-per-year idempotence at
// .local/fund-anniversary-sends.json.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildFundAnniversaryEmail } from "./templates/fundAnniversary";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "fund-anniversary-worker";
const SENDS_STATE_PATH = path.join(process.cwd(), ".local", "fund-anniversary-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type SendsState = { lastSentByFundYear: Record<string, string> };

async function loadSendsState(): Promise<SendsState> {
  try {
    const raw = await fs.readFile(SENDS_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { lastSentByFundYear: parsed?.lastSentByFundYear || {} };
  } catch (err: any) {
    if (err?.code === "ENOENT") return { lastSentByFundYear: {} };
    throw err;
  }
}

async function saveSendsState(state: SendsState): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_STATE_PATH), { recursive: true });
  await fs.writeFile(SENDS_STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}

function getTodayMonthDay(now: Date): { month: number; day: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  let month = 0, day = 0, year = 0;
  for (const p of parts) {
    if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "day") day = parseInt(p.value, 10);
    else if (p.type === "year") year = parseInt(p.value, 10);
  }
  return { month, day, year };
}

function diffYears(from: Date, now: Date): number {
  let years = now.getUTCFullYear() - from.getUTCFullYear();
  const beforeAnniversary =
    now.getUTCMonth() < from.getUTCMonth() ||
    (now.getUTCMonth() === from.getUTCMonth() && now.getUTCDate() < from.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const today = getTodayMonthDay(now);
  let rows: Array<{
    fundId: string; parentEmail: string | null; parentFirstName: string | null;
    childFirstName: string | null; fundCreatedAt: Date;
    fundBalance: string | null; fundCashBalance: string | null;
  }>;
  try {
    const result = await pool.query<Record<string, any>>(`
      SELECT
        f.id AS fund_id, u.email AS parent_email, u.first_name AS parent_first_name,
        f.recipient_first_name AS child_first_name,
        f.created_at AS fund_created_at,
        f.balance AS fund_balance, f.cash_balance AS fund_cash_balance
      FROM funds f
      JOIN users u ON u.id = f.user_id
      WHERE f.transferred_at IS NULL
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL
        AND EXTRACT(MONTH FROM f.created_at) = $1
        AND EXTRACT(DAY FROM f.created_at) = $2
        AND f.created_at < NOW() - INTERVAL '300 days'
      LIMIT 500
    `, [today.month, today.day]);
    rows = result.rows.map((r) => ({
      fundId: String(r.fund_id),
      parentEmail: r.parent_email ? String(r.parent_email) : null,
      parentFirstName: r.parent_first_name ? String(r.parent_first_name) : null,
      childFirstName: r.child_first_name ? String(r.child_first_name) : null,
      fundCreatedAt: new Date(r.fund_created_at),
      fundBalance: r.fund_balance != null ? String(r.fund_balance) : null,
      fundCashBalance: r.fund_cash_balance != null ? String(r.fund_cash_balance) : null,
    }));
  } catch (err: any) {
    log(`anniversary query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;

  const state = await loadSendsState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  for (const row of rows) {
    if (!row.parentEmail || !row.childFirstName) continue;
    const key = `${row.fundId}:${today.year}`;
    if (state.lastSentByFundYear[key]) continue;
    const fundAgeYears = diffYears(row.fundCreatedAt, now);
    if (fundAgeYears < 1) continue; // first anniversary minimum.
    const balanceNum = parseFloat(row.fundBalance || "0");
    const cashNum = parseFloat(row.fundCashBalance || "0");
    const fundTotalUsd = (Number.isFinite(balanceNum) ? balanceNum : 0) + (Number.isFinite(cashNum) ? cashNum : 0);
    const dashboardUrl = `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fundId)}`;
    const memoryBookUrl = `${baseUrl}/memory?fund=${encodeURIComponent(row.fundId)}`;
    try {
      await sendEmail(buildFundAnniversaryEmail({
        to: row.parentEmail,
        parentFirstName: row.parentFirstName,
        childFirstName: row.childFirstName,
        fundAgeYears,
        fundTotalUsd,
        dashboardUrl,
        memoryBookUrl,
      }));
      state.lastSentByFundYear[key] = new Date().toISOString();
      sent += 1;
      log(`fund-anniversary sent for fund ${row.fundId} (year ${fundAgeYears})`, WORKER_SOURCE);
    } catch (err: any) {
      log(`fund-anniversary send failed for ${row.fundId}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveSendsState(state);
    log(`tick done: sent ${sent}`, WORKER_SOURCE);
  }
}

export function startFundAnniversaryWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 95_000);
  log(`started (daily, fires on fund creation anniversary in ${APP_TIMEZONE})`, WORKER_SOURCE);
}
