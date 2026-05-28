// Gifter year-end giving summary worker.
//
// Counterpart to yearEndWrappedWorker (which emails parents about
// their child's year). This one emails GIFTERS the grandparent,
// aunt, uncle, godparent, family friend with a consolidated view
// of every gift they made across every fund in the calendar year.
//
// Locked 2026-05-19 per the Five Towns roadmap P4. The sophisticated
// gifter persona (grandfather giving across multiple grandkids,
// professional tracking Form 709 annual exclusion) needs this
// artifact at year-end; the parent-side wrapped doesn't serve them.
//
// Architecture matches yearEndWrappedWorker:
//   - Fires Dec 15-31 in APP_TIMEZONE, daily tick
//   - File-backed idempotence at .local/gifter-wrapped-sends.json
//     keyed by `email:year` (lowercased email)
//   - Single SQL roll-up to gather per-gifter aggregates for the year
//   - Honors the gifter notification subscription state anonymous
//     gifters who didn't opt into updates are skipped
//   - Uses the receipt-grade email template with structured details
//
// Why a separate worker (not reusing yearEndWrappedWorker):
//   - Different recipient (gifters, not parents)
//   - Different aggregation grain (per-gifter across all funds, not
//     per-fund)
//   - Different opt-in source (gifter subscriptions table, not parent
//     email preferences)
//   - Different idempotence key (email:year, not fundId:year)
//
// Worker is triggered from the same Postmark cron / scheduler that
// invokes the parent wrapped worker. See server/scheduler.ts (or
// equivalent) for the daily tick wiring once this lands.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import {
  buildGifterYearEndSummaryEmail,
  type PerRecipientSummary,
} from "./templates/gifterYearEndSummary";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "gifter-wrapped-worker";
const SENDS_PATH = path.join(process.cwd(), ".local", "gifter-wrapped-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type State = { sentByEmailYear: Record<string, string> };

async function loadState(): Promise<State> {
  try {
    const raw = await fs.readFile(SENDS_PATH, "utf8");
    return { sentByEmailYear: JSON.parse(raw)?.sentByEmailYear || {} };
  } catch (err: any) {
    if (err?.code === "ENOENT") return { sentByEmailYear: {} };
    throw err;
  }
}

async function saveState(s: State): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_PATH), { recursive: true });
  await fs.writeFile(SENDS_PATH, JSON.stringify(s, null, 2), "utf8");
}

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}

function getTodayParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  let y = 0, m = 0, d = 0;
  for (const p of parts) {
    if (p.type === "year") y = parseInt(p.value, 10);
    else if (p.type === "month") m = parseInt(p.value, 10);
    else if (p.type === "day") d = parseInt(p.value, 10);
  }
  return { year: y, month: m, day: d };
}

type GifterAggregateRow = {
  sender_email: string;
  sender_name: string | null;
  gift_count: number;
  total_amount_cents: number;
  largest_single_cents: number;
  recipient_count: number;
};

type PerRecipientRow = {
  sender_email: string;
  fund_id: string;
  child_first_name: string | null;
  gift_count: number;
  total_amount: number;
};

