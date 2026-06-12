import assert from "node:assert/strict";
import {
  calculateKoraContributionFee,
  calculatePaymentProcessingFee,
  estimateGiftCheckoutCharge,
  estimateAnnualAumFee,
  getGiftAddOn,
  getHighestEffectivePlan,
  getKiddoOccasionTier,
  hasEntitlementAtLeast,
  hasEntitlementFromStatus,
  resolveEffectiveAnnualFee,
  KIDDO_LEGACY_INCLUDED_OCCASION_CREDITS,
  KIDDO_LEGACY_YEARLY,
} from "@shared/monetization";

function main() {
  const normalFreeGift = calculateKoraContributionFee(50, "free");
  assert.equal(normalFreeGift.total, 0);
  assert.equal(normalFreeGift.largeGiftComponent, 0);

  const largeFreeGift = calculateKoraContributionFee(10_000, "free");
  assert.equal(largeFreeGift.total, 0);
  assert.equal(largeFreeGift.largeGiftComponent, 0);

  const largeLegacyGift = calculateKoraContributionFee(10_000, "legacy");
  assert.equal(largeLegacyGift.total, 0);
  assert.equal(largeLegacyGift.largeGiftComponent, 0);
  assert.equal(KIDDO_LEGACY_YEARLY, 129);
  assert.equal(KIDDO_LEGACY_INCLUDED_OCCASION_CREDITS, 2);

  assert.equal(estimateAnnualAumFee(1_000), 1);
  assert.equal(estimateAnnualAumFee(10_000), 10);
  assert.equal(estimateAnnualAumFee(50_000), 50);

  assert.equal(getGiftAddOn("special").price, 1.99);
  assert.equal(getGiftAddOn("rich").price, 3.99);
  assert.equal(getGiftAddOn("keepsake").price, 6.99);
  assert.equal(getGiftAddOn("unknown").price, 0);

  const giftAmount = 50;
  const processingFee = 1.75;
  const keepsake = getGiftAddOn("keepsake");
  const netToFund = giftAmount;
  const totalCharge = giftAmount + processingFee + keepsake.price;
  assert.equal(netToFund, 50);
  assert.equal(totalCharge, 58.74);

  assert.equal(calculatePaymentProcessingFee(50, "card"), 1.75);
  assert.equal(calculatePaymentProcessingFee(50, "apple_pay"), 1.75);
  assert.equal(calculatePaymentProcessingFee(50, "cashapp"), 1.75);
  assert.equal(calculatePaymentProcessingFee(50, "bank"), 0.4);
  assert.equal(calculatePaymentProcessingFee(1000, "bank"), 5);

  const oneTimeBankEstimate = estimateGiftCheckoutCharge(50, "bank");
  assert.equal(oneTimeBankEstimate.processingFee, 0.4);
  assert.equal(oneTimeBankEstimate.totalCharge, 50.4);
  assert.equal(oneTimeBankEstimate.netToFund, 50);

  assert.equal(getKiddoOccasionTier("basic").price, 7.99);
  assert.equal(getKiddoOccasionTier("premium").price, 14.99);
  assert.equal(getKiddoOccasionTier("deluxe").price, 24.99);

  assert.equal(getHighestEffectivePlan(["free", "starter", "legacy", "family"]), "legacy");
  assert.equal(getHighestEffectivePlan(["trial", "free"]), "trial");
  assert.equal(hasEntitlementAtLeast("legacy", "family"), true);
  assert.equal(hasEntitlementAtLeast("legacy", "starter"), true);
  assert.equal(hasEntitlementAtLeast("family", "legacy"), false);
  assert.equal(hasEntitlementAtLeast("free", "starter"), false);

  // hasEntitlementFromStatus matrix. Locks the entitlement predicate, especially
  // the deliberate "trialing is entitled" rule the seamless Family->Kiddo+
  // downgrade relies on (regression guard so a future edit can't quietly revert it
  // and reopen the coverage seam).
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(hasEntitlementFromStatus("active"), true);
  assert.equal(hasEntitlementFromStatus("trialing"), true, "trialing must be entitled (seamless downgrade depends on it)");
  assert.equal(hasEntitlementFromStatus("TRIALING"), true, "status check is case-insensitive");
  assert.equal(hasEntitlementFromStatus("canceled", future), true, "canceled but still in paid period stays entitled");
  assert.equal(hasEntitlementFromStatus("canceled", past), false, "canceled past period end is not entitled");
  assert.equal(hasEntitlementFromStatus("canceled", null), true, "canceled with no known period end stays entitled (no hard cutoff)");
  assert.equal(hasEntitlementFromStatus("past_due"), true, "past_due stays entitled through the Stripe retry/dunning window (no hard cutoff while a failed card is still being retried)");
  assert.equal(hasEntitlementFromStatus("PAST_DUE"), true, "past_due check is case-insensitive");
  assert.equal(hasEntitlementFromStatus("incomplete"), false, "incomplete is not entitled (sub never activated)");
  assert.equal(hasEntitlementFromStatus("unpaid"), false, "unpaid is not entitled (retries exhausted)");
  assert.equal(hasEntitlementFromStatus(null), false);
  assert.equal(hasEntitlementFromStatus(undefined), false);

  // Greater-of "one meter": a fund pays MAX(subscription, AUM), never the sum.
  // Free fund: AUM is the only fee.
  const free10k = resolveEffectiveAnnualFee({ plan: "free", investedAssets: 10000 });
  assert.equal(free10k.annualFee, 10, "free fund pays AUM only");
  assert.equal(free10k.billedAs, "aum");
  // Empty free fund: nothing.
  assert.equal(resolveEffectiveAnnualFee({ plan: "free", investedAssets: 0 }).billedAs, "none");
  // Small paid fund: the subscription is the larger fee (covers the AUM).
  const starterSmall = resolveEffectiveAnnualFee({ plan: "starter", billingInterval: "year", investedAssets: 10000 });
  assert.equal(starterSmall.annualFee, 29, "annual Kiddo+ ($29) covers the $10 AUM on a $10k fund");
  assert.equal(starterSmall.billedAs, "subscription");
  // Large paid fund: the AUM exceeds the subscription and becomes the fee (never both).
  const starterLarge = resolveEffectiveAnnualFee({ plan: "starter", billingInterval: "year", investedAssets: 50000 });
  assert.equal(starterLarge.annualFee, 50, "AUM ($50) exceeds annual Kiddo+ ($29) on a $50k fund");
  assert.equal(starterLarge.billedAs, "aum");
  // Monthly billers pay more sub, so the crossover is higher: $40k AUM ($40) < monthly Kiddo+ ($47.88).
  const starterMonthly40k = resolveEffectiveAnnualFee({ plan: "starter", billingInterval: "month", investedAssets: 40000 });
  assert.equal(starterMonthly40k.billedAs, "subscription", "monthly Kiddo+ ($47.88/yr) still covers a $40 AUM");
  // Family crossover near $59k.
  const family80k = resolveEffectiveAnnualFee({ plan: "family", billingInterval: "year", investedAssets: 80000 });
  assert.equal(family80k.annualFee, 80, "AUM ($80) exceeds annual Family ($59) on an $80k fund");
  assert.equal(family80k.billedAs, "aum");

  console.log("Monetization tests passed.");
}

main();
