# Kiddo Secondaries — Pre-IPO + Alternative Investments

> Status: **Strategy doc, 2026-05-13.** Fifth in the revenue-spec
> set after `CASH_FLOAT_REVENUE_NOTE.md`, `KIDDO_ADULT_TIER_SPEC.md`,
> `B2B_GIFTING_SPEC.md`, `P2P_STOCK_SETTLE_SPEC.md`. Operates on a
> different axis from the others: alternative investments rather
> than public-market equity. **No code in this commit** — this is
> year-4+ territory with real preconditions.
>
> Includes a first-principles section challenging the accredited-
> investor assumption (raised in the audit conversation) rather
> than inheriting it.

---

## TL;DR

Forge Global, EquityZen, Hiive, and Carta X run secondary markets
for pre-IPO equity — they let employees of private companies (SpaceX,
Stripe, OpenAI, etc.) sell shares and let qualified investors buy.
3–5% transaction fees on both sides. Existing platforms target
sophisticated finance customers in Wall Street register.

**Kiddo could carve a unique angle** on the same inventory because
of four structural advantages: long-time-horizon framing, multi-
generational custodial wrappers, Memory Book context, and an existing
pipeline of customers who grew up on Kiddo and are now the right
demographic. These are real edges over Forge/EquityZen.

The default version of this product gates everything behind
accredited-investor status (the standard Reg D path) — which would
exclude ~90% of Kiddo's current customer base. **The first-principles
question is whether to inherit that gate or to challenge it.** Three
alternative regulatory paths exist; one is genuinely Kiddo-shaped.

This is year-4+ territory either way. The spec captures the strategic
thinking now so the decision gets made on the merits later.

---

## Sharpened take (2026-06-07)

Four corrections/sharpenings from a founder review + a quick legal check:

**1. UTMA holding private equity is LEGALLY FINE — open question resolved.**
A UTMA (unlike UGMA) explicitly allows a broad asset range — real estate, art,
**private company shares**. So "can the custodial wrapper hold private equity" is
a **yes**, not a blocker. **Crucial distinction:** that's the *holding* side. The
real regulatory question was always the *offering* side — how you legally **sell**
pre-IPO shares to non-accredited families (Reg A+ / Reg D). Holding ≠ offering;
the search resolves the first, the second still needs counsel. The practical
constraint on holding is **custodian infrastructure** — standard retail
brokerages can't custody private shares; you need a self-directed custodian /
trust company that supports alternative assets. (Reinforces #2.) Minor adjacent
items: gift-tax reporting (Form 709 over the annual exclusion), kiddie-tax on any
distributions, valuation/liquidity for the at-majority handoff.

**2. The wall is INVENTORY + CUSTODY, not regulation.** The hardest part isn't
the rules — it's (a) sourcing actual pre-IPO shares (Forge spent 10 years on
issuer relationships; we'd start cold) and (b) a custodian that can hold them. And
the cruel tension: the marquee names that make the story (SpaceX, Anthropic) trade
as accredited-only Reg D tenders at $25k+ — NOT the $50 mass-market gift the dream
needs. The "$50 slice of a marquee name for any kid" version sits at the
intersection of the two hardest constraints and barely exists today.

**3. Timeline: precondition-gated, NOT calendar-gated — and build speed is not the
gate.** Earlier "year 3-4" framing was wrong to read as a calendar/effort
estimate. We build fast; that is not the constraint. The gates are things code
can't accelerate: proving the loop (funded-k≥1 — the *market* decides, not the
keyboard), public custody live (external/regulatory), inventory relationships (BD
time), and — for the FULL Adult-tier product — customer scale (market). A **narrow
pilot** (one Reg A+ name, gift-card shape, inside the existing app) could come
much sooner than the full product: it's gated by custody-live + one issuer + the
offering-reg path, NOT by hitting 5,000 Adult-tier customers (precondition #1 is
for the full product, not a pilot). Discipline still holds: don't pursue any of it
before the core loop is proven — not because it takes years to build, but because
it would pull focus from the only thing that matters pre-PMF.

