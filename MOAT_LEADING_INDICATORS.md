# Moat Leading Indicators — measuring whether the moat is forming

> Companion to `MOAT_MEMO.md` (what the moat *is*), `NORTH_STAR.md` (the
> activation metric) and `LOOP_TEST_RUNSHEET.md` (gate #1, funded-k). This doc is
> the operational layer: the moat takes ~18 years to *prove*, so this is how we
> find out in ~12 months whether it is *forming* — and how to structure a test
> that could prove it isn't. Written 2026-06-10 out of the moat-formation
> strategy thread; decision-support, not gospel.

## The thesis in one paragraph

The durable moat is **relationship origination**: Kiddo acquires a generation's
primary financial relationship at ~$0 CAC, ~18 years before any bank can, at the
single most expensive-to-acquire moment in consumer finance (a young adult coming
into money and going financially active) and at maximum trust (a kid who watched
their fund grow their whole childhood). The reinforcer is the un-ACAT-able Memory
Book (`MOAT_MEMO.md` §2). Everything else — gifting, AUM, the loop — is the
*mechanism*, not the moat. The catch: this is the **slowest-maturing moat
imaginable**. It does not exist until the first real cohorts hit majority and
**stay**.

## Two gates, in sequence

1. **Gate #1 — does the loop compound? (funded-k ≥ 1.)** A funded gift produces a
   new funded family. Untested. Gets you the kids. Measured today
   (`/api/admin/k-factor`, `LOOP_TEST_RUNSHEET.md`). Necessary, not sufficient.
2. **Gate #2 — do the kids *stay* at handoff (18/21)?** This is the one that
   decides whether there is a moat *at all*. A kid who cashes out at majority is
   the EarlyBird failure mode: same outcome as a cash gift, and you're just a
   worse Acorns. **Gate #2 is the load-bearing unproven assumption of the entire
   company, and it's the one we can least afford to wait for.**

Most startups die at "no distribution / no PMF." Kiddo's specific, unusual risk
is different: the moat may require 10–18 years to validate. That long a
realization timeline is itself the central risk — there's a fragile middle decade
where you're proven enough to attract Acorns/Fidelity but not yet old enough for
the relationship moat to have hardened.

## Three re-loop mechanisms — and the discipline

- **A — the kid stays at 18** (keeps the account, opens the Roth, banks with you).
  Direct retention → LTV. *This is the moat.* (Roth-at-handoff is spec'd in
  `AGE_18_HANDOFF_SPEC.md`, gated on live custody — and Roth-conversion-rate at
  handoff is one of the truest moat metrics we'll ever get.)
- **B — the kid leaves at 18 but starts a fund for their own kid ~10–20 yrs
  later.** Generational re-origination. **Much weaker than it sounds**, and not a
  safety net: (1) the timeline is 28–35 yrs from a newborn cohort; (2) a cash-out
  is the *disconfirming* signal — you can't claim "they left because it wasn't
  sticky" *and* "they'll come back because it was so good"; (3) at 28–35 it's a
  fresh, contested acquisition where nostalgia is a brand nudge, not lock-in.
- **C — the gifter graph re-fires.** When the grown kid has a baby, the people who
  gifted *them* (grandma, the uncles — **already Kiddo users who loved it**) gift
  the new baby. Warmer than B, because the re-entrants are retained believers who
  never left. (`MOAT_MEMO.md` "18-year-later loop closure".)

**The discipline:** A, B and C are all driven by the *same* thing — the
childhood emotional + financial attachment. So a cash-out at 18 predicts **no**
re-origination, not a delayed one. You do not get to "fall back" on B if A fails;
they rise and fall together. Never let "they'll do it for their kids" become
permission to under-invest in retention at 18.

## The unlock — collapse the 18-year question to a 1–3-year one

You do **not** need a kid born into Kiddo to test retention-at-handoff. You need a
kid who turns 18 *soon*. **Deliberately recruit 15–17-year-old cohorts** (or
partner with families whose kid is near majority), run *real* handoffs, and
measure 6–12-month retention + next-product take (Roth, banking). Retention-at-
handoff does not care that they weren't "born into it." This is the single
highest-leverage experiment available and almost nobody runs it because it feels
off-thesis.

**Design it to kill the thesis, not confirm it.** Pre-commit a kill line: e.g. if
> ~⅓ of a handed-off near-majority cohort cash out or go dormant within 6 months,
the relationship-origination moat is in real trouble — *regardless* of how good
the loop or the Memory Book looks. Disconfirming evidence first.

## The leading indicators (measure these in the next 12 months)

Weighted by how well they predict gate #2. **Identity proxies beat transaction
proxies** — gift *count* is a vanity metric (a fund with 50 gifts still cashes out
if the kid feels no ownership). Most of these are computable from existing data;
the gap today is surfacing them, not collecting them.

| Indicator | What it proxies | Source today | Direction |
|---|---|---|---|
| **Memory Book richness** (human notes/fund; % of funds with ≥N; growth over time) | The literal substance of "the account my grandmother started for me" — the strongest identity proxy | `memory_entries` (gift_message + parent_note) | up + to the right |
| **Teen ownership behavior** (Kid View opens unprompted; suggest-a-stock submissions; reactions) | The closest *direct* read on "will they own it at 18" — the 15-yr-old who checks it is the 18-yr-old who keeps it | Kid View access logs, `kid_view_suggestions` | any > zero, growing |
| **Distinct-gifter density** ("peopled-ness", gifters/fund) | A fund 8 people built is a different psychological object than one only mom funded | `gifts` distinct senders/fund | up |
| **Repeat / recurring gifting** (repeat-gifter rate; % funds with recurring) | Habit + the substantial-balance-at-18 that makes ownership feel real | `gifts`, `recurring_gifts` | up |
| **Stake formation** (funds at $500+, $2k+ with 2–4 yr history) | The "sticky zone" thresholds — trivial balances get cashed out, real ones create ownership psychology | `NORTH_STAR.md` levels | up |
| **Handoff-cohort retention** (from the experiment above) | The *actual* answer to gate #2, 1–3 yrs early | a real near-majority pilot | the whole ballgame |
| ~~Raw gift count~~ | *vanity* — does not predict ownership | — | ignore as a moat signal |

## What to build / instrument now (roadmap)

The 30-year re-loop is **not** a thing to build for today (it's unmeasurable for
decades and engineering for 2055 is premature). What's actionable now:

1. **Attachment surfaces** (the things that *drive* every mechanism):
   - **Memory Book richness — DONE 2026-06-10**: the kid now sees their *whole*
     book (human notes first), not a capped 8. This is the substance of the moat,
     not cosmetics.
   - **The handoff as a gift, not a cliff**: the post-handoff keepsake +
     `/welcome-at-18` walkthrough (`AGE_18_HANDOFF_SPEC.md`).
   - **Teen engagement**: Kid View depth for 14–17, suggest-a-stock — the most
     direct early proxy, so worth real product investment.
2. **Measurement**: a leading-indicator (“is the moat forming?”) admin panel that
   surfaces the table above, sibling to the k-factor panel. Most inputs already
   exist; this is a read-model + a surface, not new tracking.
3. **The pilot**: recruit a near-majority cohort and run real handoffs. This is
   ops, not engineering, and it's the highest-value de-risking move available.
   Operational plan + the pre-committed kill line: `HANDOFF_RETENTION_PILOT_RUNSHEET.md`.

## The one-liner

Don't measure whether you *have* a moat. Measure whether one is *forming* — and
structure a test that could prove it isn't. The proof point you most need (at-18
stickiness) is not 18 years away if you're willing to go buy near-majority cohorts
and run the handoff on purpose.
