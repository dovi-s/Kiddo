# Unit Economics — the five numbers that decide $100M and $1B

*2026-06-10. Turns "do we have a path?" into a testable model instead of a
narrative. Companion to `COMPANY_STRATEGY.md` (the thesis), `MOAT_MEMO.md`
(funded-k), `EDUCATION_THESIS.md` (the retention mechanism). The numbers below
are ILLUSTRATIVE — the point is the **levers** and the **threshold each must
clear**, not a forecast. Plug in real numbers as the loop produces them.*

---

## The revenue stack (three lines, stacked over time)

1. **Subscription (Kiddo+)** — the near-term engine. ~$60–120/yr per paying fund.
2. **AUM fee (0.10% today)** — the annuity. A tiny take that compounds as accounts
   age. Graduates to a richer take only when we own more of the stack (BD/RIA/bank).
3. **Adult LTV (post-handoff)** — the *real* $1B engine. A kid who keeps the account
   at 18/21 becomes an adult financial customer **acquired at birth for ~$0 CAC**,
   monetized across investing + banking + credit for decades.

> Revenue ≈ (paying funds × sub ARPU) + (total AUM × take rate) + (retained adults × adult ARPU)

## The take-rate reality (why AUM alone is not the answer)

0.10% is a meter, not a business:
- $100M from AUM alone @ 10bps = **$100B AUM.**
- $1B from AUM alone @ 10bps = **$1 *trillion* AUM.**

So the near-term engine is **subscription**; AUM is the long tail; the $1B engine
is **adult LTV + a graduated take rate**, never the UTMA fee by itself.

## Pricing decisions (recorded 2026-06-12) -> `ONE_METER_FEE_DECISION.md`

Settled enough to build against (founder-ratifiable; implementation is custody-gated).
The full memo + an editable calculator (`script/revenue-model.mjs`) live alongside.
Load-bearing rules so this does not drift:

- **Greater-of billing, never the sum.** A fund pays MAX(subscription, AUM). A paying
  family never sees two fees stacked. The subscription is the fee while the balance is
  small; AUM takes over once the balance crosses ~$29k (Plus) / ~$59k (Family).
- **Charge on invested BALANCE, not earnings.** A performance/earnings fee is barred
  (advisory + qualified-client rule); the 0.10% is a platform fee, not advisory, today.
- **The subscription is the FLOOR, not the business.** Per-fund revenue RISES as
  balances compound (the AUM annuity), and the real engine is the adult-LTV handoff. Do
  not optimize for sub ARR or price in a way that slows fund growth. ("10k funds =
  $600k" is the visible floor, not the asset.)
- **Day 1 (launch) = free loop, never gated; subscription genuinely optional; AUM and
  float turn on at custody.** The launch gate is funded-k, not revenue.
- **Future streams (ranked):** advisory fee post-RIA (0.10% -> ~0.25%) > adult LTV >
  Kiddo Cash parent HYSA (the real float play, since the kid's gifted cash is deployed,
  not idle; pay a fair rate) > gifter a la carte > B2B. Avoid PFOF, debit interchange,
  paid education.
- **Trust rules (mostly already true):** lock + grandfather prices forever, frictionless
  cancel, money + memories always exportable, never deduct a fee Stockpile-style.

## The five levers

| Lever | What it is | Why it's decisive | Has to clear |
|---|---|---|---|
| **funded-k** | funded referrals per funded account | < 1 = paid CAC = EarlyBird = **no path at all** | **≥ 1** (the gate on everything) |
| **paid conversion** | % of funds that pay for Kiddo+ | the near-term revenue engine | ~20–40% |
| **avg fund balance** | AUM per account | drives the AUM annuity; grows with account age | ramps $1–2k → $10–30k+ |
| **take rate** | 10bps now → graduated at scale | 10bps alone can't reach $1B; owning the stack can | 10bps → 30–50bps+ |
| **handoff retention** | % who keep it at 18/21 | converts the wedge into lifetime LTV = the **$1B unlock** | the pivotal unknown |

## $100M revenue — credible, subscription-led

- ~**1M paying funds × ~$100/yr = $100M ARR**, plus the AUM annuity on top.
- Requires funded-k ≥ 1 (organic acquisition into the millions) and ~20–40% paid
  conversion → roughly **2.5–5M total funds**.
- This is a "very good consumer fintech." The math is legible; nothing exotic
  required beyond a working loop and healthy paid conversion.

## $1B revenue — the generational thesis, not an extrapolation

The adult-LTV engine has to fire. Two illustrative routes:
- **Base × lines:** ~10M lifetime relationships; ~60% retained at handoff = ~6M
  adults × ~$170/yr (investing + banking) = ~$1B, on top of the kid-base
  subscription + AUM.
- **AUM-led (graduated take):** ~$200B AUM × ~50bps (own-the-stack monetization)
  = $1B.
- Either way: a *generation* of accounts, **retained through the handoff**,
  monetized like a bank — not a 10bps fee on UTMAs. This is the
  `COMPANY_STRATEGY.md` endgame: gifting is the wedge, the handoff is the prize,
  "financial OS for a generation" is the $1B+ outcome. A 10–20 year arc.

## The honest gate

None of this is real until **funded-k ≥ 1** (unproven) and **early retention
holds** (no cohort has hit 18 yet). Enterprise value today is the *option value*
of proving the loop. Prove funded-k ≥ 1 with one channel; everything downstream
is narrative until then. Don't raise on the $1B story — earn the right to tell it.

---

## The pivotal lever: handoff retention — how you "ensure" they stay

You **cannot force it.** At the age of majority the money is legally theirs (UTMA),
so "ensure" can never mean lock-up, hidden-withdrawal dark patterns, or guilt /
loss-aversion ("are you sure? this costs you $X") — all banned, because honesty is
the moat (`COMPOUNDING_NARRATIVE_NOTE.md` #3). Retention is **earned across 18
years**, by making *keeping it* the calm, obvious, emotionally + rationally +
practically default. Four stacking layers:

1. **Identity (education).** They were *raised* to be the calm long-term owner who
   doesn't cash out — so at 18 they don't, because that's who they are. This is the
   deepest lever and the longest game: the anti-portfolio-news curriculum
   (`EDUCATION_THESIS.md`), peaking in the §9 handoff capstone — *"you're not just
   getting money, you're the kind of investor who keeps it."*
2. **Emotional switching cost (the Memory Book).** The fund isn't a balance, it's
   the archive of everyone who showed up — un-ACAT-able. You don't liquidate your
   grandfather's notes. Cashing out means abandoning the relationship record.
3. **Continuity, not a cliff.** The handoff isn't "here's your money, bye." It's a
   graduation *into* their adult financial home — the same account becomes their
   adult investing/banking account, so utility + inertia carry them. At 18 they
   receive their financial life, not a windfall to spend.
4. **Pre-18 ownership.** The more it was *theirs* as a kid (Kid View, watching it
   grow, the people, choosing within it), the more they keep it — engagement-as-
   ownership, via relationship and competence, never dopamine or gamification.

Plus the **loop-seed**: at handoff they become a gifter for the next kid ("start
one for someone you love"), deepening their identity inside the system and seeding
the next generation.

**The leading indicator you CAN measure before any cohort turns 18:** *do kids
engage with and feel ownership of the fund pre-handoff?* Pre-18 ownership is the
measurable proxy for post-18 retention — instrument it now, because it's the
earliest read you'll get on the single number the $1B case depends on.