**4. Narrate now, build later.** The highest-ROI use of this idea *today* is as an
investor/mission narrative, not a build. "Democratized private-market access for a
generation" (Reg A+, non-accredited, the inequality angle: the rich capture the
10-100x private run before retail gets in) is a powerful, on-brand story that
sells the TAM with zero code. Tell it now; build it years out. Optionally start
narrating the "knowledge-based accreditation" regulatory position early — shapes
the rule in a Kiddo direction at no build cost.

**Certainty caveat.** None of the above is legal advice; the author is not a
lawyer. These blockers are a strategic map to verify with counsel + a custodian,
not settled fact — the UTMA-holding point is exactly a case where a 2-minute check
refined the assumption. Treat this spec as framing for the eventual counsel
conversation, not its conclusion.

---

## The standard model (what Forge does)

For context, here's the conventional secondary-market business
model that already exists:

| Mechanic | Detail |
|---|---|
| **Inventory** | Employee shares from tender offers, ESOPs, late-stage funding rounds. Companies like SpaceX, Stripe, OpenAI, Databricks. |
| **Customer gate** | Accredited investor only ($200k+ income, $1M+ net worth ex-primary-residence, or pro certifications). Reg D 506(b)/506(c). |
| **Per-trade economics** | 3–5% transaction fee from buyer, 3–5% from seller. Sometimes escrow fees on top. Total ~6–10% round-trip per transaction. |
| **Minimum sizes** | $25k–$100k+ per investment typically. Sometimes higher for hot names. |
| **Liquidity** | Highly illiquid. Tender offers happen quarterly to yearly. Buyers commit to multi-year holds. |
| **Information access** | Limited. Buyers see what the company chooses to share (often not much). Information asymmetry vs employees is a real risk. |

If Kiddo did exactly this and just added a Memory Book on top, it'd
be a small competitive improvement over Forge but wouldn't move the
revenue needle until Kiddo had a meaningful accredited-investor
customer base — which is a decade out from current scale.

---

## The four Kiddo-specific angles (any model)

Regardless of which regulatory path, four structural advantages
make Kiddo a better home for this than Forge or EquityZen are:

### 1. Long-time-horizon framing

