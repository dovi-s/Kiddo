# Counsel Engagement Packet — Kiddo, Inc.

**One packet, one engagement.** Every open legal question that gates launch
currently lives in a different doc. This consolidates them so you can send a
single brief to a single (or at most two) counsel and clear the whole gate in
one billable engagement instead of five separate ones. Created 2026-05-31 as the
synthesis of the scattered sources listed at the bottom.

> **Not legal advice.** This is a founder-prepared brief *for* counsel. Every
> claim about custody/fees is stated as **pre-launch / intended**, because
> custody is not yet wired — counsel needs the true current state.
>
> **DriveWealth = leading candidate, NOT finalized.** Wherever this packet names
> DriveWealth (Option B, Part 1 Q3, the attachment list, the act-on-the-memo step),
> read it as the *prospective / leading-candidate* broker-dealer. The custodian
> vendor is **not yet selected or contracted** and no client is wired. No line
> should imply a signed agreement or a locked vendor. **Confirm this before sending
> — see the pre-send checklist.**

---

## How to use this

- **Securities / fintech counsel** answers **Parts 1, 2, 4** and blesses the copy
  in **Part 6**. This is the primary engagement (an SEC-RIA-literate fintech
  boutique — see logistics).
- **Privacy counsel** answers **Parts 3 and 5**. Often the same fintech firm can
  do both; if not, this is a small second engagement. Parts 3/5 can also ride
  along on the securities call if the firm has a privacy partner.
- **⭐ = on the critical path to public launch.** Parts 4 and 6 are
  **custody-live-gated**, not launch-day-gated — but fold them in now so you don't
  pay for a second engagement when custody goes live.

## The launch gate, in one sentence

**Public launch should not proceed until:** the RIA determination memo is in hand
(Part 1), the capture-at-intent holding structure is answered (Part 2), and the
child-PII / COPPA posture is confirmed (Parts 3 + 5). This is the only must-have
that blocks launch and is **not** engineering work.

## ⭐ Preferred structure to validate first (frames Parts 1 + 2)

