# Legal question — can we hold a gifter's money before the recipient's account exists?

**Forward this alongside the AUM engagement brief** (see
`project_aum_lawyer_engagement_brief`). It's the same securities/fintech counsel;
this is one additional, tightly-scoped question that gates our single most
important product fix. ~15 minutes of the call.

---

## Context (one paragraph)

We let anyone gift money toward a child's investment account (custodial UTMA, held
by our broker-dealer partner). Today we have two gift paths. In one, the gifter is
on a live fund and we capture their card immediately — clean. In the other, a
gifter wants to give to a child whose parent **hasn't set up an account yet**, so
we currently only collect the gifter's email and send the parent a nudge — **no
money is taken.** A large share of these never convert (parent never acts), and
the gifter is never told. We want to instead **capture the gifter's payment at the
moment of intent** and hold it until the parent opens the account, refunding if
they don't within a set window.

## The specific question

**May we charge a gifter's card and hold those funds — as a refundable
liability — before the destination custodial brokerage account exists, then either
(a) invest the funds once the parent opens the account, or (b) auto-refund the
gifter if the account isn't opened within N days?**

## ⭐ The two binary gates that most shape the build (added 2026-05-29)

An internal expert-panel review converged on a **no-funds-held** design (save the
gifter's card via a Stripe SetupIntent, then charge it off-session when the parent
creates the fund — Kiddo never holds the money). That likely sidesteps the holding
question entirely. But two binary questions gate it, and we need a written yes/no:

- **(A) Off-session conditional-charge classification.** Does charging a gifter's
  *pre-authorized, saved* card **off-session, weeks later, on a trigger the gifter
  did not directly initiate** (the parent's unilateral fund creation), **with a 14-30
  day decline-retry loop**, trigger FinCEN MSB / state money-transmission licensing /
  BSA-AML — or does the fact that Stripe (a licensed acquirer) holds the token and
  processes the charge fully exonerate us? (Our concern: regulators may define
  transmission/custody by *control over the timing and direction of funds*, not
  physical possession.)
- **(B) Broker-dealer acceptance of multi-gifter funding.** Does our BD agreement
  explicitly document (i) acceptance of **multiple non-parent gifters funding a single
  minor's UTMA account**, and (ii) their source-of-funds/AML procedure for those
  third-party contributions — and will they accept a *volume surge* of small
  multi-contributor accounts? (If their AML team flags this, gifts get charged but
  orphaned — silent failure of the whole acquisition loop.)

If (A) is "you need MTL/MSB," we either license or fall back to an auth-only path. If
(B) is unconfirmed, we hold the charge-at-pairing step. Everything below remains
relevant for the alternative (funds-held) design.

## Sub-questions that determine the build

1. **Money transmission / custody of customer funds.** Does holding gift money
   pre-account make us a money transmitter, or trigger custody/safeguarding
   obligations (state MTL, FinCEN MSB registration, BSA/AML), versus passing it
   straight through to the broker-dealer? Does it matter whether the funds sit in
   our Stripe balance, a Stripe-held balance, or a segregated/FBO account?
2. **The clean structure.** Is there a structure that avoids those obligations —
   e.g., (i) Stripe manual-capture authorization held and only *captured* once the
   account exists (note: card auths expire ~7 days — likely too short), (ii) funds
   held in a segregated "for-benefit-of" account with the broker-dealer as the
   holder, or (iii) treating it as a refundable pre-payment for a forthcoming
   securities purchase? Which is cleanest given our broker-dealer partnership?
3. **Refund window.** Is there a regulatory/consumer-protection constraint on how
   long we may hold pre-account funds before we must refund? What's a defensible
   default (7 / 14 / 30 / 60 days)?
4. **Disclosure.** What must we tell the gifter at the point of charge — that the
   money is held, the conditions under which it's invested, and the refund terms?
5. **Gift / UTMA mechanics.** Once invested, the gift is an irrevocable UTMA
   transfer to the minor. Does holding-then-investing change the gift's tax/legal
   completion date (date of charge vs. date of investment) in a way we must
   disclose or that affects the donor?
6. **Tie-in to the broader engagement.** If the answer is "only behind a
   broker-dealer / via a segregated account," does that change anything in the AUM
   structural decision already on the table?

## Why it's urgent (for the lawyer's prioritization)

This is not a nicety. Our entire acquisition model depends on the gifter's
emotional moment converting to a *funded* gift. The current "collect email, hope
the parent acts" path is the exact failure mode that has sunk comparable
businesses. We can't responsibly build the fix until we know which holding
structure is permissible — so this answer is on the critical path to launch.

## What we need back

A short written read (can be folded into the AUM memo): **which of the holding
structures above is permissible and cleanest, the maximum defensible hold window,
and the required gifter disclosures.** That's enough for us to build P0-1 in
`LAUNCH_CHECKLIST.md`.
