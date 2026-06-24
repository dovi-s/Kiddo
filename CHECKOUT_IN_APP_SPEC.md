# In-App Checkout Spec — embedded payment, saved methods, native Apple Pay

**Goal:** move every payment *into* the app. Add a method once → every charge after
is one tap, in-app, never re-entered — the Acorns / Cash App / Uber bar. Replace the
hosted-Stripe redirect (`window.location.href = session.url`) with Stripe's **embedded
Payment Element + native Apple/Google Pay + a saved method on a Stripe Customer.**

**Scope discipline (per CLAUDE.md):** Stripe coupling is accepted but must not grow in
`routes.ts`. Every new Stripe SDK call lives in `server/stripeService.ts`; route
handlers call a service method, never `stripe.*` directly.

---

## Where we are today (the friction, grounded)
- Hosted Checkout Sessions: `stripeService.ts:200` (`mode:'setup'`) + `:444`
  (`mode:'payment'`); the client **redirects out** (`GiftCheckout.tsx:1197`).
- The in-app method picker (`apple_pay | card | cashapp | paypal | bank`) only
  *configures* the hosted page — there is no native Apple Pay sheet, no in-app card
  field, no saved card.
- **Already built (reuse, don't rebuild):** `getOrCreateCustomer`,
  `createGifterCardSetupCheckout` (SetupIntent vault), `chargeGifterOffSession`,
  `detachGifterSavedCard`. The vault-and-charge rail exists.

## The two charge types — they decide sequencing (and legal exposure)
| Type | Example | Compliance | When |
|---|---|---|---|
| **On-session, user-present** | Parent taps "Deposit $50" → saved card charges *now* | **Low** — user authorizes each charge live | **Build now, no legal gate** |
| **Off-session, charge-later** | Gifter capture-at-intent; recurring auto-pull | Higher — money-transmission / Reg-E (advisory-panel P0-1 gates) | **Counsel-gated** (`COUNSEL_ENGAGEMENT_PACKET`) |

Ship **on-session/parent first** — biggest seamless win, zero legal sign-off — then
layer off-session as counsel clears it. Both reuse the *same* vaulted method.

---

## Phase 1 — On-session embedded deposit (no legal gate)

**Client deps:** `@stripe/stripe-js` + `@stripe/react-stripe-js` (not yet installed).
**Flag:** `IN_APP_CHECKOUT` (client + server), default **off**; hosted Checkout stays
the live path until this flips.

**Server (`stripeService.ts` — new methods, routes just call them):**
1. `getOrCreateCustomer(email, name, userId)` — already exists; ensure every
   user/gifter has a Customer.
2. `createDepositPaymentIntent({ customerId, amountCents, metadata })` → a PaymentIntent
   with `setup_future_usage: 'off_session'` (vaults the method for next time) +
   `automatic_payment_methods: { enabled: true }` (Apple/Google Pay/Link/card auto).
   Returns `client_secret`.
3. `listSavedPaymentMethods(customerId)` → for the "pay with •••• 4242 / Apple Pay"
   one-tap UI.
**Routes:** `POST /api/checkout/payment-intent` (auth'd, on-session) → calls (2).
`GET /api/checkout/payment-methods` → calls (3). No raw `stripe.*` in `routes.ts`.

**Client component (`<InAppCheckout>`):**
- `<Elements stripe={loadStripe(pk)} options={{ clientSecret }}>` wrapping
  `<PaymentElement>` (renders card/Apple Pay/Link in Stripe's iframe → **PCI stays
  SAQ-A**, we never touch raw card data).
- Native wallet: the Payment Element auto-surfaces the **Apple/Google Pay** express
  button at the top when the device supports it → Face-ID one-tap, no typing.
- `stripe.confirmPayment({ elements, redirect: 'if_required' })` — stays in-app for
  cards/wallets; only redirects for rails that truly require it (some bank flows).
- **Returning user:** if `listSavedPaymentMethods` is non-empty, default to "Pay with
  •••• 4242" + a one-tap confirm; "Use a different method" reveals the full element.

**Apple Pay prerequisite (ops, one-time):** register the production domain in the
Stripe Dashboard + serve `/.well-known/apple-developer-merchantid-domain-association`.
Apple Pay only renders on HTTPS + verified domains (won't show on localhost).

**Done = ** parent's first deposit: Apple Pay tap *or* one card entry (vaulted);
every deposit after: one tap, no redirect, no re-entry.

## Phase 2 — Returning gifter one-tap (low/medium)
Gifters have no account, so recall the method by **Stripe Link** (email-based) — the
Payment Element offers Link autofill natively. Grandma's 2nd gift: enter email → Link
fills the card → one tap. (Still on-session — she's present.) No account required.

## Phase 3 — Off-session magic (counsel-gated, reuse P0-1)
- **Capture-at-intent:** vault at the emotional moment (`mode:'setup'` exists),
  `chargeGifterOffSession` when the fund is created. Gated on the P0-1 counsel answers.
- **Recurring:** already Stripe subscriptions (auto-charge after setup ✓) — just move
  the *setup* into the embedded element so there's no redirect to start it.

---

## Migration / safety
- **Flag-gated, additive.** Hosted Checkout remains the default + fallback until
  `IN_APP_CHECKOUT` flips per surface. No big-bang cutover.
- **PCI unchanged.** Payment Element is a Stripe-hosted iframe → SAQ-A, same minimal
  scope as hosted Checkout. We never see card numbers.
- **Idempotency** on every PaymentIntent (reuse the `idempotencyKey` pattern already in
  `chargeGifterOffSession`).
- **Settlement — the double-credit trap (corrected per `_TANDEM_webhook_double_credit_HANDOFF.md`).**
  Today the fund is credited ONLY by `handleCheckoutCompleted` (gated on
  `checkout.session.completed`, the HOSTED path). `handlePaymentIntentSucceeded` does
  NOT credit — it just flips the gift to `processing`. The embedded flow has **no
  Checkout Session**, so it must fulfill via `payment_intent.succeeded`. BUT that event
  ALSO fires on hosted gifts → if you make the PI handler credit unconditionally, **every
  hosted gift double-credits** (real custodial money, NOT flag-gated). **Fix:** the PI
  handler fulfills ONLY when `metadata.source === 'in_app'` (now tagged on both embedded
  PIs) **and** is idempotent (mirror the `existingTx` / `getGiftByPaymentIntent` guards).
  **Must-pass test** (Stripe test mode + `stripe listen --forward-to .../api/stripe/webhook`):
  (1) hosted gift credits once, (2) embedded credits once, (3) redelivered event → no
  second credit, (4) refund reverses. Do NOT flip the flag in a prod-like env until all 4 pass.
- **Verification reality:** a real charge can only be confirmed against Stripe **test
  mode with a test card** (`4242…`) + Apple Pay on a verified domain — so the prototype
  needs a founder-driven test pass; the UI/element render is verifiable locally, the
  actual charge is not.

### The metadata contract (what the in-app PI MUST carry to fulfill)
The guarded branch in `handlePaymentIntentSucceeded` adapts the PI into a session and
calls the proven `handleGiftPayment`, which builds the gift/contribution **purely from
`metadata`** (`webhookHandlers.ts` ~1327). The PI creators already pass `...params.metadata`
through verbatim — so settlement is staged the moment the *real* deposit flow provides
these fields (the `/checkout-preview` demo carries none → the branch safely no-ops):

| Field | Required | Notes |
|---|---|---|
| `source` | ✅ | **`'in_app'`** — dual purpose: the double-credit GUARD *and* the `gifts.source` column. Hosted gifts carry `'web'`/`'mobile'`, so this cleanly distinguishes them. |
| `fundId` | ✅ | target fund; the branch also requires this to fire. |
| `isParentContribution` | parent deposits | `'true'` → parent contribution (no auto Memory-Book entry); absent/`'false'` → a gift. |
| `fundUserId` | ✅ (parent) | owner userId, for activity rows. |
| `senderName`, `senderEmail` | ✅ | depositor identity (the parent, for contributions). |
| `baseAmount`, `netToFund` | recommended | dollar strings; fall back to `amount_total/100` if absent, but pass explicitly to avoid fee drift. |
| `processingFee`, `koraFee` | optional | default `'0'`. |
| `executionModel` | optional | `auto` \| `pick` \| `family`. |
| `selectedTicker`, `eventId`, `message`, `parentContributionId`, media (`photoUrl`/`videoUrl`/`audioUrl` or `mediaToken`), `isAnonymous` | optional | same semantics as the hosted gift checkout. |

**Mapping task = make the real in-app deposit caller set these** (mirroring the hosted
parent-contribution checkout's metadata). Then run the 4-case `stripe listen` test before
any flag flip. Until then the branch is inert (no PI in the wild carries `source:'in_app'`
+ a `fundId` except a deliberately-constructed test charge).

## Sequencing (highest ROI first)
1. **Phase 1 on-session embedded + Apple Pay (parent deposits)** — biggest leap, no gate.
2. **Phase 2 Link** for returning gifters.
3. **Phase 3 off-session** (capture-at-intent + recurring setup) as counsel clears.

The whole thing is one architecture: **Customer + saved method + embedded element**,
shipped on-session first, off-session layered behind the existing legal gates.
