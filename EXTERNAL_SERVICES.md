# External Services, APIs, and Accounts

The complete list of third-party services Kiddo touches, what each is for, how
critical it is, whether it's configured in THIS dev env, and where to get an
account. Source of truth for "what keys do I still need." Pairs with
`.env.example` (the bare key list) by adding purpose + criticality + status.

Legend: ✅ configured in `.env` · ❌ not set · ⚠️ scaffold / not yet wired.

## Snapshot of THIS dev env
Configured: Postgres/Supabase (`DATABASE_URL`), Stripe (secret + publishable +
webhook + most price IDs), `SESSION_SECRET`, `APP_BASE_URL`.
Everything else below is ❌. Most degrade gracefully in dev; the ones that bite
before a real launch are flagged Tier 1.

---

## Tier 1: Launch-critical (need real accounts before going live)

| Service | What it's for | Env vars | Status | Get it at |
|---|---|---|---|---|
| **Supabase Postgres** | The database (all app data). | `DATABASE_URL`, `PGSSLMODE` | ✅ | supabase.com (already the project DB) |
| **Stripe** | All payments: subscriptions, gift checkout, recurring. Effectively un-swappable (see CLAUDE.md). | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | ✅ (test) | stripe.com. For launch: swap to LIVE keys, run `npm run founder:seed-stripe` to mint real products/prices, register the prod webhook endpoint. **Stripe-SENT emails + branding (Dashboard config, audited 2026-06-04 — the code sets NO `receipt_email`/`statement_descriptor`, so ALL of this comes from account settings):** (1) **Statement descriptor** must read KIDDO/KIDDOFUND — it's what a gifter's card statement shows ("what is this charge?" is a refund-risk moment; make sure it doesn't say a legal-entity name or the old "Kora"). (2) **Public business name + icon + brand color** (Settings → Branding) appear on Checkout, receipts, and invoices — verify they say Kiddo. (3) **Customer emails** (Settings → Emails): decide deliberately. Recommended: Stripe receipts ON for successful payments (gifters expect a receipt; ours don't replace it), but Stripe's **failed-payment/dunning emails OFF** — the app ships its own branded 2-stage gifter dunning (14d card-update + 30d cancel) and double-dunning from two senders reads as a scam. (4) **Support email/phone on receipts** → support@kiddofund.com once monitored. |
| **Email (Postmark primary, SendGrid fallback)** | Every transactional email: gift-intent nudge to parents, founder-claim, at-18 handoff, thank-yous, dunning. The gifter loop does not work without this. Falls to a no-op "outbox" when both are absent. | `POSTMARK_SERVER_TOKEN`, `POSTMARK_MESSAGE_STREAM`, `POSTMARK_WEBHOOK_USER/PASS`, (or `SENDGRID_API_KEY`), `EMAIL_FROM` | ❌ | postmarkapp.com (or sendgrid.com). Verify a sending domain. **Go-live gaps found in the 2026-06-03 email audit:** (1) PARENT-facing promotional emails (fund birthday, monthly pulse, anniversary, etc.) send NO List-Unsubscribe header — only gifter emails have unsubscribe tokens. Gmail/Yahoo require RFC 8058 one-click unsubscribe for bulk senders; build a parent unsubscribe token + endpoint and pass `unsubscribeUrl` from each promotional worker before sending real volume (Settings toggles exist; the header/link plumbing doesn't). (2) Make `EMAIL_FROM` a monitored inbox or set a monitored Reply-To — the trusted-contact email (FINRA 4512 outreach) invites replies. |
| **Session secret** | Signs login sessions. | `SESSION_SECRET` | ✅ | Generate a long random string for prod (not the dev value). |

## Tier 2: Important (you'll want these, but they degrade gracefully)

| Service | What it's for | Env vars | Status | Get it at |
|---|---|---|---|---|
| **Market data: Finnhub / Alpha Vantage** | Live stock quotes + daily change. **Now optional**: a keyless Yahoo fallback was added (`server/marketQuotes.ts`), so quotes + the holding "Today" tile work without keys. Keyed providers are just faster / higher rate limits. | `FINNHUB_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `MARKET_QUOTES_REFRESH_MINUTES` | ❌ (Yahoo covers it) | finnhub.io (free tier), alphavantage.co (free) |
| **Supabase Storage** | Memory Book photo/voice uploads. Without it, uploads fall back to local `/uploads` (fine for dev, not for prod scale). | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MEMORY_STORAGE_BUCKET`, `AWS_REGION` | ❌ | supabase.com (same project, Storage section) |
| **Sentry** | Server error tracking + the ops-alert path. Silent (no-op) without a DSN. | `SENTRY_DSN` | ❌ | sentry.io |
| **PostHog** | Product analytics + the k-factor / growth-loop measurement (the core "is there a business" metric). | `POSTHOG_API_KEY`, `POSTHOG_HOST` | ❌ | posthog.com |
| **Plaid** | Bank linking / ACH funding (cheaper than card for large gifts). Keep behind the service layer (CLAUDE.md). Card payments via Stripe work without it. | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | ❌ | plaid.com |
| **Google OAuth** | "Sign in with Google." Email/password works without it. | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ❌ | console.cloud.google.com |
| **Apple OAuth** | "Sign in with Apple" (required by Apple if you ship other social logins in the iOS app). | `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_TEAM_ID`, `APPLE_APP_ID_PREFIX` | ❌ | developer.apple.com |
| **WebAuthn / Passkeys** | Passkey login. Config, not a paid key; set to the prod domain. | `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | ❌ | n/a (set to your domain) |
| **Content scanner (PhotoDNA / moderation)** | CSAM + abuse scanning on uploaded media. Strongly wanted BEFORE public photo/voice uploads (safety + legal). | `CONTENT_SCANNER` | ❌ | Microsoft PhotoDNA / a moderation provider |

## Tier 3: Custody / regulated (the big launch gate, not yet wired)

| Service | What it's for | Env vars | Status | Get it at |
|---|---|---|---|---|
| **DriveWealth (or Alpaca / Apex)** | Custody + brokerage: the real share-buying backend. Today holdings are a local total-return SIMULATION; this is what makes them real. Vendor not yet chosen; keep behind a custodian interface (CLAUDE.md). Gated by this + the legal/RIA memo. | `DRIVEWEALTH_API_KEY`, `DRIVEWEALTH_API_SECRET`, `DRIVEWEALTH_BASE_URL`, `CUSTODIAN_TRANSFER_WEBHOOK_URL/SECRET` | ⚠️ scaffold | drivewealth.com / alpaca.markets / apexfintechsolutions.com |

## Tier 4: Optional / ops / mobile / future

| Service | What it's for | Env vars | Status |
|---|---|---|---|
| **OpenAI** | Whisper auto-transcription of voice notes (feature-flagged off). | `OPENAI_API_KEY` | ❌ optional |
| **Ops alert webhook** | Slack/Discord-style "unhandled API error" pings. | `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_BEARER` | ❌ optional |
| **Apple / Google IAP** | Mobile in-app purchase (Expo app), if subs are sold in-app. | `APPLE_IAP_FEE_RATE`, `GOOGLE_PLAY_FEE_RATE`, `EXPO_APPLE_TEAM_ID` | ❌ future |
| **Android app links** | Verified deep links for the Android app. | `ANDROID_SHA256_CERT_FINGERPRINT(S)` | ❌ mobile |
| **Super-admin allowlist** | Who can reach `/admin`. Set before prod. | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_EMAILS` | ❌ |

## Keyless / no-account dependencies (good to know)
- **Yahoo Finance** (`query1.finance.yahoo.com`): charts (`/api/stock-price`) AND now the keyless quote fallback. No key, public endpoint.
- **Google Fonts**, **TradingView widget**, **YouTube embeds**: front-end only, no key.

## Where these live in code
- Env loading + most server keys: `server/index.ts`, per-service modules.
- Market quotes: `server/marketQuotes.ts`. Email: `server/emailDelivery.ts`.
- Stripe: `server/stripeService.ts` / `server/stripeClient.ts`. Content scan: `server/contentScanner.ts`.
- Bare key template: `.env.example`.
