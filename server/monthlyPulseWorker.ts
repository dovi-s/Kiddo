// Monthly fund pulse worker. Fires on the 1st of every month for
// each active fund with a parent email. File-backed idempotence
// at .local/monthly-pulse-sends.json keyed by fundId:YYYY-MM.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildMonthlyPulseEmail } from "./templates/monthlyPulse";
import { isCategoryEnabled } from "@shared/emailPreferences";
import { buildEmailUnsubscribeUrl } from "./emailUnsubscribeToken";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "monthly-pulse-worker";
const SENDS_PATH = path.join(process.cwd(), ".local", "monthly-pulse-sends.json");
const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 4×/day; only fires on month-day-1 anyway.
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type State = { lastSentByFundMonth: Record<string, string> };

async function loadState(): Promise<State> {
  try { const raw = await fs.readFile(SENDS_PATH, "utf8"); return { lastSentByFundMonth: JSON.parse(raw)?.lastSentByFundMonth || {} }; }
  catch (err: any) { if (err?.code === "ENOENT") return { lastSentByFundMonth: {} }; throw err; }
}
async function saveState(s: State): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_PATH), { recursive: true });
  await fs.writeFile(SENDS_PATH, JSON.stringify(s, null, 2), "utf8");
}
function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}
function getTodayParts(now: Date): { day: number; month: number; year: number; monthName: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  let m = 0, d = 0, y = 0;
  for (const p of parts) { if (p.type === "month") m = parseInt(p.value, 10); else if (p.type === "day") d = parseInt(p.value, 10); else if (p.type === "year") y = parseInt(p.value, 10); }
  return { day: d, month: m, year: y, monthName: MONTH_NAMES[m - 1] || "" };
}

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const today = getTodayParts(now);
  if (today.day !== 1) return; // only on the 1st.
  let rows: any[] = [];
  try {
    const result = await pool.query(`
      SELECT
        f.id AS fund_id, f.recipient_first_name AS child_first_name,
        f.balance AS balance, f.cash_balance AS cash_balance,
        f.pending_balance AS pending_balance,
        u.email AS parent_email, u.first_name AS parent_first_name,
        u.email_preferences AS parent_email_preferences
      FROM funds f
      JOIN users u ON u.id = f.user_id
      WHERE f.transferred_at IS NULL
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL
        AND f.created_at < NOW() - INTERVAL '60 days'
      LIMIT 1000
    `);
    rows = result.rows;
  } catch (err: any) {
    log(`pulse query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;
  const state = await loadState();
  const baseUrl = getBaseUrl();
  const monthKey = `${today.year}-${String(today.month).padStart(2, "0")}`;
  let sent = 0;
  for (const row of rows) {
    if (!row.parent_email || !row.child_first_name) continue;
    if (!isCategoryEnabled(row.parent_email_preferences, "monthlyPulse")) continue;
    const key = `${row.fund_id}:${monthKey}`;
    if (state.lastSentByFundMonth[key]) continue;
    // Compute 30-day-old balance via fund_snapshots if present; otherwise
    // skip the change line. Snapshot query is best-effort.
    // FIXED 2026-06-05 (email-numbers audit): this selected
    // `balance, cash_balance` — columns fund_snapshots DOESN'T HAVE
    // (it has total_value / invested_value / cash_value). The query
    // always threw, the silent catch ate it, prior30Total stayed null,
    // and every pulse would have read "+$0 from this time last month".
    // total_value is the same canonical column the dashboard chart and
    // its "this month" stat read — one fact, one source.
    let prior30Total: number | null = null;
    try {
      const snap = await pool.query(
        `SELECT total_value FROM fund_snapshots WHERE fund_id = $1 AND snapshot_date <= NOW() - INTERVAL '30 days' ORDER BY snapshot_date DESC LIMIT 1`,
        [row.fund_id],
      );
      if (snap.rows.length > 0) {
        const v = parseFloat(snap.rows[0].total_value || "0");
        if (Number.isFinite(v) && v > 0) prior30Total = v;
      }
    } catch { /* fund_snapshots optional */ }
    const giftAgg = await pool.query(
      `SELECT COUNT(*)::int AS gift_count, COUNT(DISTINCT LOWER(sender_email))::int AS distinct_senders FROM gifts WHERE fund_id = $1 AND created_at > NOW() - INTERVAL '30 days' AND status IN ('processing','settled','completed')`,
      [row.fund_id],
    ).catch(() => ({ rows: [{ gift_count: 0, distinct_senders: 0 }] }));
    const newGifterAgg = await pool.query(
      `SELECT COUNT(*)::int AS new_gifters FROM (SELECT MIN(created_at) AS first_gift, LOWER(sender_email) AS se FROM gifts WHERE fund_id = $1 AND status IN ('processing','settled','completed') GROUP BY LOWER(sender_email)) sub WHERE sub.first_gift > NOW() - INTERVAL '30 days'`,
      [row.fund_id],
    ).catch(() => ({ rows: [{ new_gifters: 0 }] }));
    // The PEOPLE who gave last month (one name per distinct gifter, most recent
    // first, "Anonymous" excluded). This is what lets the digest say "Grandma and
    // Uncle Mike gave" instead of "3 deposits" — the warmth a brokerage can't send.
    const namesAgg = await pool.query(
      `SELECT sender_name FROM (
         SELECT DISTINCT ON (LOWER(sender_email)) sender_name, created_at
         FROM gifts
         WHERE fund_id = $1 AND created_at > NOW() - INTERVAL '30 days'
           AND status IN ('processing','settled','completed')
           AND sender_name IS NOT NULL AND TRIM(sender_name) <> '' AND LOWER(TRIM(sender_name)) <> 'anonymous'
         ORDER BY LOWER(sender_email), created_at DESC
       ) s ORDER BY s.created_at DESC LIMIT 6`,
      [row.fund_id],
    ).catch(() => ({ rows: [] as Array<{ sender_name: string }> }));
    const gifterNames: string[] = (namesAgg.rows || []).map((r: any) => String(r.sender_name || "")).filter(Boolean);
    // One recent gift note to bring back as the month's Memory Book moment.
    const noteAgg = await pool.query(
      `SELECT sender_name, message FROM gifts
       WHERE fund_id = $1 AND created_at > NOW() - INTERVAL '30 days'
         AND status IN ('processing','settled','completed')
         AND message IS NOT NULL AND TRIM(message) <> ''
       ORDER BY created_at DESC LIMIT 1`,
      [row.fund_id],
    ).catch(() => ({ rows: [] as Array<{ sender_name: string; message: string }> }));
    const memoryMoment = noteAgg.rows?.[0]
      ? { senderName: String(noteAgg.rows[0].sender_name || ""), message: String(noteAgg.rows[0].message || "") }
      : null;
    // Same composition as the dashboard hero (invested balance + pending +
    // cash) so the email's headline number never disagrees with what the
    // parent sees when they click through — the click IS the product moment.
    const total = parseFloat(row.balance || "0") + parseFloat(row.cash_balance || "0") + parseFloat(row.pending_balance || "0");
    // null = "we don't have a 30-day baseline" → the template OMITS the
    // change line entirely. Never claim "+$0" out of ignorance.
    const changeUsd = prior30Total != null ? total - prior30Total : null;
    const changePct = prior30Total != null && prior30Total > 0 && changeUsd != null ? (changeUsd / prior30Total) * 100 : null;
    try {
      // fundId → bereavement freeze suppresses at the email chokepoint. See BEREAVEMENT_POSTURE.md.
      await sendEmail({ ...buildMonthlyPulseEmail({
        to: row.parent_email,
        unsubscribeUrl: buildEmailUnsubscribeUrl(baseUrl, row.parent_email, "monthlyPulse"),
        parentFirstName: row.parent_first_name,
        childFirstName: row.child_first_name,
        fundTotalUsd: total,
        changeUsd,
        changePct,
        giftCount30d: giftAgg.rows[0]?.gift_count || 0,
        newGifterCount30d: newGifterAgg.rows[0]?.new_gifters || 0,
        gifterNames,
        memoryMoment,
        monthName: MONTH_NAMES[(today.month - 2 + 12) % 12], // the month that just ended
        dashboardUrl: `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fund_id)}`,
      }), fundId: String(row.fund_id) });
      state.lastSentByFundMonth[key] = new Date().toISOString();
      sent += 1;
    } catch (err: any) {
      log(`pulse send failed for fund ${row.fund_id}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveState(state);
    log(`tick done: sent ${sent}`, WORKER_SOURCE);
  }
}

export function startMonthlyPulseWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 110_000);
  log(`started (4×/day; fires on the 1st of each month in ${APP_TIMEZONE})`, WORKER_SOURCE);
}
