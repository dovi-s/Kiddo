# Launch Checklist — the moat is fiction until these are true

Operationalizes §6 of `MOAT_MEMO.md`. Every item is grounded in the actual code
as of 2026-05-29 (verified, not historical). Priorities: **P0** = the moat
literally doesn't work without it; **P1** = launch-day credibility; **P2** =
compounds the moat over time.

---

## P0-1 — Capture money at the moment of intent (the make-or-break)

**The finding (verified):** there are TWO gifter entry points and they behave
oppositely.

| Flow | Path | Card captured? |
|------|------|----------------|
| Public gift link | `GiftCheckout.tsx` → `POST /api/stripe/checkout/gift` (`routes.ts ~11479`) → `handleGiftPayment` (`webhookHandlers.ts ~1116`) | ✅ **Yes**, immediately at Stripe Checkout. Money is invested within ~1s (`investGiftImmediatelyIfNeeded`, `webhookHandlers.ts ~576`). This path is correct — don't touch it. |
| `/give-a-gift` intent | `GiveAGift.tsx` (submit ~line 67) → `POST /api/gift-intents` (`routes.ts ~14567`) | ❌ **No.** Creates a `giftIntents` row `status='pending'` (`~14645`), emails the parent, 60-day expiry (`~14631`). **No card. No PaymentIntent. The server comment says so: "V1 is warm-promise: no card charged at intent creation."** |

**Why this is the whole ballgame:** the entire counter-positioning moat rests on
near-zero CAC, which rests on the gifter's *emotional moment* converting to a
*funded dollar*. In the `/give-a-gift` path it converts to an email. If the
parent never acts, the gift evaporates and **the gifter never learns it didn't
happen.** That is precisely the EarlyBird failure mode.

**Why it's not a one-line fix (the real decision):** you can't invest into a fund
that doesn't exist yet — the parent hasn't set one up. So capturing money at
intent means *holding* it. Options:

- **(A) Auth-and-hold** (Stripe manual-capture PaymentIntent): place a hold at
  intent, capture when the parent creates the fund. ❌ Card auths expire in ~7
  days — most parents will be slower. Too fragile alone.
- **(B) Charge now → hold as gift credit → invest on fund creation, auto-refund
  if the parent doesn't act within N days.** The money is genuinely committed at
  the emotional moment; gifter gets "you're done." ✅ Closes the leak. ⚠️ You are
  now holding customer money for an account that doesn't exist yet — a custody /
  regulatory question that **couples this ticket to P0-2 (custody + legal).**
- **(C) Hybrid:** keep warm-promise as a fallback, but make (B) the default and
  only fall back to email-intent if the card step is abandoned.

**Decision needed (founder + lawyer):** can we hold pre-fund gift money, and for
how long before auto-refund? That answer picks A/B/C. **Recommend B**, gated on
the legal memo. Reuse the existing `giftIntents` table, anti-spam guards, and
60-day expiry plumbing — only the payment capture + a held-funds state are new.

**Done when:** a gifter completing `/give-a-gift` has been *charged* (or
explicitly, deliberately chosen a no-charge reminder), and there is a state
machine: `captured → invested-on-fund-creation` OR `captured → auto-refunded
after N days`.

**Implementation-ready:** the full 3-way build spec (auth-hold / charge-and-hold /
vault-and-charge-later) with schema deltas, the settlement hook at the pairing
point (`routes.ts:3402`), the expiry/dunning worker, edge cases, and a
lawyer-answer→which-option decision matrix is in `P0-1_SPEC_CAPTURE_AT_INTENT.md`.
The moment counsel answers `LAWYER_Q_HOLDING_GIFT_FUNDS.md`, building is
mechanical. Default recommendation: **Option C (vault-and-charge-later)** — no
funds held, lightest legal dependency — unless the lawyer affirmatively clears
holding funds, then **Option B** for best conversion.

---

## P0-2 — Custody + legal live

Every moat in the memo is gated on actually holding a dollar, and **P0-1 above
now depends on it too** (holding pre-fund gift money is a custody question).
Status from project memory: vendor pick (Alpaca/DriveWealth/Apex) **not settled**;
AUM regulatory memo **not in hand**. This is the #1 external unblock — nothing
launches without it. (See `project_custodian_split_unresolved`,
`project_aum_lawyer_engagement_brief`.)

**Done when:** custodian wired behind the `custodianService` interface (per
CLAUDE.md provider rules) + lawyer's 2–3 page AUM memo received.

