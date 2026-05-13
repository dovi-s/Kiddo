# Kiddo Architecture

> Last updated: 2026-05-10
>
> Read this before opening code. The repo is large and the load-bearing
> decisions live here, not in the file tree.

Kiddo is a **custodial investment-gifting platform**. Family and friends send
money via a public link; it lands in a UTMA brokerage account; on the kid's
18th birthday, ownership transfers to the kid. Memory Book entries (notes,
photos, videos, voice) travel with the fund.

This document is the map. Each section names where the load-bearing
decisions live and why. Where a decision is contentious or has been
explicitly refused, that's flagged inline.

---

## 1. System shape

```
                  ┌─────────────────────────────────────┐
                  │   Web client (React 19 + Vite)      │
                  │   Mobile (Expo / React Native)      │
                  └──────────────┬──────────────────────┘
                                 │ HTTPS · session cookie
                  ┌──────────────▼──────────────────────┐
                  │   Express API (Node 20)              │
                  │   Passport.js auth · session store  │
                  │   Stripe webhooks · cron workers    │
                  └──────────────┬──────────────────────┘
                                 │ Drizzle ORM
                  ┌──────────────▼──────────────────────┐
                  │   PostgreSQL                         │
                  │   funds · gifts · memory_entries     │
                  │   holdings · subscriptions · audit   │
                  └─────────────────────────────────────┘

External integrations:
  Stripe (payments + subscriptions)         · LIVE
  DriveWealth (UTMA brokerage)              · SCAFFOLDED, not wired
  Email (Resend / SES via emailDelivery.ts) · LIVE
  Parqet (stock logos)                      · LIVE (CDN images)
  Yahoo Finance (price quotes)              · LIVE
```

**Workspaces:** monorepo with `client/` (web), `apps/mobile/` (Expo),
`packages/` (shared `@kora/tokens`, `@kora/types`, `@kora/utils`,
`@kora/content`), `server/`, `shared/` (server↔client types and pure
business-logic helpers).

---

## 2. Data model — money flow

The money-flow tables and what they mean. Schema lives in
`shared/schema.ts` (Drizzle).

| Table | What it is | Who writes |
|---|---|---|
| `users` | Parents and kids (post-claim) | Auth |
| `funds` | One per child OR one personal fund per user | Parent on signup |
| `gifts` | One row per money-in event from any source | Stripe webhook + parent contribution worker + manual flows |
| `holdings` | Current positions in a fund (ticker, shares, cost_basis, current_value) | Webhook on settlement |
| `transactions` | Money-movement audit ledger (gifts, sells, withdrawals) | All money flows |
| `subscriptions` | Stripe subscription state (Plus, Family, Legacy) | Stripe webhook |
| `fund_memberships` | Per-fund Plus membership for the per-child plan | Stripe webhook |
| `parent_contributions` | Recurring investment schedules (UI label: "Recurring investments") | Parent setup |
| `memory_entries` | Notes / photos / videos / voice attached to a fund | Parent + gifters |
| `events` | Birthdays, occasions, savings goals | Parent setup |
| `audit_logs` | Security/compliance audit trail | All sensitive operations |
| `webhook_events` | Stripe webhook idempotency + audit | Stripe webhook |
| `fund_snapshots` | Daily totals (balance, cost basis, principal) | `captureFundSnapshot` on dashboard read |

**Money-flow invariants:**

- `f.balance` mirrors `sum(holdings.current_value)`. Drift is a real risk
  (manual settlement increments vs price-sync market values). Self-heal
  runs inside `captureFundSnapshot` — every dashboard / history read
  reconciles. No separate cron needed.
- `principal_basis` is sourced from `gifts.net_amount` for non-broken
  statuses (NOT from `MAX(holdings.cost_basis, balance)` — that older
  formula silently zeroed out growth on appreciated funds; see
  `project_age18_handoff_lifecycle_automatic.md` and the comment block
  in `captureFundSnapshot` for the bug-fix history).
- Gift status lifecycle: `pending` → `processing` → `invested` /
  `settled` / `completed` (real money). `host_hold` is the large-gift
  hold for free-tier funds. `failed` / `refunded` / `canceled` never
  count toward principal or contributor totals.

