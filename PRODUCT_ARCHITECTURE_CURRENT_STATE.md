# Product Architecture Current State

Internal reference for what the repo currently supports as of April 5, 2026.

This file is intentionally split into:
- `live_now`: behavior present in the app/repo today
- `partially_built`: visible in the product but not yet a complete end-to-end system
- `future_state`: product ideas that should not be treated as already implemented

## Plan Language

Use this naming everywhere:
- `Free`
- `Kado+`
- `Kado Family`

Current pricing language in the repo:
- `Free`: platform fee on gifts, no subscription
- `Kado+`: `$4.99/month` or `$44.99/year`, covers one fund at a time
- `Kado Family`: `$12/month` or `$119/year`, covers all funds on the account

## Flows

### Parent Onboarding

`live_now`
- Parents can create an account and complete a multi-step onboarding / get-started flow.
- Child details are collected during fund setup, including date of birth.
- Parents can reach the dashboard before completing full investing activation.
- Identity / investing activation is a separate flow and can be completed later.
- The dashboard shows setup progress and share prompts after fund creation.

`partially_built`
- Setup progress, handoff education, and monetization prompts are present, but not every downstream operational step is fully automated.
- Some launch / activation messaging behaves like a guided launch system, but it is still mostly in-product, not fully lifecycle-driven.

`future_state`
- Full lifecycle email recovery for every onboarding drop-off case.
- Full reverse-trial system with usage-aware expiration messaging.

### Gifter Flow

`live_now`
- Gifters can open a shared gift link without creating an account.
- Gift flow includes amount selection, preview, and payment.
- Plan context and fee transparency are shown during checkout.
- Parent-controlled settings affect whether gifters must follow the default strategy or can choose stock / cash behavior.
- Gift success and confirmation surfaces exist.
- Fund code lookup exists as a backup entry path.

`partially_built`
- Gifter re-engagement and opt-in mechanics exist in pieces, but not every “repeat gifting” lifecycle is complete.
- The flow contains stronger conversion and trust UX than before, but not a full CRM-grade follow-up engine.

`future_state`
- Fully built recurring gifter lifecycle with birthday/holiday campaigns and investment-confirmation personalization for every gift.

### Event Creation

`live_now`
- Parents can create and manage events.
- Event types include `Just Because`, `Birthday`, `Baby Shower`, `Holiday / seasonal`, and others.
- Event limits are enforced by plan.
- Share output exists via event links and QR code.
- Event creation and Events surfaces call out upgrade paths clearly.

`partially_built`
- Premium event customization exists by plan, but not every imagined campaign/share workflow is fully fleshed out.
- Event summaries and post-event follow-up are not a full standalone lifecycle system.

### Identity / Investing Activation

`live_now`
- Investing activation is framed as the step that makes the fund real.
- Parents can postpone activation.
- The product explains that gifts stay in cash until investing is activated.
- Kado+ / Family unlock custom strategy controls.

`partially_built`
- The user experience strongly suggests a verification system and delayed activation state, but not every fallback/manual-review branch is fully represented in product UX.

### Child View

`live_now`
- Child View is PIN-gated from the parent experience.
- The parent controls access.
- The view shows a simplified fund story and Memory Book context.
- A share CTA exists from Child View using the fund’s real gift link.
- Language can be shifted between younger-kid and older-kid framing.

`partially_built`
- This is a polished parent-mediated child experience, but not a separate child account system.

`future_state`
- Fully independent child login, approvals pipeline, and child-authored contribution workflows.

### Memory Book

`live_now`
- Memory Book exists as a core product surface.
- It is monetized behind paid coverage.
- Locked-state teasers are personalized to the actual fund where possible.
- Parents can add entries when coverage is active.
- Entry sharing exists.

`partially_built`
- The app includes prompts and update queuing, but not every imagined automatic entry type or external sharing loop is complete.

### Age-18 Transition

`live_now`
- There is an age-transition / handoff area in-product.
- Age-related transition pages and invite/manager views exist.
- The dashboard and onboarding now surface handoff education more prominently.

