# Platform Strategy

Internal decision memo for Kado's platform direction.

This document reflects the product decision:
- `mobile app first` for parents
- `mobile web forever` for gifters
- `desktop/tablet web second` for deeper parent moments

It also stays honest about the current repo state.

## Current Reality

Today Kado is:
- a web application built with `React + Vite`
- an API-backed product using `Express`
- a responsive experience with strong public mobile-web gifting flows

Today Kado is not yet:
- an iOS app
- an Android app
- an Expo app
- a React Native app

That means the product decision and the current implementation are not the same thing.

The strategy can still be `mobile app first`.
It just means the repo has not caught up yet.

## Core Platform Decision

Kado should support three surfaces:

1. `Parent mobile app`
2. `Parent web app`
3. `Gifter mobile web`

But they do not have equal importance.

The priority order is:

1. `Parent mobile app`
2. `Gifter mobile web`
3. `Parent desktop/tablet web`

## Why Mobile App First

Parents experience Kado emotionally, not administratively.

The important moments are mobile moments:
- a gift notification arrives
- a parent checks the fund from the couch at night
- a birthday event is live and contributions are coming in
- the child view gets opened in the moment
- the Memory Book gets revisited after a gift lands

This is not a desktop-first pattern.

Decision:
- the parent product should be treated as an app product first
- the website is not the center of retention
- the mobile app is the long-term home of the parent relationship

## Why Gifter Stays Mobile Web

The gifter flow is a separate product surface.

Its job is:
- open fast
- feel trustworthy immediately
- complete a gift in under a minute

That means:
- no app download
- no account requirement
- no dependency on being in the parent app ecosystem

Decision:
- gifter experience remains web-first
- optimize for browser performance, one-tap payment, and low friction
- never force gifters into the native app strategy

## Why Web Still Matters

Kado has real parent moments that are better on larger screens:
- Memory Book browsing
- household dashboard review
- multi-fund navigation
- event setup and design
- age-18 transition review
- detailed settings and billing tasks

So web is still important.

But it is not first.

Decision:
- web supports the parent product
- web is the second platform for parents, not the primary one
- desktop/tablet should become excellent after the core mobile app is strong

## Product Framing

Kado is not one product surface.

It is two connected products under one brand.

### Surface A: Gifter Product

Purpose:
- give quickly
- trust quickly
- finish without onboarding

Best platform:
- mobile web

### Surface B: Parent Product

Purpose:
- manage the fund
- track growth
- receive notifications
- revisit the story
- handle milestones and settings

Best platform:
- native mobile app first
- responsive web second

## Repo-Aligned Interpretation

Because the repo is still web-first today, the practical implication is:

- continue shipping the current web product
- do not confuse that with the long-term product center of gravity
- use current web work to inform the native app build

In other words:
- `implementation today = web`
- `product destination = mobile app first`

## Framework Position

The product decision is settled:
- mobile app first

The framework decision is not automatically settled just because of that.

`React Native + Expo` may still be the right choice.
But that is an implementation choice, not the core platform strategy itself.

Decision:
- mobile-first is locked
- framework remains a follow-up engineering decision

## Recommended Build Order

### Phase 1

Focus:
- parent mobile app

Ship:
- iOS parent app
- core dashboard
- Memory Book
- notifications
- child view
- gifting/share actions
- essential settings

### Phase 2

Focus:
- broader parent reach

Ship:
- Android parent app
- stronger shared component architecture
- improved account and fund-management coverage

### Phase 3

Focus:
- deep-screen experiences

Ship:
- responsive desktop/tablet parent web
- multi-fund dashboard optimization
- richer event creation
- larger-screen Memory Book and transition flows

### Continuous

Keep improving:
- gifter mobile web

That work never stops because it powers:
- the viral loop
- the acquisition loop
- the casual contact loop

## What This Means Operationally

### Product

- design parent flows with mobile app behavior in mind
- treat notifications, quick re-entry, and repeated fund checking as core behaviors

### Engineering

- keep current web app stable and shippable
- avoid pretending the native stack already exists
- begin creating a clear boundary between reusable product logic and web-only UI assumptions

### Growth

- keep the gifter flow web-native
- do not let app strategy contaminate gifting simplicity

## Final Call

The platform strategy is:

- `parent = mobile app first`
- `gifter = mobile web`
- `parent desktop/tablet web = second platform, not first platform`

And the current repo reality is:

- the product is still implemented as web today
- so the next major platform move is to build the parent mobile app intentionally, not to keep rationalizing web-first as the destination