Secondaries make economic sense as 5–10 year holds because of
lock-up periods + IPO timing + ROFR. Forge's typical customer is
a sophisticated investor balancing impatience ("when will this
exit?") with discipline. Kiddo's customer is structurally patient
— a parent buying shares for a 6-year-old has a 12-year horizon
built in. **The math that's painful for impatient customers is
calm for Kiddo's.**

### 2. Multi-generational custodial wrapper

A parent or grandparent buys pre-IPO SpaceX shares for an 8-year-old
in 2026. The shares lock up. SpaceX IPOs in 2029. By the time the
kid hits 18 in 2036, the position is liquid and has gone through a
public-market cycle. **No other platform has a custodial wrapper.**
Forge has no concept of "this asset will become the kid's at 18."

### 3. Memory Book context

"Grandma bought you 3 shares of SpaceX in 2026 because she believed
in the moon program." The asset becomes a story, not a line item.
Kiddo's Memory Book turns every gift into a chapter. Forge has no
equivalent.

For pre-IPO names that resonate culturally (SpaceX, OpenAI,
Anthropic, Stripe), this framing is uniquely powerful. The story
plus the asset is a 2x retention lever over either alone.

### 4. Pipeline from custodial era to accredited adult

Kids who grew up on Kiddo at 28–35 with significant net worth from
compounded gifts are exactly the demographic that Forge serves
today. Kiddo Adult tier subscribers (per `KIDDO_ADULT_TIER_SPEC.md`)
are pre-qualified to be Kiddo Secondaries customers. Acquisition
cost approaches zero for that funnel.

The five-year version of this: "the kid who learned investing on
Kiddo at 12, took ownership at 18, became Kiddo Adult at 22, hit
accredited status at 28, now wants pre-IPO exposure." That's a
20-year customer relationship — vs Forge's "I just signed up for
your platform" customer with no prior context.

---

## First principles: does it have to be accredited-only?

This is the question the user raised in the audit, and it's
worth taking seriously.

### What the accredited-investor rule actually is

The SEC's accredited-investor definition (Reg D 506):
- $200k+ individual income / $300k joint (last 2 years, expected this year)
- $1M+ net worth excluding primary residence
- Or holds Series 7/65/82 license (added 2020)
- Or is a "knowledgeable employee" of a private fund
- Or is a financial professional / family office

**The premise**: rich people can absorb losses; less-wealthy
people need protection from sophisticated investment products.

### Why the premise is increasingly contested

The 1980s-era assumption is showing cracks:

| Critique | Detail |
|---|---|
| **Wealth ≠ sophistication.** | A software engineer earning $400k might know less about private equity than a retail investor who's deeply researched. Income doesn't measure investment knowledge. |
| **$200k isn't what it was in 1982.** | The thresholds haven't been inflation-adjusted in 40+ years. By 2030 the income test could include the median two-earner household in major US metros. |
| **Inequality concern.** | Private companies do their full 10–100x run BEFORE going public (SpaceX, Stripe, etc.). The retail investor gets the post-IPO leftover. The accredited rule entrenches a wealth-creation asymmetry. |
| **Risk doesn't gate by wealth on other axes.** | A retail investor can lose everything on a SPAC, meme stock, or zero-DTE options. Why is private equity uniquely "protected"? |
| **Recent SEC reconsideration.** | The 2020 professional-certification carve-out (Series exams) implicitly admitted that knowledge, not wealth, is the right gate. More carve-outs likely coming. |

### Three regulatory paths Kiddo could play

The accredited path isn't the only one:

**Path A: Reg D 506 (the Forge path)**
- Accredited-only. The standard.
- Larger inventory (late-stage companies, tender offers).
- Higher minimums, higher per-trade fees.
- Excludes ~90% of Kiddo's current customer base.
- Cleanest legal path with the most existing infrastructure.

**Path B: Reg CF crowdfunding (the Republic / Wefunder path)**
- Non-accredited investors welcome.
- Per-company cap of $5M/year.
- Different inventory: early-stage startups, NOT late-stage SpaceX.
- Lower minimums ($100–$1,000), accessible to mass market.
- Strong fit for Kiddo's "gift small amounts of equity to a kid"
  premise.
- Real downside: early-stage startups have 90%+ failure rates.
  A kid getting equity in a startup that goes bust at age 14 is a
  brand-event-level UX problem.

**Path C: Reg A+ Tier 2 (the Republic Premium / StartEngine path)**
- Non-accredited investors welcome with caps (10% of income/net
  worth per offering).
- Up to $75M raise per offering.
- Mid-stage companies (between Reg CF early and Reg D late).
- Investor minimum often $100–$500.
- This is potentially the cleanest fit for Kiddo: real companies,
  real diligence (vs the early-stage Reg CF risk), accessible
  minimums, non-accredited welcome.

**Path D: Tokenized fractional ownership**
- Emerging space. Some platforms use blockchain to fractionalize
  pre-IPO equity into very small pieces.
- Regulatory framework is in flux. SEC has been cautious.
- High volatility in legal landscape.
- Not recommended as the first path; high regulatory risk.

### What this means for Kiddo

**The default (Path A) makes Kiddo into a slightly-better Forge
for the ~10% of households that already qualify.** Real revenue,
small TAM, doesn't move the brand.

**Path B or C makes Kiddo into something Forge can't be.** A
mass-market alternative-investments platform that lets a $50
grandma-gift become equity in a real growing company. The Memory
Book wraps the investment in a story. The custodial wrapper means
the asset has 18 years to develop.

The first-principles take: **Kiddo's structural fit is much
stronger with Path C (Reg A+) than with Path A (Reg D).** The
mass-market accessibility composes with Kiddo's existing customer
base; the accredited path leaves 90% of customers behind.

The reason most secondary platforms default to Path A isn't because
it's correct — it's because the existing finance industry was built
on it and the regulatory infrastructure is most mature there. Kiddo
arriving with a different customer base could legitimately choose
differently.

---

## Three product shapes worth considering

Each combines a regulatory path with a Kiddo-shaped use case:

### Shape 1: Pre-IPO gift cards (Reg A+)

"Give a kid 1 share of Anthropic for their birthday."

- Mid-stage private company with Reg A+ filing
- $50–$500 gift amounts
- Held in custodial form until majority age
- Memory Book entry: "Mom bought you 1 share of Anthropic
  in 2027. It was a $50 gift the year you turned 8."
- IPO event → kid's first taste of public-market gains 5–10 years later
- Kiddo earns transaction fee on each gift (1–3%)

**Why it works:** Familiar Kiddo wrapper, story-rich, accessible
price points, real fit for the "stock instead of cash" premise.
**Why it might not:** Reg A+ filings are expensive for issuers
(~$300k–$500k legal). Only certain companies will do them. Inventory
is constrained.

### Shape 2: Adult tier private exposure (Reg D)

"Kiddo Adult Premium: pre-IPO secondary market for accredited
investors."

- Reg D 506(c) accredited-only
- $25k+ per investment (industry standard)
- Buyers are Kiddo Adult tier subscribers who hit accredited
  status (years after taking ownership)
- Kiddo earns 3–5% transaction fee + premium-tier subscription
- Memory Book context optional but available

**Why it works:** Highest-margin per-trade revenue. Composes with
Adult tier. Real long-time-horizon fit.
**Why it might not:** Tiny TAM until Kiddo has lots of accredited
customers. Brand stretch (going Wall-Street-ish).

### Shape 3: Family equity portfolio (Reg A+ + Reg D hybrid)

"A diversified portfolio of pre-IPO companies, gift-able starting
at $100, available to all Kiddo customers."

- Pooled vehicle that holds a diversified basket of private
  companies (both Reg A+ inventory for retail, Reg D inventory
  pooled into the fund)
- One fund, professional management, automatic diversification
- Accessible to non-accredited via the fund wrapper
- Annual management fee (1–2%)

**Why it works:** Wealthfront-style "set-and-forget" simplicity
mapped onto private equity. Eliminates the per-company decision
fatigue. Diversifies away single-company failure risk.
**Why it might not:** Fund structure has significant regulatory
overhead. Real expense ratio. Returns less spectacular than picking
the right single name. Competition from existing private-equity
funds.

---

## Why it could fail (honest)

Six failure modes, in order of risk:

1. **Brand stretch breaks the calm register.** Kiddo today reads
   as "intimate family wealth." Adding pre-IPO equity could pull
   the brand toward "sophisticated finance" and lose what's working.
2. **Compliance overhead crushes margins.** Reg A+ filings, Reg D
   verification, qualified-purchaser tests, ROFR mechanics — the
   legal/ops cost is substantial.
3. **Inventory is hard to source.** Forge spent years building
   issuer relationships. Kiddo entering from cold gets the leftover
   inventory other platforms passed on.
4. **Single-company failure UX disaster.** A 12-year-old whose
   $500 grandma-gift in Pre-IPO XYZ becomes worth $0 because the
   company shut down is a real brand-event-level problem.
5. **Liquidity gap.** Kid hits 18 wanting cash; private equity
   takes 6–18 months to liquidate via tender. UX gap vs the
   public-stock part of the fund.
6. **The accredited-only path is too small to matter.** If Kiddo
   defaults to Path A, the addressable customer base is so small
   relative to total Kiddo customers that the build doesn't pay
   back the brand-stretch cost.

---

## Build preconditions

Four preconditions before any of this:

1. **Kiddo Adult tier is real and has at least 5,000 paying customers.**
   Without an existing premium-tier customer base, secondaries don't
   have a home. Per `KIDDO_ADULT_TIER_SPEC.md`, that's year 3+.
2. **A clear answer on regulatory path** (A, B, or C). Legal review
   before any product spec. The path determines everything downstream.
3. **At least one issuer relationship validated.** Even one
   pre-IPO name willing to sell into Kiddo's pipeline is enough to
   test the thesis. Sourcing inventory is half the battle.
4. **A real product hypothesis with clear acceptance criteria.**
   Don't ship "secondaries because Forge does it." Ship with a clear
   answer to "who buys this, why now, what story do we tell?"

---

## When to come back to this spec

Five triggers:

1. **Kiddo Adult tier ships and gets traction.** The premium tier
   is the home this product sits inside. Without it, there's no
   destination.
2. **The SEC expands the accredited-investor definition.** Watch
   for regulatory shifts that change which path is most attractive.
3. **A Reg A+ secondary platform shows the path works at scale.**
   StartEngine, Republic, or someone proves the mass-market thesis
   on private equity is real.
4. **A competitor enters the family-finance-meets-private-equity
   space.** Don't be third to market if the thesis validates.
5. **Inbound user requests for pre-IPO names from Kiddo customers
   become a real signal.** Currently zero; if it becomes meaningful,
   the demand is validating itself.

Until then: keep this spec warm. The first-principles question
matters more than the immediate revenue.

---

## Open questions

| Question | Why it matters |
|---|---|
| Does Kiddo lobby for a "knowledge-based" accreditation alternative? | Joining the regulatory conversation could shape the rule in a Kiddo-shaped direction. Long-term brand positioning move. |
| ~~Can the custodial wrapper hold private equity legally?~~ **RESOLVED 2026-06-07** | **Yes** — a UTMA allows private company shares (broader than UGMA). The live questions are the *offering* side (Reg A+/D, selling to non-accredited) + *custodian infrastructure* (a self-directed custodian, not a standard brokerage), NOT whether the account can hold it. See "Sharpened take." |
| What's the tax treatment of gifted pre-IPO shares vs cash that becomes pre-IPO shares? | Different gift-tax exposure, different basis tracking. Materially affects the product UX. |
| Does Kiddo serve as broker-dealer, or partner with one (like DriveWealth)? | Operational + regulatory question. Partnering is faster; owning the rail is higher-margin long-term. |
| For Reg A+ shape: which companies actually file Reg A+? | Inventory question. Some sectors (consumer brands, fintech, food) file more often than others (deep tech, biotech). |
| Brand: is this "Kiddo Secondaries" (sub-product) or "Kiddo Adult Pre-IPO" (Adult-tier premium feature)? | Affects acquisition story + how prominent this gets in the main app. |

---

## What this spec is honest about

Three things to call out so future sessions don't read this as
a build mandate:

1. **This is year-4+ at the earliest.** Not because it's hard, but
   because the customer base + Adult tier preconditions take time
   to build.
2. **The first-principles take (Path C is more Kiddo-shaped than
   Path A) is a recommendation, not consensus.** A legal review
   might land somewhere different.
3. **Inventory sourcing is the real bottleneck.** Even if regulatory
   path is solved and customer base is ready, getting actual pre-IPO
   shares to sell is the hardest part. Forge has 10 years of issuer
   relationships; Kiddo would be starting cold.

---

## References

- Internal: `KIDDO_ADULT_TIER_SPEC.md` — the premium tier this
  composes inside; secondaries are an Adult-tier+ feature, not a
  standalone product line.
- Internal: `P2P_STOCK_SETTLE_SPEC.md` — the other "extending the
  stock-as-cash insight" doc; secondaries are the inverse direction
  (premium private equity vs everyday peer payment).
- Internal: `CASH_FLOAT_REVENUE_NOTE.md` — the four-revenue-doc set
  this is the fifth member of.
- External: [Forge Global](https://forgeglobal.com/) — the standard
  Reg D secondary platform; competitor reference
- External: [Republic](https://republic.com/) — Reg CF + Reg A+
  platform; the mass-market alternative model
- External: [SEC accredited investor definition](https://www.sec.gov/education/capitalraising/building-blocks/accredited-investor) — the rule itself
- External: [Reg A+ overview](https://www.sec.gov/smallbusiness/exemptofferings/rega) — the path that might actually fit Kiddo
- External: [Hiive](https://www.hiive.com/), [EquityZen](https://equityzen.com/), [Carta X](https://carta.com/cartax) — competitive landscape
