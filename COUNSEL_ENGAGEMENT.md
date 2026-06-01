# Securities / fintech counsel engagement — one engagement, three launch-gating questions

**Purpose:** Kiddo has three open legal questions, all of which gate public launch and/or
the deferred owner-side builds. They are the same *kind* of question (US securities /
fintech / money-movement) and should go to **one** SEC-RIA-literate securities attorney as
**one** engagement — one 60–90 min call + one written memo — not three separate matters.

**How to use this doc:** fill the two brackets in the cover email, paste the cover email,
and attach the three detail docs listed below. Send to 3 firms in parallel (shortlist at the
bottom); pick whoever comes back with the sharpest scoping question, not the lowest quote.

> **Founder action items before sending (2 brackets):**
> 1. DriveWealth contract status — say "signed integration agreement" *or* "in discussions,"
>    truthfully. Option B (white-label) analysis hinges on this; do not overstate it.
> 2. Your name + one line of background.

---

## The three questions (one-paragraph each; detail in the attached docs)

**Q1 — RIA registration / the 0.10% AUM fee.** Does our continuous 0.10% asset-based fee —
paid by the parent-custodian during the kid's minority and *continuing on the account after
ownership transfers to the child at majority* (the subscription retires at 18; the AUM fee
does not) — require SEC RIA registration? Three structural options on the table (register as
RIA / white-label under the broker-dealer / drop AUM for flat subscription), plus the decisive
self-directed-platform-fee question: if we drop the glide path + "strategy" nudges and operate
purely self-directed, can the 0.10% be framed as a *platform fee on a self-directed brokerage*
(Stockpile/Public posture) rather than an advisory fee? **Detail: `AUM_LAWYER_BRIEF.md`.**

**Q2 — Capturing a gifter's payment before the recipient's account exists.** May we charge
(or pre-authorize via a saved card / Stripe SetupIntent) a gifter's card at the moment of
intent and either invest it once the parent opens the account or auto-refund within N days —
*without* becoming a money transmitter (FinCEN MSB / state MTL / BSA-AML)? Two binary gates:
(A) does an off-session conditional charge weeks later, on a trigger the gifter didn't directly
initiate, trigger money-transmission licensing, or does Stripe-as-licensed-acquirer exonerate
us? (B) does our BD agreement document acceptance of multiple non-parent gifters funding one
minor's UTMA, and a volume surge of small multi-contributor accounts? This gates our single
most important growth fix (capture-at-intent). **Detail: `LAWYER_Q_HOLDING_GIFT_FUNDS.md`.**

**Q3 — Owner-side inheritance (beneficiary / transfer-on-death).** After the age-of-majority
handoff there is no custodian — the grown recipient owns an individual taxable account. How
does the owner designate who inherits it? Does the broker-dealer support TOD registration
programmatically; is a Kiddo-collected TOD legally sufficient or advisory-only; what
beneficiary KYC is needed and when; how does state variance apply; and — the loop hook — if
the owner names a *minor* beneficiary, can the asset route back into a new Kiddo UTMA rather
than out to an external custodian? **Detail: `SUCCESSOR_CUSTODIAN_SPEC.md` → "Post-handoff:
beneficiary / transfer-on-death" section.** (The pre-majority successor-custodian questions in
the same doc are lower priority; flag them but Q1–Q3 are the gates.) **Same doc, same engagement — the deceased-minor-beneficiary case:** if a child dies before majority, UTMA passes the custodial property to the *minor's estate* (probate) — distinct from owner-TOD, currently unhandled in product, and we need the legal answer before the (carefully designed, compassion-first) UX is built.

**Why bundle:** Q1 sets our regulatory posture (RIA vs broker-dealer-side), Q2 unblocks the
acquisition loop, Q3 unblocks the owner account's persistence (the "not a cash-out terminal"
principle). One attorney who understands the UTMA + broker-dealer + self-directed posture can
answer all three coherently — and the answers interact (e.g., the self-directed framing in Q1
and the money-movement framing in Q2 both turn on "control over funds/direction").

---

## Ready-to-send cover email

