# Kora Mobile Motion 2026 Playbook

Updated: 2026-03-04  
Sources: Mobbin, 60fps.design, SVGator mobile animation patterns, Dribbble motion references.

## Purpose
Use motion to improve comprehension, trust, and conversion in Kora flows, not to add decorative noise.

## Motion principles for Kora
- Motion must explain state change.
- Motion must confirm user input quickly.
- Motion must reduce perceived wait without hiding uncertainty.
- Motion must respect reduced-motion preferences and low-end devices.
- Financial actions require calm, controlled motion, not high-intensity playful effects.

## Core interaction patterns to adopt

## 1) Launch and first paint
- Use short branded splash (sub-700ms visual emphasis).
- Avoid long intro animations before core action.
- Keep logo animation lightweight and skippable by app readiness.

## 2) Onboarding and setup transitions
- Use progressive step transitions with clear directionality.
- Highlight one primary action per step.
- Add subtle continuity between setup cards to reduce cognitive reset.

## 3) CTA/button feedback
- Tap: immediate scale/fill response within 80-140ms.
- Submit: lock state + progress + success/failure resolution.
- Never leave a tap without visible acknowledgment.

## 4) Loading and processing
- Replace static spinners where possible with contextual loading states:
  - "Processing gift"
  - "Setting up checkout"
  - "Applying plan changes"
- Use deterministic fallback text when timing exceeds expected threshold.

## 5) Success and error states
- Success: concise celebratory feedback with short settle animation.
- Error: avoid harsh jank; use calm attention draw + recovery CTA.
- Keep emotional tone reassuring in money flows.

## 6) List/detail and card transitions
- Prefer transform/opacity transitions over layout thrash.
- Preserve continuity when opening fund/event/gift details.
- Ensure reverse navigation feels anchored to source element.

## 7) Tooltip and education motion
- Use short reveal/hide with clear spatial origin.
- Keep trust and fee education overlays stable and readable.
- Track opens/clicks to validate usefulness.

## 8) Empty and waiting states
- Add light illustrative motion only if it communicates next action.
- Pair empty states with explicit CTA ("Share fund link", "Create event").

## Performance constraints
- Target 60fps on common devices in key flows.
- Animate only compositor-friendly properties when possible:
  - `transform`
  - `opacity`
- Avoid heavy blur/mask combinations during critical actions.
- Keep animation payload small, especially for onboarding/launch.

## Accessibility and safety
- Honor `prefers-reduced-motion` with reduced or no movement variants.
- Motion cannot be the only channel for meaning.
- Keep contrast and readability stable during transitions.

## Kora screen-level priorities
- Dashboard:
  - Next-best-action CTA transition feedback.
  - Calm tooltip reveal for trust/assumption explanations.
- Gift Checkout:
  - Step progress continuity.
  - Submit/processing/success/error state clarity.
- Settings Membership:
  - Plan switch confirmation state and cancellation/reactivation feedback.
- Activity:
  - Reliable load/retry transitions without visual jumping.

## Instrumentation events to standardize
- `motion_cta_tap_ack`
- `motion_loading_shown`
- `motion_success_shown`
- `motion_error_shown`
- `trust_tooltip_open`
- `trust_tooltip_click`

Use metadata fields:
- `surface` (`dashboard`, `checkout`, `settings`, `activity`)
- `component`
- `variant`
- `duration_ms` (if available)

## Rollout strategy
1. Ship motion improvements on checkout and settings first.
2. Validate with completion + error recovery metrics.
3. Expand to dashboard and activity after baseline holds.