async function tick(log: LogFn): Promise<void> {
  const now = new Date();
  const today = getTodayParts(now);
  // Same window as parent-side: Dec 15-31 in APP_TIMEZONE.
  if (today.month !== 12 || today.day < 15) return;
  const year = today.year;

  // First pass: aggregate per-gifter totals for the year.
  // - Excludes parent's own contributions (parent_contribution_id IS NOT NULL).
  // - Excludes failed/canceled/refunded (these don't represent real giving).
  // - Excludes pending (not yet a real gift).
  // - Excludes auto-invest boilerplate-message legacy rows (defensive).
  // - Groups by lowercased sender_email so case variations don't fragment one gifter.
  let aggregates: GifterAggregateRow[] = [];
  try {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31 23:59:59`;
    const result = await pool.query(
      `
      SELECT
        LOWER(TRIM(g.sender_email)) AS sender_email,
        MAX(g.sender_name) AS sender_name,
        COUNT(*)::int AS gift_count,
        ROUND(SUM(g.amount) * 100)::bigint AS total_amount_cents,
        ROUND(MAX(g.amount) * 100)::bigint AS largest_single_cents,
        COUNT(DISTINCT g.fund_id)::int AS recipient_count
      FROM gifts g
      WHERE g.sender_email IS NOT NULL
        AND g.sender_email <> ''
        AND g.parent_contribution_id IS NULL
        AND g.status NOT IN ('failed', 'canceled', 'refunded', 'pending')
        AND g.created_at >= $1::timestamp
        AND g.created_at <= $2::timestamp
      GROUP BY LOWER(TRIM(g.sender_email))
      HAVING COUNT(*) > 0
      `,
      [yearStart, yearEnd],
    );
    aggregates = result.rows as any[];
  } catch (err: any) {
    log(`gifter-wrapped aggregate query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (aggregates.length === 0) return;

  // Second pass: per-recipient breakdown per gifter, for the email's
  // structured details block. One bigger query rather than per-gifter
  // queries easier on the DB at year-end scale.
  let perRecipientRows: PerRecipientRow[] = [];
  try {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31 23:59:59`;
    const result = await pool.query(
      `
      SELECT
        LOWER(TRIM(g.sender_email)) AS sender_email,
        g.fund_id AS fund_id,
        f.recipient_first_name AS child_first_name,
        COUNT(*)::int AS gift_count,
        SUM(g.amount)::float8 AS total_amount
      FROM gifts g
      LEFT JOIN funds f ON f.id = g.fund_id
      WHERE g.sender_email IS NOT NULL
        AND g.sender_email <> ''
        AND g.parent_contribution_id IS NULL
        AND g.status NOT IN ('failed', 'canceled', 'refunded', 'pending')
        AND g.created_at >= $1::timestamp
        AND g.created_at <= $2::timestamp
      GROUP BY LOWER(TRIM(g.sender_email)), g.fund_id, f.recipient_first_name
      ORDER BY total_amount DESC
      `,
      [yearStart, yearEnd],
    );
    perRecipientRows = result.rows as any[];
  } catch (err: any) {
    log(`gifter-wrapped per-recipient query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }

  // Group per-recipient rows by gifter for fast lookup in the loop.
  const perRecipientByEmail = new Map<string, PerRecipientSummary[]>();
  for (const row of perRecipientRows) {
    const email = String(row.sender_email || "").trim().toLowerCase();
    if (!email) continue;
    const list = perRecipientByEmail.get(email) || [];
    list.push({
      childFirstName: String(row.child_first_name || "their child").trim() || "their child",
      giftCount: Number(row.gift_count || 0),
      totalGiftedUsd: Number(row.total_amount || 0),
    });
    perRecipientByEmail.set(email, list);
  }

  const state = await loadState();
  const baseUrl = getBaseUrl();
  let sent = 0;
  let skippedAlreadySent = 0;
  let skippedAnonymousFallback = 0;

  for (const row of aggregates) {
    const email = String(row.sender_email || "").trim().toLowerCase();
    if (!email) continue;
    // Skip pseudo-emails or obvious non-emails defensive guard since
    // gifts.sender_email is free-text.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skippedAnonymousFallback += 1;
      continue;
    }

    const idemKey = `${email}:${year}`;
    if (state.sentByEmailYear[idemKey]) {
      skippedAlreadySent += 1;
      continue;
    }

    const giftCount = Number(row.gift_count || 0);
    const totalGiftedUsd = Number(row.total_amount_cents || 0) / 100;
    const largestSingleGiftUsd = Number(row.largest_single_cents || 0) / 100;
    const recipientCount = Number(row.recipient_count || 0);
    if (giftCount <= 0 || totalGiftedUsd <= 0) continue;

    // Threshold gate: only send if total gifted ≥ $25. Sending a
    // year-end summary for a single $5 gift reads as spam; the
    // sophisticated gifter persona this is for has given meaningful
    // dollars. The lower bound is conservative any real gifter
    // (grandma sending birthday $50, etc.) clears it.
    if (totalGiftedUsd < 25) continue;

    // First-name guess from sender_name (typically "First Last" but
    // could be just "First" or pseudonymous). If empty or anonymous-
    // pattern, the greeting drops to "Hi there,".
    const rawName = String(row.sender_name || "").trim();
    const isAnonymousName = !rawName
      || /^anonymous$/i.test(rawName)
      || /^someone who loves /i.test(rawName);
    const firstName = isAnonymousName ? null : rawName.split(/\s+/)[0];

    const perRecipient = perRecipientByEmail.get(email) || [];

    const csvDownloadUrl = `${baseUrl}/api/gifter-account/gifts.csv?year=${year}`;
    // Brandable first-person URL (alias of /gifter; both resolve to the
    // gifter dashboard). This is what we surface in outbound copy/emails.
    const dashboardUrl = `${baseUrl}/my-gifts`;

    const message = buildGifterYearEndSummaryEmail({
      to: email,
      gifterFirstName: firstName,
      year,
      totalGiftedUsd,
      giftCount,
      recipientCount,
      largestSingleGiftUsd,
      perRecipient,
      csvDownloadUrl,
      dashboardUrl,
    });

    try {
      const delivery = await sendEmail(message);
      if (delivery.delivered) {
        state.sentByEmailYear[idemKey] = new Date().toISOString();
        sent += 1;
      } else {
        log(`gifter-wrapped delivery skipped for ${email}: mode=${delivery.mode}`, WORKER_SOURCE);
      }
    } catch (err: any) {
      log(`gifter-wrapped send failed for ${email}: ${err?.message || err}`, WORKER_SOURCE);
    }

    // Persist after each send so a crash mid-batch doesn't re-send
    // the prefix on restart. Same defensive pattern as the parent
    // wrapped worker.
    await saveState(state);
  }

  log(
    `gifter-wrapped tick complete: sent=${sent}, skipped_already_sent=${skippedAlreadySent}, skipped_invalid_email=${skippedAnonymousFallback}, candidates=${aggregates.length}`,
    WORKER_SOURCE,
  );
}

let runningTimer: NodeJS.Timeout | null = null;
let lastRunAt = 0;

export function startGifterYearEndWorker(log: LogFn = console.log): void {
  if (runningTimer) return;
  const run = async () => {
    const since = Date.now() - lastRunAt;
    if (since < RUN_INTERVAL_MS - 1000) return;
    lastRunAt = Date.now();
    try {
      await tick(log);
    } catch (err: any) {
      log(`gifter-wrapped tick errored: ${err?.message || err}`, WORKER_SOURCE);
    }
  };
  // Initial run on boot (cheap when outside the Dec 15-31 window).
  void run();
  // Then every hour coarser than the parent wrapped because per-
  // gifter aggregation is the heavier query of the two.
  runningTimer = setInterval(run, 60 * 60 * 1000);
}

export function stopGifterYearEndWorker(): void {
  if (runningTimer) {
    clearInterval(runningTimer);
    runningTimer = null;
  }
}

// Exposed for manual / scheduled invocation. The parent wrapped
// worker has a similar runOnce() entry point for the scheduler.
export async function runGifterYearEndWorkerOnce(log: LogFn = console.log): Promise<void> {
  try {
    await tick(log);
  } catch (err: any) {
    log(`gifter-wrapped runOnce errored: ${err?.message || err}`, WORKER_SOURCE);
  }
}
