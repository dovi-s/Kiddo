# Kiddo — Minimum-Spend Go-Live Plan

*The whole path to a real, invite-only launch (real money, real accounts) on one
page. Written 2026-06-11. Companion to BUSINESS_STRUCTURE.md (the rent-the-rails
structure), COUNSEL_ENGAGEMENT_PACKET.md (the legal gate), LOOP_TEST_RUNSHEET.md
(what the launch measures).*

> **One sentence:** rent Alpaca for the back end, buy one narrow legal memo, wire
> the money-in bridge + email, launch invite-only with stranger-UGC held back, and
> you are live for real for **under ~$10K cash + your build time.**

---

## Is Alpaca end-to-end? No — here's the exact line

**Alpaca covers (you do NOT build or register for):** custodial UTMA/UGMA account
opening, custody of cash + shares, trade execution (stocks + ETFs, fractional),
**KYC/CIP**, **AML/OFAC monitoring + SAR filing**, **SIPC** coverage, monthly
statements, **annual 1099 tax reporting**, and being the registered broker-dealer.
That last point is the whole game: *because Alpaca is the BD, Kiddo is not* — which
kills the single most expensive registration.

**Still YOURS after Alpaca (this is the "are we all set" gap):**
1. **The RIA / adviser determination.** Alpaca handles the *brokerage* side; whether
   *Kiddo* gives "advice" is a separate question Alpaca does nothing for. The
   self-directed posture (neutral menu, no managed/age-banded allocations, no
   nudges) is what keeps you a *platform*, not an adviser. **This is the memo.**
2. **The money-in bridge + any pre-account holding.** Gifts arrive via Stripe
   (card); Alpaca funds via ACH. Moving money Stripe -> (your holding account) ->
   Alpaca, and *especially* holding a gift before the account exists
   (capture-at-intent), is the **money-transmission** question. Once funds are at
   Alpaca it's their problem; before that it's yours.
3. **Privacy / COPPA / child-data / UGC.** Alpaca never touches the Memory Book,
   Kid View, gift notes/photos, or the child-privacy posture. Entirely yours.
4. **Marketing claims** (present-tense investing, projections). Yours.

## The regulatory map — federal + state, and why structure beats licensing

The two regimes with a painful **50-state** dimension are **RIA registration** and
**Money Transmitter Licenses**. Kiddo's structure is designed to avoid *both* — and
that avoidance, confirmed by one memo, is what lets you **launch nationally on day
one** instead of state-by-state.

| Regime | Level | Status under our structure |
|---|---|---|
| **Broker-dealer registration** | Federal/FINRA | **Avoided** — Alpaca is the BD. ✅ |
| **SEC RIA** | Federal | **Avoided IF self-directed** (memo confirms). Sub-$100M advisers register at **state** level, not SEC — so "too small for SEC" is a *trap*, not a relief. |
| **State RIA** | State (50) | **Avoided IF self-directed.** The painful one if the structure fails (e.g., default ETF mix deemed advice). Memo's #1 job. |
| **Money transmission (MTL)** | State (50) + FinCEN MSB | **Avoided IF money flows gifter -> Alpaca, out of our control.** Memo's #2 job. Pre-account holding is the risk edge. |
| **State blue-sky / securities** | State | **Avoided** — the BD's registration covers the offering mechanics. ✅ |
| **UTMA account law** | State | *Compliance, not approval* — mechanical (age 18/19/21; SC+VT use UGMA). Alpaca + our age logic already handle it. ✅ |
| **COPPA** | Federal/FTC | **Ours.** "Collected from the adult, not the child" posture. Quick memo read (Part 5). |
| **State kids'-privacy (CA AADC + wave)** | State | **Ours, regardless of COPPA** — reaches minors to 18. Confirm obligations. |
| **CSAM / NCMEC (§2258A)** | Federal | **Ours, but deferrable** — only on hosting public stranger uploads. Invite-only + no public uploads defers it. |
| **Consumer (Reg E / UDAAP / ROSCA)** | Fed + State UDAP | **Ours** — the payment/charging flows. Bundle into the memo. |
| **Securities advertising** | SEC/FINRA/FTC | **Ours** — present-tense + projections (memo Part 9). |
| **Gift tax / kiddie tax** | Federal | Disclosure only (copy already corrected). ✅ |

**The takeaway:** there is *no* 50-state licensing slog *if the structure holds*. The
memo's entire value is confirming you're out of both 50-state traps so you can go
national. If it says the structure fails, *that* is the model-breaker you want to
learn for $3-5K before building further.

