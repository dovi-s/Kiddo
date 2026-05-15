// Fund birthday worker.
//
// Fires the once-a-year birthday-from-the-fund email. Daily tick;
// the per-fund eligibility check (today matches the kid's
// birthdate's month + day) keeps the actual send work bounded to
// ~1/365 of the fund base on any given day.
//
// Per-fund idempotence: a file-backed JSON map (lastSentByFundYear)
// records the year of the last send for each fund. We skip funds
// whose key already exists for the current calendar year. The file
// lives at .local/fund-birthday-sends.json and persists across
// process restarts (the .local convention used by every other worker
// in this codebase).
//
// Tone + voice of the email: see server/templates/fundBirthday.ts
// (the FUND is the narrator — "Emma's fund just finished its
// third year"). This worker just orchestrates eligibility +
// idempotence + send; the brand voice lives in the template.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildFundBirthdayEmail } from "./templates/fundBirthday";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "fund-birthday-worker";

const SENDS_STATE_PATH = path.join(process.cwd(), ".local", "fund-birthday-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type SendsState = {
  lastSentByFundYear: Record<string, string>; // key: `${fundId}:${year}` -> ISO timestamp
};

async function loadSendsState(): Promise<SendsState> {
  try {
    const raw = await fs.readFile(SENDS_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      lastSentByFundYear:
        parsed?.lastSentByFundYear && typeof parsed.lastSentByFundYear === "object"
          ? parsed.lastSentByFundYear
          : {},
    };
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
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "https://kiddofund.com";
}

// Compute month + day in the configured app timezone. The naive
// approach (new Date().getMonth()) uses the server's local TZ,
// which can fire a "Mar 1 in NYC" birthday at 7pm Feb 28 UTC if
// the server is in PT. Going through Intl avoids that.
function getTodayMonthDay(now: Date): { month: number; day: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  let month = 0, day = 0, year = 0;
  for (const p of parts) {
    if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "day") day = parseInt(p.value, 10);
    else if (p.type === "year") year = parseInt(p.value, 10);
  }
  return { month, day, year };
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
  // Pull funds where the recipient's birthday month+day matches
  // today, OWNED (not transferred), with a parent email on file.
  // The EXTRACT() clauses use Postgres date-part functions to
  // sidestep timezone subtleties — recipient_birthdate is stored
  // as a timestamp at noon UTC at creation; extracting month/day
  // gives a stable answer that matches what the parent typed.
  let rows: Array<{
    fundId: string;
    parentEmail: string | null;
    parentFirstName: string | null;
    childFirstName: string | null;
    recipientBirthdate: Date;
    fundCreatedAt: Date;
    fundBalance: string | null;
    fundCashBalance: string | null;
    fundSlug: string | null;
  }>;
  try {
    const result = await pool.query<Record<string, any>>(`
      SELECT
        f.id AS fund_id,
        u.email AS parent_email,
        u.first_name AS parent_first_name,
        f.recipient_first_name AS child_first_name,
        f.recipient_birthdate AS recipient_birthdate,
        f.created_at AS fund_created_at,
        f.balance AS fund_balance,
        f.cash_balance AS fund_cash_balance,
        f.slug AS fund_slug
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
      childFirstName: r.child_first_name ? String(r.child_first_name) : null,
      recipientBirthdate: new Date(r.recipient_birthdate),
      fundCreatedAt: new Date(r.fund_created_at),
      fundBalance: r.fund_balance != null ? String(r.fund_balance) : null,
      fundCashBalance: r.fund_cash_balance != null ? String(r.fund_cash_balance) : null,
      fundSlug: r.fund_slug ? String(r.fund_slug) : null,
    }));
  } catch (err: any) {
    log(`birthday query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (rows.length === 0) return;

  const state = await loadSendsState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  for (const row of rows) {
    if (!row.parentEmail) continue;
    if (!row.childFirstName) continue;
    const key = `${row.fundId}:${today.year}`;
    if (state.lastSentByFundYear[key]) continue;
    const childAge = diffYears(row.recipientBirthdate, now);
    if (childAge <= 0 || childAge >= 21) continue; // outside the meaningful range.
    const fundAgeYears = diffYears(row.fundCreatedAt, now);
    const balanceNum = parseFloat(row.fundBalance || "0");
    const cashNum = parseFloat(row.fundCashBalance || "0");
    const fundTotalUsd = (Number.isFinite(balanceNum) ? balanceNum : 0) + (Number.isFinite(cashNum) ? cashNum : 0);
    const dashboardUrl = row.fundSlug
      ? `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fundId)}`
      : `${baseUrl}/dashboard`;
    const memoryBookUrl = `${baseUrl}/memory?fund=${encodeURIComponent(row.fundId)}`;
    try {
      await sendEmail(buildFundBirthdayEmail({
        to: row.parentEmail,
        parentFirstName: row.parentFirstName,
        childFirstName: row.childFirstName,
        childAge,
        fundTotalUsd,
        fundAgeYears: Math.max(1, fundAgeYears),
        dashboardUrl,
        memoryBookUrl,
      }));
      state.lastSentByFundYear[key] = new Date().toISOString();
      sent += 1;
      log(`fund-birthday sent for fund ${row.fundId} (kid age ${childAge})`, WORKER_SOURCE);
    } catch (err: any) {
      log(`fund-birthday send failed for ${row.fundId}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  if (sent > 0) {
    await saveSendsState(state);
    log(`tick done: sent ${sent}`, WORKER_SOURCE);
  }
}

export function startFundBirthdayWorker(log: LogFn = () => undefined): void {
  // First run after 90 seconds so the server has time to come up
  // (matches the pattern of the other lifecycle workers). Daily
  // tick after that.
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => {
      void tick(log).catch(() => null);
    }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 90_000);
  log(`started (daily, fires on the kid's birthday in ${APP_TIMEZONE})`, WORKER_SOURCE);
}
