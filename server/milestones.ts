import { db } from "./db";
import { storage } from "./storage";
import { activities, gifts as giftsTable, funds as fundsTable, memoryEntries } from "@shared/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { MONEY_CROSS_THRESHOLDS, MONEY_CROSS_COPY } from "@shared/milestones";

// ============================================================================
// MILESTONES ENGINE
// ============================================================================
//
// Fires celebratory `milestone_*` activity rows for emotional moments that
// would otherwise be invisible in the audit ledger. The design lens — "Emma
// at 18 looking back" — argues that the parent's audit log is also the
// kid's scrapbook. A row that says `Fund crossed $1,000` reads differently
// at 18 than the silent, mechanical balance update that produced it.
//
// All milestones follow the same shape:
//   - type:        milestone_<kind>           (so client filter buckets it)
//   - title:       celebratory short copy     (Emma at 18 should screenshot it)
//   - description: longer narrative line      (what happened, in human terms)
//   - metadata:    { milestone: <kind>, … }   (server-side dedupe key)
//
// Dedup is enforced by querying for an existing row of the same type whose
// metadata matches the milestone-specific key BEFORE writing. This means
// re-running a hook (webhook retry, idempotent operation, etc.) won't
// double-stamp the same celebration.

// Money-cross thresholds + copy live in shared/milestones.ts so the in-app
// celebration card (MilestoneMoment.tsx) and this server engine never drift.
// Em-dashes were stripped from the copy when it moved to shared (per locked
// rule feedback_no_emdash.md).

// Returning-gifter celebrations only at meaningful counts. 2nd is the
// "they came back" moment; 5th and 10th mark sustained giving. Past 10
// the celebration loses meaning (gifters become regulars, not events).
const RETURNING_GIFTER_THRESHOLDS = [2, 5, 10];

// Community-size milestones — when N different people have given to a
// fund. Captures the "village raising the kid" story.
const UNIQUE_GIFTERS_THRESHOLDS = [5, 10, 25];

const ANNIVERSARY_YEARS = [1, 5, 10, 18];

async function hasMilestone(fundId: string, type: string, key: string): Promise<boolean> {
  // Dedup query: same fundId + same milestone type + matching metadata.key.
  // metadata is text JSON in our schema; LIKE-match against the JSON
  // serialization. Keeps the query simple without needing JSONB ops.
  const rows = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(
      eq(activities.fundId, fundId),
      eq(activities.type, type),
      sql`${activities.metadata}::text LIKE ${`%"${key}"%`}`,
    ))
    .limit(1);
  return rows.length > 0;
}

// Memory Book mirror — every fired milestone also writes a memory_entries
// row of type='milestone' so the celebration shows up alongside gifts in
// the parent's Memory Book and in Emma's at-18 view. The activity row is
// the audit ledger; this row is the love letter. Dedup is by content
// match within the same fund (idempotent: re-running the milestone
// helper after a webhook retry won't double-stamp).
async function writeMilestoneMemoryEntry(
  fundId: string,
  title: string,
  description: string,
): Promise<void> {
  try {
    // Dedup — match content exactly. Same content in the same fund
    // means we already wrote this milestone. Cheap LIKE match keeps
    // schema simple without a milestone-specific dedup column.
    const existing = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.fundId, fundId),
        eq(memoryEntries.type, "milestone"),
        eq(memoryEntries.content, title),
      ))
      .limit(1);
    if (existing.length > 0) return;
    await storage.createMemoryEntry({
      fundId,
      giftId: null,
      type: "milestone",
      content: title,
      // The description carries the warmer narrative line. Stuffing it
      // into authorName would be wrong (authorName is "who wrote this").
      // Leaving authorName null lets the BookPage milestone treatment
      // render "Kiddo" as the system author — same as before this
      // change.
      authorName: null,
      authorPhotoUrl: null,
      photoUrl: null,
      videoUrl: null,
      audioUrl: null,
    } as any);
  } catch (err) {
    // Non-fatal — the activity row already landed, so the milestone is
    // recorded. Memory Book mirror is the celebration surface, not the
    // source of truth.
    console.warn("[milestones] memory_entry mirror write failed:", err);
  }
}

