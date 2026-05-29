# Lifecycle monetization — how Kiddo charges across the kid → adult arc

> Canonical answer to "the kid model is Free/Plus/Family, but what do we charge
> the *adult* who graduated, and what happens when that adult has their own kid?"
> Locked 2026-05-29. Resolves the apparent conflict between the kid-focused
> pricing ladder and the post-handoff adult account.

## The core idea: two independent revenue axes, not one ladder

Stop reading it as a single pricing ladder. There are **two revenue mechanisms**,
and they attach to **different things**:

1. **AUM — 0.10%/yr ($1 per $1,000 invested). Universal, asset-based.**
   Charged on *any* fund's invested balance, forever. Kid fund, adult fund,
   doesn't matter. This is the floor and the lifetime revenue.

2. **The subscription (Plus / Family). Relationship-based — a *custodian* product.**
   It exists for **a parent managing a minor's fund**. It bundles the things that
   only make sense in that relationship: recurring (+ gifters inheriting it = the
   growth loop), custom mix, co-parent, parent-authored Memory Book media, and
   multiple kids (Family). **It RETIRES at the age-of-majority handoff**, because
   the custodian relationship ends. (See `project_subscription_retires_at_majority`.)

**Recurring is monetized by whichever axis applies** — the custodian subscription
*before* handoff, and AUM *after*. That is the whole resolution.

## The rule that falls out: when does a fund "support recurring"?

> A fund supports recurring (for the owner AND its gifters) when EITHER:
> - it's a **paid custodial fund** (coverage `covered_starter` / `covered_family`
>   / `trial_active`), OR
> - it's a **self-directed post-handoff fund** (`funds.transferredAt` set).

Post-handoff, recurring is **free** — for the now-adult owner and for anyone
gifting to them — because **AUM already monetizes that balance**. Charging a
subscription to auto-invest into your own account would (a) contradict
subscription-retires-at-majority, (b) double-dip on top of AUM, and (c) suppress
the very recurring that grows the AUM. No brokerage charges a sub for a recurring
deposit into your own account.

Implemented in (all share this one rule):
- `server/routes.ts` dashboard-summary `recurringEnabled` (owner-scoped:
  `transferredAt && fund.userId === viewer`).
- `parent-contributions` GET + POST gates (owner-scoped).
- gifter-recurring POST gate + the public `recurringSupported` flag (fund-level:
  `transferredAt` — gifters aren't the owner, the *fund* supports it).

## The lifecycle (one person, over time)

A person occupies **roles**, and roles can overlap. Billing follows the role:

| Stage | Role | What they pay |
|-------|------|---------------|
| Gives to a kid's fund | **Gifter** | nothing, ever (inherits the fund's tier) |
| Opens/runs a kid's fund | **Parent / custodian** | Plus/Family (optional) for premium custodian features, **+ AUM** on the balance |
| Their kid hits majority | (handoff) | the parent's sub **retires** for that fund; AUM continues |
| Owns their graduated fund | **Adult owner (self-directed)** | **AUM only.** Recurring is free. No sub. |
| Has their own kid | **Parent again** | Plus/Family (optional) for *their* kid's custodial fund, **+ AUM** |

The same person can simultaneously own a free+AUM self-directed fund (their
inheritance) **and** pay Plus/Family for their kid's custodial fund. Two fund
types, two mechanisms, no conflict: the subscription covers the *custodial* funds
they manage; AUM runs on every balance, including their own.

## How you get an adult account: graduation ONLY (locked 2026-05-29)

A self-directed adult account exists **only** as a custodial fund that crossed
majority (`funds.transferredAt` set). **Kiddo does not offer direct adult
signup**, and shouldn't — a stand-alone adult brokerage competes with
Robinhood/Schwab/Fidelity where Kiddo has zero edge. Every Kiddo advantage (the
gifter loop, the relationship, the Memory Book, "for kids") lives in the
custodial/kid lifecycle. The adult account is the **tail of that lifecycle** — it
exists to *retain* the graduate (AUM + them becoming a parent), not to *acquire*
random adults. This is also the current code reality: there is no "open a
self-directed account for yourself" path; adult accounts only arise via the
handoff. **Do not wire a direct-adult-signup path.** Revisit only with a
deliberate strategic reason, and skeptically.

## The adult charge, answered directly

- **Do we charge the adult an upgrade for recurring?** No. Recurring on a
  self-directed account is free, monetized by AUM.
- **How do we charge the adult, then?** AUM on their balance, always. And they
  pay Plus/Family again only when they put the **parent hat** back on for their
  own kid. There is **no "individual-adult-Plus-for-recurring" tier.**
- **Adult LTV** = AUM on a balance that compounds for decades **+** them becoming
  a paying *parent* for their own kid (the loop restarts a generation down).

## The asymmetry to be ready to explain

A parent pays Plus for recurring on their *kid's* fund, but the adult gets it free
on their *own*. Justification: the kid-fund Plus isn't selling recurring alone —
it bundles the **gifter loop** (grandma's recurring = the growth engine), custom
mix, co-parent, and multi-kid. The adult's own recurring is just self-deposit,
with no loop to monetize beyond AUM. The distinction holds, but say it plainly if
a sharp adult-with-a-kid asks "why'd I pay over here but not there." If that
asymmetry ever feels worse than the AUM math justifies, the deliberate
alternative is to make custodial recurring free too and lean entirely on AUM +
Family — but that **reopens the locked pricing-v3 decision**, so only go there on
purpose.

## A future adult tier (maybe, later)

If Kiddo ever wants adult subscription revenue, it should gate **genuinely-premium
adult features** (advanced planning, multiple personal accounts, the Roth/banking
products) — **never** basic recurring — and sit *optional* on top of the free+AUM
floor.

## Reality check: it's all gated on custody

Recurring (parent's and owner's alike) needs (a) a **linked bank** for the payer
and (b) **live custody (DriveWealth)** to actually pull + invest. Pre-custody it's
display-layer for everyone — the owner has parity with the parent, both inert
until custody is wired. None of the above is real money movement yet.
