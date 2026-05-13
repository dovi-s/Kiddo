# Week 1 Ticket Pack

Updated: 2026-02-27

Legend:
- Priority: `P0` critical, `P1` high, `P2` medium.
- Status: `todo`, `in_progress`, `blocked`, `done`.

## KORA-W1-001 - Gift webhook idempotency hardening

- Priority: P0
- Owner: Backend
- Status: todo
- Estimate: 1.5 days
- Goal: Prevent duplicate gift inserts and duplicate state transitions on Stripe retries.
- Scope:
  - Enforce uniqueness by Stripe object ids.
  - Ignore already-processed webhook events safely.
  - Log idempotent skip events with reason.
- Acceptance:
  - Replaying same webhook event does not change totals.
  - Replay test passes on local test fixture.

## KORA-W1-002 - Gift state transition guardrails

- Priority: P0
- Owner: Backend
- Status: todo
- Estimate: 1 day
- Goal: Enforce valid lifecycle transitions only.
- Scope:
  - Add transition validation helper.
  - Reject invalid transitions with structured error.
  - Add audit note when manual admin override occurs.
- Acceptance:
  - Invalid transitions are blocked.
  - Admin override leaves traceable audit row.

## KORA-W1-003 - Admin integrity card data completeness

- Priority: P0
- Owner: Backend + Frontend
- Status: todo
- Estimate: 1.5 days
- Goal: Remove “No integrity data available” and always show diagnostics.
- Scope:
  - Ensure integrity endpoint never returns empty shape.
  - Return zeroed and explained fallback values when no rows.
  - Render clear “no data yet” states instead of blank cards.
- Acceptance:
  - Integrity section always renders with deterministic structure.
  - Empty-db case is informative and non-breaking.

## KORA-W1-004 - Funnel instrumentation baseline

- Priority: P1
- Owner: Frontend + Growth
- Status: todo
- Estimate: 1 day
- Goal: Capture first-touch to first-gift events consistently.
- Scope:
  - Emit or normalize events:
    - `fund_created`
    - `fund_shared`
    - `gift_checkout_started`
    - `gift_checkout_completed`
    - `gift_invested`
    - `memory_entry_created`
  - Add event payload contract doc inline or in code comments.
- Acceptance:
  - Sample session shows all expected events in sequence.
  - Admin/Growth endpoint can read counts by 7-day window.

## KORA-W1-005 - Checkout validation hard stop (email + inputs)

- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 0.5 day
- Goal: Prevent avoidable Stripe 400s before checkout session call.
- Scope:
  - Validate sender email format before submit.
  - Validate amount minimum and selected stock requirement.
  - Show inline error text tied to specific field.
- Acceptance:
  - Invalid email never reaches checkout endpoint.
  - User sees actionable error without console-only failures.

## KORA-W1-006 - Mobile CTA crowding pass

- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 1 day
- Goal: Improve tap accuracy and spacing for crowded action rows.
- Scope:
  - Reflow action button clusters on small widths.
  - Preserve hierarchy: primary action prominent, secondary grouped.
  - Validate on common narrow breakpoints.
- Acceptance:
  - No overlapping/cutoff action labels on mobile widths.
  - Tap targets meet minimum size expectation.

## KORA-W1-007 - Admin crash guard pass

- Priority: P0
- Owner: Frontend
- Status: todo
- Estimate: 1 day
- Goal: Stop tab-level failures from taking down admin workflows.
- Scope:
  - Add robust loading/error boundaries around tab fetchers.
  - Ensure each tab has resilient empty/error state.
  - Prevent hook-order regressions in conditional render branches.
- Acceptance:
  - No “Something went wrong” on nominal data.
  - Error states recover via refresh or retry button.

## KORA-W1-008 - Baseline smoke script update

- Priority: P1
- Owner: Backend + QA
- Status: todo
- Estimate: 0.5 day
- Goal: Include key gift pipeline checks in smoke routine.
- Scope:
  - Extend smoke script/checklist for:
    - gift checkout path
    - webhook processing
    - memory linkage
    - admin integrity endpoint
- Acceptance:
  - One command verifies pipeline basics before release.

