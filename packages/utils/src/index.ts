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
} as const;

export const onboardingAnnualGiftOptions = [250, 500, 1000, 2000] as const;

export const onboardingStockChoices: StockChoice[] = [
  { ticker: "DIS", name: "Disney" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "NKE", name: "Nike" },
  { ticker: "SBUX", name: "Starbucks" },
  { ticker: "NFLX", name: "Netflix" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "GOOGL", name: "Google" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "SPOT", name: "Spotify" },
  { ticker: "RBLX", name: "Roblox" },
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
  const invested = Math.round(futureValue(annualGift, years, onboardingRates.investing));

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


export function projectContributionSeries(
  annualGift: number,
  endAge: number,
  rate: number,
  contributionEndAge = 18,
) {
  const safeEndAge = Math.max(1, Math.round(endAge));
  const safeContributionEndAge = Math.max(1, Math.round(contributionEndAge));
  const points: Array<{
    age: number;
    totalGifted: number;
    projectedValue: number;
  }> = [];

  let totalGifted = 0;
  let projectedValue = 0;

  for (let age = 1; age <= safeEndAge; age += 1) {
    projectedValue = projectedValue * (1 + rate);
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
