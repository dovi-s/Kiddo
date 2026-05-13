# Kora Growth Ticket Pack (From 12 Skills)

Updated: 2026-03-04  
Source: `KORA_GROWTH_PLAYBOOK.md`

Use this as the execution backlog. Every ticket below includes:
- Priority (`P0/P1/P2`)
- Owner
- File-level implementation scope
- Acceptance checks

Import CSVs:
- Generic: `KORA_GROWTH_TICKETS_IMPORT.csv`
- Jira: `KORA_GROWTH_TICKETS_IMPORT_JIRA.csv`
- Linear: `KORA_GROWTH_TICKETS_IMPORT_LINEAR.csv`
- Trello: `KORA_GROWTH_TICKETS_IMPORT_TRELLO.csv`

---

## P0 (Do Now)

### KORA-GROWTH-P0-001 - First-session funnel timestamps
- Owner: Backend + Data
- Scope:
  - `server/routes.ts`
  - `client/src/pages/GetStarted.tsx`
  - `client/src/pages/Dashboard.tsx`
- Tasks:
  - Add/standardize events for `fund_created`, `fund_shared`, `gift_checkout_started`, `gift_checkout_completed`.
  - Persist timestamp metadata for time-to-first-share and time-to-first-gift calculations.
  - Ensure all events include `fundId`, `channel`, and `createdAt`.
- Acceptance:
  - New fund cohorts show valid median `time_to_first_share` and `time_to_first_gift`.
  - No null `fundId` for fund-origin funnel events in normal flow.

### KORA-GROWTH-P0-002 - Guided Launch completion telemetry
- Owner: Frontend
- Scope:
  - `client/src/pages/Dashboard.tsx`
  - `client/src/components/ui/ux-foundations.tsx`
- Tasks:
  - Emit step-completion events from Guided Launch:
    - create fund complete
    - create event complete
    - share link complete
  - Add one completion metric for "Guided Launch completed in 48h".
- Acceptance:
  - Admin can report Guided Launch step drop-off and completion within 48h.

### KORA-GROWTH-P0-003 - Checkout friction diagnostics by step
- Owner: Frontend + Backend
- Scope:
  - `client/src/pages/GiftCheckout.tsx`
  - `server/routes.ts` (`/api/referrals/events`, admin growth endpoints)
- Tasks:
  - Add checkout step markers (`amount`, `sender`, `payment`, `execution`, `submit`).
  - Track where abandonment happens before session creation.
- Acceptance:
  - Admin diagnostics include step-level drop-offs and top abandonment step.

### KORA-GROWTH-P0-004 - Lifecycle nudge queue to visible inbox
- Owner: Backend + Frontend
- Scope:
  - `server/routes.ts` (lifecycle automation already added)
  - `client/src/pages/Activity.tsx`
  - `client/src/pages/ActivityDetail.tsx`
- Tasks:
  - Ensure lifecycle-generated activities are grouped under a clear category.
  - Add clear CTA in activity detail (`Share now`, `Create event`, `Review fund`).
- Acceptance:
  - Lifecycle activities are visible, understandable, and actionable in Activity feed.
  - No raw snake_case surfaced to users.

### KORA-GROWTH-P0-005 - Pricing/entitlement consistency audit
- Owner: Product + Backend
- Scope:
  - `client/src/pages/Settings.tsx`
  - `client/src/pages/Home.tsx`
  - `client/src/pages/ActivateInvesting.tsx`
  - `client/src/pages/GiftCheckout.tsx`
  - `client/src/pages/FAQ.tsx`
  - `server/webhookHandlers.ts`
- Tasks:
  - Verify all copy uses:
    - Starter = `$5/mo per fund`
    - Family = `$12/mo` or `$119/yr` unlimited
  - Validate overlap logic and grace states in UI.
- Acceptance:
  - No conflicting pricing copy in app.
  - Starter->Family and Family->Starter states render correctly in Settings.

### KORA-GROWTH-P0-006 - Fund details completeness in settings
- Owner: Frontend
- Scope:
  - `client/src/pages/Settings.tsx`
- Tasks:
  - Keep new `FundDetailsSnapshot` and add:
    - last gift date
    - last event shared date (if available)
    - active strategy + coverage status in snapshot header
  - Add empty-state guidance per metric block.
- Acceptance:
  - Every fund card shows what it owns and current status without requiring dashboard navigation.

### KORA-GROWTH-P0-007 - Admin lifecycle signal cards + drill links
- Owner: Admin Frontend + Backend
- Scope:
  - `server/routes.ts` (`/api/admin/overview`, growth queries)
  - `client/src/pages/Admin.tsx`
