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

  const familyPlan = await stripe.products.create({
    name: 'Family Plan',
    description: 'Waives Kora platform fee on gifts up to $15,000/year. Covers all children and all events.',
    metadata: {
      type: 'subscription',
      benefit: 'fee_waiver',
      annual_limit: '15000',
    }
  });
  console.log('Created Family Plan product:', familyPlan.id);

  const familyPlanPrice = await stripe.prices.create({
    product: familyPlan.id,
    unit_amount: 19900,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      display_name: 'Family Plan Annual',
    }
  });
  console.log('Created Family Plan price:', familyPlanPrice.id);

  const eventPass = await stripe.products.create({
    name: 'Event Pass',
    description: 'Waives Kora platform fee for one event, up to $7,500 in gifts.',
    metadata: {
      type: 'one_time',
      benefit: 'fee_waiver',
      event_limit: '7500',
    }
  });
  console.log('Created Event Pass product:', eventPass.id);

  const eventPassPrice = await stripe.prices.create({
    product: eventPass.id,
    unit_amount: 9900,
    currency: 'usd',
    metadata: {
      display_name: 'Event Pass',
    }
  });
  console.log('Created Event Pass price:', eventPassPrice.id);

  console.log('\nProducts created successfully!');
  console.log('Family Plan Price ID:', familyPlanPrice.id);
  console.log('Event Pass Price ID:', eventPassPrice.id);
}

createProducts().catch(console.error);
