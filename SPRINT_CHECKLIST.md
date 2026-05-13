# Kora Sprint Checklist (90 Days)

Updated: 2026-02-27

Cadence: 2-week sprints, 6 total.

## Sprint 1 (Weeks 1-2) - Reliability Foundation

- [ ] Webhook idempotency enforced for gift lifecycle.
- [ ] Gift state machine validated (`pending -> processing -> invested/failed/settled`).
- [ ] Failed webhook events surfaced with retry visibility in Admin.
- [ ] Integrity checks always populated on Admin Overview.
- [ ] Core funnel events emitted (`fund_created`, `fund_shared`, `checkout_started`, `checkout_completed`, `gift_invested`, `memory_created`).
- [ ] Release note posted with known limitations.

Exit criteria:
- 0 duplicate gifts from webhook replays.
- 0 crashing admin tabs.
- KPI integrity card shows live data and deltas.

## Sprint 2 (Weeks 3-4) - Conversion and Mobile UX

- [ ] Checkout input guardrails tightened (email, amount, execution model).
- [ ] Mobile CTA crowding reduced on Fund and Gift pages.
- [ ] Fee breakdown readability validated at narrow widths.
- [ ] Projection assumptions consistent across all projection surfaces.
- [ ] Error copy normalized and actionable.

Exit criteria:
- Checkout error rate down >= 50% from Sprint 1 baseline.
- Mobile gift completion up >= 15% from baseline.

## Sprint 3 (Weeks 5-6) - Memory and Thank-You Loop

- [ ] Every successful gift links to a memory entry.
- [ ] Thank-you flow shows explicit status (`draft`, `sent`, `failed`).
- [ ] Gift success page and Memory Book entry are coherent and cross-linked.
- [ ] Admin diagnostics for missing memory/thank-you stay green.

Exit criteria:
- `Gifts Missing Memory` = 0 for 7 consecutive days.
- >= 50% thank-you action rate within 7 days of gift.

## Sprint 4 (Weeks 7-8) - Admin Depth and Controls

- [ ] KPI cards open filtered detail views.
- [ ] User/Fund/Gifter detail panels show useful histories.
- [ ] CSV export parity across major tabs.
- [ ] Sensitive inline actions require confirmation + audit logging.
- [ ] Config tab supports safe edits for universe/strategies.

Exit criteria:
- Admin supports day-to-day ops without manual DB intervention.
- No “empty detail page” regressions.

## Sprint 5 (Weeks 9-10) - Growth Distribution Engine

- [ ] Source-level attribution visible for key acquisition events.
- [ ] Founder content cadence instrumented and tracked.
- [ ] Creator pilot tracking in admin/growth reporting.
- [ ] Share-to-gift diagnostics include channel splits.

Exit criteria:
- >= 20% new funds from non-paid channels.
- Clear winner channel identified with reliable conversion data.

## Sprint 6 (Weeks 11-12) - Product-Led Retention Loops

- [ ] Host re-engagement triggers (event reminders, milestone nudges).
- [ ] Gifter reactivation prompts after successful gifts.
- [ ] Cohort retention chart (12 weeks) populated and usable.
- [ ] AFRG trend monitored by cohort start week.

Exit criteria:
- Repeat gifter rate >= 20%.
- AFRG rate >= 25%.
- Median time to first gift <= 3 days.

## Weekly Ritual Checklist

- [ ] Monday KPI review and sprint risk check.
- [ ] Wednesday production issue triage.
- [ ] Friday ship review + target scorecard update.