async function fundDisplayName(fundId: string): Promise<string> {
  const [fund] = await db.select().from(fundsTable).where(eq(fundsTable.id, fundId)).limit(1);
  return (fund as any)?.recipientFirstName || (fund as any)?.name || "this fund";
}

// ============================================================================
// MONEY-CROSS MILESTONE
// ============================================================================
// Fires when a fund's TOTAL value (balance + pending + cash) crosses one of
// the threshold values. Pass `prevTotal` and `newTotal` from the calling
// site — the helper figures out which thresholds were crossed and writes
// one row per threshold (rare to cross multiple at once, but possible
// for a single large gift on a fresh fund).
export async function fireMoneyCrossMilestones(
  fundId: string,
  userId: string,
  prevTotal: number,
  newTotal: number,
): Promise<void> {
  if (!Number.isFinite(prevTotal) || !Number.isFinite(newTotal)) return;
  // Round both sides to cents BEFORE comparing thresholds. Fund balances
  // are stored as decimal strings and parseFloat into JS numbers — a
  // sequence of $0.01 gift settles can leave prevTotal at e.g.
  // 99.99999999999 instead of exactly 100. The threshold check would
  // then incorrectly fire $100 because prevTotal (99.9999...) < 100 AND
  // newTotal (100.00000001 after the next gift) >= 100. Cents-rounding
  // matches what the user reads on screen and matches the locked
  // shared/milestones.ts getMilestoneCrossed implementation.
  const prevTotalC = Math.round(prevTotal * 100) / 100;
  const newTotalC = Math.round(newTotal * 100) / 100;
  if (newTotalC <= prevTotalC) return;
  const childName = await fundDisplayName(fundId);
  // Track the highest threshold actually crossed in this update so we can
  // notify gifters about the most-impressive crossing without spamming them
  // with one email per intermediate threshold (e.g., a $50k anonymous gift
  // on a $5k fund crosses $10k, $25k, AND $50k — gifter gets ONE email
  // about $50k, not three).
  let highestCrossed = 0;
  for (const t of MONEY_CROSS_THRESHOLDS) {
    if (prevTotalC < t && newTotalC >= t) {
      const key = `t:${t}`;
      if (await hasMilestone(fundId, "milestone_money_cross", key)) continue;
      const copy = MONEY_CROSS_COPY[t];
      try {
        await storage.createActivity({
          userId,
          fundId,
          type: "milestone_money_cross",
          title: copy.title,
          description: copy.description(childName),
          metadata: JSON.stringify({ milestone: "money_cross", threshold: t, key }),
        } as any);
        await writeMilestoneMemoryEntry(fundId, copy.title, copy.description(childName));
        if (t > highestCrossed) highestCrossed = t;
      } catch (err) {
        console.warn("[milestones] money_cross write failed:", err);
      }
    }
  }
  // Gifter-community email — fire ONCE per money-cross event (not per
  // threshold). Lazy-imported to avoid a circular dependency between this
  // module and gifterNotificationWorker (the worker imports MONEY_CROSS_COPY
  // from shared/milestones.ts; importing the worker eagerly here would load
  // its database-querying surface during milestone module init).
  if (highestCrossed > 0) {
    try {
      const { enqueueGifterMilestoneNotifications } = await import("./gifterNotificationWorker");
      await enqueueGifterMilestoneNotifications(fundId, highestCrossed);
    } catch (err) {
      console.warn("[milestones] gifter milestone enqueue failed:", err);
    }
  }
}