## Week 1 Delivery Checklist

- [ ] All P0 tickets moved to `done`.
- [ ] At least 2 P1 tickets moved to `done`.
- [ ] Demo prepared:
  - webhook replay without duplicates
  - integrity card populated
  - checkout validation blocks invalid email
- [ ] KPI snapshot captured for Week 1 baseline.

## Growth Sprint 1 Addendum

These tickets translate the current growth teardown into execution work across the existing product. They focus on activation, monetization awareness, re-engagement, and loop instrumentation.

### Sprint framing

Repo audit takeaway: a meaningful share of the underlying product plumbing already exists. The next sprint should optimize for surfacing, instrumentation, and conversion improvements before introducing new backend systems.

Sprint objective:
- surface existing product loops
- instrument them properly
- improve conversion on top of what is already there
- do not rebuild systems we already have

Existing foundations already present in-repo:
- gifter success and gifting entry surfaces
- reverse-trial and upgrade logic
- Memory Book and share-oriented states
- event lifecycle and age-transition flows
- invitation-request fallback paths
- growth reporting endpoints and analytics hooks

Sprint rule:
- prefer exposing and instrumenting existing loops first
- only build new backend plumbing when a surfaced loop is blocked by a real capability gap

## KORA-G1-000 - Existing growth plumbing surfacing audit

- Priority: P0
- Owner: Product + Frontend + Growth
- Status: todo
- Estimate: 0.5 day
- Goal: Turn the repo audit into an explicit execution map so the sprint focuses on surfacing existing loops before building net-new systems.
- Scope:
  - Audit current product plumbing already present for gifting, trials, Memory Book, invitations, events, and age-transition moments.
  - Map each existing capability to its current user-facing surface, missing instrumentation, and missing conversion layer.
  - Tag each follow-on ticket as `surface_existing`, `instrument_existing`, or `net_new_gap`.
- Acceptance:
  - One audit table exists in-repo showing what already exists vs what is merely under-exposed.
  - Sprint prioritization clearly separates surfacing work from true net-new backend work.

## KORA-G1-001 - Gifter to parent conversion loop hardening

- Priority: P0
- Owner: Frontend + Growth
- Status: todo
- Estimate: 1 day
- Goal: Turn gift completion into a clear parent acquisition surface.
- Scope:
  - Audit post-gift success state for the strongest "start your child's fund" CTA placement.
  - Ensure Kado brand attribution appears on the confirmation share surfaces.
  - Track gifter CTA exposure, click, and downstream signup start.
- Acceptance:
  - Gift success state includes a visible parent-acquisition CTA above the fold.
  - Funnel event chain exists from `gift_checkout_completed` to `gifter_parent_cta_clicked` to `signup_started`.

## KORA-G1-002 - Reverse trial awareness and expiry UX pass

- Priority: P0
- Owner: Frontend + Growth
- Status: todo
- Estimate: 1 day
- Goal: Make existing reverse-trial value obvious before, during, and after the free period.
- Scope:
  - Audit dashboard, pricing, and upgrade surfaces for clear trial state messaging.
  - Add or refine countdown, saved-fees framing, and expiry messaging.
  - Instrument `trial_started`, `trial_banner_viewed`, `trial_expiring_viewed`, and `trial_converted`.
- Acceptance:
  - Trial users can always see status and value saved without hunting through settings.
  - Trial lifecycle events are queryable in growth reporting.

## KORA-G1-003 - Parent signup profiling questions

- Priority: P1
- Owner: Frontend + Backend
- Status: todo
- Estimate: 1.5 days
- Goal: Capture high-value intent data right after fund creation without hurting activation.
- Scope:
  - Add lightweight post-account profiling:
    - primary occasion
    - child age band
    - acquisition source
  - Persist answers to user or fund metadata.
  - Add analytics for completion and skip behavior.
- Acceptance:
  - New parents can answer or skip in under 20 seconds.
  - Profiling data is available for segmentation in admin or exports.

## KORA-G1-004 - Monetization awareness audit and feature-wall pass