- Tasks:
  - Keep current lifecycle cards and add drill actions:
    - open funds likely impacted
    - open gifts/checkout diagnostics filtered window
- Acceptance:
  - Each lifecycle card links to a useful filtered view or relevant tab with context.

---

## P1 (Next)

### KORA-GROWTH-P1-001 - Thank-you conversion loop scoring
- Owner: Product + Backend
- Scope:
  - `client/src/components/ThankYouManager.tsx`
  - `server/routes.ts`
  - `client/src/pages/Admin.tsx`
- Tasks:
  - Add metric: `% gifts with thank-you action <= 7d`.
  - Add activity when thank-you sent with optional "share update" CTA.
- Acceptance:
  - Admin shows thank-you conversion and 7-day trend.

### KORA-GROWTH-P1-002 - Share-after-gift prompt optimization
- Owner: Growth + Frontend
- Scope:
  - `client/src/pages/GiftSuccess.tsx`
  - `client/src/components/ui/share-kit.tsx`
- Tasks:
  - Test two CTA variants post-gift:
    - "Share progress update"
    - "Invite one more family member"
  - Capture CTR and downstream checkout starts.
- Acceptance:
  - Variant reporting exists and one winner chosen after minimum sample threshold.

### KORA-GROWTH-P1-003 - Event monetization decision clarity
- Owner: Product + Frontend
- Scope:
  - `client/src/pages/Events.tsx`
  - `client/src/pages/EventCreate.tsx`
  - `client/src/pages/Settings.tsx`
- Tasks:
  - Show “Best value” hint based on user state (free/starter/family).
  - Clarify Event Boost credits and usage path.
- Acceptance:
  - Users with multiple funds understand whether to buy Starter, Family, or Event Boost.
  - Reduced support confusion on event purchase path.

### KORA-GROWTH-P1-004 - Unit economics trend panel
- Owner: Backend + Admin Frontend
- Scope:
  - `server/routes.ts`
  - `client/src/pages/Admin.tsx`
- Tasks:
  - Add 30d trend for:
    - platform revenue
    - estimated store fees
    - estimated contribution margin
  - Add confidence label when values are estimated.
- Acceptance:
  - Admin can view trend direction, not only point-in-time values.

### KORA-GROWTH-P1-005 - Retention reactivation outcomes
- Owner: Growth + Data
- Scope:
  - `server/routes.ts`
  - `client/src/pages/Admin.tsx`
- Tasks:
  - Track recovery conversion for `no_gift_14d`:
    - gift in <= 7 days after signal
  - Report by channel where available.
- Acceptance:
  - Admin shows recovery rate and sample count for reactivation.

### KORA-GROWTH-P1-006 - Activity reliability hardening
- Owner: Backend
- Scope:
  - `server/routes.ts` (`/api/activities`, `/api/funds/:fundId/activities`)
  - `server/storage.ts`
- Tasks:
  - Ensure activity fetch never hard-fails on enrichment gaps.
  - Add fallback if fund lookup fails for historical rows.
- Acceptance:
  - Activity page remains functional even with partial/missing relational data.

---

## P2 (Later)

### KORA-GROWTH-P2-001 - Outbound lifecycle worker
- Owner: Backend + Ops
- Scope:
  - `server/` new worker module (email queue processor)
  - `server/routes.ts` (queue producer already exists via audit log markers)
- Tasks:
  - Build idempotent worker consuming `lifecycle_nudge_email_queued`.
  - Add cooldown + suppression logic.
- Acceptance:
  - Email nudges send once per cooldown window.
  - Retries and failures are logged safely.

### KORA-GROWTH-P2-002 - Fund health score
- Owner: Data + Admin Frontend
- Scope:
  - `server/routes.ts`
  - `client/src/pages/Admin.tsx`
- Tasks:
  - Compute A/B/C health score per fund from:
    - share activity
    - checkout starts
    - gift recency
    - repeat gifter signals
- Acceptance:
  - Admin fund table includes health score with drill-down rationale.

### KORA-GROWTH-P2-003 - Distribution source attribution model
- Owner: Growth + Backend
- Scope:
  - `server/routes.ts` referral ingestion + growth queries
  - `client/src/pages/Admin.tsx`
- Tasks:
  - Normalize source channel taxonomy.
  - Attribute fund creation and first gift by source.
- Acceptance:
  - Admin reports non-paid vs paid source contribution to first gifts and AFRG.

### KORA-GROWTH-P2-004 - Guided Launch adaptive assistant
- Owner: Product + Frontend
- Scope:
  - `client/src/pages/Dashboard.tsx`
- Tasks:
  - Adapt CTA copy by incomplete step and lifecycle signal state.
  - Add "resume where you left off" behavior.
