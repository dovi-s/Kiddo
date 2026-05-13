# Mobile App First Monorepo Plan

This document locks the product and repo direction:

- mobile app is the primary product
- marketing website is the conversion surface
- desktop and tablet web app are secondary support surfaces
- the gifter flow stays web-first and link-first

## What Is True Today

The current repo is still a single web application with:

- `client/` for the React frontend
- `server/` for the Express backend
- `shared/` for shared schema and pricing logic

That means the repo is not yet structured like the product strategy.

## What We Are Moving Toward

Target repo shape:

```text
kora/
├── apps/
│   ├── web/         # marketing site + logged-in web app + gifter flow
│   └── mobile/      # Expo / React Native app for iOS and Android
├── packages/
│   ├── api/         # typed API client and endpoint wrappers
│   ├── tokens/      # colors, spacing, typography, motion tokens
│   ├── types/       # shared product and API types
│   └── utils/       # business logic and pure helpers
├── server/          # backend can stay here initially
└── shared/          # existing schema layer, then gradually slimmed down
```

## Surface Ownership

### `apps/mobile`

Primary product for:

- parent onboarding
- dashboard
- activity
- fund management
- memory book
- events
- profile and settings
- age-18 transition surfaces

### `apps/web`

Primary product for:

- homepage and marketing pages
- SEO pages
- comparison pages
- stories and blog
- web login
- desktop and tablet support experience
- gifter checkout and gift pages

### Gifter Flow Rule

The gifter flow should stay web-first unless there is a compelling reason to move it:

- no app download
- no account required
- fast load
- link-friendly
- QR-friendly

That means the mobile app is not the entry point for gift-givers.

## What Should Be Shared

Share these:

- design tokens
- API wrappers
- TypeScript types
- validation
- pricing logic
- formatting utilities
- product math like growth projections

Do not aggressively share these:

- UI components
- routing
- navigation
- platform-specific interaction patterns
- mobile-only hardware integrations

## Migration Principle

Do not pause product work for a giant rewrite.

Instead:

1. keep the current web app shipping
2. extract pure shared logic into `packages/*`
3. create the native app shell
4. rebuild the highest-value parent flows natively first

## Native Build Order

### Phase 1

- welcome and auth shell
- onboarding
- dashboard home
- fund detail
- share fund link

### Phase 2

- events
- memory book
- activity
- settings

### Phase 3

- push notifications
- haptics
- deep links
- age-18 transition experience

## Near-Term Rule For This Repo

Until the native app ships, web should still be designed as if mobile is the primary surface.

That means:

- mobile layout decisions win
- desktop gets adaptation, not product priority
- onboarding, nav, and key parent actions should be optimized for phone-first use

## Deliverables In This Repo

This repo now includes:

- this architecture decision doc
- a current-to-target migration map
- an initial `apps/mobile` scaffold
- initial `packages/*` scaffolds for future extraction work

Those scaffolds are not a shipped native app yet. They are the starting line.
