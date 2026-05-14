# Fund States Spec

Inventory of every state a Kiddo fund can be in, plus the message +
visual treatment each one should carry. Today's code surfaces "active"
and "draft" with custom treatment; everything else falls through to
generic "active" rendering. This spec lays out the full landscape and
recommends which gaps to close, in what order.

Wise's 2024 rebrand designed every card state (active, frozen, expired,
virtual) with specific affordances. This spec is the Kiddo equivalent
applied to funds, not cards.

## Current reality

The `funds.status` column in `shared/schema.ts:19` is `text` with default
`"draft"`. Two values are referenced in code: `draft` and `active`.

Other states the previous AI conflated as "fund states" are actually
derived or cross-table:
- "Settling" is a function of recent gift activity + `cashBalance > 0`,
  not a fund.status value.
- "Paused" is `parentContributions.status`, not fund.status.
- "Approaching 18" is derived from `recipientBirthdate`.
- "Transferred at 18" is signaled by the `age18_*` activity types and
  the `kid_claimed_fund` event.
- "Archived" doesn't have a column today.

The spec below treats these honestly: some are first-class fund states,
some are cross-table or derived, and the visual treatment differs.

## State landscape

### First-class (`fund.status` values)

These are columns. They drive rendering directly.

**1. `draft`**. Setup not complete.

Today: rendered as "Share to start" on the Funds Overview cards. Dashboard
shows the setup-progress nudges, the SSN gate, recipient details gate,
etc.

Real treatment exists. Could be tightened but not a gap.

**2. `active`**. Fund is live and accepting gifts.

Today: the default render across the app. Balance, gain badge, hero
card, etc. The vast majority of UX work is built for this state.

Real treatment exists.

**3. `closed`**. Reserved value, no explicit code path yet.

Hypothetical use: fund has been wound down by the parent before the kid
reaches majority (rare, but possible: divorce, restructure, account
consolidation). Today this would fall through to active rendering
because no branch handles it.

Gap. See "Recommended ship order" below.

### Derived states (computed, not column-driven)

Each one belongs in a single helper that surfaces these consistently
wherever they're rendered.

**4. Settling**

Definition: at least one gift settled within the past N business days
(N = 2) AND `cashBalance > 0`. Or: a Stripe payment_intent has fired
but DriveWealth confirmation hasn't landed.

Where it shows: Dashboard hero, fund cards on /funds, gifter view
("Your $50 is settling. Available in 1 to 2 business days.").

Suggested message: "$50 is settling. Available in 1 to 2 business days."
Plus a small pulse animation on the dot pip to make it feel alive.

Surface today: Money summary panel shows "$X of that is still in cash,
waiting to invest." That's the closest analog. Could be tightened with
a settling-specific treatment.

**5. Approaching 18**

Definition: `recipientBirthdate` puts the kid within 90 days of state
majority age (state-aware per `MEMORY.md` Dunphy demo; UTMA majority
varies by state).

Where it shows: Dashboard hero gets a calm prep banner; the bell
surfaces an `age18_handoff_ready` notification at 30 days; the Age 18
Plan page becomes the primary CTA.

Suggested treatment: countdown ring or simple "Handoff in 47 days" pill.
The Age 18 Plan page (Age18Welcome.tsx) carries the warm walkthrough.

Surface today: Age18Welcome.tsx exists. The Dashboard banner doesn't
exist yet as a state-aware affordance.

**6. Handoff in progress**

Definition: kid has signed up but hasn't claimed the fund (or vice
versa). The `kid_age_18_reached` + `kid_claimed_fund` activity pair
spans this window.

Where it shows: parent's Dashboard for the fund (read-only, with a
"Waiting on kid to sign in" note); kid's invite page.

Suggested message: "Waiting on Emma to sign in. We sent the invite to
emma@example.com."

Surface today: AgeTransitionInvite.tsx exists. Parent-side handoff
state doesn't surface explicitly.

**7. Transferred (post-handoff)**

Definition: `kid_claimed_fund` activity has fired. The custodian role
ends; the kid now owns the fund.

Where it shows: parent's view becomes read-only (still in their fund
list but with a "Transferred to Emma · April 14, 2027" treatment).
Memory Book becomes shared between parent and kid. The kid's view
becomes the primary surface.

