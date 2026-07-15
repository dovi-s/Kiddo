# Kiddo

Custodial investment-gifting platform. Family and friends send money via a public link; it lands in a UTMA brokerage account; on the kid's 18th birthday, ownership transfers to the kid. Memory Book entries (notes, photos, videos, voice) travel with the fund.

> **Read in this order:**
> 1. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the technical map
> 2. [`PRODUCT.md`](./PRODUCT.md) — strategic decisions and what's locked
> 3. [`SECURITY.md`](./SECURITY.md) — security posture, threat model, vuln-disclosure
> 4. [`policies/`](./policies/) — operational policies (security, access, IR, vendor, change, backup, SDLC)
> 5. [`incidents/`](./incidents/) — incident log, IR template, restore drills, access reviews

---

## Quickstart

```bash
# 1. Install (root + workspaces)
npm install

# 2. Start Postgres
npm run db:up

# 3. Apply schema
npm run db:push

# 4. Seed a demo user + sample data
npm run setup:local

# 5. Install pre-commit hooks (secrets scan)
npm run setup:hooks

# 6. Run the dev server (API + Vite client on :5000)
npm run dev
```

Open `http://localhost:5000`. Demo credentials are printed by `setup:local`.

---

## Stack

- **Frontend:** React 19, Vite 7, TanStack Query, Wouter routing, Tailwind v4, shadcn/ui, Framer Motion
- **Backend:** Express 4 on Node 20, Passport.js (local), connect-pg-simple sessions
- **Database:** PostgreSQL 16 + Drizzle ORM, migrations in `migrations/`
- **Mobile:** Expo 54 + React Native 0.81 in `apps/mobile/`
- **Payments:** Stripe (live), DriveWealth UTMA brokerage (scaffolded — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §5)
- **Email:** Resend / SES via `server/emailDelivery.ts`
- **Hosting (decided 2026-06-12):** **Render** single web service (site + web app + API + workers; `render.yaml` blueprint committed) + **Supabase** (Postgres + Storage) + **Cloudflare** (DNS/CDN). Native (Expo) ships via **EAS** to the app stores and calls the same API. Start on Render's **free** tier for demo/sandbox; flip `render.yaml` `plan: free` -> `starter` ($7/mo, always-on) at real launch. Docker compose is local Postgres only.

---

## Repo layout

```
client/             Vite + React web app
  src/pages/        41 routed pages (Wouter)
  src/components/   shared UI (Memory Book picker, modals, layout)
  src/hooks/        TanStack Query wrappers + auth hooks
server/             Express API
  routes.ts         Top-level route registration (decomposing → routes/*)
  routes/           Domain-specific route modules (age-transition extracted)
  webhookHandlers.ts  Stripe webhook + gift settlement
  *Worker.ts        Cron workers (gifter notifications, age-18, recurring, mobile push, parent lifecycle)
  ageTransitionStore.ts  Shared age-transition state (JSON file today, Postgres-backed soon)
  ops.ts            Sentry + alert + PostHog observability
  storage.ts        Drizzle ORM data access
shared/             Cross-boundary types + pure helpers
  schema.ts         Drizzle table definitions (single source of truth)
  age18-decisions.ts  Pure decision logic for the at-18 lifecycle (unit-tested)
  monetization.ts   Plan tiers, fee math, AUM rate constant
apps/mobile/        Expo + RN mobile app
packages/           Shared workspace packages (@kora/tokens, types, utils, content)
script/             tsx-based test scripts and ops tooling
migrations/         Drizzle SQL migrations
.github/workflows/  CI (type-check + tests on push)
```

---

## Common commands

```bash
# Type-check everything (web + server + shared)
npm run check

# Run all unit/runtime tests
npm run test:all:runtime

# Run a specific test
npm run test:age18-decisions
npm run test:dashboard-money-math
npm run test:stripe-pipeline

# Build production bundle
npm run build

# Production server (after build)
npm start

# Mobile dev (Expo)
npm run mobile:dev
npm run mobile:phone     # tunnel to a real device

# DB ops
npm run db:up            # docker-compose Postgres
npm run db:push          # apply current schema
npm run db:generate      # generate a new migration from schema diff
npm run db:migrate       # apply pending migrations
```

---

## Environment

See `.env.example` for the full list. Critical:

| Var | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection | yes |
| `SESSION_SECRET` | Express session signing | yes |
| `STRIPE_SECRET_KEY` | Stripe API key | for payments |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client key | for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | for payments |
| `APP_BASE_URL` | Canonical public URL for emails / links | yes in prod |
| `SENTRY_DSN` | Server error tracking (`@sentry/node` must be installed) | optional |
| `VITE_SENTRY_DSN` | Client error tracking (`@sentry/react` must be installed) | optional |
| `CUSTODIAN_TRANSFER_WEBHOOK_URL` | DriveWealth ownership-transfer webhook | optional (outbox fallback) |
| `RESEND_API_KEY` / `AWS_SES_*` | Outbound email | for emails |

---

## What this project takes seriously

A new engineer should read these locked design memos before making changes:

| Concept | Memo |
|---|---|
| Kid-at-18 design lens (load-bearing) | `project_design_lens_kid_at_18.md` |
| Three surfaces, three philosophies (gifter / parent / kid) | `project_three_surfaces_three_philosophies.md` |
| Information architecture (what shows when) | `project_information_architecture.md` |
| Child safety architecture (Tier 1 launch blockers) | `project_child_safety_architecture.md` |
| Age-18 handoff lifecycle (worker-automatic, never parent-manual-only) | `project_age18_handoff_lifecycle_automatic.md` |
| Cancellation flow dark-pattern avoidance | `project_cancellation_dark_pattern_avoidance.md` |
| Brokerage as a trust feature | `project_brokerage_as_trust_feature.md` |
| Managed mix construction (rebalancing yes; drift-correction-via-selling no) | `project_managed_mix_portfolio_construction.md` |
| No "contribute" in user copy | `feedback_no_contribute_word.md` |
| No AI-slop visuals (gradient bleeds, sparkles, streaks) | `feedback_no_ai_slop.md` |
| Honest losses, time-framed copy | `feedback_no_greenwashing_losses.md` |
| "[Child]'s fund is safe" — first sentence of every error | `feedback_emmas_fund_is_safe_error_pattern.md` |

These memos are the difference between "code that works" and "code that holds."

---

## Status

- ✅ Internal accounting (gifts, holdings, balance, cost basis, projections)
- ✅ Stripe payments (one-time gifts + subscriptions)
- ✅ Age-18 transition lifecycle (T-30 / T-1 / T-0 worker, verification gate, kid claim flow)
- ✅ Memory Book (notes / photos / videos / voice via shared `<MemoryMediaPicker>`)
- ✅ Kid View (parent-shared, PIN-gated, age-phase-aware)
- ⚠️ DriveWealth ownership transfer — **scaffolded, not wired** (see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §5)
- ⚠️ CSAM scanning — Tier 1 launch blocker, not in place (see `project_child_safety_architecture.md`)

---

## License

MIT. See `LICENSE` (or `package.json` `license` field).
