# Tactical retention — spec (gaps + build plan)

> Patrick Campbell's claim: **25–40% of churn is "tactical"** — payment
> failures, dunning, card expiry, cancellation flow — and product teams miss it
> because they're focused on strategic retention (features, ICP, roadmap).
> Audited Kora 2026-05-31. Kora already has *more* than expected; this spec is
> the **real gaps**, grounded in files, and honors the locked anti-dark-pattern
> stance (`project_cancellation_dark_pattern_avoidance.md`) + the emotional
> brand. Pairs with `BOOTSTRAP_VS_FUND.md` §5 (support-as-moat).

---

## What already exists (don't rebuild)

- **Gifter-recurring dunning cascade** — `recurringContributionWorker.ts:698`:
  `pause_reason='payment_failed'` → retries → `payment_failed_cancelled` +
  dunning email. (Decision B, locked 2026-05-21.)
- **`payment_failed` action item** — `actionItems.ts:146`: surfaces a sub in
  `past_due / unpaid / incomplete` as a snoozable in-app todo.
- **Webhooks** — `webhookHandlers.ts:1041` (`payment_intent.payment_failed`) +
  `:1050` (`invoice.payment_failed`) handled.
- **Cancellation-impact** — `routes.ts:21670` `/api/subscription/cancellation-impact`
  shows what the parent loses before they cancel.
- **Anti-dark-pattern stance** — `routes.ts:8711`; sub cancels `at_period_end`
  so access is kept through the paid period (`auth.ts:1455`).

**Takeaway:** the gifter-recurring side and the in-app payment-failure surfacing
are solid. The gaps are on the **parent subscription** side and on **capturing
the churn signal**.

---

## Gaps

### G1 — Parent-subscription dunning EMAIL sequence  *(launch must-have)*
`past_due` surfaces as an in-app action item, but there's no proactive
**multi-touch email cascade** for the parent's Plus/Family sub (gifter recurring
has one; the parent sub doesn't). Build: on `invoice.payment_failed` for a
subscription invoice, enqueue day-0 / day-3 / day-7 emails with a **one-click
Stripe card-update link** (billing portal / `payment_intent` with
`payment_action_required`). Stop on `invoice.payment_succeeded`. Protects the
live revenue line directly.

### G2 — Card-expiry pre-emption  *(fast-follow)*
No "your card on file expires next month — update it so {child}'s recurring
doesn't lapse" nudge. **This is the exact ProfitWell move** (the one praised in
the session). Build: monthly scan of `card.exp_month/exp_year` on file (Stripe)
→ warm email to the parent ~30 days out. Cheap, high-leverage, on-brand
("don't let {child}'s plan lapse").

### G3 — Cancel-reason + "what did you like" capture (the Nostalgia question)  *(launch must-have — cheap)*
`cancellation-impact` shows what they lose, but we never capture **why they're
leaving** + **what they liked**. Patrick's finding: on the cancel screen, two
questions — (1) *why are you leaving* (multiple choice, not free-text) and
(2) *what did you like about it* — the second taps a Nostalgia effect that stops
the freight train. **Honor the anti-dark-pattern stance:** no save-offer
gauntlet. Two optional questions on the existing confirmation step + a single
gentle **pause** offer (we already support pause — `majority_handoff` proves the
mechanic; reuse it as a voluntary "pause instead of cancel" for the parent sub).
Primary value is **research** (feeds §5 support-as-moat / talk-to-10). Store on
a small `churn_signals` shape (or extend the cancellation record): `reason`,
`liked`, `offeredPause`, `acceptedPause`.

### G4 — Win-back  *(later)*
After a sub cancels, one light, honest touch weeks later — *"your Memory Book is
still here; {child}'s fund is still invested"* — leveraging the un-churnable
Memory Book moat (`project_moat_precision_switching_cost`). No urgency, no
discount spam. Leans on the asset (the relationship) we already own.

---

## Sequencing vs. launch

- **Before / at launch:** G1 (protects revenue) + G3 (cheap, research-critical,
  values-aligned). Both small.
- **Fast-follow:** G2 (card-expiry pre-emption).
- **Later:** G4 (win-back).

## Guardrails

- **No dark patterns.** Honest impact, one gentle pause offer, no multi-step
  guilt gauntlet. The brand is "Target not Walmart" / honest-by-default.
- **Emotional register.** Warm + human; these emails are about a child's future,
  not a SaaS seat.
- **Pre-custody reality.** Real money movement (and thus most churn) only matters
  once custody is live; G1/G2 are inert until Stripe subs carry real volume, so
  build them lean and don't over-invest ahead of funded-k.
