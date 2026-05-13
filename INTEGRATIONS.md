# Integrations

This project is configured for standard deployment.

Status key:
- `launch_ready`: wired in repo and aligned to current launch path
- `optional_ready`: wired in repo but not required for launch
- `external_boundary`: product boundary exists, but production partner/process still needs to be finalized
- `planned`: listed in env/docs, not actively wired into runtime behavior yet

## Core Runtime

### PostgreSQL
- Status: `launch_ready`
- Used for all app data and sessions.
- Required env var: `DATABASE_URL`.
- Supabase Postgres works directly (use pooled connection string).
- Note: Supabase `project URL` and `sb_publishable` key are for Supabase client APIs.
  This backend requires the actual Postgres connection URI for `DATABASE_URL`.
- If your local network injects TLS inspection and `db:migrate` fails with
  `self-signed certificate in certificate chain`, run migration once with:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:migrate`
  and keep this override out of production runtime env.

### Stripe
- Status: `launch_ready`
- Uses standard env credentials:
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- Webhook endpoint: `POST /api/stripe/webhook`
- Admin diagnostics endpoint: `GET /api/admin/stripe-diagnostics?windowHours=24` (admin auth required)
- Configure these Stripe events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `invoice.paid`
  - `invoice.payment_failed`
- Local/dev note:
  - If your environment uses TLS interception and Stripe calls fail with
    `self-signed certificate in certificate chain`, local runtime is configured to
    tolerate this in development only.
  - Production fails fast on unsafe TLS settings.

### Authentication
- Status: `launch_ready` for session auth, `optional_ready` for Google/Apple OAuth
- Local email/password auth via Passport local strategy.
- Required env var: `SESSION_SECRET`.
- Optional OAuth providers already wired in-repo:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `APPLE_CLIENT_ID`
  - `APPLE_CLIENT_SECRET`
- Current note:
  - The repo does not use Clerk.
  - Apple Sign In is configured through `APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET` at runtime. Apple team/key metadata may still be required externally to generate that secret, but the app itself does not read `APPLE_TEAM_ID` or `APPLE_KEY_ID` today.

### Transactional Email Delivery
- Status: `optional_ready`
- Optional providers already wired in-repo:
  - `POSTMARK_SERVER_TOKEN`
  - `SENDGRID_API_KEY`
  - `EMAIL_FROM_ADDRESS`
  - `EMAIL_REPLY_TO`
- Delivery behavior:
  - If Postmark is configured, the server sends through Postmark.
  - Else if SendGrid is configured, the server sends through SendGrid.
  - Else the repo falls back to a durable local outbox path for non-production development flows.
- Relevant files:
  - `server/emailDelivery.ts`
  - `server/gifterNotificationWorker.ts`

### Custodian / Back-office Handoff Boundary
- Status: `external_boundary`
- Optional env vars already wired in-repo:
  - `CUSTODIAN_TRANSFER_WEBHOOK_URL`
  - `CUSTODIAN_TRANSFER_WEBHOOK_SECRET`
- Used for:
  - age-18 transfer requests
  - ownership handoff notifications
- If not configured:
  - the repo uses an outbox-style fallback instead of pretending the brokerage back-office step is complete.
- Relevant file:
  - `server/custodianTransfer.ts`

## Optional Runtime

### Build-time base URL
- Status: `optional_ready`
- Optional env var: `APP_BASE_URL`
- Used by the meta image plugin to set absolute OG/Twitter image URLs.

### Operations Alerts
- Status: `optional_ready`
- Optional env vars:
  - `ALERT_WEBHOOK_URL`
  - `ALERT_WEBHOOK_BEARER`
- Sends alerts for health-check DB failures and webhook processing failures.

### Telemetry
- Status:
  - `optional_ready` for PostHog and Sentry
  - `planned` for Mixpanel, GA4, and Firebase Cloud Messaging
- Optional env vars:
  - `POSTHOG_API_KEY`
  - `POSTHOG_HOST` (default `https://us.i.posthog.com`)
  - `SENTRY_DSN` (requires `@sentry/node` package installed to enable capture)
- Planned but not yet wired directly in this repo:
  - `MIXPANEL_PROJECT_TOKEN`
  - `GA4_MEASUREMENT_ID`
  - `FIREBASE_SERVICE_ACCOUNT`

### Market Data
- Status: `optional_ready`
- Optional env var:
  - `FINNHUB_API_KEY`
  - `ALPHA_VANTAGE_API_KEY`
  - `MARKET_QUOTES_REFRESH_MINUTES`
- Runtime behavior:
  - `GET /api/market/quotes?symbols=AAPL,AMZN` returns the quote rows used by gift checkout and dashboard share/share-estimate UI.
  - Provider order is Finnhub first, Alpha Vantage second, stale local cache third, and server-side estimates last.
  - Successful live provider quotes are persisted to `.local/market-quotes-cache.json` so a temporary provider outage can still serve a recent stale quote.
  - `MARKET_QUOTES_REFRESH_MINUTES` enables an optional scheduled warmer. Leave it empty/0 in local dev; production can set `15` or higher to keep the quote cache warm without waiting for a gifter checkout.
  - If both provider keys are missing and no stale cache exists, the endpoint returns server-side estimates so checkout and dashboard screens remain usable.
- Admin / ops note:
  - Treat visible share counts as estimates until brokerage execution confirms the actual fill.
  - If a different provider is adopted later, keep `/api/market/quotes` as the app-facing contract and swap or extend the provider chain behind that endpoint.

## Required Env Vars

