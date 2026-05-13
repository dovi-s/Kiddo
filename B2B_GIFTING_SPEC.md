# B2B Corporate Gifting — Spec

> Status: **Strategy doc, 2026-05-13.** Same shape as the other
> spec docs. **No code in this commit** — this is a different
> product line with different acquisition, different sales motion,
> and a real corp-dev investment to validate. Documented for
> when the trigger fires.
>
> Companion docs: `KIDDO_ADULT_TIER_SPEC.md`,
> `CASH_FLOAT_REVENUE_NOTE.md`, `P2P_STOCK_SETTLE_SPEC.md`.

---

## TL;DR

Companies regularly give cash gifts to employees and customers for
life events: new-baby welcome packages, bar/bat mitzvahs, corporate
charitable giving programs. Cash. The exact thing Kiddo's whole
thesis says doesn't work.

**B2B Gifting is a separate product line where Kiddo sells a
batch-gifting tool to HR / events / marketing teams.** A company
deposits $50k, generates 100 Kiddo links worth $500 each, and gives
them to employees having babies. Each recipient lands on a real
Kiddo flow and either claims into a new account or routes the gift
to an existing kid's fund.

The economics are very different from B2C:
- ARPA (average revenue per account) is 10–50x higher
- Acquisition is sales-led, not viral
- Each contract is a multi-year relationship
- A single Fortune 500 program could be a meaningful share of total revenue

The risk is brand: Kiddo's whole appeal is intimate-family. Going B2B
without losing that requires careful packaging.

---

## The thesis

Three signals say there's a real market:

**1. Companies already do this in worse forms.**
- New-parent welcome boxes (cash check, Amazon gift card, branded baby blanket)
- Some big tech companies give $1k savings bonds at child birth
- HR programs explicitly include "milestone gifts" budget lines
- Bar/bat mitzvah corporate gifts are common in certain industries

These are real budgets. The question is whether "Kiddo instead of
a $500 Amazon card" is a swap they'd make.

**2. The pitch is unusually clean.**
- "Your $500 gift to a new employee's kid becomes $X by their 18th
  birthday."
- "Your employees see Kiddo's app every month for 18 years with
  your company's name attached."
- "Tax-advantaged for the recipient. Marketing impressions for you."

The compounding math + the multi-decade brand impression is a
unique pitch. Greenlight / Acorns don't have this angle.

**3. Adjacent products already do this and charge.**
- Goldbely / corporate gifting platforms charge 15–25% markup
- Tremendous (the gift-card aggregator) charges 5–10%
- Bonusly / Awardco for employee recognition: monthly SaaS + per-redemption fees

The pattern is established. The price points are accepted.

---

## What the product looks like

### Three deliverables

**1. Corporate admin dashboard**
- Single sign-on with company SSO (Okta, Google Workspace)
- Bulk gift creation: upload a CSV of recipient names + emails +
  amounts, get back a batch of personalized Kiddo links
