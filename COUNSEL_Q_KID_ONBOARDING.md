# Counsel Questions — Kid-Initiated, Parent-Completes Onboarding

**Status:** Ready to forward to licensed counsel. Folds into the existing
`COUNSEL_ENGAGEMENT_PACKET`. These questions gate the flip of the
`KID_INITIATED_ONBOARDING` feature flag to ON for real teens.

**Source:** Synthesized from a 6-specialist advisory panel (child-privacy/COPPA,
UTMA/custodial law, securities, FTC consumer-protection, product-compliance, GC),
each position adversarially cross-examined. **This is decision-support, not legal
advice** — it structures the call and sharpens what to ask; it does not replace a
licensed human's signature.

---

## What we want to build (so counsel can scope the answer)

A teen (gated **13+**) opens Kiddo and creates a **non-binding "fund idea"** — they
**name a fund** and **pick tickers from a fixed neutral allowlist**, and see a
**read-only, family-framed projection**. The teen **cannot** transact, hold money,
own anything, or enter any agreement. They tap **"Show a parent,"** which sends a
**Kiddo-originated** email to the **parent already on file** (the teen never types a
recipient). The parent then completes the legally-required steps (identity/KYC,
custodianship, funding) to create and fund the real custodial UTMA.

**The design constraint we are holding to:** the teen submits **zero personally
identifying information**. The parent is the **sole source** of all demographic PII
(teen's name, DOB, state). The teen surface stores only fund *preferences*
(`fundName`, `selectedTickers`, timestamps), auto-deleted at 30 days if unclaimed
and immediately on parent decline.

---

## The questions (each tagged with the owning specialty)

### Child privacy / COPPA
1. Does a **13+ teen entering only fund preferences** (fund name + tickers from a
   fixed allowlist) — with the **parent supplying all demographic PII** at
   completion — constitute **"collection from a child"** under COPPA, **including
   the 2025 amendments'** expanded "inferences / maintained information about a
   specific child" definition? (We need a reasoned opinion that explicitly addresses
   the 2025 definition, not a general COPPA summary.)

2. Do **state Age-Appropriate-Design-Code / minor-privacy laws** (CA AADC, Colorado,
   Virginia, Connecticut — plus please map our **top-10 states by user base**)
   require **parental opt-in *before*** the teen can access the fund-idea surface,
   or does the **13+ gate + from-adults structure** suffice? *We are treating the
   answer as a launch blocker, not an assumption.* If opt-in is required, we will
   build a parent-verified `fundIdeasEnabled` toggle as a hard pre-gate.

3. Does the **30-day auto-delete** of unclaimed fund-ideas (and immediate delete on
   parent decline) meet COPPA/AADC retention expectations, with **no UTMA
   records-retention rule** in conflict?

### Securities / broker-dealer
4. Is a **read-only, hedged, family-framed projection** (e.g. "if your family gifts
   $X/yr, this could grow to ~$Y") shown to a **13+ viewer** an investment
   recommendation, investment advice, or a **solicitation to a minor** under the
   Advisers Act / Reg BI / Securities Act Rule 481 / FINRA communications rules?

5. Does a teen **picking from a neutral, fixed allowlist** (with the **parent
   confirming the allocation** at KYC/funding) create **suitability liability or RIA
   status** for Kiddo or the eventual broker-dealer?

6. Does any **securities/RIA opinion already on file** (the AUM/custody engagement)
   **extend to the minor-as-initiator scenario**, or was it silent on it?

### Consumer protection / FTC (dark patterns + advertising to minors)
7. Is a **kid-creates-demand → parent-completes-transaction** flow a "**solicitation
   via a minor**" or an **FTC dark pattern** — even with **no incentive** to the
   teen and **no pressure/urgency copy**?

8. Does our specific anti-pattern design satisfy the **2025 FTC dark-patterns
   guidance** for a 13–17 audience: the **"Show a parent"** CTA, a **Kiddo-sent
   (not teen-sent)** invite, a teen experience that is **complete and rewarding
   without a parent** (no friction-gated payoff), and a hard **no-escalation rule**
   (no reminders / countdowns / social proof / guilt / engagement-triggered nudges)?

### UTMA / custodial (lightweight)
9. Confirm the **"kid sketches an idea, parent creates the account"** structure does
   **not** make the minor a party to account formation or imply the minor owns /
   controls an account or any assets, and that deleting the idea at fund creation
   raises no custodial records-retention issue.

---

## If counsel answers NO to #1 or #2 (the COPPA gates)

We do **not** ship to real teens on a bet. Pre-approved fallbacks (lower exposure):
- **Parent-initiated invite** → teen customizes a **parent-seeded** shell (parent
  consents first), or
- A **purely local, no-persistence** teen exploration draft (nothing leaves the
  device; no server record at all), plus
- The **at-18 self-ownership handoff** (the now-adult kid legitimately owns/opens
  their own account) — already scaffolded (`Age18Welcome` / `Age18Plan`), and the
  one kid-agency vector that is unambiguously clean regardless of these answers.

---

*Standing disclaimer: This document is AI decision-support that structures the
decision and sharpens the questions to put to a licensed professional. It is **not**
legal, tax, or compliance advice and does not replace a licensed attorney's
signature on anything that bears liability.*
