# AUM / RIA-registration brief (Q1 of the counsel engagement)

> This is the detail doc for **Q1** in `COUNSEL_ENGAGEMENT.md` (the consolidated cover email,
> firm shortlist, budget, and the other two questions live there). Forward this brief attached
> to that cover email. Recommendation: an SEC-RIA specialist, not a generalist.
>
> **Founder: insert the TRUE DriveWealth contract status before sending** (see "About us").
> Option B's analysis hinges on it; do not overstate it.

---

## About us

Kiddo, Inc. is a pre-launch, US-only fintech building a UTMA-custody platform: parents create
investment accounts for their kids, and friends/family contribute gift-investments to those
accounts. The product is structurally US-only (UTMA + broker-dealer + 1099 dependencies).

- Investments are intended to be custodied + executed by a third-party broker-dealer; our
  planned partner is DriveWealth, LLC (FINRA broker-dealer, SIPC member). **[Founder: state the
  true contract status — "signed integration agreement; DriveWealth is broker of record" OR "in
  discussions with DriveWealth." The white-label/sub-advisory analysis in Option B hinges on
  this.]** We are pre-launch and custody is not yet live.
- Kiddo, Inc. is a technology company, not a broker-dealer. We do not custody securities,
  execute trades directly, or hold customer funds outside the Stripe payments pipe (which would
  route deposits to the broker-dealer's customer accounts once custody is live).
- Pre-revenue; private cohort accessible, no public launch yet.
- Founding team: [your name + brief background]

## The structural question

Our fee model uses a 0.10% annual AUM fee charged continuously on the fund — paid effectively
by the parent-custodian during the kid's minority, and **continuing on the account after
ownership transfers to the child at majority.** Important: what *retires* at the kid's majority
is the parent's *subscription* (Plus/Family), NOT the AUM fee. Post-handoff, the 0.10% AUM is
the *only* revenue mechanism on that account and runs for the life of the fund. So please
analyze an **ongoing advisory-style AUM fee that persists onto an adult account-owner**, not a
fee that stops at 18. Per our internal analysis this might require SEC RIA registration,
depending on (1) whether the platform constitutes "investment advice" under the Advisers Act
three-prong test, (2) whether the AUM fee structure itself triggers registration vs. a flat
subscription, and (3) whether the broker-dealer's status + compliance framework absorbs our
exposure (white-label / sub-advised model).

We need a clear directional answer + recommended structure BEFORE public launch. It affects
pricing, marketing copy, TOS, and operational workflows.

## Three options we've internally identified

**Option A — Register Kiddo as an SEC RIA.** Clean, removes ambiguity, future-proofs product
expansion (Roth at 18, banking, P2P). But ~$50K–$100K setup + ~$50K–$150K/yr ongoing
compliance, 3–6 mo timeline, and we'd be an RIA at <$10M AUM (wrong size for the obligation
load). **Empirical counter-evidence:** our most direct competitor (EarlyBird) took exactly this
path — marketed as "A Registered Investment Advisor focused on the youngest generation" — and
still stalled (~$480K ARR) despite strong funding. Full RIA registration did NOT solve the
thing that kills companies in this category (distribution/CAC); the obligation was pure burn at
their scale.

**Option B — White-label / sub-advisory under the broker-dealer (or a partner RIA).** Restructure
so the broker-dealer/partner RIA is the technical adviser; Kiddo is a technology vendor with no
investment-advice surface; the AUM fee is paid to the partner RIA who pays us a license fee.
Lowest compliance burden, faster to launch, leverages existing infrastructure. But margin
compression, less fee-structure control, and dependent on the partner being willing (validate
in parallel).

