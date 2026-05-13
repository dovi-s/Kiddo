# Kora Design Guardrails

## Purpose
Keep product decisions consistent across onboarding, checkout, settings, dashboard, and trust surfaces so growth improvements do not degrade clarity, compliance, or user trust.

## 1) Trust And Safety Language
- Always separate protections:
  - Investments: SIPC up to $500,000 at brokerage custodian.
  - Cash accounts: FDIC where applicable.
- Always include: SIPC does not protect against market losses.
- Never imply Kora itself is the custodian.
- Prefer explicit wording over implied safety claims.

## 2) Fee Disclosure Hierarchy
- Use the same order everywhere:
  1. Gift amount
  2. Processing fee (Stripe/payment rail)
  3. Kora platform fee
  4. Net to fund or total charged
- Free plan copy: "$2 platform fee per gift."
- Starter copy: "$5/month per selected fund."
- Family copy: "$12/month or $119/year for all funds on account."
- If fee is waived, show why ("waived by Event Boost", "waived by host plan"), not just $0.00.

## 3) Plan Scope Consistency
- Starter entitlement is fund-specific.
- Family entitlement is account-wide across all funds.
- Family overrides Starter fee behavior while active.
- Any billing UI touching Starter must include fund selection context.

## 4) Funnel UX Requirements
- Onboarding must expose clear next action and completion state.
- Checkout must keep fee summary visible near pay CTA.
- Progressive disclosure allowed, but final charge impact must remain obvious.
- Activity and diagnostics surfaces must degrade safely (null guards, retries, non-crashing fallback copy).

## 5) Admin UX Scorecard Minimums
Track and display, at minimum:
- Onboarding completion
- Checkout completion by funnel step
- Trust education interaction rate (tooltip CTR)
- Reactivation recovery rate

All metrics must render with safe defaults when telemetry is sparse.

## 6) Content Style
- Prefer specific numbers and examples over abstract claims.
- Avoid conflicting plan descriptions across pages.
- Use "platform fee" consistently (not mixed with ambiguous "service fee" unless intentionally differentiated).

## 7) Accessibility And Motion
- Every metric block must remain readable without color alone.
- Keep motion subtle and optional; no animation should block comprehension.
- Interactive controls require clear labels and keyboard focus visibility.
- Respect `prefers-reduced-motion` in all key flows.
- Financial action feedback should be calm, deterministic, and short.
- Avoid heavy decorative animation during checkout, billing, and trust disclosures.

## 8) Motion Performance Budget
- Prioritize `transform` and `opacity` for transitions.
- Keep launch/onboarding animation payload lightweight.
- No critical action should depend on long-running animation to complete.
- Loading animations must include clear text state for slower networks/devices.

## 9) Release Checklist Hooks
Before each release:
- Run `npm run audit:copy`
- Manually verify fee summary and trust disclaimers on:
  - `ActivateInvesting`
  - `Settings`
  - `GiftCheckout`
  - `FAQ`
  - Footer legal line
- Verify Admin overview loads with no runtime errors and UX scorecard cards show values or safe zero states.
- Verify reduced-motion behavior on Dashboard, Checkout, and Settings.
