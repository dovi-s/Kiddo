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
