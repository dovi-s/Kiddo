# Kora Deployment Plan — Render + Supabase

> Status: **Plan, not executed.** Production deployment of Kora to
> Render (web service) + Supabase (Postgres + Storage) + supporting
> services. Written so you can execute it as a focused half-day task,
> or hand to someone else, without re-deriving the moving pieces.
>
> Last updated: 2026-05-13

---

## TL;DR

Deploy the Express + Vite + workers app as **one Render Web Service**
on the **Starter ($7/mo)** instance type. Use **Supabase free tier**
for Postgres + Storage. Wire **Resend** for emails, **Sentry** for
errors (env vars already wired in `server/ops.ts`), **PostHog** for
analytics (also wired). Cloudflare for DNS + caching.

**Total monthly cost at launch:** ~$7/mo (Render Starter only;
Supabase free tier, Resend free tier, Sentry free tier, Cloudflare
free tier all cover Kora until real traffic).

Half a focused day from "Render account created" to "real users can
visit kiddofund.com." Plus one or two follow-up sessions for DNS
propagation and Stripe webhook reconnection.

---

## Pre-flight checklist (do BEFORE pushing deploy)

Don't start the Render deploy flow until each of these is in hand:

### Accounts you need

| Service | Plan | Status | Why |
|---|---|---|---|
| Render | Hobby ($0 workspace) | Make today, sign up with GitHub OAuth | App hosting |
| Supabase | Free tier | If not already set up, do this first | Postgres + Storage (per existing env vars) |
| Cloudflare | Free | When ready for DNS | Domain DNS, optional CDN proxy |
| Resend | Free 100/day | Before first user emails | SMTP for gifter-notification worker + transactional emails |
| Sentry | Free tier | After first deploy | Error tracking — env var `SENTRY_DSN` already wired in `server/ops.ts` |
| PostHog | Free tier | Optional Day 1 | First-party analytics — env vars `POSTHOG_API_KEY` + `POSTHOG_HOST` already wired |
| Stripe | Live mode keys | When ready to take real money | Already in dev; need separate live keys for production |
| DriveWealth | Production credentials + IP allowlist | Late — keep on sandbox for soft launch | Brokerage. Production access typically requires KYC of Kora as a partner. |

### Domain

You need `kiddofund.com` registered. If not yet: register on
Cloudflare directly (cheapest + cleanest DNS workflow) or any
registrar then transfer DNS to Cloudflare.

### Environment variables you'll need to set in Render

Audit your local `.env` against this list before deploy. Anything
missing is a deploy-time gotcha:

| Variable | Source | Notes |
|---|---|---|
| `NODE_ENV` | hardcoded | `production` |
| `DATABASE_URL` | Supabase | Supabase → Project Settings → Database → "Connection string (URI)" → use the **connection pooler** URL (port 6543 or 5432 with pgbouncer), not the direct connection. Add `?sslmode=require` if not included. |
| `SESSION_SECRET` | generate | Run `openssl rand -hex 32` locally and paste the output. NOT the same as dev — generate fresh. |
| `STRIPE_SECRET_KEY` | Stripe | `sk_live_...` for production. NOT the test key. |
| `STRIPE_PUBLISHABLE_KEY` | Stripe | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | After deploy, register the new webhook URL in Stripe dashboard and copy the signing secret here |
| `SUPABASE_URL` | Supabase | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Service role key (server-only secret) |
| `APP_BASE_URL` | hardcoded | `https://kiddofund.com` (NOT the temporary Render URL) |
| `RESEND_API_KEY` | Resend | After signing up |
| `EMAIL_FROM` | hardcoded | `Kiddo <hello@kiddofund.com>` once DNS verification done in Resend |
| `SENTRY_DSN` | Sentry | After Sentry project created |
| `POSTHOG_API_KEY` | PostHog | After PostHog project created |
| `POSTHOG_HOST` | hardcoded | `https://us.i.posthog.com` (default; check your PostHog region) |
| `ALLOW_INSECURE_DEV_TLS` | DO NOT SET | Dev-only flag; must be unset in production or every TLS call goes insecure |
| `DRIVEWEALTH_*` | DriveWealth | Sandbox creds until production access granted |

---

## Pre-deploy code changes Kora needs

These are real code edits required before the app boots cleanly on
Render. Each is small but blocking.

