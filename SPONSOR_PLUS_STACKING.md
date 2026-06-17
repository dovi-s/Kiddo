# Sponsor-Plus stacking + attribution — spec (wave-2)

Enhancement to the **existing** gifter-sponsors-Plus feature (Prong B of pricing-v3,
built 2026-05-23): `SponsorPlusCard.tsx` in the gift flow (`GiftCheckout.tsx`),
`sponsoredByFund` on the subscription payload, the "Plus from Grandma" attribution on
the parent's Account → Plan tab, `SponsorSuccess.tsx`, and the
`sponsoredSubscriptionRenewalWorker`. This spec adds **forward-stacking, a
billing-pause, and an attribution timeline** so a sponsorship is never wasted and the
parent feels who's covering them.

## Why this matters (the reframe)

Stacking converts the **single most-hated mechanic in this market — a recurring fee on a
kid's account (the thing that killed Stockpile) — into a loved one.** When premium is
"a gift from Grandma, then Aunt May," it's the same dollars with the opposite emotional
valence: the liability becomes a relationship moment on the parent's screen. It's the
GoFundMe-tip model applied to the subscription (voluntary, generous-moment,
someone-other-than-the-beneficiary pays), which puts it squarely in the
"monetize-the-gifter-never-the-family's-balance" lane (`REVENUE_MODEL.md`).

Carry GoFundMe's lesson, though: their tip take came from the opt-out-default dark
pattern, and the honest version converts far less. We MUST run the honest version,
because our gifters are repeat relationship people (grandma returns every birthday) — an
extractive default poisons the loop that feeds this. So: works, brand-safe, durable;
size it honestly, not at GoFundMe rates.

**The model-level refinement:** this resurrects the subscription (which `REVENUE_MODEL.md`
demoted) in a brand-safe, **gifter-funded** form — both a revenue line AND a relationship
surface. The subscription becomes primarily *sponsored*, with family-paid as the quiet
fallback. **But it only "goes forever" for kids with generous, plural gifters** — thinly-
supported families (one gifter, struggling household) get no runway, and they're exactly
who the free promise is for. So this does NOT replace the free core; the whole model is:
free for everyone (universal, never hated) + gifter-sponsored premium (the loved-and-
supported) + optional family-paid premium (fallback). And "forever" is contingent, not
automatic — the runway extends only if the next gifter stacks, which the
sponsor-naming renewal reminder (§4) is designed to re-prompt.

**Status: wave-2, NOT launch-critical.** The current feature (sponsor only shows on
Free-tier funds, no stacking) ships fine. Build this post-funded-k, and weigh it against
the more direct gifter-side lines (honest tip, physical keepsake) which monetize the
gift moment without depending on the parent's plan at all. See `REVENUE_MODEL.md`
(sponsor-Plus is one accretive gifter-side line, and the subscription is the
de-emphasized "optional-premium" layer — so frame this as gifting the *experience*, not
"covering their bill").

---

## 1. Forward-stack: a sponsorship never bounces or is wasted

Today the card only renders when the family is on Free. The founder's case: what if it's
**already paid** (parent-paid OR another gifter already sponsored)? Then the new
sponsorship **extends the end date**, it does not no-op.

- Coverage end = `max(currentCoverageEnd, now) + sponsoredDuration`. Grandma covers
  through Jun 2027, Aunt May's gift then runs Jun 2027 → Jun 2028. Multiple gifters build
  a runway.
- Show the card even on already-covered funds, but **honestly framed**: "Their premium is
  covered through Jun 2027 — your gift extends it to 2028." The gifter must see their gift
  queues to the future, never that it vanished or double-charges now.
- This is standard subscription-gift behavior (Discord Nitro / YouTube Premium gifts all
  queue). A dead-end ("already paid, sorry") would waste the exact generosity we're
  capturing.

## 2. Billing-pause: never double-charge the parent

If the parent is paying themselves and then gets sponsored, **pause the parent's own
recurring charge for the sponsored stretch.** They resume (or lapse) only when the
sponsored runway runs out. You never pocket double. This is the generous,
non-dark-pattern version and it's the rule that keeps the whole feature honest.

### 2a. The directly-paying parent (monthly / yearly) — currently SKIPPED, should be handled

Today `SponsorPlusCard` returns `null` when the parent pays directly (`status.directlyCovered`).
That's a simplicity choice, but it skips the most on-thesis case: a gifter should be able
to **lift a paying parent off the bill.** The gift = "the family doesn't pay for premium
for a year because Grandma covered it" — real money saved, framed as a gift, and it shifts
even more of the subscription line from family-paid to the brand-safe gifter side (same
dollars, a payer who loves the kid). Mechanics differ by the parent's cadence:

- **Parent on MONTHLY:** a sponsored year **pauses the monthly charges** for 12 months;
  they stop being billed, then resume (or lapse to Free, with a reminder) after.
- **Parent on YEARLY (already paid through a date):** **do NOT refund the paid year.**
  **Queue** the sponsorship to start at their renewal date and **pause the auto-renew**
  so they don't re-charge. The gift covers "your next year." Forward-stack, no proration.
- **Tier match:** sponsor the SAME tier the parent is on (never downgrade a Family parent
  to a sponsored Plus). Gifter gives "a year of the family's plan," not a fixed tier.

**Parent experience = a gift, not a billing event.** "Grandma gifted you a year of Family
— your next renewal is covered, so we've paused your billing. You'll just see it as free."
Sponsor named, delightful surprise, never a confusing "why did my billing change" moment.

**Keep the escape hatch:** always offer "give a one-time gift to the fund instead" — some
parents would rather the money reach the kid, and some don't want gifters in their billing
at all. Sponsor stays optional + secondary.

## 3. Tier handling: don't make the gifter choose

Grandma can't judge Plus vs Family. The gifter gives **"a year of premium for the
family,"** and the system lands the family on the right tier:
- Free family → sponsor a year of Plus (default).
- Family already on Family → the gift extends *that* tier's coverage (or banks as a
  credit toward it). Handle a Plus-sponsorship-onto-a-Family-family as forward coverage /
  a dollar credit under the hood, never a decision the gifter has to make.
- If the parent later upgrades tiers mid-sponsorship, they pay only the difference.

(Implementation note: period-stacking is more emotionally legible — "Grandma gave you a
year of Plus" — than a raw account credit. Prefer period-stacking on the surface, with
credit-like flexibility underneath for tier mismatches and partial periods.)

## 4. Attribution timeline (the "sponsored by Grandma" part, made into a story)

Extend the existing "Plus from Grandma" tag into a **timeline** on the parent's Plan tab:

> Your premium is a gift through 2028.
> Grandma (2026) · Aunt May (2027) · Uncle Joe (2028)

This is a relationship surface, not a billing screen — the parent sees the family
investing in their experience, reinforcing the loop the same way the Memory Book does.
The renewal reminder names the sponsor: *"Grandma's gift of Plus runs through June.
Continue it yourself, or it'll gently lapse — your fund stays safe either way."*

## 5. Kid view: NO. Parent-facing only.

Subscription-sponsorship is a parent/billing concern. The kid's surfaces (Kid View,
Memory Book, the at-18 handoff story) are about people who put real money and love into
*the kid's fund* — gifts, growth, notes. "Grandma paid for Mom's app features" is not
that, and surfacing it to the kid drags billing into a love/ownership space (off-brand,
per `KID_VIEW_PRINCIPLES.md`). The kid sees the *gifts*; sponsorship stays invisible to
them, and it does NOT enter the handoff "people who invested in you" story.

## 6. Guardrails (the whole ballgame — protect all of these)

- **No auto-charge of the parent** when the runway lapses. Remind, then drop to Free.
  Because the core is free, lapsing = a fully-functional free fund, never a lock-out.
  This is what makes it a gift and not a trap. (The current renewal worker already
  doesn't auto-charge; keep that across the stacked version.)
- **Frame as gifting the experience, never "covering their bill"** (free core means
  "their bill for what?" reads wrong). Center the kid/family benefit (the keepsake
  Memory Book, multi-kid, co-parent tools).
- **Stays secondary + light.** Optional sidebar in the gift flow, never blocking the
  90-second gift. Stacking is good; "sponsor 3 years!" pressure-upsell is not.
- **Gifters never pay a fee on the gift itself.** Sponsoring premium is a separate,
  voluntary gift TO the family, not a toll on the kid's gift. That line stays sacred.

## 7. Edge cases

- Queued (future) sponsorship: treat as a completed gift — no refund once given, same as
  any gift.
- Sponsor lands the same week the parent starts paying: pause the parent charge (rule 2),
  parent's paid time queues after the sponsored runway.
- Co-parent on the household: coverage is per-fund/household; a sponsorship covers the
  household's premium, attributed to the gifter, visible to both parents.

## Source / build pointers
- `client/src/components/SponsorPlusCard.tsx` — the gift-flow card (gate on Free today;
  extend to already-covered with the honest "extends to {date}" copy).
- `client/src/pages/GiftCheckout.tsx` — `?sponsor=1` deep-link + placement (keep
  secondary).
- `client/src/pages/Account.tsx` — the "Plus from Grandma" attribution (extend to the
  timeline in §4).
- `server/sponsoredSubscriptionRenewalWorker.ts` + `sponsoredByFund` payload — the
  no-auto-charge renewal path (extend for the runway / billing-pause).
