# Kado Launch Stack

Updated: 2026-04-03

This is the lean, repo-aligned version of the stack. It is intentionally not the maximal possible stack.

The goal is simple:
- keep the product aligned to what already exists in this repo
- treat legal and brokerage integration as the true critical path
- avoid introducing extra tools before they solve a real launch problem

## Guiding rule

If the repo already has working plumbing for a surface, loop, or workflow, prefer:
- surfacing it
- instrumenting it
- improving conversion around it

before introducing a new provider, backend system, or architectural migration.

## Current repo-aligned foundation

The codebase already has meaningful product plumbing in place:
- React + Vite frontend
- Node + Express backend
- PostgreSQL + Drizzle data layer
- Stripe payments and subscription plumbing
- session-based auth
- gifting flows
- Memory Book flows
- event flows
- age-transition flows
- growth ticket pack and launch-readiness script

That means the launch stack should extend this foundation, not replace it.

## Critical path

The two real critical-path tracks are:

1. Legal and compliance
- securities counsel
- privacy policy
- terms of service
- disclosures
- UTMA and age-of-majority review
- COPPA review

2. Brokerage and custody
- DriveWealth or equivalent custodian partner
- account opening/KYC operating model
- transfer and handoff process
- production brokerage integration approval

Everything else should support those tracks, not distract from them.

## Required now

These are the tools, systems, and docs we should actively support immediately because they match the repo and unblock product execution now.

### Application stack
- Frontend: React + Vite
- Backend: Node + Express
- Database: PostgreSQL + Drizzle
- Payments: Stripe
- Sessions/auth: existing session auth, extended with OAuth where configured

### Core operational layers
- Environment configuration and secret management
- Launch-readiness script
- Typecheck and build verification
- Error handling and resilient fallbacks
- Auditability for critical user and money flows

### Product-facing provider boundaries already in-repo
- ESP adapter with durable fallback outbox
- OAuth provider endpoints for Google and Apple
- custodian transfer webhook boundary with durable fallback outbox

### Recommended immediate tooling
- Stripe
- PostgreSQL
- Sentry or equivalent error monitoring
- GA4
- Search Console
- Clarity
- one transactional email provider
  - Postmark or SendGrid

### Docs required now
- [DEPLOYMENT_CHECKLIST.md](/c:/Apps/Kora%20(newest)/DEPLOYMENT_CHECKLIST.md)
- [INTEGRATIONS.md](/c:/Apps/Kora%20(newest)/INTEGRATIONS.md)
- [LAUNCH_STACK.md](/c:/Apps/Kora%20(newest)/LAUNCH_STACK.md)

## Required before launch

These do not all need to be fully live during every local development pass, but they do need to be real before public launch.

### Legal and compliance
- securities attorney retained
- privacy policy finalized
- terms of service finalized
- investment disclosures reviewed
- COPPA review complete
- UTMA and age-transition language reviewed

### Brokerage/custody
- DriveWealth partnership or equivalent signed
- sandbox and production brokerage access approved
- custodian webhook target and ops workflow finalized
- KYC ownership and failure-handling flow defined

### Authentication and account trust
- at least one social auth provider configured
  - Google and/or Apple
- session secret and secure cookie settings finalized
- production callback URLs configured correctly

### Email delivery
- Postmark or SendGrid live
- sending domain authenticated
- launch-critical templates validated

### Privacy and processor disclosures
- Privacy Policy updated to reflect actual processors in use
- named coverage for:
  - DriveWealth / custody partner
  - payment processor
  - any KYC / identity-verification vendor
  - email provider
  - analytics tools
  - push / messaging providers if enabled
- documentation updated whenever a new processor is enabled, not months later

### Observability
- Sentry or equivalent live in production
- launch-readiness checks passing for required items
- analytics events firing for acquisition and activation basics

### Product readiness
- key funnels instrumented
- top trust surfaces written in plain language
- major upgrade and re-engagement states surfaced
- core gifting and fund setup flows verified end to end

## Defer until traction

These are useful, but they should not sit on the critical path unless real usage proves the need.

### Growth and lifecycle tools
- Klaviyo or a heavier lifecycle marketing platform
- Intercom or a full support suite
- Ahrefs or heavier SEO tooling
- LogRocket or higher-cost session replay tooling
- Statuspage

### Payment and banking expansion
- Plaid, until ACH is a real launch requirement
- Twilio SMS, unless SMS becomes core to activation or security

### Auth expansion
- passkeys or WebAuthn biometrics
- native biometric sign-in layers beyond provider/platform support
- auth platform migration just for architecture taste

### Brand and media expansion
- commissioned Pip animation library
- founder photo and founder video assets
- richer motion system on marketing pages

These are valuable, but they should follow traction, not block launch.

## Explicit non-goals for launch

Do not force these onto the launch path without evidence:
- rewriting the app around Next.js
- replacing the current auth system just because Clerk/Auth0 exist
- adding a large stack of marketing tools before lifecycle volume exists
- building passkeys as a cosmetic checkbox
- buying design polish before trust, legal, and brokerage are in place

## Decision framework

When a new tool or system is proposed, ask:

1. Does the repo already have working plumbing for this area?
2. Is this solving a launch blocker, or just making the stack more elaborate?
3. Does this reduce legal, brokerage, operational, or conversion risk right now?
4. If we do not add it before launch, what concretely breaks?

If the answer to 4 is "nothing important," it belongs in `defer until traction`.

## Recommended launch stack

### Keep
- React + Vite
- Node + Express
- PostgreSQL + Drizzle
- Stripe
- current session auth
- current product architecture

### Add and finalize
- one live ESP
- one or two real OAuth providers
- Sentry
- GA4
- Search Console
- Clarity
- legal docs
- brokerage/custodian production setup

### Delay
- passkeys
- Intercom
- Klaviyo
- Plaid
- Twilio
- heavier SEO and support tooling
- non-essential media production

## Environment variable rule

Do not maintain a fantasy env list.

Split configuration into:
- env vars the repo uses right now
- env vars reserved for planned integrations

Examples:
- `DATABASE_URL` is required now
- `SUPABASE_URL` is not required unless we start using Supabase client APIs directly
- `GOOGLE_CLIENT_ID` and `APPLE_CLIENT_ID` matter because OAuth is already wired
- Clerk env vars do not belong in the required launch list because this repo does not use Clerk

The source-of-truth files for this are:
- [.env.example](/c:/Apps/Kora%20(newest)/.env.example)
- [INTEGRATIONS.md](/c:/Apps/Kora%20(newest)/INTEGRATIONS.md)

## Bottom line

The right launch version of Kado is not the biggest stack.

It is the smallest stack that:
- works with this repo
- satisfies legal and custody requirements
- lets people create funds, share links, gift, and trust the product
- gives us enough instrumentation to improve conversion after launch

That means a leaner stack now, with legal and brokerage integrations as the true critical path.
