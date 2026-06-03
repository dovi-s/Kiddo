// Fund-value projection for the native app.
//
// MIRRORS shared/projection.ts (projectFundValue) — the locked canonical math:
//   1. 7% historical annual return, compounded monthly (effective conversion).
//   2. 0.10% AUM fee netted out of the assumed return.
//   3. Two-phase model: contributions accrue during the contribution window,
//      then pure compound to the horizon.
//   4. Contribution window bounded by majority age (no hardcoded 18 in the math).
// Kept in sync with shared/projection.ts; @shared isn't aliased into the mobile
// bundle, so this is a controlled mirror (same precedent as the duplicated AUM
// constant in that file). If you change the math there, change it here.

export const PROJECTION_AUM_FEE_RATE = 0.001;
export const PROJECTION_DEFAULT_ANNUAL_RATE = 0.07;

export function projectFundValue(input: {
  startingValue: number;
  monthlyContribution: number;
  yearsAhead: number;
  contributionYears?: number;
  annualReturnRate?: number;
  netAumFee?: boolean;
}): number {
  const {
    startingValue,
    monthlyContribution,
    yearsAhead,
    contributionYears,
    annualReturnRate = PROJECTION_DEFAULT_ANNUAL_RATE,
    netAumFee = true,
  } = input;

  const safeStart = Number.isFinite(startingValue) && startingValue > 0 ? startingValue : 0;
  const safeMonthly = Number.isFinite(monthlyContribution) && monthlyContribution > 0 ? monthlyContribution : 0;
  if (!Number.isFinite(yearsAhead) || yearsAhead <= 0) return Math.max(0, Math.round(safeStart));

  const feeRate = netAumFee ? PROJECTION_AUM_FEE_RATE : 0;
  const netAnnualRate = annualReturnRate - feeRate;
  const monthlyRate = netAnnualRate > 0 ? Math.pow(1 + netAnnualRate, 1 / 12) - 1 : 0;
  const totalMonths = Math.round(yearsAhead * 12);
  const cappedContribYears =
    typeof contributionYears === "number" && Number.isFinite(contributionYears)
      ? Math.max(0, Math.min(contributionYears, yearsAhead))
      : yearsAhead;
  const contribMonths = Math.round(cappedContribYears * 12);
  const compoundOnlyMonths = Math.max(0, totalMonths - contribMonths);

  const phase1Lump = safeStart * Math.pow(1 + monthlyRate, contribMonths);
  const phase1Annuity =
    safeMonthly > 0 && monthlyRate > 0
      ? safeMonthly * ((Math.pow(1 + monthlyRate, contribMonths) - 1) / monthlyRate)
      : safeMonthly * contribMonths;
  const valueAtPhase1End = phase1Lump + phase1Annuity;
  return Math.max(0, Math.round(valueAtPhase1End * Math.pow(1 + monthlyRate, compoundOnlyMonths)));
}

/** Current age in (fractional) years from a birthdate, or null. Accepts a bare
 *  "YYYY-MM-DD" (anchored noon UTC) or a full ISO timestamp. */
export function ageFromBirthdate(birthdate?: string | null): number | null {
  if (!birthdate) return null;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? `${birthdate}T12:00:00.000Z` : birthdate;
  const b = new Date(s);
  if (Number.isNaN(b.getTime())) return null;
  return (Date.now() - b.getTime()) / (365.25 * 86_400_000);
}
