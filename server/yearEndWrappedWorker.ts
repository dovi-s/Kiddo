// Year-end Wrapped worker. Fires once per fund between Dec 15-31
// in APP_TIMEZONE. File-backed idempotence at
// .local/wrapped-sends.json keyed by fundId:year. Aggregates the
// year's gifts + top gifter from the gifts table.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildYearEndWrappedEmail } from "./templates/yearEndWrapped";
import { isCategoryEnabled } from "@shared/emailPreferences";
import { buildEmailUnsubscribeUrl } from "./emailUnsubscribeToken";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "wrapped-worker";
const SENDS_PATH = path.join(process.cwd(), ".local", "wrapped-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type State = { sentByFundYear: Record<string, string> };
async function loadState(): Promise<State> {
  try { const raw = await fs.readFile(SENDS_PATH, "utf8"); return { sentByFundYear: JSON.parse(raw)?.sentByFundYear || {} }; }
  catch (err: any) { if (err?.code === "ENOENT") return { sentByFundYear: {} }; throw err; }
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

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const today = getTodayParts(now);
  // Window: Dec 15 - Dec 31 in APP_TIMEZONE.
  if (today.month !== 12 || today.day < 15) return;
  const year = today.year;
  let rows: any[] = [];
  try {
    const result = await pool.query(`
      SELECT f.id AS fund_id, f.recipient_first_name AS child_first_name,
             f.balance AS balance, f.cash_balance AS cash_balance,
             u.email AS parent_email, u.first_name AS parent_first_name,
             u.email_preferences AS parent_email_preferences
      FROM funds f
      JOIN users u ON u.id = f.user_id
      WHERE f.transferred_at IS NULL
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL
        AND f.created_at < (TIMESTAMP '${year}-12-01')
      LIMIT 2000
    `);
    rows = result.rows;
  } catch (err: any) {
    log(`wrapped query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;
  const state = await loadState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  for (const row of rows) {
    if (!row.parent_email || !row.child_first_name) continue;
    if (!isCategoryEnabled(row.parent_email_preferences, "wrapped")) continue;
    const key = `${row.fund_id}:${year}`;
    if (state.sentByFundYear[key]) continue;
    // Pull year-aggregate from gifts.
    let agg: any = { gift_count: 0, unique_gifters: 0, total_gifted: 0, largest_single: 0 };
    try {
      const r = await pool.query(`
        SELECT
          COUNT(*)::int AS gift_count,
          COUNT(DISTINCT LOWER(sender_email))::int AS unique_gifters,
          COALESCE(SUM(GREATEST(net_amount::numeric, amount::numeric)), 0)::numeric AS total_gifted,
          COALESCE(MAX(GREATEST(net_amount::numeric, amount::numeric)), 0)::numeric AS largest_single
        FROM gifts WHERE fund_id = $1
          AND created_at >= TIMESTAMP '${year}-01-01'
          AND created_at <  TIMESTAMP '${year + 1}-01-01'
          AND status IN ('processing','settled','completed')
      `, [row.fund_id]);
      if (r.rows[0]) agg = r.rows[0];
    } catch { /* keep zero defaults */ }
    let topGifter: { name: string | null; amount: number } | null = null;
    try {
      const r = await pool.query(`
        SELECT sender_name, SUM(GREATEST(net_amount::numeric, amount::numeric))::numeric AS total
        FROM gifts WHERE fund_id = $1
          AND created_at >= TIMESTAMP '${year}-01-01'
          AND created_at <  TIMESTAMP '${year + 1}-01-01'
          AND status IN ('processing','settled','completed')
          AND sender_email IS NOT NULL
        GROUP BY sender_email, sender_name
        ORDER BY total DESC LIMIT 1
      `, [row.fund_id]);
      if (r.rows[0]) topGifter = { name: r.rows[0].sender_name, amount: parseFloat(r.rows[0].total) };
    } catch { /* skip top-gifter line */ }
    let startBalance = 0;
    try {
      const r = await pool.query(
        `SELECT balance, cash_balance FROM fund_snapshots WHERE fund_id = $1 AND snapshot_date <= TIMESTAMP '${year}-01-15' ORDER BY snapshot_date DESC LIMIT 1`,
        [row.fund_id],
      );
      if (r.rows[0]) startBalance = parseFloat(r.rows[0].balance || "0") + parseFloat(r.rows[0].cash_balance || "0");
    } catch { /* leave 0 */ }
    const endBalance = parseFloat(row.balance || "0") + parseFloat(row.cash_balance || "0");
    try {
      // fundId → bereavement freeze suppresses at the email chokepoint. See BEREAVEMENT_POSTURE.md.
      await sendEmail({ ...buildYearEndWrappedEmail({
        to: row.parent_email,
        unsubscribeUrl: buildEmailUnsubscribeUrl(baseUrl, row.parent_email, "wrapped"),
        parentFirstName: row.parent_first_name,
        childFirstName: row.child_first_name,
        year,
        startBalanceUsd: startBalance,
        endBalanceUsd: endBalance,
        totalGiftedUsd: parseFloat(agg.total_gifted),
        giftCount: agg.gift_count,
        uniqueGifterCount: agg.unique_gifters,
        topGifterName: topGifter?.name,
        topGifterAmountUsd: topGifter?.amount,
        largestSingleGiftUsd: parseFloat(agg.largest_single),
        dashboardUrl: `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fund_id)}`,
        memoryBookUrl: `${baseUrl}/memory?fund=${encodeURIComponent(row.fund_id)}`,
      }), fundId: String(row.fund_id) });
      state.sentByFundYear[key] = new Date().toISOString();
      sent += 1;
    } catch (err: any) {
      log(`wrapped send failed for fund ${row.fund_id}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveState(state);
    log(`tick done: ${year} wrapped sent ${sent}`, WORKER_SOURCE);
  }
}

export function startYearEndWrappedWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 120_000);
  log(`started (daily, fires Dec 15-31 in ${APP_TIMEZONE})`, WORKER_SOURCE);
}
