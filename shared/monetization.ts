export const KORA_FREE_GIFT_FEE = 0;
// Pricing v3 (locked 2026-05-23). Plus drops $4.99→$3.99 ($39→$29
// annual); Family drops $7.99→$6.99 ($69→$59 annual). Per
// project_pricing_v3_pricing_levels.md. This file is the CANONICAL
// source of truth for plan prices — Account.tsx, Settings.tsx,
// EventGateModal, AddFundSheet, ActivateInvesting, Dashboard,
// monetization.ts server, and other surfaces consume from here.
// Marketing copy in Pricing.tsx, Compare.tsx, FAQ.tsx, Legal.tsx,
// Home.tsx, FeatureWallModal.tsx, MemoryMediaPicker.tsx,
// PlusUpgradePromptCard.tsx, CoParentAccessCard.tsx use the values
// directly (hardcoded strings, kept in sync via the pricing-truth
// sweep discipline). When changing prices: update this file first,
// then run the cross-surface sweep per
// project_pricing_truth_must_match_across_surfaces.md.
export const KORA_STARTER_MONTHLY = 3.99;
export const KORA_STARTER_YEARLY = 29;
export const KORA_FAMILY_MONTHLY = 6.99;
export const KORA_FAMILY_YEARLY = 59;
export const KIDDO_LEGACY_YEARLY = 129;
export const KIDDO_LEGACY_INCLUDED_OCCASION_CREDITS = 2;
export const KORA_OCCASION_TOP_UP = 7.99;
export const KORA_EVENT_BOOST = 29; // legacy add-on retained for historical records only
export const KIDDO_REVERSE_TRIAL_DAYS = 14;
export const KORA_FREE_FLAT_FEE_THRESHOLD = 200;
export const KORA_FREE_VARIABLE_RATE = 0;
export const KORA_LARGE_GIFT_THRESHOLD = 1000;
export const KORA_LARGE_GIFT_FLAT_FEE = 0;
export const KORA_LARGE_GIFT_RATE = 0;
export const KIDDO_AUM_FEE_RATE = 0.001;
export const KIDDO_AUM_FEE_BASIS_POINTS = 10;

export const KORA_FAMILY_YEARLY_OPTIONS = [KORA_FAMILY_YEARLY] as const;
export const KORA_DEFAULT_FAMILY_YEARLY = KORA_FAMILY_YEARLY_OPTIONS[0];

export const KIDDO_OCCASION_TIERS = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 7.99,
    summary: "Premium occasion page, digital card, QR code, upgraded Memory Book entry.",
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 14.99,
    summary: "Richer design, montage-style entry, premium timeline placement.",
  },
  deluxe: {
    id: "deluxe",
    name: "Deluxe",
    price: 24.99,
    summary: "Keepsake output, elevated reveal, downloadable and shareable occasion output.",
  },
} as const;

export type KiddoOccasionTierId = keyof typeof KIDDO_OCCASION_TIERS;

export function getKiddoOccasionTier(value: unknown) {
  const id = String(value || "basic").toLowerCase();
  if (id === "premium" || id === "deluxe" || id === "basic") {
    return KIDDO_OCCASION_TIERS[id];
  }
  return KIDDO_OCCASION_TIERS.basic;
}

export const KIDDO_GIFT_ADD_ONS = {
  none: {
    id: "none",
    name: "Standard entry",
    price: 0,
    summary: "Your note and gift land in the Memory Book. Clean, personal, and meaningful.",
  },
  special: {
    id: "special",
    name: "Highlighted entry",
    price: 1.99,
    summary: "A premium digital card, highlighted presentation, and a special marker in the Memory Book.",
  },
  rich: {
    id: "rich",
    name: "Rich entry",
    price: 3.99,
    summary: "Featured placement, an animated reveal when the family opens it, and an elevated Memory Book design.",
  },
  keepsake: {
    id: "keepsake",
    name: "Keepsake entry",
    price: 6.99,
    summary: "Top placement, keepsake-style formatting, and a letter-to-the-future feel Emma will read at 18.",
  },
} as const;

export type GiftAddOnId = keyof typeof KIDDO_GIFT_ADD_ONS;

export function getGiftAddOn(value: unknown) {
  const id = String(value || "none").toLowerCase();
  if (id === "special" || id === "rich" || id === "keepsake") {
    return KIDDO_GIFT_ADD_ONS[id];
  }
  return KIDDO_GIFT_ADD_ONS.none;
}

// Note: there is intentionally no "trial_expired" — an expired trial behaves as
// no-trial and resolves to "uncovered" (getTrialForFund returns null for expired).
// The old "trial_expired" state was unhandled by every consumer and wedged
// held-gift release; don't reintroduce it.
export type FundCoverageState =
  | "uncovered"
  | "covered_starter"
  | "covered_family"
  | "trial_active";

