# Kiddo — The 2026 Architecture (build + business + legal, one page)

> Created 2026-05-26. The canonical reference for HOW Kiddo is built, what it
> rents vs. owns, how it stays legal, how it makes money, and the open
> decisions that gate launch. Synthesized from the EarlyBird post-mortem, the
> Alpaca/custody research, and the RIA analysis. Supersedes the "ultimate
> setup" proposals — including the parts of them that were wrong (flagged below).
>
> Companion docs: `OUTREACH_KIT.md` (custody + lawyer + B2B2C + acquirers),
> `B2B_GIFTING_SPEC.md`, `CASH_FLOAT_REVENUE_NOTE.md`, `CLAUDE.md` (provider
> boundary doctrine), and the AUM-lawyer engagement brief (in memory).

---

## The one principle

**Rent every regulated, commodity layer. Own the relationship, the data, and
the lifetime funnel. Keep the gift frictionless. Monetize the ecosystem
*around* the free gift — never the gift itself. Use AI as the solo founder's
build-and-triage multiplier, with a human on every regulated decision.**

This is the inversion of EarlyBird's 2020 model. They built like a financial
institution (Apex-era clearing, assemble compliance, raise millions). In 2026
you build like a software layer on top of institutions. That single shift
drops the cash wall from *millions/VC-only* to **low five figures**, which is
the whole reason bootstrap-or-tiny-raise is viable.

---

## What you RENT (integrate DOWN to ~zero on the regulated side)

| Layer | Provider | Why it's rented |
|---|---|---|
| Broker-dealer + custody + financial ledger + KYC + tax + SIPC | **Alpaca Broker API** | They're the BD of record. You do NOT register as a broker-dealer. Verified: UTMA + UGMA supported, fractional, self-serve sandbox, commission-free buys (your gift flow = free), no account/inactivity fees. |
| Bank auth + funding | **Plaid** | Instant bank link; no routing numbers. Already scaffolded. |
| Gift payments | **Stripe** | Gifters pay processing; your cost ≈ $0. Coupling accepted per CLAUDE.md. |
| Market data | **15-minute delayed** | Free to redistribute. Framed as a feature: "built for generational building, not anxiety day-trading." Alpaca executes at market regardless of what you display, so delayed data has zero downside for your use case. |

**Architectural truth:** Alpaca becomes the financial source of truth. Your
current simulated `holdings`/`balance` tables become a *display cache synced
from Alpaca*, not the ledger. The custodian lives behind the existing interface
(`server/driveWealthAccountSetup.ts` / `custodianTransfer.ts`) precisely so
Alpaca-vs-DriveWealth is a swap, not a rebuild (CLAUDE.md doctrine).

---

## What you OWN (integrate UP, fully — this is the moat)

