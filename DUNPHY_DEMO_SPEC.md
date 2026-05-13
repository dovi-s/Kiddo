# Dunphy Family Demo Account Spec

> Status: **Spec — not built yet.** A shareable, paper-trading-style
> demo account that lets prospects, press, and onboarding traffic
> play with a fully-populated Kora experience without creating an
> account. Modeled on the Dunphy family from *Modern Family* because
> universal recognition, multi-generational, and ranges from newborn-
> ish to college-aged in one household.
>
> Last updated: 2026-05-13

---

## TL;DR

Build six demo accounts (one parent + five gifters) seeded with a
realistic Dunphy-family fund state. Auth path same as real users but
flagged `isDemoAccount: true` in the DB so:
- No real Stripe charges (mock checkout flow)
- No real DriveWealth orders (mock invest flow)
- All money flows are paper-trading style
- Nightly cron resets the demo state so every visitor sees the same
  carefully-curated story

Shareable credentials. Live URL `kiddofund.com/demo`. Cost: ~3-5
days of focused work after the build greenlight.

---

## Why this exists

Three jobs only a demo account can do:

1. **Onboarding**. Prospects on the marketing site say "what does this
   actually look like inside?" → demo lets them poke around without
   creating an account.
2. **Sales / press / investor demos**. Live walkthroughs need a
   populated fund. Showing an empty Free account underrepresents the
   product; showing a real customer's fund violates privacy.
3. **The $284k aggregate moment**. The Dunphy family aggregate
   ($24,500 today → potential $284,000 at 65 combined across three
   kids) is the "lean forward" number for investor / press demos.
   No real customer's data delivers this on demand; a seeded demo
   does.

---

## The Dunphy family — full structure

### Parents (custodian accounts)

| Name | Email | Role | Plan |
|---|---|---|---|
| **Phil Dunphy** | `phil@dunphyfamily.com` | Custodian for all three kids | Kiddo Family |
| **Claire Dunphy** | `claire@dunphyfamily.com` | Co-parent on all three funds | (collaborator, no plan) |

### Kids (UTMA fund recipients)

| Name | Age | Fund balance | Strategy | Job in the demo |
|---|---|---|---|---|
| **Haley Dunphy** | 18 (handoff in 30 days) | $12,847.32 | Conservative | Age-18 handoff demo. Phil's letter visible, physical book ordered, ceremony email primed. |
| **Alex Dunphy** | 15 | $8,234.17 | Balanced | College-fund goal demo. $50k target, projection page, upgrade nudge active. |
| **Luke Dunphy** | 13 | $3,421.88 | Growth | Long-horizon demo. 47 years to 65, "potential $127,891" number. |

**Aggregate:** $24,503.37 today across three kids, 47 unique gifters,
potential $284,000 combined at 65.

### Gifters (sender accounts)

| Name | Email | Relationship | Demo persona |
|---|---|---|---|
| **Jay Pritchett** | `jay@dunphyfamily.com` | Grandfather | Large gift ($500 at Christmas, Google stock). The "cool grandpa" use case. |
| **Gloria Pritchett** | `gloria@dunphyfamily.com` | Grandmother | Voice-memo gifter (in Spanish). The multilingual + Memory Book moat demo. |
| **Mitchell Pritchett** | `mitchell@dunphyfamily.com` | Uncle | Recurring $100/year (Apple). The "set it and forget it" gifter. |
| **Cameron Tucker** | `cameron@dunphyfamily.com` | Uncle | Photo gifter with note, gives Disney stock to all three kids. The Memory Book emotional layer. |
| **Manny Delgado** | `manny@dunphyfamily.com` | Cousin | Young gifter (Roblox stock). The "anyone can gift" angle. |

**The one love-mark hidden in the Memory Book:** Cam gave Disney
stock to all three Dunphy kids with the note
*"Because magic is always a good investment. — Cam"*. That single
entry is the whole product in one quote.

---

## Demo credentials (shareable)

All six accounts use the same password: **`dunphyfamily`**

