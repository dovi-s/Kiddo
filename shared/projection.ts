// Canonical fund-value projection. ONE function, every surface uses it.
//
// Built 2026-05-15 after an audit found five separate projection
// implementations across the app, each broken in a different way:
//   • GrowthStory.tsx used raw 7% without netting the AUM fee
//   • Claim.tsx used a static 4.6x multiplier (not even matching 7%
//     over 18 years — 1.07^18 ≈ 3.38, so 4.6x implied ~8.9% annual)
//   • KidView.tsx used raw 7% annual loop, hardcoded 18-year horizon
//   • CalculatorAt18.tsx netted the fee but hardcoded majority age 18
//   • Age18.tsx (via packages/utils) didn't net fee, hardcoded 18
// Only Projection.tsx had all four locked rules right. This module
// extracts that math so the same numbers come out of every surface.
//
// The four locked rules (from MEMORY.md):
//   1. 7% historical average annual return, compounded monthly.
//   2. 0.10% AUM annual fee netted out of the assumed return
//      (Acorns and most adult-investor calculators show gross, then
//      disclaim the fee in fine print; we'd rather the headline
//      already be honest).
//   3. Two-phase model. Contributions accumulate during the
//      contribution window (typically until UTMA majority for parent
//      contributions); after that, pure compound takes over.
//   4. State-specific majority age. The fund's majorityAge field
//      (18-21) is what bounds the contribution window — never
//      hardcode 18.
//
// The function below accepts the inputs that vary per callsite and
// applies all four rules consistently.

/**
 * Locked AUM annual fee rate. Mirrors KIDDO_AUM_FEE_RATE in
 * shared/monetization.ts (kept duplicated in this module to keep
 * the projection logic self-contained — both constants are 0.001
 * and a sync drift would be caught by the locked-policy audit).
 */
export const PROJECTION_AUM_FEE_RATE = 0.001;

/**
 * Default annual growth rate (7% historical average for a broad
 * US equity index). The locked figure used by every parent-facing
 * projection. Callers can override for sensitivity bands (5% / 7% /
 * 9%) but the default goes through this constant so a single change
 * propagates everywhere.
 */
export const PROJECTION_DEFAULT_ANNUAL_RATE = 0.07;

export type ProjectFundInput = {
  /**
   * Starting principal. Typically the fund's invested + cash balance.
   * If you only want to project a single new contribution (e.g., a
   * gift), pass the gift amount as startingValue with
   * monthlyContribution = 0.
   */
  startingValue: number;
  /**
   * Monthly contribution amount in dollars (e.g., $50/mo from a
   * recurring schedule). Pass 0 if there's no recurring contribution.
   */
  monthlyContribution: number;
  /**
   * Years from "now" to project forward. Fractional values are fine
   * (we convert to months internally). 0 or negative returns
   * startingValue rounded.
   */
  yearsAhead: number;
  /**
   * Optional cap on contribution years. After this many years, the
   * monthlyContribution stops accruing but the accumulated value
   * keeps compounding to the end of yearsAhead.
   *
   * The CANONICAL use case: UTMA parent contributions stop at the
   * fund's majority age (18-21 depending on state). Pass
   * `yearsUntilMajority` here. For projections where the kid is
   * already past majority and contributions come from themselves
   * (Age18 calculator with hypothetical earned-income contributions),
   * leave undefined or pass yearsAhead — contributions run the
   * whole window.
   */
  contributionYears?: number;
  /**
   * Annual growth rate BEFORE fees. Defaults to
   * PROJECTION_DEFAULT_ANNUAL_RATE (7%). Override for sensitivity
   * bands or alternate scenarios (e.g., 0.04 for an HYSA comparison).
   */
  annualReturnRate?: number;
  /**
   * Whether to net the 0.10% AUM fee out of the assumed return.
   * Defaults to true (the locked policy: net fee from the headline
   * number). Pass false for alternative-investment comparisons where
   * we're showing an external rate that wouldn't have our fee
   * (e.g., a savings account at 4% has its own fee structure, not
   * ours).
   */
  netAumFee?: boolean;
};

