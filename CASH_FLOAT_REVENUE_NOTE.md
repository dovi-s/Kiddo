# Cash Float Revenue — A Note, Not A Spec

> Status: **Documentation only**, 2026-05-13. This isn't a build task
> — it's a contract question and a math exercise. The action item is
> "ask DriveWealth what their interest-spread terms are." This doc
> exists so the conversation goes well and the decision is made on
> numbers, not gut feel.
>
> Companion docs: `KIDDO_ADULT_TIER_SPEC.md`, `B2B_GIFTING_SPEC.md`,
> `P2P_STOCK_SETTLE_SPEC.md`.

---

## TL;DR

Every brokerage in the world makes revenue on the cash sitting in
customer accounts before it gets invested. Kiddo has two cash sleeves
(`fund.cashBalance` from sold positions, `fund.pendingBalance` from
in-flight gifts) and currently captures **zero** of that interest. At
the partnership level, this is potentially **the biggest single
revenue lift in the product** that requires no UX changes and no
new features.

The question isn't "should we build this" — it's "what does our
DriveWealth contract let us keep, and is the disclosure clean enough
that we'd ship it."

---

## Why this matters

Compare what consumer brokerages disclose:

| Broker | Cash interest revenue model |
|---|---|
| **Acorns** | Keeps the spread on idle cash. Roughly $10–15/account/year per public estimates. Roughly equal to subscription revenue at their scale. |
| **Robinhood** | "Cash sweep" program. Pays customers ~4–5% on uninvested cash; earns ~5–6% by parking it at partner banks. Spread is the revenue. Multi-hundred-million-dollar line item. |
| **Wealthfront** | "Cash Account" pays customer ~5%. Earns the bank-partner spread on top of that. |
| **SoFi** | High-yield savings + brokerage cash sweep. Net interest margin is one of SoFi's three biggest revenue lines. |
| **Schwab** | Famously runs on cash-sweep revenue. The trading commissions everyone celebrated cutting? Cash sweep replaced it. |

**Kiddo today:** unknown what DriveWealth does with cash balances on
its behalf. If DriveWealth keeps 100%, Kiddo gets nothing. If
DriveWealth passes through to customer, Kiddo gets nothing AND
customers see interest (which is actually a customer-acquisition
win, not a loss). If there's a rev-split, Kiddo's leaving money on
the table by not surfacing it as a revenue line.

---

## The math at three scales

Assumptions: average cash sleeve per fund of $400 (mix of in-flight
gifts, post-sale settling cash, idle cash before invest). Fed funds
rate ~4.5%. Bank-partner sweep spread ~4–5%.

| Funds | Aggregate cash float | Annual interest @ 4.5% | If Kiddo keeps 50% spread |
|---|---|---|---|
| 1,000 | $400k | $18k | $9k |
| 10,000 | $4M | $180k | $90k |
| 100,000 | $40M | $1.8M | $900k |
| 1,000,000 | $400M | $18M | $9M |

For context: Kiddo Family at $6.99/mo × 100k subscribers = $8.4M/yr.
The cash-float line at 100k funds could be **equal to subscription
revenue at half the rev-split**, with zero customer-acquisition cost.

This is why every brokerage builds this. It's not extra; it's structural.

---

## What to ask DriveWealth

Five questions, in priority order:

### 1. What is the current treatment of idle cash in Kiddo customer accounts?

Three possibilities:

- **Pass-through to customer.** DriveWealth pays the customer X%
  on cash. Kiddo earns nothing on the spread. Customer-friendly;
  zero revenue lift.
- **Held by DriveWealth, no pass-through.** DriveWealth keeps the
  interest, customer earns 0%. Kiddo earns nothing. Customers also
  earn nothing — meaningfully worse than Robinhood or Wealthfront.
- **Bank-sweep program.** Cash is moved to partner banks earning
  market rate; DriveWealth and Kiddo split the spread above what's
  paid to the customer.

The third path is the industry default for brokerages like Kiddo.
If we're not on it, we should be.

### 2. If we move to a bank-sweep program, what's the rev-split?

DriveWealth's standard terms are confidential, but partner-broker
splits are typically **50/50 to 80/20 in DriveWealth's favor**
on the spread, depending on volume and contract negotiation. At
Kiddo's expected scale, ask for the better end.

### 3. What's FDIC coverage look like?

Sweep programs typically funnel cash across multiple partner banks
to push aggregate coverage well past the $250k/account FDIC limit
(often $1M+ across 4-5 partner banks). Important for Kiddo's
brand because **a kid's money being FDIC-insured is a marketable
trust signal**.

