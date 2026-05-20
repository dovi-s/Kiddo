# Age-18 Handoff — The Education Layer

> Status: **MVP shipping 2026-05-13.** Spec covers the full vision
> across three buckets; this commit lands the keystone (at-handoff
> walkthrough) + one piece from each of the other two buckets so
> the foundation of all three is real, not just specced. The
> remaining items in each bucket are documented here with trigger
> conditions for a follow-up session.
>
> Same shape as `FACE_ID_SPEC.md`, `IOS_WIDGETS_SPEC.md`,
> `DUNPHY_DEMO_SPEC.md`, `DEPLOYMENT_PLAN.md`.

---

## TL;DR

The age-18 moment is currently handled emotionally (parent letter,
Memory Book unlock) and legally (DriveWealth transfer, `fund.userId`
flip from parent → kid). What's missing is the **education layer**:
the 60 minutes after a kid takes ownership where they actually
learn what they own, how taxes work, and what their options are.

Without this, a kid hits 18 with $12,847 of equity and no model
for what to do with it. The most likely failure mode is selling
everything to buy a car — same outcome as cash gifts would have
produced. **The whole product premise (investment beats cash because
the asset compounds AND the lesson sticks) depends on this moment
landing well.**

What this spec covers:

1. **At-handoff education** — 5-screen calm walkthrough fired right after the kid completes the ownership transfer
2. **Decision guardrails** — first-large-withdrawal cooldown + first-sell tax explainer
3. **Post-18 engagement loop** — quarterly summary email + annual tax doc walkthrough + Roth IRA pitch when income shows up

---

## What exists today (audit, 2026-05-13)

For context — this is what's already shipped that the new layer
sits on top of:

| Existing piece | What it does | What it doesn't do |
|---|---|---|
| `server/age18TransitionWorker.ts` | T-30 / T-1 / T-0 emails to parent. Auto-create invite token + email kid on T-0. | Doesn't pre-educate the kid. |
| `client/src/pages/AgeTransitionInvite.tsx` | The kid's claim flow. Parent letter, gifters list, memories, "Accept invite" button. | Stops after "Complete transfer" — no learning. |
| Two-mutation handoff | `POST /api/age-transition/:token/claim` (says yes) → `POST /api/age-transition/:token/complete` (flips ownership). | The "complete" moment is just a redirect to dashboard. |
| Memory Book `visibility='kid_at_18'` | Parent letter + reserved entries unlock at majority. | Surfaces what's in the book, not how to think about the money. |
| Kid View phases 14-17 | "Participation" — kid sees holdings, can suggest stocks if `allowTeenSuggestions` is on. | Adult-life framing (taxes, diversification, Roth) doesn't appear here. |
| `accountType` flip parent → kid | `funds.userId` reassigned. `accountType` "UTMA" → "Personal." Parent-era collaborators revoked. | Kid lands on the standard dashboard with no orientation. |

Per-fund `majorityAge` matters here: CA = 21 (Dunphys), AL/NE = 19,
most states = 18, PA/MS = 21. The handoff fires based on the
fund's locked majority age, not a hardcoded 18.

---

## Bucket 1: At-handoff education

### The 5-screen walkthrough

Fires immediately after the kid hits "Complete transfer" on
AgeTransitionInvite.tsx. Five screens, each one concept, each
skippable from screen 4 onward but NOT before — the first three
carry the load-bearing facts.

**Screen 1 — "This is yours now."**
- Headline + total fund value (count-up animation)
- Holdings list with adult-age framing: company name, shares,
  cost basis, current value, gain. Re-uses the existing kid-view
  company explainers but with adult vocabulary.
- Footnote: "What you're looking at is yours legally as of today.
  Nothing was sold. Nothing was moved. Just the name on the
  paperwork."