export type RecommendationState =
  | "free"
  | "mixed"
  | "all_starter_covered"
  | "family_recommended";

export type GiftFeePlan = "free" | "starter" | "family" | "legacy" | "trial";

export type EffectivePlan = GiftFeePlan;
export type PaymentMethodPreference = "card" | "apple_pay" | "bank" | "cashapp" | "paypal";

export const EFFECTIVE_PLAN_RANK: Record<EffectivePlan, number> = {
  free: 0,
  trial: 1,
  starter: 2,
  family: 3,
  legacy: 4,
};

export function getHighestEffectivePlan(plans: Array<EffectivePlan | null | undefined>): EffectivePlan {
  return plans.reduce<EffectivePlan>((best, plan) => {
    if (!plan) return best;
    return EFFECTIVE_PLAN_RANK[plan] > EFFECTIVE_PLAN_RANK[best] ? plan : best;
  }, "free");
}

export function hasEntitlementAtLeast(plan: EffectivePlan, required: EffectivePlan): boolean {
  return EFFECTIVE_PLAN_RANK[plan] >= EFFECTIVE_PLAN_RANK[required];
}

// Pure entitlement predicate for a Stripe subscription / fund-membership status.
// Lives in shared (next to hasEntitlementAtLeast) so it is testable without the
// server's DB imports; server/services/monetization.ts re-exports it for existing
// consumers. True when:
//  - "active" — obviously entitled.
//  - "trialing" — a trial provides full access (it just hasn't billed yet). The
//    ONLY flow that creates a Stripe trial is the seamless Family->Kiddo+ downgrade
//    (createCheckoutSession sets no trial anywhere), so treating it as entitled is
//    safe and closes that flow's coverage seam (no window where Family has ended
//    but the deferred Plus trial hasn't flipped to active yet).
//  - "canceled" but currentPeriodEnd is still in the future — catches users who
//    hit cancel mid-period; they keep access until the period actually ends (no
//    hard cutoff, which would be a dark pattern the other way).
//  - "past_due" — a renewal payment failed and Stripe is still RETRYING (smart
//    retries run ~2 weeks, then Stripe moves the sub to canceled/unpaid). Keep
//    access through the dunning window instead of yanking Plus the moment a card
//    hiccups: same "no hard cutoff" stance as canceled above, and it avoids
//    punishing a parent for an expired card while we (and Stripe) are still trying
//    to charge it. A payment_failed nudge already fires (actionItems.ts). Stripe's
//    retry schedule self-bounds this, so no explicit time cap is needed — when
//    retries are exhausted the status becomes canceled/unpaid and access ends.
//    NOTE: "unpaid"/"incomplete"/"incomplete_expired" are NOT entitled (retries
//    exhausted, or the sub never activated).
export function hasEntitlementFromStatus(
  status?: string | null,
  currentPeriodEnd?: Date | string | null,
): boolean {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active" || normalized === "trialing") return true;
  if (normalized === "past_due") return true;
  if (normalized !== "canceled") return false;
  if (!currentPeriodEnd) return true;
  const end = new Date(currentPeriodEnd);
  return !Number.isNaN(end.getTime()) && end.getTime() > Date.now();
}

export type ContributionFeeBreakdown = {
  total: number;
  flatComponent: number;
  variableComponent: number;
  largeGiftComponent: number;
  plan: GiftFeePlan;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateKoraContributionFee(amount: number, plan: GiftFeePlan): ContributionFeeBreakdown {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;

  if (plan === "trial") {
    return { total: 0, flatComponent: 0, variableComponent: 0, largeGiftComponent: 0, plan };
  }

  const largeGiftComponent = 0;

  if (plan === "family" || plan === "starter" || plan === "legacy") {
    return {
      total: largeGiftComponent,
      flatComponent: 0,
      variableComponent: 0,
      largeGiftComponent,
      plan,
    };
  }

  if (safeAmount <= KORA_FREE_FLAT_FEE_THRESHOLD) {
    return {
      total: KORA_FREE_GIFT_FEE + largeGiftComponent,
      flatComponent: KORA_FREE_GIFT_FEE,
      variableComponent: 0,
      largeGiftComponent,
      plan,
    };
  }

  const variableComponent = roundMoney(safeAmount * KORA_FREE_VARIABLE_RATE);
  return {
    total: variableComponent + largeGiftComponent,
    flatComponent: 0,
    variableComponent,
    largeGiftComponent,
    plan,
  };
}

export function calculatePaymentProcessingFee(amount: number, paymentMethod: PaymentMethodPreference = "card"): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (paymentMethod === "bank") {
    // ACH: 0.8%, capped at $5. Cheapest rail.
    return roundMoney(Math.min(5, safeAmount * 0.008));
  }
  if (paymentMethod === "paypal") {
    // PayPal in US via Stripe: 3.49% + $0.49. Slightly above card rates;
    // the demographic gap PayPal covers (older grandparents who refuse to
    // type card numbers) more than justifies the spread.
    return roundMoney(safeAmount * 0.0349 + 0.49);
  }
  // card / apple_pay / cashapp all share the standard 2.9% + $0.30
  // Stripe card-rail pricing.
  return roundMoney(safeAmount * 0.029 + 0.3);
}

