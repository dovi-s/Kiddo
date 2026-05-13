# Week 3 Ticket Pack

Updated: 2026-02-27

Legend:
- Priority: `P0` critical, `P1` high, `P2` medium.
- Status: `todo`, `in_progress`, `blocked`, `done`.

## KORA-W3-001 - Gift to Memory linkage contract tests
- Priority: P0
- Owner: Backend
- Status: todo
- Estimate: 1 day
- Goal: Guarantee successful gifts always create or attach a memory entry.
- Acceptance:
  - Contract test passes for gift success webhook path.
  - No new `Gifts Missing Memory` in 7-day diagnostics.

## KORA-W3-002 - Memory Book media rendering hardening
- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 1 day
- Goal: Ensure text/image/video entries render predictably on web + mobile.
- Acceptance:
  - No media rendering crashes.
  - Fallback states shown for invalid media URLs.

## KORA-W3-003 - Thank-you workflow status model
- Priority: P0
- Owner: Backend + Frontend
- Status: todo
- Estimate: 1.5 days
- Goal: Make thank-you lifecycle explicit (`draft`, `sent`, `failed`).
- Acceptance:
  - Status visible in UI and admin diagnostics.
  - Failed sends are retryable.

## KORA-W3-004 - Gift success page data accuracy pass
- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 0.75 day
- Goal: Ensure success page reflects actual execution model and amount.
- Acceptance:
  - No `$0` confirmations for paid gifts.
  - Stock-pick gifts show chosen ticker when applicable.

## KORA-W3-005 - Memory Book cross-linking from gifts
- Priority: P1
- Owner: Frontend
- Status: todo
- Estimate: 0.75 day
- Goal: Let hosts open related memory entry from recent gift row.
- Acceptance:
  - Gift row includes “View memory” when linked.
  - Link opens correct memory entry.

## KORA-W3-006 - Thank-you CTA placement optimization
- Priority: P2
- Owner: Product + Frontend
- Status: todo
- Estimate: 0.5 day
- Goal: Improve thank-you action rate with better CTA placement.
- Acceptance:
  - CTA present in Memory Book and gift detail contexts.
  - Thank-you action rate improves from Week 2 baseline.

## KORA-W3-007 - Admin diagnostics for thank-you gaps
- Priority: P1
- Owner: Backend + Admin Frontend
- Status: todo
- Estimate: 0.5 day
- Goal: Surface `Gifts Missing Thank-You` with filters and drill-down.
- Acceptance:
  - Metric links to affected gift records.
  - Drill-down supports CSV export.

## KORA-W3-008 - Week 3 loop scorecard
- Priority: P1
- Owner: Growth + Data
- Status: todo
- Estimate: 0.5 day
- Goal: Publish loop health report (memory + thank-you completion).
- Acceptance:
  - Weekly report includes trend and deltas.
  - Shared with team on Friday cadence.