**⚠️ Before sending the counsel packet (`COUNSEL_ENGAGEMENT_PACKET.md`) — don't
forget:** confirm the broker-dealer / DriveWealth status. The packet now defaults to
the safe framing ("prospective leading candidate, no agreement executed, vendor not
finalized"), so forgetting can't overstate to counsel — but if a BD has actually been
selected or an agreement executed, upgrade the wording per the packet's pre-send
checklist item 1 (Option B + Q3 + the attachment). This is the **one founder fact the
packet cannot self-verify**, so it lives here too.

---

## P1-3 — Don't credit/activate on an UNPAID session — ✅ SHIPPED 2026-05-29

**Correction to the original audit:** the audit claimed "a declined card creates a
gift row and activates the fund." That's **false** for the card flow — the gift
row is created inside `handleGiftPayment` (`webhookHandlers.ts ~1179`), which only
runs on `checkout.session.completed`, and for cards that webhook fires *after*
payment succeeds. A declined card never completes the session. Verified by reading
the code, not the audit. (And activation on `status='pending'` is fine: in this
flow `pending` already means money captured — gifts go paid → `pending` →
`invested` within ~1s.)

**The real, narrower gap (now fixed):** `handleGiftPayment` did not check
`session.payment_status`. Stripe fires `checkout.session.completed` with
`payment_status='unpaid'` for delayed/async methods (ACH, bank debits), and there
is no `async_payment_succeeded` handler — so an unpaid session would have created
*and invested* a gift, crediting a fund and firing the "your gift just landed"
email for money not yet received.

**Fix shipped:** added a strictly-additive guard at the top of `handleGiftPayment`
that returns early when `payment_status` is explicitly a non-paid value (anything
other than `paid` / `no_payment_required`). Cards always complete `paid`, so the
normal flow is untouched. Typecheck + content lint green.

**Follow-up (P2, optional):** if async payment methods are ever enabled on the
gift checkout session (`POST /api/stripe/checkout/gift`, `routes.ts ~11479`), add a
`checkout.session.async_payment_succeeded` handler so those gifts resolve once the
bank payment clears.

---

## P1-4 — Turn on the monetization that's currently inert

All verified-inert in project memory; launch-day hygiene — the moat is moot if we
can't charge:
- **Reverse trial defaults OFF** (`reverseTrialEnabled`, `routes.ts ~3427` /
  `monetization.ts ~194`) while pricing advertises "14 days of Plus free." Either
  `setReverseTrialEnabled(true)` in prod + verify a fresh signup gets
  `trial_active`, or soften the copy. (`project_reverse_trial_off_by_default`)
- **AUM fee is display-only** — correct pre-custody; do NOT build a collector now.
  Collection design is locked in `AUM_FEE_COLLECTION_SPEC.md`.
  (`project_aum_fee_display_only`)
- **Founder Stripe products inert** until `npm run founder:seed-stripe` is run.
  (`project_founding_member_claim_flow_spec`)
- **`STRIPE_WEBHOOK_SECRET` MUST be set in production.** Webhook signature
  verification + idempotency are built correctly (`webhookHandlers.ts:1010-1023`,
  `constructEvent` + `onConflictDoNothing` on `stripeEventId`), but the secret is
  `.optional()` (`env.ts:31`) and `index.ts:234` warns "verification disabled" if
  unset. Unset in prod = either spoofable money webhooks or a throwing handler.
  Same shape as the CSRF deploy gotcha. Verify it is set before launch.
  **And the endpoint itself must exist:** create a LIVE-mode webhook in the Stripe
  dashboard pointed at the prod domain + `/api/stripe/webhook`, subscribed to the 9
  events the handler processes (`webhookHandlers.ts:1043-1067`):
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `customer.deleted`, `payment_intent.succeeded`,
  `payment_intent.payment_failed`, `charge.refunded`, `invoice.paid`,
  `invoice.payment_failed`. Then set `STRIPE_WEBHOOK_SECRET` to THAT endpoint's
  signing secret. Do NOT aim it at an ephemeral dev host: a test-mode endpoint
  pointed at an old Replit URL got auto-disabled after 9 days of 404s (2026-05,
  harmless in test mode, but the live equivalent is silent billing + gift-settlement
  failure with no error). For dev, use `stripe listen --forward-to <url>/api/stripe/webhook`.
- **Failed-payment behavior (dunning).** `past_due` now KEEPS Plus access through
  Stripe's retry window (`hasEntitlementFromStatus`, fixed 2026-06-12) and a
  `payment_failed` nudge fires in-app (`actionItems.ts:146`). The remaining gap is
  the EMAIL: dunning / card-failed / renewal-receipt emails depend on the
  unconfigured email provider (the launch-critical email gap). Wire the
  card-failed email when email goes live — it is the highest-value transactional.
- **Sales tax on subscriptions (verify).** No Stripe Tax wiring found in the
  pricing sweep. US SaaS subscriptions are taxable in some states; minor pre-scale,
  but confirm the posture (enable Stripe Tax or document why not) before scaling.
- **Upgrade-overlap filter misses `past_due` (minor, pre-existing).** When a parent
  upgrades to Family/Legacy, the filter that schedules their old Plus subs to cancel
  (`webhookHandlers.ts:1432` / `:1530`) only includes `active` + canceled-in-period,
  NOT `past_due`. A Plus sub mid-dunning would not be auto-scheduled to cancel, so if
  its retry later succeeds the parent could be briefly double-billed (Plus + Family).
  Low severity, rare. Fix = mirror `hasEntitlementFromStatus` (add `past_due`) in that
  filter. Touches the recurring-precharge webhook area, so coordinate before editing.

### Transactional email program — the full set (all gated on the email provider)

Mapped 2026-06-12 from a competitor-email sweep (Acorns/Prime Video/Amazon/Progressive/
Canva). The provider (Postmark/SendGrid) is the launch-critical gate; templates are
being built ahead of it. State:
- **BUILT:** gifter gift receipt (`gift_receipt_followup`), recurring-contribution
  pre-charge heads-up (`sendPrechargeNotice`), monthly relationship digest
  (`monthlyPulse`, now names + a note), cancellation confirmation
  (`templates/subscriptionCanceled.ts` — template only, trigger pending its
  downgrade-guard).
- **GAP — failed-payment / dunning:** the single highest-value transactional; wire
  first when email goes live (see the dunning item above).
- **GAP — parent subscription receipt** (the Canva email): a parent charged $29/$59
  should get a receipt. Default to **Stripe's built-in receipt emails** (a dashboard
  config, no custom template) unless a branded one is wanted. Decide + enable.
