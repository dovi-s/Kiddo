# Kora Growth Playbook

Updated: 2026-03-04

Purpose:
- Turn broad PLG advice into Kora-specific execution.
- Keep team focus on compounding loops, activation speed, and healthy unit economics.
- Prevent random feature work that does not move the North Star.

## North Star and Guardrails

North Star:
- `AFRG` = Activated Fund with Repeat Gifting.
- Definition: 2 successful gifts from distinct gifters within 30 days of fund creation.

Primary guardrails:
- Gift checkout completion (30d): target >= 15%.
- Share-to-gift rate (30d): target >= 20%.
- Median time to first gift: target <= 3 days.
- Contribution margin: positive and improving, with channel split visible.

## Operating Rules

1. Every skill below has one owner and one primary metric.
2. No roadmap item ships without a linked skill and metric.
3. Run 3-6 week experiment cycles, not open-ended initiatives.
4. Keep "what changed" and "what moved" tied together each Friday.

---

## Skills (Kora-specific)

### 1) First Session Value
- Goal: Parent creates fund and shares a live link within the first session.
- Product surfaces:
  - `client/src/pages/GetStarted.tsx`
  - `client/src/pages/Dashboard.tsx` (Guided Launch)
- Primary metric:
  - `time_to_first_share` (median hours from fund creation to first share signal).
- Owner: Product + Frontend.
- Weekly check:
  - % of new funds with share signal within 24h.

### 2) Guided Launch Completion
- Goal: Complete flow `Create Fund -> Create Event -> Share Link`.
- Product surfaces:
  - `client/src/pages/Dashboard.tsx`
  - `client/src/pages/EventCreate.tsx`
- Primary metric:
  - Guided Launch completion rate within 48h.
- Owner: Frontend.
- Weekly check:
  - Step drop-off by stage.

### 3) Share Loop Compounding
- Goal: Make every successful gift trigger another share action.
- Product surfaces:
  - `client/src/pages/GiftSuccess.tsx`
  - `client/src/components/ui/share-kit.tsx`
- Primary metric:
  - Shares per successful gift.
- Owner: Growth + Frontend.
- Weekly check:
  - `share` and `copy_link` events after gift success.

### 4) Checkout Friction Removal
- Goal: Reduce starts that do not reach completion.
- Product surfaces:
  - `client/src/pages/GiftCheckout.tsx`
- Primary metric:
  - Checkout completion rate (7d and 30d).
- Owner: Growth + Frontend.
- Weekly check:
  - Top abandonment points by step and payment method.

### 5) Lifecycle Signal Automation
- Goal: Act on intent signals quickly with in-app nudges.
- Backend surfaces:
  - `server/routes.ts` (`/api/referrals/events`)
  - `activities` and `audit_logs` writes.
- Primary metric:
  - Actioned lifecycle signals (nudges created) and cooldown compliance.
- Owner: Backend.
- Weekly check:
  - Signal counts:
    - `first_gift_received`
    - `event_created_no_share_24h`
    - `share_no_checkout_48h`
    - `no_gift_14d`

### 6) Memory and Thank-You Loop
- Goal: Convert gift moment into emotional retention.
- Product surfaces:
  - `client/src/pages/MemoryBook.tsx`
  - `client/src/components/ThankYouManager.tsx`
- Primary metric:
  - % successful gifts with memory + thank-you action in 7 days.
- Owner: Product + Frontend.
- Weekly check:
  - Missing memory count, thank-you draft/send rate.

### 7) Pricing and Entitlement Clarity
- Goal: No ambiguity in Free vs Starter vs Family behavior.
- Product surfaces:
  - `client/src/pages/Settings.tsx`
  - `client/src/pages/ActivateInvesting.tsx`
  - `client/src/pages/Home.tsx` pricing section.
- Backend surfaces:
  - `server/webhookHandlers.ts` overlap cleanup.
  - subscription and fund membership endpoints.
- Primary metric:
  - Billing-related support/error incidents.
- Owner: Product + Backend.
- Weekly check:
  - Starter per-fund and Family-all-funds state transitions spot-check.

### 8) Admin Truth and Explainability
- Goal: Every KPI card maps to underlying records and reconciles.
- Product surfaces:
  - `client/src/pages/Admin.tsx`
- Backend surfaces:
  - `server/routes.ts` (`/api/admin/overview`, diagnostics).
- Primary metric:
  - Data integrity checks green rate.
- Owner: Backend + Data.
- Weekly check:
  - Reconciliation deltas:
    - Gifts vs Transactions gross
    - Invested vs Holdings value
    - Pending gift net vs fund pending balances

### 9) Unit Economics Discipline
- Goal: Keep channel economics visible and decision-ready.
- Product surfaces:
  - `client/src/pages/Admin.tsx` Unit Economics section.
- Primary metric:
  - Estimated contribution margin %, by channel.
- Owner: Finance/Ops + Backend.
- Weekly check:
  - Platform revenue, processing pass-through, store-fee estimates.

### 10) Event Monetization Fit
- Goal: Event Boost and Starter/Family choices are intuitive and fair.
- Product surfaces:
  - `client/src/pages/Events.tsx`
  - `client/src/pages/EventCreate.tsx`
  - `client/src/pages/Settings.tsx`
- Primary metric:
  - Boost purchase conversion and post-purchase event creation rate.
- Owner: Product.
- Weekly check:
  - Paid event created now vs "save for later" usage.

### 11) Retention and Re-activation
- Goal: Bring hosts back before momentum dies.
- Product surfaces:
  - Dashboard and Activity nudges.
- Primary metric:
  - 14-day and 30-day returning host rate.
- Owner: Growth.
- Weekly check:
  - `no_gift_14d` signal volume and recovery rate within 7 days.

### 12) Distribution Through Trust Content
- Goal: Increase non-paid fund creation and first-gift conversion.
- Product surfaces:
  - Landing and social proof modules.
- Primary metric:
  - Non-paid new funds % and non-paid first-gift rate.
- Owner: Growth + Marketing.
- Weekly check:
  - Source-level new funds, first gift, and AFRG conversion.

---

## Scorecard (Weekly)

Track these every Friday:

1. AFRG rate (30d).
2. Median time to first gift.
3. Share-to-gift rate.
4. Checkout completion.
5. Lifecycle signal counts and recovery rates.
6. Contribution margin % (overall and by channel).
7. Data integrity status (green/yellow/red).

## Review Ritual (Use This Template)

### Monday (30 min)
- What moved last week:
  - Metric:
  - Delta:
  - Suspected cause:
- Top 3 priorities this week:
  1.
  2.
  3.
- Risks:
  - Reliability risk:
  - Growth risk:
  - Billing risk:

### Wednesday (20 min)
- Experiment check:
  - Keep / adjust / stop.
- Incident check:
  - Any red health or integrity items?

### Friday (40 min)
- Shipped:
  - Feature/experiment:
  - Linked skill #:
- Outcome:
  - Metric moved? yes/no
  - If no, what did we learn?
- Next action:
  - Scale / iterate / revert.

---

## Stop Doing List

- Shipping work without a metric owner.
- Adding monetization complexity before entitlement clarity.
- Treating admin metrics as decorative.
- Using vanity growth metrics without retention/economics context.

