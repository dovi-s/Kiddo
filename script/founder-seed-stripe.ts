/* eslint-disable no-console */
// Founder Stripe products — one-off seed. Creates the two founder-locked
// products + their annual prices that the checkout routing in
// server/routes.ts (starter-plan + family-plan) looks up BY NAME when a user
// has founderTier='plus_founder':
//   - "Kiddo+ Founder Annual"        $19/yr  (the headline founder lock)
//   - "Kiddo Family Founder Annual"  $59/yr
//
// Idempotent: skips any product/price that already exists, so it's safe to
// re-run. Run once per Stripe environment (test, then live):
//   npm run founder:seed-stripe
//
// ⚠️ OUTWARD-FACING: this creates REAL products in whatever Stripe account
// STRIPE_SECRET_KEY points at. Re-running is safe (no duplicates).
//
// Per project_founding_member_claim_flow_spec.md (component 4; decisions locked
// 2026-05-26: $19/yr Plus + $59/yr Family, lifetime, annual-only). The webhook
// keys plan off session metadata.type, not the product, so these prices slot
// into the existing Plus/Family subscription flow with no other changes.

import "dotenv/config";
import { getUncachableStripeClient } from "../server/stripeClient";

const FOUNDER_PRODUCTS: Array<{ name: string; unitAmount: number }> = [
  { name: "Kiddo+ Founder Annual", unitAmount: 1900 }, // $19.00 / yr
  { name: "Kiddo Family Founder Annual", unitAmount: 5900 }, // $59.00 / yr
];

async function findProductByName(stripe: any, name: string) {
  // List active products and match by exact name (avoids search-API syntax /
  // eventual-consistency). 100 covers our small catalog comfortably.
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.name === name) return product;
  }
  return null;
}

async function hasAnnualPrice(stripe: any, productId: string, unitAmount: number) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return prices.data.some(
    (p: any) => p.recurring?.interval === "year" && p.unit_amount === unitAmount && p.currency === "usd",
  );
}

async function main() {
  const stripe: any = await getUncachableStripeClient();
  for (const { name, unitAmount } of FOUNDER_PRODUCTS) {
    let product = await findProductByName(stripe, name);
    if (!product) {
      product = await stripe.products.create({ name });
      console.log(`Created product: ${name} (${product.id})`);
    } else {
      console.log(`Product exists: ${name} (${product.id})`);
    }
    if (await hasAnnualPrice(stripe, product.id, unitAmount)) {
      console.log(`  Annual $${(unitAmount / 100).toFixed(2)} price already exists — skipping.`);
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: unitAmount,
        recurring: { interval: "year" },
      });
      console.log(`  Created annual price $${(unitAmount / 100).toFixed(2)} (${price.id}).`);
    }
  }
  console.log("Founder products seeded. Checkout resolves them by name — nothing else to configure.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("founder-seed-stripe failed:", e?.message || e);
    process.exit(1);
  });