- Spend tracking against budget
- Per-employee gift history (for tax / 1099 / HR records)
- Branded landing pages (recipient sees "[Your Company] congratulates
  Sarah and Mike on baby Emma" before they hit the Kiddo flow)

**2. Recipient experience**
- Identical to the existing gifter→parent flow, with one extra step
- New-baby case: "Open a Kiddo fund for Emma. Or if you already have one,
  add the gift to it." Same shape as the existing /claim/:token route.
- Bar/bat mitzvah case: routes to existing parent's fund if known,
  otherwise the recipient creates one.
- The recipient never sees the corporate admin dashboard. Pure consumer
  experience with a small "Gift from [Company]" badge.

**3. Invoicing / payment**
- Companies want NET-30 / NET-60 invoicing, not credit card per gift.
- ACH only at this volume.
- Annual contracts with quarterly billing OR monthly true-up.
- Stripe Billing or a contract-based system (TBD which depending on scale).

### Three personas

The buying motion differs by who's writing the check:

| Persona | Use case | Budget shape |
|---|---|---|
| **HR / People Ops** | New-baby gifts, bar/bat mitzvah gifts for employees' kids, milestone recognition | Recurring annual budget, $50–500 per gift, 10–500 gifts/year |
| **Corporate marketing / events** | Customer appreciation, conference giveaways, sponsorship gifts | Campaign-based, $100–1000 per gift, batch of 100–1000 |
| **Foundation / CSR** | Charitable gifts to disadvantaged kids' funds, scholarship complements | Annual program, $500–5000 per gift, smaller volume but higher per-gift |

The simplest first-product targets HR for new-baby gifts. Reasons:
- Discrete budget owner with clear pain (current solutions are bad)
- Annual recurring revenue, not one-off
- Per-recipient value is high (the new parent is your employee — high
  baseline goodwill)
- The recipient flow IS Kiddo's existing core flow with minor branding

---

## Pricing model

Three options, each with trade-offs:

### Option A: Markup on gift value

Charge the company **10% on top of the gift face value.** Company
pays $550 → recipient gets $500 → Kiddo keeps $50.

Pros:
- Aligned with industry standard (Tremendous, etc.)
- Scales naturally with gift size
- Predictable margin

Cons:
- Recipient gets less than the company "spent" (a fairness gap)
- Hard to bundle features into the price (it's a flat percentage)

### Option B: SaaS subscription + zero markup on gifts

Charge the company **$X/month or $Y/year for the platform.**
$500 gift = $500 to recipient. Subscription covers the dashboard,
support, branding, etc.

Pros:
- Recipient gets full gift value (matches Kiddo's "gift stays whole"
  principle)
- Predictable revenue independent of gift volume
- Easier to upsell premium features

Cons:
- High-volume companies dilute the SaaS fee
- Harder to capture economics at small companies

### Option C: Hybrid (the recommended path)

**Base SaaS: $999/mo or $9,999/yr** for the platform, includes 100
gifts per year. Each additional gift: **$5 fee** plus standard
Kiddo gifter processing (Stripe). No markup on gift face value
(matches the locked "gift stays whole" principle).

Pros:
- Both predictable base + volume scaling
- Respects the gift-stays-whole principle
- Enterprise pricing motion (everyone expects SaaS + usage)
- Per-gift fee is small enough to be palatable

Cons:
- More complex to communicate
- Requires real billing infrastructure

**Recommended starting price: Hybrid (Option C).** Industry norm
+ respects Kiddo's principles + has clear upgrade ladder.

---

## What this would mean for Kiddo's revenue

Rough math at three scales:

| State | Customers | Gifts/yr | Annual revenue |
|---|---|---|---|
| Pilot | 5 mid-market HR programs | ~2,500 | ~$60k base + $12.5k usage = $72.5k |
| Early traction | 50 customers (mostly mid-market) | ~25,000 | $500k base + $125k usage = $625k |
| Scale | 500 customers, mix of mid + enterprise | ~250,000 | $5M base + $1.25M usage = $6.25M |

At "early traction" scale, B2B revenue could exceed total B2C
subscription revenue at Kiddo's current scale. The economics are
real if the sales motion works.

---

## What stays the same vs. what's new

**Stays the same:**
- The recipient flow (existing /claim, /gift/success, fund creation)
- The Memory Book mechanics
- The investment pipeline
- The tier discipline on B2C (B2B doesn't change Plus / Family / Adult)
- The "gift stays whole" principle

**What's new:**
- Corporate admin dashboard (separate frontend surface — could be a
  subdomain `business.kiddofund.com`)
- Batch gift API + CSV import
- SSO integration
- NET-30/60 invoicing infrastructure
- B2B contract and legal framework
- Sales motion: founder-led at first, then dedicated sales hire
- Customer success function for enterprise accounts

This is a **separate product line**, not a feature. Treat it
accordingly: separate roadmap, separate metrics, separate budget.

---

## Risks

### 1. Brand dilution

Kiddo's edge is intimate-family. Going B2B without losing that
requires:
- Recipient flow stays consumer-clean — no "powered by enterprise
  HR platform" badging
- The Kiddo logo stays primary; the company logo is a secondary
  acknowledgment, not a co-brand
- Corporate admin dashboard is on a separate subdomain so consumer
  users never see it
- No B2B-specific features bleed into B2C pricing or UX

### 2. Sales motion mismatch

Kiddo today is product-led, viral, consumer. B2B requires:
- Outbound sales (cold email, LinkedIn, conferences)
- Long sales cycles (3–12 months for enterprise)
- Contracts and procurement
- Dedicated customer success

These are different skill sets. Hiring this team is a separate
question from building the product.

### 3. Compliance and tax complexity

A company giving an employee $500 in stock for their kid has tax
implications:
- Is it a taxable benefit to the employee? (Probably yes, above
  certain thresholds.)
- Is it a deductible business expense for the company? (Yes, usually.)
- Does Kiddo issue 1099s to recipients? (Need to figure out.)
- State-by-state UTMA / minor-account rules apply same as B2C.

This is workable but requires a real tax/legal pass before launching.

### 4. The "stock to a stranger" trust problem

Cash gifts from a company to an employee feel normal. Stock gifts
might feel weird — "my employer gave me $500 of Tesla for my baby?"
The packaging matters: the company picks the gift amount, the
RECIPIENT picks the investment direction (or accepts the default
Kiddo strategy). The company isn't endorsing Tesla, just funding
the gift.

---

## Build order if we ship

**Phase 1 (pilot, ~3–6 months):**
- Manual corporate admin (a spreadsheet + a Kiddo employee
  creating gift links in batch)
- 3–5 pilot customers chosen for fit (mid-market with active
  new-baby programs)
- Track conversion rate, recipient satisfaction, repeat-gift rate
- Goal: validate the thesis before building real infrastructure

**Phase 2 (real product, ~6–12 months after pilot):**
- Build the corporate admin dashboard
- SSO integration
- Invoicing
- Public landing page at `kiddofund.com/business`

**Phase 3 (scale, ~18+ months):**
- Self-serve signup for small companies
- API for integration with existing HR platforms (Workday, BambooHR)
- Public partnerships with insurance / benefits brokers

---

## What would have to be true to start

Two preconditions:

1. **At least one signal that this market exists.** A handful of
   inbound asks from HR teams, or a successful test campaign on
   LinkedIn aimed at HR leaders, or a partnership conversation
   with a benefits broker.
2. **B2C is healthy enough that a separate workstream doesn't
   starve it.** Don't build B2B at the cost of B2C health. Wait
   for at least 10k active funds before opening this lane.

Neither is true at launch. This is a year-2+ product line.

---

## When to come back to this spec

Four triggers:

1. **Inbound asks from HR teams or benefits brokers.** Probably the
   first signal. Track in a "B2B interest" pipeline.
2. **A competitor (Acorns Early, Greenlight, etc.) launches B2B
   gifting.** Don't be the only one without it if the market validates.
3. **Kiddo crosses 10k active funds.** B2C is healthy enough to
   support a second workstream.
4. **A founder-led pilot succeeds.** Maybe just one ambitious test
   with a friendly mid-market HR team. If recipient experience is
   good and the company wants to renew, the thesis is validated.

Until then: refuse the temptation to build it. Spec stays warm.

---

## References

- Internal: `PRODUCT.md` — locked principles this spec respects
  (gift stays whole; calm brand; no junk-drawer tiers)
- Internal: `KIDDO_ADULT_TIER_SPEC.md` — Adult tier doesn't change
  if B2B ships; recipient kids of corporate gifts grow up the same way
- External: [Tremendous](https://www.tremendous.com/) — pricing model
  reference for digital gifting
- External: [Bonusly](https://bonus.ly/) — employee recognition SaaS
  pricing reference
- External: [Awardco](https://www.award.co/) — competitive corporate
  gifting platform
