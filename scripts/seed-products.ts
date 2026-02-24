import Stripe from 'stripe';

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', 'development');

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.secret) {
    throw new Error('Stripe connection not found');
  }

  return connectionSettings.settings.secret;
}

async function createProducts() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });

  console.log('Syncing Kora products in Stripe...');

  const existingStarterSearch = await stripe.products.search({ query: "name:'Starter Plan'" });
  const existingFamilySearch = await stripe.products.search({ query: "name:'Family Plan'" });
  const existingBoostSearch = await stripe.products.search({ query: "name:'Event Boost'" });
  const existingPassSearch = await stripe.products.search({ query: "name:'Event Pass'" });

  let starterPlanId: string;
  if (existingStarterSearch.data.length > 0) {
    starterPlanId = existingStarterSearch.data[0].id;
    console.log('Starter Plan already exists:', starterPlanId);
    await stripe.products.update(starterPlanId, {
      description: 'No platform fee on gifts. 2 event pages per fund. Memory Book and auto-invest included.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', events_per_fund: '2' },
    });
  } else {
    const starterPlan = await stripe.products.create({
      name: 'Starter Plan',
      description: 'No platform fee on gifts. 2 event pages per fund. Memory Book and auto-invest included.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', events_per_fund: '2' },
    });
    starterPlanId = starterPlan.id;
    console.log('Created Starter Plan product:', starterPlanId);
  }

  const starterPrices = await stripe.prices.list({ product: starterPlanId, active: true });
  const hasStarterMonthly = starterPrices.data.some(p => p.unit_amount === 500 && p.recurring?.interval === 'month');
  let starterPriceId: string;
  if (hasStarterMonthly) {
    starterPriceId = starterPrices.data.find(p => p.unit_amount === 500 && p.recurring?.interval === 'month')!.id;
    console.log('Starter Plan monthly price already exists:', starterPriceId);
  } else {
    const starterPlanPrice = await stripe.prices.create({
      product: starterPlanId,
      unit_amount: 500,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { display_name: 'Starter Plan Monthly (per fund)' },
    });
    starterPriceId = starterPlanPrice.id;
    console.log('Created Starter Plan price:', starterPriceId);
  }

  let familyPlanId: string;
  if (existingFamilySearch.data.length > 0) {
    familyPlanId = existingFamilySearch.data[0].id;
    console.log('Family Plan already exists:', familyPlanId);
    await stripe.products.update(familyPlanId, {
      description: 'Unlimited funds and premium event pages. No platform fee on gifts. Household dashboard, recurring gift management, and priority support.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', unlimited: 'true' },
    });
  } else {
    const familyPlan = await stripe.products.create({
      name: 'Family Plan',
      description: 'Unlimited funds and premium event pages. No platform fee on gifts. Household dashboard, recurring gift management, and priority support.',
      metadata: { type: 'subscription', benefit: 'fee_waiver', unlimited: 'true' },
    });
    familyPlanId = familyPlan.id;
    console.log('Created Family Plan product:', familyPlanId);
  }

  const familyPrices = await stripe.prices.list({ product: familyPlanId, active: true });
  const hasMonthly = familyPrices.data.some(p => p.unit_amount === 1200 && p.recurring?.interval === 'month');
  const hasYearly = familyPrices.data.some(p => p.unit_amount === 11900 && p.recurring?.interval === 'year');

  let familyMonthlyPriceId: string;
  if (hasMonthly) {
    familyMonthlyPriceId = familyPrices.data.find(p => p.unit_amount === 1200 && p.recurring?.interval === 'month')!.id;
    console.log('Family Plan monthly price already exists:', familyMonthlyPriceId);
  } else {
    const familyPlanMonthlyPrice = await stripe.prices.create({
      product: familyPlanId,
      unit_amount: 1200,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { display_name: 'Family Plan Monthly' },
    });
    familyMonthlyPriceId = familyPlanMonthlyPrice.id;
    console.log('Created Family Plan monthly price:', familyMonthlyPriceId);
  }

  let familyYearlyPriceId: string;
  if (hasYearly) {
    familyYearlyPriceId = familyPrices.data.find(p => p.unit_amount === 11900 && p.recurring?.interval === 'year')!.id;
    console.log('Family Plan yearly price already exists:', familyYearlyPriceId);
  } else {
    const familyPlanYearlyPrice = await stripe.prices.create({
      product: familyPlanId,
      unit_amount: 11900,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { display_name: 'Family Plan Annual' },
    });
    familyYearlyPriceId = familyPlanYearlyPrice.id;
    console.log('Created Family Plan yearly price:', familyYearlyPriceId);
  }

  const oldFamilyPrices = familyPrices.data.filter(p =>
    (p.unit_amount !== 1200 || p.recurring?.interval !== 'month') &&
    (p.unit_amount !== 11900 || p.recurring?.interval !== 'year')
  );
  for (const oldPrice of oldFamilyPrices) {
    await stripe.prices.update(oldPrice.id, { active: false });
    console.log('Deactivated old Family Plan price:', oldPrice.id, `($${(oldPrice.unit_amount || 0) / 100}/${oldPrice.recurring?.interval})`);
  }

  let eventBoostId: string;
  if (existingBoostSearch.data.length > 0) {
    eventBoostId = existingBoostSearch.data[0].id;
    console.log('Event Boost already exists:', eventBoostId);
  } else if (existingPassSearch.data.length > 0) {
    eventBoostId = existingPassSearch.data[0].id;
    await stripe.products.update(eventBoostId, {
      name: 'Event Boost',
      description: 'Premium themes, goal cards, and thank-you automation for a single event. Waives the $2 platform fee on gifts for that event.',
      metadata: { type: 'one_time', benefit: 'fee_waiver' },
    });
    console.log('Renamed Event Pass to Event Boost:', eventBoostId);
  } else {
    const eventBoost = await stripe.products.create({
      name: 'Event Boost',
      description: 'Premium themes, goal cards, and thank-you automation for a single event. Waives the $2 platform fee on gifts for that event.',
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
  console.log('Starter Plan Price ID:', starterPriceId);
  console.log('Family Plan Monthly Price ID:', familyMonthlyPriceId);
  console.log('Family Plan Yearly Price ID:', familyYearlyPriceId);
  console.log('Event Boost Price ID:', eventBoostPriceId);
}

createProducts().catch(console.error);
