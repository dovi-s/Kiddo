import Stripe from 'stripe';
import https from 'https';
let directEnvSettings: { publishableKey: string; secretKey: string } | null = null;

async function getCredentials() {
  if (directEnvSettings) {
    return directEnvSettings;
  }

  const envPublishableKey =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const envSecretKey = process.env.STRIPE_SECRET_KEY;

  if (envPublishableKey && envSecretKey) {
    directEnvSettings = {
      publishableKey: envPublishableKey,
      secretKey: envSecretKey,
    };
    return directEnvSettings;
  }
  throw new Error(
    'Stripe credentials are missing. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in your environment.',
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  const requestedInsecureTls =
    process.env.STRIPE_ALLOW_INSECURE_TLS === '1' ||
    process.env.STRIPE_ALLOW_INSECURE_TLS === 'true' ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0';
  const allowInsecureTls = process.env.NODE_ENV !== 'production' && requestedInsecureTls;

  if (process.env.NODE_ENV === "production" && requestedInsecureTls) {
    throw new Error("Unsafe Stripe TLS configuration in production.");
  }

  const insecureAgent = new https.Agent({ rejectUnauthorized: false });

  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
    httpAgent: allowInsecureTls ? insecureAgent : undefined,
    httpClient: allowInsecureTls ? Stripe.createNodeHttpClient(insecureAgent) : undefined,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
