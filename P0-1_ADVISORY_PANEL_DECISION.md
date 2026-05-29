# DECISION MEMO — Capturing the Gifter Dollar at Intent

*Produced by the `advisory-panel` workflow (6 specialist personas → opposing-counsel
cross-examination → synthesis), 2026-05-29. Decision-support, not licensed advice —
see the standing disclaimer at the end. Companion to `P0-1_SPEC_CAPTURE_AT_INTENT.md`
and `LAWYER_Q_HOLDING_GIFT_FUNDS.md`.*

**Re:** Which capture path for the "gifter emotion → funded dollar" leak — and what
can ship before a licensed sign-off

---

## 1. The decision

**Build Option C (vault-and-charge-later via Stripe SetupIntent + off-session charge
at pairing). Yes, it is buildable now — start engineering immediately — but it does
NOT ship to production until counsel returns written answers on two scoped questions
(off-session/MTL classification and disclosure language).** Do not build Option B
until counsel confirms in writing that an FBO/segregated holding structure is
documented with your broker-dealer. Do not ship Option A as the primary path (its
~7-day auth expiry silently fails inside your 10+ day pairing window).

---

## 2. Why

**6 of 6 advisers recommend Option C as the path; consensus is unanimous on the
destination.** Load-bearing reasoning agreed across the panel:

- **Option C never puts Kiddo in control of customer funds.** A SetupIntent saves the
  card; the charge fires off-session at pairing, settling gifter → Stripe (licensed
  acquirer) → Kiddo merchant → custodial account. That is merchant acquiring /
  payment processing, not money transmission or custody — sidestepping the FinCEN MSB
  / state MTL / SEC custody questions that gate Option B.
- **It reuses proven, in-production infrastructure.** `off_session: true` charges and
  the dunning cascade already ship in `recurringContributionWorker.ts` (~L183-201,
  L698-835); settlement reuses `completeGiftPostPayment` / `investGiftImmediatelyIfNeeded`.
  Build is ~1 sprint (8-10 eng hours), not new payment infra.
- **Option B's legal burden is upfront and unresolved; Option A is operationally
  broken.** B requires a written FBO opinion + BD agreement language that does not yet
  exist. A's auth expires before parents typically act.

**The real dissent — and how the chair weighs it.** The panel splits hard on *what
counsel must clear before C ships*, and the synthesis sides with the stricter camp:

- The MTL-AML and consumer-protection advisers argue the "30-minute, parallel,
  non-blocking" disclosure review is **wrong-framed**: regulators define
  transmission/custody by **control over timing and direction of funds**, not physical
  possession. Charging a gifter's card *weeks later, on a trigger the gifter never
  authorizes (the parent's unilateral fund creation), with a 14-30 day retry loop* is
  a genuinely **novel surface** distinct from subscription dunning (which has an active
  contract + upfront ROSCA consent). The GC sharpens it: Option C does not "never hold
  funds" — it **holds the right to charge a conditional future obligation
  indefinitely**, which is the part that may need real review, not boilerplate.
- Securities counsel adds the highest-confidence operational blocker: **the
  broker-dealer's acceptance of multi-gifter third-party funding into a single minor
  UTMA account is an unverified open question.** If the BD's AML team flags a surge of
  small multi-contributor deposits, gifts are charged but orphaned — silent failure of
  the entire acquisition loop.

The chair weighs the strict camp's caution as **decisive for the ship gate but not
the build gate.** The optimists are right that the *code* is safe to build now
(mechanically identical to shipped infrastructure, additive at the schema level). The
skeptics are right that **the conditional-charge model and BD-acceptance are binary
regulatory/operational questions that must be answered in writing before a single
live gifter card is charged.** Build in parallel, gate the production deploy.

---

## 3. ✅ Safe to proceed NOW (before any licensed sign-off) — staging only

All additive, non-destructive, mirrors production code:

- **Schema migration** (hand-written SQL + journal entry per the Drizzle gotcha — NOT
  `db:generate`): add `stripeSetupIntentId`, `stripeCustomerId`, `paymentStatus`
  (`none|setup_pending|setup_confirmed|charged|declined|refunded|expired`), `chargedAt`,
  `settledGiftId`, `failedChargeCount` to `gift_intents`.
- **Intent creation** (`POST /api/gift-intents`): create SetupIntent + Stripe Customer
  (reuse for logged-in gifter, create for anonymous), store IDs, return `clientSecret`.
- **Client** (`GiveAGift.tsx`): add the Stripe card element, mirroring
  `GiftCheckout.tsx`. **Keep the warm "just remind me / no card" path** as an explicit
  fallback for card-shy gifters.
- **Settlement at pairing** (`routes.ts` ~L3402-3453): replace the nudge-email branch
  with confirm-setup → off-session PaymentIntent (`off_session: true, confirm: true`)
  → existing `completeGiftPostPayment` / `investGiftImmediatelyIfNeeded`.
- **Decline + dunning**: reuse the `recurringContributionWorker` cascade (parent not
  told; gifter enrolled in 14-day "update your card" → 30-day cancel).
- **Expiry worker**: at 60 days unpaired/uncharged, delete the SetupIntent + email the
  gifter (no refund — no money was ever held).
- **Webhook idempotency** (reuse the guard at `webhookHandlers.ts` ~L1179-1211) and the
  `isDemoFund()` demo-safety gate.
- **Full audit logging** of every charge attempt and dunning event.
- Integration tests for the whole pipeline.

Build the scaffolding without hard-coding the final consent UI/dunning copy, so
approved language drops in last.

---

## 4. 🔴 Needs a licensed human sign-off before it ships to production

| # | Item | Owner |
|---|------|-------|
| 1 | **Off-session conditional-charge classification (the binary gate).** Does charging a gifter's pre-authorized card off-session at a date set by the *parent's* unilateral action, with 14-30 day retries, trigger FinCEN MSB / state MTL / BSA-AML? Or does Stripe-holds-the-token fully exonerate Kiddo? | **Securities counsel** (already engaged on the AUM brief) |
| 2 | **Point-of-charge disclosure + dunning copy** — clear/conspicuous, pre-submit, covering trigger, timing, retry loop, no-charge-if-unpaired. UDAAP (12 CFR §1026.61), Reg E (§1005.2/.3), ROSCA, EFTA, strictest applicable state UDAP (CA/NY/IL/TX). | **Consumer-protection / payments-compliance counsel** |
| 3 | **Broker-dealer acceptance of multi-gifter third-party funding** into a single minor UTMA account + their source-of-funds/AML procedure for non-parent contributions — confirmed in writing in the BD agreement. **Blocking gate, not pre-ship review.** | **Securities counsel + BD partnership** |
| 4 | **UTMA gift-completion timing** (gift complete/irrevocable at the off-session charge date, not the SetupIntent date; investment-vs-charge timing for kiddie-tax). | **Tax adviser** (confirm) + securities counsel |
| 5 | **Stripe Restricted-Activities notice** — affirmatively tell Stripe Compliance this is *gifting* off-session (not SaaS subscriptions) and get the off-session consent/retry flow confirmed, to avoid mid-launch MID review/termination. | **Payments → Stripe Compliance** (ops, required) |

If #1 returns "you need MTL/MSB," the path stays clear: pursue licensing (3-6 mo) or
downgrade to Option A (auth-only, convert-or-lose, no dunning). If the BD blocks #3,
defer charge-at-pairing or fall back to A until written acceptance exists.

---

## 5. Required disclosure (minimum point-of-charge language for Option C)

Draft floor to send compliance counsel — displayed clear-and-conspicuous **before**
the gifter submits the card, ideally with an affirmative checkbox (a buried text line
likely fails state charge-for-later consent rules):

> **"Your card is saved now but not charged yet.** When **[child]'s** fund is created,
> we'll charge this card for your **$[amount]** gift. If your card is declined, we'll
> remind you to update it and retry over the next 14 days. If no fund is created within
> 60 days, we'll delete your saved card and you won't be charged. You can cancel before
> any charge."

- Name the **trigger** (parent creates the fund), the **timing window** (60 days), the
  **retry loop** explicitly, and the **no-charge-if-unpaired** outcome.
- **Avoid the word "authorized"** where no charge has occurred.
- Obtain consent at card capture, ex-ante — not in the later pairing email.

---

## 6. Open questions to forward to the real lawyer

(These have been merged into `LAWYER_Q_HOLDING_GIFT_FUNDS.md`.)

- Does charging a gifter's pre-authorized card off-session, on a trigger set by a third
  party (the parent), with 14-30 day retries, trigger **FinCEN MSB / state money-
  transmission licensing** — or does Stripe-holds-the-token fully exonerate us? *(Binary
  yes/no with reasoning.)*
- Does our **broker-dealer agreement explicitly document** (a) acceptance of multi-gifter
  funding into a single minor UTMA account, and (b) their source-of-funds/AML procedure
  for non-parent third-party contributions? Will they accept a volume surge of small
  multi-contributor accounts?
- Is there a **written segregated/FBO account structure** in the BD agreement? *(Gates
  Option B only.)*
- Does the **point-of-charge disclosure + checkbox** above satisfy UDAAP (§1026.61),
  Reg E (§1005.2/.3), ROSCA, EFTA, and the strictest state UDAP we touch? Is a checkbox
  required, or does a clear pre-submit notice suffice?
- Does our **dunning retry cadence** require affirmative *re-consent per retry* under
  any state EFT/charge-for-later rule, or is the upfront disclosure sufficient?
- Is the **gift complete (irrevocable) at the off-session charge date**, not the
  SetupIntent date, for UTMA gift-completion and kiddie-tax purposes?
- Does the moment of **"pairing" (intent → fund match)** trigger any custody/disclosure
  change, or is pairing purely an internal milestone (pairing ≠ account opening)?
- For **anonymous gifters**, are there legal-identity/KYC concerns with creating a
  Stripe Customer keyed only to email and charging it off-session weeks later?

---

*Standing disclaimer: This panel is AI decision-support. Its job is to structure the
call, surface the real dissent, and sharpen exactly what to ask a licensed
professional — it is **not** legal, tax, securities, or money-transmission advice, and
it does not create an attorney-client relationship. Nothing here substitutes for a
licensed human's independent judgment, and no item in Section 4 should ship until the
named professional has put their signature on it. Treat the classification conclusions
(especially money-transmission and custody) as hypotheses to be confirmed in writing
by counsel, not as settled law.*