/**
 * Project a fund's value forward in time using the two-phase model.
 *
 * Returns a non-negative integer (cents-rounded) dollar value.
 *
 * Math (when contributionYears < yearsAhead):
 *   netAnnualRate = annualRate - feeRate             // feeRate=0 when netAumFee=false
 *   monthlyRate = (1 + netAnnualRate)^(1/12) - 1     // effective conversion
 *   contribMonths = round(contributionYears * 12)
 *   compoundOnlyMonths = round((yearsAhead - contributionYears) * 12)
 *
 *   phase1Lump    = startingValue * (1 + monthlyRate)^contribMonths
 *   phase1Annuity = monthlyContribution > 0 && monthlyRate > 0
 *                   ? monthlyContribution * ((1 + monthlyRate)^contribMonths - 1) / monthlyRate
 *                   : monthlyContribution * contribMonths
 *   valueAtPhase1End = phase1Lump + phase1Annuity
 *
 *   finalValue = valueAtPhase1End * (1 + monthlyRate)^compoundOnlyMonths
 *
 * Edge cases:
 *   • yearsAhead <= 0 → returns rounded startingValue
 *   • monthlyRate == 0 (rate fully consumed by fee) → annuity falls
 *     back to monthlyContribution * contribMonths to avoid
 *     0/0 in the closed-form formula
 *   • contributionYears > yearsAhead → clamped to yearsAhead
 *   • startingValue or monthlyContribution negative → treated as 0
 */
export function projectFundValue(input: ProjectFundInput): number {
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

  if (!Number.isFinite(yearsAhead) || yearsAhead <= 0) {
    return Math.max(0, Math.round(safeStart));
  }

  const feeRate = netAumFee ? PROJECTION_AUM_FEE_RATE : 0;
  const netAnnualRate = annualReturnRate - feeRate;
  // Effective monthly rate from the effective annual rate. Previously
  // this was `netAnnualRate / 12` (the APR-divide-by-12 convention),
  // which produces a HIGHER effective annual yield than the input
  // claims: 7% APR / 12 compounded monthly = 7.229% effective annual.
  // Over the typical 19-year UTMA horizon, that mismatch over-stated
  // projected values by 2.4% (~$560 on Emma's $50/mo example).
  //
  // The page text on /calculator-at-18 and every other surface that
  // shows these numbers says "average annual market returns" or "7%
  // yearly average." A parent reading those words expects the math to
  // apply 7% as the actual annual return, not 7.229%. The locked
  // honest-math discipline argues for the effective conversion:
  //   monthlyRate = (1 + annualRate)^(1/12) - 1
  // which makes (1 + monthlyRate)^12 = exactly (1 + annualRate).
  //
  // This matches the convention already used by projectSavings in
  // client/src/pages/CalculatorAt18.tsx and gives the headline number
  // the same conservative-honest framing as the savings comparison.
  // Fixed 2026-05-21 per a user-flagged math audit on the calculator.
  const monthlyRate = netAnnualRate > 0
    ? Math.pow(1 + netAnnualRate, 1 / 12) - 1
    : 0;
  const totalMonths = Math.round(yearsAhead * 12);
  const cappedContribYears =
    typeof contributionYears === "number" && Number.isFinite(contributionYears)
      ? Math.max(0, Math.min(contributionYears, yearsAhead))
      : yearsAhead;
  const contribMonths = Math.round(cappedContribYears * 12);
  const compoundOnlyMonths = Math.max(0, totalMonths - contribMonths);

  // Phase 1: lump grows for contribMonths, plus annuity of monthly contributions.
  const phase1Lump = safeStart * Math.pow(1 + monthlyRate, contribMonths);
  const phase1Annuity =
    safeMonthly > 0 && monthlyRate > 0
      ? safeMonthly * ((Math.pow(1 + monthlyRate, contribMonths) - 1) / monthlyRate)
      : safeMonthly * contribMonths;
  const valueAtPhase1End = phase1Lump + phase1Annuity;

  // Phase 2: pure compound from end of phase 1 through the rest of the horizon.
  const finalValue = valueAtPhase1End * Math.pow(1 + monthlyRate, compoundOnlyMonths);
  return Math.max(0, Math.round(finalValue));
}

/**
 * Convenience helper: given a child's current age (or birthdate) and
 * the fund's majority age, returns the contribution-window years
 * remaining. Callers pass this as contributionYears to projectFundValue.
 *
 * Returns 0 (not negative) when the kid is at/past majority — there
 * are no more contribution years to project.
 */
export function utmaContributionYearsRemaining(
  currentAgeYears: number,
  majorityAge: number,
): number {
  if (!Number.isFinite(currentAgeYears) || !Number.isFinite(majorityAge)) return 0;
  return Math.max(0, majorityAge - currentAgeYears);
}

/**
 * Convenience helper: years between two dates, decimal precision.
 * Useful when you have the recipient's birthdate string and want
 * yearsAhead to a specific milestone date.
 */
export function yearsBetween(from: Date | string, to: Date | string): number {
  const fromMs = typeof from === "string" ? new Date(from).getTime() : from.getTime();
  const toMs = typeof to === "string" ? new Date(to).getTime() : to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return (toMs - fromMs) / (365.25 * 86_400_000);
}
