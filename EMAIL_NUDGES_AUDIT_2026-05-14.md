# Email + Nudges Audit: 2026-05-14

End-to-end audit of every transactional / lifecycle email path in Kiddo,
with focus on duplicate-send risk, re-enrollment correctness, and
race-condition exposure. Four real issues found; three fixed in this
commit. The remainder is operational debt with no current user impact.

This doc is the running record. Update it when fixes ship or new
nudge surfaces get added.

## Systems audited

| System | File | State path |
|---|---|---|
| Email send / outbox | `server/emailDelivery.ts` | `.local/email-outbox.jsonl` |
| Gifter notifications | `server/gifterNotificationWorker.ts` | `.local/gifter-notifications.json`, `.local/gifter-notification-queue.jsonl`, `.local/gifter-notification-deliveries.json` |
| Parent lifecycle | `server/parentLifecycleWorker.ts` | `.local/parent-lifecycle-state.json`, `.local/parent-lifecycle-queue.jsonl`, `.local/parent-lifecycle-deliveries.json` |
| Recurring contributions | `server/recurringContributionWorker.ts` | Database (`parent_contributions`) |
| Fund value milestones | `server/milestones.ts` | Database (`activities` table) |

## Findings

### Issue 1: Card decline emails had no cooldown (FIXED)

**Symptom:** when a recurring charge failed, the worker sent a "Time to
add to {child}'s fund" email immediately. Stripe's retry cadence can
fire the same recurring contribution on multiple consecutive worker
ticks (retry-every-N-days windows, persistent declines). Without a
cooldown, a parent with a dying card got the same nag email once per
retry day. Worst case: 3-5 identical emails over a single billing
failure window.

**Why this mattered:** the recipient is already having a bad moment
(their card is declining). Pelting them with the same message daily
turns a soft trust signal ("we noticed and let you know") into a hard
trust failure ("they don't even check their own outbox").

**Fix:**
- Added `lastDeclineEmailAt timestamp` column to `parent_contributions`
  (`shared/schema.ts`).
- Worker reads the field before sending. If within 72h, skips with a
  log line, still records the failure as an activity row (in-app
  surface stays current). After sending, stamps the field to NOW().
- Constant `RECURRING_DECLINE_EMAIL_COOLDOWN_HOURS = 72`. Short enough
  to re-surface persistent declines reasonably; long enough that a
  single failing card doesn't flood the inbox.
- Defensive against the column being undefined for legacy rows (treats
  undefined as "no prior email," so pre-`db:push` behavior is the
  current behavior, which is the safest degradation path).

**Files touched:** `shared/schema.ts`,
`server/recurringContributionWorker.ts`. Requires `npm run db:push` to
add the column.

### Issue 2: Activation sequence re-fired after gift refund (FIXED)

**Symptom:** the activation sequence (Day 1, Day 3, Day 7 emails) was
gated on `giftCount === 0`. After a first gift settled, the parent
moved out of activation. But if that gift later got refunded and
`giftCount` dropped back to 0, the activation block resumed and could
send stale "get your first gift!" copy to a parent who had already
experienced one.

**Specific scenario:** parent creates fund Day 0. Gets a $50 gift from
Aunt Sally Day 0.5. Day 1 worker tick: `giftCount === 1`, activation
block skipped, `activationDay1SentAt` flag never set. Day 4: gift
refunded, `giftCount` drops to 0. Day 4 worker tick: `ageDays === 4`,
activation block runs, Day 1 + Day 3 emails fire. Parent receives a
"get your first gift!" pitch four days after they already got and lost
one.

**Fix:** added `!fundState.firstGiftSentAt` to the activation outer
gate. Once first-gift email has fired, activation is permanently retired
for that fund. The `firstGiftSentAt` flag persists across refunds, so
the gate is stable.

**Files touched:** `server/parentLifecycleWorker.ts:485` (gate
expression).

### Issue 3: First-gift pile-up with high-amount opening gifts (FIXED)

**Symptom:** when a fund's very first gift was large enough to cross
multiple parent milestone thresholds in one shot (e.g., a $1,500 first
gift from a grandparent), the worker queued the `first_gift` email AND
each of `milestone_100`, `milestone_500`, `milestone_1000` on the same
tick. Four emails to the parent in one hour, all about the same gift.

**Why this mattered:** the first-gift email already carries the
emotional beat ("Aunt Sally sent your first $1,500"). Layering three
"you crossed $X!" emails on top reads as spam, the system doesn't
understand context, and dilutes the moment.

**Fix:** when the first-gift email queues on a tick, suppress same-tick
milestone email queuing. The milestone flags still flip to consumed so
they don't re-fire on a future tick when the threshold is no longer
new. Result: one "you got your first gift, here are the highlights"
email instead of four.

**Files touched:** `server/parentLifecycleWorker.ts:546-585` (added
`firstGiftQueuedThisTick` local flag, gated the milestone enqueue on
it).

### Issue 4: Email-layer dedupe (FIXED, partial)

**Symptom:** `sendEmail()` in `emailDelivery.ts` was a thin Postmark /
SendGrid passthrough with no dedupe of its own. Each worker had its own
dedupe layer (queue file + delivery log), but anything that bypassed
worker queues (webhook handler retries, route handler one-offs, race
conditions during overlapping ticks) could land the same payload at the
ESP twice.

**Fix:** added an in-process dedupe cache keyed on
`sha1(recipient + subject + text body + first tag)` with a 12-hour TTL.
Pruned lazily on each send. Capped at 5,000 entries with oldest-out
eviction. Mode `"dedupe_skipped"` returned when a duplicate is caught.