Kiddo's intended structure is a **pure software / experience layer** on a rented,
registered custodian / broker-dealer (full picture in `BUSINESS_STRUCTURE.md`).
The single question that most lowers cost + risk: **confirm Kiddo can operate so
gift money flows gifter -> custodian directly and is never under Kiddo's custody
or control** (e.g. a Stripe Connect destination charge to the custodian, or the
custodian's own funding API), **and that the 0.10% is a platform / technology fee,
not an advisory fee.** If counsel confirms this structure, the opinion needed is
the *narrow* "Kiddo is a software vendor, not a regulated entity" — not a broad
operator-status analysis. Please answer Parts 1 + 2 through this lens, and if the
structure holds, state what the narrow opinion + the custodian agreement must say
to support it. (Today, pre-custody, gifts route through Kiddo's Stripe only
because there is no custodian to route to yet; the production target is
out-of-the-flow.) **If the structure holds, it should also resolve geographic
scope (Part 7): the same "platform, not a regulated entity" finding is what lets
us launch nationally rather than state-by-state — so please answer Part 7 in the
same pass.**

## Founder pre-send checklist (do this before sending)

1. ⚠️ **Confirm the broker-dealer / DriveWealth status before sending — the one
   founder fact this packet cannot verify for you.** The packet *defaults to the
   safe, non-overstating framing*: DriveWealth is the **prospective / leading
   candidate** BD, **no agreement executed, vendor not finalized**. So if you skip
   this step, the packet still never overstates to counsel. **Upgrade the wording
   ONLY if reality is further along:** if a BD is selected, say "selected BD:
   {name}"; if an integration agreement is executed, say "signed integration
   agreement; {name} is broker of record" (Part 1 Option B + Q3) and attach it.
   Option B's whole analysis hinges on this — match it to the truth, never overstate.
2. Attach: product overview / deck, current TOS draft, pricing-page screenshot, and
   the executed custodian/BD agreement **if one exists** (under NDA, on request) —
   omit it if no agreement is signed yet (the default; see item 1).
3. Send to 3 firms in parallel; pick the one that comes back with a thoughtful
   scoping question, not just a fee quote.

---

# Part 1 — RIA registration & the 0.10% AUM fee ⭐ (Securities)

**Source:** `memory/project_aum_lawyer_engagement_brief.md` (full detail there).

**The structural question.** Our fee model charges a **0.10% annual AUM fee** on
the fund, continuously — paid by the parent-custodian during the kid's minority
and **continuing on the account after ownership transfers to the child at
majority** (post-handoff the AUM fee is the *only* revenue mechanism; only the
*subscription* retires at 18). So the analysis is an **ongoing advisory-style AUM
fee that persists onto an adult account-owner**, not a fee that stops at 18. Does
this require us to register as an SEC RIA?

**⭐ THE DECISIVE QUESTION (ask this first — it may collapse everything below).**
If we operate as a **pure self-directed platform** — the parent/gifter/kid
affirmatively picks every security from a neutral menu, with **no managed/age-banded
allocations, no auto glide-path, no "strategy review" nudges, no discretionary
rebalancing** — does the 0.10% asset-based fee **still** trigger RIA registration,
or can it be framed as a **platform/technology fee on a self-directed brokerage**
(the Stockpile / Public / Robinhood posture) rather than an advisory fee?
Specifically: (a) does self-directed-only with an asset-based fee clear RIA; (b)
where exactly is the line between a "neutral menu you choose from" (defensible) and
a "default/pre-selected basket" that is itself a recommendation; (c) does **any**
asset-based fee — even without advice — independently invite adviser scrutiny that
a per-trade or flat fee would not? *If the answer is "self-directed + asset-based
platform fee is clean," that is likely our chosen structure and it simplifies the
three options below into one posture.*

**The three fallback options** (validate which is clean / risky / missed):
- **A — Register as an SEC RIA.** Clean, future-proof, but ~$50–100K setup +
  $50–150K/yr at a sub-$10M-AUM scale that doesn't justify it. *Counter-evidence:*
  our dead competitor EarlyBird took exactly this path and still stalled (~$480K
  ARR) carrying the load — registration didn't solve distribution/CAC.
- **B — White-label / sub-advisory under DriveWealth or a partner RIA.** Lowest
  burden on us; margin compression; depends on the BD accepting the structure.
  **Our soft lean (pre-self-directed-question).**
- **C — Drop the AUM fee, flat subscription only.** Cleanest regulatorily; ~30%
  lower long-term revenue; requires a pricing/marketing sweep.

**Specific sub-questions:**
1. Is the 0.10% AUM fee, as structured (continuous, persisting onto the adult owner
   post-handoff), **by itself** enough to trigger RIA registration if our platform
   doesn't otherwise constitute "advice"?
2. Does our surface constitute "investment advice" under the Advisers Act
   three-prong test? Inputs: parent picks from a **curated 24-stock universe** of
   recognizable consumer brands (we *surface* a neutral menu, framed by meaning
   not performance; we do not recommend, rank by returns, or label "top picks"),
   plus **user-selected broad-market ETF
   mix presets** (growth / balanced / conservative — chosen by the user, never
   auto-assigned by age; sharpened in the managed-allocation flags below); we
   **project** future value at a 7% historical assumption (disclaimed); we do **not**
   charge per-trade, execute trades, or custody securities.
3. If Option B is viable, what contract terms with DriveWealth establish **them** as
   adviser of record vs. us? Have you seen this survive SEC scrutiny?
4. **State-level** registration we'd miss focusing only on SEC?
5. Realistic **timeline + cost** per option (we need to choose this week).
6. Have we **missed a fourth option** (flat-dollar AUM fee; quarterly-disclosure
   regime; etc.)?

**Managed-allocation flags** (sharpen Q2 — these are our *highest-advice* surface;
moot if we commit to the self-directed posture, but draw the line in case we keep
an optional curated-basket menu):
- **Sector tilt (already resolved — stated so counsel has the true state):** our
  default mixes are **clean broad market-cap weight, no sector tilt.** Growth is
  VTI 62 / VXUS 28 / BND 10; the old ~10% VGT tech sleeve was **removed 2026-05-28**
  (folded into VTI/VXUS at the same US:International ratio) precisely because a
  default sector bet is the hardest line to defend as non-advice. VGT now exists
  only as an **optional ticker a user can affirmatively add by choice**, never in a
  default basket. Question for counsel: does keeping VGT (and the other optional
  ETFs) **available-but-never-defaulted** stay clean, and is broad market-cap
  weighting confirmed as the defensible non-advice posture?
- **Suitability:** we default everyone to growth-first on a disclosed long-horizon
  rationale, with **no suitability questionnaire**. Can we default to an aggressive
  allocation without suitability, or does that push us toward adviser status /
  liability?
- **Tax-aware selection:** we use taxable BND vs muni bonds in taxable UTMAs.
  Prudent-adviser concern at larger balances only — note-and-defer.

**UTMA age-of-majority on relocation (operational, but legal).** We set each
account's majority age (18/19/21 per state) at creation from the custodian's state
and **freeze** it for the life of the account. Is freeze-at-creation correct, or
does majority age follow the **minor's current state of residence** (so a move
changes the handoff date and we must re-derive it)? Drives handoff date,
claim-eligibility, and "she gets control at N" copy.

---

# Part 2 — Holding a gifter's money before the account exists ⭐ (Securities)

**Source:** `LAWYER_Q_HOLDING_GIFT_FUNDS.md`. **~15 minutes of the same call.**
This gates our single most important conversion fix (capture-at-intent), already
built behind a flag and marked PENDING COUNSEL.

**Context.** Anyone can gift toward a child's UTMA. Today, when the parent hasn't
set up an account yet, we only collect the gifter's email and nudge the parent —
**no money is taken**, and a large share never convert. We want to **capture the
gift at the moment of intent** and complete it when the parent opens the account.

**The internal design we landed on (no funds held):** save the gifter's card via a
Stripe **SetupIntent**, then **charge it off-session** when the parent creates the
fund. Kiddo never holds the money. Two binary gates decide if this is clean — we
need a **written yes/no** on each:

- **(A) Off-session conditional-charge classification.** Does charging a gifter's
  pre-authorized saved card **off-session, weeks later, on a trigger the gifter
  did not directly initiate** (the parent's fund creation), **with a 30-day
  decline-retry loop**, trigger **FinCEN MSB / state money-transmission licensing /
  BSA-AML** — or does Stripe (a licensed acquirer) holding the token fully
  exonerate us? (Concern: regulators may define transmission/custody by **control
  over timing and direction of funds**, not physical possession.)
- **(B) Broker-dealer acceptance of multi-gifter funding.** Does our BD agreement
  document (i) acceptance of **multiple non-parent gifters funding one minor's
  UTMA**, and (ii) their **source-of-funds/AML** procedure for third-party
  contributions — and will they accept a **volume surge** of small multi-contributor
  accounts? (If AML flags this, gifts get charged but orphaned — silent failure of
  the whole loop.)

**If we instead hold funds, the sub-questions:**
1. **Money transmission / custody:** does holding gift money pre-account make us a
   money transmitter or trigger custody/safeguarding (state MTL, FinCEN MSB,
   BSA/AML) vs. passing straight to the BD? Does it matter whether funds sit in our
   Stripe balance, a Stripe-held balance, or a segregated/FBO account?
2. **Cleanest structure:** manual-capture auth (note: ~7-day expiry, likely too
   short); segregated "for-benefit-of" account with the BD as holder; or refundable
   pre-payment for a forthcoming securities purchase — which is cleanest given our
   BD partnership?
3. **Refund window:** regulatory/consumer-protection limit on how long we may hold
   pre-account funds? Defensible default (7/14/30/60 days)?
4. **Disclosure:** what must we tell the gifter at point of charge (held, conditions
   for investment, refund terms)?
5. **Gift/UTMA mechanics:** once invested it's an irrevocable UTMA transfer — does
   holding-then-investing change the gift's tax/legal completion date (charge date
   vs. investment date) in a way we must disclose?
6. **Tie-in:** if the answer is "only behind the BD / via segregated account," does
   that change anything in the Part 1 AUM structure?
