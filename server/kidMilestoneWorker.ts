// Kid-age milestone worker. Fires on the 5/10/13/16th birthday
// only — distinct from fundBirthdayWorker which fires every year.
// File-backed per-fund-per-milestone idempotence at
// .local/kid-milestone-sends.json.
//
// Why a separate worker instead of folding into fundBirthdayWorker:
// the two emails have different audiences and different framing.
// Birthday = voice-of-the-fund, fires every year (a sustained
// retention pulse). Milestone = parent-facing reflection, fires
// 4 times in the kid's lifetime (a load-bearing emotional beat).
// Keeping them separate keeps each template's voice clear and
// each worker's idempotence key simple.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildKidMilestoneEmail } from "./templates/kidMilestone";
import { isCategoryEnabled } from "@shared/emailPreferences";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "kid-milestone-worker";
const SENDS_STATE_PATH = path.join(process.cwd(), ".local", "kid-milestone-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";
const MILESTONE_AGES: Array<5 | 10 | 13 | 16> = [5, 10, 13, 16];

type SendsState = { lastSentByFundAge: Record<string, string> };

async function loadSendsState(): Promise<SendsState> {
  try {
    const raw = await fs.readFile(SENDS_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { lastSentByFundAge: parsed?.lastSentByFundAge || {} };
  } catch (err: any) {
    if (err?.code === "ENOENT") return { lastSentByFundAge: {} };
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

function getTodayMonthDay(now: Date): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE, month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  let month = 0, day = 0;
  for (const p of parts) {
    if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "day") day = parseInt(p.value, 10);
  }
  return { month, day };
}

function diffYears(birth: Date, now: Date): number {
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
}

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const today = getTodayMonthDay(now);
  let rows: Array<{
    fundId: string; parentEmail: string | null; parentFirstName: string | null;
    parentEmailPreferences: any;
    childFirstName: string | null; recipientBirthdate: Date; fundCreatedAt: Date;
    fundBalance: string | null; fundCashBalance: string | null;
  }>;
  try {
    const result = await pool.query<Record<string, any>>(`
      SELECT
        f.id AS fund_id, u.email AS parent_email, u.first_name AS parent_first_name,
        u.email_preferences AS parent_email_preferences,
        f.recipient_first_name AS child_first_name,
        f.recipient_birthdate AS recipient_birthdate,
        f.created_at AS fund_created_at,
        f.balance AS fund_balance, f.cash_balance AS fund_cash_balance
      FROM funds f
      JOIN users u ON u.id = f.user_id
      WHERE f.transferred_at IS NULL
        AND f.recipient_birthdate IS NOT NULL
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL
        AND EXTRACT(MONTH FROM f.recipient_birthdate) = $1
        AND EXTRACT(DAY FROM f.recipient_birthdate) = $2
      LIMIT 500
    `, [today.month, today.day]);
    rows = result.rows.map((r) => ({
      fundId: String(r.fund_id),
      parentEmail: r.parent_email ? String(r.parent_email) : null,
      parentFirstName: r.parent_first_name ? String(r.parent_first_name) : null,
      parentEmailPreferences: r.parent_email_preferences || null,
      childFirstName: r.child_first_name ? String(r.child_first_name) : null,
      recipientBirthdate: new Date(r.recipient_birthdate),
      fundCreatedAt: new Date(r.fund_created_at),
      fundBalance: r.fund_balance != null ? String(r.fund_balance) : null,
      fundCashBalance: r.fund_cash_balance != null ? String(r.fund_cash_balance) : null,
    }));
  } catch (err: any) {
    log(`milestone query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;

  const state = await loadSendsState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  for (const row of rows) {
    if (!row.parentEmail || !row.childFirstName) continue;
    if (!isCategoryEnabled(row.parentEmailPreferences, "milestones")) continue;
    const age = diffYears(row.recipientBirthdate, now) as 5 | 10 | 13 | 16;
    if (!MILESTONE_AGES.includes(age)) continue;
    const key = `${row.fundId}:${age}`;
    if (state.lastSentByFundAge[key]) continue;
    const fundAgeYears = diffYears(row.fundCreatedAt, now);
    const balanceNum = parseFloat(row.fundBalance || "0");
    const cashNum = parseFloat(row.fundCashBalance || "0");
    const fundTotalUsd = (Number.isFinite(balanceNum) ? balanceNum : 0) + (Number.isFinite(cashNum) ? cashNum : 0);
    const dashboardUrl = `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fundId)}`;
    try {
      await sendEmail(buildKidMilestoneEmail({
        to: row.parentEmail,
        parentFirstName: row.parentFirstName,
        childFirstName: row.childFirstName,
        age,
        fundAgeYears,
        fundTotalUsd,
        dashboardUrl,
      }));
      state.lastSentByFundAge[key] = new Date().toISOString();
      sent += 1;
      log(`kid-milestone sent for fund ${row.fundId} (age ${age})`, WORKER_SOURCE);
    } catch (err: any) {
      log(`kid-milestone send failed for ${row.fundId}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveSendsState(state);
    log(`tick done: sent ${sent}`, WORKER_SOURCE);
  }
}

export function startKidMilestoneWorker(log: LogFn = () => undefined): void {
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 100_000);
  log(`started (daily, fires at ages ${MILESTONE_AGES.join("/")} in ${APP_TIMEZONE})`, WORKER_SOURCE);
}
