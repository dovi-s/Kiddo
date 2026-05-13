// Pure decision functions for the age-18 transition lifecycle.
// Extracted from server/age18TransitionWorker.ts so the branching logic
// can be unit-tested without spinning up the full worker / DB / email
// infrastructure.
//
// Why "pure" matters: these functions decide what email to send the
// parent on the kid's 18th birthday. A bug here means a kid silently
// gets nothing on the most consequential day in the product. Worth
// having tests at the seam, not just trusting the worker integration.

export type TodayParentVariant = "configured" | "unverified" | "missing";

export type TodayParentVariantInput = {
  childEmail: string | null;
  isVerified: boolean;
};

/**
 * Decide which parent-email variant the worker should send on T-0
 * (the kid's actual majority birthday).
 *
 *   "configured" → child email is on file AND verified. Kid invite
 *                  already auto-sent; parent gets the "today's the
 *                  day" confirmation.
 *   "unverified" → child email on file but parent never had the kid
 *                  click the verification link. We did NOT auto-send
 *                  the kid invite (could be a typo). Parent needs to
 *                  confirm and re-send manually.
 *   "missing"    → no child email at all. Parent must add it, then
 *                  re-trigger.
 *
 * The order matters: missing email beats unverified (can't be
 * unverified without an email), and verified status only applies
 * when an email exists.
 */
export function decideTodayParentVariant(
  input: TodayParentVariantInput,
): TodayParentVariant {
  if (!input.childEmail) return "missing";
  if (!input.isVerified) return "unverified";
  return "configured";
}

/**
 * Should the worker auto-generate an invite token and email the kid
 * the claim link automatically on T-0? Only when:
 *   1. Child email is on file
 *   2. AND email is verified
 *   3. AND no invite token already exists (parent didn't manually
 *      trigger earlier; the manual flow at /api/funds/:id/age-transition/
 *      invite-link bypasses the verification gate, but if it ran the
 *      kid already got the email — don't double-send).
 */
export function shouldAutoSendKidInvite(input: {
  childEmail: string | null;
  isVerified: boolean;
  hasExistingInviteToken: boolean;
}): boolean {
  if (!input.childEmail) return false;
  if (!input.isVerified) return false;
  if (input.hasExistingInviteToken) return false;
  return true;
}

/**
 * Compute milestone eligibility for the at-18 transition flow.
 *
 *   previewEligible → during the year before majority. The age-17
 *                     preview link unlocks here (read-only Memory Book
 *                     preview for the kid).
 *   inviteEligible  → on or after the majority date. The actual claim
 *                     invite link can be created here.
 *
 * `majorityAge` defaults to 18; clamped to [18, 25] (state UTMA range).
 * Returns null eighteenthBirthday when the input is missing or invalid.
 */
export function getAgeMilestoneState(
  birthdate: Date | string | null | undefined,
  majorityAge: number = 18,
): { previewEligible: boolean; inviteEligible: boolean; eighteenthBirthday: Date | null } {
  if (!birthdate) return { previewEligible: false, inviteEligible: false, eighteenthBirthday: null };
  const birthDate = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (Number.isNaN(birthDate.getTime())) {
    return { previewEligible: false, inviteEligible: false, eighteenthBirthday: null };
  }
  const safeAge = Number.isFinite(majorityAge) && majorityAge >= 18 && majorityAge <= 25
    ? Math.floor(majorityAge)
    : 18;
  const now = Date.now();
  const previewWindow = new Date(birthDate);
  previewWindow.setUTCFullYear(previewWindow.getUTCFullYear() + (safeAge - 1));
  const majorityDate = new Date(birthDate);
  majorityDate.setUTCFullYear(majorityDate.getUTCFullYear() + safeAge);
  return {
    previewEligible: now >= previewWindow.getTime() && now < majorityDate.getTime(),
    inviteEligible: now >= majorityDate.getTime(),
    eighteenthBirthday: majorityDate,
  };
}

/**
 * Compute the recipient's year-of-life for a given gift date.
 *
 * Year 1 = birth → first birthday (inclusive of birth, EXCLUSIVE of 1st bday)
 * Year 2 = first birthday → second birthday
 * Year N = (N-1)th → Nth birthday
 *
 * Calendar-based math (year-month-day comparison) is load-bearing: a
 * naive `diffMs / 365.25 days` formula returns year 1 on the kid's
 * EXACT first birthday because not every year has 365.25 days (a
 * non-leap year has 365, so the ratio rounds down by epsilon). The
 * tests at script/test-age18-decisions.ts catch this — keep the
 * calendar-based form.
 *
 * Used by the year-by-year retrospective at /your-story to bucket gifts
 * + memory entries into a scrollable timeline. Returns null when the
 * gift predates the birthday (defensive — shouldn't happen, but a
 * gift with a corrupt timestamp shouldn't crash the timeline).
 *
 * `yearCap` is the upper bound — typically `currentAge + 1` so we
 * don't render future year cards. Passed in instead of computed here
 * so the caller controls the clamp.
 */
export function yearOfLifeForDate(
  giftDate: Date,
  birthDate: Date,
  yearCap: number,
): number | null {
  if (Number.isNaN(giftDate.getTime()) || Number.isNaN(birthDate.getTime())) {
    return null;
  }
  if (giftDate.getTime() < birthDate.getTime()) return null;
  // Calendar-based age: completed years between birthDate and giftDate.
  // Subtract 1 if the gift's month/day is before the birthday in the
  // current year (kid hasn't had their birthday yet that year).
  let age = giftDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = giftDate.getUTCMonth() - birthDate.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && giftDate.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  // year-of-life = completed-years + 1 (year 1 = before 1st birthday)
  const yol = age + 1;
  return Math.min(yearCap, Math.max(1, yol));
}
