# Kiddo Deployment Checklist

## 1) Secrets and Keys (Must Do First)

- Rotate all exposed secrets before launch.
- Create a fresh `.env` from `.env.example`.
- Set:
  - `DATABASE_URL`
  - `SESSION_SECRET` (long random string, 32+ chars)
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `APP_BASE_URL` (your production URL)
  - `POSTMARK_SERVER_TOKEN` or `SENDGRID_API_KEY` for production email

## 2) Database

- In Supabase, get the Postgres URI from:
  - Project Settings -> Database -> Connection string (URI)
- Use pooled or direct URI with SSL enabled.
- Put it in `DATABASE_URL`.
- Apply checked-in migrations:
  - `npm run db:migrate`

## 3) Stripe Setup

Do this in **TEST** mode first to validate end-to-end, then repeat in **LIVE**.

**A. Products + prices — run BOTH seed scripts (both are required, both idempotent):**
- `npx tsx scripts/seed-products.ts` — the regular plans (Plus $3.99/$29, Family
  $6.99/$59, Occasion top-up). Copy the printed `STRIPE_PRICE_PLUS_*`,
  `STRIPE_PRICE_FAMILY_*`, `STRIPE_PRICE_OCCASION_TOP_UP` into the environment.
- `npm run founder:seed-stripe` — the founder-lock products ("Kiddo+ Founder Annual"
  $19/yr, "Kiddo Family Founder Annual" $59/yr). **Without this, founding-member
  checkout has no price to route to.**
- Prices come from `shared/monetization.ts`; if you change a price there, re-run the seeds.

**B. Webhook — subscribe to ALL NINE events the handler processes (`webhookHandlers.ts:1043-1069`):**
- Endpoint: `POST https://YOUR_DOMAIN/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `customer.deleted`, `payment_intent.succeeded`,
  `payment_intent.payment_failed`, `charge.refunded`, `invoice.paid`,
  `invoice.payment_failed`.
  ⚠️ The prior list omitted **`customer.deleted`** — without it the account-deletion
  cascade (`handleCustomerDeleted`) never fires.
- Put the signing secret in `STRIPE_WEBHOOK_SECRET`. **REQUIRED in prod:** if unset,
  webhook verification is disabled (spoofable money events) or the handler throws
  (`env.ts` marks it optional; `index.ts:234` warns). Same shape as the CSRF gotcha.

**C. Go LIVE:**
- ⚠️ **Account ownership first.** The current Stripe is a PERSONAL account. Do NOT go
  live on it. A regulated kids'-investing platform moving real gift money must run
  Stripe under the **company entity** (LLC/C-corp + EIN) and be owned via **ops@**, not
  a personal email/SSN. Pre-launch (test mode, no real charges) is the easiest time to
  fix this. Cleanest path: once the entity + EIN exist, **create a fresh Stripe account
  under ops@ + the entity and re-run the two seeds** (idempotent — they recreate all
  products/prices, so nothing material is lost; test data is disposable). Or convert the
  existing account (Settings → Business details → entity + EIN; add ops@ as owner; Stripe
  support assists with owner transfer). Same rule for every money/infra vendor
  (custodian, registrar, hosting). The COMPANY ENTITY is the real prerequisite — it's
  also needed for the custodian's KYB.
- Swap to LIVE keys (from the company/ops@ account): `STRIPE_SECRET_KEY`,
  `STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`.
- Re-run BOTH seeds against the live account and register the LIVE webhook (its own
  signing secret). `npm run founder:seed-stripe` only makes the $19 lock real once run
  in live.

**D. Stripe Dashboard config (the app sets none of this; it all comes from account
settings — audited 2026-06-04):**
- **Statement descriptor** → KIDDO / KIDDOFUND (what a gifter's card shows; a confusing
  descriptor is a refund/chargeback risk — not a legal-entity name, not "Kora").
- **Public business name + icon + brand color** (Branding) → verify they say Kiddo
  (they appear on Checkout, receipts, invoices).
- **Customer emails** (Settings → Emails): **receipts ON** (gifters expect one),
  **failed-payment/dunning OFF** (the app ships its own branded dunning; two senders
  reads as a scam).
- **Support email on receipts** → support@kiddofund.com (once monitored).

## 4) App Build and Runtime

- Install deps: `npm install`
- Type check: `npm run check`
- Build: `npm run build`
- Start prod: `npm start`

## 5) Health and Admin Ops Verification

- Check API health:
  - `GET /api/health`
  - `GET /api/health?deep=1`
  - `GET /api/status`
- Admin dashboard:
  - Verify system health cards load.
  - Verify recent webhook events table loads.
- Confirm failed webhooks display clearly.
- Configure `ALERT_WEBHOOK_URL` so critical health/webhook failures notify your ops channel.

## 6) Security Baseline

- Confirm `SESSION_SECRET` is set in prod.
- Confirm HTTPS-only deployment.
- Confirm secure cookies in production.
- Confirm login lockout works after repeated failures.
- Confirm rate limits apply on auth and checkout endpoints.
- Confirm Content Security Policy allows Stripe and Plaid, but does not allow broad script or frame origins.

## 7) Financial Partner Boundaries

- Plaid:
  - Set `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` before enabling real bank linking.
  - Confirm access-token vaulting or provider handoff is production-ready before ACH pulls.
- DriveWealth:
  - Set `DRIVEWEALTH_API_KEY`, `DRIVEWEALTH_API_SECRET`, and `DRIVEWEALTH_BASE_URL` before direct brokerage calls.
  - Confirm UTMA account creation, trade execution, settlement, tax documents, AUM fee, and float revenue-share behavior in partner paperwork.
- Custodian transfer:
  - Set `CUSTODIAN_TRANSFER_WEBHOOK_URL` and `CUSTODIAN_TRANSFER_WEBHOOK_SECRET` before age-18 handoff operations go live.

## 8) Critical Payment Flow Tests (Before Public Launch)

- Gift checkout with cover fees ON/OFF.
- Verify webhook creates/updates gift state correctly.
- Verify idempotency by replaying the same webhook event.
- Subscription purchase -> upgrade state in app.
- Subscription cancellation/reactivation flow.

## 9) Final Go/No-Go

- `npm run check` passes.
- `npm run build` passes.
- `npm run test:smoke` passes.
- `npm run test:launch-readiness` passes, or any failure is explicitly accepted as a non-launch external boundary.
- Database migrations applied.
- Stripe webhook verified end-to-end.
- Admin `/api/admin/webhooks` shows processed events.
- No placeholder keys in environment.
