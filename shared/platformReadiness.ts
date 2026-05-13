export type StackStatus = "launch_ready" | "optional_ready" | "external_boundary" | "planned";

export type StackCheck = {
  id: string;
  label: string;
  layer: "runtime" | "financial" | "comms" | "security" | "analytics" | "mobile" | "deployment";
  status: StackStatus;
  requiredForLaunch: boolean;
  configured: boolean;
  envVars: string[];
  detail: string;
};

const hasAll = (env: NodeJS.ProcessEnv, keys: string[]) =>
  keys.every((key) => String(env[key] || "").trim().length > 0);

const hasAny = (env: NodeJS.ProcessEnv, keys: string[]) =>
  keys.some((key) => String(env[key] || "").trim().length > 0);

export function buildPlatformReadiness(env: NodeJS.ProcessEnv = process.env): StackCheck[] {
  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production";

  return [
    {
      id: "postgres",
      label: "PostgreSQL database",
      layer: "runtime",
      status: "launch_ready",
      requiredForLaunch: true,
      configured: hasAll(env, ["DATABASE_URL"]),
      envVars: ["DATABASE_URL"],
      detail: "Primary app data, sessions, gifts, funds, subscriptions, Memory Book, and admin diagnostics.",
    },
    {
      id: "session-secret",
      label: "Session secret",
      layer: "security",
      status: "launch_ready",
      requiredForLaunch: true,
      configured: hasAll(env, ["SESSION_SECRET"]),
      envVars: ["SESSION_SECRET"],
      detail: "Required for signed session cookies and stable authentication.",
    },
    {
      id: "stripe",
      label: "Stripe payments and billing",
      layer: "financial",
      status: "launch_ready",
      requiredForLaunch: true,
      configured: hasAll(env, ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) && hasAny(env, ["STRIPE_PUBLISHABLE_KEY", "VITE_STRIPE_PUBLISHABLE_KEY"]),
      envVars: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "VITE_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
      detail: "Gift checkout, wallet payments, subscriptions, Occasions, optional gift upgrades, and webhook reconciliation.",
    },
    {
      id: "stripe-prices",
      label: "Stripe product price ids",
      layer: "financial",
      status: "launch_ready",
      requiredForLaunch: false,
      configured:
        (hasAll(env, ["STRIPE_PRICE_PLUS_MONTHLY"]) || hasAll(env, ["STRIPE_PRICE_STARTER_MONTHLY"])) &&
        (hasAll(env, ["STRIPE_PRICE_PLUS_YEARLY"]) || hasAll(env, ["STRIPE_PRICE_STARTER_YEARLY"])) &&
        hasAll(env, ["STRIPE_PRICE_FAMILY_MONTHLY", "STRIPE_PRICE_FAMILY_YEARLY", "STRIPE_PRICE_OCCASION_TOP_UP"]),
      envVars: [
        "STRIPE_PRICE_PLUS_MONTHLY",
        "STRIPE_PRICE_PLUS_YEARLY",
        "STRIPE_PRICE_STARTER_MONTHLY",
        "STRIPE_PRICE_STARTER_YEARLY",
        "STRIPE_PRICE_FAMILY_MONTHLY",
        "STRIPE_PRICE_FAMILY_YEARLY",
        "STRIPE_PRICE_OCCASION_TOP_UP",
      ],
      detail: "Keeps checkout deterministic instead of relying on product-name lookup fallbacks.",
    },
    {
      id: "base-url",
      label: "Public app base URL",
      layer: "deployment",
      status: "launch_ready",
      requiredForLaunch: isProduction,
      configured: hasAny(env, ["APP_BASE_URL", "PUBLIC_APP_URL", "APP_URL", "BASE_URL"]),
      envVars: ["APP_BASE_URL", "PUBLIC_APP_URL", "APP_URL", "BASE_URL"],
      detail: "Used for absolute checkout redirects, metadata, sitemap, and trust links.",
    },
    {
      id: "oauth",
      label: "OAuth provider",
      layer: "security",
      status: "optional_ready",
      requiredForLaunch: false,
      configured:
        hasAll(env, ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) ||
        hasAll(env, ["APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET"]),
      envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET"],
      detail: "Google or Apple sign-in, Email and password auth still works without this.",
    },
    {
      id: "email",
      label: "Transactional email",
      layer: "comms",
      status: "optional_ready",
      requiredForLaunch: isProduction,
      configured: hasAny(env, ["POSTMARK_SERVER_TOKEN", "SENDGRID_API_KEY"]),
      envVars: ["POSTMARK_SERVER_TOKEN", "SENDGRID_API_KEY", "EMAIL_FROM_ADDRESS", "EMAIL_REPLY_TO"],
      detail: "Receipts, gift updates, trial expiry, dunning, and lifecycle notifications, Local dev can use the durable outbox.",
    },
    {
      id: "plaid",
      label: "Plaid identity and bank connection",
      layer: "financial",
      status: "external_boundary",
      requiredForLaunch: false,
      configured: hasAll(env, ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"]),
      envVars: ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"],
      detail: "KYC prefill, bank account linking, token refresh, and balance checks, The product boundary exists, production token storage still needs finalization.",
    },
    {
      id: "drivewealth",
      label: "DriveWealth brokerage boundary",
      layer: "financial",
      status: "external_boundary",
      requiredForLaunch: false,
      configured: hasAll(env, ["DRIVEWEALTH_API_KEY", "DRIVEWEALTH_API_SECRET", "DRIVEWEALTH_BASE_URL"]),
      envVars: ["DRIVEWEALTH_API_KEY", "DRIVEWEALTH_API_SECRET", "DRIVEWEALTH_BASE_URL"],
      detail: "Brokerage account creation, trade execution, settlement, tax documents, and AUM or float economics.",
    },
    {
      id: "custodian-transfer",
      label: "Custodian transfer handoff",
      layer: "financial",
      status: "external_boundary",
      requiredForLaunch: false,
      configured: hasAll(env, ["CUSTODIAN_TRANSFER_WEBHOOK_URL", "CUSTODIAN_TRANSFER_WEBHOOK_SECRET"]),
      envVars: ["CUSTODIAN_TRANSFER_WEBHOOK_URL", "CUSTODIAN_TRANSFER_WEBHOOK_SECRET"],
      detail: "Age-18 and ownership handoff requests to an external custody operations layer.",
    },
    {
      id: "ops-alerts",
      label: "Operations alerts",
      layer: "deployment",
      status: "optional_ready",
      requiredForLaunch: false,
      configured: hasAny(env, ["ALERT_WEBHOOK_URL"]),
      envVars: ["ALERT_WEBHOOK_URL", "ALERT_WEBHOOK_BEARER"],
      detail: "Critical DB, webhook, and API failures can notify an ops channel.",
    },
    {
      id: "sentry",
      label: "Sentry errors",
      layer: "deployment",
      status: "optional_ready",
      requiredForLaunch: false,
      configured: hasAny(env, ["SENTRY_DSN"]),
      envVars: ["SENTRY_DSN"],
      detail: "Server error capture, Requires the Sentry package in runtime dependencies to activate.",
    },
    {
      id: "posthog",
      label: "PostHog product events",
      layer: "analytics",
      status: "optional_ready",
      requiredForLaunch: false,
      configured: hasAny(env, ["POSTHOG_API_KEY"]),
      envVars: ["POSTHOG_API_KEY", "POSTHOG_HOST"],
      detail: "Server-side product events and monetization trigger analytics.",
    },
    {
      id: "push",
      label: "Mobile push notifications",
      layer: "mobile",
      status: "planned",
      requiredForLaunch: false,
      configured: hasAny(env, ["FIREBASE_SERVICE_ACCOUNT", "EXPO_ACCESS_TOKEN"]),
      envVars: ["FIREBASE_SERVICE_ACCOUNT", "EXPO_ACCESS_TOKEN"],
      detail: "Gift received, milestone, trial, bank refresh, and auto-invest push notifications.",
    },
    {
      id: "storage",
      label: "Durable object storage",
      layer: "deployment",
      status: "planned",
      requiredForLaunch: false,
      configured: hasAny(env, ["CLOUDFLARE_R2_BUCKET_NAME", "AWS_S3_BUCKET"]),
      envVars: ["CLOUDFLARE_R2_BUCKET_NAME", "AWS_S3_BUCKET"],
      detail: "Memory Book photos, videos, voice notes, statements, and tax documents, Local uploads are development-only.",
    },
  ];
}

export function summarizePlatformReadiness(checks: StackCheck[]) {
  const required = checks.filter((check) => check.requiredForLaunch);
  const missingRequired = required.filter((check) => !check.configured);
  const configured = checks.filter((check) => check.configured);
  return {
    ok: missingRequired.length === 0,
    configured: configured.length,
    total: checks.length,
    requiredConfigured: required.length - missingRequired.length,
    requiredTotal: required.length,
    missingRequired: missingRequired.map((check) => check.id),
  };
}
