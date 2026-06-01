# Successor Custodian Spec

What happens if the parent (custodian) dies, becomes incapacitated,
or loses custodial authority before the kid reaches majority. UTMA
law has a defined mechanism for this: a successor custodian named
at fund creation steps in and continues the custodial role until
the kid reaches majority age.

This spec inventories what's already built, what's missing, and the
ship order for the missing pieces. Triggered by the age-18
failure-paths section added 2026-05-14 to `AGE_18_HANDOFF_SPEC.md`.

## What exists today

### Schema (locked)
The successor fields exist on the `funds` table:
- `successorName` (text)
- `successorEmail` (text)
- `successorRelation` (text)

These have existed since the original fund schema. They are nullable
and have no enforcement.

### Form collection (partial)
`client/src/components/AddFundSheet.tsx` collects the successor
fields in the AddFund flow. The `ChildEntry` type carries
`successorName`, `successorEmail`, `successorRelation`, and
`successorOpen` (a UI disclosure boolean). The fields are wired into
the form state but worth verifying they actually persist on fund
creation (see Open Question 1 below).

### Documentation
The age-18 failure paths section in `AGE_18_HANDOFF_SPEC.md`
explicitly identifies "parent dies before kid reaches majority" as
a failure mode where the successor custodian is the right legal
mechanism. Names the schema fields. Notes the takeover-execution
flow is not yet built.

## What's missing

### 1. Successor disclosure during AddFund
The successor fields are in the form but they're behind a
disclosure (`successorOpen`). Most parents will skip past it. The
flow should:
- Default the disclosure to closed (it's there today; keep it).
- Add a one-line ambient note next to it explaining what it's for.
  Current copy probably doesn't make the legal weight clear.
- After submit-without-successor, surface a soft-prompt later
  (Settings card, action-item lite) suggesting they name one. Not
  blocking; the fund creation should succeed without it.

### 2. Edit-successor surface in Settings
No way to update the successor after fund creation. Today if the
parent named their brother at fund creation and then they have a
falling-out, there's no UI to change it. Should live in the per-fund
Settings panel (Child tab probably) as a small card.

### 3. Takeover execution flow
The hard part. When the parent actually dies or becomes
incapacitated, what's the operational path? Today: nothing happens
on the Kiddo side. The fund sits frozen in the deceased parent's
account with no path forward.

Real path needs:
- A way for the successor (named in `successorEmail`) to notify
  Kiddo. Probably a public flow at `/successor/claim/:token` similar
  to the kid-at-18 invite flow.
- Verification: death certificate or court order proving the
  parent's death/incapacity. This MUST go through human review.
  Kiddo support uploads documents into an admin surface; a Kiddo
  admin verifies and approves.
- Identity verification of the successor: KYC at DriveWealth same
  as a new custodian would do. DriveWealth has to accept the new
  custodian on the account.
- Ownership flip: `funds.userId` updated to a new (or existing)
  user account for the successor. `customAccountType` stays UTMA
  (still custodial, just with a different custodian).
- Notification: the kid (via Memory Book? via email?) is informed
  that custody passed. Tone matters; this is the worst version of
  the kid's life situation.

### 4. Trusted-contact bridge
Trusted contact is a different mechanism (FINRA Rule 4512) but
overlaps semantically. If the parent dies and a successor was
named, the trusted contact is who Kiddo reaches first to surface
the situation. If no successor was named, the trusted contact is
the only path forward (and they probably need to engage probate
court). The trusted-contact email template
(`server/templates/trustedContact.ts`) carries the "stalled handoff
+ no successor named" copy.

## Why this isn't shipped in code today

The takeover-execution flow is legal-heavy:
- Death verification requires real documents and human review.
- DriveWealth has its own custodian-change process which Kiddo
  doesn't currently expose.
- The probate vs successor-custodian decision tree depends on the
  state (some states honor the UTMA-designated successor; others
  require court approval).
- Lawyer-reviewed copy required for every screen the successor sees.

Building the flow without legal review is worse than not building
it. The current state (frozen fund) is bad but recoverable through
manual support and legal counsel; a half-built automated flow could
make legal mistakes that are worse than the status quo.

## Recommended ship order

If/when this gets prioritized (real customer scenario surfaces, or
legal counsel signs off):

### Phase 1: Documentation + soft prompts (1 day)
- Audit AddFundSheet.tsx to confirm successor fields persist to DB.
- Add an "Add successor custodian" Settings card to each fund's
  child tab. Edit-only; no takeover logic.
- Add a soft action-item if no successor is named after the fund
  has been active 30+ days. Not blocking; ignorable.

### Phase 2: Successor-claim public flow (1 to 2 weeks, requires legal)
- Build `/successor/claim/:token` public page.
- Email template for successor outreach (we have the email; we send
  them a one-time token + instructions).
- Admin surface for support to upload death-certificate / court-
  order documents.
- Verification workflow: support uploads → admin reviews → approves
  takeover.

### Phase 3: DriveWealth custodian change (depends on DriveWealth API)
- Integrate DriveWealth's custodian-change endpoint (if/when it
  exists; today this is a manual process at most carriers).