Your database and product hold the things Alpaca can't see and Acorns can't buy:
- **The Memory Book** (on durable R2/S3 — non-negotiable; EarlyBird users' #1
  panic at shutdown was losing relatives' video messages).
- **The gifter graph** (who gave to whom, the loop, gifter-sponsors-Plus).
- **Occasions, activity ledger, the kid-2.0 funnel** (Roth → banking → P2P).

> The proposals that said "your DB only needs `account_id`" are wrong for you.
> The money ledger is Alpaca's; the *relationship* ledger is yours, and that's
> the entire differentiator.

---

## Legal structure — the decision that gates everything

You almost certainly do **not** need a broker-dealer license (you ride Alpaca's).
The real question is **RIA**: your managed auto-invest portfolios + a 0.10% AUM
fee is the textbook definition of investment advice for asset-based compensation.
Alpaca does **not** solve this; your lawyer must. Three structures (lawyer-blessed,
not a "loophole" — substance over form; a disclaimer protects nothing if you
behave like an adviser):

1. **Register as an RIA** — ~$10–30k setup + ongoing compliance. Keeps managed
   portfolios + the AUM fee.
2. **Self-directed (recommended default to evaluate first)** — the parent
   *chooses* from preset thematic portfolios (educational, no personalized
   advice), and you charge a subscription/platform fee, **not** an asset-based
   advisory fee. Likely avoids RIA. Cost: you probably drop/re-characterize the
   0.10% AUM fee, and you rework the "we auto-invest into our managed mix" UX
   into "you pick this preset." A real product change, not a copy tweak.
3. **Sub-adviser / partner RIA** — someone else holds the advisory license; you
   pay them. Middle path.

**DECISION (recorded 2026-05-26): default to Path 2 (self-directed), pending the
lawyer's written confirmation.** The asymmetry makes it close to a no-brainer for
the pre-launch/lean phase: the AUM fee earns ≈ $0 near-term (0.10% on a $5k fund
= $5/yr, and it's post-handoff), so **dropping it costs almost nothing now** —
while it avoids a five-figure setup + an ongoing compliance regime + fiduciary
liability. It's the fastest, cheapest path to launch, and your revenue stack
(sub + float + sponsorship + B2B2C) doesn't need the AUM fee. And it's reversible:
**self-directed now, RIA later** — when the managed experience proves it lifts
conversion/retention enough to justify the cost, or at scale (at which point the
**internet-adviser exemption** lets you register once federally instead of
multi-state).

The cost of Path 2, accepted consciously: the investing UX shifts from "we
auto-invest into our managed mix" to "you pick the basket; gifts buy more of what
you chose," and you drop Kiddo-driven rebalancing (discretion = advice).
Survivable, arguably more on-brand for "self-directed, no one's managing your
kid's money for a fee."

**Watch the lawyer's incentive.** A payday-motivated lawyer defaults to "register
as an RIA" (a recurring retainer). Don't ask the open-ended "do I need to be an
RIA?" Ask:
1. "Confirm I can operate as a self-directed brokerage tech provider on Alpaca's
   broker-dealer license and AVOID RIA registration — and give me the memo."
2. "Exactly what must change in my product (discretion, rebalancing, curation) and
   fees (the 0.10% AUM) to qualify as self-directed?"
3. "Where's the line between 'thematic portfolios as education' and 'recommendation'?"
4. "If I go RIA later, does the internet-adviser exemption let me register
   federally vs. multi-state?"
5. "Am I a money transmitter?" (Likely no — funds flow Stripe→Alpaca, you never
   hold cash.)

Get answers 1–3 in a **written memo** (that's what's worth paying for); decline
the ongoing-CCO retainer if you qualify as self-directed. Resolve this before
building the investing UX in earnest — it's the one decision that gates cost,
revenue, and launch.

---

## Monetization — brand-safe, ecosystem-wide

The goal is right: monetize the whole ecosystem so gifters aren't pure cost
(EarlyBird's death). The mechanism the proposals reached for is wrong.

**DO:**
- **Parent subscription** — the base (but EarlyBird proves $5/mo alone is
  insufficient; it's necessary, not sufficient).
- **Cash-float interest** — passive, high-margin, never touches the user; scales
  with assets. See `CASH_FLOAT_REVENUE_NOTE.md`.
- **Gifter-sponsors-Plus** — the brand-safe way to monetize gifters: they
  *optionally buy a subscription*, not a toll on their gift.
- **B2B2C** — the CAC escape + high ACV. See `B2B_GIFTING_SPEC.md` / `OUTREACH_KIT.md`.
- **(Deferred) kid-2.0 funnel** — Roth → banking → P2P. The only LTV story that
  beats EarlyBird's $5/mo.

**DO NOT:**
- ❌ **Charge a per-gift "convenience fee."** It adds friction to the frictionless
  viral loop that is your *only* CAC advantage, and it cheapens the brand
  ("we skim grandma's love"). This is the single worst idea in every "ultimate
  setup" proposal. The loop is the moat; do not tax it.
- ❌ **Crypto-for-kids as a headline.** It contradicts the calm/long-term
  positioning. The most volatile asset undercuts "not anxiety-inducing."

---

## Operating model — lean + AI, human on the regulated line

- **Build:** founder + Claude (Opus 4.7). Near-zero cash.
- **AI ops (force-multiplier, not autopilot):** AI drafts/triages support,
  pre-screens content (CSAM via free PhotoDNA + cheap moderation), pre-fills
  KYC-flag responses, generates memory prompts / honest projections.
- **Human-in-the-loop, always, on:** anything that moves money or touches
  compliance/AML/KYC resolution. AI auto-submitting compliance resolutions to a
  regulated broker is a liability, not a feature. You are the decision-maker;
  AI is the draft.

---

## The cost wall (first principles)

Because you rent the regulated stack, you skip ~80% of the generic
"$100–250k to launch a fintech" cost (BD registration, clearing minimums, KYC
build, custody, tax, SIPC). Your real, unavoidable cash outlay:

| Cost | Estimate | Notes |
|---|---|---|
| Securities lawyer (the RIA determination + structure memo) | ~$3–15k | Single biggest mandatory cash item. Brief is written. |
| RIA registration (only if you choose structure #1) | ~$10–30k + ongoing | Avoidable via self-directed (#2). |
| Alpaca production agreement | TBD (negotiated) | End-user trading ≈ free for your flow; partner pricing is the unknown to confirm. |
| Durable storage (R2/S3), content scanning, infra, email | low $/mo | PhotoDNA free; Rekognition ~$1/1k images. |
| Engineering | ≈ $0 cash | Founder + AI. |
| **Your personal runway** | the real cost | Opportunity cost sets the timeline, not infra. |

**Bottom line: a low-five-figure wall, dominated by legal. Bootstrap or a tiny
legal-only raise is viable.** "Must raise $1–2M" was priced for the old model.

---

## The gated sequence (nothing downstream moves until these resolve)

1. **You, today (10 min):** pull Alpaca Broker API **sandbox keys** (self-serve).
2. **You, this week:** send the lawyer the brief, **leading with the RIA question.**
3. **Then decide the fork:** self-directed (drop AUM fee) vs. RIA vs. sub-adviser.
4. **Then I build:** the real Alpaca custodial-account creation behind the existing
   interface, the self-directed UX (if #2), and the financial-ledger sync.
5. **In parallel, always:** the B2B2C pilot + the EarlyBird-orphan capture
   (`OUTREACH_KIT.md`) and instrument the loop (`plan_purchased` +
   `gaveToOthersFundBefore` already wired) — because the gifter→parent
   conversion rate is the number that decides whether any of this is a business.

The product was never the question. The model is the company. This is the model.