**Screen 2 — "Three buttons, three different futures."**
- Three side-by-side cards: Keep growing / Withdraw some / Sell some
- Each card shows the math:
  - Keep growing: "$12,847 today becomes ~$X at 65 at 7% compound"
    — number lives in the existing projection helper
  - Withdraw some: "Move cash to a bank account. You pay no tax
    on withdrawing your own money; tax is on selling, not on
    moving cash."
  - Sell some: "Selling turns shares into cash. The gain (sale
    price minus what was paid) is what's taxed."
- No CTAs on this screen — just framing. Buttons come later in
  the dashboard.

**Screen 3 — "Taxes, in 60 seconds."**
- One paragraph each on three concepts:
  - **Long-term capital gains**: held >1 year → taxed at 0%, 15%,
    or 20% depending on total income. Most college students hit
    0%.
  - **Kiddie tax is over**: the special rate that applied while
    they were a kid no longer applies. They file their own taxes
    now (or their parents' last dependent year, depending on
    income).
  - **Low-income years are sell-friendly years**: the math —
    sell while you're a student earning $0–$10k vs after you're
    a working adult earning $80k+.
- Footnote: "We send you a 1099 every January. It tells you
  exactly what to put on your taxes."

**Screen 4 — "Got a job? This fund makes Roth IRA dollars." (skippable)**
- The compounding-tax-free pitch:
  - "Every dollar you earn from a job in a year, you can
    contribute that much to a Roth IRA. Up to $7,000/yr."
  - "Roth IRA dollars are post-tax going in, but every dollar of
    growth is tax-free coming out at 59½."
  - "If you funded a Roth at 18 with $6,000 and never added
    another dollar, at 65 it's worth ~$130,000. Tax-free."
- CTA: "I have a job" toggle in the user record. Triggers a
  later Roth setup nudge.
- Skippable for kids without earned income yet.

**Screen 5 — "The book is open." (skippable)**
- Surfaces the Memory Book preview. Thumbnail grid of
  `kid_at_18` entries. Parent letter is the hero card if present.
- CTA: "Open the Memory Book" (links to /memory) OR "Go to
  your fund" (links to /dashboard)

### Schema additions

```ts
// shared/schema.ts — funds table
kidWelcomeCompletedAt: timestamp("kid_welcome_completed_at"),
```

Single column. When null and the kid is the current owner, the
walkthrough fires on next dashboard visit (in case the kid
closed the tab after complete-transfer). When set, the walkthrough
never re-fires — kid can navigate forward freely.

### Routes

- New route: `/welcome-at-18` (kid-only, requires fund ownership)
- New endpoints:
  - `GET /api/funds/:fundId/handoff-state` — returns `{ shouldShowWelcome: boolean, fund: {...} }` so the client can self-decide
  - `POST /api/funds/:fundId/welcome-complete` — sets `kidWelcomeCompletedAt = now()`

### Wire-up

AgeTransitionInvite.tsx after successful `/complete`:
```ts
setLocation(`/welcome-at-18?fundId=${fund.id}`);
```

Dashboard.tsx on mount: if the user owns a fund whose
`kidWelcomeCompletedAt` is null AND `ownershipTransferredAt` is
recent, redirect to /welcome-at-18 for that fund. This catches
the edge case where the kid closed the tab between complete and
walkthrough.

---

## Bucket 2: Decision guardrails

### First-large-withdrawal cooldown

The single highest-value guardrail. Once the kid is the owner,
a withdrawal of >25% of fund balance OR >$2,000 (whichever is
lower) triggers a 24-hour cooldown on the first occurrence only.

**Server side** (`server/routes.ts`, `/api/withdrawals`):
- Check: `if (kid is owner AND fund.firstLargeWithdrawalAt == null AND amount > threshold)` → require a `confirmCooldown: true` flag in the body OR refuse with `409 First withdrawal cooldown active`
- After the kid confirms via the modal AND 24h have elapsed since the cooldown was initiated, the withdrawal proceeds and `firstLargeWithdrawalAt = now()` is stamped.
- All subsequent withdrawals: no cooldown.

