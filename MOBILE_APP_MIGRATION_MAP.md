# Mobile App Migration Map

This file maps the current repo into the future mobile-first monorepo.

## Current To Target

### Current frontend

```text
client/src/
```

Target split:

```text
apps/web/src/
apps/mobile/src/
packages/api/src/
packages/tokens/src/
packages/types/src/
packages/utils/src/
```

## Keep In Web

These should stay web-owned:

- `client/src/pages/Home.tsx`
- `client/src/pages/About.tsx`
- `client/src/pages/Pricing.tsx`
- `client/src/pages/FAQ.tsx`
- `client/src/pages/Compare.tsx`
- `client/src/pages/Blog.tsx`
- `client/src/pages/BlogPost.tsx`
- `client/src/pages/Stories.tsx`
- `client/src/pages/StoryPage.tsx`
- `client/src/pages/Security.tsx`
- `client/src/pages/Contact.tsx`
- `client/src/pages/PersonalFunds.tsx`
- `client/src/pages/Age18.tsx`
- `client/src/content/**`

Also keep web-first:

- `client/src/pages/GiftCheckout.tsx`
- `client/src/pages/GiftSuccess.tsx`
- `client/src/pages/GifterShare.tsx`
- `client/src/pages/GiftLookup.tsx`
- `client/src/pages/GifterDashboard.tsx`

Reason:

- SEO matters
- links and QR codes matter
- no-install flows matter

## Rebuild Natively First

These should become mobile app priorities:

- `client/src/pages/GetStarted.tsx`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/Activity.tsx`
- `client/src/pages/ActivityDetail.tsx`
- `client/src/pages/Events.tsx`
- `client/src/pages/EventCreate.tsx`
- `client/src/pages/MemoryBook.tsx`
- `client/src/pages/Profile.tsx`
- `client/src/pages/Settings.tsx`
- `client/src/pages/KidView.tsx`
- `client/src/pages/ActivateInvesting.tsx`
- `client/src/pages/AgeTransitionManager.tsx`
- `client/src/pages/AgeTransitionInvite.tsx`

## Extract To `packages/utils`

Good first extractions:

- `client/src/lib/haptics.ts`
- `client/src/lib/acquisition.ts` shared pieces that are UI-agnostic
- `client/src/lib/age-transition.ts`
- `client/src/lib/utils.ts`
- onboarding helpers now embedded in `client/src/pages/GetStarted.tsx`
- growth/projection helpers

Also:

- `shared/monetization.ts`

## Extract To `packages/types`

Good first extractions:

- API response types currently inferred in page hooks
- fund, event, gift, and activity view models
- auth/session types
- onboarding draft state types

Existing starting point:

- `shared/models/auth.ts`

## Extract To `packages/api`

Good first extractions:

- fund endpoints
- event endpoints
- gift endpoints
- auth provider status fetches
- investment preferences fetch/update

The goal is one typed API layer imported by both web and mobile.

## Extract To `packages/tokens`

Good first extractions:

- color system from `client/src/index.css`
- spacing scale
- radius scale
- motion durations
- typography decisions

## Backend Ownership

These can stay where they are initially:

- `server/**`
- `shared/schema.ts`
- `server/routes.ts`
- `server/auth.ts`
- `server/stripe*.ts`

Native app migration does not require backend migration first.

## First Native Milestone

The first meaningful mobile app release should prove:

1. auth works
2. onboarding works
3. dashboard works
4. fund sharing works

That is enough to prove the architecture and product direction before porting every secondary screen.