Suggested treatment: muted card, gold "Transferred" pill in the top
right, link to the post-handoff engagement worker's flow if it's
active.

Surface today: PostHandoffEngagementWorker.ts exists. Parent-side
read-only treatment is partial.

### Cross-table states (live on other tables)

These ARE states the user experiences, but they're stored elsewhere.
Listed here so the spec is complete; the actual treatment lives in the
referenced specs.

**8. Recurring paused** (`parentContributions.status = 'paused'`)
The Dashboard "Growing automatically" card needs a paused row treatment.
Today it shows "3 active" but a paused row collapses or hides. Should
render as "1 paused · Resume" alongside the active ones.

**9. KYC failed** (`users.kycStatus = 'failed'`)
Surfaces as an action item in the notifications panel and as the
"Identity details need attention" card.

**10. Large gift on hold** (`gifts.status = 'host_hold'`)
Action item card per gift. Already specced; treated in the notifications
panel update.

## What's missing today

Ranked by impact, descending.

### Settling state treatment
The biggest gap. Every gift goes through a settling window. Today's
copy says "$50.00 still in cash, waiting to invest" which works but
isn't time-bound and doesn't pulse. A real settling treatment (small
animation, ETA, specific copy "Available in 1 to 2 business days")
would close the most-frequent state-mismatch the parent encounters.

### Approaching-18 banner
The biggest emotional moment. The Age 18 Plan walkthrough is real
(Age18Welcome.tsx). What's missing is the runup: a Dashboard banner
in the 90-day window that says "Handoff in 47 days. Here's what to
prep." Without it, the kid reaches majority and the parent gets
surprised by the transition email.

### Closed / Transferred read-only treatment
Today a transferred fund probably still renders as active for the
parent. Read-only treatment with the "Transferred to Emma" framing
honors the lifecycle and prevents the parent from clicking buttons
that no longer do anything.

### Paused recurring row
The Dashboard "Growing automatically" card hides paused rows. Better:
collapse them into a single "1 paused" row with a Resume button.
Otherwise the parent thinks they cancelled when they only paused.

## Recommended ship order

If shipping any of this, do it in this order. Each one is a small,
contained component change.

### 1. Settling treatment (1-2 days)
- Add a `getFundLifecycleState(fund, gifts)` helper that returns
  `{ phase: 'active' | 'settling' | 'approaching_18' | 'transferred',
     etaText?: string, pulseTone?: 'sage' | 'gold' }`.
- Update the Money summary panel's cash sub-line when phase is settling.
- Add a small pulse animation on the cash pill.
- Update the gifter view ("Your $50 is settling") via the same helper.

### 2. Approaching-18 Dashboard banner (2-3 days)
- Compute days-to-majority server-side, return on the fund object.
- Add a calm Dashboard banner in the 30-90 day window. Tap routes to
  the Age 18 Plan walkthrough.
- Copy: "Handoff in 47 days. Walk through what to prep."
- 90-day threshold matches the demo spec's prep timeline.

### 3. Paused recurring row (1 day)
- Update the "Growing automatically" card to show paused rows as a
  collapsed "1 paused" row with a Resume CTA.
- The fix is purely in the Dashboard recurring section.

### 4. Transferred read-only treatment (3-4 days)
- Add a `funds.transferredAt` timestamp column.
- Webhook handler for `kid_claimed_fund` writes it.
- All write-CTA buttons gate on `!transferredAt`.
- Card chrome shifts to muted + "Transferred to Emma · [date]" pill.
- Memory Book stays writable for the parent (their entries persist).

### 5. Closed fund treatment (1-2 days)
- Currently no UI surface to "close" a fund. Add an admin-only path
  first (you ship this when it's needed, not speculatively).
- When set, fund moves to a "Closed" section at bottom of Funds
  Overview, hidden from default view.

## What NOT to build speculatively

The previous AI's response invoked a "design every state" framing that
sounded like a project. It isn't. Most of these are 1 to 3 day shipping
units that get added as the underlying behavior ships. Don't pre-build
treatment for states that aren't actually reachable yet (e.g., closed
funds before there's a close path; transferred funds before the kid-
at-18 demo is real).

The state inventory in this spec is the reference; the ship order is
the discipline. Build only the states real users encounter, in the
order they encounter them.