- Ownership flip on Kiddo side: `funds.userId` update with audit log.
- Activity row + Memory Book entry recording the custodian change.

### Phase 4: Notifications + kid-facing communication
- Kid (if age 13+) gets a careful email explaining the custodian
  change. Tone: factual, calm, no AI-slop, no marketing.
- Memory Book entry (visible to kid at 18 if they don't see it
  sooner): "Custody transferred to [name] on [date] following
  [parent's name's] death. The assets continued unchanged."

## Open questions

1. **Does AddFundSheet.tsx actually persist successor fields?** The
   form state has them but I haven't verified the POST body. Worth a
   3-minute check before any Phase-1 work.

2. **What's DriveWealth's custodian-change process?** External
   conversation with the carrier-broker rep. Determines whether
   Phase 3 is realistic or has to wait for a different broker
   relationship.

3. **State law variance.** Some UTMA states honor the
   designated-successor mechanism directly; others require court
   appointment. Locked decision: Kiddo can honor the named successor
   ONLY in states where state law accepts the UTMA designation
   without court intervention. In court-required states, the
   successor flow has to wait on probate.

4. **Multiple kids / multiple successors.** A parent with 3 kids
   might want different successors (Mom's brother for Emma, Dad's
   sister for Liam). Today the successor field is per-fund, so this
   already works in the schema. Worth verifying the UI follows.

## Triggers to revisit

- A real customer scenario where the parent dies or becomes
  incapacitated. The lived experience trumps the spec.
- Legal counsel review of the takeover flow before any code ships.
- DriveWealth announces a custodian-change API (would unblock
  Phase 3).
- Customer research surfaces "I want to name a successor" as a
  felt-need parent request (would justify prioritizing Phase 1+2).

## Post-handoff: beneficiary / transfer-on-death (the OWNER-side analog)

Everything above is the *pre-majority* case (a custodian dies while the
beneficiary is still a minor → a **successor custodian** continues the UTMA).
After the age-of-majority handoff there is **no custodian** — the grown
recipient owns an individual account outright. So the "what if the holder dies"
question changes instrument entirely: it's no longer a successor custodian, it's
a **beneficiary / transfer-on-death (TOD)** designation on the owner's own
account.

**Why the Settings card is hidden in owner mode right now.** The Account-tab
`SuccessorCustodianCard` is gated off for owners in `FundSettingsChildPanel`
(`!fundIsOwnerHeld`), because "name someone to manage the fund if anything
happens to you before {child} turns 21" is meaningless for a 22-year-old who
owns the account. Hiding it is the correct interim — but it leaves a real gap:
**the owner currently has no way to say who inherits the account.** That gap is
in tension with the locked `project_adult_account_is_parent_2_0_onramp` principle
("not a cash-out terminal") — a beneficiary/TOD designation is precisely what
makes the adult account a *persistent, transferable* asset rather than something
that dies (legally messy, into probate) with the owner.

**This is NOT built and must not be built blind** — same reasoning as the
takeover flow above: it's legal-heavy and a half-built version is worse than
nothing.

