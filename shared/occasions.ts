// Occasion date semantics shared by the dashboard AND the public gift page, so
// the two can never disagree about when an occasion is (the number-honesty
// "one source" rule).
//
// A BIRTHDAY is recurring by nature: one occasion accumulates every year's
// gifts (the canonical occasion is the generic "{child}'s Birthday" — see
// script/seed-dunphys.ts), and its date should always point at the NEXT
// occurrence rather than going stale the day after it passes. The stored
// eventDate is therefore an ANCHOR — only its month/day are meaningful; the
// year is recomputed on read. We never mutate the stored date (that would let a
// round-trip save advance the anchor and drift it forever); we compute the
// effective date at display + gifting-state time.
//
// Keyed on eventType (not a stored flag) because a birthday's recurrence is
// intrinsic. Extend the set if holidays/anniversaries should recur too — those
// carry "one-time fund" ambiguity (e.g. a "Holiday Fund 2026" goal), so they're
// deliberately left out for now.
export const RECURRING_ANNUAL_EVENT_TYPES = new Set<string>(["birthday"]);

export function isRecurringAnnualOccasion(eventType: string | null | undefined): boolean {
  return RECURRING_ANNUAL_EVENT_TYPES.has(String(eventType || "").toLowerCase());
}

type OccasionLike = {
  eventType?: string | null;
  eventDate?: Date | string | null;
};

/**
 * The effective date of an occasion for display + gifting-state.
 *   - recurring annual (birthday): the next occurrence of the anchor's
 *     month/day at or after `from`, anchored at noon UTC (matching how
 *     occasions are stored). Reads as "today" for the whole birthday and only
 *     rolls to next year once the day has fully passed (date-level compare, so
 *     it never flips mid-day on a timezone boundary).
 *   - everything else: the raw stored date.
 * Returns null when there is no usable date.
 */
export function effectiveOccasionDate(
  event: OccasionLike | null | undefined,
  from: Date = new Date(),
): Date | null {
  const raw = event?.eventDate != null ? new Date(event.eventDate as any) : null;
  if (!raw || Number.isNaN(raw.getTime())) return null;
  if (!isRecurringAnnualOccasion(event?.eventType)) return raw;

  const month = raw.getUTCMonth();
  const day = raw.getUTCDate();
  const year = from.getUTCFullYear();
  let next = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));

  // Roll to next year only once today's date is strictly past the occurrence's
  // date (compare day-resolution, not timestamps, so the birthday shows all day).
  const todayUTC = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const nextUTC = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
  if (nextUTC < todayUTC) next = new Date(Date.UTC(year + 1, month, day, 12, 0, 0, 0));
  return next;
}

/** Effective date as epoch ms, or NaN when there is no usable date. */
export function effectiveOccasionDateMs(
  event: OccasionLike | null | undefined,
  from: Date = new Date(),
): number {
  const d = effectiveOccasionDate(event, from);
  return d ? d.getTime() : Number.NaN;
}