---

## 3. Auth + session

`server/auth.ts` — Passport.js local strategy + bcrypt password hashing.

- Session store: `connect-pg-simple` against the same Postgres database
  (`createTableIfMissing: true`). One source of truth for sessions across
  deployments.
- Cookie: `httpOnly`, `secure: true` in production, `sameSite: lax`.
- Middleware: `isAuthenticated` (any signed-in user), `isAdmin` (super-admin
  email allowlist via `getConfiguredSuperAdminEmails()`).
- Mobile uses the same session cookies via `credentials: include` from
  `apps/mobile/src/api.ts`. Dev server has CORS middleware enabled
  (disabled in production where mobile and web share a domain).
- Age-18 ownership transfer creates a NEW user account for the kid;
  the kid is never given the parent's credentials. See section 6.

---

## 4. Payments — Stripe integration

`server/stripeService.ts` + `server/webhookHandlers.ts`.

**One-time gifts** — gifters land on `/:fundSlug`, complete Stripe
Checkout (no Kiddo account required). Webhook handler `settleInvestedGift`
in `webhookHandlers.ts` runs on `payment_intent.succeeded`:

```
gift comes in
  ├─ executionModel === 'cash'  → park in cashBalance, status='invested'
  ├─ executionModel === 'pick'  → buy specific ticker, increment holdings
  ├─ executionModel === 'auto'  → auto-allocate per active strategy
  └─ if allocator returns []    → fall back to cash-park (defensive)
```

The `cash` branch is intentional — parents can "Hold as cash, invest
later" from the one-time investment modal. See the third button at
`Dashboard.tsx` one-time modal.

**Subscriptions** — three SKUs (Kiddo+, Kiddo Family, Kiddo Legacy).
Plus is per-fund (parent has 3 kids = 3 Plus subscriptions OR 1 Family).
See `shared/monetization.ts` for the locked plan matrix.

**Idempotency:** `webhook_events` table records every Stripe event ID we've
processed. Duplicate deliveries are no-ops. Signature verification at the
Stripe webhook entry point.

**Cancel flow** — see `project_cancellation_dark_pattern_avoidance.md` in
the locked memory for the standing principles (no auto-converting trial,
no retention discount puzzle, no hidden cancel button, no "I understand"
guilt phrasing). Implementation at `Settings.tsx` (cancel modal) +
`POST /api/subscription/cancel`.

---

## 5. Brokerage integration (DriveWealth) — SCAFFOLDED

**This is the biggest open architectural item.** Status:

- `server/driveWealthAccountSetup.ts` — payload assembly for UTMA account
  creation. The HTTP client is NOT wired. Function signature is correct;
  call site exists at fund creation; the actual API call is a TODO.
- `server/custodianTransfer.ts` — webhook scaffolding for ownership
  transfer events. Calls `CUSTODIAN_TRANSFER_WEBHOOK_URL` if set,
  otherwise appends to `.local/custodian-transfer-outbox.jsonl`.
- All KYC, account opening, ACATs, beneficiary forms — **not wired**.

**What does work today:** internal accounting (gifts, holdings, balance,
cost basis, projections). The Kiddo app behaves AS IF the brokerage
exists. It's a faithful simulation right up to the broker boundary.

**Why this is documented prominently:** the locked memory
`project_age18_handoff_lifecycle_automatic.md` explicitly refuses PRs
that ship code claiming brokerage handoff completion without the
underlying integration. False completion signals would be worse than
the current state.

---

## 6. Age-18 lifecycle (load-bearing)

The kid's 18th birthday is the most consequential moment in the product.
The architecture is designed so the kid receives the fund automatically
on the day, regardless of parent attentiveness.

**Worker:** `server/age18TransitionWorker.ts` — runs every 6 hours.
Three milestones per fund, idempotent:

| Milestone | What fires |
|---|---|
| **T-30 days** | Parent reminder email (3 prep tasks: add child email, share Kid View, walk prep checklist) |
| **T-1 day** | Parent reminder ("tomorrow's the day") |
| **T-0 (birthday)** | Stamps `funds.age_18_notified_at`, writes activity log, auto-emails kid the claim link IF email is verified, emails parent (3 variants: configured / unverified / missing) |

