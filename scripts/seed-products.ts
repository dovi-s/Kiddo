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

  console.log('Creating Kora products in Stripe...');

  const existingProducts = await stripe.products.search({ query: "name:'Family Plan'" });
  if (existingProducts.data.length > 0) {
    console.log('Products already exist, skipping...');
    console.log('Existing products:', existingProducts.data.map(p => p.name));
    return;
  }

  const starterPlan = await stripe.products.create({
    name: 'Starter Plan',
    description: 'No platform fee on gifts. 2 event pages per fund. Memory Book and auto-invest included.',
    metadata: {
      type: 'subscription',
      benefit: 'fee_waiver',
      events_per_fund: '2',
    }
  });
  console.log('Created Starter Plan product:', starterPlan.id);

  const starterPlanPrice = await stripe.prices.create({
    product: starterPlan.id,
    unit_amount: 500,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      display_name: 'Starter Plan Monthly (per fund)',
    }
  });
  console.log('Created Starter Plan price:', starterPlanPrice.id);

  const familyPlan = await stripe.products.create({
    name: 'Family Plan',
    description: 'Unlimited funds and premium event pages. No platform fee on gifts. Household dashboard, recurring gift management, and priority support.',
    metadata: {
      type: 'subscription',
      benefit: 'fee_waiver',
      unlimited: 'true',
    }
  });
  console.log('Created Family Plan product:', familyPlan.id);

  const familyPlanMonthlyPrice = await stripe.prices.create({
    product: familyPlan.id,
    unit_amount: 1200,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      display_name: 'Family Plan Monthly',
    }
  });
  console.log('Created Family Plan monthly price:', familyPlanMonthlyPrice.id);

  const familyPlanYearlyPrice = await stripe.prices.create({
    product: familyPlan.id,
    unit_amount: 11900,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      display_name: 'Family Plan Annual',
    }
  });
  console.log('Created Family Plan yearly price:', familyPlanYearlyPrice.id);

  const eventBoost = await stripe.products.create({
    name: 'Event Boost',
    description: 'Premium themes, goal cards, and thank-you automation for a single event. Waives the $2 platform fee on gifts for that event.',
    metadata: {
      type: 'one_time',
      benefit: 'fee_waiver',
    }
  });
  console.log('Created Event Boost product:', eventBoost.id);

  const eventBoostPrice = await stripe.prices.create({
    product: eventBoost.id,
    unit_amount: 2900,
    currency: 'usd',
    metadata: {
      display_name: 'Event Boost',
    }
  });
  console.log('Created Event Boost price:', eventBoostPrice.id);

  console.log('\nProducts created successfully!');
  console.log('Starter Plan Price ID:', starterPlanPrice.id);
  console.log('Family Plan Monthly Price ID:', familyPlanMonthlyPrice.id);
  console.log('Family Plan Yearly Price ID:', familyPlanYearlyPrice.id);
  console.log('Event Boost Price ID:', eventBoostPrice.id);
}

createProducts().catch(console.error);