`partially_built`
- The trust-building content and UX are present.
- The complete long-horizon operational lifecycle is only partially built.

## Loops

### Share Loop

`live_now`
- The parent dashboard strongly surfaces the shareable fund link.
- Event pages and QR-based sharing exist.
- Gift pages are dynamic, link-driven surfaces rather than nav pages.

### Monetization Loop

`live_now`
- Upgrade prompts appear at feature walls including Memory Book and event limits.
- Post-upgrade return states now show success banners and refresh billing state.
- Settings contains plan management and overlap cleanup for Kado+ vs Kado Family.

### Activity / Re-engagement Loop

`live_now`
- Activity is positioned as the live heartbeat of the fund.
- Lifecycle nudges, Memory Book moments, and gift/investing states are surfaced there.
- A proactive pending-gift explanation now appears contextually.
- Monthly in-app Money Lessons are surfaced based on fund / child context.

`partially_built`
- In-app engagement exists.
- Full email-first retention loops are not comprehensively live across every trigger.

## Permissions

### Parent

`live_now`
- Parents can create and manage funds and events.
- Parents can manage gifting rules.
- Parents can access Child View, Memory Book, settings, age-transition surfaces, and dashboard analytics appropriate to plan.

### Gifter

`live_now`
- Gifters do not need an account.
- Gifters can give through direct links or fund code lookup.
- Gifters can follow the family default or use additional options if the parent has enabled them.

### Child

`live_now`
- Child access is mediated through the parent-controlled PIN experience.
- Child View is primarily read-oriented.

`future_state`
- Rich child-generated content/approval systems should be treated as proposed, not current.

## Plan Allocation Matrix

| Capability | Free | Kado+ | Kado Family |
|---|---|---|---|
| Fund coverage model | Free rules | One fund at a time | All funds |
| Standard Kado fee removed | No | Yes, for covered fund | Yes, for all covered funds |
| Active event slots | 1 | 3 | Unlimited |
| Memory Book full access | No | Yes, for covered fund | Yes |
| Premium event customization | Limited / gated | Yes | Yes |
| Goal cards / premium gifting presentation | Gated | Included | Included |
| Household dashboard | No | No | Yes |
| Multi-fund family controls | No | Limited by covered fund | Yes |
| Collaborator invite / family admin behavior | No | No | Yes |
| Advanced family-level analytics | No | No | Yes |

Notes:
- `Kado+` is a per-fund coverage model in the current repo.
- `Kado Family` supersedes overlapping Kado+ coverage while active.
- Some marketing pages still discuss benefits in broader language, but operationally the fund-coverage model above is the current implementation.

## Pages Present In The Repo

### Marketing / Public

- `/`
- `/how-it-works`
- `/pricing`
- `/faq`
- `/about`
- `/contact`
- `/security`
- `/legal`
- `/blog`
- `/stories`
- `/compare`

### Product / Authenticated

- `/dashboard`
- `/events`
- `/activity`
- `/settings`
- `/memory/...`
- `/kid`
- `/activate`
- age-transition manager / invite pages
- gift lookup / gift send / claim-related pages

## Important Boundaries

Do not assume the repo already has:
- a complete email lifecycle engine for every flow
- a separate notifications center distinct from Activity
- a complete tax-document delivery center
- a complete withdrawal/sell/rebalance product surface
- a complete reverse-trial / pause-plan engine
- a separate child account system
- every speculative growth loop described in strategy documents

Those may be valid roadmap items, but they are not all fully live in the current codebase.

## Source Of Truth Rule

When documentation or strategy notes disagree with the app:
- trust current repo behavior first
- treat strategy docs as `future_state` unless implementation is visible in code
- keep pricing and plan language synchronized across:
  - [Pricing.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Pricing.tsx)
  - [Settings.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Settings.tsx)
  - [FAQ.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/FAQ.tsx)
  - [Legal.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Legal.tsx)
  - [App.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/App.tsx)