7. **Escrow — chosen vs. imposed (two questions).** (a) Does a true licensed-escrow
   structure buy us anything over Option C (no funds held) or the FBO account, or
   is it strictly heavier and skippable? (b) **More important:** if we *do* hold
   funds in a segregated/FBO account conditioned on a future event (parent opens
   account, else refund), could a regulator characterize that arrangement **itself
   as escrow** and pull us under **state escrow-agent licensing** (e.g. CA Escrow
   Law / DFPI), separate from the money-transmission analysis in #1? Does the
   BD-as-holder structure inoculate us, and does the refund condition make it look
   like escrow vs. a simple refundable pre-payment (#2-iii)? Full framing in
   `LAWYER_Q_HOLDING_GIFT_FUNDS.md`.

**What we need back:** which holding structure is permissible and cleanest, the
max defensible hold window, the required gifter disclosures, **and whether the
funds-held fallback trips escrow-agent licensing.**

**The five written gates that must close before we flip the flag.** The built
flow is the no-funds-held SetupIntent design above; an internal implementation
review (`P0-1_IMPLEMENTATION_REVIEW.md`) identified these specific sign-offs.
Please address each **in writing**:
1. **Off-session MTL/MSB classification** *(securities counsel)* — gate (A): does
   the off-session, parent-triggered charge with a 14–30 day retry loop trigger
   FinCEN MSB / state money-transmission licensing, or does Stripe's acquirer
   license cover it? (Regulators weigh *control over timing/direction*, not
   possession — "Stripe holds the token" is an argument, not a shield.)
2. **Broker-dealer multi-gifter acceptance** *(BD/custodian + counsel)* — gate (B):
   written amendment that the BD accepts multiple non-parent gifters into one
   minor UTMA, their source-of-funds/AML procedure, and a tolerance for a volume
   surge (a test batch).
3. **Point-of-charge + dunning disclosure compliance** *(consumer-protection counsel)* —
   does our built disclosure (saved-now/charged-later, the trigger, the 60-day
   window, the 30-day retry, the no-charge-if-unpaired guarantee, affirmative
   consent) satisfy **UDAAP (12 CFR §1026.61), Reg E, ROSCA, EFTA, and the
   strictest state UDAP (CA/NY/IL/TX)** — and is a checkbox required vs. a banner?
4. **Stripe Compliance pre-clearance** *(payments ops → Stripe; not counsel)* —
   notify Stripe in writing that this is *gifting* off-session (not SaaS dunning)
   with a parent-triggered retry, and get the use case blessed. (Listed here so
   it isn't lost — it's the founder's action, not a counsel question.)
5. **Gift-completion timing** *(tax counsel)* — confirm the UTMA gift completes on
   the **off-session charge date, not the SetupIntent date** (IRC §2511), no
   Form 709 ambiguity.

**Operational vs. legal — gates 2 and 4 are APPROVALS, not opinions (advisory-panel
sharpening 2026-06-16).** Gates 1, 3, 5 are *counsel opinions*. But gates 2 (BD multi-
gifter AML) and 4 (Stripe) are live *gatekeepers who must affirmatively say yes BEFORE
the flag flips* — and the failure mode is asymmetric: if the BD's AML team flags the
multi-contributor surge, or Stripe's policy team rejects the off-session-gifting use
case, *after* launch, gifts get **charged-but-orphaned** (the gifter is debited, the
investment never lands) — a silent cascade of chargebacks, support fires, and
consumer-protection exposure. So treat 2 and 4 as production blockers requiring written
sign-off from the BD's AML desk and Stripe Compliance specifically, not just a lawyer's
read of whether they'd be permissible.

Nothing flips the `GIFTER_CAPTURE_AT_INTENT` flag until these five land in
writing. The **code is complete**: the card is auto-deleted at 60-day expiry, the
off-session charge is idempotent, decline-retry dunning + orphan monitoring +
safety tests are in place. So post-sign-off this is a **flag flip, not a build**.

---

# Part 3 — Child PII on parental account deletion ⭐ (Privacy / Securities)

**Source:** `CHILD_PII_DELETION_DECISION.md`. **Internal decision: Option C is the
target; Option B (retain child record + Memory Book, scrub the parent's PII + SSN)
stays live until counsel signs off.** We need the retention rationale blessed.

**The crux:** a UTMA is the **minor's irrevocable property**, so a custodian-parent
deleting their account is closer to a **custodian resignation** than a "delete the
data subject" event — you generally can't erase a minor's property records because
the custodian walked away. The 4 questions that decide it:

1. For a UTMA (minor's irrevocable property), when the custodian-parent deletes
   their account, are we **permitted/required to retain** the minor's account +
   identity records, or **obligated to delete** the minor's PII?
2. Does **COPPA** require deletion of the child's name/DOB/photo on parental
   closure, or is retention permissible on a property/recordkeeping basis? Does the
   under-13 vs 13+ line change the answer?
3. Once a **BD custodian + real assets** exist, do **recordkeeping rules (e.g., SEC
   17a-4-type retention)** *require* us to retain records regardless of a deletion
   request?
4. Is the **"dormant fund awaiting successor custodian"** model (Option C) sound,
   and what **successor-custodian / escheatment** handling is required if no
   successor appears before the child reaches majority?

---

# Part 4 — Beneficiary / transfer-on-death on the post-handoff adult account (Securities, custody-gated)

**Source:** `SUCCESSOR_CUSTODIAN_SPEC.md` (post-handoff section). After the
age-of-majority handoff there is **no custodian** — the grown recipient owns an
individual account. So the "what if the holder dies" instrument is a
**beneficiary / TOD** designation, not a successor custodian. The owner currently
has **no way to name an inheritor** (the successor card is correctly hidden in
owner mode), which is in tension with our "not a cash-out terminal" thesis.

1. Does the **broker-dealer support TOD registration** on an individual taxable
   account, and via what API/process?
2. **TOD vs. will/probate:** is a TOD designation collected through Kiddo legally
   sufficient, or advisory-only (we collect intent; the actual TOD must be filed
   with the broker)?
3. **Beneficiary KYC/identity:** what must we collect about the beneficiary, and
   when (at designation vs. at death)?
4. **State variance** in TOD/POD availability and rules.
5. **Minor beneficiary:** if the owner names a minor, the asset must land in a new
   UTMA — design so this routes back into our own custodial product (the next-gen
   loop) rather than out to an external custodian. What's required?

---

# Part 5 — COPPA / children's-privacy applicability ⭐ (Privacy)

**Source:** `SECURITY_AND_COMPLIANCE_POSTURE.md` (External matrix) +
`COPPA_APPLICABILITY_MEMO.md` (full grounded analysis with file:line evidence).

We store children's PII (name, DOB, SSN, photos, voice), but the **parent or
gifter (never the child) provides all of it**, and the only child-touching surface
(Kid View) is **PIN-gated and read-only for under-13s** — the one write path (teen
stock suggestions) is hard-gated to age 13+ in code (`routes.ts:6892`), i.e. above
the COPPA age. COPPA triggers on collecting personal information **from a child**;
our position is that we collect *from the adult about the child*, which puts the
core product outside COPPA.

**Two things make this load-bearing rather than academic:** (1) we can never argue
*lack of knowledge* (the product is "give to a child"), so the entire position
rests on the single hinge "from the adult, not the child" — there is no backup
argument; and (2) the 2025 amendments' **indefinite-retention prohibition** would
make our permanent-Memory-Book moat partially illegal **if** COPPA applied, so the
applicability answer gates the business model, not just a compliance checkbox. The
2025 Rule amendments are already in effect (full-compliance date April 22, 2026,
now passed).

**Question for counsel (narrow):** Confirm Kiddo is **not a COPPA-covered
operator** on the collected-from-the-adult theory, given PIN-gated read-only Kid
View + teen-only (13+) write access. Identify the one or two surfaces where that
conclusion is fragile (Kid View third-party egress — note we are self-hosting fonts
to remove the IP-to-Google leak; Memory Book indefinite retention), and tell us
which **state children's-privacy / age-appropriate-design** obligations (CA AADC
and the wave behind it, which reach minors up to 18) attach **regardless** of the
COPPA answer. Pairs with Part 3 (deletion) but is the broader applicability question.

**Additional fragile surface flagged 2026-06-09 — the public gift link exposes a
child's first name + photo to anyone who guesses the URL.** The gift page lives at a
**guessable, un-tokened slug** (`/<child-name>`, e.g. `/luke-dunphy`):
`generateUniqueFundSlug` (`routes.ts:2224`) is `slugify(name)` + a numeric
collision suffix — no random token — and `GET /api/public/funds/:slug`
(`routes.ts:7186`) returns the child's **first name + photo URL** with **no auth and
no token check**. The page is `noindex,nofollow` (`GiftCheckout.tsx:455`), so it is
not *search-indexed*, but it IS *enumerable/guessable* by anyone who knows or
guesses the child's name. This is intrinsic to the gifter loop (a clean,
shareable, child-named link is the conversion surface), so it is a deliberate
product trade-off, not a bug — but the guessability + photo is the sharp edge.
**Question for counsel:** does a child's first name + photo being retrievable by a
guessable (un-indexed, un-authenticated) URL create COPPA / CA-AADC /
state-children's-privacy exposure? If so, is `noindex` + rate-limiting the public
endpoint sufficient, or must we gate the photo (and/or randomize the slug) behind
an unguessable share token? Product mitigations are scoped and reversible; we are
holding that build for this answer. (Honest-copy fix already shipped: the in-app +
marketing copy no longer claims "only people you share with can reach it.")

---

# Part 6 — Custody / SIPC & wind-down copy blessing (Securities, custody-gated)

**Source:** `memory/project_aum_lawyer_engagement_brief.md` (wind-down draft) +
`SECURITY_AND_COMPLIANCE_POSTURE.md`. **Not a question — a copy blessing**, gated on
custody going live. Today all customer-facing custody/SIPC copy is **conditional
and entity-agnostic** ("when investing is live," "our broker-dealer partner, Member
FINRA/SIPC") and must stay that way until accounts are real. Once a custodian is
wired:
- Bless **present-tense custody/SIPC** copy.
- Bless the **wind-down / "what if Kiddo shuts down" FAQ** (draft: assets custodied
  at the BD, child owns the shares, on wind-down we facilitate an ACAT transfer to
  another broker or liquidate to the funding source). This is a trust gate that
  needs to be live on the FAQ at launch-with-custody — but cannot ship until the
  custodian name + ACAT mechanics are real.

---

# Part 7 — Geographic scope: can we launch nationally, or state-by-state? (Securities / Licensing)

**Source:** `BUSINESS_STRUCTURE.md` (rent-the-rails) + this packet's structure
question (Part 1 + "Preferred structure"). **Why it matters:** we need to know
whether to launch nationally on day one or roll out state-by-state — and our
read is that the rent-the-rails structure makes a state-by-state *licensing*
rollout unnecessary, but we want that confirmed rather than assumed.

**Our understanding (please confirm or correct):**
- The per-state licensing regimes are either the **custodian's** burden (BD
  registration, FINRA membership, state blue-sky BD notice filings, UTMA account
  mechanics — already national for a FINRA-member custodian we rent) or
  **structurally avoided** by our design: no Kiddo custody/control of funds →
  no per-state **Money Transmitter Licenses**; self-directed platform, not an
  adviser → no per-state **RIA** registration. (The MTL and RIA regimes are the
  ones with the painful 50-state dimension.)
- **UTMA is state law, but as *compliance*, not *approval*** — the differences
  are mechanical (age of majority: 18 default, 19 AL/NE, 21 MS/PA, which we
  already handle) and the custodian runs the account. We don't apply for
  per-state permission to offer UTMA.
- A **gifter** is just making a payment to the custodian/platform; gifting is
  not a regulated act for the giver, so the gifter side is geographically
  unconstrained (important — our growth loop is inherently cross-state).

**The questions:**
1. **Given the platform / self-directed / out-of-the-flow structure (Part 1 +
   Preferred structure), can Kiddo offer accounts nationally from day one, or
   are there specific state carve-outs we must exclude?** If carve-outs exist,
   name the states and the reason (e.g., a state that treats the 0.10% fee or
   the default mix as advice, or a state kids'-privacy act layered on COPPA per
   Part 5).
2. Does anything about offering in all 50 states change the answers to Part 1
   (RIA) or Part 2 (holding gift money)?

**Also a custodian question (not for counsel):** which states does the chosen
custodian support for UTMA + personal accounts? That defines the real footprint;
counsel's carve-out list narrows it further if needed. **Operational note:** any
soft launch we do for support/loop-control reasons will be **cohort/invite-gated,
not geo-gated** — geo-gating would break the cross-state gifter loop for no
licensing benefit.

---

# Part 8 — Advisory / human-managed tier (Securities — Advisers Act) — NOT launch-gating, forward-looking

**Source:** strategy decision 2026-05-31 + `memory/project_account_model_decisions.md`
(the self-directed pivot). **Not a launch blocker** — this maps a *future* boundary
so we neither foreclose it nor accidentally step into it. Same Advisers Act
analysis as Part 1, so it costs little to answer on the same call.

**The trigger.** Founder has licensed-advisor contacts and asked whether Kiddo
should offer human-managed portfolios or partner with licensed pros. Our answer
for the **core** is no (it would reverse the self-directed posture in Part 1 and
invert the unit economics — a human managing a $2k UTMA at 0.10% is ~$2/yr). But
two adjacent things may be worth it, and we need the line drawn:

**Our position (please confirm / correct):**
- The **core stays self-directed** — no portfolio management, no personalized
  recommendations at the kid/gift level. Preserves Part 1.
- **(a) Expert-*designed*, user-*selected* model portfolios** — a menu the user
  picks from (credibility / trust play), explicitly *not* "recommended for your
  child."
- **(b) A future, opt-in, high-balance / adult-owner tier that REFERS to
  independent licensed RIAs** (never in-house), possibly for a referral fee.

**The questions:**
1. **Model portfolios — where is the line?** At what point does an expert-designed,
   user-selected model-portfolio menu cross into "investment advice"/RIA? Does
   labeling ("designed by a CFA"), goal-tagging ("growth," "for college"), or any
   sorting/matching of a portfolio *to a user* constitute a recommendation? Draw
   the exact boundary between a self-selected menu and advice so product can build
   (a) safely.
2. **Referral / solicitor model.** If we refer adult owners/parents to independent
   RIAs for compensation, what's triggered (Advisers Act marketing rule / solicitor
   disclosure, written agreements, Form ADV references)? Can Kiddo earn a referral
   fee **without itself registering**?
3. **Contamination risk.** Can an advisory/referral tier exist as a clearly-separate,
   opt-in product **without compromising the self-directed determination of the
   core** gifting product?
4. **Threshold.** At what balance / account type (e.g., the post-handoff adult
   personal account) does an advisory or referral offering become both compliant
   and economically sensible?
5. **In-house management (lowest priority, likely a no).** What would discretionary
   human management by Kiddo itself require, and is it ever worth it vs. referral?
6. **The "designed by experts" marketing claim.** We want to say the model portfolios
   were "designed by experts" / "built by a CFA charterholder." Review the exact
   wording so it is (i) not a misleading/unsubstantiated claim (SEC marketing rule /
   FINRA / FTC, depending on our hat) and (ii) does not imply *personalized*
   advice. Specifically: does **naming a credentialed designer** — especially if
   they are an RIA/IAR — imply an advisory relationship with our users that triggers
   disclosure or registration? Is "built by a CFA" safer than generic "experts," and
   are there words to avoid ("recommended," "tailored," "for your child")?

**Substantiation discipline (internal — what we must have BEFORE making the claim).**
The claim is only true if a real, named, credentialed person actually designed the
portfolios. Required before "designed by experts" appears anywhere: (a) the designer
is a **CFA / CFP / RIA** (the founder's licensed-advisor contacts fit here); (b) a
short **written methodology** they authored; (c) a **dated sign-off**; (d) their
**consent to be named** (or named by credential). Name the *specific credential*,
never vague "experts" — it's both more credible and more defensible.

**What we need back:** a clear "self-selected menu vs. advice" line for (a); a
yes/no + structure for the referral model (b); approved wording for the
"designed by experts" claim (Q6). We expect in-house management to be advised
against — confirm.

**On expert review (FYI — keep these channels distinct).** The founder's
licensed-advisor contacts will review product/portfolio design before go-live.
They're ideal for *designing* the (a) model portfolios, lensing credibility, and
as candidate referral partners for (b) — but they are **not** a substitute for
this written securities-counsel opinion on where the advice line sits. "An advisor
friend said it's fine" is not the RIA determination; counsel draws the line,
advisors build inside it.

---

# Part 9 — Pre-custody marketing claims: can we word investing in the present tense? ⭐ (Securities / Advertising)

**Source:** the marketing-site audit (2026-06-01). **Why it gates launch copy:**
the site describes investing in the **present tense** ("your gift is invested,"
"gifts get invested," "Kiddo purchases a fractional share," "real brokerage rails
underneath," comparison table "Invests automatically: Yes") — but **investing is
not live yet** (gifts are captured pre-custody; holdings are simulated; the
custodian is not wired). The footer + some sections already hedge with "when
investing is live" and "screen images are simulated/illustrative," so the site
currently **straddles**. The founder's intent is to **word it as though investing
is live** ahead of custody going live.

**The questions:**
1. **Can the marketing site state investing in the present tense before custody
   is wired** (gifts captured, not yet invested), relying on the "simulated /
   illustrative" + "when investing is live" disclaimers? Or must the
   money-movement/securities claims be future-conditional until a real brokerage
   account exists and a real order is placed?
2. Which specific claims are safe vs. not, given securities-advertising standards
   (SEC/FINRA marketing rules, FTC) are stricter than ordinary "coming soon"
   startup copy? Draw the line between **acceptable** (the product identity,
   gifting/fund-creation that works today, the experience) and **not yet
   acceptable** (asserting a customer's specific money is invested in real
   securities held at a broker-dealer right now).
3. What disclaimer placement/proximity makes present-tense framing defensible, if
   it's allowed at all?
4. **Forward projections / hypothetical performance** *(not pre-custody-specific —
   applies whenever a projection shows, so answer it on this same advertising
   pass).* The product surfaces forward value projections **everywhere** — "$50 →
   ~$82 when Luke turns 18," "On track for $1,490,926 at 65," the growth curves —
   at a disclosed **7% historical assumption** with "not guaranteed" disclaimers
   (rationale in `COMPOUNDING_NARRATIVE_NOTE.md`: 7% not the viral 10%, always
   disclaimed, real-first). Projecting investment value to retail is governed by
   securities-advertising rules on **hypothetical / projected performance** (SEC /
   FINRA marketing rules, FTC) that are stricter than ordinary startup copy. Are
   these illustrations defensible as **hypotheticals** given the assumption +
   not-guaranteed disclaimers, and what wording / placement / proximity does the
   projection need to be clean (or is any forward-dollar projection a line we
   should not cross)? Separately, confirm our **kiddie-tax + projection
   disclosures are accurate and sufficient** — the kiddie-tax fact is settled and
   our copy is corrected in `shared/legal-copy.ts`, so this is an
   accuracy/sufficiency review, not a question about the underlying law.

**Why it matters:** a not-yet-live investment product worded as live is the
textbook misrepresentation-of-a-securities-product risk. "It's gonna be" is not a
defense. This is the one thing standing between the founder's "word it as live"
goal and shipping it safely — a clear counsel answer unlocks it. Until then the
site keeps the disclaimers and the few hard money-mechanics claims stay honest
(e.g., "real brokerage rails when investing is live").

---

# Part 10 — Paying institutions per funded account (referral / solicitor rules) — NOT launch-gating, forward-looking (Securities / Consumer)

**Source:** the institutional-aggregator channel plan
(`memory/project_babylist_integration_plan.md`). **Not a launch blocker** — Act-2
distribution, gated behind the proven loop like every partner channel. Mapped now
because it shares the Advisers Act / referral-compensation analysis with Parts 1
and 8, so it costs ~nothing to answer on the same call.

**The plan.** Trusted institutions (churches/synagogues, hospital-adjacent vendors,
registries like Babylist) promote Kiddo at life moments (baptisms, namings, b'nai
mitzvah, new-baby registries). The proposed Tier-1 arrangement is a
**per-funded-account bounty paid as a charitable donation** to the institution's
foundation or ministry — "Kiddo donates $X to your foundation for every funded
account started through your community." Gifters themselves are never paid and
never pay (that discipline is locked); the institution never holds or routes money.

**The questions:**
1. Does a per-funded-account payment to an institution (or its 501(c)(3)) for
   promoting a platform that opens brokerage accounts trigger **solicitor/promoter
   rules** — Advisers Act marketing rule (presumably moot if Part 1 lands on
   no-RIA), FINRA referral-compensation rules via the BD, or state-level analogs?
   Does our self-directed-platform posture keep this in ordinary
   **affiliate-marketing** territory?
2. Does paying the bounty **as a donation to a 501(c)(3)** rather than cash
   compensation change the analysis — better (not "compensation" to a solicitor)
   or worse (charitable-solicitation registration, the institution's own
   disclosure duties to its community, private-benefit issues on their side)?
3. What **disclosure at the point of referral** is required or prudent ("[Church]
   receives a donation when an account is opened through this link")?
4. Same analysis for **commercial partners** (registry affiliates, hospital
   welcome-kit vendors): is a flat placement fee structurally cleaner than a
   per-funded-account bounty, or are both fine under the same conditions?

**Note the symmetry with Part 8 Q2** — that part asks whether Kiddo can earn a fee
referring users *out* to RIAs; this part is the reverse direction: institutions
compensated for referring *into* Kiddo. Same compensation-for-referral family;
please answer both in one pass and state whether the direction changes anything.

---

# Part 11 — Hosting third-party content on a child surface ⭐ (Privacy / Consumer / Criminal-reporting)

**Source:** `TRUST_SAFETY_FINDINGS.md` (two independent multi-agent audits),
`KID_VIEW_SAFETY_GATE_SPEC.md`, `CONTENT_SCANNER_VENDOR_SPEC.md`. **Gated by opening
the public UGC surface to strangers — not by custody or launch-day** — so fold it in
now and it rides the same engagement. Pairs with Part 5: Part 5 is the *privacy of
the child's data*; this is the *posture for hosting third-party content that reaches
a child*. Added 2026-06-09 (the one launch-gating area the packet did not yet ask).

**Context.** Gifters submit user-generated content — notes, photos, video, voice —
that lands on a child's surface (the Memory Book / PIN-gated Kid View). Via the
public gift link a gifter can be a **stranger**. Our moderation stack today:
submission-time text-safety on all five gifter text paths (`giftTextSafety.ts`); a
content-scanner seam that **fails closed in production** (unscanned media is refused
until a real vendor — PhotoDNA + a moderation vendor — is wired); a proposed
**sender-trust pre-visibility gate** (untrusted/public senders' media held for
parent approval before a child can see it); and a per-item report → auto-flag. The
questions are about legal **sufficiency and obligations**, which only counsel can
set.

**The questions:**
1. **CSAM reporting (18 U.S.C. §2258A).** As a platform hosting user-uploaded
   images/video on a child-directed service, do we have a **registration + 24-hour
   NCMEC reporting** obligation, and what **triggers** it (any UGC hosting, or only
   a detected hit)? When must registration be in place relative to opening the
   public upload path, and what record-retention attaches to a report?
2. **Moderation sufficiency / duty of care.** Is the stack above — CSAM hash-match
   + a moderation vendor + the sender-trust pre-visibility hold for untrusted
   senders + report-and-remove — a **legally sufficient** standard of care for a
   **child-facing** UGC platform before we open the public link? What is the
   **minimum** bar (we would rather know the floor than guess), and are we over- or
   under-built?
3. **Platform liability / Section 230.** Does **Section 230** shield us for
   gifter-submitted content that reaches a minor, or does the **child-directed
   nature** plus the fact that we **curate** what the child sees (visibility rules,
   the at-18 unlock) limit the shield? Does adding moderation **reduce** exposure or
   create a "we assumed the duty" theory?
4. **State duty-of-care for minors.** Beyond COPPA / CA-AADC (Part 5), do any state
   **age-appropriate-design / duty-of-care** regimes impose obligations on a
   platform that **transmits third-party content to a minor** (vs. merely collecting
   the child's data)? Any **mandatory-reporter** status?
5. **Grooming / contact-channel (cross-ref Part 5).** Part 5 asks the privacy
   question about the child's name + photo at a guessable URL; the adjacent T&S
   question: does letting a stranger reach a child's gift page and **submit
   content** raise grooming / contact-channel duties we must design against (we
   already strip contact info from gifter text)?

**What we need back:** the **floor** for a child-facing UGC moderation posture; a
yes/no + timing on the §2258A / NCMEC obligation; and whether opening the public
upload path **before** the sender-trust gate + a real scanner are live is a
**must-not** (our current engineering assumption) or merely advisable. The
moderation builds are **scoped and reversible; we are holding the public-UGC opening
for this answer.**

---

# Engagement logistics

**Firm type (in order):** SEC-RIA specialist boutiques (Hardin Compliance, ACA
Group, Wagner Law Group's RIA practice); securities boutiques with fintech focus in
Miami/SF/NYC ($500–800/hr but efficient); **avoid generalist corporate firms**.
Names to verify: Hardin Compliance, ACA Group, Foley Hoag fintech, Cooley emerging
companies + fintech regulatory, Lowenstein Sandler fintech/RIA.

**Ask:** a 60–90 min initial call + a **2–3 page written memo within 2 weeks**
(which option, why, what to change in product / website / TOS to be clean) + an
estimate for follow-up work. **Budget envelope: $3K–$5K** for call + memo;
follow-up scoped separately.

**Cover email (paste, fill the brackets):**

> **Subject:** RIA-registration + fund-holding questions — pre-launch UTMA fintech,
> need a directional call + short memo
>
> Hi [Name],
>
> We're Kiddo, Inc., a pre-launch, US-only fintech. Parents open custodial (UTMA)
> investment accounts for their kids, and friends and family contribute
> gift-investments. Investments are intended to be custodied and executed by a
> third-party broker-dealer; we are the technology/UX layer, and we are pre-launch
> (custody is not yet live).
>
> We need directional answers, before public launch, on two linked questions: (1)
> whether our planned 0.10% AUM fee requires SEC RIA registration (we've sketched a
> self-directed-platform posture plus three fallback structures), and (2) whether we
> may capture a gifter's payment before the recipient's account exists. A short
> attached packet lays out these plus a few tightly-scoped privacy questions
> (children's data). We're looking for a 60–90 minute call plus a short written
> memo, roughly a $3K–$5K initial engagement, with follow-up scoped separately.
>
> Does this fit your practice? Happy to answer scoping questions first.
>
> Best,
> [Your name], Kiddo, Inc.

**Timeline:** Week 1 send to 3 firms + intake calls; Week 2 pick + schedule the
substantive meeting; Weeks 3–4 meeting + memo; Weeks 4–6 act on the memo (file
Form ADV / sign DriveWealth amendment / rewrite TOS, per chosen option).

---

# Source documents (full detail lives here)

- `memory/project_aum_lawyer_engagement_brief.md` — Part 1 (full), Part 6 wind-down.
- `LAWYER_Q_HOLDING_GIFT_FUNDS.md` — Part 2 (full).
- `CHILD_PII_DELETION_DECISION.md` — Part 3 (full options + decision).
- `SUCCESSOR_CUSTODIAN_SPEC.md` (post-handoff section) — Part 4 (full).
- `SECURITY_AND_COMPLIANCE_POSTURE.md` — Parts 5 & 6 context (the external,
  cannot-be-coded matrix).
- `LAUNCH_CHECKLIST.md` — where Part 2 (capture-at-intent, P0-1) is tracked.
- `P0-1_SPEC_CAPTURE_AT_INTENT.md` / `P0-1_ADVISORY_PANEL_DECISION.md` — the built
  capture-at-intent design the Part 2 answer unblocks.
- `memory/project_babylist_integration_plan.md` (institutional-aggregators section) —
  Part 10 (full channel plan + arrangement ladder).
- `TRUST_SAFETY_FINDINGS.md` + `KID_VIEW_SAFETY_GATE_SPEC.md` +
  `CONTENT_SCANNER_VENDOR_SPEC.md` — Part 11 (UGC-hosting / child-safety legal posture).