- **GAP — annual auto-renewal advance reminder (COMPLIANCE, not just nicety):** an
  annual Kiddo+ that auto-renews likely **requires** advance notice under California's
  Automatic Renewal Law + the FTC negative-option / "click-to-cancel" rule. No renewal
  reminder exists. Counsel should confirm the required cadence + content; then build the
  template. Add to `COUNSEL_ENGAGEMENT_PACKET.md`.
- **NOT ours:** regulatory shareholder comms (prospectus/annual-report/proxy) are the
  rented BD partner's job, not Kiddo's (see `BUSINESS_STRUCTURE.md` checklist #7).

---

## P2-5 — Drive frequency (frequency is a moat *input*)

A birthday-only product is seasonal and dies. Recurring + multi-occasion + "just
because" turns a once-a-year card into a habit — and every extra gift fills the
Memory Book, which *is* the switching-cost reinforcer (`MOAT_MEMO.md §2`).

**Verified 2026-05-29: gifter recurring is already SHIPPED, not an open build.**
The old "3–5 dev days remaining" note was stale. Full stack is live and
typecheck-clean: setup (`GiftCheckout.tsx`), full management — pause/resume/
edit/cancel/history — (`GifterDashboard.tsx ~688-939`), 7 server endpoints
(`routes.ts ~5278-5616` + setup `~11767`), worker + dunning
(`recurringContributionWorker.ts`), and the Bucket-4b copy was restored to the
strong framing (`parentHandoffRecurring.ts:94`). **Remaining is polish only**:
recurring management is web-only (no mobile surface — the one real gap, non-
blocking); edit-frequency-only UX; no batch ops / CSV export. None gate launch.
This box is effectively DONE.

---

## P2-6 — Name and exploit the under-used assets (`MOAT_MEMO.md §5`)

Not code tickets yet — strategy/sequencing to put on the roadmap:
- **The 18-handoff as a CAC-free acquisition** of the most expensive demographic
  in fintech. Build the kid-2.0 adult tier so the handoff *converts* instead of
  just transferring.
- **Embedded registry distribution** (Babylist) — the Cornered Resource to build;
  needs the `partnerSource` attribution primitive.
  (`project_babylist_integration_plan`)
- **The gift graph** as a relationship dataset powering life-event prompts.

---

## What you can stop worrying about

- **k-factor is real, not vanity.** `/api/admin/k-factor` counts only paid gifts
  into funded funds; strict-k requires gifting another family first, then owning a
  funded fund. It's the trustworthy "is the loop compounding" number. Don't
  rebuild it — just watch it once P0-1 and P0-2 are live and there's real traffic.
