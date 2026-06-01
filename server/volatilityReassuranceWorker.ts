// Volatility reassurance worker. Fires when a fund's invested
// balance drops more than VOLATILITY_DROP_THRESHOLD_PCT (default
// 3%) from the prior day. Uses fund_snapshots for the yesterday
// balance; skips funds without prior snapshots.
//
// File-backed idempotence at .local/volatility-sends.json keyed
// by fundId:date. Max one volatility email per fund per day, but
// the same fund can get multiple in a year if separate sharp-
// drop days occur (each is its own moment).
//
// Daily tick. The previous day's snapshot has to exist for the
// comparison; if today's snapshot worker hasn't run yet, we skip
// silently and try again on the next tick.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildVolatilityReassuranceEmail } from "./templates/volatilityReassurance";
import { isCategoryEnabled } from "@shared/emailPreferences";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "volatility-worker";
const SENDS_PATH = path.join(process.cwd(), ".local", "volatility-sends.json");
const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 4×/day so we catch market-day snapshots.
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";
const DROP_THRESHOLD_PCT = parseFloat(process.env.VOLATILITY_DROP_THRESHOLD_PCT || "3");

type State = { sentByFundDate: Record<string, string> };
async function loadState(): Promise<State> {
  try { const raw = await fs.readFile(SENDS_PATH, "utf8"); return { sentByFundDate: JSON.parse(raw)?.sentByFundDate || {} }; }
  catch (err: any) { if (err?.code === "ENOENT") return { sentByFundDate: {} }; throw err; }
}
async function saveState(s: State): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_PATH), { recursive: true });
  await fs.writeFile(SENDS_PATH, JSON.stringify(s, null, 2), "utf8");
}
function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}
function getTodayDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // YYYY-MM-DD
}
function yearsToMajority(birthdate: Date | null, majorityAge: number, now: Date): number {
  if (!birthdate || isNaN(birthdate.getTime())) return 10;
  const majorityDate = new Date(birthdate);
  majorityDate.setUTCFullYear(majorityDate.getUTCFullYear() + majorityAge);
  const diffMs = majorityDate.getTime() - now.getTime();
  return Math.max(0, Math.round(diffMs / (365.25 * 24 * 60 * 60 * 1000)));
}

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const todayKey = getTodayDateKey(now);
  let rows: any[] = [];
  try {
    const result = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (fund_id) fund_id, total_value, snapshot_date
        FROM fund_snapshots
        ORDER BY fund_id, snapshot_date DESC
      ),
      prior AS (
        SELECT DISTINCT ON (fund_id) fund_id, total_value, snapshot_date
        FROM fund_snapshots
        WHERE snapshot_date < NOW() - INTERVAL '12 hours'
        ORDER BY fund_id, snapshot_date DESC
      )
      SELECT
        f.id AS fund_id, f.recipient_first_name AS child_first_name,
        f.recipient_birthdate AS recipient_birthdate, f.majority_age AS majority_age,
        f.balance AS current_balance,
        u.email AS parent_email, u.first_name AS parent_first_name,
        u.email_preferences AS parent_email_preferences,
        latest.total_value AS latest_snapshot,
        prior.total_value AS prior_snapshot
      FROM funds f
      JOIN users u ON u.id = f.user_id
      LEFT JOIN latest ON latest.fund_id = f.id
      LEFT JOIN prior ON prior.fund_id = f.id
      WHERE f.transferred_at IS NULL
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL
        AND prior.total_value IS NOT NULL
        AND prior.total_value::numeric > 100
        AND latest.total_value IS NOT NULL
        AND ((prior.total_value::numeric - latest.total_value::numeric) / NULLIF(prior.total_value::numeric, 0)) * 100 >= $1
      LIMIT 1000
    `, [DROP_THRESHOLD_PCT]);
    rows = result.rows;
  } catch (err: any) {
    log(`volatility query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;
  const state = await loadState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  for (const row of rows) {
    if (!row.parent_email || !row.child_first_name) continue;
    if (!isCategoryEnabled(row.parent_email_preferences, "volatility")) continue;
    const key = `${row.fund_id}:${todayKey}`;
    if (state.sentByFundDate[key]) continue;
    const prior = parseFloat(row.prior_snapshot || "0");
    const current = parseFloat(row.latest_snapshot || row.current_balance || "0");
    if (prior <= 0) continue;
    const dropPct = ((prior - current) / prior) * 100;
    if (dropPct < DROP_THRESHOLD_PCT) continue;
    const yrsToMaj = yearsToMajority(
      row.recipient_birthdate ? new Date(row.recipient_birthdate) : null,
      row.majority_age || 18,
      now,
    );
    try {
      await sendEmail(buildVolatilityReassuranceEmail({
        to: row.parent_email,
        parentFirstName: row.parent_first_name,
        childFirstName: row.child_first_name,
        yearsToMajority: yrsToMaj,
        dropPct,
        currentBalanceUsd: current,
        dashboardUrl: `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fund_id)}`,
      }));
      state.sentByFundDate[key] = new Date().toISOString();
      sent += 1;
    } catch (err: any) {
      log(`volatility send failed for fund ${row.fund_id}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveState(state);
    log(`tick done: ${sent} volatility email(s) for ${todayKey}`, WORKER_SOURCE);
  }
}

export function startVolatilityReassuranceWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 135_000);
  log(`started (4×/day; fires when fund balance drops >=${DROP_THRESHOLD_PCT}% day-over-day)`, WORKER_SOURCE);
}