**Client side** (Dashboard withdrawal flow):
- First-time large withdrawal attempt → modal opens:
  - Headline: "First big withdrawal."
  - Body: "This is what your fund looks like in 30 years with vs without this $X" (two-line chart)
  - "I've thought about it. Start the 24-hour wait." button
  - On second visit (after 24h): button label changes to "Confirm withdrawal" and proceeds.

**Schema:**
```ts
firstLargeWithdrawalAt: timestamp("first_large_withdrawal_at"),
firstLargeWithdrawalCooldownStartedAt: timestamp("first_large_withdrawal_cooldown_started_at"),
```

**Why a 24h cooldown not a 7-day:** 24h is the smallest delay
that breaks the "I'm impulsively selling to buy this thing right
now" pattern. 7 days is paternalistic. The kid is legally an adult
— the lock has to be calm, not custodial.

### First-sell tax explainer

When the kid hits "Sell" for the first time, a single screen
appears before the sell-confirm:
- Realized gain calc: "Selling X shares of AAPL. Cost basis $Y.
  Current value $Z. Gain: $Z-Y."
- "At your tax bracket (we ask once), this is roughly $X in tax."
  - Income bracket toggle: $0–$45k / $45k–$100k / $100k+ — maps
    to the LTCG rates (0% / 15% / 20%)
- "You'll get a 1099 in January that shows this."
- Continue / Cancel.

**Schema:**
```ts
firstSellCompletedAt: timestamp("first_sell_completed_at"),
estimatedIncomeBracket: text("estimated_income_bracket"), // "0_45" | "45_100" | "100_plus"
```

After first sell, the explainer doesn't auto-fire again. The
income bracket persists; the kid can change it in Settings later.

---

## Bucket 3: Post-18 engagement loop

### Quarterly summary email

Once per quarter (Jan / Apr / Jul / Oct, mid-month), send the kid
an email:
- Subject: "Your fund Q[N] [YEAR]"
- Body: balance change vs last quarter, top mover (largest gainer/
  loser by % among current holdings), one company-news line from
  the existing market-quotes integration.
- Footer: "Not doing anything is also a choice. Compounding works
  while you sleep."

**Worker:** `server/postHandoffEngagementWorker.ts`. Runs daily
(like `demoResetWorker`), checks: is today the 15th of Jan/Apr/Jul/
Oct AND has this fund's owner not received a quarterly summary in
the last 80 days? If yes, queue.

**Schema:**
```ts
// users table or a new table users_engagement
lastQuarterlySummaryAt: timestamp("last_quarterly_summary_at"),
```

### Annual tax document walkthrough

When the 1099 is generated in January, send a separate email
walking through what it means in plain English. Re-uses the
existing tax document pipeline; just adds an explainer template.

**Status:** existing tax doc flow already sends a "your 1099 is
ready" email. This bucket adds a plain-English walk-through page
that the email links to. Deferred from MVP — same shape as the
welcome walkthrough but smaller.

### Roth IRA setup nudge (earned-income detected)

When the kid toggles "I have a job" in Settings (the post-18
walkthrough Screen 4 sets this), fire one onboarding email + one
Settings card prompting them to set up Roth IRA contributions.

**Integration depth:** This requires a brokerage IRA product.
DriveWealth supports IRAs but the integration isn't wired in
Kiddo yet. **DEFERRED** to a separate session once DriveWealth
IRA support ships. The toggle + Settings card can still ship now
as a "we'll let you know when this is ready" placeholder.

---

## Bucket 4: Parent post-handoff (added 2026-05-20)

The spec above handles the kid side beautifully. The parent side
post-handoff is under-built. This bucket fixes that.

### The locked principle

**Custody ends at majority. The relationship continues through
the gift loop.** The parent does not become a stranger to the
money. They shift roles: from holding the asset on the kid's
behalf to celebrating with it. The platform supports that shift
explicitly.

### What needs to happen at handoff (parent side)

