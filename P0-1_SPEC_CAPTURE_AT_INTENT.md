# P0-1 — Capture money at intent: implementation spec (3 ways)

**Purpose:** make P0-1 mechanical to build the moment counsel answers
`LAWYER_Q_HOLDING_GIFT_FUNDS.md`. Zero design lag — pick the path the lawyer
clears, follow the steps. Grounded in the actual code 2026-05-29.

**Why this is the make-or-break:** the entire counter-positioning moat
(`MOAT_MEMO.md`) rests on near-zero CAC, which rests on a gifter's emotional
moment becoming a *funded* dollar. Today it becomes an email. See
`project_money_at_intent_two_flows`.

---

## 1. The current flow (verified) — and exactly where it leaks

| Step | Code | State |
|------|------|-------|
| Gifter submits `/give-a-gift` | `GiveAGift.tsx` → `POST /api/gift-intents` (`routes.ts:14575`) | `gift_intents` row `status='pending'`, 60-day `expiresAt` (`:14639`). **No card. No PaymentIntent.** Nudge email to parent. |
| Parent creates a matching fund | auto-pair in `POST /api/funds` (`routes.ts:3402-3453`) | intent → `status='paired'`, `fundId` set, `pairedAt` set; "it's paired" email to gifter. **Still no money.** |
| Gifter returns and pays | separate trip through `/:fund` → `POST /api/stripe/checkout/gift` (`routes.ts:11479`) → `handleGiftPayment` → invest | intent → `completed`; money finally lands. |

**The two leaks:**
1. **Pending → never paired:** parent never sets up a fund → gift evaporates at
   60 days; gifter never told.
2. **Paired → never completed:** the gifter has to come *back* and pay in a
   *separate* session days later. Most won't. This is the EarlyBird death.

`gift_intents` schema: `shared/schema.ts:1153-1202`. Existing columns:
`token, gifterUserId, gifterName, gifterEmail, recipientEmail, kidFirstName,
kidBirthdate, amount, message, status, fundId, pairedAt, expiresAt, createdAt`.
States in use: `pending → paired → completed` (+ implicit expired). k-factor
already reads `status IN ('paired','completed')` / `='completed'` (`routes.ts
~17180`) — **any new states below must preserve those two or k-factor goes
blind.**

---

## 2. The three approaches

The thing all three change: **capture the gifter's payment commitment at
`POST /api/gift-intents`**, then settle at the pairing hook
(`routes.ts:3402-3453`) instead of requiring a return trip.

### Option A — Auth-and-hold (Stripe manual capture)
- **Mechanic:** at intent, create a `PaymentIntent` with
  `capture_method: 'manual'` → authorizes (holds) the amount on the card without
  charging. At pairing, `paymentIntents.capture()` → invest via the existing
  `investGiftImmediatelyIfNeeded` path.
- **Pro:** no funds held by us pre-pairing (just a card authorization) → lightest
  regulatory surface.
- **Fatal con:** card authorizations expire in **~7 days** (issuer-dependent).
  Parents routinely take longer than 7 days to set up a fund. After expiry the
  hold drops and the gift fails silently. Only viable for a fast-converting
  cohort, never as the only path.
- **Verdict:** fallback / fast-path only.

### Option B — Charge-and-hold (escrow, invest-or-refund) ⭐ best conversion
- **Mechanic:** at intent, `PaymentIntent` captured **immediately** → funds sit
  as a refundable liability (in our Stripe balance, or — cleaner — a
  segregated/FBO account held by the broker-dealer; **this is the lawyer
  question**). At pairing, invest. If `expiresAt` passes with no pairing, a
  worker issues `refunds.create()` and emails the gifter.
- **Pro:** strongest commitment — the money actually leaves the gifter at the
  emotional moment; closes *both* leaks hardest; best loop conversion.
- **Con:** we (or our BD) hold customer money for an account that doesn't exist
  yet → heaviest regulatory question (money transmission / safeguarding /
  BSA-AML). **Build only if counsel clears a holding structure.**
- **Verdict:** preferred IF the lawyer green-lights an FBO/segregated structure.

### Option C — Vault-and-charge-later (SetupIntent, the hybrid) ⭐ ship-now-safe
- **Mechanic:** at intent, `SetupIntent` saves the gifter's card (no charge) +
  create/attach a Stripe Customer. At pairing, charge **off-session**
  (`PaymentIntent` with `customer` + `payment_method` + `off_session: true`) →
  invest. No expiry-refund needed (nothing was charged); if never paired, just
  let it lapse.
- **Pro:** **we never hold funds** → lightest regulatory path → likely buildable
  *without* waiting on the heavy custody answer. No 7-day limit.
- **Con:** the off-session charge can decline weeks later (expired/insufficient
  card) → needs a dunning retry (reuse the gifter-recurring dunning cascade in
  `recurringContributionWorker.ts ~698-835`). Commitment is slightly softer than
  B (card saved, not yet charged) — mitigate with explicit disclosure: "we'll
  charge this card when {kid}'s fund is ready."
- **Verdict:** the pragmatic launch path; smallest legal dependency.

---

## 3. Decision matrix (pick by the lawyer's answer)

