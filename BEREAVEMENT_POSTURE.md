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

## Build status (2026-06-11) — the freeze is built + verified

**Built + verified (`npm run test:memorialized-silence` green, tsc clean):**
- `funds.memorialized_at` is **live** (migration 0047, journaled; schema field). Set by
  a HUMAN, reversible, NEVER by automation.
- **`server/memorialized.ts` — the fail-closed silence gate** (`shouldSilenceForFund`):
  memorialized → silence; fund-we-can't-read → silence; no fund context → never gated.
- **Charge freeze (the worst harm — COMPLETE):** the gifter off-session charge
  (`stripeService.chargeGifterOffSession` chokepoint + the `giftIntentSettlement`
  caller, which holds silently rather than marking a decline) and the parent recurring
  contribution (`recurringContributionWorker`) both refuse/skip for a memorialized
  fund, fail-closed.
- **Email chokepoint:** `sendEmail` suppresses any email carrying a memorialized
  `fundId` (mode `bereavement_suppressed`); non-fund/transactional mail is never gated.
- **Worst email workers threaded:** birthday, kid-milestone, anniversary pass `fundId`,
  so the chokepoint fires for them. Verified suppressed.
- **`test:memorialized-silence`** asserts the whole chain (marks a real fund, asserts,
  restores). This test must never go red.

**Coverage — every automated surface is now gated (`test:memorialized-silence` green,
tsc clean):**
- **Charges (chokepoint, fail-closed):** recurring contribution + gifter off-session
  refuse for a memorialized fund.
- **Email chokepoint:** `sendEmail` suppresses any email carrying a memorialized
  `fundId`; non-fund/transactional mail never gated.
- **10 single-fund email workers thread `fundId`** → suppressed at the chokepoint:
  fundBirthday, kidMilestone, fundAnniversary, monthlyPulse, yearEndWrapped,
  holidayWarmth, taxSeasonPrep, volatilityReassurance, gifterReturnReminder,
  sealedLetterDelivery.
- **Handoff workers (source-query filter):** `age18Transition`, `stalledHandoff`,
  `postHandoffEngagement` exclude memorialized funds at the query (a memorialized child
  never reaches handoff); postHandoff also threads `fundId` on its sends.
- **Gifter-AGGREGATE (query exclusion, NOT whole-email suppression):** `gifterYearEnd`
  + `gifterNotification` exclude memorialized funds from the aggregate, so a gifter's
  recap/nudge counts only their LIVING recipients — their other kids are untouched.
- **User-scoped:** `pmfSurveyTrigger` skips anyone who owns or gifted to a memorialized
  fund (`shouldSilenceForEmail`). A "how are we doing?" survey never reaches a bereaved
  person.
- **Queue-driven:** `parentLifecycle` threads the queue record's `fundId` (only when
  fund-scoped).
- **Push channel:** `mobilePush`'s `sendExpoPush` refuses for a memorialized fund (via
  `metadata.fundId`); fund-scoped pushes carry it for deep-linking.
- **Deliberately OUT (account-level):** subscription renewal — the parent may have
  other living children; that's the human runbook's call, not the fund freeze.

**Verified:** `test:memorialized-silence` proves the charge refusal, the email
suppression at the chokepoint, the fail-closed gate, the user-level silence, and that
active + transactional mail are untouched. The query-level + push gates are confirmed by
code inspection. **The machine is silent for a memorialized fund.**

> Forward note: new fund-scoped workers must pass `fundId` to `sendEmail` (or filter
> their fund query) — `shouldSilenceForFund` / `shouldSilenceForEmail` in
> `server/memorialized.ts` are the gates; extend `test:memorialized-silence` for each.
