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

  console.log("Monetization tests passed.");
}

main();
