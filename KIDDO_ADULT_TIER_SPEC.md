# Kiddo Adult Tier — Spec

> Status: **Strategy doc, 2026-05-13.** Same shape as
> `AGE_18_HANDOFF_SPEC.md` and `FACE_ID_SPEC.md`. Frames what
> "Kiddo at 22" looks like as a product and what would justify
> a $15–$25/mo price. **No code in this commit** — build trigger
> requires at least one differentiating feature to be real
> (tax-loss harvesting, Roth IRA, or RSU/ESPP integration).
>
> Companion docs: `CASH_FLOAT_REVENUE_NOTE.md`, `B2B_GIFTING_SPEC.md`,
> `P2P_STOCK_SETTLE_SPEC.md`.

---

## TL;DR

Today, the kid hits majority age (18 or 21), claims the fund, and
becomes a free Personal account customer paying $0/mo + 0.10% AUM.
Their highest-ARPU years are the years right after they take
ownership, and Kiddo has nothing tiered for them.

**Kiddo Adult would be a $15–$25/mo tier sold to kid-owners aged
18–35.** It composes with the existing $4.99 Plus / $7.99 Family
ladder rather than replacing it: parents stay on Plus/Family until
the kid is 18, the kid then has their own subscription decision to
make. The relationship that started at $0 (Free Kid View) becomes
$200+/yr at age 22.

The features that justify the price all share a structural property:
**they're things an adult brokerage would charge for AND that Kiddo
has a unique angle on because of the multi-year custodial history**.

---

## The strategic argument

Kiddo's premise is "the asset compounds AND the lesson sticks."
Today, the asset compounds for 18+ years. The lesson sticks for
60 minutes (the Age18Welcome walkthrough). After that, Kiddo goes
silent on subscription revenue and the kid is a low-ARPU
maintenance customer.

This is a missed retention story. The 18-year-old who just spent
the last 13 years watching the fund grow has more brand loyalty
to Kiddo than to any other financial product they've ever used.
They will at some point need:

- A first checking-style account or cash-management tool
- A Roth IRA the first time they have W-2 income
- Tax-loss harvesting once their account is large enough
- Help filing taxes for the first time
- A 401k rollover when they leave their first job
- A mortgage prep tool (5–10 years out)

If Kiddo is the calm trusted brand that taught them what taxes
were at 18, **Kiddo should be the brand they consider for each of
those moments.** Kiddo Adult is the surface that captures this.

The competing surface is "the kid migrates to Wealthfront /
Betterment / Fidelity / Charles Schwab the year they get a job."
Without Kiddo Adult, that migration is the default outcome.

---

## What the tier looks like

### Pricing

