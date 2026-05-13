# Kora Execution Board (Now / Next / Later)

Updated: 2026-02-27

Companion docs:
- `SPRINT_CHECKLIST.md`
- `WEEK1_TICKETS.md`
- `KORA_GROWTH_PLAYBOOK.md`
- `KORA_GROWTH_TICKET_PACK.md`

## North Star

`AFRG` = Activated Fund with Repeat Gifting.

Definition:
- Gift #1 succeeds.
- Gift #2 succeeds from a distinct gifter.
- Both within 30 days of fund creation.

## Primary Targets (next 90 days)

- `KYC completion rate`: >= 40%.
- `Gift checkout completion`: >= 15%.
- `Share-to-gift rate`: >= 20%.
- `AFRG rate`: >= 25% of activated funds.
- `Median time to first gift`: <= 3 days.
- `Gift->memory linkage`: 100%.

## Now (Weeks 1-2)

### 1) Reliability hardening
- Owner: Backend
- Goal: Stripe gift flow and webhook processing are deterministic.
- Tasks:
  - Enforce gift webhook idempotency by `payment_intent` and event id.
  - Ensure gift lifecycle status transitions are valid and one-way.
  - Add dead-letter style logging for failed webhook handlers.
  - Add alert counters for `pending > 1h`, `pending > 24h`, `processing > 10m`.
- Success criteria:
  - No duplicate gift rows from webhook retries.
  - 0 silent webhook failures in logs for 7 consecutive days.

### 2) Data integrity and reconciliation
- Owner: Backend + Data
- Goal: Numbers match across Funds, Gifts, Transactions, Assets.
- Tasks:
  - Nightly reconciliation job for:
    - `Gift gross` vs `Transaction gross`.
    - `Funds invested` vs `Holdings value`.
    - `Pending gift net` vs `Fund pending balances`.
  - Emit red/yellow/green admin status with delta thresholds.
- Success criteria:
  - Delta within +/- $0.01 for 99% of days.
  - Integrity card always populated, never empty.

### 3) Activation and first gift instrumentation
- Owner: Growth + Frontend
- Goal: Full funnel visibility from fund creation to first/second gift.
- Tasks:
  - Track:
    - `fund_created`
    - `fund_shared`
    - `gift_checkout_started`
    - `gift_checkout_completed`
    - `gift_invested`
    - `memory_entry_created`
  - Add admin funnel cards with 7d/30d cohorts.
- Success criteria:
  - 100% event coverage on new sessions.
  - AFRG cohort table visible in Admin Overview.

## Next (Weeks 3-6)

### 4) Conversion and UX cleanup
- Owner: Frontend
- Goal: Reduce checkout drop-off and mobile friction.
- Tasks:
  - Validate sender email before checkout session creation.
  - Keep fee breakdown readable and stable on mobile.
  - Tighten CTA density for share/event/memory actions on small screens.
  - Keep projection assumptions consistent (`5/7/9`) across pages.
- Success criteria:
  - Checkout errors from validation drop by >= 80%.
  - Mobile completion rate improves >= 20% from baseline.

### 5) Memory Book loop and thank-you flow
- Owner: Frontend + Backend
- Goal: Emotional loop is complete and reliable.
- Tasks:
  - Guarantee memory entry generation for every successful gift.
  - Add clear host CTA: `Thank sender` from memory/gift views.
  - Make thank-you status explicit (`draft`, `sent`, `failed`).
- Success criteria:
  - `Gifts Missing Memory` = 0.
  - >= 50% of gifts have thank-you action within 7 days.

### 6) Admin depth and operability
- Owner: Frontend + Backend
- Goal: Admin is operationally complete and actionable.
- Tasks:
  - Make core KPI cards click-through to filtered detail views.
  - Add list-level saved filters and quick exports.
  - Ensure all tabs have non-empty states with guidance.
  - Add super-admin controls with confirmation guards and audit logs.
- Success criteria:
  - No crashing tabs.
  - Every KPI card links to explainable underlying records.

## Later (Weeks 7-12)

### 7) Growth distribution engine
- Owner: Growth
- Goal: Build repeatable acquisition loops beyond paid traffic.
- Tasks:
  - Founder-led content cadence (2-3 posts/week).
  - 1 weekly short demo video for social.
  - Creator pilot with 10 relevant parent/family finance creators.
  - Track source-level conversion to first gift and AFRG.
- Success criteria:
  - >= 30% of new funds from non-paid channels.
  - Creator channel reaches >= 10% of first gifts.

### 8) Product-led retention loops
- Owner: Product + Frontend
- Goal: Improve habitual re-engagement.
- Tasks:
  - Host reminders before key events.
  - Gifter reactivation prompts after successful gifts.
  - In-product milestones for fund growth and memory moments.
- Success criteria:
  - Repeat gifter rate >= 20%.
  - Fund monthly return visits >= 2 per active host.

## Weekly Operating Rhythm

- Monday:
  - Review previous week KPIs and integrity deltas.
  - Confirm top 3 priorities for the sprint week.
- Wednesday:
  - Mid-week risk review (webhooks, checkout errors, admin regressions).
- Friday:
  - Ship review.
  - KPI readout against targets.
  - Update this board.

## Owner Map

- Product: feature prioritization, retention loops, UX decisions.
- Frontend: UI/UX quality, instrumentation wiring, mobile polish.
- Backend: webhook correctness, ledger integrity, reconciliation jobs.
- Data/Growth: funnel analysis, cohort health, distribution experiments.
- Ops/Support: incident response, admin workflows, audit trails.

## Kill Criteria (if unmet by day 90)

- KYC completion remains < 25%.
- Gift checkout completion remains < 10%.
- AFRG rate remains < 10%.

If two or more kill criteria are true, pause feature expansion and run a 2-week reliability + funnel recovery sprint only.
