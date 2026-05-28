# Custodian Decision Brief

> Companion to `CUSTODIAN_SOURCE_OF_TRUTH.md` (which makes the Alpaca/DriveWealth
> split *visible*). This brief is the tool to actually *make* the call: the
> criteria that matter for Kiddo specifically, an honest read on the three
> candidates (incl. what's unverified), the exact questions to send each
> vendor's BD/compliance team, and a decision framework. Created 2026-05-28.
> Pairs with the RIA/AUM legal question — see `project_aum_lawyer_engagement_brief`
> in memory; the two answers interact (Q at the end).

## Why this is load-bearing

The custodian pick currently gates, in order: real custody wiring (replacing the
`submitToDriveWealth` scaffold stub), the `/uploads` signed-URL flip is *not*
gated by this but real KYC is (the custodian usually drives the KYC/CIP vendor),
the 1099 pipeline, and ultimately "investing" being real instead of a local-DB
simulation. Customer copy is already entity-agnostic ("our broker-dealer
partner"), so copy no longer blocks on this — but nothing real ships until it's
chosen, contracted, and wired.

**Nothing is wired today.** No account opens, no order places, no 1099 issues.
So this is still a low-cost decision to make correctly rather than fast.

## What Kiddo specifically needs from a custodian (the criteria)

Weight these for *our* product, not a generic brokerage:

1. **UTMA/UGMA custodial accounts via API** — non-negotiable; it's the core
   account type. Must support programmatic account opening with a custodian
   (adult) + minor (beneficiary) and the state-specific majority age.
2. **Fractional shares, dollar-based (notional) orders** — a $25 gift must buy
   $25 of a fund. Hard requirement for the gifting model.
3. **Third-party / many-contributor funding into one minor account** — gifts
   arrive from many people (via our Stripe layer → ACH/transfer into the
   custodial account). Confirm this pattern is supported and how source-of-funds
   / AML is handled for it.
4. **Age-of-majority transfer as in-kind re-registration, NOT forced
   liquidation** — the kid-at-18 handoff is a product centerpiece. Confirm an
   internal journal/title change to an individual account with no taxable sale.
   (This is the EarlyBird→Acorns failure we explicitly avoid.)
5. **Tax reporting (1099-DIV / 1099-B) issued by the custodian** for the minor's
   account, surfaced to us via API.
6. **Fee-model compatibility** — our model is parent subscription pre-18 +
   0.10% AUM post-handoff. Confirm the custodian can support an advisory/platform
   fee debit (and whether *they* require us to be the RIA — see legal Q).
7. **API maturity + sandbox** — a real sandbox we can wire against, stable
   versioning, good docs. Avoid the "API drift freezes our engine" risk.
8. **Cost: minimums, per-account fees, per-trade, ticket charges, monthly
   platform minimums.** The unit economics of $25 gifts die under per-trade
   ticket charges; confirm fractional gifting isn't nickel-and-dimed.
9. **US-only is fine** (UTMA is a US construct; we're US-only at launch).

## The three candidates (honest read — verify everything)

| | DriveWealth | Alpaca | Apex |
|---|---|---|---|
| **Status in repo** | The shipped scaffold + all interface files; CLAUDE.md doctrine | Named "canonical" in `ARCHITECTURE_2026.md` (2026-05-26) | Not in repo |
| **UTMA support** | Framed as supported (scaffold built around it) — **confirm in writing** | `ARCHITECTURE_2026` claims "verified" — **TREAT AS UNVERIFIED** | Unknown — **ask** |
| **Notable** | Consumer-fintech Broker API; fractional/global focus | Modern Broker API; developer-friendly | **EarlyBird actually used Apex** (confirmed from their footer copy in `attached_assets/`) — the closest precedent for *this exact product* |
| **Biggest open question** | Commercial terms + UTMA-in-writing | Whether it genuinely supports UTMA custodial at all | Onboarding bar / minimums for an early-stage firm |

**Do not treat any "verified" claim in our own docs as verified.** The single
most important fact here: the one company that built *our* product (EarlyBird)
ran on **Apex**, not Alpaca — which is evidence Apex's UTMA + gifting pattern is
proven for this use case, and a reason to at least include Apex in the bake-off
rather than defaulting to the two names already floating in our docs.

## Questions to send each vendor's BD/compliance team

Copy-paste these; the answers decide it:

1. Do you support **UTMA/UGMA custodial accounts** opened via API, with
   state-specific age-of-majority? (Get it **in writing**.)
2. Do you support **dollar-based fractional** orders down to ~$1?
3. Can a **single minor custodial account receive funds from many third
   parties** (grandparents, friends)? How do you handle source-of-funds / AML
   for third-party contributions?
4. At age of majority, can the UTMA be **re-registered in-kind** to an
   individual account (internal journal, **no liquidation, no taxable event**)?
5. Who issues the **1099-DIV / 1099-B**, and is it retrievable via API?
6. **Do we need to be a Registered Investment Adviser** to operate on your
   platform with a 0.10% asset-based fee, or can we operate as an introducing
   technology partner? (Cross-check with our securities counsel — see below.)
7. Full **fee schedule**: account minimums, per-account, per-trade/ticket,
   monthly platform minimum, fractional-order handling, fee-debit support.
8. **Sandbox** access + API docs + versioning/deprecation policy. Time-to-first-
   account-open in sandbox?
9. KYC/CIP: do you provide identity verification + OFAC, or must we bring our
   own? (This drives whether our KYC stub gets replaced by your flow or a
   separate vendor.)
10. Onboarding requirements for an early-stage company (entity docs, capital,
    compliance program, timeline to go live).

## Decision framework

- **Eliminate on a hard fail of criteria 1–4** (UTMA / fractional / multi-party
  funding / in-kind transfer). Any vendor that can't do all four is out.
- **Among survivors, weight:** in-kind transfer support (5×, it's our moat),
  fractional-gift economics (4×), API/sandbox maturity (3×), cost/minimums (3×),
  KYC support (2×).
- **Tie-breaker:** the one with a proven precedent for *this* product. Apex
  (EarlyBird's actual custodian) starts with evidence; DriveWealth has our
  existing scaffold; Alpaca needs to first clear the unverified-UTMA gate.
- **Then decide "stay entity-agnostic vs name."** Once chosen + contracted +
  wired, one find/replace flips customer copy from "our broker-dealer partner"
  to the real name (see `CUSTODIAN_SOURCE_OF_TRUTH.md` §7).

## What unblocks the moment this is decided + contracted

- Replace the `submitToDriveWealth` scaffold with the real authenticated client
  (keep it behind the custodian interface per CLAUDE.md — never inline vendor
  calls in `routes.ts`).
- Wire real KYC/CIP (likely the custodian's flow) → replaces the format stub.
- Turn on the 1099 pipeline + the durable signed-URL storage (if the chosen
  custodian/storage creds land together).
- Name the custodian in copy.

## The coupled legal question (don't decide custodian in isolation)

The custodian and the **RIA/AUM determination** interact: some custodians require
you to *be* an RIA to charge an asset-based fee; others let you operate as an
introducing technology partner. So ask Q6 above **and** put it to the securities
attorney (`project_aum_lawyer_engagement_brief`, add as its Q: "Given a
self-directed UTMA on [custodian] with a 0.10% asset-based platform fee, are we
an investment adviser requiring Form ADV registration, or can we structure as a
non-advisory technology/platform fee?"). Decide both together — the answer to one
constrains the other.
