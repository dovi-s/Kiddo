# Family → Kiddo+ downgrade ("right-size your plan")

**Why.** A parent with two kids who hands one off to an adult account (or whose needs
otherwise shrink) should never keep paying for **Kiddo Family** when **Kiddo+** now covers
what they actually use. Surfacing the cheaper plan *proactively* is the inverse of a dark
pattern, on-brand with "no hidden charges ever," and converts involuntary churn into a
downgrade (they stay in the ecosystem → the parent-2.0 loop survives). Founder-requested
2026-06-01.

## Locked decisions (founder, 2026-06-01)
1. **Switch timing:** at **renewal** — keep the Family period already paid for, then move to
   Kiddo+. No double-bill, no refund math, no mid-period coverage gap.
2. **Multi-fund:** only offer when **down to exactly one active minor fund** (the
   unambiguously safe case, e.g. after a handoff). Never force a "which kid?" choice.
3. **Placement:** **both** the Plan & billing page **and** at the handoff moment.

## What shipped (2026-06-01, safe + verifiable)
- **Detection (read-only).** `GET /api/subscription` now returns `planFit`:
  - `{ kind: 'downgrade_to_plus', fund:{id,name,childName}, renewalDate }` when the user has
    an **active Family** plan (not already canceling, no Plus in play) and **exactly one**
    owned, non-`transferredAt` fund.
  - `{ kind: 'no_plan_needed', fund:null, renewalDate }` when they have **zero** active minor
    funds (all kids graduated) but still pay Family.
  - `null` otherwise (2+ funds → Family is right-sized).
  Computed in `routes.ts` GET `/api/subscription` from the already-loaded `householdPlan` +
  `getFundsByUser` + `currentPeriodEnd`. No Stripe call.
- **Honest UI.** `Account.tsx` Plan & billing renders a gold "right-size your plan" card above
  the plan-status card when `planFit` is set, with a two-step inline confirm. The action calls
  the **existing, proven** `POST /api/subscription/cancel` with `plan:'family'`, which sets the
  Family sub to `cancel_at_period_end` (reversible via the existing amber "Keep my plan" card).
  Family rides out the paid period; once it lapses the **household-coverage guard clears** and
  the one remaining fund takes Kiddo+ through the normal per-fund Plus path.

## The known gap / enhancement (NOT yet built — needs founder Stripe verification)
The shipped flow is honest but not *fully* seamless: after Family lapses at renewal, the
parent re-confirms Kiddo+ for the remaining fund (the app already nudges uncovered funds). The
**fully-automatic** "Plus starts the instant Family ends" requires real money movement we
could not test from the agent shell:

- **Why it's blocked today:** `POST /api/stripe/checkout/starter-plan` (`routes.ts:~11255`)
  **blocks Plus while any household plan is active** — and a `cancel_at_period_end` Family is
  still entitled until period end, so Plus can't be purchased in advance. The existing
  "Downgrade to Plus" button in the plan ladder (`Account.tsx:~1357`) calls
  `handleUpgradeStarter` and therefore **errored** for a Family user. **FIXED 2026-06-01:**
  downgrade-direction CTAs are now hidden in the ladder via `isDowngradeCard` (the
  "Included in {plan}" pill conveys state); the safe downgrade lives in the plan-fit card.
- **Seamless version — BUILT + flag-gated 2026-06-01 (commit pending).** `POST
  /api/subscription/downgrade-to-plus` now has both modes. When `PLAN_DOWNGRADE_SEAMLESS`
  (`server/planDowngradeFlag.ts`) is **on**: it creates the Kiddo+ sub via
  `stripeService.createDeferredSubscription` with `trial_end = family currentPeriodEnd` (free
  until renewal, then bills the saved card off-session), records the `fund_memberships` row
  (status `trialing`, so the existing `subscription.updated` webhook syncs it to `active` at
  trial end), then cancels Family at period end. It **rolls back** the new Plus sub if the
  Family cancel fails (never leaves Plus-created-but-Family-renewing → no double-bill). Founder
  price lock honored. Did NOT need to touch the checkout-guard (this path uses
  `subscriptions.create` directly, not the blocked checkout). When the flag is **off**
  (default), the same endpoint falls back to cancel-Family-at-renewal (the shipped safe path).
  **Two of the original risks are now hardened in code (2026-06-01):**
  - **(a) trial-end charge** — the endpoint now carries the Family sub's saved card onto the
    Plus sub (`default_payment_method`), so it can't land PM-less and silently cancel. Backstop:
    `trial_settings.missing_payment_method = 'cancel'` (no past_due) if somehow there's no card.
  - **(e) overlap seam** — `trialing` is now entitled in `hasEntitlementFromStatus` (safe:
    `createCheckoutSession` sets no trial, so the seamless Plus sub is the only thing that's
    ever `trialing`). The Plus sub now covers its fund continuously, so there's no window where
    Family has ended but the trial hasn't flipped to active yet.

  **⚠️ Still verify in Stripe TEST MODE before flipping `PLAN_DOWNGRADE_SEAMLESS=true`:**
  (1) the trial-end invoice actually charges the carried-over card; (2) Family cancels cleanly
  at the boundary; (3) `customer.subscription.updated` flips the membership `trialing→active`;
  (4) the rollback path fires if the Family cancel throws (create Plus, force a cancel failure,
  confirm the Plus sub is canceled + membership marked canceled).

## Placement #2 — at the handoff moment (SHIPPED 2026-06-01)
The `planFit` nudge is now also surfaced on the **household "Your funds" overview**
(`FundsOverview.tsx`) — the surface where a parent actually sees the fund count drop after a
kid hands off. It's a gentle gold card ("You're managing one fund now…") that links to
`/account?tab=plan` for the full switch rather than duplicating the action. Read-only
(`useSubscription`), gated to `planFit.kind === 'downgrade_to_plus'`. The literal
at-the-instant-of-handoff prompt (e.g. in the age-transition completion screen) remains a
possible future refinement, but the overview catches it at the natural next visit.

## Test plan (for the seamless endpoint, when built)
1. Family + 2 minor funds → `planFit` null (no offer). ✓ guard.
2. Family + 1 minor fund → offer; confirm → Family `cancel_at_period_end`, Plus scheduled at
   period end; at renewal Plus bills, fund stays covered (no uncovered gap). 
3. Family + 0 minor funds (all handed off) → `no_plan_needed`; confirm → Family ends, no Plus.
4. Reversibility: after confirm, "Keep my plan" reactivates Family and cancels the scheduled
   Plus.
5. Already-canceling Family → no offer (`status==='canceled'` gate).
