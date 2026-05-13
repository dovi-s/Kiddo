# Acorns Strategy Decisions

Internal product note derived from the Acorns comparison pass.

Purpose:
- separate strong ideas from speculative ones
- keep roadmap decisions aligned to the current Kado repo
- clarify what to build now, later, or not at all

This doc is intentionally not a description of what is already live.
For current implementation truth, see [PRODUCT_ARCHITECTURE_CURRENT_STATE.md](/abs/path/c:/Apps/Kora%20(newest)/PRODUCT_ARCHITECTURE_CURRENT_STATE.md).

## Do Now

### 1. Recurring Parent Contributions

Why:
- this is the biggest retention gap between Kado and Acorns
- gifting is episodic; recurring contributions create an ongoing habit
- it strengthens the projection tool, dashboard, and first-gift follow-up

Decision:
- build parent-initiated recurring contributions from a linked funding source
- support simple presets first: `$5`, `$10`, `$25`, `$50`, `custom`
- support frequencies: `weekly`, `biweekly`, `monthly`

Expected product impact:
- stronger retention between gifting occasions
- more meaningful fund growth even before repeat gifters appear
- better conversion path after first gift and at setup completion

### 2. Projection Tool Upgrade

Why:
- current projection is mostly hypothetical and single-track
- Kado needs to show the difference between gifting alone and gifting plus parent contributions

Decision:
- add a second contribution input for recurring parent contributions
- show two projection outcomes:
  - gifting only
  - gifting plus recurring contributions

Product rule:
- standardize projection assumptions across the app
- use one clearly labeled historical benchmark range rather than inconsistent isolated numbers

### 3. Simplified Holding Detail Pages

Why:
- Acorns wins on portfolio depth and explainability
- Kado needs stronger education surfaces for parents and better raw material for Child View and Money Lessons

Decision:
- build simplified ETF and stock detail pages
- include:
  - one-sentence explanation
  - top holdings or what the asset represents
  - simple performance view
  - the child’s position
  - a short “how to explain this to your child” teaching prompt

Why now:
- this reinforces Kado’s child-first moat rather than copying Acorns mechanically

## Do Later

### 4. Five-Tier Strategy Model

Why:
- Acorns has more granularity than Kado’s current `Growth Mix / Steady & Balanced / Custom`
- older children with shorter horizons may need less aggressive defaults

Decision:
- revisit a five-tier allocation system later
- do not treat this as a copy or immediate replacement
- only advance once recurring contributions and projection upgrades are in place

### 5. Glide Path by Child Age

Why:
- age-based default allocation is strategically strong
- it fits the child-fund model better than generic “risk level” framing

Decision:
- treat this as a later-stage investment-policy feature
- it requires explicit policy, compliance, and custody alignment
- it is not just a UI change

### 6. ESG Strategy Option

Why:
- values-based investing may resonate with part of the parent audience

Decision:
- keep as a later option
- only build after core contribution, projection, and portfolio education layers are stronger
- if built, frame honestly as a values choice, not a guaranteed performance win

### 7. More Portfolio Views

Decision:
- later add richer portfolio modes such as:
  - dollar view
  - return view
  - shares view
- the shares view is especially valuable for Child View

## Do Not Build Now

### 8. Acorns-Style Card or Banking Product

Decision:
- do not build a debit card
- do not build Found Money style merchant cashback loops
- do not drift into a general banking product

Why:
- it expands scope dramatically
- it adds regulatory and operational complexity
- it dilutes Kado’s child-and-gifting positioning

### 9. IRA / Retirement Expansion

Decision:
- do not build retirement or Acorns Later style products

Why:
- outside Kado’s core product story
- weakens focus on child gifting and long-horizon family investing

### 10. Bitcoin As A Prominent Feature

Decision:
- do not prioritize Bitcoin now
- do not use it as a marketing hook

Why:
- it clashes with Kado’s trust and safety framing
- it is high-volatility and operationally distracting
- if it ever exists, it should be a narrowly constrained later-stage option, not part of the near-term roadmap

## Kado-Specific Interpretation

What Acorns does better today:
- recurring contributions
- strategy granularity
- portfolio depth
- more concrete portfolio education

What Kado does better today:
- gifting as the core mechanic
- Memory Book as emotional retention
- event-based family loops
- child-first framing
- age-18 handoff as a long-horizon relationship system

Core strategic rule:
- Kado should borrow the strongest habit-forming and explainability mechanics from Acorns
- Kado should not become a generic Acorns clone
- every build should deepen the gifting, family, and child-story moat

## Priority Order

1. Recurring parent contributions
2. Projection tool with recurring contribution scenario
3. Simplified holding detail pages
4. Portfolio view improvements
5. Strategy-tier expansion
6. Glide path exploration
7. ESG exploration

## Decision Boundary

Before a roadmap item from this doc moves into execution:
- verify it does not conflict with [PRODUCT_ARCHITECTURE_CURRENT_STATE.md](/abs/path/c:/Apps/Kora%20(newest)/PRODUCT_ARCHITECTURE_CURRENT_STATE.md)
- verify it does not require unconfirmed custody/compliance behavior
- confirm whether it is:
  - `product UX`
  - `investment policy`
  - `compliance / custody`
  - or a mix of all three

That classification matters because several of the strongest Acorns-inspired ideas are not just front-end work.
