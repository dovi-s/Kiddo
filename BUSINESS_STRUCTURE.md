# Business Structure — software layer on rented rails (canonical)

*The canonical reference for "what kind of company is Kiddo, legally +
operationally," so it stops getting re-derived. Written 2026-05-31. Companions:
`CLAUDE.md` (rent-the-rails principle), `COUNSEL_ENGAGEMENT_PACKET.md` (the open
legal gates), `CUSTODIAN_DECISION_BRIEF.md`, `AUM_FEE_COLLECTION_SPEC.md`,
`MOAT_MEMO.md`.*

## The model in one line

Kiddo is a **software + experience layer** (the gifter loop, Memory Book, the
lifetime relationship) sitting on top of a **rented, registered custodian /
broker-dealer** that does the regulated work — holds money, buys securities,
custodies assets, runs KYC/AML. Kiddo owns the customer relationship + the data;
it rents the commodity rails. (The `CLAUDE.md` "integrate up toward the customer,
rent the rails down" thesis.)

## Where Kiddo sits vs the field

| Camp | Who | What they are | Cost |
|---|---|---|---|
| **Rent the rails** | **Kiddo**, EarlyBird, Greenlight, UNest | software/app layer on a partner custodian/BD; never a BD themselves | cheap, fast on-ramp |
| **Own the entity** | Acorns, Robinhood, Stash | registered as their own broker-dealer and/or RIA | $1M+ upfront + ongoing; only worth it at scale |

You're correctly in the cheap camp. The giants started smaller and *graduated*
(see "Graduating later").

## Money flow (the structure that keeps legal cheap)

**Target:** gift money flows **gifter → custodian**, never under Kiddo's control
(a Stripe Connect destination charge to the custodian, or the custodian's own
funding/gift API). If Kiddo never has custody or control of the funds, Kiddo is a
software vendor, not a money transmitter / broker-dealer — which makes the legal
opinion *narrow* ("confirm we're software") instead of *broad* ("opine on our
MTL/BD/RIA status as an operator").

**Today (pre-custody):** the gift checkout is a plain Stripe charge into Kiddo's
account, because there is no custodian to route to yet. This is expected, not a
mistake — at custodian-integration the charge gets re-pointed at the custodian.
It's a routing config, not a re-architecture. (Verified 2026-05-31: the gift
`checkout.sessions.create` has no Connect `destination`/`transfer_data` yet.)

## The 0.10% fee (this structure *helps* it)

- **Classification.** The structure lets the 0.10% be a **platform / technology
  fee**, not an **advisory fee.** An asset-based fee is the classic hallmark of
  investment *advice* (which triggers RIA registration). The **self-directed
  pivot** (the family picks; Kiddo doesn't advise) + the software-layer framing is
  what makes "platform fee, not advice" the defensible answer -> no RIA -> cheap.
  The one nuance counsel must bless: offering a *default managed mix* (VTI/VXUS/BND)
  sits near the advice line. That is the headline RIA question
  (`COUNSEL_ENGAGEMENT_PACKET` Part 1).
- **Collection.** The custodian debits the account and remits the platform fee to
  Kiddo (standard BaaS advisor/platform-fee mechanism), per
  `AUM_FEE_COLLECTION_SPEC` (cash-first, never a forced taxable sale). It's
  `display-only` today only because there's no custodian yet to collect it.
- **As the value metric.** Unaffected — the 0.10% still accrues on custodian-held
  assets and compounds for ~18 years ([[project_aum_is_primary_value_metric]]).

## The two open gates (non-code — this is the whole launch gate)

1. **Custodian conversation** (free): does the chosen custodian (Alpaca /
   DriveWealth / Apex — `CUSTODIAN_DECISION_BRIEF`) support (a) gifter-pays-them-
   directly so Kiddo stays out of the flow, and (b) collecting + remitting the
   0.10% platform fee?
2. **One narrow legal opinion** (~$5-20k): does the software-layer +
   money-out-of-our-control + self-directed structure keep Kiddo out of MTL/BD/RIA,
   and is the 0.10% a platform (not advisory) fee? (`COUNSEL_ENGAGEMENT_PACKET`
   Parts 1 + 2.)

Everything else (the product) is built. These two answers lock the structure; the
Stripe re-point that follows is small and AI-doable.

## Cost model — the cheapest legit way to go live

Two buckets. Your instinct ("pay % only when revenue comes") is right for one and
not the other. The whole point of rent-the-rails: you **skip the ~$1M+** that
owning a broker-dealer costs (net capital, FINRA membership, compliance staff).
The custodian carries the regulated infrastructure; you pay them per use.

| Bucket | What | Cost | Deferrable to revenue? |
|---|---|---|---|
| **Legal** | The one narrow "software, not a regulated entity" opinion (`COUNSEL_ENGAGEMENT_PACKET`, Parts 1-9) | **~$5-15k, one-time** (core call+memo ~$3-5k; more if it spans all parts) | **No** — it's the gate that lets you operate. But one-time + cheap. |
| **Custodian / BD** | A registered custodian (Member FINRA/SIPC) carrying custody, trades, KYC | **Minimal upfront if you pick right; then usage-based** (per-account + per-trade + maybe a few bps), scaling with the book | **Mostly yes** — costs scale with funded accounts, i.e. roughly "% as rev comes." Negotiate the monthly minimum down/away early. |
| **Engineering** | The product | **~$0** — built (AI). | n/a |

**All-in to flip the switch: low five figures one-time (legal) + usage-based
custody that grows only as you do.** Not $1M (own BD). Not free-but-fake (a bare
Fidelity UTMA with no loop / Memory Book / relationship — the thing we *compete
against*, not build).

**Honest budget (don't anchor on the floor):** **plan $10-25k one-time, target
~$10k.** $10k is achievable *if* the legal stays narrow (~$3-5k), the custodian
waives its minimum on a startup tier, you already have an entity, and eng is done
(it is). What pushes it past $10k: a broader opinion (Parts 1-9 span RIA +
capture + COPPA + marketing-claims → can run $10-15k); a custodian setup fee or
monthly minimum; likely-small extras (E&O / cyber insurance, a KYC-vendor
per-check, entity formation if not done). **It's also not just money — it's
time + process:** custodian onboarding/approval is typically weeks-to-months and
may require compliance docs from you (a basic AML program, a named compliance
contact). The two quotes — legal + custodian — turn this range into a real
number; until then, budget $10-25k and treat $10k as the optimistic end.

**Custodian pick for cheap + deferred:** **Alpaca** is the canonical API-first /
startup-tier choice (low-or-no minimums, usage-based). DriveWealth (the repo
scaffold) is the fractional-share specialist but tends more enterprise/minimums;
Apex is most enterprise. Lean Alpaca-tier unless a DriveWealth capability
(fractional, embedded) is decisive.

**Negotiation checklist — ask EACH custodian (put in `CUSTODIAN_OUTREACH.md`):**
1. Setup / integration fee? One-time or recurring?
2. Monthly platform **minimum** — and **can it waive until we hit X funded
   accounts** (a startup tier)? This is the lever that makes it "pay as rev comes."
3. Per-account fee (open + annual)? Per-trade / fractional-trade cost?
4. Any bps on AUM they charge us (vs. our 0.10%)? Confirm our 0.10% nets out
   *above* their cost so the unit economics are positive from account #1.
5. Do they support **gifter-pays-them-directly** (so Kiddo stays out of the flow)
   and **collecting + remitting our 0.10%**? (The structure question from gate #1.)
6. KYC/identity-verification cost (per check)?

Exact numbers aren't public and shift — the custodian conversation is where the
ranges above become quotes. Walk in with this checklist.

## Graduating later — the option is preserved

You can become a "big guy" (own BD and/or RIA) later; rent-the-rails is the
standard on-ramp to exactly that.

- **Trigger:** when scale makes the custodian's cut larger than the cost of owning
  the license (net capital, FINRA membership, compliance staff — $1M+ + ongoing).
  A large-AUM milestone, not an early decision.
- **Why nothing built now is wasted:** you already own the customer relationship +
  data + experience (the moat). Only the *regulated backend* swaps from rented to
  owned. The provider-interface boundary (the `CLAUDE.md` custodian rule) is what
  makes that a backend migration (ACATS account transfers + registration), not a
  rebuild.
- **RIA specifically:** you'd register as an adviser only if you decide to *add
  advice* (glide paths, recommendations) as a feature — a deliberate product
  choice, not a requirement. The self-directed posture avoids it by default.
- **Verdict:** rent now (cheap, fast, proves the loop); own later only if scale +
  margin justify it. The option is real, preserved, and a clean backend swap.

## Bottom line

Kiddo already IS this model in every way that defines the business. The only
not-locked pieces are the two gates above — the lawyer and the custodian — and
both partly *want* to exist anyway (the "real broker-dealer partner, Member
FINRA/SIPC" line is a gifter-trust asset, not just a cost). **Rent the rails,
prove funded-k, own the rails later if the scale earns it.**