// ============================================================================
// RETURNING GIFTER MILESTONE
// ============================================================================
// Fires after a settled gift if this senderEmail has now given the 2nd /
// 5th / 10th time to this fund. Skips parent's own gifts.
export async function fireReturningGifterMilestone(
  fundId: string,
  userId: string,
  senderEmail: string,
  senderName: string | null,
): Promise<void> {
  if (!senderEmail) return;
  const normalized = senderEmail.trim().toLowerCase();
  if (!normalized) return;
  // Skip parent's own gifts — those count as "Yours" contributions, not
  // a returning gifter moment.
  const [fund] = await db.select().from(fundsTable).where(eq(fundsTable.id, fundId)).limit(1);
  if (!fund) return;
  // Find the parent's email to compare against.
  if ((fund as any).userId) {
    const [parentRow] = await db.execute(sql`SELECT email FROM users WHERE id = ${String((fund as any).userId)}`) as any;
    const parentEmail = parentRow && parentRow.rows ? String(parentRow.rows[0]?.email || "").trim().toLowerCase()
      : String((parentRow as any)?.email || "").trim().toLowerCase();
    if (parentEmail && parentEmail === normalized) return;
  }
  // Count this gifter's settled gifts to this fund.
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM gifts
    WHERE fund_id = ${fundId}
      AND LOWER(sender_email) = ${normalized}
      AND status IN ('invested', 'settled')
  `);
  const count = Number((result as any).rows?.[0]?.n ?? 0);
  if (!RETURNING_GIFTER_THRESHOLDS.includes(count)) return;
  const key = `${normalized}:${count}`;
  if (await hasMilestone(fundId, "milestone_returning_gifter", key)) return;
  const childName = await fundDisplayName(fundId);
  const display = (senderName && senderName.trim()) || senderEmail;
  const ordinal = count === 2 ? "2nd" : count === 5 ? "5th" : count === 10 ? "10th" : `${count}th`;
  try {
    const title = `${display}'s ${ordinal} gift`;
    const description = count === 2
      ? `${display} gave again. The first time someone returns is when you know ${childName}'s fund has a community.`
      : `${display} has now given ${count} times to ${childName}. Sustained love.`;
    await storage.createActivity({
      userId,
      fundId,
      type: "milestone_returning_gifter",
      title,
      description,
      metadata: JSON.stringify({ milestone: "returning_gifter", senderEmail: normalized, count, key }),
    } as any);
    await writeMilestoneMemoryEntry(fundId, title, description);
  } catch (err) {
    console.warn("[milestones] returning_gifter write failed:", err);
  }
}

// ============================================================================
// UNIQUE-GIFTERS COMMUNITY MILESTONE
// ============================================================================
// Fires when the fund's distinct-external-gifter count crosses 5, 10, or
// 25. Anonymous gifts each count as one distinct human (matches Memory
// Book's "Anonymous as distinct human" rule).
export async function fireUniqueGiftersMilestone(
  fundId: string,
  userId: string,
): Promise<void> {
  // Count distinct contributor identities. Named senders dedupe by lowercase
  // email; anonymous (no email) gifts each count as one (one row per gift).
  const result = await db.execute(sql`
    WITH named AS (
      SELECT LOWER(sender_email) AS k
      FROM gifts
      WHERE fund_id = ${fundId}
        AND status IN ('invested', 'settled')
        AND sender_email IS NOT NULL AND sender_email <> ''
      GROUP BY LOWER(sender_email)
    ),
    anon AS (
      SELECT id::text AS k
      FROM gifts
      WHERE fund_id = ${fundId}
        AND status IN ('invested', 'settled')
        AND (sender_email IS NULL OR sender_email = '')
    )
    SELECT (SELECT COUNT(*) FROM named) + (SELECT COUNT(*) FROM anon) AS total
  `);
  const count = Number((result as any).rows?.[0]?.total ?? 0);
  if (!UNIQUE_GIFTERS_THRESHOLDS.includes(count)) return;
  const key = `n:${count}`;
  if (await hasMilestone(fundId, "milestone_unique_gifters", key)) return;
  const childName = await fundDisplayName(fundId);
  try {
    const title = `${count} people have given`;
    const description = `${count} different people have given to ${childName}. A village.`;
    await storage.createActivity({
      userId,
      fundId,
      type: "milestone_unique_gifters",
      title,
      description,
      metadata: JSON.stringify({ milestone: "unique_gifters", count, key }),
    } as any);
    await writeMilestoneMemoryEntry(fundId, title, description);
  } catch (err) {
    console.warn("[milestones] unique_gifters write failed:", err);
  }
}

