# Kado Technical Spec

Updated: 2026-04-03

This is the short internal provider map for the current repo.

Status key:
- `launch_ready`: wired in repo and aligned to current launch path
- `optional_ready`: wired in repo but not required for launch
- `external_boundary`: product boundary exists, but production partner/process still needs to be finalized
- `planned`: listed in env/docs, not actively wired into runtime behavior yet

## Core providers

| Provider | Purpose | Env vars | Repo files | Privacy policy impact | Launch readiness status |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL | Primary app database and session storage | `DATABASE_URL` | `server/db.ts`, `server/auth.ts`, `shared/schema.ts`, `drizzle.config.ts` | Already covered as core data infrastructure; no named processor text currently required in the policy, but hosting/vendor should be disclosed if customer-facing data processor naming becomes stricter | `launch_ready` |
| Stripe | Gift checkout, subscriptions, webhook-driven payment lifecycle | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional price env vars | `server/stripeService.ts`, `server/stripeClient.ts`, `server/webhookHandlers.ts`, `server/index.ts`, `server/routes.ts`, `client/src/pages/GiftCheckout.tsx`, `client/src/pages/Settings.tsx` | Already explicitly named in Privacy Policy and Terms; keep named as payment processor | `launch_ready` |
| DriveWealth | Brokerage custody, securities account boundary, disclosures/trust layer | `DRIVEWEALTH_API_KEY`, `DRIVEWEALTH_API_SECRET`, `DRIVEWEALTH_BASE_URL` | `client/src/pages/Legal.tsx`, `client/src/pages/Security.tsx`, `shared/schema.ts`, docs only today for direct API creds | Already explicitly named in Privacy Policy and Disclosures; must remain named if used for custody/account opening | `external_boundary` |
| Custodian transfer webhook target | Age-18 transfer and ownership handoff notification boundary to operations/back-office | `CUSTODIAN_TRANSFER_WEBHOOK_URL`, `CUSTODIAN_TRANSFER_WEBHOOK_SECRET` | `server/custodianTransfer.ts`, `server/routes.ts` | Falls under custody/operations processors; if a real external operator/vendor is used, that vendor should be specifically named in policy/docs | `optional_ready` |

## Auth and identity providers

| Provider | Purpose | Env vars | Repo files | Privacy policy impact | Launch readiness status |
| --- | --- | --- | --- | --- | --- |
| Session auth / Passport local | Email/password auth and session-backed login | `SESSION_SECRET` | `server/auth.ts`, `shared/models/auth.ts`, `client/src/hooks/use-auth.ts`, `client/src/pages/Login.tsx` | Covered by cookies/session language in Privacy Policy; no external processor naming needed beyond session storage host | `launch_ready` |
| Google OAuth | Optional social sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `server/auth.ts`, `client/src/pages/Login.tsx` | If enabled publicly, Privacy Policy should mention Google as an auth/identity provider | `optional_ready` |
| Apple Sign In | Optional social sign-in | `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` | `server/auth.ts`, `client/src/pages/Login.tsx` | If enabled publicly, Privacy Policy should mention Apple as an auth/identity provider | `optional_ready` |

## Communications providers

| Provider | Purpose | Env vars | Repo files | Privacy policy impact | Launch readiness status |
| --- | --- | --- | --- | --- | --- |
| Postmark | Primary transactional email provider when configured | `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO` | `server/emailDelivery.ts`, `server/gifterNotificationWorker.ts`, `server/routes.ts` | Privacy Policy already anticipates transactional email providers and names Postmark as an example; once enabled, keep it explicitly named | `optional_ready` |
| SendGrid | Fallback transactional email provider when Postmark is not configured | `SENDGRID_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO` | `server/emailDelivery.ts`, `server/gifterNotificationWorker.ts`, `server/routes.ts` | Privacy Policy already anticipates transactional email providers and names SendGrid as an example; once enabled, keep it explicitly named | `optional_ready` |
| Local durable outbox | Dev/ops fallback when no email provider is configured | none | `server/emailDelivery.ts`, `.local/email-outbox.jsonl` | No policy impact; internal fallback only | `optional_ready` |

## Observability and ops providers