### 1. `package.json` start command — Windows-syntax won't work on Linux

Current:
```json
"start": "set NODE_ENV=production&& node dist/index.cjs",
```

`set NODE_ENV=...&&` is PowerShell syntax. Render runs Linux. Change to:
```json
"start": "NODE_ENV=production node dist/index.cjs",
```

Use the `cross-env` package or split scripts if you want to keep
local Windows compatibility, but for production-only the inline
`NODE_ENV=production` works on both Linux (Render) and modern
Windows shells (npm runs scripts through a shell that respects it).

Same issue exists on `dev` script — but `dev` only runs locally so
that one stays as-is.

### 2. `.local/` jsonl queue files — ephemeral on Render

Render's filesystem resets on every deploy. Kora's gifter notification
worker writes to:
- `.local/gifter-notification-queue.jsonl`
- `.local/gifter-notification-outbox.jsonl`
- `.local/gifter-notification-deliveries.json`
- `.local/gifter-notifications.json` (subscriber state)
- `.local/gift-invitations.jsonl`
- `.local/email-outbox.jsonl`

These all VANISH on every deploy. Critical state (subscriber records,
delivery dedup) is lost.

**Two fixes, pick one:**

- **Short-term (acceptable for soft launch):** Migrate to Render's
  **persistent disk** add-on ($0.25/GB per month). Mount at
  `/var/data` and update the worker paths. Pros: no code change to
  the state shape. Cons: $0.25-2/mo extra, persistent disks lock
  you to a single instance (can't horizontal-scale).
- **Long-term (correct):** Migrate the worker state to Postgres
  tables. Schema already has `gifter_notification_subscribers` etc.
  referenced in MEMORY — needs to actually be used by the worker.

**Recommended for first deploy:** persistent disk. Move to Postgres
in a focused follow-up sprint after launch.

### 3. Build command — verify `script/build.ts` produces what `start` expects

Render runs your build command, then runs your start command.
Confirm:
```bash
npm run build
# should produce dist/index.cjs (the file `node start` runs)
# AND server/public/* (the Vite-built frontend the Express app serves)
```

If `script/build.ts` produces something else, the deploy boots but
fails on first HTTP request.

### 4. `.gitignore` — make sure `.env` is NOT committed

Already verified clean in prior commits but double-check before
pushing the deployment-config commit.

### 5. Session table auto-creation

`connect-pg-simple` creates the `session` table on first connection
when `createTableIfMissing: true` is set (per MEMORY locked
architecture). Verify this flag is true in `server/auth.ts`. If not,
first user login fails because the session table doesn't exist in
Supabase yet.

---

## The Render deploy itself — step by step

Once the pre-flight is done:

### Step 1: Create the Web Service

In Render dashboard → New + → Web Service:

| Field | Value |
|---|---|
| Repository | Connect `dovi-s/Kiddo` (GitHub OAuth from signup) |
| Name | `kora` (becomes part of the temp `kora.onrender.com` URL) |
| Region | US East (Ohio) or US West (Oregon) |
| Branch | `main` |
| Root directory | (leave blank) |
| Runtime | Node |
| Build command | `npm ci --ignore-scripts && npm run build` |
| Start command | `npm start` |
| Instance type | **Starter ($7/mo)** — NOT Free (workers need warm uptime) |
| Auto-deploy | Yes (deploys on every push to main) |
| Health check path | `/api/health` (need to verify this endpoint exists — if not, leave blank and Render uses a TCP check) |

### Step 2: Add environment variables

Paste each from your local `.env` mapping per the table above. Three
critical ones to NOT skip:

- `DATABASE_URL` — Supabase pooler URL
- `SESSION_SECRET` — fresh-generated, not your dev secret
- `APP_BASE_URL` — `https://kiddofund.com` (the eventual domain, not the Render temp URL)

### Step 3: Add the persistent disk (per pre-deploy fix #2)

In service settings → Disks:
- Name: `local-state`
- Mount path: `/var/data`
- Size: 1 GB (~$0.25/mo)

Then code-side, change `.local/` paths to `/var/data/` (or use an
env var `LOCAL_STATE_DIR=/var/data` and read it everywhere). Quick
sweep: `grep -rn "\.local/" server/` to find all the file paths.

### Step 4: Deploy

Click "Create Web Service." Render clones the repo, runs the build,
runs the start command. First deploy takes 3-5 minutes.

Watch the deploy logs in the Render dashboard. Failures usually fall
into one of three buckets:
- **Build fails** (TypeScript error / missing dep) → `npm run check`
  passed locally so this should be rare; check the Render log for the
  specific error
- **Service boots but crashes** → usually a missing env var; check
  the runtime log for `Cannot read property X of undefined`
- **Service boots but DB connection fails** → DATABASE_URL wrong
  (most common: missing `?sslmode=require`, wrong port, wrong creds)

### Step 5: Smoke tests on the temporary Render URL

Before pointing the real domain, hit `kora.onrender.com` (or whatever
Render gives you) and verify:

1. `/` renders the home page
2. `/login` renders
3. Try signing up a test account → user lands on dashboard
4. Try creating a fund → fund creates without error
5. Check Render logs for any `[ops]` Sentry-disabled warnings — they
   should be present until you set SENTRY_DSN

If all five smoke tests pass, you're ready for DNS.

### Step 6: DNS — point kiddofund.com at Render

In Cloudflare DNS settings:
- Add an A record (or CNAME if Render gives one) per Render's
  Settings → Custom Domains instructions
- Cloudflare proxy: **OFF for now** (gray cloud, not orange). Render
  handles TLS directly. Cloudflare proxy adds complexity that's not
  worth it Day 1.

In Render → Settings → Custom Domains:
- Add `kiddofund.com` and `www.kiddofund.com`
- Render auto-issues a Let's Encrypt cert in 5-10 minutes

DNS propagation: 5 minutes to 24 hours. Usually under 30 minutes.

### Step 7: Update Stripe webhook URL

In Stripe dashboard → Developers → Webhooks:
- Change the endpoint URL from `localhost:5000/api/stripe/webhook`
  (or whatever you have) to `https://kiddofund.com/api/stripe/webhook`
- Copy the new signing secret
- Paste it as `STRIPE_WEBHOOK_SECRET` in Render env vars
- Redeploy (Render auto-redeploys on env var change)

### Step 8: Verify Sentry + PostHog connect

Trigger a test error in production (e.g., load an admin endpoint
as a non-admin user). Verify Sentry receives the event. Trigger a
PostHog event (`/api/health` should emit one if wired correctly).
Verify both dashboards show data.

---

## Workers — running inside the Web Service

Kora's 5 background workers (gifter-notification, parent-lifecycle,
recurring-contribution, age-18-transition, mobile-push) all run
via `setInterval` inside the Express app. On the Render Starter
instance:

- **Workers keep running** as long as the service is alive (Starter
  doesn't sleep — that's why we picked it over Free)
- **Workers reset on every deploy** — the setInterval is recreated
  fresh, which is fine
- **Workers stop on rolling restart** during deploys — Render does
  zero-downtime deploys but the OLD instance's workers stop and the
  NEW instance's workers start fresh

This is acceptable for current scale. **Migration path** (if/when
workers need their own isolation or scaling): split each worker into
a separate "Background Worker" Render service ($7/mo per worker).
Don't do this until you have a real reason — single-instance is
simpler and cheaper.

---

## Cost summary at launch

| Item | Cost | Why |
|---|---|---|
| Render Web Service (Starter) | $7/mo | Hosts Kora + all 5 workers |
| Render Persistent Disk (1GB) | $0.25/mo | Replaces `.local/` jsonl state |
| Render Workspace (Hobby) | $0 | Free forever for solo dev |
| Supabase | $0 | Free tier covers Postgres + Storage at Kora's pre-launch scale |
| Cloudflare DNS | $0 | Free |
| Resend | $0 | Free 100 emails/day |
| Sentry | $0 | Free tier (5k events/mo) |
| PostHog | $0 | Free tier (1M events/mo) |
| Stripe | 2.9% + 30¢ per transaction | No flat fee |
| DriveWealth | varies by partnership | Negotiated separately |
| Domain (`kiddofund.com`) | $10-15/year | One-time + annual |
| **Total recurring** | **~$7.25/mo** | Until traffic forces tier-ups |

When you'd upgrade to **Render Pro ($25/mo workspace + same compute)**:
- Need staging-vs-production isolated environments (currently you can
  only have one project on Hobby)
