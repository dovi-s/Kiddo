# Week 2 Ticket Pack

Updated: 2026-02-27

Legend:
- Priority: `P0` critical, `P1` high, `P2` medium.
- Status: `todo`, `in_progress`, `blocked`, `done`.

## KORA-W2-001 - Checkout error taxonomy and instrumentation

- Priority: P0
- Owner: Frontend + Backend
- Status: todo
- Estimate: 1 day
- Goal: Make checkout failures measurable and actionable.
- Scope:
  - Normalize checkout error codes from backend.
  - Emit `checkout_error` event with reason code.
  - Add admin summary card for top 5 checkout errors.
- Acceptance:
  - Every checkout failure has a reason code.
  - Admin shows ranked error causes for last 7 days.

## KORA-W2-002 - Checkout mobile layout optimization

- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 1 day
- Goal: Reduce drop-off from mobile layout friction.
- Scope:
  - Rework spacing and stacking for amount, execution, and payment sections.
  - Keep primary CTA visible without crowding key details.
  - Validate on narrow breakpoints and common device sizes.
- Acceptance:
  - No clipped content or overlapping controls on tested widths.
  - Mobile completion improves from Week 1 baseline.

## KORA-W2-003 - Fee breakdown readability pass

- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 0.75 day
- Goal: Improve confidence and comprehension in pricing summary.
- Scope:
  - Clarify fee labels and ordering.
  - Ensure “net to fund” vs “you pay” is visually distinct.
  - Keep wording consistent across checkout and admin.
- Acceptance:
  - User can identify net amount in under 3 seconds in usability pass.
  - No inconsistency between checkout and admin fee terminology.

## KORA-W2-004 - Projection copy and assumption consistency audit

- Priority: P1
- Owner: Frontend + Product
- Status: todo
- Estimate: 0.5 day
- Goal: Keep projection messaging compliant and consistent everywhere.
- Scope:
  - Verify all projection surfaces use scenario language.
  - Ensure 5/7/9 assumptions are available and explained.
  - Remove stale or contradictory return copy.
- Acceptance:
  - No fixed-return language remains in user-facing screens.
  - Tooltip/help copy matches across Home and Dashboard.

## KORA-W2-005 - CTA hierarchy refactor on fund/dashboard mobile

- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 1 day
- Goal: De-crowd action controls and improve tap clarity.
- Scope:
  - Group secondary actions into compact pattern.
  - Preserve prominent “Share” and high-frequency actions.
  - Add overflow affordance for less-used actions.
- Acceptance:
  - Primary action is always obvious.
  - Tap misfires reduced in QA walkthrough.

## KORA-W2-006 - UX copy standardization (errors + confirmations)

- Priority: P2
- Owner: Product + Frontend
- Status: todo
- Estimate: 0.75 day
- Goal: Remove ambiguous and inconsistent messaging.
- Scope:
  - Standardize confirmation language on gift success.
  - Standardize error phrasing for checkout, admin, and settings.
  - Replace technical phrasing with user-readable guidance.
- Acceptance:
  - Copy review checklist passes all touched flows.
  - No raw backend error strings shown to end users.

## KORA-W2-007 - Stripe checkout preflight endpoint

- Priority: P0
- Owner: Backend
- Status: todo
- Estimate: 1 day
- Goal: Catch preventable failures before creating checkout session.
- Scope:
  - Add lightweight preflight validation endpoint.
  - Validate fund/event state, amount bounds, execution payload.
  - Return explicit reason codes consumed by frontend.
- Acceptance:
  - Invalid requests fail preflight, not checkout creation.
  - Frontend displays specific remediation message.

## KORA-W2-008 - Baseline conversion dashboard and report

- Priority: P1
- Owner: Growth + Data
- Status: todo
- Estimate: 0.75 day
- Goal: Establish a stable weekly conversion scorecard.
- Scope:
  - Report:
    - checkout starts
    - checkout completes
    - completion rate
    - top failure reasons
    - mobile vs desktop split
  - Publish weekly snapshot in ops channel.
- Acceptance:
  - Week 2 scorecard published and repeatable.
  - All rates tie back to tracked events.

## Week 2 Delivery Checklist

- [ ] All P0 tickets moved to `done`.
- [ ] At least 4 P1 tickets moved to `done`.
- [ ] Mobile UX pass reviewed on real devices.
- [ ] Conversion scorecard published with week-over-week delta.