| Provider | Purpose | Env vars | Repo files | Privacy policy impact | Launch readiness status |
| --- | --- | --- | --- | --- | --- |
| Sentry | Error monitoring and exception capture | `SENTRY_DSN` | `server/ops.ts`, `server/index.ts` | If enabled in production, Privacy Policy should name Sentry as an error-monitoring/analytics processor | `optional_ready` |
| PostHog | Product telemetry and event capture | `POSTHOG_API_KEY`, `POSTHOG_HOST` | `server/index.ts`, `server/ops.ts` | If enabled in production, Privacy Policy should name PostHog under analytics/measurement technologies | `optional_ready` |
| Alert webhook | Ops alerts to Slack/Discord/custom endpoint | `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_BEARER` | `server/ops.ts`, `server/index.ts`, `DEPLOYMENT_CHECKLIST.md` | No direct customer-facing privacy change unless routed through a named third-party support/ops tool that stores user data | `optional_ready` |

## Planned or partially adopted providers

| Provider | Purpose | Env vars | Repo files | Privacy policy impact | Launch readiness status |
| --- | --- | --- | --- | --- | --- |
| Plaid | ACH / bank linking / verification | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | `.env.example`, `INTEGRATIONS.md`, `client/src/pages/Legal.tsx` | Privacy Policy already says Plaid must be named if bank linking goes live; required update before release of ACH flows | `planned` |
| Mixpanel | Product analytics | `MIXPANEL_PROJECT_TOKEN` | `.env.example`, `INTEGRATIONS.md`, `client/src/pages/Legal.tsx` | Must be named if enabled for analytics | `planned` |
| GA4 | Web analytics / attribution | `GA4_MEASUREMENT_ID` | `.env.example`, `LAUNCH_STACK.md`, `client/src/pages/Legal.tsx` | Must be named if enabled for analytics/cookies | `planned` |
| Firebase Cloud Messaging | Push notifications / messaging | `FIREBASE_SERVICE_ACCOUNT` | `.env.example`, `client/src/pages/Legal.tsx` | Must be named if push notifications go live | `planned` |
| Twilio | SMS and messaging flows | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | `.env.example`, `client/src/pages/Legal.tsx`, `client/src/components/ui/share-kit.tsx` (share UX only, not provider integration) | Must be named if SMS or messaging is enabled | `planned` |
| Klaviyo | Lifecycle marketing | `KLAVIYO_API_KEY` | `.env.example`, `INTEGRATIONS.md`, `LAUNCH_STACK.md`, `client/src/pages/Legal.tsx` | Must be named if lifecycle marketing is enabled | `planned` |
| Intercom | Customer support tooling | `INTERCOM_APP_ID`, `INTERCOM_SECRET_KEY` | `.env.example`, `LAUNCH_STACK.md`, `client/src/pages/Legal.tsx` | Must be named if support widget or support data processing is enabled | `planned` |
| Supabase client APIs | Optional auth/storage/client SDK usage beyond plain Postgres | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `.env.example`, `INTEGRATIONS.md` | If enabled for auth/storage, Supabase should be named as a processor; today repo uses it only as a Postgres source via `DATABASE_URL` | `planned` |
| Cloudflare R2 | Object/blob storage | `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET_NAME` | `.env.example` | Must be named if user-uploaded media or files are stored there | `planned` |

## Repo reality summary

### Required before public launch
- PostgreSQL
- Stripe
- `SESSION_SECRET`-backed auth
- one real transactional email provider
- finalized custody/DriveWealth operating model

### Safe to leave optional at launch
- Google OAuth
- Apple Sign In
- Sentry
- PostHog
- alert webhook integration

### Do not claim as live yet
- Plaid
- Twilio
- Firebase Cloud Messaging
- Klaviyo
- Intercom
- Mixpanel
- GA4
- Supabase client SDK usage
- Cloudflare R2

## Privacy-policy rule

When a provider moves from `planned` to active production use:
- add the env vars to real deployment config
- verify the provider is referenced in repo/runtime behavior
- update `client/src/pages/Legal.tsx`
- update `INTEGRATIONS.md`
- update this file's launch readiness status