// ============================================================================
// ANNIVERSARY MILESTONE
// ============================================================================
// Fires once per year on the fund's createdAt anniversary, for years 1, 5,
// 10, and 18. Called from a daily worker — checking once per day suffices
// since anniversaries are calendar-day events, not real-time.
export async function fireAnniversaryMilestone(
  fundId: string,
  userId: string,
  fundCreatedAt: Date,
): Promise<void> {
  const now = new Date();
  const created = new Date(fundCreatedAt);
  // Fire if today is within ±1 day of the anniversary date (UTC).
  // Widened from exact-day match on 2026-05-15 (timing-audit follow-
  // up): the daily worker runs every 30 minutes but a longer outage
  // spanning the anniversary day would miss the year entirely. With
  // hasMilestone(y:N) dedup below, a ±1-day window can't fire the
  // same anniversary twice — the dedup column ensures one-per-year.
  // The fund created on Feb 15 fires Feb 14, 15, or 16, whichever
  // tick the worker first lands on; subsequent ticks within the
  // window skip via dedup.
  //
  // Anniversary years calculation uses TODAY's year - createdAt's
  // year. That stays accurate at the ±1 boundaries: a fund created
  // 2025-02-15 fires "Year 1" anniversary on 2026-02-14, 2026-02-15,
  // OR 2026-02-16 — all three resolve `years = 2026 - 2025 = 1`.
  // Edge case: fund created on Dec 31 fires "Year 1" anniversary on
  // Dec 30, 31, or Jan 1 of next year. On Jan 1, `years` would
  // resolve to 2 (different calendar year) — handled by checking
  // the date proximity first, then computing years against the
  // anniversary date specifically rather than the current date.
  const anniversaryThisYear = new Date(Date.UTC(now.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate()));
  const dayMs = 24 * 60 * 60 * 1000;
  const distanceMs = Math.abs(now.getTime() - anniversaryThisYear.getTime());
  // Also check next year's anniversary in case "today" is in the
  // ±1 window of a Dec/Jan boundary creation date.
  const anniversaryNextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, created.getUTCMonth(), created.getUTCDate()));
  const distanceMsNext = Math.abs(now.getTime() - anniversaryNextYear.getTime());
  const closestAnniversary = distanceMsNext < distanceMs ? anniversaryNextYear : anniversaryThisYear;
  const closestDistanceMs = Math.min(distanceMs, distanceMsNext);
  if (closestDistanceMs > dayMs) return;
  const years = closestAnniversary.getUTCFullYear() - created.getUTCFullYear();
  if (!ANNIVERSARY_YEARS.includes(years)) return;
  const key = `y:${years}`;
  if (await hasMilestone(fundId, "milestone_anniversary", key)) return;
  const childName = await fundDisplayName(fundId);
  const titleByYears: Record<number, string> = {
    1: `${childName}'s fund · 1 year`,
    5: `${childName}'s fund · 5 years`,
    10: `${childName}'s fund · 10 years`,
    18: `${childName}'s fund · 18 years`,
  };
  const descByYears: Record<number, string> = {
    1:  `One year of building. The compounding has started.`,
    5:  `Five years in. The early gifts have had time to grow.`,
    10: `A decade. Look at what consistent love built.`,
    18: `Eighteen years. The day we always pointed to is here.`,
  };
  try {
    const title = titleByYears[years] || `${childName}'s fund · ${years} years`;
    const description = descByYears[years] || "Another year of building.";
    await storage.createActivity({
      userId,
      fundId,
      type: "milestone_anniversary",
      title,
      description,
      metadata: JSON.stringify({ milestone: "anniversary", years, key }),
    } as any);
    await writeMilestoneMemoryEntry(fundId, title, description);
  } catch (err) {
    console.warn("[milestones] anniversary write failed:", err);
  }
}

