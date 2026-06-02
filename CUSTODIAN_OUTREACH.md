# Custodian / Brokerage-Partner Outreach Kit

Ready-to-send materials for exploratory calls with custody/brokerage-as-a-service
providers. Targets (in priority order): **DriveWealth**, **Apex (Apex Fintech /
Ascend)**, then **Alpaca** and **Atomic Invest** to compare.

Goal of these calls = **discovery, not commitment**: requirements, pricing,
timeline, and fit. The provider's answers (esp. "are *you* the BD of record")
directly feed the counsel engagement (`COUNSEL_ENGAGEMENT_PACKET.md`).

---

## Email template (tailor the one **hook** line per provider)

> **Subject:** Kiddo — embedded investing for a kids' gifting product (UTMA + fractional)
>
> Hi [Name / Partnerships team],
>
> I'm [Your name], founder of **Kiddo** — a platform that lets families gift real
> fractional stock into a child's investment account. Set the account up once,
> share one link, and anyone in the family (grandparents, aunts, friends) can
> gift in under a minute — no app, no account for the gifter — and every gift
> becomes an entry in a Memory Book of who gave and why.
>
> We've built the full product and selecting our brokerage/custody partner is
> our gating step to launch. **[HOOK — pick one:**
> - DriveWealth: *Your fractional + embedded brokerage API looks like a natural fit for small, frequent gifts into a child's account.*
> - Apex: *Your custodial + clearing backbone (the infrastructure behind so many consumer fintechs) looks like a strong fit for the UTMA core.*
> - Alpaca: *Your developer-first Broker API looks like a strong fit — and I'd love to confirm your custodial/UTMA support.*
> - Atomic: *Your embedded investing API + custodial support looks like a strong fit for our model.*
> **]** I'd love a short exploratory call to understand requirements, pricing,
> and timeline.
>
> The shape of what we need:
> - **UTMA/UGMA custodial accounts** (custodian parent + minor), with a clean **transfer to an individual account at majority**
> - **Fractional shares** (down to ~$1) on stocks + ETFs
> - **Third-party funding into a custodial account** — a gifter who isn't the account owner contributes funds that get invested (the heart of our product)
> - **You as the broker-dealer of record** (fully-disclosed), so we stay the software/experience layer
> - **Low / no account minimums** (gifts are typically $25–$100)
>
> We're US-only at launch, **self-directed** (user-selected expert-designed model
> portfolios — not advisory), and we've architected our integration behind a
> clean custodian interface. One-pager attached.
>
> Could we grab 30 minutes in the next couple weeks?
>
> Thanks,
> [Your name] · [email] · [website] · [calendar link]

---

## One-pager (attach as PDF or paste below the email)

### Kiddo — for custody / brokerage partners

**What it is.** A gifting-first investment platform for kids. Families set up a
child's investment account once, share one link, and anyone — grandparents,
aunts, family friends — gifts **real fractional stock** in under a minute (no app,
no account for the gifter). Every gift becomes an entry in a **Memory Book** (who
gave, the note, the moment).

**Why it's different.** We integrate *up* toward the relationship (the gifter loop
= near-zero-CAC growth + a switching-cost Memory Book) and *rent the rails* down
(custody/brokerage). The custodian is the commodity; the gifting experience is the
moat — so we're a long-term, low-churn distribution partner, not a flight risk.

**Account types**
- **Custodial UTMA/UGMA** (custodian parent + minor beneficiary) — the core.
- **Individual / adult accounts at majority** — the account transfers to the
  now-adult (a lifetime relationship, not a cash-out), so accounts *grow* with
  the customer rather than closing at 18/21.

**What we need from a partner**
1. UTMA/UGMA custodial accounts **+ clean transfer to individual at majority**
2. Fractional shares to ~$1 (stocks + ETFs)
3. **Third-party funding into a custodial account** (gifter ≠ account owner)
4. **You as broker-dealer of record** (fully-disclosed) — we stay the software layer
5. Low / no account minimums; thin-margin friendly

**Model.** Self-directed (user-selected, expert-designed model portfolios — *not*
advisory). Monetized by a flat consumer subscription + a **0.10% platform fee** on
invested assets. US-only at launch.

**Stage.** Full product built and demoable — gifting flow, Memory Book, parent +
gifter dashboards, recurring contributions, the at-18/21 handoff, and a
real-historical-price simulation of holdings/growth. Integration is architected
behind a **clean custodian interface** (swap-ready). **Selecting a custody partner
is our launch gate.**

---

## The 9 questions to cover on every call

1. Do you support **UTMA/UGMA custodial** accounts (custodian + minor), and the **transfer to an individual account at majority**?
2. **Fractional shares** down to what minimum ($1)? Stocks **and** ETFs?
3. Can a **third party (a gifter) fund** a custodial account they don't own? How does that flow work end-to-end?
4. Are **you the broker-dealer of record** (fully-disclosed)? What, if anything, must **we** register as (BD / RIA / nothing)?
5. **Pricing** at our profile: per-account, per-trade, AUM bps, **account minimums**, monthly/platform minimums — at small balances.
6. **KYC / onboarding** for the custodian + minor SSN handling; the identity flow.
7. **Self-clearing vs. introducing**; settlement; **SIPC** coverage specifics.
8. **Integration + go-live timeline**, sandbox access, and any **required volume/traction** to onboard.
9. How does our **0.10% platform fee** get collected/remitted through your rails (vs. an advisory fee)?

---

## Provider notes (internal — don't send)

- **DriveWealth** — best-fit front-runner: fractional pioneer, consumer-embedded,
  self-clearing; already scaffolded in our codebase (`funds.drivewealthAccountId`).
  *Verify:* custodial-UTMA support + the third-party-gifting flow specifically.
- **Apex (Apex Fintech / Ascend)** — robust, scale-proven custody/clearing backbone
  (Stash, SoFi heritage); the hedge if we ever add a managed/RIA tier. *Trade-off:*
  heavier, more enterprise onboarding.
- **Alpaca** — best developer experience; sweet spot is *individual* embedded
  trading. **Gate on real UTMA/custodial support** before weighting it; possible
  strong fit for the *adult/post-handoff* layer.
- **Atomic Invest** — modern embedded-investing API with custodial support; heritage
  is managed portfolios, so *verify* self-directed + UTMA fit.
- **Skip for now:** Altruist (RIA-custodian — only if we go RIA); Fidelity /
  Pershing / Schwab (enterprise-heavy, wrong stage); Clear Street / RQD (modern
  clearing but pushes us to carry our own BD); banking-BaaS (Unit / Column /
  Treasury Prime — banking rails, relevant only for a future kid-2.0 banking layer).