| Login | Password | Job |
|---|---|---|
| `phil@dunphyfamily.com` | `dunphyfamily` | Primary demo — parent dashboard, all three kids visible, household view, Family-tier features unlocked |
| `claire@dunphyfamily.com` | `dunphyfamily` | Co-parent view — read-only on funds Phil owns, but can add Memory Book entries (demonstrates the co-parent flow) |
| `jay@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard — shows Jay's lifetime gifts across the three kids |
| `gloria@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard with voice-memo history |
| `mitchell@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard with the recurring-gift flow visible |
| `cameron@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard — three Disney gifts (one per kid) prominent |
| `manny@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard — Roblox + young-gifter angle |

Password meets the auth.ts requirement (≥ 8 chars). Same password
across accounts because demo creds are shared publicly; security
posture is "this account is read-only and resets nightly, so a
public password is fine."

---

## Technical architecture

### Schema change (one new column)

```sql
ALTER TABLE users ADD COLUMN is_demo_account BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX users_is_demo_account_idx ON users(is_demo_account) WHERE is_demo_account = true;
```

Same shape as the existing `is_test_account` flag in MEMORY's
test/dev pattern. The demo flag lives at the USER level, then cascades
to funds owned by that user.

### Money-flow sandboxing

When `req.user.isDemoAccount === true`:

| Endpoint | Real behavior | Demo behavior |
|---|---|---|
| `POST /api/stripe/checkout/gift` | Creates Stripe Checkout session | Returns a mock success URL, no Stripe API call |
| `POST /api/parent-contributions/:id/contribute-now` | Creates Stripe payment intent | Mock-credits the fund, no charge |
| `POST /api/funds/:id/invest` | Calls DriveWealth order API | Mock-fills at current market price, writes the holding row only |
| `POST /api/withdrawals` | Sends ACH withdrawal request | Returns success, doesn't actually move money |
| `POST /api/stripe/portal` | Opens Stripe billing portal | Returns 410 with "Demo accounts don't have billing" message |
| Webhook handlers | Process Stripe events normally | Skip demo-account-owned funds entirely (no double-processing) |

Implementation: a single helper `isDemoFund(fundId): boolean` checked
at the top of each money-mutating endpoint. Same pattern as the
existing `isTestAccount` check in `server/contentScanner.ts`.

### Daily reset

```typescript
// server/demoResetWorker.ts (new file)
// Cron: every day at 4 AM ET
// Wipes all demo-account fund state and re-seeds from the canonical
// snapshot in server/demoSeedData.ts. Idempotent. Safe to run twice.
export async function resetDemoAccounts() {
  await db.transaction(async (tx) => {
    // 1. Find all demo user IDs
    // 2. Delete gifts, holdings, memory_entries, recurring_gifts,
    //    parent_contributions, activities for those users' funds
    // 3. Re-insert the canonical Dunphy seed data
    // 4. Reset fund balances, contributor counts, etc.
  });
}
```

Gets registered alongside the existing workers (gifter-worker,
parent-lifecycle-worker, etc.) in `server/index.ts`.

### Seed data file

`server/demoSeedData.ts` (new file) — the canonical Dunphy state as
TypeScript. Updated by hand when the demo story needs refreshing.
Structure:

```typescript
export const DUNPHY_SEED = {
  parents: [/* Phil + Claire users */],
  kids: [
    {
      name: "Haley", age: 18,
      gifts: [/* 47 gift rows across 12 gifters */],
      holdings: [/* Conservative Mix allocation */],
      memoryEntries: [/* incl. Phil's 247-word letter, Cam's Disney note */],
      ...
    },
    // Alex, Luke
  ],
  gifters: [/* Jay, Gloria, Mitchell, Cameron, Manny users */],
};
```

### Auth path

No fork — demo accounts use the regular `/login` endpoint. The
`isDemoAccount` flag is set at user creation (during seed) and
checked by the sandbox logic, not the auth flow itself. Means a
prospect logs in at `kiddofund.com/login` with `phil@dunphyfamily.com`
/ `dunphyfamily` and lands on the regular Dashboard — but the
money-flow endpoints sandbox.

### Demo banner

Top of every authenticated page when `req.user.isDemoAccount === true`:

```
You're in the Dunphy demo. Everything is illustrative.
Real funds work the same way; dollar amounts here reset nightly.
[ Create your own fund → ]
```

Sticky top banner, dismissible per session (not per visit — should
re-appear next session). Calm pill style (same register as the
saved-toast pattern), not aggressive.

### Routes

| Path | Job |
|---|---|
| `/demo` | Marketing landing for the demo. Quick "click to log in as Phil" / "click to log in as Jay" / etc. Each button auto-fills the login form. |
| `/login` | Regular login. Demo accounts work here too. |
| Everything else | Regular routes. Demo accounts get sandboxed behavior automatically. |

The `/demo` page lists the six accounts with a one-sentence
description of what each demonstrates, plus a "Why these accounts"
explainer (the Modern Family reference, the multi-age coverage, the
multi-gifter personas).

---

## What works in demo vs. what doesn't

### Works (full experience)

- Dashboard, Memory Book, Activity, Settings — all real surfaces
- Gift link sharing (real URL, anyone can land on it)
- Anyone can submit a "gift" to the demo fund via the public link —
  the gift is recorded but never charges a card; counts toward the
  contributor count and the demo Memory Book (until the nightly
  reset)
- Kid View — real PIN flow, real age-aware copy, real holdings
- Projection page — real math on the seeded balances
- The at-18 lifecycle (Haley is 30 days from majority) — can preview
  the ceremony emails, the letter, the handoff modal
- Recurring investments — show as configured for Alex + Luke, can be
  toggled / paused in the demo without affecting real money
- Co-parent flow — Claire's view of Phil's funds works

### Doesn't (sandboxed)

- No real Stripe charge on gifts
- No real Stripe subscription on Family plan (already provisioned via
  seed)
- No real DriveWealth order on invest actions
- No real ACH withdrawal
- No real notifications sent to seeded gifter emails (`*@dunphyfamily.com`
  is a non-routable domain — the gifter-notification-worker should
  skip demo-account funds, OR write to outbox only with no actual
  send)

---

## Locked rules the demo must follow

Per project-wide locked discipline:

1. **No em-dashes** in any demo copy. Per `feedback_no_emdash.md`.
2. **Pronouns via `getPronouns()`** on all kid-facing surfaces. Per
   `project_pronoun_audit_dashboard_locked.md`. Haley = she, Alex =
   she, Luke = he per the source material.
3. **No "contribute" in UI copy** — use "gift" / "add to" / "invest
   in". Per `feedback_no_contribute_word.md`.
4. **State-specific UTMA majority age** — Dunphys are LA-based in
   the source material → California majority age = 21. So Haley's
   handoff fires at 21, NOT 18, in the demo. Reinforces the
   state-specific lesson per `project_state_majority_age_sweep.md`.
   Set `fund.majorityAge = 21` on each Dunphy fund.
5. **Memory Book tier policy** — Family plan covers all kids;
   parent-authored media is unlocked. Per the locked 2026-05-13
   Memory Book decision.
6. **Calm Apple-Settings register** in demo banner copy — no
   excited "Welcome to the demo!" framing. Quiet, factual.
7. **No marketing teaser quotes** — no italic AI-slop. Per
   `feedback_no_marketing_teaser_quotes.md`.

---

## Ship order (when this becomes a Q-priority)

Each phase is shippable on its own. The big upfront cost is Phase 0;
after that each piece is incremental.

### Phase 0 — Infrastructure (~1 day)

- [ ] Add `is_demo_account` column to users table + migration
- [ ] Add `isDemoFund(fundId)` helper
- [ ] Wire the helper into the 5 money-flow endpoints listed in the
      sandbox table
- [ ] Add demo banner component + render gate

### Phase 1 — Seed data (~1-2 days)

- [ ] Write `server/demoSeedData.ts` with the full Dunphy state
- [ ] Write `server/demoResetWorker.ts` with the nightly reset logic
- [ ] Hand-curate Cam's three Disney Memory Book entries (one per
      kid) — the "love mark" detail
- [ ] Hand-curate Phil's 247-word at-18 letter to Haley — the most
      emotionally important asset in the demo
- [ ] Voice-memo placeholders (Gloria in Spanish — record real audio
      or use a public-domain spoken-Spanish clip with subtitles)

### Phase 2 — `/demo` landing page (~0.5 day)

- [ ] Marketing-style page at `/demo` route
- [ ] Six one-click login buttons for each account
- [ ] "Why the Dunphys" explainer section
- [ ] Footer linking to "Create your own fund" CTA

### Phase 3 — Initial deploy + curation pass (~0.5 day)

- [ ] Deploy seed + reset worker to staging
- [ ] Manual walkthrough of each of the 6 accounts
- [ ] Adjust seed data based on what actually reads well in the UI
- [ ] Verify the demo banner is calm and unobtrusive
- [ ] Verify gifter-notification-worker skips demo funds

### Phase 4 — Promotion (~0.5 day)

- [ ] Link `/demo` from the marketing nav
- [ ] Add a "Try the demo" CTA to Pricing.tsx
- [ ] Add to Home.tsx hero secondary CTA

---

## Open questions

1. **Should `claire@dunphyfamily.com` be a separate login or auto-
   collaborator-on-Phil's-funds?** Recommended: separate login, set
   up as a co-parent via the existing invitation flow at seed time.
   Demonstrates the real co-parent UX.

2. **Voice-memo content for Gloria.** Recording real audio in
   Spanish requires either Gloria's actor's consent (won't get) OR a
   stand-in voice. Recommended: hire a voice actor for 30 seconds,
   one-time cost, owned by Kora. Costs ~$50 on Fiverr.

3. **The physical book "ordered" state on Haley's account.** If a
   real "physical book ordering" feature gets built later, this demo
   value gives prospects a sense of what shipped. For now, fake
   status with no real fulfillment.

4. **Does the demo expose the admin tools?** Phil should NOT have
   admin role — keep admin gated to actual ops. Prospects shouldn't
   see the Admin tab. Verify the `isAdmin: false` is set on the seed.

5. **Reset cadence.** Nightly may be excessive — prospects who land
   mid-demo will see partial drift from baseline. Consider 6-hour
   reset or on-demand "reset this demo" button. Trade-off: more
   frequent resets = more compute + more chance of resetting during
   a live walkthrough.

6. **Email domain.** `dunphyfamily.com` must either (a) be a real
   domain Kora owns and parks (recommended — protects the demo
   brand from anyone registering it later) or (b) be a non-existent
   domain that's hardcoded as "demo-safe" in the email worker so
   notifications never attempt actual SMTP delivery. Recommended:
   buy the domain. ~$12/year.

---

## References

- Internal: `IOS_WIDGETS_SPEC.md` — same spec-doc shape this file
  follows
- Internal: `project_seth_godin_kora_alignment.md` — the customer-
  acquisition discipline (the demo IS the acquisition surface)
- Internal: `project_state_majority_age_sweep.md` — California
  majority age = 21 means Haley's handoff fires at 21
- Internal: MEMORY's "Locked Copy Rules" — applies to all demo
  copy
- External: *Modern Family* IMDb — for fact-checking ages, names,
  relationships if the seed needs adjustment

---

## When to come back to this spec

Build the demo when ONE of these is true:

1. **Marketing traffic justifies it.** If `/get-started` is hitting
   significant traffic and showing low conversion, a `/demo`
   intercept might help — prospects who "want to see it first"
   become leads who saw it and converted.
2. **A press / fundraising moment is coming up.** Demos shine in
   sales walkthroughs. If TechCrunch is two weeks away, the demo
   becomes urgent.
3. **The first 10 customers are landed.** Demos help convert
   prospects #11-100. Before #10, founder-led sales walkthroughs of
   the real product beat any pre-recorded demo.

Until one of those is true, this spec waits. The Dunphy framing is
recognizable enough that this won't go stale — Modern Family will
still be a universal reference in 2030.
