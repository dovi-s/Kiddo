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
- **Design for the seamless version (flag-gated, mirror the `GIFTER_CAPTURE_AT_INTENT`
  precedent):** on confirm, create the Kiddo+ subscription for the remaining fund with its
  **first charge anchored to the Family period end** (`trial_end`/`billing_cycle_anchor` =
  `familyCurrentPeriodEnd`) so it is $0 until renewal then bills $3.99, AND set the Family sub
  to `cancel_at_period_end`. Net: no gap, no double-bill, takes effect at renewal. Route the
  Stripe write through `stripeService` (per CLAUDE.md), lift the household guard for this
  verified downgrade path only, and have `handleStarterPlanPurchase` activate the membership.
  **Verify in Stripe test mode before flipping the flag.**

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