| Lawyer says… | Build |
|---|---|
| "Holding pre-fund funds is fine via BD/FBO account" | **Option B** (best conversion) |
| "Holding funds triggers MTL/safeguarding — avoid" | **Option C** (no funds held) |
| "Either is fine, want fastest to ship" | **Option C** now, B later if conversion needs it |
| (No answer yet, want partial progress) | Build the **shared scaffolding** in §4 — identical for B and C — and stub the capture call |

**Recommendation:** default to **Option C** unless counsel affirmatively clears
holding funds. C closes the leak, carries the least regulatory risk, and reuses
infrastructure we already shipped (Stripe customers, off-session charges,
dunning). Upgrade to B only if measured conversion proves the "card saved but not
charged" softness is costing real gifts.

---

## 4. Implementation steps (shared scaffolding — B and C identical except the capture call)

1. **Schema** (`shared/schema.ts`, hand-write migration per
   `project_drizzle_migration_tooling_gotcha` — NEVER `db:generate`):
   add to `gift_intents`:
   - `paymentStatus text default 'none'` — `none|authorized|captured|charged|refunded|failed`
   - `stripePaymentIntentId text` / `stripeSetupIntentId text`
   - `stripeCustomerId text`
   - `capturedAt timestamp` / `settledGiftId varchar` (FK to gifts) / `refundedAt timestamp`
   - keep `status` semantics intact (k-factor depends on `paired`/`completed`).
2. **Intent creation** (`routes.ts:14575`): after validation/anti-spam, create the
   Stripe object (B: manual-capture or immediate PI; C: SetupIntent + Customer),
   store the id + `paymentStatus`. Return a `clientSecret` so `GiveAGift.tsx` can
   confirm the card inline. Keep the existing nudge email (reword: "your card is
   saved / your gift is reserved" per option).
3. **Client** (`GiveAGift.tsx`): add the Stripe card element + confirm step
   (mirror `GiftCheckout.tsx`'s existing Stripe wiring). The "intent" submit now
   collects a card. Preserve the no-card path ONLY as an explicit "just remind me"
   fallback if desired.
4. **Settlement at pairing** (`routes.ts:3402-3453`, inside the existing
   `for (const intent of matchingIntents)` loop): after `status='paired'`, settle
   the held payment — B: `capture()`; C: off-session charge — then run the
   existing investment path. Cleanest: synthesize the same `metadata` shape
   `handleGiftPayment` builds and route through `completeGiftPostPayment` /
   `investGiftImmediatelyIfNeeded` (`webhookHandlers.ts:132/~576`) so Memory Book
   entry + parent "gift landed" email + milestones all fire exactly as the public
   path. Set intent `status='completed'`, `settledGiftId`, `capturedAt`.
5. **Expiry worker** (B only): extend a worker (pattern:
   `recurringContributionWorker.ts`) to find `paymentStatus='captured' AND status
   != 'completed' AND expiresAt < now`, `refunds.create()`, set
   `paymentStatus='refunded'`, email the gifter. (C needs no refund — nothing
   charged — but should email "we couldn't reserve your gift" if the SetupIntent
   was never used.)
6. **Decline handling** (C): if the off-session charge declines at pairing, set
   `paymentStatus='failed'` and enter the existing dunning cascade
   (`recurringContributionWorker.ts ~698-835`) — "update your card to complete
   your gift to {kid}."
7. **Webhook idempotency:** guard against double-settlement (intent already
   `completed`) the same way `handleGiftPayment` guards on existing PI
   (`webhookHandlers.ts:1194`). Reuse the unpaid-session guard shipped this branch
   (`webhookHandlers.ts:1179`).

---

## 5. Edge cases to cover in tests

- Parent never creates a fund → B refunds at expiry + emails; C lapses + emails.
- Parent creates fund 30 days later → B captures (✅, no 7-day issue); C charges
  off-session (✅); A would already have failed (auth expired).
- Off-session charge declines (C) → dunning, not a silent loss.
- Multiple intents pair to one fund (loop already supports N intents per fund at
  `routes.ts:3419`) → settle each independently.
- Anonymous / no gifter account → C needs a Customer; create one keyed to
  `gifterEmail` (the recurring setup already auto-creates gifter accounts —
  reuse).
- k-factor still reads `paired`/`completed` correctly after the new
  `paymentStatus` column is added.
- Demo accounts: gate real charges off demo per the demo-safety pattern already
  in the handoff email paths.

---

## 6. Test plan

- Unit: settlement-at-pairing helper (B capture / C off-session) → asserts gift
  row created + invested + intent `completed`.
- Extend `test:stripe-pipeline` with an intent→pairing→settlement leg.
- Manual: full `/give-a-gift` (with card) → create matching fund → confirm money
  lands in the fund + Memory Book entry + parent email, with NO second gifter
  trip.
- Regression: `npm run check` (tsc + content lint) + `test:security-regression`.

---

## 7. What NOT to do

- Do not build before the lawyer answers §B-vs-§C unless you deliberately choose
  C as the no-funds-held path (the one that needs the least legal cover).
- Do not remove the warm-promise/no-card path until the captured path is proven —
  keep it as an explicit fallback so a card-shy gifter still nudges the parent.
- Do not inline raw Stripe calls into new files in violation of CLAUDE.md — route
  new payment logic through `stripeService.ts` / `stripeClient.ts` where the
  existing gift checkout already does.
