# Scalability, Infrastructure & Growth — honest posture

> The app is built **single-instance for launch** (one Render Web Service +
> Supabase) — intentional and right at this stage — with the **seams to scale
> out already in place**. Scalability is NOT a launch blocker; this doc maps what
> scales now, the single-instance bottlenecks, and the path to horizontal scale.
> Pairs with `DEPLOYMENT_PLAN.md` (deploy steps) and `STORAGE_DURABILITY_SPEC.md`.
> Snapshot 2026-05-29.

## A. Scales already (verified in code)

- **Sessions** — Postgres-backed (`connect-pg-simple`), so they survive restarts
  and work across instances.
- **Rate limiting** — durable Postgres fixed-window limiter (`rateLimiter.ts`,
  migration 0037), **cross-instance** correct (fails open to in-memory only if the
  DB is down).
- **Database** — pooled (`db.ts` max 20 + a 5-conn session pool per instance);
  `DEPLOYMENT_PLAN.md` uses the **Supabase connection pooler (PgBouncer)** URL, so
  connection fan-out across instances is already handled.
- **Request path** — stateless (auth via the session cookie), so the web tier is
  horizontally scalable *except for the worker/SSE caveats in B*.
- **Realtime (SSE)** — `InMemoryRealtimeBus` sits **behind an interface**,
  documented to swap to `RedisRealtimeBus` when the API tier scales, without
  touching call sites (`realtime.ts`). The seam is built.
- **Frontend** — static Vite build, CDN-cacheable.
- **Stripe** — webhook idempotency (unique `stripe_event_id`, migration 0035).

## B. Single-instance-bound today (the bottleneck to horizontal scale)

All fine on ONE instance at launch; each blocks running 2+ web instances:

1. **In-process workers.** ~15 workers run via `setInterval` on the web instance
   (birthday, anniversary, gifter-notification, account-deletion scrub, age-18
   transition, mobile push, parent lifecycle, …). On 2+ instances they'd each
   fire — **duplicate emails / duplicate work.** Intentional for the single-
   instance Render tier (workers need warm uptime; a separate cron service costs).
2. **Worker state on `.local/*.json(l)`.** Idempotence ("already sent") + queues +
   outboxes live in local files (`fundBirthdayWorker`, `gifterReturnReminder`,
   `gifterNotification`, `custodianTransfer` outbox, `emailDelivery` outbox, …).
   Render's disk is **ephemeral — it resets on every deploy**, so idempotence is
   lost (risk: re-sent emails after a deploy) and the state is per-instance.
3. **In-memory SSE bus** (per-process) — a `gift.arrived` event published on
   instance A won't reach a client connected to instance B.
4. **Minor per-instance caches** (featureFlags 5s TTL, ogMiddleware family count)
   — eventually-consistent across instances; harmless.

## C. Launch deploy actions (single instance — do these)

- Use the **Supabase pooler** `DATABASE_URL` (port 6543), per `DEPLOYMENT_PLAN.md`.
- **Mount a persistent disk** (Render `/var/data`) and point the `.local/*` paths
  at it — otherwise worker idempotence resets each deploy and birthday/reminder
  emails can re-fire. (Short-term fix per `DEPLOYMENT_PLAN.md`.)
- Run as **ONE web instance**; do **not** enable autoscaling yet (workers would
  duplicate — see B1).
- Turn on **error monitoring** (Sentry is currently disabled — the `[ops]` boot
  warnings note it).

## D. Path to horizontal scale (when growth demands it — not before)

1. **Worker state → Postgres** (the "long-term correct" path in
   `DEPLOYMENT_PLAN.md`; the PMF survey was already migrated off `.local` in
   migration 0038 as the first step). Removes the ephemeral-disk + per-instance
   problem.
2. **Run workers on a dedicated worker process/dyno** (or guard each tick with a
   Postgres **advisory lock**) so the web tier can scale out without duplicate runs.
3. **Swap `InMemoryRealtimeBus` → `RedisRealtimeBus`** (seam already in `realtime.ts`).
4. **Object storage for `/uploads`** (signed URLs) — `STORAGE_DURABILITY_SPEC.md`,
   creds-gated; local disk doesn't scale across instances either.
5. **DB** — the pooler handles connections; size up the Supabase plan as load grows.

## E. Growth headroom — the honest read

On one Render Starter instance + the Supabase pooler, this comfortably serves
**thousands of users / many gifts a day** before any bottleneck in B is reached.
The gifter loop is email + Stripe + Postgres-bound, all of which scale vertically
a long way. When you DO need to scale out, every seam is already identified (D),
and most of the work is moving worker state to Postgres + flipping the SSE bus —
both already designed for. **Scalability is a known, sequenced future workstream,
not a launch risk.** The infra itself (hosting tier, autoscaling config, DB
sizing, CDN, monitoring) is provisioned by you — none of it is codeable here.