**$15.99/mo or $149/yr** (~22% annual discount, similar shape to
the existing Family tier's 28% annual discount).

Sits above Kiddo Family ($7.99). Frame as the natural graduation
ladder: kid grows up on Free Kid View → parent paid Plus or Family
→ kid takes ownership → kid graduates to Adult tier when they hit
real income.

Not bundled with anything. Standalone subscription. The 0.10% AUM
fee still applies (covers cost of execution, doesn't change).

### Five features that justify the price

The bar is: each feature should be something a competitor charges
for, AND something Kiddo has an angle on because of the custodial
history.

**1. Tax-loss harvesting**
- Wealthfront's flagship paid feature. Betterment requires premium.
- Kiddo angle: the custodial-era cost basis is already in our DB.
  The kid has tax lots going back 13 years. TLH can be more
  sophisticated than starting fresh.
- Implementation depth: DriveWealth has tax-lot APIs. Real but
  non-trivial.

**2. Roth IRA setup and contribution flow**
- Requires DriveWealth IRA integration (currently not wired —
  blocker per `AGE_18_HANDOFF_SPEC.md` bucket 3).
- Kiddo angle: the kid's earned-income toggle is already captured.
  The Age18Welcome walkthrough already pitched this. Logical
  funnel.
- Differentiation: "Roth IRA contributions auto-flow from your
  Kiddo fund's dividends" — using the kid's own custodial-era
  dividends to fund their adult Roth is a uniquely-Kiddo move.

**3. Tax filing helper (1099 → TurboTax handoff + summary doc)**
- The annual 1099 walkthrough page exists already (`TaxDocsExplainer.tsx`).
- Adult tier adds: pre-filled summary doc with realized gains,
  cost basis totals, dividend totals, broken out by short-term /
  long-term. Direct CSV export to TurboTax / FreeTaxUSA / Cash App
  Taxes / a CPA's portal.
- Free tier sees the raw 1099. Adult tier sees the "here's how to
  read this and where to plug it in" overlay.

**4. First-job equity (RSU / ESPP) integration**
- A kid hitting 22 with a tech job has RSUs vesting and ESPP
  contribution decisions. Kiddo can be the calm advisor here:
  "Your RSUs are concentrated risk. Here's how to think about
  selling on vest vs holding."
- Implementation: a simple "I have RSUs at [employer]" toggle + a
  monthly check-in. Doesn't need direct broker integration to be
  useful — the advice + planning math is the value.

**5. Real planning scenarios**
- Monte Carlo for "can I afford this apartment / car / grad
  school," tax-bracket optimization, mortgage prep math 5 years out.
- Implementation: lives on a separate `/plan` surface. Doesn't
  need broker integration — just math.
- Differentiation from competitors: Kiddo knows their full
  cost-basis history, so the math can be specific not generic
  ("if you sell $5k of GOOGL bought in 2018 vs $5k of GOOGL bought
  in 2024, here's the tax difference").

### What it does NOT include

To keep the tier defensible and not a junk drawer:

- **No options trading.** Brand-defining no. Kiddo is not Robinhood.
- **No crypto.** Same.
- **No leveraged products.** Same.
- **No "premium support."** Vague feature; refuse the line per
  the locked discipline.
- **No "early access to new features."** Also vague; refuse.
- **No "concierge onboarding."** Same shape as the Legacy bullet
  that got pulled. If real concierge is offered, it's a different
  product category.

Each "don't include" preserves the brand. Kiddo's edge over
Robinhood is calm-not-frenzied; over Acorns is real-not-gamified.
Adult tier has to feel like a continuation of that, not a pivot.

---

## How it composes with existing tiers

| Tier | User | Price | Job-to-be-done |
|---|---|---|---|
| Free | Parent + Kid | $0/mo | "I want to start a fund for my child. Gifts in, no monthly fee." |
| Kiddo+ | Parent | $4.99/mo per fund | "I want to add to my child's fund monthly + add my own letters + photos." |
| Kiddo Family | Parent (multi-kid) | $7.99/mo household | "Plus, but for all my kids." |
| **Kiddo Adult (new)** | **Kid-owner age 18+** | **$15.99/mo** | **"I'm the owner now. Help me make adult-money decisions."** |

The graduation moment is the Age-18 handoff. The Age18Welcome
walkthrough is the natural sales surface — screen 4 ("Got a job?
Roth IRA pitch") is one tap away from "Try Kiddo Adult free for
the first month."

### What happens to the parent's subscription at handoff?

Per the existing /complete endpoint (`server/routes.ts:5293`),
fund ownership flips to the kid; the parent's Plus or Family
subscription continues independently (or auto-cancels when their
last kid hits majority — depends on whether they have other kids).

Adult tier doesn't change this. Parents and kids are independent
customers post-handoff.

---

## What would have to be true to ship

Three preconditions. Skip any of these and the tier ships as a
vapor-tier with no defense:

### Precondition 1: At least one differentiating feature is real

The bar: a tier launch needs at least one feature in the launch
that COMPETITORS charge for and Kiddo currently doesn't have.

Strongest candidate: **Tax-loss harvesting**, because it's
mechanical (DriveWealth has the APIs), recognized as paid-feature
elsewhere (Wealthfront, Betterment), and Kiddo's multi-year
cost basis history is a real advantage.

### Precondition 2: DriveWealth IRA support is wired

The Roth pitch only works if there's a Roth product behind it.
Without IRA support, Adult tier is missing its highest-conversion
feature (the kid with their first job is the highest-conversion
moment).

This is a DriveWealth-side dependency; tracked in
`AGE_18_HANDOFF_SPEC.md` bucket 3.

### Precondition 3: At least 1,000 post-handoff kid-owners exist

The economics: at 1,000 kid-owners, even a 5% conversion rate
to Adult tier = 50 paying customers = $9.6k/yr. Below that,
the tier's not worth maintaining.

This implies Kiddo Adult is a year-2 or year-3 launch — kids
who claim their funds today are the first cohort, and there
need to be enough of them to make a tier worthwhile.

---

## Open questions

Documenting honest unknowns:

| Question | Why it matters |
|---|---|
| Should Adult tier subscribers see a different UI register, or the same as parents? | The kid grew up on Kiddo's calm visual register. Switching to a more adult/professional look might feel like abandoning the brand. Probably keep the same visual identity; just expose more features. |
| How long do we honor the parent's Plus/Family discount to a fresh kid-owner? | A kid whose parent paid Family for 10 years might deserve a "first year free" trial of Adult tier. Lifetime-customer-value calculation. |
| Do we offer a "Adult Couple" or "Adult Family" tier (the kid + their partner / spouse)? | Probably year 3+. The first version is single-customer Adult. |
| Joint accounts? | Same — year 3+. The first version assumes solo. |
| Does Kiddo offer banking / debit-card features at this tier? | Probably no. The brand is wealth, not banking. Pushes us toward SoFi territory. Refuse the line. |

---

## Build order if we decided to ship

1. **Wait for DriveWealth IRA support.** This is the gating factor.
   No spec-doc gymnastics changes this — it's a third-party feature.
2. **Spec tax-loss harvesting** as a sub-feature with its own design
   doc. The math is non-trivial.
3. **Ship Adult tier with TLH + IRA in the same launch.** Two
   features is better than one for justifying the price jump.
4. **Add RSU/ESPP toggle and planning scenarios in the next two
   quarters** as a "what's next" cadence so Adult tier subscribers
   see steady value.

---

## Pricing comparison to competitors

| Service | Tier | Price | What you get |
|---|---|---|---|
| Wealthfront | All-in | 0.25% AUM | TLH, planning, cash account |
| Betterment Premium | $X/mo + 0.40% AUM | Premium | TLH, advisor access, planning |
| Fidelity Go | 0.35% AUM (over $25k) | All-in | Managed portfolio |
| Robinhood Gold | $5/mo | Gold | Margin, instant deposit, research |
| Public Premium | $10/mo | Premium | Research, higher cash APY |
| **Kiddo Adult (proposed)** | **$15.99/mo + 0.10% AUM** | Adult | TLH, IRA, planning, custodial-era context |

The price point sits above Robinhood Gold (table-stakes premium)
but below Wealthfront's 0.25% AUM at $20k+ portfolios. The
0.10% AUM remains Kiddo's discipline (lowest in category) so
the subscription is the lever.

At $20k portfolio: Wealthfront = $50/yr. Kiddo Adult = $192/yr + $20 AUM = $212/yr. **Kiddo is more expensive** at that level. Justified ONLY if features genuinely differentiate.

At $100k portfolio: Wealthfront = $250/yr. Kiddo Adult = $292/yr.
Closer; still has to be earned by differentiation.

This price tension is real. The TLH + IRA combination has to be
genuinely sticky for the price to hold.

---

## When to come back to this spec

Three triggers:

1. **DriveWealth IRA support ships.** Single biggest blocker.
2. **The first wave of Dunphy-demo-era kid-owners hit 18 in real life.**
   The cohort exists, the tier has customers waiting.
3. **A competitor launches a similar adult-from-custodial tier.**
   Don't be the only one without it.

Until then: keep the spec warm. Don't ship a vapor-tier.

---

## References

- Internal: `AGE_18_HANDOFF_SPEC.md` — the upstream feature this
  composes with. Adult tier sells at the handoff moment.
- Internal: `CASH_FLOAT_REVENUE_NOTE.md` — adult accounts hold more
  cash and hold it longer; cash-float is more meaningful here.
- Internal: `PRODUCT.md` — the locked tier discipline that this
  spec respects (no vapor-features, no junk-drawer tiers).
- Internal: `feedback_structure_vs_behavior.md` — Adult tier is
  a case where the structure (separate tier, separate pricing) is
  warranted because the user, the use case, and the value prop are
  meaningfully different from parent-tier Kiddo.
