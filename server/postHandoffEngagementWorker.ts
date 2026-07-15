// Post-handoff quarterly engagement loop. Per AGE_18_HANDOFF_SPEC.md
// bucket 3.
//
// Once a kid claims a fund (ownership transferred from parent → kid
// via /api/age-transition/:token/complete), Kiddo currently goes
// silent. This worker fixes that: quarterly summary email on the
// 15th of Jan / Apr / Jul / Oct that tells the kid:
//   - Their balance change vs last quarter
//   - Their top mover (largest gainer/loser by %)
//   - One framing sentence ("Not doing anything is also a choice.
//     Compounding works while you sleep.")
//
// Cadence rationale: matches the rhythm of quarterly earnings the
// kid will hear about in the world. The summary email reinforces
// the calendar pattern they're already absorbing not creating a
// new one.
//
// Guards: don't fire within 60 days of handoff (don't email a kid
// one week after they claimed). Don't fire if we already emailed
// in the last 80 days (handles month-end edge cases without double-
// sending).
//
// Single-process worker, daily tick. Same shape as demoResetWorker.
// Off by default; toggled by ENABLE_POST_HANDOFF_ENGAGEMENT=1 env
// flag so a developer laptop doesn't accidentally email real kids.

import { db } from "./db";
import { funds, users } from "@shared/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { sendEmail } from "./emailDelivery";
import { renderKiddoEmail } from "./templates/baseTemplate";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "post-handoff-engagement";

// 15th of Jan / Apr / Jul / Oct (UTC). Window is the 15th–17th to
// catch any tick that lands a day off. Within the window, each
// owner is emailed at most once because the lastQuarterlySummaryAt
// column gets stamped on send.
const QUARTERLY_MONTHS = new Set([0, 3, 6, 9]); // Jan, Apr, Jul, Oct
// Widened from 3 to 7 days on 2026-05-15 (timing-audit follow-up).
// The old 3-day window (15-17) meant a worker outage spanning those
// three days permanently skipped the quarter for everyone and
// quarterly summaries are themselves rare-cadence emails, so a
// missed quarter is a big chunk of the engagement loop gone. With
// the RESEND_DEDUP_DAYS cap below (80 days), widening to a week
// can't fire the same quarter twice; the dedup column does the
// work. Worst-case the email arrives a few days later than ideal
// vs missing entirely.
const WINDOW_DAYS = 7;

// Don't email a kid in the first 60 days post-handoff. They just
// went through the welcome walkthrough; let them breathe before
// the quarterly cadence starts.
const POST_HANDOFF_GRACE_DAYS = 60;

// Re-send dedup window. If the column was stamped <80 days ago,
// skip handles the case where the worker fires twice on the same
// 15th due to a server restart.
const RESEND_DEDUP_DAYS = 80;

// 30-day check-in window. Locked 2026-05-21 per Tier-2 deferred
// item #5. Distinct from the quarterly summary: this is a ONE-time
// "you've owned this for a month, here's how it's quietly been"
// email, fired when the post-handoff updated_at lands inside the
// 30-60 day window AND kidThirtyDayCheckInAt is null. Lower bound
// keeps it out of the immediate-post-welcome week; upper bound
// caps how late the check-in can fire if the worker missed the
// optimal day (e.g. multi-day outage). Once it sends,
// kidThirtyDayCheckInAt gets stamped and it never re-fires.
const THIRTY_DAY_MIN = 30;
const THIRTY_DAY_MAX = 60;

function isInQuarterlyWindow(now = new Date()): boolean {
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  if (!QUARTERLY_MONTHS.has(month)) return false;
  return day >= 15 && day < 15 + WINDOW_DAYS;
}

type EngagementCandidate = {
  userId: string;
  email: string | null;
  firstName: string | null;
  fundId: string;
  fundName: string;
  recipientFirstName: string | null;
  balance: string;
  totalGain: string | null;
  lastQuarterlySummaryAt: Date | null;
};