**Verification gate** — the at-18 invite is NOT auto-sent unless
`childEmailVerifiedAt` is set on the age-transition record. Parent
triggers verification pre-18; kid clicks the link. This catches the
"parent typo six years ago" failure mode where the at-18 invite would
otherwise silently land in the wrong inbox. Editing the email post-
verification resets `verifiedAt` to null. Manual override path exists
(`/api/funds/:fundId/age-transition/invite-link` POST) for parents who
want to bypass verification at their own discretion.

**Per-milestone state:** `.local/age18-reminder-state.json`. Also
load-bearing: this is one of the JSON state files that needs to move
to PostgreSQL (see Section 11).

**Kid claim flow:**

1. Kid clicks email link → `/transition/{token}`
2. AgeTransitionInvite page shows: fund summary, sealed-letter (if
   parent wrote one — wax-seal styling), Memory Book highlights,
   parent's note
3. Kid creates own Kiddo account (separate password — no shared creds)
4. Click "Accept invite" → `child_claimed_at` set
5. Click "Complete Kiddo transfer" → fund moves to kid's account,
   parent loses parent-managed view
6. Post-claim: kid lands on Dashboard with one-time at-18 welcome
   banner ("This is your fund now"), can scroll to `/your-story/{fundId}`
   for the year-by-year retrospective, can send thank-yous to gifters

