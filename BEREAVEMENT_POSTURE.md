# Kiddo — Bereavement Posture + the Comms Freeze

*If a child (or a parent) dies, or a family suffers a real tragedy. The locked human
posture, and the one engineering requirement that must never fail: the machine must
go silent. Written 2026-06-11. The "Chewy move," done right — and done for the most
precious thing there is.*

> A Kiddo account is not a box of dog food. It is a vault of love for a child — the
> Memory Book full of notes and photos from everyone who adored them. So we are
> uniquely positioned to be tender here, and uniquely capable of being cruel if the
> automation keeps running. This doc locks both halves.

## The posture (locked)

- **Be radically human.** A family losing a child is the most devastating thing there
  is. The brand's whole soul shows in this moment or it is hollow.
- **Human-triggered, never auto-detected.** We act only when the family *tells* us, or
  on a signal we can *confirm*. **Never** on an inferred/algorithmic guess. A false
  "sorry for your loss" sent for a living child is unforgivable, and there is no
  acceptable error rate. (This is also why Chewy's works: a *person* noticed.)
- **Human-executed, never templated at the heart.** The gesture is a real person, with
  discretion, a *handwritten* note — not a flow, not a script.
- **Refund everything, unasked.** Anything pending, returned immediately.
- **The gesture:** flowers + a handwritten note — and the thing only we can give: the
  **Memory Book, preserved** (printed beautifully / a permanent keepsake), every note
  and photo from everyone who loved their child, gathered, theirs forever. That is not
  customer service; it is giving grieving parents their child's love back, in one
  place. Do the flowers *and* the keepsake.
- **Do it because it is right.** Never measure it, never market it, never make it a
  "bereavement flow" with a metric or a PR angle. The instant it becomes a tactic it
  dies. If it spreads the way Chewy's did, that can only ever be a side effect of
  meaning it.

## The #1 requirement: STOP THE MACHINE (before anything else)

The cruelest thing is not failing to send a gift — it is the **automation continuing.**
The moment a fund is known to be bereaved, every automated email, nudge, digest, push,
and **charge** must go silent. This matters more than the flowers, and it is the part
to engineer.

### The surface audit — what would currently be cruel (verified 2026-06-11)

**`memorialized_at` is scaffold-only:** migration 0041 (NOT journaled, column not live)
+ an `isMemorialized` gate in Dashboard.tsx (client display only). **ZERO workers gate
on it** (`grep memorializ server/*Worker.ts` → empty). So today, a bereaved family
would receive ALL of the following:

| Worker | Would send/charge | Cruelty |
|---|---|---|
| `fundBirthdayWorker` | "Happy birthday, [child]! 🎉" | catastrophic |
| `fundAnniversaryWorker` | "[child]'s fund turned N!" | catastrophic |
| `kidMilestoneWorker` | "[child]'s fund hit $X!" | severe |
| `monthlyPulseWorker` | monthly fund digest | severe |
| `yearEndWrappedWorker` | year-end "Wrapped" recap | severe |
| `holidayWarmthWorker` | holiday gifting nudge | severe |
| `taxSeasonPrepWorker` | tax-season prep email | severe |
| `volatilityReassuranceWorker` | "market dropped, don't worry" | severe |
| `pmfSurveyTriggerWorker` | "how are we doing?" survey | grotesque |
| `gifterNotificationWorker` | nudges the WHOLE family to "gift to [child]" | catastrophic |
| `gifterReturnReminderWorker` | "come back and gift again" | severe |
| `gifterYearEndWorker` | year-end gifter email | severe |
| `parentLifecycleWorker` | parent lifecycle nudges | severe |
| `postHandoffEngagementWorker` | engagement nudges | severe |
| `mobilePushWorker` | push notifications | severe |
| `recurringContributionWorker` | **charges the parent's card** | catastrophic |
| recurring-gift charge path (`giftIntentSettlement`/`stripeService`) | **charges gifters' cards** | catastrophic |
| `sponsoredSubscriptionRenewalWorker` | **charges/renews subscription** | severe |
| `age18TransitionWorker` / `stalledHandoffWorker` | handoff logic for a child who won't reach 18 | severe |
| `sealedLetterDeliveryWorker` | delivers a letter written *for the child's future* | handle with extreme care |

**Should still run:** `giftIntentExpiryWorker` (it *refunds* — good), `accountDeletionWorker`
(already has a deceased-account safety net), `demoResetWorker`, internal monitors.

### The safe design: fail-closed chokepoints, NOT 20 per-worker guards

Gating 20 workers by hand guarantees someone eventually forgets one — and the missed
one is the catastrophe. So gate at the *delivery* chokepoints, fail-closed, in layers:

1. **Delivery-layer guard (the bulletproof last line):** `server/emailDelivery.ts`'s
   send path and the card-charge path (`stripeService` off-session charge) **refuse for
   a memorialized fund.** If both refuse, *no worker can be cruel even if it forgets to
   check.* This is the single highest-leverage change.
2. **Source-layer exclusion:** the fund queries workers use to pick who to act on
   exclude memorialized funds, so most never even see them.
3. **Defensive per-worker guard** (`isFundMemorialized(fund)` at the top of each
   send/charge loop) as belt-and-suspenders.
4. **Fail-closed:** if the memorialized state can't be read with certainty, **do not
   send / do not charge.** Silence is always the safe default here.
5. **A verification test** (`test:memorialized-silence`) that asserts *every* surface in
   the table above skips a memorialized fund. This is the test that must never go red.

### State model
Journal 0041 + add `memorializedAt: timestamp` to `shared/schema.ts`. Set **only by a
human** on a confirmed notification (founder now; a trained, empowered person later).
**Reversible** (in case of error). Distinct from `transferredAt` (handoff) and account
deletion. Setting it = the freeze engages everywhere at once.

## The human runbook (what a person does on a confirmed loss)
1. **Set `memorializedAt`** → the freeze engages (all of the above goes silent).
2. **Refund** anything pending, unasked.
3. **Reach out personally** — gently, no template, offering to handle everything.
4. **Send flowers + a handwritten note.**
5. **Offer the preserved Memory Book keepsake** — the love, gathered, theirs forever.
6. **Handle the assets with extreme gentleness.** A deceased minor's UTMA passes to the
   minor's estate (probate) — legally distinct, counsel-gated (see
   COUNSEL_ENGAGEMENT_PACKET, the deceased-minor-beneficiary case). The comms freeze is
   the *immediate human need*; the asset/estate handling is separate and slower. Never
   make the grieving family navigate either alone.

## Why this is spec'd, not half-built right now
Deliberately. Wiring 20 workers in one pass on the most sensitive surface in the
product — while the `memorialized_at` column isn't even live yet — risks missing one,
and a missed one is a birthday email to a parent who just buried their child. The
fail-closed chokepoint design above makes the real build small (~the two delivery
paths + the test), bulletproof, and verifiable. That build should happen with intent
and a green `test:memorialized-silence`, not as a rushed sweep. **The posture is locked
today; the freeze is the next deliberate build.**