// ============================================================================
// FIRST-X MILESTONES (voice note, photo, kid suggestion approved)
// ============================================================================
// Generic helper for "first time X happened" celebrations. Fires once per
// fund per kind. Subsequent instances just write the underlying event row
// without the celebratory milestone.
async function fireFirstMilestone(
  fundId: string,
  userId: string,
  kind: "first_voice" | "first_photo" | "first_kid_pick_approved",
  title: string,
  description: string,
): Promise<void> {
  const type = `milestone_${kind}`;
  const key = `k:${kind}`;
  if (await hasMilestone(fundId, type, key)) return;
  try {
    await storage.createActivity({
      userId,
      fundId,
      type,
      title,
      description,
      metadata: JSON.stringify({ milestone: kind, key }),
    } as any);
    await writeMilestoneMemoryEntry(fundId, title, description);
  } catch (err) {
    console.warn(`[milestones] ${kind} write failed:`, err);
  }
}

export async function fireFirstVoiceMilestone(fundId: string, userId: string): Promise<void> {
  // Voice-first detection: any prior memory entry with audioUrl set means
  // this isn't the first.
  const prior = await db
    .select({ id: memoryEntries.id })
    .from(memoryEntries)
    .where(and(
      eq(memoryEntries.fundId, fundId),
      sql`${memoryEntries.audioUrl} IS NOT NULL AND ${memoryEntries.audioUrl} <> ''`,
    ))
    .limit(2); // Need >= 2 to know this isn't the first; the just-written one counts.
  if (prior.length > 1) return;
  const childName = await fundDisplayName(fundId);
  await fireFirstMilestone(
    fundId, userId, "first_voice",
    "First voice memory",
    `Someone recorded the first voice memory for ${childName}. The richest kind of memory the fund holds.`,
  );
}

export async function fireFirstPhotoMilestone(fundId: string, userId: string): Promise<void> {
  const prior = await db
    .select({ id: memoryEntries.id })
    .from(memoryEntries)
    .where(and(
      eq(memoryEntries.fundId, fundId),
      sql`${memoryEntries.photoUrl} IS NOT NULL AND ${memoryEntries.photoUrl} <> ''`,
    ))
    .limit(2);
  if (prior.length > 1) return;
  const childName = await fundDisplayName(fundId);
  await fireFirstMilestone(
    fundId, userId, "first_photo",
    "First photo memory",
    `${childName}'s Memory Book has its first photo.`,
  );
}

export async function fireFirstKidPickApprovedMilestone(fundId: string, userId: string): Promise<void> {
  // Idempotent gate. Previously fireFirstMilestone's generic dedup key
  // ("k:first_kid_pick_approved") was the only guard — and hasMilestone's
  // LIKE-on-JSON dedup works fine for that, BUT a race condition can fire
  // both branches inside the same transaction window before either
  // hasMilestone sees the other's write. Belt-and-suspenders: also check
  // for any prior milestone_first_kid_pick_approved activity row for this
  // fund regardless of metadata key, so a double-tap on /approve never
  // double-stamps.
  const priorMilestone = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(
      eq(activities.fundId, fundId),
      eq(activities.type, "milestone_first_kid_pick_approved"),
    ))
    .limit(1);
  if (priorMilestone.length > 0) return;
  const childName = await fundDisplayName(fundId);
  await fireFirstMilestone(
    fundId, userId, "first_kid_pick_approved",
    `${childName} picked their first stock`,
    `${childName} suggested a stock and you approved it. The first time the kid took agency in their fund.`,
  );
}
