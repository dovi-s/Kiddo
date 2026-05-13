const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365.25 * DAY_MS;
const MONTH_MS = 30.44 * DAY_MS;

// Field names retain the "18" suffix for backwards compatibility — many call
// sites read these fields directly. Internally they refer to the kid's UTMA
// majority age (18 in most states, 19 in AL/NE, 21 in MS/PA/etc.) which
// arrives as the optional `majorityAge` argument to getAge18Transition.
// Treat these names as "majority" and the comments will keep you honest.
export type Age18TransitionInfo = {
  birthDate: Date;
  /** One year before majority (the "preview window opens" date). */
  seventeenthBirthday: Date;
  /** The actual UTMA majority date — 18 in most states, varies by state. */
  eighteenthBirthday: Date;
  ageYears: number;
  /** Days until preview window opens (majority age − 1). */
  daysUntil17: number;
  /** Days until majority. */
  daysUntil18: number;
  monthsUntil18: number;
  yearsUntil18: number;
  /** The age this fund's UTMA transitions at — 18 by default. */
  majorityAge: number;
  countdownLabel: string;
  stage: "far" | "approaching" | "imminent" | "adult";
  previewEligible: boolean;
  inviteEligible: boolean;
  handoffEligible: boolean;
};

function getFullYearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const hasHadBirthday =
    to.getMonth() > from.getMonth() ||
    (to.getMonth() === from.getMonth() && to.getDate() >= from.getDate());
  if (!hasHadBirthday) years -= 1;
  return Math.max(0, years);
}

export function getAge18Transition(
  birthdate: string | Date | null | undefined,
  majorityAge: number = 18,
): Age18TransitionInfo | null {
  if (!birthdate) return null;
  const birthDate = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (Number.isNaN(birthDate.getTime())) return null;
  const safeAge = Number.isFinite(majorityAge) && majorityAge >= 18 && majorityAge <= 25 ? Math.floor(majorityAge) : 18;

  const previewWindow = new Date(birthDate);
  previewWindow.setFullYear(previewWindow.getFullYear() + (safeAge - 1));

  const majorityBirthday = new Date(birthDate);
  majorityBirthday.setFullYear(majorityBirthday.getFullYear() + safeAge);

  const now = new Date();
  const ageYears = getFullYearsBetween(birthDate, now);
  const diffPreviewMs = previewWindow.getTime() - now.getTime();
  const diffMs = majorityBirthday.getTime() - Date.now();
  const daysUntilPreview = Math.max(0, Math.ceil(diffPreviewMs / DAY_MS));
  const daysUntilMajority = Math.max(0, Math.ceil(diffMs / DAY_MS));
  const monthsUntilMajority = Math.max(0, Math.ceil(diffMs / MONTH_MS));
  const yearsUntilMajority = Math.max(0, Math.ceil(diffMs / YEAR_MS));

  let stage: Age18TransitionInfo["stage"] = "far";
  if (diffMs <= 0) {
    stage = "adult";
  } else if (daysUntilMajority <= 365) {
    stage = "imminent";
  } else if (daysUntilMajority <= 730) {
    stage = "approaching";
  }

  let countdownLabel = `Age-${safeAge} milestone reached`;
  if (stage !== "adult") {
    countdownLabel =
      monthsUntilMajority <= 18
        ? `${monthsUntilMajority} month${monthsUntilMajority === 1 ? "" : "s"} until age ${safeAge}`
        : `${yearsUntilMajority} year${yearsUntilMajority === 1 ? "" : "s"} until age ${safeAge}`;
  }

  const previewEligible = diffPreviewMs <= 0 && diffMs > 0;
  const inviteEligible = diffMs <= 0;

  return {
    birthDate,
    seventeenthBirthday: previewWindow,
    eighteenthBirthday: majorityBirthday,
    ageYears,
    daysUntil17: daysUntilPreview,
    daysUntil18: daysUntilMajority,
    monthsUntil18: monthsUntilMajority,
    yearsUntil18: yearsUntilMajority,
    majorityAge: safeAge,
    countdownLabel,
    stage,
    previewEligible,
    inviteEligible,
    handoffEligible: inviteEligible,
  };
}

export function formatAgeTransitionDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
