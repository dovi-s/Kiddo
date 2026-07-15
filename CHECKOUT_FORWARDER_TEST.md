# In-App Checkout — Forwarder Test (the 4-case settlement gate)

Run this BEFORE flipping `IN_APP_CHECKOUT` in any prod-like env. It verifies the
embedded gift checkout settles money **exactly once** and never double-credits the
hosted path. See `CHECKOUT_IN_APP_SPEC.md` (the metadata contract) and the guard in
`server/webhookHandlers.ts` `handlePaymentIntentSucceeded` (fulfills only when
`metadata.source === 'in_app'` AND a `fundId` is present; reuses the idempotent
`handleGiftPayment`).

## Setup (one time)
1. **Stripe CLI:** `stripe login` (auths to your Stripe TEST account).
2. **Forward webhooks to dev:**
   `stripe listen --forward-to localhost:5000/api/stripe/webhook`
   Copy the `whsec_...` it prints into `.env` as `STRIPE_WEBHOOK_SECRET` so the dev
   server verifies the forwarded events, then restart dev.
3. **Enable the flag in dev `.env`:** `IN_APP_CHECKOUT=true` + `VITE_IN_APP_CHECKOUT=true`.
4. **Use a REAL (non-demo) fund.** The demo (Rivera) fund short-circuits upstream and
   never creates a charge — confirmed. Create or use a non-demo fund.
5. **The wiring caveat:** the embedded gift PI only *settles* once the real in-app
   deposit flow passes the full metadata contract (fundId, isParentContribution,
   fundUserId, amounts, executionModel — see the spec's contract table). The
   `/checkout-preview` demo deliberately carries none, so it no-ops by design.

## The 4 cases (Stripe TEST mode; the embedded element's dev toolbar has Magic Fill / 4242)
1. **HOSTED gift credits ONCE** (regression guard)
   - Send a gift the hosted way (flag off) → complete with `4242`.
   - PASS: fund balance rises by the net gift exactly once; one gift row, one gift
     transaction. Hosted must be unaffected by the new branch.
2. **EMBEDDED gift credits ONCE**
   - Flag on → the gift opens the in-app modal → pay with `4242`.
   - PASS: one gift row with `source = 'in_app'`, one transaction, fund credited once.
3. **REDELIVERED event → NO double credit**
   - Resend the embedded `payment_intent.succeeded` (the `stripe listen` terminal, or
     Stripe Dashboard → Developers → Webhooks → resend).
   - PASS: no second gift/transaction; balance unchanged (idempotent via
     `getGiftByPaymentIntent`).
4. **REFUND reverses**
   - Refund the embedded charge (Stripe Dashboard → the PaymentIntent → refund).
   - PASS: gift → `refunded`, fund balance drops by the credited amount (the existing
     `charge.refunded` handler; only reverses a gift that was actually credited).

## Pass criteria
All four hold. THEN — and only then — flip `IN_APP_CHECKOUT` in a prod-like env.

## Re-check the invariant after testing
`npm run test:stripe-pipeline` → **`gift_tx_without_gift` must stay `0`** (no orphaned
credits) and no duplicate gift/transaction for any single PaymentIntent. A double-credit
bug surfaces as two gift rows or two `gift` transactions sharing one
`stripe_payment_intent_id`.