- Acceptance:
  - Measurable Guided Launch completion lift vs baseline.

### KORA-GROWTH-P2-005 - Weekly auto scorecard export
- Owner: Data + Ops
- Scope:
  - `server/routes.ts` and scheduled job scripts
- Tasks:
  - Generate weekly KPI snapshot from playbook scorecard metrics.
  - Deliver CSV/JSON artifact for review.
- Acceptance:
  - Weekly scorecard generated automatically with no manual SQL pull.

---

## UX 2026 Addendum (Research-Informed)

Source: `KORA_FINTECH_UX_2026_BENCHMARK.md`

### KORA-UX26-P0-001 - Trust telemetry coverage expansion
- Owner: Frontend + Backend
- Scope:
  - `client/src/pages/Dashboard.tsx`
  - `client/src/pages/Home.tsx`
  - `client/src/pages/GiftCheckout.tsx`
  - `server/routes.ts`
- Tasks:
  - Emit `trust_tooltip_open/click` for trust-specific UI entry points.
  - Ensure all trust event actions are accepted and queryable in referral events pipeline.
- Acceptance:
  - Admin trust CTR metric reflects both education tips and trust-specific surfaces.

### KORA-UX26-P0-002 - Accessibility sweep for financial decision surfaces
- Owner: Frontend
- Scope:
  - `client/src/pages/GiftCheckout.tsx`
  - `client/src/pages/Settings.tsx`
  - `client/src/pages/Admin.tsx`
- Tasks:
  - Validate keyboard navigation and focus indicators for all decision CTAs.
  - Remove color-only meaning in status/score states where present.
- Acceptance:
  - Core flows pass manual a11y checklist with no blocking issues.

### KORA-UX26-P1-001 - Personalized next-best-action blocks
- Owner: Product + Frontend
- Scope:
  - `client/src/pages/Dashboard.tsx`
  - `server/routes.ts` (reuse lifecycle signals)
- Tasks:
  - Add contextual CTA block driven by lifecycle signal + plan state.
  - Track CTA shown/clicked outcomes.
- Acceptance:
  - Dashboard presents context-sensitive actions with measurable click-through.

### KORA-UX26-P1-002 - Cross-breakpoint parity QA package
- Owner: QA + Frontend
- Scope:
  - `client/src/pages/*` (checkout, settings, dashboard, events)
- Tasks:
  - Add repeatable parity checklist for mobile/tablet/desktop on critical flows.
  - Include fee summary visibility and trust disclaimer visibility checks.
- Acceptance:
  - Signed parity checklist exists for each release.

## Motion 2026 Addendum (Mobile UI Motion Patterns)

Source: `KORA_MOBILE_MOTION_2026_PLAYBOOK.md`

### KORA-MOTION26-P0-001 - Checkout action-state motion pass
- Owner: Frontend
- Scope:
  - `client/src/pages/GiftCheckout.tsx`
- Tasks:
  - Ensure deterministic tap/submit/loading/success/error transitions.
  - Add explicit loading text for each async checkpoint.
- Acceptance:
  - Checkout flow gives immediate tap acknowledgment and clear processing state in all payment paths.

### KORA-MOTION26-P0-002 - Settings membership transition clarity
- Owner: Frontend
- Scope:
  - `client/src/pages/Settings.tsx`
- Tasks:
  - Improve visual feedback for plan upgrade/cancel/reactivate actions.
  - Prevent ambiguous intermediate UI states.
- Acceptance:
  - Users always see clear in-progress and final state when managing plans.

### KORA-MOTION26-P1-001 - Reduced-motion compliance in core flows
- Owner: Frontend
- Scope:
  - `client/src/pages/Dashboard.tsx`
  - `client/src/pages/GiftCheckout.tsx`
  - `client/src/pages/Settings.tsx`
- Tasks:
  - Audit and adapt transitions for `prefers-reduced-motion`.
  - Keep meaning without motion-only cues.
- Acceptance:
  - Core flows are usable and clear with reduced motion enabled.

### KORA-MOTION26-P1-002 - Motion telemetry baseline
- Owner: Frontend + Backend
- Scope:
  - `client/src/pages/*`
  - `server/routes.ts`
- Tasks:
  - Standardize event names for motion lifecycle markers.
  - Include surface/component metadata.
- Acceptance:
  - Motion-related events are queryable for conversion and friction analysis.

---

## Definition of Done (All Tickets)

1. Typecheck passes: `npm run check`.
2. No regression in:
  - gift checkout
  - event creation flow
  - settings membership flow
3. Admin metric affected by ticket is visible and explainable.
4. User-facing copy is clear, concrete, and matches current pricing model.
