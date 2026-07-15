# Gifter To Parent Loop

This document defines Kado's core owned growth loop.

It is not a side feature.
It is the product turning warm gifting moments into the next parent account.

## The Loop

```text
Gifter gives to Emma ->
Gifter sees Kado work ->
Gifter opts into updates or saves the fund ->
Gifter creates a lightweight gifter account ->
Gifter starts a fund for their own child ->
That new parent shares their own link ->
New gifters arrive ->
Loop repeats
```

## Product Truth

The repo already contains pieces of this loop:

- gift confirmation and post-gift success surfaces
- gifter opt-in for updates
- gifter dashboard / lightweight gifter account
- birthday reminders
- Memory Book share notifications
- age-18 notification support

What is still missing is a single explicit attribution model that tells us:

- which touchpoint introduced the next parent
- which touchpoint actually converted them
- how long the loop takes to close
- which gifter cohorts convert best

## Core Principle

Right now the company should still prioritize:

1. subscriptions
2. platform fees
3. large-gift fees

The gifter-to-parent loop is not a separate revenue stream.
It is the cheapest acquisition engine for the existing revenue model.

## Touchpoints To Treat As First-Class

### 1. Gift Success CTA

Primary job:
Turn the warmest moment in the gifter journey into a parent start.

Core CTA:
`Have a child of your own? Start a Kado fund in 2 minutes.`

Track:
- CTA viewed
- CTA clicked
- account started from that click

### 2. Gift Receipt Email

Primary job:
Give the gifter a second conversion chance after checkout.

Track:
- email sent
- email opened
- email clicked
- parent onboarding started from email

### 3. Milestone Emails

Primary job:
Quiet long-term reminder that Kado is working.

Track:
- reminder type
- open rate
- click rate
- downstream fund creation

### 4. Birthday Reminder Email

Primary job:
Re-activate the gifter for gifting and parent conversion.

Track:
- gift-back behavior
- start-fund behavior

### 5. Memory Book Share Email

Primary job:
Show the emotional story of the product, not just the transaction.

Track:
- share page opens
- click-through to parent CTA

### 6. Age-18 Email

Primary job:
Close the longest and strongest trust arc in the whole product.

Expectation:
This should become the highest-converting email touchpoint among long-lived gifters.

## Metric Targets

These are directional targets, not hard-coded promises:

- Gift receipt email open rate: 45-55%
- Gift receipt email to signup: 5-8%
- Gifter account creation rate: 20-30% of opted-in gifters
- Gifter to parent conversion rate: 15-25%
- Age-18 email to parent conversion: 15-25%

## What To Build Next

### Now

- strengthen post-gift CTA on success screen
- add parent CTA to gifter receipt email
- standardize CTA framing across gifter-facing pages
- add attribution event model for all loop touchpoints

### Month 1

- expand lightweight gifter account usage
- save first seen touchpoint for future parent conversions
- track parent onboarding start with source touchpoint

### Month 2

- add milestone email footer CTA consistently
- add age-18 CTA instrumentation
- add loop reporting to admin / growth dashboards

### Month 3

- A/B test top-performing touchpoints
- measure median time from first gift to parent fund creation

(Referral incentives are settled, not a Month-3 question: gifters never pay and
we never pay anyone to refer — gifters, parents, or kids. Bounties kill the
trusted-family authenticity the loop runs on.)

## Kid-Pull — the arrow that runs through the household (noted 2026-06-05)

The loops above all start with an adult. There is a fourth arrow: **the kid
recruits the family.** It is the one acquisition channel an incumbent cannot
buy — EarlyBird paid $200+ to interrupt a parent with an ad; a kid asking at
the dinner table costs $0 and arrives via the most trusted messenger alive.
Precedent is real: Step and Current grew largely on teens pulling parents in;
Greenlight gets a meaningful share of signups from the kid asking first.

**The hook mechanism is witnessed compounding.** A kid who watches their own
$1k become $2k — real money, their name on it — gets an imprint no classroom
or ad can produce. That single experience is simultaneously:

- **acquisition** — it's the thing the kid shows a friend ("look, it doubled"),
  and the friend goes home and asks;
- **retention** — the don't-cash-out-at-18 case, made visceral years before 18
  (see `COMPOUNDING_NARRATIVE_NOTE.md`: Kid View + the handoff view);
- **the prize, sharpened** — the 18-year-old we hand off isn't just funded and
  trusting; they're the only person their age with *lived* proof that patience
  pays. That's what Robinhood is paying CAC for and can't manufacture.

### Discipline (hard lines)

- **Never incentivize a minor. Ever.** No kid referral codes, no rewards for
  showing friends, nothing program-shaped aimed at a child (COPPA/CARU
  territory + brand poison for a trust anchor). The existing no-bounty rule,
  extended to its third rail.
- **Product-shaped only.** The mechanic is "Kid View is genuinely worth showing
  a friend," never "share with a friend, kid!"
- **Honest about drawdowns.** A kid can also watch $1k become $800. Kid View's
  compounding framing must teach time-in-market (per the compounding note's
  guardrails), or a bear year imprints the opposite lesson.

### Today's three expressions (nothing new to build for launch)

1. **Kid View showability** — design value, not a feature: the growth-over-time
   view is the show-and-tell artifact.
2. **The handoff sibling doorway** — the sharpest "kid tells parent" is the
   18-year-old telling *their* parents "do this for my little brother." The
   owner-mode "Start one for someone you love" doorway already ships this.
3. **Creator briefs** — family-channel content where the kid on camera is the
   excited one does kid-pull at scale, with zero data collected from children.
   An angle for the outreach kit, not a product feature.

### Honest constraint

Kid-pull is **age-gated**: it needs a kid old enough to have agency and a
surface to show. The wedge cohort skews young, so this channel matures with
the book — same shape as SEO: plant now, harvest in years. It must not touch
the funded-k test or add launch scope.

## What Not To Do Yet

Do not confuse this with:

- a full influencer affiliate program
- brand sponsorship deals
- education licensing
- casual P2P stock transfer products

Those may come later.
This loop comes first.

## Partnership Note

The only partnership worth actively pushing right now is DriveWealth-network distribution.
That work complements the loop.
It does not replace it.