See `project_age18_handoff_lifecycle_automatic.md` for full hard-noes
(don't gate kid notifications on parent action, don't downgrade T-0,
don't add a "skip verification" toggle, etc.).

---

## 7. Memory Book — visibility model

Two parallel visibility systems on `memory_entries` (this trips people up):

| Field | Values | Controls |
|---|---|---|
| `visibility` (column) | `kid_now` / `kid_at_18` / `parent_only` | What the **kid** sees in Kid View |
| meta visibility (JSON file) | `public` / `family` / `private` | Public Memory Book exposure |

A sealed letter has `visibility='kid_at_18'` AND `type='sealed_letter'`.
It only renders to the kid once `phase === 'adult'`. The age-transition
endpoint and the kid-view endpoint both check this gate.

**All giving flows expose the full media trio** (note + photo + video
+ voice) via the shared `<MemoryMediaPicker>` component. Earlier the
gifter checkout had its own bespoke implementation that drifted; now
unified. See `project_giving_flows_full_media.md`.

---

## 8. Recurring investments (a.k.a. parent contributions internally)

**Naming is locked:** "Recurring investments" in user copy. Internal
field names use `parentContributions` / `oneTimeContributionAmount`
which is fine per `feedback_no_contribute_word.md`. "Auto-invest" is
banned from user-facing copy.

`server/recurringContributionWorker.ts` — pulls funds via Stripe
off-session payment intents using the parent's saved payment method
(typically the card on file from their Plus subscription). NOT real ACH
— that needs Stripe Financial Connections, separate work.

If the off-session charge fails, the worker falls back to an email
reminder asking the parent to manually click "Add now."

---

## 9. Workers — the cron layer

All workers live at `server/*Worker.ts` and start from `server/index.ts`.

| Worker | Cadence | What it does |
|---|---|---|
| `gifterNotificationWorker` | 1h | Birthday reminders, age-18 notifications to gifters, queued share emails |
| `parentLifecycleWorker` | 6h | Activation emails (day 1/2/3/7), first-gift, milestone emails ($100/$500/$1k), dormant-fund nudges |
| `recurringContributionWorker` | 6h | Pull recurring parent investments via Stripe off-session |
| `age18TransitionWorker` | 6h | T-30 / T-1 / T-0 milestone emails (see Section 6) |
| `mobilePushWorker` | 5m | Push notifications to mobile devices |

All workers are **idempotent** (per-entity send-state tracked in JSON
state files OR DB columns). Worker restart in mid-pass picks up
cleanly.

---

## 10. Child safety (Tier 1 launch blockers)

See `project_child_safety_architecture.md` in locked memory for the
tier breakdown.

**Shipped:**
- Public upload rate limiting (10/IP-fund/10min, 50/IP/10min)
- Audit logging on every public memory upload
- Honest "working toward COPPA" copy in legal page
- Mobile + web file uploads use the system picker (no `capture` attr —
  user chooses camera or library, both work)

**Open (Tier 1, blocks scale beyond friends-and-family):**
- CSAM scanning on uploaded media (regulatory requirement under
  18 U.S.C. § 2258A — required before public upload reaches strangers)
- Parent review queue for gifter-uploaded content
- Block-gifter / hide-content / report mechanisms
- NCMEC reporting integration

Per the locked memory: the trust-circle architecture (assume gifters
are friends-and-family) must be replaced with child-safety architecture
(assume some gifters are bad actors) BEFORE the gifter loop scales
beyond friends-and-family. This is a launch-readiness item, not a
nice-to-have.

---

## 11. Audit-readiness roadmap

Honest assessment of what would block a technical due diligence pass.

**Done (May 2026):**
- ✅ ARCHITECTURE.md (this doc)
- ✅ Repo-root README.md with quickstart, stack, commands, env vars,
  and pointers into the locked memory
- ✅ CI workflow at `.github/workflows/ci.yml` — type-check (web +
  mobile), pure-function tests, content lint on every push + PR.
  Concurrency cancellation prevents queue pileup on rapid pushes
- ✅ Observability — `server/ops.ts` (existed; Sentry-ready with
  alert cooldowns + PostHog capture) AND new
  `client/src/lib/observability.ts` (parity for the client; was missing).
  Both no-op when `SENTRY_DSN` / `VITE_SENTRY_DSN` aren't set; auto-wire
  to Sentry when present. `AppErrorBoundary.componentDidCatch` now
  routes through `captureError` instead of bare `console.error`
- ✅ Sample domain decomposition: `server/routes/ageTransitionVerification.ts`
  extracted from `routes.ts` (verify-email-link + token-claim endpoints)
  as proof-of-pattern. Pattern: each domain module exports
  `register*Routes(app, deps)` taking a deps object for closure-bound
  helpers. routes.ts wires by calling each registration function
- ✅ Pure-function extraction: `shared/age18-decisions.ts` houses the
  testable logic (`decideTodayParentVariant`, `shouldAutoSendKidInvite`,
  `yearOfLifeForDate`, `getAgeMilestoneState`). Worker + routes import
  the same definitions; can't drift
- ✅ **Age-transition state migrated from JSON file to PostgreSQL** —
  new `age_transitions` table in `shared/schema.ts`, migration
  `migrations/0005_age_transitions_table.sql`, `server/ageTransitionStore.ts`
  rewritten to read/write from the table with on-read backfill from
  the legacy `.local/age-transition-flows.json` file. Three indexed
  token columns (preview/invite/verification) for fast public-endpoint
  lookups
- ✅ **Age-18 reminder state migrated from JSON file to PostgreSQL** —
  new `age18_reminder_state` table, migration
  `migrations/0006_age18_reminder_state.sql`, `server/age18TransitionWorker.ts`
  rewritten with same on-read backfill pattern. T-30/T-1/T-0 send
  tracking now atomic per-fund upsert instead of "load file, mutate,
  rewrite file." **Closes the "doesn't scale beyond one server" smell
  on the worker layer** too
- ✅ Zod request validation at age-transition PATCH (now lives in
  the extracted lifecycle module). `.strict()` rejects unknown keys;
  structured error response with per-field issue list
- ✅ **Sentry deps installed** (`@sentry/node` + `@sentry/react`).
  The observability seams in `server/ops.ts` and `client/src/lib/observability.ts`
  auto-wire when `SENTRY_DSN` / `VITE_SENTRY_DSN` env vars are set.
  Production errors no longer disappear into stdout
- ✅ **More routes.ts extraction**: `server/routes/ageTransitionLifecycle.ts`
  added, covering GET/PATCH state, preview-link, invite-link, handoff.
  Combined with the verification module, the entire parent-side age-
  transition surface is now extracted (~280 lines out of routes.ts).
  Remaining inline: the public `/api/age-transition/:token` payload
  endpoint (wider helper deps; deferred to its own session)
- ✅ **Read-only fund routes extracted**: `server/routes/funds.ts`
  added, covering 8 routes: GET /api/funds (list), GET /api/funds/:id,
  GET /api/funds/:fundId/holdings, /transactions, /activities, /history,
  /your-story, plus POST /api/funds/:fundId/dismiss-nudge.
  ~434 lines moved out of routes.ts via the proven
  `register*Routes(app, deps)` pattern. Three closure-bound deps passed:
  `captureFundSnapshot`, `ensureFundSlugAndPermanentEvent`,
  `getKidAgePhase`
- ✅ **Monetization service extracted**: `server/services/monetization.ts`
  added. Lifted 14 closure-bound helpers out of `registerRoutes`:
  `hasEntitlementFromStatus`, `getActiveHouseholdPlan`,
  `hasStarterPlanForFund`, `getActiveStarterMembershipsForUser`,
  `hasPaidPlanForFund`, `isReverseTrialEnabled`, `setReverseTrialEnabled`,
  `getTrialForFund`, `startTrialForFund`, `getFundCoverageState`,
  `getRecommendationState`, `resolveAllowedFundStrategy`,
  `logMonetizationActivity`, plus `invalidateMonetizationStateCache`.
  JSON-backed trial state cache moved with them (module-scoped now,
  no longer closure-scoped — singleton across the process). routes.ts
  imports directly; **callers no longer need to plumb a deps object**.
  Unblocks future extraction of fund mutations (POST /api/funds, PATCH,
  liquidate, activate, recipient-ssn) since they no longer need 12-dep
  wiring — the helpers are now plain importable functions
- ✅ **First Dashboard component extracted**:
  `client/src/components/dashboard/KidAt18WelcomeBanner.tsx`. Pattern
  established for the rest of the Dashboard decomp — props-only
  interface, owns its own dismiss state, returns null when it
  shouldn't render
- ✅ Critical-path tests: `script/test-age18-decisions.ts` —
  **28 assertions across 4 pure functions**, runs in CI. The test
  caught a real production bug during development (off-by-one on
  exact-anniversary year-of-life math), validating the pattern

**Open — known smells, planned remediation:**

| Issue | Plan |
|---|---|
| `server/routes.ts` ~14k lines | Continue domain extraction: `auth/`, `funds/`, `gifts/`, `webhooks/`, `subscriptions/`, `admin/`, `kid-view/`, public `age-transition/:token` payload. **Age-transition (verification + lifecycle) DONE — pattern proven.** Each remaining domain is one session of mechanical extraction following the established `register*Routes(app, deps)` pattern. |
| `client/src/pages/Dashboard.tsx` ~12k lines | Continue sub-component extraction: `<HeroCard>`, `<HoldingsCard>`, `<RecurringInvestmentsCard>`, `<OccasionsAndGoals>`. **`<KidAt18WelcomeBanner>` DONE — pattern proven.** Each remaining component is one session, props-only interface, owns its own state. |
| Remaining JSON state files (custodian transfer outbox, anything else under `.local/*.json`) | Repeat the proven Postgres migration pattern (schema + migration + on-read backfill + reader swap). **Two files migrated; the rest are the same shape.** |
| Per-process rate limiter Maps | Move to Postgres (or Redis if response time matters). Won't scale to multi-server otherwise. |
| Many `as any` casts at API boundaries | Continue the Zod `.strict()` pattern from age-transition PATCH to every endpoint that takes a body. Pattern proven; ~140 endpoints to go. Prioritize payment/settlement endpoints first. |
| `@types/express: 4.17.21` causing `req.body` to be untyped by default | Pinned for compat; revisit once Drizzle's request-typing helpers stabilize. |
| Test coverage on payment flows is partial | Add Stripe webhook integration tests with replay fixtures. `script/test-stripe-pipeline.ts` exists; expand. |
| Sentry DSN not yet configured in production | Set `SENTRY_DSN` (server) + `VITE_SENTRY_DSN` (client) env vars. Deps installed; observability auto-wires on env presence. |

The **single-highest-impact item is decomposing `routes.ts` and
`Dashboard.tsx`**. An auditor's first impression forms in 30 seconds when
they open one of those files. Everything else is scaffolding compared to
that perception flip.

---

## 12. The locked memory — design discipline

Standing principles live as Markdown memos in
`C:\Users\dovis\.claude\projects\C--Apps-Kora--newest-\memory\`. The
ones a new engineer should read first:

| Memo | What it locks |
|---|---|
| `project_design_lens_kid_at_18.md` | Every decision evaluated against what the kid sees on their 18th birthday |
| `project_three_surfaces_three_philosophies.md` | Gifter = Robinhood-minimal · Parent = Apple-Settings-discoverable · Kid = Mubi-emotional |
| `project_information_architecture.md` | Memory Book / Activity / Kid View / At-18 surfaces with visibility tiers |
| `project_child_safety_architecture.md` | Tier 1 launch blockers (CSAM scanning, parent review, etc.) |
| `project_age18_handoff_lifecycle_automatic.md` | Worker owns the lifecycle; verification gate; what NEVER reverts |
| `project_cancellation_dark_pattern_avoidance.md` | No auto-converting trial; no retention discount puzzle; no hidden cancel |
| `project_managed_mix_portfolio_construction.md` | Contribution-based rebalancing yes; drift-correction-via-selling refused |
| `project_brokerage_as_trust_feature.md` | DriveWealth/SIPC celebrated, not buried |
| `feedback_no_contribute_word.md` | "Contribute" banned in UI copy |
| `feedback_no_ai_slop.md` | No gradient bleeds, glassmorphism, sparkle particles, streak gamification, leaderboards. Robinhood $7.5M precedent makes the gamification bans regulatory |
| `feedback_no_greenwashing_losses.md` | Honest losses, time-framed copy |
| `feedback_emmas_fund_is_safe_error_pattern.md` | "[Child]'s fund is safe" is the first sentence of every error |

These aren't decorative. They've shaped real refusals (e.g., faking
DriveWealth handoff completion, gating kid notifications on parent
action at T-0, surfacing fear/loss Plus conversion on always-visible
surfaces). They are the difference between deliberate construction and
ad-hoc accumulation.

---

## 13. Local development

```bash
npm install                # installs root + workspaces
npm run db:up              # docker-compose Postgres
npm run db:push            # apply current schema
npm run setup:local        # creates demo user + sample data
npm run dev                # tsx watch on server/index.ts
                           # client served from same Vite dev server
```

Mobile:
```bash
npm run mobile:dev         # Expo dev server
npm run mobile:phone       # tunnel to a real device via Expo Go
```

Testing:
```bash
npm run check              # tsc --noEmit on the entire repo
npm run test:all:runtime   # runs all tsx-based test scripts
npm run test:stripe-pipeline  # gift settlement integration tests
npm run test:all           # check + build + runtime (full)
```

Environment variables — see `.env.example`. Critical ones:
`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SESSION_SECRET`, `DATABASE_URL`, `APP_BASE_URL`,
`CUSTODIAN_TRANSFER_WEBHOOK_URL` (optional — outbox fallback if unset),
`SENTRY_DSN` (optional — console fallback if unset, see Section 11).

---

## 14. Where to look first

Coming in cold? In this order:

1. This file (you're done)
2. `shared/schema.ts` — the data model
3. `server/index.ts` — entrypoint, middleware order, worker startup
4. `server/auth.ts` — auth model
5. `server/webhookHandlers.ts` — money settlement
6. `server/age18TransitionWorker.ts` — the at-18 lifecycle
7. `client/src/App.tsx` — routing
8. `client/src/pages/Dashboard.tsx` — the load-bearing surface (large; will be decomposed)
9. The locked memory directory — for the "why" behind anything that looks deliberate

If something looks weird, check the memory before assuming it's a bug.
Many decisions that look anomalous are deliberate refusals captured as
load-bearing principles.