**Option C — Drop the AUM fee, flat subscription only.** Plus ($3.99/mo) + Family ($6.99/mo)
become the only revenue; post-handoff the kid pays nothing unless they use Plus features.
Cleanest regulatory posture (flat SaaS fees don't trigger RIA registration), matches Acorns'
"we don't take a percent of your growth." But ~30% lower long-term revenue (AUM compounds; the
subscription doesn't) and requires rebuilding pricing/marketing copy.

## Specific questions we need answered

1. Is the 0.10% AUM fee, as structured (continuous on the fund; paid by the parent-custodian in
   minority and **continuing on the account after ownership transfers at majority, where it
   becomes the only fee because the subscription retires**), enough *by itself* to trigger RIA
   registration if the platform doesn't otherwise constitute "advice"? (The fee does NOT stop at
   handoff; only the subscription does.)
2. Does our product surface constitute "investment advice" under the Advisers Act three-prong
   test? We let the parent pick from a curated ~17-stock universe (we surface options, don't
   recommend a specific stock); we project future value at a 7% historical-average assumption
   (disclaimed, not a guarantee); we do NOT charge per-trade, execute trades, or custody
   securities (the broker-dealer does).
3. If Option B (white-label) is viable, what specific contract terms with the broker-dealer
   establish them as adviser of record vs. us? Have you seen this structure work cleanly?
4. Are there state-level registration considerations we'd miss focusing only on SEC?
5. Given pre-launch + pre-revenue stage, realistic timeline + cost for each option?
6. Have we missed a fourth option (flat-dollar AUM fee; quarterly disclosure-doc regime; etc.)?
7. **THE DECISIVE QUESTION (the self-directed pivot):** If we *remove* the managed/age-banded
   allocations and the auto age-glide-path entirely, drop "strategy review" nudges, and operate
   as a PURE SELF-DIRECTED platform (the gifter/parent/kid affirmatively picks every security
   from a neutral menu of individual stocks and pre-built baskets — no recommendation, no
   tailoring to the child, no discretionary rebalancing, no glide path), **does the 0.10%
   asset-based fee STILL trigger RIA registration, or can it be framed as a platform/technology
   fee on a self-directed brokerage (the Stockpile / Public / Robinhood posture) rather than an
   advisory fee?** This is the founder's emerging lean. Specifically: (a) does self-directed-only
   with an asset-based fee clear RIA? (b) where exactly is the line between a "neutral menu you
   choose from" (defensible) and a "default/pre-selected basket" that could itself be a
   recommendation? (c) does *any* asset-based fee — even without advice — independently invite
   adviser scrutiny that a per-trade or flat fee would not?
8. **UTMA age of majority when a family relocates — which state's law governs an established
   account?** We set each account's age of majority (18/19/21 per state) at creation from the
   custodian's/donor's state and deliberately *freeze* it for the life of the account. Is
   freeze-at-creation correct, or does the age of majority follow the minor's current state of
   residence (a later move would then change the handoff date)? This drives the handoff date,
   the claim-eligibility gate, and "she gets control at N" copy.

## Managed-allocation design flags (inputs to Q2 — supersede if we commit to self-directed-only)

Our managed allocations are our highest-advice surface (the user is steered into a pre-built
portfolio by a risk label rather than assembling their own). Three flags:
1. **Active sector tilt vs pure market-cap weight.** Our growth default carried a ~10% tech-sector
   tilt; a competitor's fiduciary deliberately used pure market-cap weight ("not meant to make a
   bet on any one or two companies"). Does a sector tilt in a default managed portfolio materially
   change the advice analysis? (We have removed the tilt; confirm market-cap weight is the safer
   posture.)
2. **Tax-aware bond selection.** UTMAs are taxable (kiddie tax); we use a taxable-interest bond
   fund. Not an advice-line question — a prudent-adviser question that only matters at larger
   balances if we are deemed to give advice. Flag for the memo, not a blocker.
3. **Suitability matching vs growth-first default.** We default everyone to growth-first on a
   long-horizon rationale, with no per-user suitability questionnaire. Can we default to an
   aggressive allocation without a suitability process on a disclosed rationale, or does
   defaulting-without-suitability itself push us toward adviser status / liability?

## Our soft preference (for your sanity-check)

Soft lean is **Option B (white-label)** — we're not at the scale where RIA setup pencils out;
the broker-dealer's existing infrastructure is the obvious leverage; it preserves the AUM
mechanism without the compliance overhead; and we can transition to Option A on our own terms
past ~$10M AUM. But we're not married to it — if the partner-RIA structure rarely survives SEC
scrutiny, or our product is too far on the advice side for anything short of Option A, tell us.
(If the self-directed-platform-fee framing in Q7 is clean, that likely supersedes all three and
becomes our posture.)

## Wind-down FAQ draft (DO NOT ship as live copy until custody is live)

The "what if Kiddo shuts down?" answer is a trust gate for a custodial product. Draft (hold
until a real custodian is wired + counsel blesses present-tense custody copy):

> Your child's investments aren't held by Kiddo. They're held in a custodial account at
> [custodian], a regulated, SIPC-member broker. Your child legally owns the shares; Kiddo is the
> app you use to manage them. If Kiddo ever shut down, your account wouldn't disappear with us.
> We'd help you transfer it in-kind to another brokerage (a standard ACAT transfer to a firm like
> Fidelity or Schwab), or sell the holdings and return the proceeds to your linked account.

This belongs with the custodian-wiring workstream, not pre-launch copy.