async function findEligibleOwners(now: Date): Promise<EngagementCandidate[]> {
  // A kid-owner is a user who owns a fund with accountType=Personal
  // AND recipientRelation=self. That combination is set by the
  // /complete handoff endpoint; pre-handoff funds are UTMA + a
  // parent-named relation.
  //
  // ownershipTransferredAt lives in the age-transition state record
  // (per worker comments at age18TransitionWorker.ts), not directly
  // on funds. Practical proxy: a fund whose accountType flipped to
  // Personal whose updated_at is older than the grace period.
  const graceCutoff = new Date(now.getTime() - POST_HANDOFF_GRACE_DAYS * 86400000);
  const dedupCutoff = new Date(now.getTime() - RESEND_DEDUP_DAYS * 86400000);

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastQuarterlySummaryAt: users.lastQuarterlySummaryAt,
      fundId: funds.id,
      fundName: funds.name,
      recipientFirstName: funds.recipientFirstName,
      balance: funds.balance,
      totalGain: funds.totalGain,
      accountType: funds.accountType,
      recipientRelation: funds.recipientRelation,
      updatedAt: funds.updatedAt,
    })
    .from(funds)
    .innerJoin(users, eq(funds.userId, users.id))
    .where(
      and(
        sql`LOWER(${funds.accountType}) = 'personal'`,
        sql`LOWER(${funds.recipientRelation}) = 'self'`,
        // Demo-safety: never send post-handoff engagement emails to demo kid-owners.
        sql`COALESCE(${users.isDemoAccount}, false) = false`,
        isNotNull(users.email),
        sql`${funds.updatedAt} <= ${graceCutoff}`,
      ),
    );

  // Apply the dedup filter in JS Drizzle's null-aware comparison
  // through the query builder gets verbose. Cheap: typical post-
  // launch volume is "a dozen kids per quarter" not thousands.
  return rows
    .filter((r) => !r.lastQuarterlySummaryAt || r.lastQuarterlySummaryAt < dedupCutoff)
    .map((r) => ({
      userId: r.userId,
      email: r.email,
      firstName: r.firstName,
      fundId: r.fundId,
      fundName: r.fundName,
      recipientFirstName: r.recipientFirstName,
      balance: r.balance,
      totalGain: r.totalGain,
      lastQuarterlySummaryAt: r.lastQuarterlySummaryAt,
    }));
}

function quarterLabel(now: Date): string {
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `Q${q} ${now.getUTCFullYear()}`;
}

function formatMoney(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

async function sendQuarterlySummary(c: EngagementCandidate, now: Date, log: LogFn): Promise<boolean> {
  if (!c.email) return false;
  const balance = parseFloat(String(c.balance || "0"));
  const gain = parseFloat(String(c.totalGain || "0"));
  const quarter = quarterLabel(now);
  const name = c.firstName || c.recipientFirstName || "there";

  const subject = `Your fund · ${quarter}`;
  // Plain-text body. emailDelivery uses the platform's template
  // pipeline if available; if not it falls back to text. Keep this
  // calm no exclamation points, no "Congrats!" energy. Matches
  // the locked tone register across Kiddo surfaces.
  const body = [
    `Hi ${name},`,
    "",
    `Quick ${quarter} look at your fund.`,
    "",
    `Current value: ${formatMoney(balance)}`,
    gain !== 0 ? `Total gain since you started: ${gain > 0 ? "+" : ""}${formatMoney(gain)}` : null,
    "",
    "Not doing anything is also a choice. Compounding works while you sleep.",
    "",
    "Open Kiddo: https://kiddofund.com/dashboard",
    "",
    "Kiddo",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { html: brandedHtml } = renderKiddoEmail({
      heading: subject,
      intro: body,
    });
    await sendEmail({
      to: c.email,
      subject,
      text: body,
      html: brandedHtml,
      fundId: c.fundId, // bereavement freeze (BEREAVEMENT_POSTURE.md)
    } as any);
    await db.update(users)
      .set({ lastQuarterlySummaryAt: now })
      .where(eq(users.id, c.userId));
    log(`quarterly summary sent to ${c.email} (fund ${c.fundId})`, WORKER_SOURCE);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`quarterly summary FAILED for ${c.email}: ${message}`, WORKER_SOURCE);
    return false;
  }
}

// Find kid-owners due for the ONE-time 30-day check-in. Same
// owner-of-personal-fund-with-self-relation predicate as the
// quarterly summary; differs on the time window (30-60 days
// post-handoff vs >60) and on the dedup column
// (kidThirtyDayCheckInAt vs lastQuarterlySummaryAt).
type ThirtyDayCandidate = EngagementCandidate & {
  kidThirtyDayCheckInAt: Date | null;
};
async function findThirtyDayCheckInOwners(now: Date): Promise<ThirtyDayCandidate[]> {
  const upperCutoff = new Date(now.getTime() - THIRTY_DAY_MIN * 86400000);
  const lowerCutoff = new Date(now.getTime() - THIRTY_DAY_MAX * 86400000);
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      kidThirtyDayCheckInAt: users.kidThirtyDayCheckInAt,
      lastQuarterlySummaryAt: users.lastQuarterlySummaryAt,
      fundId: funds.id,
      fundName: funds.name,
      recipientFirstName: funds.recipientFirstName,
      balance: funds.balance,
      totalGain: funds.totalGain,
      accountType: funds.accountType,
      recipientRelation: funds.recipientRelation,
      updatedAt: funds.updatedAt,
    })
    .from(funds)
    .innerJoin(users, eq(funds.userId, users.id))
    .where(
      and(
        sql`LOWER(${funds.accountType}) = 'personal'`,
        sql`LOWER(${funds.recipientRelation}) = 'self'`,
        // Demo-safety: never send post-handoff engagement emails to demo kid-owners.
        sql`COALESCE(${users.isDemoAccount}, false) = false`,
        isNotNull(users.email),
        sql`${funds.updatedAt} <= ${upperCutoff}`,
        sql`${funds.updatedAt} >= ${lowerCutoff}`,
      ),
    );
  return rows
    .filter((r) => !r.kidThirtyDayCheckInAt)
    .map((r) => ({
      userId: r.userId,
      email: r.email,
      firstName: r.firstName,
      fundId: r.fundId,
      fundName: r.fundName,
      recipientFirstName: r.recipientFirstName,
      balance: r.balance,
      totalGain: r.totalGain,
      lastQuarterlySummaryAt: r.lastQuarterlySummaryAt,
      kidThirtyDayCheckInAt: r.kidThirtyDayCheckInAt,
    }));
}