## Build checklist — engineering (your time, ~$0 cash) vs cash

**Engineering (build against Alpaca's API, behind the custodian interface our
CLAUDE.md already mandates):**
- [ ] Account opening: parent + `minor_identity` -> Alpaca create-account; surface KYC status.
- [ ] **Funding bridge** (the meatiest piece): Stripe card-in -> holding account -> ACH to Alpaca (or Alpaca's funding API). *Confirm Alpaca's accepted funding methods on the call.*
- [ ] Trade execution: on funding, place buy orders per the user-selected mix/picks -> Alpaca orders API.
- [ ] Replace the simulation: read real balances/positions/statements from Alpaca into the dashboard, Kid View, Memory Book numbers.
- [ ] **Platform fee (0.10%)**: collection mechanism — *confirm Alpaca supports a platform/management-fee debit, else bill separately.*
- [ ] Tax docs: surface Alpaca's 1099s.
- [ ] Flip custody/SIPC copy to present-tense (after counsel blesses — Packet Part 6).

**Cash:**
- [ ] **Alpaca** — pay-as-you-go (per-account / per-trade / platform fee). *Get the real number + any minimum + ETF-in-custodial confirmation on the call.* Likely low to start.
- [ ] **Legal memo** — **$3–5K**, narrow scope (below).
- [ ] **Email** (Postmark/SendGrid) — ~$0–50/mo. *Biggest currently-missing infra piece.*
- [ ] **Plaid** (ACH bank-link) — pay-as-you-go, pennies.
- [ ] **Stripe** — per-transaction (already have).
- [ ] **Cloudflare** — CSAM scanning is **free**; turn it on.

## The narrow legal scope to BUY (and what to defer)

**Buy now — one engagement, ~$3–5K:** Packet **Parts 1 + 2 + 7** (+ a quick **Part 5**
COPPA read, cheap to bundle):
- RIA determination under the self-directed posture (the decisive question).
- Money-movement: does Stripe -> Alpaca + any holding trigger MTL/MSB?
- National-launch confirmation (falls out of 1 + 2).
- COPPA applicability ("from the adult" posture) — gates the model, 10 min to add.

**Defer (do NOT pay for yet):** Part 4 (TOD/beneficiary — owner-side, post-handoff),
Part 6 copy blessing (custody-gated, fold in when Alpaca's live), Part 8 (advisory
tier), Part 10 (institutional referral), Part 11 full UGC (only if/when you open
public uploads). All custody-gated or forward-looking.

## Invite-only launch config (defers the UGC vendor entirely)

- **Invite-only / cohort, not public splash** — keeps scale small (under licensing
  thresholds, supportable), and *this cohort IS the loop test with the real product.*
- **Hold back stranger UGC**: ship the sender-trust gate (trusted family's media
  shows; untrusted/public-link senders' media held for parent approval) OR simply
  don't expose the public-link upload path at launch. Either defers the paid
  moderation vendor.
- **Turn on Cloudflare CSAM scanning** (free) as the baseline.
- **Guessable-slug photo exposure** (Packet Part 5): for invite-only, gate the
  public endpoint / withhold the photo until the COPPA read, or tokenize the slug.
- **Copy**: honest "held until investing is live" pre-Alpaca; flip to present-tense
  once Alpaca is wired AND counsel blesses (Part 6).

## Sequence (free first, spend last)

1. **Free this week:** Alpaca + DriveWealth + Apex pricing calls; legal scoping calls
   (3 firms). Now you know real numbers + the directional legal read.
2. **Decide:** Alpaca (lean) + the legal posture.
3. **Spend (~$3–5K):** the narrow memo. Start the Alpaca integration (engineering).
4. **Wire:** funding bridge + email -> **launch invite-only.**

## Minimum spend, total

> **~$3–5K legal + Alpaca (low, usage-based) + ~$50/mo infra + your build time
> = under ~$10K cash to be genuinely live, small, and national.**

The trap that turns this into $200K: enterprise custodian minimums (DriveWealth/
Apex) + RIA registration + a full compliance binder. You need none of it to start.

## "Done" = live, and explicitly NOT-yet (so scope stays frozen)

**Done:** Alpaca wired, narrow memo in hand, funding + email live, invite cohort
investing for real, CSAM scanning on, honest/blessed copy.
**Deliberately deferred:** public stranger UGC + moderation vendor, TOD/beneficiary
build, advisory tier, institutional channel, full 50-state-anything (avoided by
structure). Don't let these creep into the launch.
