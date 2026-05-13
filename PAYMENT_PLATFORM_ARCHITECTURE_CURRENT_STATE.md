# Payment Platform Architecture

Internal decision memo for Kado's payment stack and platform-specific billing strategy.

This document separates:
- what is true in the current repo
- what the product strategy should be
- what changes when the mobile app ships

## Current Repo Reality

Today the repo already supports:
- `Stripe` for gifter checkout
- `Stripe` for plan upgrade checkout on web
- `Stripe` billing portal flows
- Stripe webhook handling for subscriptions and gift checkout lifecycle

Today the repo does not support:
- `StoreKit` for iOS subscriptions
- `Google Play Billing`
- native in-app purchase flows
- a separate native mobile billing implementation

That means the current system is still:

## `web + Stripe first`

even if the long-term product direction is mobile app first for parents.

## The Three Payment Flows

Kado has three meaningfully different payment flows and they should not be treated as one thing.

### 1. Gifter Contributions

Examples:
- grandma gifts `$50`
- a birthday guest contributes `$100`
- a large gift above `$10,000`

Correct processor:
- `Stripe`

Why:
- this is the core product flow
- it is already browser-based
- it is already implemented in the repo
- it is a real money movement flow, not a digital unlock

Repo evidence:
- `server/stripeService.ts`
- `server/routes.ts` gift checkout endpoints
- [GiftCheckout.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/GiftCheckout.tsx)

Decision:
- keep gifter contributions on Stripe
- do not move this into App Store or Play billing logic
- continue treating it as the separate, browser-native surface

### 2. Parent Subscriptions

Examples:
- `Kado+`
- `Kado Family`

Correct current processor:
- `Stripe` on web

Repo evidence:
- starter/family checkout endpoints exist
- billing portal exists
- subscription sync, cancel, and reactivate flows are already Stripe-backed

Decision today:
- subscription billing remains Stripe-backed in the current product

Decision later:
- native parent app may introduce StoreKit / Google Play Billing for convenience
- but that is an added layer, not the current system

### 3. Large-Gift / Fee Logic

Examples:
- high-value gift processing
- Kado contribution fee logic

Correct processor:
- `Stripe`

Repo evidence:
- fee calculation is implemented in [monetization.ts](/abs/path/c:/Apps/Kora%20(newest)/shared/monetization.ts)
- checkout and fee display flows are already tied to Stripe-backed payment behavior

Decision:
- keep this inside the Stripe-based financial flow

## Recommended Long-Term Architecture

### Gifter Product

Platform:
- mobile web

Payments:
- Stripe only

Why:
- no app download
- no account creation
- browser-native checkout
- best loop performance

Final decision:
- this never becomes an app-required flow

### Parent Product on Web

Platform:
- responsive web

Payments:
- Stripe for subscriptions

Why:
- already implemented
- zero platform tax from app stores
- easiest current monetization path

### Parent Product in Native App

Platform:
- iOS / Android app

Payments:
- either:
  - in-app billing for native convenience
  - or app-to-web upgrade handling
  - or a hybrid of both

But this is future-state, not current-state.

## The Most Important Separation

Do not conflate:
- `gifter money movement`
with
- `parent subscription billing`

They have different economics, different constraints, and different product goals.

### Gifter flow

Optimize for:
- trust
- speed
- Apple Pay / Google Pay visibility
- zero friction

### Parent subscription flow

Optimize for:
- monetization
- retained margin
- upgrade conversion
- platform strategy

## Repo-Aligned Truths

### True now

- Stripe is the real backbone of the product
- gift checkout is already correctly web-first
- subscription checkout is already implemented through Stripe-backed web flows

### Not true yet

- StoreKit is implemented
- Google Play Billing is implemented
- hybrid app-store billing logic exists in the codebase

## Suggested Product Decision

### Right now

- keep all subscriptions web-first through Stripe
- keep all gifting on Stripe
- keep the gifter flow web-native

### When the parent mobile app ships

Decide one of these explicitly:

1. `Web subscriptions only`
2. `Native in-app subscriptions only`
3. `Hybrid`

That should be a deliberate revenue decision, not an accidental platform default.

## Engineering Recommendation

Do not prematurely build billing complexity for a native app that does not exist yet.

Instead:
- keep Stripe web billing robust
- keep gift checkout world-class
- document the future mobile subscription options before implementation

## Final Call

The clean architecture for Kado is:

- `gifter contributions = Stripe`
- `web subscriptions = Stripe`
- `native subscriptions = future decision layer`

So the correct current statement is:

## Kado is Stripe-first today, with app-store billing as a future parent-app decision, not a current dependency.