**Partial:** the cache lives in process memory. On Node restart it
resets, and a horizontally-scaled deployment would have one cache per
instance. This is intentional. The per-worker delivery logs already own
the long-term dedupe responsibility; this layer is the SAFETY NET for
the cracks. If/when we move state to DB, this cache can graduate to a
table with the same shape.

**Files touched:** `server/emailDelivery.ts`.

## Findings NOT fixed in this commit

### Issue 5: File-based state has lost-update race

`gifterNotificationWorker.ts` reads `gifter-notifications.json`,
mutates, writes back. Two simultaneous webhook gifts from the same
gifter on the same fund can race: both read count=5, both increment to
6, last-write-wins, actual count should be 7 but stored as 6.

**Impact:** `lastMilestoneNotifiedThreshold` ratchet can lose track,
allowing a milestone email to fire twice. Affects gifter side only.
Per-gift dedupe (`day7SentByGiftId`) has the same shape.

**Why not fixed:** the right fix is moving this state into the database
(transactional safety). File locking is a bandage that adds complexity
without solving the multi-process case. Punted until either (a) we see
evidence the race is biting (currently no reports), or (b) we're moving
other state to DB and can do this together.

### Issue 6: Queue files never truncated

`.local/gifter-notification-queue.jsonl` and
`.local/parent-lifecycle-queue.jsonl` are append-only. On every worker
tick the file is read in full and entries checked against the delivery
log. Dedupe is correct, but the files grow unbounded.

**Impact:** memory + I/O cost is linear with time, not user-visible.
Production operational cleanup task.

**Why not fixed:** zero current user impact. Add a periodic compaction
task before the file size becomes operationally meaningful (probably
6-12 months out at current scale).

### Issue 7: State file recovery is unsafe

If `.local/parent-lifecycle-state.json` or
`.local/gifter-notifications.json` gets deleted or corrupted, all
dedupe flags reset and the next worker tick re-sends every still-
applicable email. Concrete worst case: a deployment wipes the .local
directory; every parent with a settled gift gets their `first_gift`
email again.

**Why not fixed:** also wants the DB move to be the real solution.
Mitigation today: don't wipe `.local/` in deployment scripts.

### Issue 8: Anonymous gifters in year-end recap

Year-end recap synthesizes a subscriber record for anonymous gifters.
If the same anonymous gifter (same masked email) gave in year 1 and
year 2, the recap fires per-year per-email, so two recaps. May or may
not be intentional. Listed for awareness.

## Already-clean systems (no dedupe risk)

Confirmed correct during the audit. Adding to the running record so
future audits know they were verified, not skipped.

- Gifter birthday reminders. Year-keyed flag, one per calendar year per
  fund.
- Gifter holiday reminders. Window-keyed (Nov 15 to Dec 5), one per
  season per fund.
- Gifter day-7 follow-up. Per-gift dedupe via `day7SentByGiftId`. Each
  gift gets its own day-7 nudge. A gifter who gives twice in a month
  correctly gets two day-7 emails, one for each gift.
- Gifter milestone notifications. Threshold ratchet via
  `lastMilestoneNotifiedThreshold`. Highest threshold wins; lower
  thresholds skipped if already crossed.
- Gifter dormancy check-ins. 6-month minimum between sends.
- Gifter anniversary emails. Per-gift-per-year key.
- Year-end recaps. Per-year-per-gifter (caveat above about anonymous).
- Parent birthday reminders. Year-keyed.
- Parent dormant re-engagement. 45-day minimum between sends.
- Milestone activity dedupe. DB-level via `type` + metadata match in
  `server/milestones.ts:hasMilestone()`.

## Re-enrollment scenario (the question that prompted this audit)

**"Gifter gives gift A. Enters whatever post-gift sequence exists.
Gives gift B 3 weeks later. Does the post-gift sequence restart? Run
in parallel?"**

After the fixes above, the answer is clean:

- **Birthday / holiday / anniversary / dormancy emails**: time-keyed,
  not gift-count-keyed. A second gift in the same calendar window does
  not re-fire them. Correct.
- **Day-7 follow-up**: each gift gets its own day-7. Two gifts in three
  weeks = two day-7 emails (each 7 days after its own gift). Correct.
- **Milestone notifications (gifter side)**: ratchet by threshold. A
  second gift that doesn't cross a new threshold fires nothing
  additional. Correct.
- **Milestone notifications (parent side, after fix)**: same ratchet
  logic plus the new first-gift-pile-up suppression. The parent gets
  one welcome on first gift; later gifts can fire later milestones
  cleanly. Correct.
- **Activation sequence (after fix)**: permanently retired once the
  first-gift email has fired. A refund + new gift does not re-enter
  activation. Correct.

The gifter giving a second gift does not "re-enroll" anywhere; the
nudge systems are state machines keyed on the underlying signals, not
on enrollment. That's the right architecture; this audit just had to
prove it.

## Operational notes

### After deploy

1. Run `npm run db:push` to add the `last_decline_email_at` column to
   `parent_contributions`. Until this runs, the cooldown is a no-op
   (column undefined treated as "no prior email"), so deployment is
   safe in either order.

### Email dedupe cache observability

If you want visibility into what's being deduped, the cache size +
`mode: "dedupe_skipped"` return values are the signals. Could add a
counter in production logging if false positives become a concern.

### Next audit triggers

Re-run a similar audit when any of these ship:
- A new lifecycle nudge type is added (e.g., a new "approaching 18"
  email per `FUND_STATES_SPEC.md`).
- The state-file-to-DB migration happens.
- A horizontal scaling event (would expose any race conditions latent
  in single-process assumptions).