// Send the 30-day check-in. Calmer register than the quarterly
// summary — the kid has only owned the fund for a month, so the
// numbers aren't the story. The story is "we're here, you don't
// have to do anything, here's what's still around when you want
// it." Locked tone discipline: no exclamation points, no
// "Congrats!" energy, no marketing close.
async function sendThirtyDayCheckIn(c: ThirtyDayCandidate, now: Date, log: LogFn): Promise<boolean> {
  if (!c.email) return false;
  const balance = parseFloat(String(c.balance || "0"));
  const name = c.firstName || c.recipientFirstName || "there";

  const subject = "One month in";
  const body = [
    `Hi ${name},`,
    "",
    "It's been about a month since this fund became yours.",
    "",
    `Current value: ${formatMoney(balance)}`,
    "",
    "Most months you don't need to do anything. Compounding works whether or not you log in.",
    "",
    "What you can do whenever it's useful:",
    "  - Add a one-time amount if you want.",
    "  - Set up a recurring contribution if you have steady income.",
    "  - Open it just to look. That's allowed too.",
    "",
    "Open Kiddo: https://kiddofund.com/dashboard",
    "",
    "The Kiddo team",
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");

  try {
    const { html: brandedHtml } = renderKiddoEmail({
      heading: subject,
      intro: body,
    });
    await sendEmail({
      to: c.email,
      subject,
      text: body,
      html: brandedHtml,
      fundId: c.fundId, // bereavement freeze (BEREAVEMENT_POSTURE.md)
    } as any);
    await db
      .update(users)
      .set({ kidThirtyDayCheckInAt: now })
      .where(eq(users.id, c.userId));
    log(`30-day check-in sent: ${c.email} (fund ${c.fundId})`, WORKER_SOURCE);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`30-day check-in failed for ${c.email}: ${message}`, WORKER_SOURCE);
    return false;
  }
}

let tickInFlight = false;
async function tickEngagement(log: LogFn): Promise<void> {
  if (tickInFlight) return;
  const now = new Date();
  tickInFlight = true;
  try {
    // 30-day check-in runs daily, not gated on the quarterly window.
    // Window check is inside the candidate finder (30-60 day band).
    const thirtyDayCandidates = await findThirtyDayCheckInOwners(now);
    if (thirtyDayCandidates.length > 0) {
      log(`30-day check-in: ${thirtyDayCandidates.length} eligible kid-owner(s)`, WORKER_SOURCE);
      for (const c of thirtyDayCandidates) {
        await sendThirtyDayCheckIn(c, now, log);
      }
    }

    // Quarterly summary gated to the Jan/Apr/Jul/Oct 15-21 window.
    if (isInQuarterlyWindow(now)) {
      const candidates = await findEligibleOwners(now);
      if (candidates.length > 0) {
        log(`quarterly window open; ${candidates.length} eligible kid-owner(s)`, WORKER_SOURCE);
        for (const c of candidates) {
          await sendQuarterlySummary(c, now, log);
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`engagement tick failed: ${message}`, WORKER_SOURCE);
  } finally {
    tickInFlight = false;
  }
}

export function startPostHandoffEngagementWorker(log: LogFn = () => undefined): void {
  if (process.env.ENABLE_POST_HANDOFF_ENGAGEMENT !== "1") {
    log("post-handoff engagement worker disabled (set ENABLE_POST_HANDOFF_ENGAGEMENT=1 to enable)", WORKER_SOURCE);
    return;
  }
  // Daily tick. The window check inside keeps the actual send work
  // gated to ~12 days/year (4 quarters × 3-day windows).
  const intervalMs = 24 * 60 * 60 * 1000;
  void tickEngagement(log);
  const interval = setInterval(() => {
    void tickEngagement(log);
  }, intervalMs);
  interval.unref?.();
  log("post-handoff engagement worker started (daily tick, fires on 15th of Jan/Apr/Jul/Oct)", WORKER_SOURCE);
}
