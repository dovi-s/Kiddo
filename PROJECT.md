# Kora

## Overview

Kora is a gifting platform designed to transform traditional gifts into long-term investments, primarily for custodial accounts for children. It aims to become a leading consumer financial platform by providing a seamless experience for gifting and investing. The platform enables users to create investment funds (custodial UTMA for children, personal taxable for adults), link event pages to these funds for gift attribution, and manage the entire gift lifecycle from payment to settled investment. A key feature is its progressive onboarding, which allows immediate account and link creation, deferring identity verification (KYC) until investing features are activated.

Execution playbook:
- See `KORA_GROWTH_PLAYBOOK.md` for the operating skill system used to prioritize growth, retention, and monetization work.
- See `KORA_COPY_SYSTEM_CHECKLIST.md` for copy clarity and trust/pricing consistency checks across onboarding, settings, checkout, and activity.
- See `KORA_DESIGN_GUARDRAILS.md` for product-level UX/trust/fee consistency guardrails.
- See `KORA_FINTECH_UX_2026_BENCHMARK.md` for external finance UX trend synthesis mapped to Kora implementation gaps.
- See `KORA_MOBILE_MOTION_2026_PLAYBOOK.md` for mobile motion patterns and rollout guidance.
- See `KORA_GROWTH_TICKET_PACK.md` section "UX 2026 Addendum" for implementation-ready tickets from the benchmark.
- Run `npm run audit:copy` to validate core pricing and trust phrasing on key user-facing screens.

## User Preferences

Preferred communication style: Simple, everyday language.
Writing style: Never use em dashes. Use periods, commas, or rewrite the sentence instead. Keep copy personal and grounded in real user experience.

## System Architecture

Kora facilitates financial gifting through individual investment funds and event-linked gift pages. The platform manages the entire gift lifecycle, from initial payment capture to investment settlement. Onboarding is progressive, allowing immediate account setup and gift pledging before KYC is required for investment activation. User roles include Gift-Giver, Parent/Host, Kid/Recipient, Adult Recipient, and Co-Parent/Family Admin. The dashboard provides a comprehensive view of funds, holdings, events, and activities. Child privacy is maintained through non-discoverability and link-only access for minors, with a child-friendly interface that avoids financial jargon.

Kora's pricing includes processing fees (paid by gift-giver) and a Kora Platform Fee per gift, which can be waived with subscription plans (Free, Starter, Family). Event Boosts offer premium features for specific events. Withdrawals are handled in accordance with UTMA laws for custodial accounts, ensuring funds are used for the child's benefit, while adult accounts have full control.

The technical stack is built on a monorepo architecture. The frontend uses React with TypeScript, Wouter, Tailwind CSS v4, shadcn/ui, TanStack React Query, and Framer Motion. The backend is a Node.js Express application with TypeScript. Data persistence is managed with PostgreSQL and Drizzle ORM, emphasizing end-to-end type safety.

Current repo truth:
- the shipped implementation is still primarily a single web app under `client/`
- the product direction is now mobile-app-first
- the target repo direction is documented in `MOBILE_APP_FIRST_MONOREPO_PLAN.md`
- the current-to-target mapping is documented in `MOBILE_APP_MIGRATION_MAP.md`
- first shared extractions are now live in `packages/api`, `packages/types`, `packages/utils`, and `packages/tokens`
- the current onboarding flow already consumes shared onboarding types and helpers

The UI/UX register is a calm custodial-finance aesthetic: a locked 60-30-10 palette (cream, evergreen, kiddo-gold), Bricolage Grotesque for emotional headlines + DM Sans for utility, and minimal motion that earns its place (slow-in/slow-out easing, count-up balance reveals, sprout confirmations, gentle nudge cards). The component library is in `client/src/components/ui/` — notable primitives include `GradientText`, `GeminiHeroGradient`, `ThinkingOrb`, `EnlighteningReveal`, `SpectrumWave`, and the mascot/sprout vocabulary. **Sparkle particles, confetti, achievement badges, magnetic-cursor buttons, and "AI gradient" violet-to-cyan effects are explicitly banned** per the locked aesthetic discipline in `~/.claude/projects/.../memory/feedback_no_ai_slop.md` and `feedback_animation_primitives.md` — those bans are also regulatory (Robinhood $7.5M MA-AG consent order, 2024). The component-library authority for what's approved vs banned lives in the locked memory, not in this doc.

## External Dependencies

*   **Database**: PostgreSQL (managed via `DATABASE_URL`)
*   **Payment Processing**: Stripe (checkout, subscriptions, webhooks, billing portal)
*   **Authentication & Sessions**: Passport.js (local strategy), express-session, connect-pg-simple
*   **Brokerage Integration**: DriveWealth, LLC (for KYC/AML, custody, clearing, settlement, fractional shares, tax reporting)
*   **Frontend Utilities**: qrcode.react, date-fns, react-hook-form with @hookform/resolvers

## Local Setup

1. Generate local env file: `npm run setup:local` (or copy `.env.example` to `.env` manually).
2. Set `SESSION_SECRET` in `.env`.
3. Run `npm install`.
4. Start local Postgres (optional helper): `npm run db:up`.
5. Apply checked-in migrations: `npm run db:migrate`.
6. If you use Stripe locally, set `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`.
7. Run `npm run dev`.

