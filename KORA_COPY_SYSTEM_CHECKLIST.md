# Kora Copy + System Checklist

Updated: 2026-03-04

This is the canonical QA checklist for copy clarity, trust language, and pricing/system consistency.

## 1) Pricing + Entitlements

- `Free`: `$2 platform fee per gift`.
- `Starter`: `$5/month per fund` (fund-specific entitlement).
- `Family`: `$12/month` or `$119/year` (all-fund entitlement).
- `Event Boost`: `$29 one-time`, event-scoped fee waiver + premium event features.
- Family activation should show Starter overlaps as cancel-at-period-end when present.

## 2) Onboarding / Activate Investing

Screen: `client/src/pages/ActivateInvesting.tsx`

- Strategy copy must clearly explain:
  - Starter unlocks custom allocation **per fund**.
  - Family unlocks custom allocation **across all funds**.
- Inline upgrade CTAs from strategy step should remain available.
- Agreement row must include clickable `Account Agreement` link.
- Trust note should state:
  - SIPC protects broker failure.
  - SIPC does not protect market losses.

## 3) Settings / Membership

Screen: `client/src/pages/Settings.tsx`

- Billing model text should be explicit:
  - Starter purchased per selected fund.
  - Family covers all funds on account.
- Include a concrete math example:
  - `3 Starter funds = $15/mo` vs `Family = $12/mo`.
- Keep troubleshooting actions under `Troubleshoot billing` (collapsed by default).

## 4) Gift Checkout Fee Summary

Screen: `client/src/pages/GiftCheckout.tsx`

- Order summary must show:
  - Gift amount
  - Stripe processing fee
  - Kora platform fee
  - Total charge
  - Net to recipient/fund
- Fee labels should clearly indicate who charges each fee.
- Footer trust line must include:
  - Not FDIC insured.
  - SIPC scope limitation.

## 5) Trust and Safety Language

Avoid:
- “Guaranteed returns”
- Any wording implying FDIC covers investments
- Vague “insured” without context

Preferred:
- “SIPC up to $500,000” + scope clarification.
- “May lose value” for investments.
- “Assets held at DriveWealth, LLC, Member FINRA/SIPC.”

## 6) Activity Reliability

Screens:
- `client/src/pages/Activity.tsx`
- `client/src/pages/ActivityDetail.tsx`
- API: `server/routes.ts` (`/api/activities*`)

- Must survive legacy/partial rows:
  - Missing `type`
  - Missing `title`
  - Invalid dates
  - Missing related fund records
- UI should render fallback labels instead of blank/crash states.

## 7) Validation Commands

- Typecheck: `npm run check`
- Smoke: `npm run test:smoke`
- Stripe flow checks (local test mode): `npm run test:stripe-pipeline`
