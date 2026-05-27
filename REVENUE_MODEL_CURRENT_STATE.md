# Revenue Model Current State

> ⚠️ SUPERSEDED 2026-05-26 by `REVENUE_MODEL.md`. STALE — kept for history only.
> It describes the PRE-pricing-v3 model: gifter contribution fees ($2 flat /
> 1% over $200) and a large-gift fee that are all RETIRED (those constants are
> `0` in `shared/monetization.ts` — **gifters never pay**), plus old prices
> ("Kado+ $4.99 / Kado Family $12") and the old "Kado" name. Do not treat
> anything below as current. Current truth: `REVENUE_MODEL.md`.

Internal decision memo for Kado's revenue model.

This document separates:
- current implementation truth
- current product-facing pricing language
- future platform-aware revenue strategy

## Core Revenue Model

Kado's revenue model has three main streams:

1. `Subscriptions`
2. `Platform fees on Free-plan contributions`
3. `Large-gift processing fees`

That overall structure is stable.

## Stream 1: Subscriptions

Current subscription product surfaces:
- `Kado+`
- `Kado Family`

### Product-facing pricing language used in most current UI/docs

- `Kado+`: `$4.99/month` or `$44.99/year`
- `Kado Family`: `$12/month` or `$119/year`

Repo examples:
- [FAQ.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/FAQ.tsx)
- [Legal.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Legal.tsx)
- [Pricing.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Pricing.tsx)
- [Settings.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Settings.tsx)

### Important current inconsistency

The shared monetization constants do not fully match the current product-facing language.

In [monetization.ts](/abs/path/c:/Apps/Kora%20(newest)/shared/monetization.ts):
- `KORA_STARTER_MONTHLY = 4.99`
- `KORA_FAMILY_MONTHLY = 9.99`
- `KORA_FAMILY_YEARLY_OPTIONS = [89.99]`

So the repo currently has a mismatch between:
- pricing/constants logic
- user-facing pricing copy

This should be treated as an implementation inconsistency, not as a strategy ambiguity.

## Stream 2: Free-Plan Contribution Fees

Free-plan contribution fee rules currently encoded in [monetization.ts](/abs/path/c:/Apps/Kora%20(newest)/shared/monetization.ts):

- `$2` flat fee on gifts up to `$200`
- `1%` fee above `$200`

This is part of the core monetization model and is already implemented in shared fee logic.

## Stream 3: Large-Gift Processing Fee

Current shared rule in [monetization.ts](/abs/path/c:/Apps/Kora%20(newest)/shared/monetization.ts):

- gifts at or above `$10,000`
- incur a separate `0.1%` large-gift processing fee

This applies across plans in the current fee model.

## Payment Processor Reality

Today Kado is functionally:

- `Stripe-first`

That means:
- gifter checkout is Stripe-backed
- web subscription checkout is Stripe-backed
- billing portal flows are Stripe-backed

Related reference:
- [PAYMENT_PLATFORM_ARCHITECTURE_CURRENT_STATE.md](/abs/path/c:/Apps/Kora%20(newest)/PAYMENT_PLATFORM_ARCHITECTURE_CURRENT_STATE.md)

## Platform-Aware Revenue Strategy

Long term, if the parent mobile app introduces app-store subscriptions, subscription economics become channel-aware.

That affects:
- subscription margin
- upgrade UX
- pricing communication

It does not change:
- Free-plan fee logic
- gifter contribution fee logic
- large-gift fee logic

So the platform decision changes subscription margin, not the entire revenue model.

## Current Repo-Aligned Truth

### Already true

- the model has three revenue streams
- free-plan contribution fees are implemented
- large-gift fee logic is implemented
- Stripe is the current revenue backbone

### Not yet true

- StoreKit pricing logic exists in the repo
- Google Play Billing exists in the repo
- channel-specific subscription pricing is implemented in product logic

## Recommended Interpretation

When discussing the revenue model internally:

### Treat as settled

- `three revenue streams`
- `Stripe-first current implementation`
- `gifter contributions remain outside app-store economics`

### Treat as current cleanup work

- align shared pricing constants with the product-facing pricing story

### Treat as future-state strategy

- app-store subscription mix
- web-vs-app subscription price optimization
- hybrid billing channel strategy after native app launch

## Final Call

The clean current statement is:

- `Revenue model = subscriptions + free-plan contribution fees + large-gift fees`
- `Current processor reality = Stripe-first`
- `Current pricing reality in repo = partially inconsistent and should be aligned`
- `Future app-store effects = subscription-margin layer, not a rewrite of the whole model`
