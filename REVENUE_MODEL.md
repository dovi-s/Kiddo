# Kiddo — Revenue & Pricing Model (canonical, 2026)

> Created 2026-05-26. The committed revenue/pricing model + future + growth
> levers + low-hanging fruit. Completes the strategy trio with
> `ARCHITECTURE_2026.md` (how it's built + legal) and `GTM.md` (how it grows).
>
> **Supersedes `REVENUE_MODEL_CURRENT_STATE.md`,** which is stale: it lists
> gifter contribution fees ($2 flat / 1% over $200) and a large-gift fee that
> are all **retired** — those constants are `0` in `shared/monetization.ts`,
> and **gifters never pay.** It also uses pre-pricing-v3 prices and the old
> "Kado" name. The current truth is below.

---

## First principle: it's a STACK, not a fee

EarlyBird relied on a single ~$5/mo sub and died at $480K ARR. **No single
stream is big enough early.** Survival = stacking brand-safe streams now while
the real prize (kid-2.0 LTV) is years out. Stop asking "what's the price" and
ask "what's the stack."

---

## Current model (verified against `shared/monetization.ts` + the pricing-v3 lock)

- **Subscriptions:** Free / **Plus $3.99/mo or $29/yr** / **Family $6.99/mo or
  $59/yr** / **Founding $19/yr lifetime** (cap 1,000). Plus gates parent
  features (recurring, custom mix, co-parent, parent-authored media); Family =
  Plus across all kids in the household.
- **Gifters NEVER pay.** The old "$2 flat / 1% over $200 / 0.1% large-gift"
  fees are **retired** (`KORA_FREE_GIFT_FEE`, `KORA_FREE_VARIABLE_RATE`,
  `KORA_LARGE_GIFT_*` all `0`). Kid View is free. Viewing is never gated;
  authoring is the Plus differential.
- **AUM 0.10%** — the **post-handoff** mechanism (bimodal model: subscription
  for the parent-custodian pre-majority, AUM for the kid-owner post-majority).
- **Stripe-first** for gift checkout, subscriptions, and billing portal.

---

## Pricing model — and the brutal truths

1. **You're at EarlyBird's exact price band — the one that died.** Pricing is
   *not* your lever. Don't race lower (Target, not Walmart), and don't expect a
   few dollars more to fix unit economics. CAC + the stack + LTV fix it.
2. **The RIA fork rewrites the AUM fee** (see `ARCHITECTURE_2026.md`). Go
   self-directed to avoid RIA → you likely **drop the 0.10% AUM advisory fee**
   and lean on sub + float + sponsorship + B2B2C. Register as an RIA → keep it.
   This is the single pricing decision that matters; it's the lawyer call.
3. **Willingness-to-pay is unproven; founding members are the test.** The $19/yr
   take-rate is your cleanest pre-launch signal — watch it.

---

## The revenue stack (forward) — honest sizing

| Stream | Near-term | At scale | Notes |
|---|---|---|---|
| **Parent subscription** | small | moderate | The base. Necessary, insufficient (EarlyBird's proof). |
| **Cash-float interest** | small | thin | Interest on uninvested gift cash (Alpaca pays ~3.6%). **PINNED STANCE: shared-yield only — the yield accrues to the CHILD, disclosed, with at most a thin disclosed spread to Kiddo. NEVER silently pocketed (that's taxing a kid's money = the trust-moat killer, see the Cash App "don't tax the accumulation" rule).** Thin regardless: the whole point is gifts get *invested*, so little cash sits idle. FDIC pass-through, NOT SIPC → counsel must bless any "earns/insured" copy. Gated on custody. |
| **Gifter-sponsors-Plus** | small | moderate | The *only* brand-safe way to monetize gifters — they buy a sub, not pay a toll. Already built. |
| **B2B2C** | the real near-term scaler | could exceed B2C | One employer = hundreds of parents at ~zero CAC + high ACV. See `B2B_GIFTING_SPEC.md`. |
| **AUM 0.10%** (conditional on RIA) | ≈ $0 | compounds for decades | ~$5/yr on a $5k fund. A scale/future asset, not a near-term lever. |
| **18-handoff keepsake** (premium Memory Book print/binding) | — | the emotional-climax upsell | The one moment families pay real money. The future "Legacy" tier. |
| **Kid-2.0 funnel** (Roth → banking → P2P → interchange) | — | the whole thesis | The 40-year LTV that makes you worth more than EarlyBird's $5/mo. |

**Honest near-term reality:** B2B2C + founding members + sponsorship are your
real early dollars; sub + float are thin; AUM ≈ $0; kid-2.0 is deferred. Don't
let "we also have AUM + kid-2.0" comfort you about *near-term* economics.

---

## The future (where real money comes from at scale)

The thesis isn't "more subs." It's the **kid-2.0 funnel**: the 18-handoff routes
the now-adult into Roth → banking → adult brokerage → P2P. That's Greenlight-style
**interchange + a 40-year relationship + eventually their own kids' funds** — the
only LTV story that beats EarlyBird's few-years-of-$5/mo. Plus **AUM compounding**
as funds mature and multiply, and **B2B2C scaling** past B2C. All deferred; all
the reason you're not just a prettier EarlyBird.

---

## Growth levers (ranked by leverage)

1. **Gifter→parent conversion rate** — the loop's k-factor. 0.5%→2% quadruples
   organic growth at *zero* CAC. The #1 lever. (Instrumented: `gaveToOthersFundBefore`.)
2. **B2B2C deals** — step-function: each = hundreds of parents, near-zero CAC.
3. **Free→paid conversion** — turns the free base into revenue. (Instrumented:
   `plan_purchased`.)
4. **Recurring adoption** (parent contributions + recurring gifters) — compounds
   AUM + retention.
5. **Gifter-sponsors-Plus attach rate** — monetizes the gifter base, loop-safe.
6. **Multi-kid / Family expansion** — more funds per household.
7. **Float optimization** — passive revenue scaling with assets.

---

## Low-hanging fruit (cheap, high-ROI, do-now)

- **EarlyBird-orphan capture + `/earlybird-alternative` page** — warm, urgent,
  ~free. Highest-ROI thing this week. (See `GTM.md`.)
- **Sharpen the post-gift "start one for yours" moment** — tiny UX, massive
  leverage on lever #1 (the visceral "$50 → $X at 18" pitch).
- **Surface gifter-sponsors-Plus harder** — already built; push it.
- **Turn on cash float the day custody is live** — but as **shared-yield to the kid** (disclosed), never silently pocketed; thin anyway (money's invested, not idle). See the stack-table note.
- **One B2B2C manual pilot** — one yes validates the whole CAC escape.
- **Founding-members push** — willingness-to-pay proof + pre-launch capital +
  advocates in one.
- **15-minute delayed data** — a cost cut is effective revenue; on-brand.
- **Recurring-gift restoration** (already scoped) — drives AUM + retention.

---

## The synthesis (what to actually do)

Don't fiddle pricing — it's not the lever, and it's locked sensibly. Don't chase
the AUM fee if it triggers RIA — decide that consciously with the lawyer. **Pour
energy into the two levers that move the model: gifter→parent conversion (sharpen
the loop UX, measure weekly) and one B2B2C yes.** Stack the brand-safe streams
(sub + float + sponsorship) underneath, and keep the kid-2.0 funnel as the north
star that justifies the whole thing existing. The pricing is fine; the **stack
and the loop** are the company.

---

## 2026-06-15 crystallization — the reframe, the rule, the launch config, the test

*Added after a deep competitor + monetization working session (see
`COMPETITIVE_LANDSCAPE.md` for the verified facts: Stockpile died of fee-erosion +
being the BD + no moat; Endowe is a $300-AUM one-person RIA shell; Acorns is the real
convergent threat; Stash gates kids' custodial behind $12/mo). This section doesn't
replace the stack above. It sharpens the spine and confirms the launch config.*

**The reframe (the unlock): Kiddo is not a brokerage, it's the emotional-commerce
company for a child's financial life — a Babylist that recurs for 18 years instead of
one wedding day.** Brokerages monetize basis points on balances, which is exactly why
the category is broke at the kid stage. The wedding/baby industries monetize the
emotional *event* through commerce, sponsorship, keepsakes, and high-value adjacent
services, and let the transaction be near-free. You own an emotional event that fires
every birthday, holiday, and milestone for two decades. What users actually want
underneath all of it: **to turn love into something that lasts, and to not screw up
their kid's future.** Every dollar flows from serving that love and that fear.

**The spine (one sentence):** free where balances are small and trust is being built,
paid where balances are real and trust transfers, and **never charge the child's
balance.** The love is the product; the financial plumbing is the commodity you give
away.

**The constitution / forbidden list (this protects the moat, it is part of the model):**
no required subscription on small balances, no silent float (disclose it, ideally share
yield), no exit/transfer fees, no fractional-liquidation lock-in, no PFOF, no
gamification of a child's money, no selling children's data, no opt-out tip default.
Every one is a documented user grievance and a competitor's grave.

### Launch config (CONFIRMED — ship essentially what's already built)
- **Free** — one kid, fully functional: receives gifts whole, invests, basic Memory
  Book, the whole loop. Carries only the 0.10%.
- **Plus (paid, one kid)** — premium extras (recurring, custom mix, co-parent,
  parent-authored media, richer Memory Book).
- **Family (paid)** — Plus across all kids in the household.
- **0.10% AUM on ALL plans, including free.** Negligible in felt terms (~$1/yr on
  $1,000), honest, and even free funds carry the meter. Sub + tiny AUM is not resented
  double-dipping because the AUM is invisible and the sub buys distinct value
  (features + kids), never the right to invest.
- **Gifters never pay.** Gifting and investing are never gated. Optional honest gifter
  tip only (modest default, never opt-out-defaulted).

**The 3 conditions that keep this off the Stockpile/Stash side of the line:**
1. The free tier must be genuinely great, or "free" is a lie and you're a worse Stash.
2. Paid never gates the core (gifting + investing always free; paid = wants).
3. Lead with FREE, loudly. "Kiddo is free, the gift always lands whole" is the headline
   and the live foil vs Stash's $12/mo custodial gate.

### Revenue lines ranked by certainty (sharpening the stack table above)
1. **The lifetime customer (real engine, slow, certain).** Kid acquired at birth for
   ~$0, at 18 has no incumbent bank/advisor + 18 years of trust = zero switching cost.
   Interchange + advisory for decades. The kid-2.0 funnel. The only un-copyable line.
2. **Someone else pays (sturdiest near-term cash): sponsors + employers (B2B2C),** run
   as an auction for the emotional inventory. Family gets free money (most-wanted thing),
   brand pays the CAC. Start selling now; doesn't depend on consumer conversion.
3. **Emotional-commerce layer (new margin, testable immediately):** the "wrapping
   economy" (card/book/keepsake at the gift moment, Babylist-style affiliate margin);
   the **Memory Book as a premium bound artifact at 18** (the emotional-climax upsell,
   the "Legacy" tier); **tax/FAFSA relief** sold as the cure to a documented pain. None
   touch the balance.
4. **Active-want advisory (big IF real, UNPROVEN — do not bank on it):** NOT "convert
   grandma's nest egg" (most switching-resistant behavior in finance; I over-sold this).
   Instead answer the question the family is *already asking* — structured
   intergenerational transfer for the grandparent already trying to pass money down, and
   life insurance at the new-baby moment (the #1 insurance-buying trigger, large
   commissions, real want). Sells into an active want = converts far better than a cold
   AUM pitch. Personal Capital is the precedent AND the warning: it converted at low
   single digits with paid acquisition + human sales, not a zero-CAC elegant machine.
5. **The quiet meter:** 0.10% AUM + honest tip. Real only at scale.

### Deferred decisions and their triggers (earn them on data, don't guess)
- **0.25% AUM is NOT a standalone knob — it rides with the "become the family's advisor
  / own the RIA" decision** (the RIA fork already flagged above). Decide it AFTER
  funded-k, on real adult-conversion data. Until then, 0.10%. Don't raise it as a launch
  tweak (0.25% on a $500 account = $1.25/yr; you'd spend "lowest fee" for nothing).
- **Emotional-commerce + sponsor lines are cheap experiments the week the loop is live:**
  a $5 keepsake card in the gift flow (watch attach rate); one brand-sponsored match
  (watch gift lift). Build the winners.

### The one experiment that decides which company you are
The number that settles the identity fork (patient lifetime-LTV bet vs advisor-led
business that makes money in year two): **the rate at which any adult in the loop moves
REAL money to you** (their own managed account, a recurring plan, a larger contribution).
It does not exist yet. Instrument it into the loop from day one and measure it the moment
funded-k is real. >~2-3% to real balances → commit to the advisor model. <~0.5% → you're
the patient at-18 LTV business + sponsor revenue, and that's a fundraising decision.

**Open founder input (the one thing the model can't reason its way to):** is raising
capital on the table? That sets the runway for the patient path if the experiment
disappoints.

**Deck line:** Free for families, the gift always lands whole, and Kiddo earns from
everyone around the child and from the child once grown, by monetizing love made concrete
instead of basis points on a balance.

---

## 2026-06-16 refinement — the subscription, resurrected as gifter-funded

The earlier crystallization demoted the subscription. The sponsor-Plus stacking work
(`SPONSOR_PLUS_STACKING.md`) brings it back in a brand-safe form: the subscription is
**primarily gifter-funded**. A gifter sponsors the family's premium and it **stacks
forward indefinitely** (Grandma covers 2026, Aunt May 2027…), so a well-loved family
never touches the bill. This **converts the single most-hated mechanic — a recurring fee
on a kid's account (what killed Stockpile) — into a loved one** ("your premium is a gift
from Grandma"). Same dollars, opposite valence. It's the GoFundMe-tip model applied to
the subscription: voluntary, generous-moment, someone-other-than-the-family pays =
squarely accretive + a relationship surface.

So the subscription layer is now three tiers **by WHO pays**:
1. **Free core — everyone.** Universal, never hated; protects exactly the thinly-
   supported families a sponsor runway never reaches.
2. **Gifter-sponsored premium — the primary, on-thesis monetization.** Loved-and-
   supported kids; both revenue and a relationship moment.
3. **Family-paid premium — the quiet fallback** for the unsponsored who want extras.

Caveats: it only "goes forever" for kids with generous, plural gifters (hence the free
core must stay), and the runway is contingent on the next gifter choosing to stack (the
sponsor-naming renewal reminder re-prompts it). Run the HONEST version — no GoFundMe
opt-out dark pattern — because these are repeat relationship gifters; an extractive
default would poison the loop. Wave-2 build; the current non-stacking sponsor-Plus ships
fine for launch.