export function estimateGiftCheckoutCharge(
  amount: number,
  paymentMethod: PaymentMethodPreference = "card",
  addOnId: GiftAddOnId | null = null,
): {
  amount: number;
  processingFee: number;
  giftAddOnFee: number;
  totalCharge: number;
  netToFund: number;
} {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const processingFee = calculatePaymentProcessingFee(safeAmount, paymentMethod);
  const giftAddOnFee = getGiftAddOn(addOnId).price;
  return {
    amount: safeAmount,
    processingFee,
    giftAddOnFee,
    totalCharge: roundMoney(safeAmount + processingFee + giftAddOnFee),
    netToFund: safeAmount,
  };
}

export function estimateAnnualAumFee(investedAssets: number): number {
  const safeAssets = Number.isFinite(investedAssets) ? Math.max(0, investedAssets) : 0;
  return Math.round(safeAssets * KIDDO_AUM_FEE_RATE * 100) / 100;
}

// Annual-equivalent subscription price for a plan (monthly plans annualized).
export function annualSubscriptionUsd(plan: GiftFeePlan, interval: "month" | "year" = "year"): number {
  switch (plan) {
    case "starter":
      return interval === "month" ? roundMoney(KORA_STARTER_MONTHLY * 12) : KORA_STARTER_YEARLY;
    case "family":
      return interval === "month" ? roundMoney(KORA_FAMILY_MONTHLY * 12) : KORA_FAMILY_YEARLY;
    case "legacy":
      return KIDDO_LEGACY_YEARLY;
    case "free":
    case "trial":
    default:
      return 0;
  }
}

export type EffectiveFeeResult = {
  annualFee: number;
  billedAs: "subscription" | "aum" | "none";
  annualSubscription: number;
  annualAum: number;
};

// Greater-of "one meter" (ONE_METER_FEE_DECISION.md): a fund pays the LARGER of its
// subscription or its AUM fee, NEVER the sum. Free/trial funds have no subscription, so
// the AUM is the only fee; a paying fund's subscription "covers" the AUM until the fund
// grows large enough that 0.10% exceeds the plan, at which point the AUM is the fee.
//
// IMPORTANT: the AUM leg is DISPLAY-ONLY until custody is live (AUM_FEE_COLLECTION_SPEC.md).
// This resolver is the canonical model for that future billing + any "what you pay"
// display. It does NOT itself charge anything, and the collection job must respect this
// (do not accrue AUM on a fund where the subscription is the larger fee — the greater-of
// guard in AUM_FEE_COLLECTION_SPEC.md).
export function resolveEffectiveAnnualFee(opts: {
  plan: GiftFeePlan;
  billingInterval?: "month" | "year";
  investedAssets: number;
}): EffectiveFeeResult {
  const annualAum = estimateAnnualAumFee(opts.investedAssets);
  const annualSubscription = annualSubscriptionUsd(opts.plan, opts.billingInterval || "year");
  if (annualSubscription === 0 && annualAum === 0) {
    return { annualFee: 0, billedAs: "none", annualSubscription, annualAum };
  }
  if (annualAum > annualSubscription) {
    return { annualFee: annualAum, billedAs: "aum", annualSubscription, annualAum };
  }
  return { annualFee: annualSubscription, billedAs: "subscription", annualSubscription, annualAum };
}

export const MONETIZATION_TRIGGER_IDS = {
  contributionLanding: "contribution_landing",
  cumulativeFees: "cumulative_fees",
  fundExpansion: "fund_expansion",
  memoryBookUnlock: "memory_book_unlock",
  eventCustomizationUnlock: "event_customization_unlock",
  reverseTrialStarted: "reverse_trial_started",
  reverseTrialEnding: "reverse_trial_ending",
  reverseTrialExpired: "reverse_trial_expired",
  dormantFund: "dormant_fund",
  milestoneAutoInvestUpsell: "milestone_auto_invest_upsell",
  recurringGifterSetup: "recurring_gifter_setup",
  referralCredit: "referral_credit",
} as const;