### 4. What rate would we pay customers?

The disclosure principle: if Kiddo earns spread, customers should
also earn meaningful interest. The Wealthfront / Robinhood standard
is to pay customers within 50–100bps of the prevailing fed funds
rate. If we paid customers 4% on cash and earned 50bps spread to
Kiddo, the numbers are:

- $40M float × 0.5% = **$200k/yr to Kiddo**
- $40M float × 4% = $1.6M/yr to customers (genuine value, not
  just optics)

This is a much better story than "Kiddo keeps 4.5%, customers
earn 0%" — and it's the only one that survives consumer-friendly
press scrutiny.

### 5. Can we differentiate parent vs kid-owner accounts in the program?

Edge case worth knowing: kid-owner accounts (post-handoff, Personal
type) are legally separate from custodial UTMA accounts. The sweep
program might need separate enrollment per type. Not a blocker; a
contract detail.

---

## The disclosure problem

If Kiddo earns interest on customer cash, **users have to be told.**
Three ways to do it:

### Option A: silent (don't do this)

Just earn the spread, never mention it. This is what most brokers
historically did before regulatory pressure. Today: **bad idea.**
The kid-money-trust positioning means any "Kiddo earns money you
don't see" revelation would be a brand-event-level problem.

### Option B: visible APY (the Wealthfront pattern)

Surface "Your cash earns X.X% APY" as a feature in the Settings →
Money tab. Frame it as a Kiddo benefit. Implicitly acknowledges
Kiddo earns something on the spread; no need to disclose the split
because the customer is getting a fair rate.

This is the **right path.** Both honest and marketable.

### Option C: full disclosure (the Public.com pattern)

"Cash earns X% APY. Kiddo earns up to Y% spread on bank-sweep
partners. See [link] for details." Maximally honest, slightly
worse for marketing.

Probably overkill for the kid-money market unless we want to make
"radical transparency" a brand pillar.

---

## What this would look like in code

If we ship it, the build is small:

| Touch point | Change |
|---|---|
| Settings → Money | New "Cash" card showing current APY + the running interest earned this year |
| Dashboard hero | Optional small badge: "Earning 4.2% APY on cash" — only when cash sleeve is meaningful |
| Email | One-time announcement when the program launches |
| Marketing site | New row on the comparison table: "Your cash earns interest" |
| Settings → Tax | Mention that cash interest shows up on 1099-INT (separate form from 1099-DIV/B). Add to `TaxDocsExplainer.tsx` once relevant |

No new database tables. No new endpoints (the interest accrues at
DriveWealth, surfaces in fund balance updates we already poll for).

---

## Decision criteria

We should ship this when **all three** are true:

1. DriveWealth confirms a bank-sweep program is available (or
   already exists transparently)
2. Customer-paid APY is at least 3% (below that, the feature is
   embarrassing not aspirational)
3. The Settings → Money UI is mature enough to surface this calmly
   (currently true)

If all three: this is one of the highest-leverage shippable
features in the product. The math at 10k+ funds is meaningful.

---

## Decision criteria, the cynical version

If DriveWealth's terms turn out to be customer-friendly to a fault
(pass-through to customer, no rev split to Kiddo), don't fight it.
Customers earning real interest on cash is **good Kiddo retention**
even when Kiddo doesn't capture it directly. The marketing win
("your cash works while it's not invested") is real.

In that case, the lever isn't cash-float revenue; it's the
disclosure of cash-float APY as a competitive differentiator
that drives subscription / AUM growth indirectly.

---

## When to come back to this note

Three triggers:

1. **After the next DriveWealth contract conversation.** Most likely
   moment to surface these questions. Bring this doc.
2. **When Kiddo crosses 10k funded accounts.** At that scale the
   numbers start to matter for the P&L.
3. **If a competitor (Acorns Early, Greenlight, etc.) launches a
   visible cash-APY feature.** Don't be the only one without it.

---

## References

- External: [DriveWealth partnership docs](https://drivewealth.com/) — what the broker offers partners by default
- External: [Wealthfront Cash Account disclosure](https://www.wealthfront.com/cash) — gold-standard transparency
- External: [Robinhood Gold cash management](https://robinhood.com/us/en/support/articles/) — pattern for tiered cash rates
- Internal: `KIDDO_ADULT_TIER_SPEC.md` — cash interest is more meaningful for adult accounts than custodial (adults hold more cash, hold it longer)
- Internal: `client/src/pages/TaxDocsExplainer.tsx` — once cash interest is paid, the 1099-INT discussion goes here
