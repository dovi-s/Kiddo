# .local State → Postgres: the durable-state workstream

**Status:** SPEC — locked scope, not started. **Gate:** must land before
multi-instance production or real money movement (custody live). Not
dev-blocking today (single instance, simulated holdings).

**The problem in one line:** ~25 features persist business state to
`.local/*.json[l]` files or module-scope Maps. Every one of them silently
resets on redeploy and diverges across instances. One redeploy in December
re-sends every holiday email; one restart during a checkout retry window can
double-charge a card.

**The pattern already exists in-repo — copy it.** Two modules made this exact
migration and document the playbook:
- `server/ageTransitionStore.ts` — Postgres-backed (`age_transitions` table),
  **same reader/writer signatures so no call site changed**, one-time
  idempotent backfill from the legacy JSON on first call, file left in place.
- `server/oauthIdentityStore.ts` — same shape.
- PMF survey responses — `pmf_survey_responses` (migration 0038, "was an
  ephemeral JSONL that didn't survive redeploys").
- DB-backed rate limiting already exists (migration 0037) — the remaining
  in-memory limiters just don't use it.

**Migration discipline:** hand-write idempotent SQL + a `meta/_journal.json`
entry. NEVER `db:generate` (stale snapshots emit a bogus 455-line catch-up
migration — see project memory `drizzle-migration-tooling-gotcha`).

---

## Tier 1 — money / trust correctness (do first, ~2–3 days)

| State | Where | What breaks on wipe/divergence |
|---|---|---|
| **Checkout idempotency cache** | `routes.ts` ~1714 (in-memory Map) | Restart during a payment retry window → duplicate Stripe charge. The scariest single item. → small `checkout_idempotency` table (signature, key, expires_at) or Stripe idempotency keys derived deterministically from the request (no store at all — investigate first; deterministic derivation may delete the problem). |
| **Trial / monetization state** | `services/monetization.ts:201` (`monetization-state.json`) | Active reverse-trials vanish → coverage flips to uncovered mid-trial, held-gift release + fee math wrong; admin `reverseTrialEnabled: false` override silently reverts. → `fund_trials` table + a `platform_settings` row for the flag. Already flagged in memory; this spec is its home. |
| **Gifter notification state + queue + deliveries** | `gifterNotificationWorker.ts:11-14` (4 files) | All dedup flags (birthday/holiday/age-18/milestone/dormancy/year-end) lost → duplicate sends to every gifter after restart; queue/outbox lost → silently dropped sends. → subscriber state table + the shared `worker_send_log` below + `email_outbox`. |
| **Kid-view registry** | `auth.ts:1017`, `routes.ts` ~171 (`kid-view.json`) | Every shared kid-view link + PIN dies on deploy. Grandparents' bookmarked links 404. → `kid_view_settings` table. |
| **Gift codes** | `routes.ts` ~167 (`gift-codes.json`) | Printed/shared verbal gift codes stop resolving after deploy. → `gift_codes` table. |
| **Gifter accounts state** | `routes.ts` ~170 (`gifter-accounts.json`) | Gifter dashboard saves/links lost. → table. |
| **Email outbox** | `emailDelivery.ts:34` (`email-outbox.jsonl`) | ESP outage → emails stranded in a file nobody watches, no retry, no alert. → `email_outbox` table + retry worker + **ops alert when fallback fires** (see Alerts). |
| **Custodian transfer outbox** | `custodianTransfer.ts:35` (`custodian-transfer-outbox.jsonl`) | Queued at-majority broker transfers lost. Harmless today (scaffold), MUST be durable before custody wires — fold into the DriveWealth build. |

## Tier 2 — send-dedup workers (one shared fix, ~1–2 days)

Nine workers share the identical shape: "did I already send X for fund/user Y
in period Z?" persisted as a keyed JSON file. One table kills all nine:

```sql
worker_send_log (namespace text, dedupe_key text, sent_at timestamptz,
                 PRIMARY KEY (namespace, dedupe_key))
```

| Worker | File |
|---|---|
| Age-18 transition reminders | `age18TransitionWorker.ts:65` |
| Fund birthday | `fundBirthdayWorker.ts:30` |
| Fund anniversary | `fundAnniversaryWorker.ts:19` |
| Holiday warmth | `holidayWarmthWorker.ts:21` |
| Gifter year-end wrapped | `gifterYearEndWorker.ts:45` |
| Gifter return reminder | `gifterReturnReminderWorker.ts:27` |
| Kid milestone | `kidMilestoneWorker.ts:23` |
| Monthly pulse | `monthlyPulseWorker.ts:14` |
| PMF survey trigger sends | `pmfSurveyTriggerWorker.ts:58` |
| Parent lifecycle (state+queue+deliveries) | `parentLifecycleWorker.ts:9-11` |
| Mobile push (state+queue+deliveries) | `mobilePushWorker.ts:4-6` |

Mechanical: a `hasSent(namespace, key)` / `markSent(namespace, key)` helper
with the ageTransitionStore backfill pattern, then swap each worker's
read/write. Blast radius of NOT doing it: duplicate emails after every
deploy, multiplied by instance count.

## Tier 3 — fine to leave (explicitly not in scope)

- `marketQuotes.ts:101` — pure price cache, refetches itself. Leave.
- `fundStrategyConfig.ts` / `oauthIdentityStore.ts` — legacy read-only
  migration shims, already DB-backed. Leave.
- Waitlists (`personal-fund`, `international` JSONL) — append-only, low value,
  acceptable loss pre-launch; founding-members already has a DB hydrate
  (migration 0033) — **verify the JSONL at `routes.ts:150` is now write-through
  to DB, then retire the file read at ~5357**.
- `memory-entry-meta.json` (`routes.ts:2350` — pins/visibility) — migrate in
  Tier 2 batch (it's user-visible state: pinned memories unpin on deploy), but
  it's cosmetic-loss, not money/trust.
- `investment-config.json` + `fundInvestmentPreferences.ts:19` — verify
  contents; if they hold per-fund user choices (they appear to), promote to
  Tier 1; if admin defaults, Tier 2.

## In-memory Maps (same workstream)

- Checkout idempotency (Tier 1, above).
- `reportRateLimit` (`routes.ts` ~1620) + public-upload limiters (~2125) —
  point them at the existing Postgres rate limiter (mig 0037 pattern). Also
  fixes their unbounded-growth memory leak.
- `productNameById` (~1918) — add a size cap; it's a cache, doesn't need DB.

## Alerts (small, same branch)

One `opsAlert(scope, message, meta)` helper (logs loudly + emails the founder
when an ESP is configured; no-op gracefully when not). Wire into:
1. `emailDelivery.ts` outbox fallback (email system went dark),
2. `recurringContributionWorker.ts` charge failures (today: console.error
   only — the parent may never learn their recurring is failing),
3. `webhookHandlers.ts` catch blocks on the gift-settlement path (today the
   webhook marks processed even when sub-steps fail),
4. `giftIntentSettlement.ts` declined-charge path.

## Sequencing

1. **Now → launch:** nothing here blocks the five launch must-haves. Don't
   start it ahead of them.
2. **Before custody-live / real money:** Tier 1 + Alerts (~2–3 days).
3. **Before multi-instance / first traffic spike:** Tier 2 (~1–2 days).
4. Tier 3 never, unless promoted by the verify notes above.

Definition of done: `rm -rf .local && redeploy ×2 instances` loses nothing a
user can see, double-sends nothing, double-charges nothing.