> **Subject:** Pre-launch UTMA fintech (US-only) — RIA posture + two adjacent questions; need a directional call + short memo
>
> Hi [Name],
>
> We're Kiddo, Inc., a pre-launch, US-only fintech. Parents open custodial (UTMA) investment
> accounts for their kids, and friends and family contribute gift-investments. Investments are
> intended to be custodied and executed by a third-party broker-dealer [signed integration
> agreement with DriveWealth, LLC / in discussions with DriveWealth — **founder: state the true
> status**]; we are the technology/UX layer and are pre-launch (custody is not yet live).
>
> We need a directional read, before public launch, on three related questions:
>
> 1. **RIA registration / our 0.10% AUM fee** — whether an ongoing asset-based fee that
>    persists onto the account after the child takes ownership at majority requires SEC RIA
>    registration, and whether a purely *self-directed* platform posture lets us treat it as a
>    technology/platform fee rather than an advisory fee. (We've sketched three structures and
>    have a soft lean; the brief lays them out.)
> 2. **Capturing a gift payment before the recipient's account exists** — whether charging or
>    pre-authorizing a gifter's card at intent and holding/refunding it (or charging a saved
>    card off-session when the parent later opens the account) triggers money-transmission
>    licensing or custody obligations, or passes through cleanly via our licensed acquirer.
> 3. **Owner-side beneficiary / transfer-on-death** — how the grown account owner designates
>    an inheritor on an individual taxable account through our platform.
>
> Three short briefs are attached (one per question), each with the specific sub-questions.
> We're looking for one 60–90 minute call plus a short written memo (which option/posture, and
> what we must do operationally, on the site, and in the TOS to be clean), roughly a $5K–$8K
> initial engagement, with any follow-up scoped separately.
>
> Does this fit your practice? Happy to answer scoping questions first.
>
> Best,
> [Your name], Kiddo, Inc.

---

## Engagement ask

1. One 60–90 min call to walk the product + answer clarifying questions across all three.
2. One written memo (2–4 pages) within ~2 weeks: the recommended RIA posture (Q1), a yes/no +
   conditions on capture-at-intent (Q2), and the TOD mechanics + sufficiency (Q3) — plus what
   each requires operationally, on the website, and in the TOS.
3. A follow-up estimate (Form ADV setup / BD-amendment review / TOS rewrite / TOD build) so we
   can budget the next phase.

**Budget envelope:** ~$5K–$8K for the call + memo (vs. ~$3K–$5K for Q1 alone — the two adjacent
questions are scoped to add ~30–45 min of call + a section each in the memo). Follow-up separate.

---

## Where to send it (firm shortlist)

Prefer an **SEC-RIA specialist boutique** or a **fintech-focused securities boutique** over a
generalist corporate firm (a generalist will punt to a specialist and bill you for the punt).
Reach out to ~3 in parallel; pick the one with the sharpest scoping question.

Candidates worth checking (verify still active + conflict-free before contacting):
- Hardin Compliance Consulting (RIA-registration specialists; remote)
- ACA Group (RIA compliance)
- Wagner Law Group — RIA practice
- Foley Hoag — fintech practice
- Cooley emerging-companies + fintech regulatory
- Lowenstein Sandler — fintech / RIA practice

---

## Launch gate

**Public launch should not proceed until this memo is in hand.** Per
`project_launch_wedge_and_creator_distribution`, the AUM/RIA decision is launch must-have #3,
and it is the *only* must-have that is not engineering work. Q2 additionally gates the
capture-at-intent growth fix; Q3 gates the owner-account beneficiary build (deferred meanwhile,
card hidden in owner mode). Custody (DriveWealth) must also be live before any present-tense
custody copy ships — a separate, parallel workstream.

## Detail docs to attach
- `AUM_LAWYER_BRIEF.md` (Q1 — full structure, three options, specific questions)
- `LAWYER_Q_HOLDING_GIFT_FUNDS.md` (Q2 — capture-at-intent, the two binary gates)
- `SUCCESSOR_CUSTODIAN_SPEC.md` → "Post-handoff: beneficiary / transfer-on-death" (Q3)
