import "../server/env";
import Stripe from 'stripe';

async function getCredentials() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY not found');
  }
  return secret;
}

async function createProducts() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });

  console.log('Syncing Kiddo products in Stripe...');

  // Search for starter plan under all historical names
  const starterSearches = await Promise.all([
    stripe.products.search({ query: "name:'Kiddo+'" }),
    stripe.products.search({ query: "name:'Starter Plan'" }),
    stripe.products.search({ query: "name:'Kora+'" }),
  ]);
  const existingStarter = starterSearches.find(r => r.data.length > 0)?.data[0];

  // Search for family plan under all historical names
  const familySearches = await Promise.all([
    stripe.products.search({ query: "name:'Kiddo Family'" }),
    stripe.products.search({ query: "name:'Family Plan'" }),
    stripe.products.search({ query: "name:'Kora Family'" }),
  ]);
  const existingFamily = familySearches.find(r => r.data.length > 0)?.data[0];

  const existingBoostSearch = await stripe.products.search({ query: "name:'Event Boost'" });
  const existingPassSearch = await stripe.products.search({ query: "name:'Event Pass'" });

  // ── Kiddo+ (per-fund starter plan) ──────────────────────────────────────
  let starterPlanId: string;
  if (existingStarter) {
    starterPlanId = existingStarter.id;
    console.log('Kiddo+ already exists:', starterPlanId);
    await stripe.products.update(starterPlanId, {
      name: 'Kiddo+',
      description: 'No platform fee on gifts. Up to 3 active event pages. Memory Book and auto-invest included.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', events_per_fund: '3' },
    });
  } else {
    const starterPlan = await stripe.products.create({
      name: 'Kiddo+',
      description: 'No platform fee on gifts. Up to 3 active event pages. Memory Book and auto-invest included.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', events_per_fund: '3' },
    });
    starterPlanId = starterPlan.id;
    console.log('Created Kiddo+ product:', starterPlanId);
  }

  const starterPrices = await stripe.prices.list({ product: starterPlanId, active: true });
  // Pricing v3 (locked 2026-05-23). Plus drops from $4.99/$39 to $3.99/$29
  // and gains an annual SKU (was previously monthly-only). See
  // project_pricing_v3_pricing_levels.md.
  const STARTER_MONTHLY_CENTS = 399; // $3.99
  const STARTER_YEARLY_CENTS = 2900; // $29.00
  const hasStarterMonthly = starterPrices.data.some(p => p.unit_amount === STARTER_MONTHLY_CENTS && p.recurring?.interval === 'month');
  const hasStarterYearly = starterPrices.data.some(p => p.unit_amount === STARTER_YEARLY_CENTS && p.recurring?.interval === 'year');
  let starterPriceId: string;
  if (hasStarterMonthly) {
    starterPriceId = starterPrices.data.find(p => p.unit_amount === STARTER_MONTHLY_CENTS && p.recurring?.interval === 'month')!.id;
    console.log('Kiddo+ monthly price already exists:', starterPriceId);
  } else {
    const starterPlanPrice = await stripe.prices.create({
      product: starterPlanId,
      unit_amount: STARTER_MONTHLY_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { display_name: 'Kiddo+ Monthly (per fund)' },
    });
    starterPriceId = starterPlanPrice.id;
    console.log('Created Kiddo+ monthly price:', starterPriceId);
  }

  let starterYearlyPriceId: string;
  if (hasStarterYearly) {
    starterYearlyPriceId = starterPrices.data.find(p => p.unit_amount === STARTER_YEARLY_CENTS && p.recurring?.interval === 'year')!.id;
    console.log('Kiddo+ yearly price already exists:', starterYearlyPriceId);
  } else {
    const starterPlanYearlyPrice = await stripe.prices.create({
      product: starterPlanId,
      unit_amount: STARTER_YEARLY_CENTS,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { display_name: 'Kiddo+ Annual (per fund)' },
    });
    starterYearlyPriceId = starterPlanYearlyPrice.id;
    console.log('Created Kiddo+ yearly price:', starterYearlyPriceId);
  }

  // Deactivate old starter prices (anything not matching current monthly + yearly)
  const oldStarterPrices = starterPrices.data.filter(p =>
    !(p.unit_amount === STARTER_MONTHLY_CENTS && p.recurring?.interval === 'month') &&
    !(p.unit_amount === STARTER_YEARLY_CENTS  && p.recurring?.interval === 'year')
  );
  for (const oldPrice of oldStarterPrices) {
    await stripe.prices.update(oldPrice.id, { active: false });
    console.log('Deactivated old Kiddo+ price:', oldPrice.id, `($${(oldPrice.unit_amount || 0) / 100}/${oldPrice.recurring?.interval})`);
  }

  // ── Kiddo Family (household plan) ──────────────────────────────────────
  let familyPlanId: string;
  if (existingFamily) {
    familyPlanId = existingFamily.id;
    console.log('Kiddo Family already exists:', familyPlanId);
    await stripe.products.update(familyPlanId, {
      name: 'Kiddo Family',
      description: 'Unlimited funds, unlimited event pages, no platform fee on gifts. One price covers every child you manage.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', unlimited: 'true' },
    });
  } else {
    const familyPlan = await stripe.products.create({
      name: 'Kiddo Family',
      description: 'Unlimited funds, unlimited event pages, no platform fee on gifts. One price covers every child you manage.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', unlimited: 'true' },
    });
    familyPlanId = familyPlan.id;
    console.log('Created Kiddo Family product:', familyPlanId);
  }

  const familyPrices = await stripe.prices.list({ product: familyPlanId, active: true });
  // Pricing v3 (locked 2026-05-23). Family drops from $9.99/$99.99 (the
  // outdated values that were in this seed script) to the locked
  // $6.99/$59. The seed script had drifted from MEMORY canonical
  // pricing — pricing-v3 brings them back in sync. See
  // project_pricing_v3_pricing_levels.md.
  const FAMILY_MONTHLY_CENTS = 699;  // $6.99
  const FAMILY_YEARLY_CENTS  = 5900; // $59.00
  const hasMonthly = familyPrices.data.some(p => p.unit_amount === FAMILY_MONTHLY_CENTS && p.recurring?.interval === 'month');
  const hasYearly  = familyPrices.data.some(p => p.unit_amount === FAMILY_YEARLY_CENTS  && p.recurring?.interval === 'year');

  let familyMonthlyPriceId: string;
  if (hasMonthly) {
    familyMonthlyPriceId = familyPrices.data.find(p => p.unit_amount === FAMILY_MONTHLY_CENTS && p.recurring?.interval === 'month')!.id;
    console.log('Kiddo Family monthly price already exists:', familyMonthlyPriceId);
  } else {
    const familyPlanMonthlyPrice = await stripe.prices.create({
      product: familyPlanId,
      unit_amount: FAMILY_MONTHLY_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { display_name: 'Kiddo Family Monthly' },
    });
    familyMonthlyPriceId = familyPlanMonthlyPrice.id;
    console.log('Created Kiddo Family monthly price:', familyMonthlyPriceId);
  }

  let familyYearlyPriceId: string;
  if (hasYearly) {
    familyYearlyPriceId = familyPrices.data.find(p => p.unit_amount === FAMILY_YEARLY_CENTS && p.recurring?.interval === 'year')!.id;
    console.log('Kiddo Family yearly price already exists:', familyYearlyPriceId);
  } else {
    const familyPlanYearlyPrice = await stripe.prices.create({
      product: familyPlanId,
      unit_amount: FAMILY_YEARLY_CENTS,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { display_name: 'Kiddo Family Annual' },
    });
    familyYearlyPriceId = familyPlanYearlyPrice.id;
    console.log('Created Kiddo Family yearly price:', familyYearlyPriceId);
  }

  // Deactivate old family prices at old amounts
  const oldFamilyPrices = familyPrices.data.filter(p =>
    !(p.unit_amount === FAMILY_MONTHLY_CENTS && p.recurring?.interval === 'month') &&
    !(p.unit_amount === FAMILY_YEARLY_CENTS  && p.recurring?.interval === 'year')
  );
  for (const oldPrice of oldFamilyPrices) {
    await stripe.prices.update(oldPrice.id, { active: false });
    console.log('Deactivated old Kiddo Family price:', oldPrice.id, `($${(oldPrice.unit_amount || 0) / 100}/${oldPrice.recurring?.interval})`);
  }

  // ── Sponsor-Plus gift products (Prong B of pricing-v3 conversion) ───
  // Per project_gifter_sponsors_plus_subscription.md (locked 2026-05-23).
  // One-time payment products (mode='payment', no recurring) priced
  // to match the canonical annual plans: Plus $29, Family $59.
  // Activate 12 months of plan coverage on the fund when purchased
  // by a gifter via POST /api/stripe/checkout/sponsor-plus.

  async function ensureGiftProduct(name: string, description: string, priceCents: number, displayName: string): Promise<string> {
    const search = await stripe.products.search({ query: `name:'${name}'` });
    let productId: string;
    if (search.data.length > 0) {
      productId = search.data[0].id;
      console.log(`${name} already exists:`, productId);
      await stripe.products.update(productId, {
        name,
        description,
        metadata: { type: 'one_time', benefit: 'sponsored_plus' },
      });
    } else {
      const product = await stripe.products.create({
        name,
        description,
        metadata: { type: 'one_time', benefit: 'sponsored_plus' },
      });
      productId = product.id;
      console.log(`Created ${name} product:`, productId);
    }
    const prices = await stripe.prices.list({ product: productId, active: true });
    const existing = prices.data.find(p => p.unit_amount === priceCents && !p.recurring);
    if (existing) {
      console.log(`${name} price already exists:`, existing.id);
      return existing.id;
    }
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: priceCents,
      currency: 'usd',
      metadata: { display_name: displayName },
    });
    console.log(`Created ${name} price:`, price.id);
    // Deactivate older prices at different amounts for the same product.
    const oldGiftPrices = prices.data.filter(p => p.unit_amount !== priceCents || p.recurring);
    for (const oldPrice of oldGiftPrices) {
      await stripe.prices.update(oldPrice.id, { active: false });
      console.log(`Deactivated old ${name} price:`, oldPrice.id);
    }
    return price.id;
  }

  const plusGiftPriceId = await ensureGiftProduct(
    'Kiddo Plus Annual Gift',
    'A year of Kiddo+ for a child\'s fund, sponsored by a gifter. One-time payment; never auto-renews. Activates recurring contributions, custom fund mix, parent-authored Memory Book media, and co-parent access on the recipient fund for 12 months.',
    2900, // $29
    'Kiddo Plus Annual Gift',
  );
  const familyGiftPriceId = await ensureGiftProduct(
    'Kiddo Family Annual Gift',
    'A year of Kiddo Family for a child\'s fund, sponsored by a gifter. One-time payment; never auto-renews. Activates Family-tier benefits on the recipient fund for 12 months.',
    5900, // $59
    'Kiddo Family Annual Gift',
  );

  // ── Event Boost (one-time per event) ────────────────────────────────────
  let eventBoostId: string;
  if (existingBoostSearch.data.length > 0) {
    eventBoostId = existingBoostSearch.data[0].id;
    console.log('Event Boost already exists:', eventBoostId);
  } else if (existingPassSearch.data.length > 0) {
    eventBoostId = existingPassSearch.data[0].id;
    await stripe.products.update(eventBoostId, {
      name: 'Event Boost',
      description: 'Premium themes, goal cards, and thank-you automation for a single event. Waives the platform fee on gifts for that event.',
      metadata: { type: 'one_time', benefit: 'fee_waiver' },
    });
    console.log('Renamed Event Pass to Event Boost:', eventBoostId);
  } else {
    const eventBoost = await stripe.products.create({
      name: 'Event Boost',
      description: 'Premium themes, goal cards, and thank-you automation for a single event. Waives the platform fee on gifts for that event.',
      metadata: { type: 'one_time', benefit: 'fee_waiver' },
    });
    eventBoostId = eventBoost.id;
    console.log('Created Event Boost product:', eventBoostId);
  }

  const boostPrices = await stripe.prices.list({ product: eventBoostId, active: true });
  const hasBoostPrice = boostPrices.data.some(p => p.unit_amount === 2900);
  let eventBoostPriceId: string;
  if (hasBoostPrice) {
    eventBoostPriceId = boostPrices.data.find(p => p.unit_amount === 2900)!.id;
    console.log('Event Boost price already exists:', eventBoostPriceId);
  } else {
    const eventBoostPrice = await stripe.prices.create({
      product: eventBoostId,
      unit_amount: 2900,
      currency: 'usd',
      metadata: { display_name: 'Event Boost' },
    });
    eventBoostPriceId = eventBoostPrice.id;
    console.log('Created Event Boost price:', eventBoostPriceId);
  }

  const oldBoostPrices = boostPrices.data.filter(p => p.unit_amount !== 2900);
  for (const oldPrice of oldBoostPrices) {
    await stripe.prices.update(oldPrice.id, { active: false });
    console.log('Deactivated old Event Pass/Boost price:', oldPrice.id, `($${(oldPrice.unit_amount || 0) / 100})`);
  }

  console.log('\nAll products synced successfully!');
  console.log('Kiddo+ Monthly Price ID:', starterPriceId);
  console.log('Kiddo+ Yearly Price ID:', starterYearlyPriceId);
  console.log('Kiddo Family Monthly Price ID:', familyMonthlyPriceId);
  console.log('Kiddo Family Yearly Price ID:', familyYearlyPriceId);
  console.log('Kiddo Plus Annual Gift Price ID:', plusGiftPriceId);
  console.log('Kiddo Family Annual Gift Price ID:', familyGiftPriceId);
  console.log('Event Boost Price ID:', eventBoostPriceId);
}

createProducts().catch(console.error);
