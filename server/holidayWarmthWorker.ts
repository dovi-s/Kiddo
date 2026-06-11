// Mother's Day + Father's Day warmth worker. Fires on the
// second Sunday of May (Mother's Day) and third Sunday of June
// (Father's Day) in APP_TIMEZONE. File-backed idempotence at
// .local/holiday-warmth-sends.json keyed by fundId:year:holiday.
//
// Parent role hint: we try to infer mom/dad from the
// recipientRelation column on the fund ("mother", "father",
// "parent", etc.) and fall back to generic "parent" when
// unclear. Each fund row's relation is what the parent typed at
// fund-creation time; nothing here changes their stored data.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildHolidayWarmthEmail } from "./templates/holidayWarmth";
import { isCategoryEnabled } from "@shared/emailPreferences";
import { buildEmailUnsubscribeUrl } from "./emailUnsubscribeToken";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "holiday-warmth-worker";
const SENDS_PATH = path.join(process.cwd(), ".local", "holiday-warmth-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type State = { sentByFundYearHoliday: Record<string, string> };
async function loadState(): Promise<State> {
  try { const raw = await fs.readFile(SENDS_PATH, "utf8"); return { sentByFundYearHoliday: JSON.parse(raw)?.sentByFundYearHoliday || {} }; }
  catch (err: any) { if (err?.code === "ENOENT") return { sentByFundYearHoliday: {} }; throw err; }
}
async function saveState(s: State): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_PATH), { recursive: true });
  await fs.writeFile(SENDS_PATH, JSON.stringify(s, null, 2), "utf8");
}
function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}
function getTodayParts(now: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).formatToParts(now);
  let y = 0, m = 0, d = 0; let weekday = 0;
  const weekdayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  for (const p of parts) {
    if (p.type === "year") y = parseInt(p.value, 10);
    else if (p.type === "month") m = parseInt(p.value, 10);
    else if (p.type === "day") d = parseInt(p.value, 10);
    else if (p.type === "weekday") weekday = weekdayNames.indexOf(p.value);
  }
  return { year: y, month: m, day: d, weekday };
}
// Which holiday is today (if any). null = neither.
function detectHolidayToday(t: { month: number; day: number; weekday: number }): "Mother's Day" | "Father's Day" | null {
  if (t.weekday !== 0) return null; // Both are Sundays.
  if (t.month === 5 && t.day >= 8 && t.day <= 14) return "Mother's Day"; // 2nd Sunday of May
  if (t.month === 6 && t.day >= 15 && t.day <= 21) return "Father's Day"; // 3rd Sunday of June
  return null;
}
function inferParentRole(relation: string | null, holiday: "Mother's Day" | "Father's Day"): "mom" | "dad" | "parent" {
  const r = (relation || "").toLowerCase().trim();
  if (holiday === "Mother's Day") {
    if (r.includes("mother") || r === "mom") return "mom";
    if (r.includes("father") || r === "dad") return "parent"; // not their day; send generic, OR caller can skip.
  }
  if (holiday === "Father's Day") {
    if (r.includes("father") || r === "dad") return "dad";
    if (r.includes("mother") || r === "mom") return "parent";
  }
  return "parent";
}

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const today = getTodayParts(now);
  const holiday = detectHolidayToday(today);
  if (!holiday) return;
  let rows: any[] = [];
  try {
    const result = await pool.query(`
      SELECT f.id AS fund_id, f.recipient_first_name AS child_first_name,
             f.recipient_relation AS recipient_relation,
             f.balance AS balance, f.cash_balance AS cash_balance,
             u.email AS parent_email, u.first_name AS parent_first_name,
             u.email_preferences AS parent_email_preferences
      FROM funds f
      JOIN users u ON u.id = f.user_id
      WHERE f.transferred_at IS NULL
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL
      LIMIT 2000
    `);
    rows = result.rows;
  } catch (err: any) {
    log(`holiday query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;
  const state = await loadState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  for (const row of rows) {
    if (!row.parent_email || !row.child_first_name) continue;
    if (!isCategoryEnabled(row.parent_email_preferences, "motherFathersDay")) continue;
    const role = inferParentRole(row.recipient_relation, holiday);
    // Skip when the relation explicitly conflicts with this holiday
    // (e.g., a "father" entry on Mother's Day would just feel weird).
    if (role === "parent" && (row.recipient_relation || "").trim()) {
      const r = String(row.recipient_relation).toLowerCase();
      if (holiday === "Mother's Day" && (r.includes("father") || r === "dad")) continue;
      if (holiday === "Father's Day" && (r.includes("mother") || r === "mom")) continue;
    }
    const key = `${row.fund_id}:${today.year}:${holiday}`;
    if (state.sentByFundYearHoliday[key]) continue;
    const total = parseFloat(row.balance || "0") + parseFloat(row.cash_balance || "0");
    try {
      // fundId → bereavement freeze suppresses at the email chokepoint. See BEREAVEMENT_POSTURE.md.
      await sendEmail({ ...buildHolidayWarmthEmail({
        to: row.parent_email,
        unsubscribeUrl: buildEmailUnsubscribeUrl(baseUrl, row.parent_email, "motherFathersDay"),
        parentFirstName: row.parent_first_name,
        childFirstName: row.child_first_name,
        fundTotalUsd: total,
        holidayLabel: holiday,
        parentRole: role,
        dashboardUrl: `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fund_id)}`,
        memoryBookUrl: `${baseUrl}/memory?fund=${encodeURIComponent(row.fund_id)}`,
      }), fundId: String(row.fund_id) });
      state.sentByFundYearHoliday[key] = new Date().toISOString();
      sent += 1;
    } catch (err: any) {
      log(`holiday send failed for fund ${row.fund_id}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveState(state);
    log(`tick done: ${holiday} sent ${sent}`, WORKER_SOURCE);
  }
}

export function startHolidayWarmthWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 115_000);
  log(`started (daily, fires on Mother's Day + Father's Day in ${APP_TIMEZONE})`, WORKER_SOURCE);
}
