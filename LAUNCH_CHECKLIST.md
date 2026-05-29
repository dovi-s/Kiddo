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
