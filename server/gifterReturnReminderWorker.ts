// Gifter return-year reminder worker. Fires once a year per
// gifter-fund pair when the gifter's last gift to that fund is
// between 365 and 380 days ago. The 15-day window keeps us
// resilient to worker downtime without re-firing the same gifter
// every day for two weeks.
//
// File-backed idempotence at .local/gifter-return-sends.json
// keyed by gifterEmail:fundId:year. Per-year keyed instead of
// per-event so each year a long-lapsed gifter can get a fresh
// nudge.
//
// Respects the recipient (gifter) email-preferences. Gifters
// don't have user accounts by default; we treat them as having
// no preferences map (all categories enabled) unless we find a
// matching user row by email in which case we honor that
// user's gifterReturn preference.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildGifterReturnReminderEmail } from "./templates/gifterReturnReminder";
import { isCategoryEnabled } from "@shared/emailPreferences";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "gifter-return-worker";
const SENDS_PATH = path.join(process.cwd(), ".local", "gifter-return-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

type State = { sentByGifterFundYear: Record<string, string> };
async function loadState(): Promise<State> {
  try { const raw = await fs.readFile(SENDS_PATH, "utf8"); return { sentByGifterFundYear: JSON.parse(raw)?.sentByGifterFundYear || {} }; }
  catch (err: any) { if (err?.code === "ENOENT") return { sentByGifterFundYear: {} }; throw err; }
}
async function saveState(s: State): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_PATH), { recursive: true });
  await fs.writeFile(SENDS_PATH, JSON.stringify(s, null, 2), "utf8");
}
function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}

async function tick(log: LogFn): Promise<void> {
  let rows: any[] = [];
  try {
    // For each (sender_email, fund_id), the most recent gift date.
    // Keep candidates where the most recent gift is 365-380 days
    // ago (a 15-day window). Joined with fund + matching user
    // (for prefs).
    const result = await pool.query(`
      WITH last_gifts AS (
        SELECT
          LOWER(sender_email) AS sender_email,
          fund_id,
          MAX(sender_name) AS sender_name_any,
          MAX(created_at) AS last_gift_at
        FROM gifts
        WHERE sender_email IS NOT NULL
          AND status IN ('processing','settled','completed')
        GROUP BY LOWER(sender_email), fund_id
      )
      SELECT
        lg.sender_email,
        lg.fund_id,
        lg.sender_name_any AS sender_name,
        lg.last_gift_at,
        f.slug AS fund_slug,
        f.recipient_first_name AS child_first_name,
        f.transferred_at AS fund_transferred_at,
        u.email_preferences AS gifter_email_preferences
      FROM last_gifts lg
      JOIN funds f ON f.id = lg.fund_id
      LEFT JOIN users u ON LOWER(u.email) = lg.sender_email
      WHERE lg.last_gift_at < NOW() - INTERVAL '365 days'
        AND lg.last_gift_at > NOW() - INTERVAL '380 days'
        AND f.transferred_at IS NULL
      LIMIT 500
    `);
    rows = result.rows;
  } catch (err: any) {
    log(`gifter-return query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;
  const state = await loadState();
  const baseUrl = getBaseUrl();
  const thisYear = new Date().getUTCFullYear();
  let sent = 0;
  for (const row of rows) {
    if (!row.sender_email || !row.child_first_name) continue;
    if (!isCategoryEnabled(row.gifter_email_preferences, "gifterReturn")) continue;
    const key = `${row.sender_email}:${row.fund_id}:${thisYear}`;
    if (state.sentByGifterFundYear[key]) continue;
    const lastGiftDate = new Date(row.last_gift_at);
    const monthsAgo = Math.round((Date.now() - lastGiftDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    const firstName = (row.sender_name || "").trim().split(/\s+/)[0] || null;
    const giftUrl = row.fund_slug
      ? `${baseUrl}/${row.fund_slug}`
      : `${baseUrl}/gift/${row.fund_id}`;
    try {
      await sendEmail(buildGifterReturnReminderEmail({
        to: row.sender_email,
        gifterFirstName: firstName,
        childFirstName: row.child_first_name,
        lastGiftMonthsAgo: monthsAgo,
        giftUrl,
      }));
      state.sentByGifterFundYear[key] = new Date().toISOString();
      sent += 1;
    } catch (err: any) {
      log(`gifter-return send failed for ${row.sender_email}/${row.fund_id}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveState(state);
    log(`tick done: sent ${sent}`, WORKER_SOURCE);
  }
}

export function startGifterReturnReminderWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 130_000);
  log(`started (daily, fires when gifter's last gift is 365-380 days ago)`, WORKER_SOURCE);
}