- `DATABASE_URL`
- `SESSION_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Planned / External Integrations

These are valid launch-stack considerations, but they are not all active runtime dependencies in this repo today.

### Plaid
- Status: `external_boundary`
- Use case:
  - identity verification prefill
  - ACH bank account linking
  - bank token refresh
  - balance checks before auto-invest or recurring gifter pulls
- Env vars:
  - `PLAID_CLIENT_ID`
  - `PLAID_SECRET`
  - `PLAID_ENV`
- Runtime boundary:
  - `POST /api/plaid/link-token` is wired.
  - `POST /api/plaid/exchange-public-token` creates a tokenized bank account record.
  - Kiddo does not store Plaid access tokens in plain app tables. Production needs a dedicated token vault or provider handoff before real ACH pulls.
- Browser boundary:
  - Content Security Policy allows Plaid Link scripts and frames.
- Documentation note:
  - If ACH or bank linking goes live through Plaid, update the Privacy Policy to name Plaid as a data processor.

### KYC / AML provider
- Status: `external_boundary`
- Current repo reality:
  - the app collects KYC inputs in the activation flow
  - the legal and brokerage workflow still depends on external custody / verification setup
- Current product-safe documentation stance:
  - list DriveWealth as the brokerage / custody partner
  - explicitly state that any dedicated identity-verification vendors will be added to the Privacy Policy when enabled

### Messaging / Lifecycle / Support providers
- Status: `planned`
- Not currently required for core runtime, but commonly planned:
  - `KLAVIYO_API_KEY`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `INTERCOM_APP_ID`
  - `INTERCOM_SECRET_KEY`

## Webhook Infrastructure

This repo already has real event-driven infrastructure and it should be treated as part of the technical spec.

### Stripe webhooks
- Status: `launch_ready`
- Endpoint:
  - `POST /api/stripe/webhook`
- Signature verification:
  - required via `STRIPE_WEBHOOK_SECRET`
- Core handling lives in:
  - `server/index.ts`
  - `server/webhookHandlers.ts`
- Operational characteristics:
  - signature verification
  - idempotent event storage in `webhook_events`
  - replay-safe handling
  - admin diagnostics via `/api/admin/webhooks`

### Custodian transfer webhooks
- Status: `external_boundary`
- Outbound only from this repo today
- Used to notify an external custody / back-office system about age-18 or ownership handoff events
- Handler boundary lives in:
  - `server/custodianTransfer.ts`

### Other event-driven flows
- Status: `launch_ready`
- Gift reconciliation and delayed-payment healing paths exist in:
  - `server/routes.ts`
  - `server/webhookHandlers.ts`
- Ops alerts for DB / webhook failures use:
  - `ALERT_WEBHOOK_URL`
  - `ALERT_WEBHOOK_BEARER`

## Validation Commands

- Basic smoke checks: `npm run test:smoke`
- Stripe pipeline consistency checks: `npm run test:stripe-pipeline`
  - Set `STRIPE_PIPELINE_STRICT=1` to fail on missing memory/thank-you rows or failed webhook events in the last 24h.

## Provider Summary

| Provider / Layer | Status | Primary env vars |
| --- | --- | --- |
| PostgreSQL | `launch_ready` | `DATABASE_URL` |
| Stripe | `launch_ready` | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Session auth | `launch_ready` | `SESSION_SECRET` |
| Google OAuth | `optional_ready` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Apple Sign In | `optional_ready` | `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` |
| Postmark | `optional_ready` | `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO` |
| SendGrid | `optional_ready` | `SENDGRID_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO` |
| Custodian transfer webhook | `external_boundary` | `CUSTODIAN_TRANSFER_WEBHOOK_URL`, `CUSTODIAN_TRANSFER_WEBHOOK_SECRET` |
| PostHog | `optional_ready` | `POSTHOG_API_KEY`, `POSTHOG_HOST` |
| Sentry | `optional_ready` | `SENTRY_DSN` |
| Finnhub market quotes | `optional_ready` | `FINNHUB_API_KEY` |
| Alpha Vantage market quote fallback | `optional_ready` | `ALPHA_VANTAGE_API_KEY` |
| Market quote scheduled warmer | `optional_ready` | `MARKET_QUOTES_REFRESH_MINUTES` |
| Alert webhook | `optional_ready` | `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_BEARER` |
| DriveWealth direct API creds | `external_boundary` | `DRIVEWEALTH_API_KEY`, `DRIVEWEALTH_API_SECRET`, `DRIVEWEALTH_BASE_URL` |
| Plaid | `external_boundary` | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` |
| Mixpanel | `planned` | `MIXPANEL_PROJECT_TOKEN` |
| GA4 | `planned` | `GA4_MEASUREMENT_ID` |
| Firebase Cloud Messaging | `planned` | `FIREBASE_SERVICE_ACCOUNT` |
| Twilio | `planned` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| Klaviyo | `planned` | `KLAVIYO_API_KEY` |
| Intercom | `planned` | `INTERCOM_APP_ID`, `INTERCOM_SECRET_KEY` |
| Supabase client APIs | `planned` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Cloudflare R2 | `planned` | `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET_NAME` |

## Stack Readiness Endpoint

The app exposes `GET /api/status` as a public machine-readable status view for launch readiness.

It returns:
- required runtime readiness, including database, session secret, Stripe, and production base URL
- optional provider readiness, including OAuth, email, alerts, Sentry, and PostHog
- external boundaries, including Plaid, DriveWealth, and custodian transfer handoff
- planned infrastructure, including push and object storage

This endpoint is intentionally configuration-only. It does not expose secret values, and it does not make live provider calls. Use `npm run test:launch-readiness` when you need live Stripe and checkout verification.