### Open legal/compliance questions (for the same counsel engagement)
1. **Does the broker-dealer support TOD registration** on an individual taxable
   account, and via what API/process? (Most US broker-dealers offer TOD; whether
   our partner exposes it programmatically is the question — mirrors Open
   Question 2 above for custodian-change.)
2. **TOD vs. will/probate.** A TOD beneficiary bypasses probate for that account.
   Is a TOD designation through Kiddo legally sufficient, or advisory-only
   (i.e., we collect intent but the actual TOD must be filed with the broker)?
3. **Beneficiary KYC / identity.** What do we need to collect about the
   beneficiary, and when (at designation vs. at death)?
4. **State variance.** TOD (a.k.a. POD for cash) availability + rules vary by
   state, like the UTMA successor mechanism.
5. **Minor beneficiary.** If the owner names a *minor* beneficiary, the asset
   would need to land in a new UTMA — i.e., the loop's next generation. Worth
   designing so this case routes back into Kiddo's own custodial product (a
   clean parent-2.0 / kid-3.0 hook) rather than out to an external custodian.

### Interim + build trigger
- **Interim (today):** card hidden in owner mode; no beneficiary designation
  exists for owners. Acceptable pre-custody (no real assets, no real death
  scenarios).
- **Build trigger:** custody live + counsel sign-off on the questions above
  (bundle into the same securities/fintech engagement as
  `LAWYER_Q_HOLDING_GIFT_FUNDS.md` and the AUM brief). Then build a
  "Beneficiary" card on the owner Account tab (the owner-mode replacement for
  the hidden successor card), with the same human-review + broker-dealer
  integration discipline as the successor takeover flow.

## Deceased beneficiary — the child dies before majority (the hardest case, currently UNHANDLED)

The two cases above are the CUSTODIAN dying (→ successor custodian) and the post-handoff
OWNER dying (→ beneficiary/TOD). Neither covers the most painful case: **the minor
beneficiary dies before reaching majority.** Today this is entirely unhandled, and the
default behavior is the cruelest possible — the fund keeps rendering "{child} turns 21 in N
years", "on track for $X when {child} turns 21", projections, countdowns, and active-fund
CTAs, to a grieving parent.

**Legal (for counsel):** under UTMA, if the minor dies the custodial property passes to the
**minor's estate** (then by will/intestacy — typically to the parents) via probate. Distinct
from the successor path (custodian dies, fund continues) and the TOD path (adult owner dies):
both the custodian's role and the disbursement path change.

**What "all that's best" looks like (compassionate UX — to be built CAREFULLY, never blind):**
- **Freeze every forward-looking surface.** Suppress all projections, "turns N" countdowns,
  "on track for $X", age-glide, and active-management CTAs. None of that should ever render
  for a fund whose beneficiary has passed.
- **The Memory Book becomes the center** — now the most precious artifact in the product (the
  gifts, notes, voices, photos). Reframe it from "for {child}'s 21st birthday" to a memorial
  the family keeps. This is the one surface that should remain, gently.
- **No self-serve "mark deceased" toggle.** Human-handled, compassion-first support channel,
  not a flow. A half-built automated path here is worse than nothing — the successor-takeover
  discipline at its highest stakes.
- **Disbursement** follows the legal answer (to the estate/parents), handled by a human.

**Status: UNHANDLED.** Pre-custody (no real assets) the financial exposure is limited, but the
jarring-copy problem is live the moment a real fund has a deceased beneficiary. **Build
trigger:** bundle the legal Qs into the same securities/fintech engagement
(`COUNSEL_ENGAGEMENT.md`); the compassionate-UX build follows counsel and is the most carefully
designed surface in the app. The first real (god-forbid) case is human-handled with compassion
before any code ships.

## References

- Internal: `AGE_18_HANDOFF_SPEC.md` failure-paths section
- Internal: `shared/schema.ts` funds table successor* columns
- Internal: `client/src/components/AddFundSheet.tsx` ChildEntry type
- External: [Uniform Transfers to Minors Act](https://www.law.cornell.edu/uniform/vol8) (general reference)
- External: per-state UTMA majority age table in `MEMORY.md` and
  `shared/utma.ts`
