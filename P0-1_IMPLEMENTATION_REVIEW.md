# P0-1 Implementation Review — advisory panel on the BUILT Option C

*Produced by the `advisory-panel` workflow run against the actual committed code,
2026-05-29 (5 of 6 positions returned; one failed to emit structured output).
Decision-support, not licensed advice — see disclaimer in `P0-1_ADVISORY_PANEL_DECISION.md`.*

## Verdict
**Architecture sound; build ~70% (not done); merging is zero-risk (flag OFF); do
NOT flip `GIFTER_CAPTURE_AT_INTENT` to true until five WRITTEN gates close.**
Unanimous on the architecture and the ship-gate; the sharp correction is that the
gates are *blocking and require written sign-off*, not parallel rubber-stamps.

## What the panel found wrong / missing (and status)
1. **Missing decline-retry worker for `gift_intents`.** The dunning cascade reused
   in settlement runs on `recurring_gifts`, a different table — so a declined
   off-session charge currently just records `declined` and stops. **STILL OPEN
   (next increment).**
2. **No orphan monitoring** (charge succeeds but custodian/BD rejects → funds in
   limbo). **STILL OPEN.**
3. **Disclosure placeholder below the required floor** — omitted the trigger, the
   60-day window, the retry loop, the no-charge-if-unpaired guarantee, and
   affirmative consent. **FIXED 2026-05-29** — added a point-of-charge disclosure
   interstitial with affirmative consent shown *before* the redirect in
   `GiveAGift.tsx` (meets §5 floor; copy still PENDING COUNSEL).
4. **Double-charge / idempotency risk** on settlement retry. **FIXED 2026-05-29**
   — off-session charge now uses an idempotency key (`gifter-settle-<intentId>`).
5. **Expiry worker** must cover the capture case (delete SetupIntent; no refund).
   `giftIntentExpiryWorker.ts` exists — **needs confirmation/extension. OPEN.**
6. **Tests** for intent → setup → pairing → charge → invest, and decline → dunning.
   **OPEN.**

## 🔴 Five WRITTEN gates before the flag flips to true
| # | Gate | Owner |
|---|------|-------|
| 1 | **Off-session MTL/MSB classification** — does charging off-session on the parent's unilateral pairing trigger, with a 14-30d retry loop, trigger FinCEN MSB / state MTL, or does Stripe's acquirer license cover it? Needs a **formal written opinion** (regulators weigh *control over timing/direction*, not possession; "Stripe holds the token" is an argument, not a shield). | Securities counsel |
| 2 | **Broker-dealer multi-gifter acceptance** — written amendment/side-letter that the BD accepts multiple non-parent gifters into one minor UTMA + AML source-of-funds + projected volume, with a test batch. | BD/custodian + counsel |
| 3 | **Point-of-charge + dunning disclosure** — written approval the UX satisfies UDAAP (12 CFR §1026.61), Reg E, ROSCA, EFTA, strictest state UDAP (CA/NY/IL/TX); checkbox vs banner. | Consumer-protection counsel |
| 4 | **Stripe Compliance pre-clearance** — notify Stripe this is *gifting* off-session (not SaaS dunning) + parent-triggered retry; get the use case blessed in writing. | Payments ops → Stripe |
| 5 | **Gift-completion timing** — UTMA gift complete at the off-session charge date, not the SetupIntent date (IRC §2511); no Form 709 ambiguity. | Tax counsel |

## §5 — required point-of-charge disclosure floor (now implemented as draft)
Shown before the Checkout redirect, affirmative consent; ship nothing weaker:
> **Your card will be saved and charged later — not today.** (1) We save your card
> now; you will not be charged today. (2) Your card is charged $[amount] when
> [kid]'s parent creates the fund. (3) If no fund is ever created, your card is
> never charged and we delete it after 60 days. (4) If a charge fails we email you
> and retry over 30 days; your gift isn't complete until it succeeds. (5) One-time
> charge, not a subscription. (6) By continuing you authorize this future one-time
> charge. *(checkbox if counsel deems ROSCA negative-option rules apply.)*

## Fee model note (panel flagged for confirmation)
We charge exactly the pledged amount and net it all to the fund (Kiddo absorbs
Stripe processing). Consistent with "every dollar reaches the kid," but confirm
sustainability pre-launch.
