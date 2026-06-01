import type {
  GifterLoopAttributionEvent,
  ProjectionSnapshot,
  StockChoice,
} from "@kora/types";

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "fund";
}

export function futureValue(amount: number, years: number, rate: number) {
  return rate === 0 ? amount * years : amount * ((Math.pow(1 + rate, years) - 1) / rate);
}

export const onboardingRates = {
  savings: 0.005,
  investing: 0.07,
  // 0.10% AUM annual fee. Netted from the investing rate inside
  // getProjectionSnapshot so the "Kiddo estimate" number matches
  // what the parent actually keeps. Locked rule across every
  // projection surface per the 2026-05-15 projection-math audit.
  // Savings comparison is NEVER netted — it represents an external
  // savings account that doesn't have our fee.
  kiddoAumFee: 0.001,
} as const;

export const onboardingAnnualGiftOptions = [250, 500, 1000, 2000] as const;

// Onboarding + mobile stock-preference list. Was a 10-item subset that, oddly,
// showed FEWER brands than the public gift page (17). Brought to parity with the
// canonical universe in shared/stock-picks.ts so onboarding, the gift page, the
// parent picker, and mobile all offer the same set. KEEP IN SYNC with
// shared/stock-picks.ts (this package can't import it without a build cycle;
// when they drift, shared/stock-picks.ts is the source of truth).
export const onboardingStockChoices: StockChoice[] = [
  { ticker: "DIS", name: "Disney" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "NKE", name: "Nike" },
  { ticker: "SBUX", name: "Starbucks" },
  { ticker: "NFLX", name: "Netflix" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "GOOGL", name: "Google" },
  { ticker: "SPOT", name: "Spotify" },
  { ticker: "RBLX", name: "Roblox" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "NTDOY", name: "Nintendo" },
  { ticker: "DUOL", name: "Duolingo" },
  { ticker: "DPZ", name: "Domino's" },
  { ticker: "CHWY", name: "Chewy" },
  { ticker: "ABNB", name: "Airbnb" },
  { ticker: "ADBE", name: "Adobe" },
  { ticker: "TGT", name: "Target" },
  { ticker: "CMCSA", name: "Comcast" },
];

export const gifterLoopMetricsTargets = {
  receiptEmailOpenRate: "45-55%",
  receiptEmailSignupRate: "5-8%",
  gifterAccountCreationRate: "20-30% of opted-in gifters",
  gifterToParentConversionRate: "15-25%",
  age18ConversionRate: "15-25%",
} as const;

export const gifterLoopTouchpoints = [
  "gift_success_cta",
  "gift_receipt_email",
  "milestone_email",
  "birthday_reminder_email",
  "memory_book_share_email",
  "age_18_email",
  "gifter_dashboard_cta",
] as const;

export function buildGifterLoopEvent(event: GifterLoopAttributionEvent): GifterLoopAttributionEvent {
  return {
    ...event,
    candidateParentEmail: event.candidateParentEmail?.trim().toLowerCase() || null,
    metadata: event.metadata || {},
  };
}

export function yearsTo18(birthdate: string) {
  if (!birthdate) return 15;
  const d = new Date(`${birthdate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return 15;
  const eighteen = new Date(d);
  eighteen.setUTCFullYear(eighteen.getUTCFullYear() + 18);
  return Math.max(1, Math.ceil((eighteen.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25)));
}

export function childDobError(birthdate: string) {
  if (!birthdate) return "";
  const d = new Date(`${birthdate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "Enter a valid date of birth.";
  const eighteen = new Date(d);
  eighteen.setUTCFullYear(eighteen.getUTCFullYear() + 18);
  return eighteen.getTime() <= Date.now()
    ? "UTMA custodial accounts are only for children under 18 when the fund is created."
    : "";
}

export function getProjectionSnapshot(annualGift: number, years: number): ProjectionSnapshot {
  const savings = Math.round(futureValue(annualGift, years, onboardingRates.savings));
  // Net the 0.10% AUM fee from the investing rate so the displayed
  // "Kiddo estimate" matches what the parent actually keeps. Without
  // this net, the projection step displayed a gross-of-fee number
  // (~$67,998 on $2,000/yr × 18yr at 7%) while the milestone-page
  // projection used the corrected net number (~$67,438). Internal
  // inconsistency fixed 2026-05-15 — both surfaces now use net.
  const netInvestingRate = onboardingRates.investing - onboardingRates.kiddoAumFee;
  const invested = Math.round(futureValue(annualGift, years, netInvestingRate));

  return {
    annualGift,
    years,
    savings,
    invested,
    difference: invested - savings,
  };
}

export function formatCurrencyWhole(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}


/**
 * Project a contribution series year by year. Returns an array of
 * {age, totalGifted, projectedValue} points suitable for charting.
 *
 * Updated 2026-05-15 (projection-math audit): added optional
 * `aumFeeRate` parameter that nets a fee out of the assumed return
 * before compounding. Kiddo's parent-facing charts pass 0.001 (the
 * 0.10% AUM fee) so the chart matches what the parent actually
 * keeps. Non-Kiddo comparisons (savings-account scenarios in
 * GetStarted) pass 0 to leave the rate untouched.
 *
 * Math: annual compounding (one tick per age year). Within the
 * contribution window (age <= contributionEndAge), the annualGift
 * is added at the start of each year and then the year's growth
 * applies. Past the contribution window, the annual growth keeps
 * compounding but no more gifts accrue — matching the UTMA
 * reality where parent contributions stop at majority age.
 */
export function projectContributionSeries(
  annualGift: number,
  endAge: number,
  rate: number,
  contributionEndAge = 18,
  aumFeeRate = 0,
) {
  const safeEndAge = Math.max(1, Math.round(endAge));
  const safeContributionEndAge = Math.max(1, Math.round(contributionEndAge));
  const netRate = rate - aumFeeRate;
  const points: Array<{
    age: number;
    totalGifted: number;
    projectedValue: number;
  }> = [];

  let totalGifted = 0;
  let projectedValue = 0;

  for (let age = 1; age <= safeEndAge; age += 1) {
    projectedValue = projectedValue * (1 + netRate);
    if (age <= safeContributionEndAge) {
      totalGifted += annualGift;
      projectedValue += annualGift;
    }
    points.push({
      age,
      totalGifted: Math.round(totalGifted),
      projectedValue: Math.round(projectedValue),
    });
  }

  return points;
}
