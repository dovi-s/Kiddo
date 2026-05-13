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

- In Stripe Dashboard, create products/prices used by app:
  - Kiddo Plus monthly and yearly
  - Kiddo Family monthly and yearly
  - Kiddo Occasions one-time
- Run `npx tsx scripts/seed-products.ts` to create or sync test-mode products.
- Copy the printed `STRIPE_PRICE_PLUS_*`, `STRIPE_PRICE_FAMILY_*`, and `STRIPE_PRICE_OCCASION_TOP_UP` values into the environment.
- Configure webhook endpoint:
  - `POST https://YOUR_DOMAIN/api/stripe/webhook`
- Subscribe webhook to:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `invoice.paid`
  - `invoice.payment_failed`
- Put webhook signing secret in `STRIPE_WEBHOOK_SECRET`.

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