- Priority: P0
- Owner: Frontend + Growth
- Status: todo
- Estimate: 1.5 days
- Goal: Ensure free users understand what Kado+ and Kado Family unlock at the moment of intent.
- Scope:
  - Audit every locked paid feature surface.
  - Add consistent lock state, benefit copy, and upgrade CTA where missing.
  - Prioritize Memory Book, event customization, multi-fund creation, and child-view advanced features.
- Acceptance:
  - Every visible paid feature has a clear upgrade explanation and next step.
  - Free-user survey or QA audit shows no major "I did not know this was paid" gaps.

## KORA-G1-005 - Onboarding email and in-app nudge map

- Priority: P1
- Owner: Growth + Lifecycle
- Status: todo
- Estimate: 1 day
- Goal: Define and scaffold the first 14 days of post-signup activation messaging.
- Scope:
  - Draft day-by-day sequence for:
    - share fund link
    - view gifter flow
    - create first event
    - use Memory Book
    - understand trial and upgrade value
  - Map each message to existing product surfaces and trigger conditions.
  - Document what is implemented vs missing.
- Acceptance:
  - One lifecycle map exists in-repo with trigger, audience, channel, CTA, and owner.
  - Missing implementation dependencies are called out explicitly.

## KORA-G1-006 - Post-event summary and next-occasion prompt

- Priority: P1
- Owner: Frontend + Backend
- Status: todo
- Estimate: 1.5 days
- Goal: Turn event completion into a retention moment instead of a dead end.
- Scope:
  - Create a parent summary state for completed events:
    - total raised
    - number of gifters
    - investment destination summary
  - Add CTA to create the next event or reshare the fund.
  - Add analytics for summary views and next-event starts.
- Acceptance:
  - Completed events surface a summary instead of disappearing into history.
  - Parents have one obvious next action after an event ends.

## KORA-G1-007 - Memory Book milestone share pass

- Priority: P1
- Owner: Frontend + Growth
- Status: todo
- Estimate: 1 day
- Goal: Turn Memory Book progress into an explicit sharing mechanic.
- Scope:
  - Add share prompts for milestone-worthy states such as:
    - first gift
    - anniversary
    - milestone fund totals
  - Reuse existing share infrastructure where possible.
  - Track share prompt exposure and completion.
- Acceptance:
  - Parents can share at least three milestone states without manual copywriting.
  - Growth reporting can distinguish Memory Book shares from generic fund shares.

## KORA-G1-008 - Trust messaging rewrite in human language

- Priority: P1
- Owner: Frontend + Content
- Status: todo
- Estimate: 0.5 day
- Goal: Lead with outcomes users care about, then explain the mechanism.
- Scope:
  - Rewrite key trust copy on homepage, security, checkout, and pricing surfaces.
  - Prioritize plain-language messages such as:
    - the child's money is not Kado's asset
    - if Kado disappeared, the underlying assets would still exist
    - funds are private and invitation-driven
- Acceptance:
  - Core trust surfaces lead with plain language before legal terminology.
  - Legal accuracy remains intact after copy pass.

## KORA-G1-009 - Child not on Kado acquisition surface

- Priority: P1
- Owner: Frontend + Growth
- Status: todo
- Estimate: 0.5 day
- Goal: Promote the existing invitation request path as an explicit acquisition loop.
- Scope:
  - Surface the "child not on Kado yet" path more prominently in gifting entry points.
  - Clarify expected outcome and turnaround for the parent invitation request.
  - Track invite-request starts and submissions.
- Acceptance:
  - A new gifter can discover the invitation path without hunting through fallback UI.
  - Invite-request conversion is measurable.

## KORA-G1-010 - Growth dashboard metric expansion

- Priority: P0
- Owner: Backend + Growth
- Status: todo
- Estimate: 1 day
- Goal: Make the main growth loops measurable in one place.
- Scope:
  - Expand reporting to include:
    - gifter to parent CTA clicks
    - signup profiling completion
    - reverse-trial visibility and conversion
    - Memory Book milestone shares
    - event summary views
  - Add definitions for each metric inline in code or docs.
- Acceptance:
  - Growth dashboard or endpoint exposes the new loop metrics for a rolling 30-day view.
  - Metric definitions are documented and unambiguous.
