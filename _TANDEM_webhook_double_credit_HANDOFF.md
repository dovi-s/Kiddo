# ⚠️ TANDEM HAND-OFF — read before wiring embedded-checkout settlement

_From the dashboard/UX agent to the in-app-checkout agent. 2026-06-23._

You're wiring the embedded Payment Element's charge → settlement (so a test charge
becomes a real deposit). **Before you do, verify this — it's the one place the money
math can silently break:**

## The finding
- **`handlePaymentIntentSucceeded` (`server/webhookHandlers.ts` ~line 1849) does NOT
  credit the fund.** It only does: `getGiftByPaymentIntent` → if pending, `updateGift(
  status: 'processing')`. That's the whole handler.
- **The real fulfillment** (creates the transaction, **credits the fund**, calls
  `investGiftImmediatelyIfNeeded` + `reconcileFundFromGifts`) lives in
  **`handleCheckoutCompleted` / `handleGiftPayment`** — gated on
  **`checkout.session.completed`**, i.e. the HOSTED path only.

So the note that "the `payment_intent.succeeded` webhook routes it to
`investGiftImmediatelyIfNeeded`" is **not true as the code currently reads** — that only
happens via `checkout.session.completed`.

## The risk (why this matters)
The embedded flow has **no Checkout Session** → no `checkout.session.completed` → so it
needs `payment_intent.succeeded` to do the full fulfillment. **BUT** in the existing
HOSTED flow, `payment_intent.succeeded` *also* fires (alongside the session event). The
webhook responds to real Stripe events, **not** the client `IN_APP_CHECKOUT` flag. So if
you make `handlePaymentIntentSucceeded` credit the fund, **every hosted gift gets credited
twice** — a live double-credit on a custodial kids'-money account, on real gifts, not
flag-gated.

## The fix
Make the PI-handler fulfillment **guarded to embedded-only**, e.g.:
- Tag the embedded PaymentIntent with `metadata.source = 'in_app'` (or similar) and have
  `handlePaymentIntentSucceeded` fulfill **only** when that tag is present; OR
- Skip PI-fulfillment when the PI has an associated Checkout Session (hosted), so only the
  no-session (embedded) PIs fulfill via the PI path.
- Keep it **idempotent** (a redelivered event must not re-credit) — mirror the existing
  `existingTx` / `getGiftByPaymentIntent` guards in `handleCheckoutCompleted`.

## The test (must pass before flipping the flag in any prod-like env)
Stripe **test mode** + `stripe listen --forward-to localhost:5000/api/stripe/webhook`:
1. One **hosted** gift → fund credits **exactly once** (no regression).
2. One **embedded** gift → fund credits **exactly once** (new path works).
3. A redelivered `payment_intent.succeeded` → **no** second credit (idempotent).
4. Refund → reverses correctly (the `charge.refunded` path already does this).

— Also FYI (already shipped, compatible with your work, no overlap):
`client/src/lib/last-gift.ts` (returning-gifter "give again" prefill) +
`client/src/lib/last-auth-method.ts` (login "last used" badge). Your one-tap checkout +
my prefill = the full returning-gifter speed-up.