When `funds.userId` flips parent to kid (the "complete transfer"
moment in AgeTransitionInvite.tsx), three things should fire on
the parent's account:

1. **Auto-pause active recurring contributions to this fund.**
   The parent's `parent_contributions` rows still point at a fund
   they no longer own. Worker fix below.

2. **Honest subscription handling.** If the parent's only managed
   fund just flipped (and they have no other active funds), their
   Kiddo+ or Family subscription now gates nothing. Email them an
   honest offer to cancel. No silent autopay through a sub that
   does nothing.

3. **Parent post-handoff welcome screen.** Mirror to the kid's
   5-screen walkthrough. One screen, not five. Explains what
   changed and how to stay involved.

### Bucket 4a: Recurring contribution auto-pause (CODE-LEVEL, shipping with this commit)

`server/recurringContributionWorker.ts` — `processParentContributions`
SQL currently filters only on `pc.status = 'active'` and the
next-run-date window. It does not check whether the fund's owner
is still the contributor. Result: after `funds.userId` flips at
majority, the worker keeps charging the parent's card and crediting
the fund (which is now legally the kid's).

**Fix:** Extend the SQL to skip rows where `funds.user_id !=
pc.user_id`. For those rows, run an auto-pause UPDATE that sets
`status = 'paused'`, `pause_reason = 'majority_handoff'`,
`paused_at = NOW()`, and writes a `parent_contribution_paused`
activity row so the parent sees what happened on next dashboard
visit.

**Schema:** No migration needed. `pause_reason` is already a
nullable text field with documented values "user" and
"subscription_ended" (see `shared/schema.ts:811-815`). Adding
"majority_handoff" as a third value is a string convention, not
a schema change.

**Status:** Shipping 2026-05-20 in the same commit cycle as this
spec update.

### Bucket 4b: Parent subscription honest-cancel email + recurring conversion offer (SHIPPED 2026-05-20)

When `funds.userId` flips at majority AND the parent has no other
funds where they are still the owner AND they have an active
paid subscription, fire one email:

**Subject:** "Emma is the owner now. About your Kiddo+ subscription."

**Body:**
- Acknowledge the moment ("Emma's fund is hers as of today")
- State the change ("Your Kiddo+ subscription does not gate
  anything for you anymore since you no longer manage any funds.")
- Offer the honest choice: one-click cancel link, or keep active
  for future funds
- Explicitly say "no silent autopay through a sub that does
  nothing for you" so the parent knows we are not Cash-App-ing
  them

**Worker:** Either extend `age18TransitionWorker.ts` to fire this
on the T-0 ownership flip OR add a new `subscriptionRetirementCheck`
function called from the existing complete-transfer endpoint. The
latter is cleaner (synchronous with the actual flip).

**Schema:** No new columns. Use existing
`users.subscriptionRetirementEmailSentAt` if it does not exist,
add it as part of the eventual ship. Until built, the column add
is part of this spec, not a separate migration.

**Status (subscription email):** SHIPPED 2026-05-20. Wired into
`server/routes.ts` at the `/api/age-transition/:token/complete`
endpoint. Single fire per handoff (the endpoint short-circuits on
`ownershipTransferredAt` so the email-send block runs exactly
once). Template at `server/templates/parentHandoffSubscription.ts`.

**Status (recurring conversion offer email):** SHIPPED 2026-05-20.
Wired into `server/recurringContributionWorker.ts` inside the
`autoPauseOwnershipMismatchedContributions` sweep. One email per
paused contribution, fires alongside the activity-row write.
Template at `server/templates/parentHandoffRecurring.ts`. Both
templates follow the locked tone rules: no em-dashes, no marketing
teaser quotes, no AI-slop closers, calm Apple-Settings register.

**COPY-VS-UI ALIGNMENT FIX 2026-05-20 (same day):** The original
email copy promised "set up the same contribution as a recurring
gift, same amount, same cadence" with a CTA labeled "Set up a
recurring gift." Auditing revealed `GiftCheckout.tsx` does NOT have
a gifter-side recurring UI; the `recurring_gifts` schema and the
`processGifterRecurring` worker exist but the public flow to CREATE
a recurring schedule was never built or was removed in an earlier
simplification pass. The email was promising functionality the UI
cannot deliver.

Same-day fix: softened the copy to "send a gift any time you want
to show up" (matches what the gift link can actually do today),
CTA changed to "Open ${child}'s gift link." When gifter-side
recurring is restored in the UI per
`memory/project_gifter_recurring_restoration.md`, this email can
return to the stronger "same amount, same cadence" framing.

The locked principle that emerges: **email and push copy must be
cross-checked against the destination surface's actual
functionality at ship time.** Same bug shape as the Activity-tab
badge counting items the page does not show (commit `c7d3894`).
Whenever notification copy makes a specific promise, the
destination needs the matching functionality.

### Bucket 4c: Parent post-handoff welcome screen (DECIDED NOT TO SHIP)

One screen, fires when the parent next logs in after the
ownership flip. Mirror to the kid's `/welcome-at-18` walkthrough.
NOT five screens; the parent is a returning user who already
understands the product. One screen, three facts.

**Headline:** "Emma is the owner now."

**Three bullets:**

1. **Access.** You can no longer see balances, trade, or
   withdraw on Emma's fund. The account is legally hers as of
   today.

2. **Staying involved as a gifter.** You can keep contributing
   through the gift loop (same way grandma does). If you had a
   recurring contribution set up, it has been paused. We will
   email you with one-click options to convert it to a recurring
   gift OR leave it cancelled.

3. **Your subscription.** If Emma was your only fund and you
   have a Kiddo+ sub, we will email you separately about whether
   you want to keep it or cancel. No silent autopay.

**CTA:** "Got it." Single button, no choice. Sets
`parentHandoffWelcomeSeenAt = NOW()` on the user row.

**Schema additions:**
```ts
// users table
parentHandoffWelcomeSeenAt: timestamp("parent_handoff_welcome_seen_at"),
```

**Wire-up:** Dashboard.tsx on mount checks: if the user has any
funds where `funds.previousOwnerUserId === user.id` AND
`parentHandoffWelcomeSeenAt` is null, redirect to
`/parent-handoff-welcome`. Mirror to the kid's `kidWelcomeCompletedAt`
check pattern.

**Status:** DECIDED NOT TO SHIP 2026-05-20. Three existing surfaces
already deliver the parent acknowledgment without adding a fourth:

1. **Activity row** `age18_handoff_completed_parent` is written
   for `previousOwnerId` at the same moment ownership transfers
   (see `/api/age-transition/:token/complete` in `server/routes.ts`).
   Title: "Age-18 handoff completed". Description names the
   child. Visible on the parent's `/activity` feed.

2. **Activity row** `recurring_paused` (with
   `metadata.reason = 'majority_handoff'`) is written for each
   recurring contribution the worker auto-pauses (see
   `server/recurringContributionWorker.ts`). Title: "Recurring
   investment paused". Description explains the handoff and
   points at the gift-loop option.

3. **Two email channels** carry the same information to the
   parent's inbox: the conversion-to-gift offer (Bucket 4b) and
   the subscription honest-cancel offer (Bucket 4b). Both fire
   synchronously with the handoff.

Adding a separate dashboard hero card or a dedicated route
`/parent-handoff-welcome` would be a 4th surface duplicating
information already on three. Per the locked
calm-Apple-Settings register and "no feature theater" discipline
from `project_canva_discipline.md`, the brilliant move is to
recognize when the existing coverage is enough.

**Edge case acknowledged:** A parent whose ONLY managed fund just
transferred AND who does not read the email AND who lands on
the Dashboard would see the standard "no funds" empty state.
This is genuinely rare (single-kid parent, didn't open the
inbox, navigated to Dashboard not Activity) and the empty state
itself prompts toward `/funds` and `/activity`. If this turns
out to be a real confusion in practice, the right fix is a
small empty-state branch in `Dashboard.tsx` that checks for any
`age18_handoff_completed_parent` activity row in the last 30
days and surfaces a specific message ("Emma is the owner now"
plus a link to her activity feed) instead of the generic
"create your first fund" prompt. NOT a redirect to a separate
welcome page; just a smarter empty state.

**Trigger to re-open this decision:** the first time a real
single-kid parent reports confusion at the post-handoff empty
state. Until then, the existing three surfaces hold.

### The subscription decision is LOCKED

The kid never pays a Kiddo+ subscription for the fund they
inherited. AUM (0.10%) is the alignment mechanism for the
post-handoff relationship. See
`memory/project_subscription_retires_at_majority.md` for the full
reasoning. This is not a Bucket-4 design decision; it is a
permanent product principle locked 2026-05-20. Bucket 4 IMPLEMENTS
the implications of that lock; it does not re-litigate the lock.

---

## MVP scope (shipping 2026-05-13)

| Shipped | Deferred |
|---|---|
| ✅ 5-screen walkthrough page (`Age18Welcome.tsx`) | ⏳ First-sell tax explainer (Bucket 2) |
| ✅ Route `/welcome-at-18` + endpoints | ⏳ Roth IRA setup nudge (Bucket 3, needs DriveWealth IRA) |
| ✅ `kidWelcomeCompletedAt` schema column | ⏳ Annual 1099 walkthrough page (Bucket 3) |
| ✅ Redirect after `/api/age-transition/:token/complete` | ⏳ "I have a job" toggle wired beyond the walkthrough |
| ✅ Dashboard fallback redirect (catches closed-tab case) | |
| ✅ First-large-withdrawal cooldown (Bucket 2) | |
| ✅ Quarterly summary engagement worker (Bucket 3) | |

---

## Decisions locked

| Decision | Choice | Why |
|---|---|---|
| Walkthrough length | 5 screens | Calm + brief per the user's pick. Each screen one concept. |
| First 3 screens skippable? | No | Load-bearing facts. Skipping defeats the point. |
| Last 2 screens skippable? | Yes | Roth pitch isn't for kids without jobs yet; Memory Book is supplementary. |
| Withdrawal cooldown duration | 24 hours | Breaks impulse, doesn't patronize. |
| Withdrawal cooldown threshold | >25% of fund OR >$2,000 (whichever lower) | $2,000 captures the "buy a guitar" impulse; 25% captures the "I just want some of it" impulse on smaller funds. |
| Quarterly email cadence | Jan/Apr/Jul/Oct on the 15th | Matches quarterly earnings rhythm — the kid will hear "Q1 earnings" elsewhere and these emails reinforce. |
| Income bracket question | Self-reported toggle, 3 buckets | Real tax law is more nuanced; a 3-bucket approximation is more than enough for "rough tax estimate" and respects the kid's time. |
| Co-steward / advisor role | Deferred | New permissions model. Real but separate spec. |
| Tone | Calm-Apple-Settings | Same register as everywhere else in Kiddo. No emoji, no exclamations, no "Congrats on adulthood!" |

---

## Edge cases

| Case | Behavior |
|---|---|
| Kid closes tab between `/complete` and walkthrough | Dashboard.tsx detects `kidWelcomeCompletedAt == null` on a freshly-transferred fund and redirects to `/welcome-at-18` on next visit. |
| Kid is in a state with majority age 21 (CA Dunphys) | Walkthrough fires at 21 instead of 18. Copy says "21" everywhere it would have said "18" — driven off `fund.majorityAge`. Headline copy uses "now that you're the owner" rather than "now that you're 18." |
| Kid has multiple funds (e.g. parent set up two for them) | Each fund's walkthrough fires once. The kid can dismiss one and have a different one waiting. We don't bundle them — each fund is its own emotional moment. |
| Kid's parent never wrote the at-18 letter | Screen 5 doesn't show the letter hero; surfaces the gifters thumbnail grid instead. Falls back gracefully. |
| Kid sells everything immediately (within 24h of claim) | The 24h cooldown still fires. The walkthrough doesn't gate — it informs. If a kid finishes the walkthrough and immediately tries to liquidate, the guardrail catches it. |
| Quarterly worker fires on a fund that was just claimed last week | Worker requires `ownershipTransferredAt` to be > 60 days old before first email. Don't email a kid one week after handoff. |

---

## Failure paths (the unhappy versions of handoff)

Added 2026-05-14 after auditing Cash App's Sponsored-Account
graduation flow. Cash App's flow explicitly handles the "kid can't
or won't complete the transfer" case by liquidating and closing.
Kiddo can't simply mirror that. UTMA law constrains us differently
because the kid is the legal owner from day one. The custodian's
role ends at majority regardless of whether the kid is reachable.
The asset still belongs to them.

Each row below is the unhappy version of a handoff path, plus what
the system should do.

| Failure | Why it happens | Current behavior | Right behavior |
|---|---|---|---|
| **Kid is unreachable on T-0** | Stale email, kid never set up an account, parent had a typo in the invite email | T-0 email fires into the void; transfer worker stalls because the kid never claims | Worker retries the invite email at T+7, T+30, T+90. After T+90, surfaces a **stalled-handoff** action item to the parent ("We can't reach Emma. Update her email or provide a trusted contact"). The fund stays in parent's custodial view but read-only, with no new gifts, recurring, or withdrawals. |
| **Kid can't pass KYC** | Kid signs up but DriveWealth rejects identity (wrong SSN, bad photo ID, name mismatch with the UTMA registration) | Kid sees a generic "verification failed" page; no escalation path | KYC failure surfaces a specific "we need this from you" list (the failure reason from `kycData.lastFailureMessage` per the locked action-items pattern). Kid can retry. After 3 failed attempts, escalate to a real human via support email + parent's trusted contact (if set) gets a heads-up. |
| **Kid refuses to claim** | Kid is estranged, doesn't want the money, or doesn't trust the brokerage | Fund sits forever in parent's read-only view | UTMA law: the assets STILL belong to the kid as of majority date, even if they refuse to claim them. The parent has no legal authority to do anything but custodial-style preservation. Kiddo's stance: hold the assets indefinitely, send a once-a-year ping to the kid's email, surface the situation to the parent so they can pursue offline (court, mediator, etc.). **Do NOT liquidate.** That would defeat UTMA. |
| **Parent dies before kid reaches majority** | Real life | Today: account orphaned. Trusted contact (if set) can be reached but has no formal authority. | Successor custodian named at fund creation should kick in. This is the legal mechanism that exists for the case. UI affordance for parent to nominate successor at fund creation, surfaced in the AddFund flow. (Already in `successorName/successorEmail/successorRelation` on the schema; not yet wired to a full takeover flow.) Trusted contact is the bridge: we email them with information about the successor process. |
| **Kid dies before reaching majority** | Real life, devastating | No formal handling | Parent contacts support. Funds liquidate and distribute per UTMA law (typically to the kid's estate, which is usually the parent). This is the path documented in `HARD_MOMENTS_SPEC.md`. Trusted contact may be the conduit if the parent themselves is unreachable. |
| **Kid is reached but transfer worker fails mid-flight** | DriveWealth API hiccup, network failure, race condition on `fund.userId` flip | Partial state: kid has claimed but ownership flip didn't land, or vice versa | Worker treats the two-step (`claim` then `complete`) as idempotent. If the second step fails, alert support immediately + retry once per hour for 24h. Don't let the kid see "your fund is in limbo". The UI should say "transfer in progress" and not let them act on the fund yet. |
| **Trusted contact is the only person we can reach** | Parent died or became incapacitated, no successor was named at fund creation | Today: nothing happens | Trusted contact gets a careful email (template at `server/templates/trusted-contact-fund-stalled.ts`, not yet written) explaining the situation and pointing them at offline-resolution paths (probate court, family attorney). Trusted contact does NOT inherit custodial authority. They're only a confirmation/intermediary channel per FINRA Rule 4512. |

**The discipline this section locks in:** Kiddo doesn't liquidate
kid funds at majority just because the kid is unreachable. UTMA
ownership is bedrock, separate from operational convenience. Cash
App's Sponsored-Account liquidation path is fine for THEM because
the sponsor was the legal owner the whole time. For Kiddo, the
kid was always the owner; we just held the assets in trust.

**What this section requires from the broader system:**

1. Trusted-contact field on the parent's account (FINRA Rule 4512).
   Shipped 2026-05-14: column added to `users` table + UI in Account
   security tab.
2. `kycData.lastFailureMessage` surfaced to the kid's claim UI on
   verification failure. Already exists per the locked action-items
   pattern in `server/actionItems.ts`.
3. Stalled-handoff worker. Not yet wired; open follow-up item. Today
   `age18TransitionWorker.ts` does T-30 / T-1 / T-0 only; it doesn't
   know how to follow up at T+7 / T+30 / T+90 if the kid never claims.
4. Successor-custodian takeover flow. Schema columns
   (`successorName`, `successorEmail`, `successorRelation`) exist but
   no UI surface or operational handoff is built. Open follow-up item.

**Trigger to re-open this section:** the first time a real fund
stalls at handoff. Whatever the failure mode that surfaces it, the
real-world version trumps the spec.

---

## What's deferred (with trigger conditions)

| Item | Trigger to re-open |
|---|---|
| First-sell tax explainer | When the second wave of decision guardrails is prioritized. Half-day of work; very high value but lower urgency than the cooldown. |
| Roth IRA setup pipeline | When DriveWealth IRA integration is wired. Without the brokerage piece, the in-app flow is a dead-end. |
| Annual 1099 walkthrough page | Once a kid has owned a fund through at least one tax year. Pre-launch this is academic. |
| Co-steward / advisor permissions | When user research surfaces "I want my parent to be able to see but not move" as a desired feature. Probably year-2 priority. |
| `/learn` section | If users ask for deeper material than the walkthrough provides. The walkthrough surfaces the load-bearing 80%; deeper coverage probably belongs at a separate URL the kid opts into. |
| Localization to non-US tax law | If Kiddo ever serves Canadian / UK markets. The current copy is US-only. |

---

## When to come back to this spec

After the MVP commit lands, three reasons to re-open this spec:

1. **A real kid completes the walkthrough.** What did they skip?
   What confused them? Are the 60-second tax explainers actually 60
   seconds? Real UX is the only judge.
2. **Withdrawal cooldown fires for the first time.** Did the kid
   complete the 24h wait or rage-quit? Did they call support? The
   modal copy is the lever — first feedback should reshape it.
3. **A new bucket-2 or bucket-3 item gets prioritized.** Especially
   the first-sell tax explainer — that's the next highest-leverage
   piece after the walkthrough itself.

---

## References

- Internal: `FACE_ID_SPEC.md`, `IOS_WIDGETS_SPEC.md`, `DUNPHY_DEMO_SPEC.md`, `DEPLOYMENT_PLAN.md` — same spec-doc shape
- Internal: `feedback_structure_vs_behavior.md` — why a structured walkthrough is right here (high-stakes, irreversible, kid is new to the decision context)
- Internal: `server/age18TransitionWorker.ts` — the existing T-30/T-1/T-0 cadence the walkthrough composes with
- Internal: `client/src/pages/AgeTransitionInvite.tsx` — the claim flow the walkthrough fires after
- External: [IRS Topic 409 — Capital Gains and Losses](https://www.irs.gov/taxtopics/tc409) — basis for the 60-second tax screen
- External: [Roth IRA contribution rules](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-ira-contribution-limits) — basis for the Roth screen