- Need horizontal autoscaling (more than one instance for the same
  service)
- Need chat support during a live incident

Realistically: Pro becomes worth it ~3-6 months after launch.

---

## Day-2 operations

Once deployed:

| Concern | How to handle |
|---|---|
| **See logs** | Render dashboard → service → Logs tab (live tail) |
| **SSH into the running container** | Render → Shell tab (Hobby allows SSH) |
| **Roll back a bad deploy** | Render → Deploys → click an older successful deploy → "Redeploy" |
| **Check Postgres** | Supabase dashboard → SQL Editor for ad-hoc queries; Drizzle for migrations (`npm run db:push` runs against `DATABASE_URL` so be careful — keep dev/prod URLs straight) |
| **Stripe events not firing** | Verify webhook URL in Stripe + signing secret in Render env, then check `server/webhookHandlers.ts` logs |
| **An error in production** | Sentry catches it; for severity-1 issues set up Sentry → Slack integration |
| **Emails not arriving** | Resend dashboard → Activity; verify domain DNS records (SPF, DKIM, DMARC) are set in Cloudflare per Resend instructions |

---

## What's NOT in this plan (deliberately deferred)

1. **CI/CD with GitHub Actions** — already exists (see `.github/workflows/ci.yml`). Render auto-deploys on push to main, which is enough. Adding a deploy approval gate later is fine.
2. **Staging environment** — Hobby only has one project. Test on the Render temp URL before pointing DNS. When you have customers, upgrade to Pro and add staging.
3. **Database migrations in CI** — Render runs the start command, not migrations. Either run `npm run db:push` manually before deploying schema changes, OR add a `pre-deploy command` in Render that runs migrations (Render Pro feature).
4. **Horizontal scaling** — single instance is fine until you have meaningful traffic.
5. **Multi-region deploys** — pick one region, run there. Multi-region is a Pro+ concern.
6. **The DUNPHY_DEMO_SPEC.md money-flow sandbox** — currently only the gift-checkout endpoint is sandboxed. Production deployment shouldn't change that; demo accounts still work for browse/sandbox.
7. **The Stripe webhook signing-secret rotation strategy** — set once on deploy, rotate when Stripe asks.

---

## Sequencing on the day you actually deploy

A realistic half-day timeline:

| Time | Step |
|---|---|
| 0:00 | Verify Supabase project exists; copy DATABASE_URL |
| 0:10 | Generate `SESSION_SECRET` (`openssl rand -hex 32`) |
| 0:15 | Resend + Sentry + PostHog signup (skip if doing later) |
| 0:30 | Code changes: fix `start` script, swap `.local/` to `/var/data/`, push to main |
| 1:00 | Render new Web Service, paste env vars, deploy |
| 1:15 | Watch first deploy log, fix any boot errors |
| 1:45 | Smoke tests on temp Render URL |
| 2:00 | DNS: Cloudflare A record + Render custom domain |
| 2:30 | Stripe webhook URL update + signing secret refresh |
| 3:00 | Sentry + PostHog smoke events |
| 3:30 | First real user signup smoke test on `https://kiddofund.com` |
| 4:00 | Done. Watch logs for an hour. |

---

## References

- Internal: `IOS_WIDGETS_SPEC.md`, `DUNPHY_DEMO_SPEC.md` — same spec-doc shape
- Internal: `BACKUP_RUNBOOK.md` — once deployed, verify backups work via `npm run backup:drill`
- Internal: `DEPLOYMENT_CHECKLIST.md` — broader pre-launch checklist (legal, brokerage, KYC, etc.)
- External: [Render Node.js deploy docs](https://render.com/docs/deploy-node-express-app)
- External: [Supabase + Render](https://supabase.com/partners/integrations/render)
- External: [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction)

---

## When to come back to this plan

Execute when ALL of these are true:

1. **Soft-launch readiness** — you have a feature set you're proud to show real users, even if the user count is "your family + 10 friends"
2. **A focused half-day** — not bolted onto a session where you also want to ship other features. Deployment is its own task.
3. **Pre-launch checklist clear** — `DEPLOYMENT_CHECKLIST.md` items addressed (legal, brokerage, etc.)

If any of those is false: keep iterating locally, ship the demo, get the product polished. Production deploy waits for the readiness signal.
