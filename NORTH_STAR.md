# North Star

Internal metric definition for Kado.

This document is intentionally practical.
It answers:
- what the north star is
- how to measure it
- what supporting metrics matter
- how to read product health week to week

## Core Decision

Kado's north star metric is:

## Active Gifting Funds %

Definition:
- percentage of created funds that have received at least `1 successful contribution` in the last `90 days`

This is the best single operating metric because it captures:
- activation: the parent created and shared a fund
- gifter conversion: someone actually used it
- retention: the fund did not go dormant
- loop health: gifting occasions and family reminders are still working

It is stronger than:
- total contributions
- assets under management
- total gifts
- total funds created

because those can rise while real product health weakens.

## Exact Formula

### Metric

`Active Gifting Funds % = funds with >= 1 successful contribution in last 90 days / total eligible created funds`

### Successful contribution

Count:
- completed gift contributions
- successful parent contributions, if recurring/manual parent contributions go live

Do not count:
- failed payments
- pending-only gifts
- canceled contributions
- draft funds with no usable share state

## Required Segments

Do not read the north star as one single blended number only.

Always segment by fund age:
- `0-90 days old`
- `91-365 days old`
- `1+ year old`

Why:
- new-fund underperformance usually means activation problems
- older-fund underperformance usually means retention or re-engagement problems

Without these cuts, the metric becomes harder to diagnose.

## Primary Weekly View

Every Monday, look at:

1. `Active Gifting Funds %`
2. `Active Gifting Funds % by fund age cohort`
3. `Median days from fund creation to first successful contribution`

If only one number is reviewed weekly, use:

## `Active Gifting Funds %`

## Product Ladder

Use this as the engagement ladder for fund health.

### Level 1
- fund created
- no successful contribution yet

Meaning:
- setup happened
- value has not been proven yet

Risk:
- very high churn risk

### Level 2
- first successful contribution received

Meaning:
- aha moment happened
- parent has proof that the loop works

Risk:
- still high churn risk

### Level 3
- `3+` successful contributions received

Meaning:
- gifting habit is starting
- not just a one-time experiment

Risk:
- medium churn risk

### Level 4
- `$500+` successfully contributed

Meaning:
- real money is now in the system
- emotional and financial stakes are higher

Risk:
- lower churn risk

### Level 5
- `1+ year` of Memory Book activity or fund history

Meaning:
- the product is becoming part of the family story

Risk:
- low churn risk

### Level 6
- `$2,000+` contributed or invested
- and `2+ years` of Memory Book / fund history

Meaning:
- entering the sticky zone

Risk:
- very low churn risk

### Level 7
- `$2,000+`
- and `4+ years` of Memory Book / fund history

Meaning:
- “forever user” zone
- extremely high switching cost

Risk:
- near-zero practical churn risk

## Important Interpretation Rule

`$2,000 + 4 years` is not the main week-to-week operating metric.

It is a:
- deep retention milestone
- long-horizon moat metric

Use it to understand durable product strength, not to run weekly execution alone.

## Supporting Metrics

These are the supporting metrics that make the north star actionable.

| Metric | Why it matters |
|---|---|
| Funds with no contribution yet | Activation gap |
| Days from fund creation to first contribution | Activation speed |
| Funds with `3+` contributions | Habit formation |
| Contributions per fund per year | Gifting frequency |
| Memory Book entries per fund per year | Emotional engagement |
| Gifter opt-in rate | Viral/contact loop quality |
| Repeat gifter rate | Re-engagement health |
| Funds at `$500+` | Stake formation |
| Funds at `$2,000 + 2 years` | Sticky-zone entry |
| Funds at `$2,000 + 4 years` | Deep retention / moat |

## Dashboard Recommendation

Build the metrics dashboard around four layers.

### Layer 1: Health
- `Active Gifting Funds %`
- split by age cohort

### Layer 2: Activation
- funds created
- % with first contribution
- median days to first contribution

### Layer 3: Habit
- % with `3+` contributions
- average contributions per fund per year
- repeat gifter rate

### Layer 4: Deep Retention
- % of funds with `1+ year` Memory Book history
- % of funds at `$500+`
- % of funds at `$2,000 + 2 years`
- % of funds at `$2,000 + 4 years`

## Red / Yellow / Green

Use these thresholds for the primary north star:

### Green
- `60%+` of eligible funds received a successful contribution in the last 90 days

Interpretation:
- activation and retention are working

### Yellow
- `40% to 59%`

Interpretation:
- product still works, but there is likely a gap in activation, re-engagement, or fund sharing behavior

### Red
- below `40%`

Interpretation:
- stop treating growth as healthy
- the core loop is weakening
- investigate activation, sharing, gifting friction, and repeat gifting immediately

## Operating Notes

### Eligible funds

Exclude from the main denominator if needed:
- test/admin funds
- deleted funds
- obvious internal QA records

### 90-day window

Ninety days is the correct default because Kado is occasion-driven:
- birthdays
- holidays
- baby showers
- milestone gifting

It is long enough to capture normal family gifting cadence and short enough to surface dormancy.

## Final Summary

If Kado can only track one top-line product metric, it should be:

## Active Gifting Funds %

If Kado can track one deep-retention milestone beyond that, it should be:

## Funds with `$2,000+` and `4+ years` of Memory Book / fund history

Together, those two numbers tell the full story:
- is the product working now
- and is it becoming irreplaceable over time
