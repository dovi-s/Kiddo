# Dunphy Family Demo Account Spec

> Status: **BUILT and live at `/demo` — this file is the living reference.**
> A shareable, paper-trading-style demo that lets prospects, press, and
> onboarding traffic play with a fully-populated Kiddo experience without
> creating an account. Modeled on the Dunphy family from *Modern Family*
> because universal recognition, multi-generational, and a built-in
> age-ladder in one household.
>
> The build evolved past the original plan in two big ways: (1) the demo is
> a LIFECYCLE demo — the three kids are staged across the whole arc (young
> active fund → 30 days from majority → handed off / adult-owned), and
> (2) the demo is INTERACTIVE — a visitor's own actions (send a gift, set
> up recurring, sell, invest cash) visibly land via a client-side overlay
> (`client/src/lib/demo-live-gifts.ts`) without ever touching the shared
> seeded data. Sections below were trued up 2026-06-03; where this doc and
> `script/lib/demo-roster.ts` / `script/seed-dunphys.ts` disagree, the
> code is the source of truth.
>
> Last updated: 2026-06-03

---

## Financial realism (2026-06-01) — REAL historical prices, emergent balances

The demo's money is no longer synthetic. The whole financial layer was rebuilt
so balances, holdings, the growth chart, and per-gift "now worth" are all
emergent from **real historical market prices**, not hand-picked numbers.

- **Price fixture:** `script/data/historical-prices.json` — real monthly
  adjusted-close (split + dividend adjusted = true total return) + current price
  for AAPL/GOOGL/DIS/RBLX/VTI/VXUS/BND. Refresh with
  `npm run fetch:historical-prices` (one-time Yahoo fetch; committed so the seed
  stays deterministic + offline).
- **Pure engine:** `script/lib/demo-portfolio.ts` — every gift buys real shares
  at its month's price (`allocateGift`); positions roll up to holdings; balance
  = Σ(shares × current price). No `growthFactor`/scale-to-fit. The product's
  age-based glide-path (`rebalancesForKid`) de-risks the managed index sleeve at
  13/16 — the ONLY position changes after a buy (protection, not trading).
- **Story data:** `script/lib/demo-roster.ts` — casting + notes (short, mostly
  unsigned, ~80% no note; an anonymous long tail; varied per kid).
- **Verify offline (no DB):** `npm run report:demo-portfolio` prints emergent
  balances, holdings, a real-drawdown chart check (2020 COVID dip is visible),
  and sample "$60 Apple in 2009 → ~$6,900 today" wow lines.
- **Tuned targets (emergent, not fudged):** Luke ~$22k · Alex ~$52k · Haley
  ~$79k — an ascending "time machine" arc driven by real returns + small,
  realistic gifts (tune via the recurring/birthday amounts in `demo-roster.ts`).
- **Gift rows** now carry real `sharesAcquired` + `priceAtPurchase` and write
  `gift_allocations` ledger rows; the Memory Book "now ~$X" uses real shares ×
  live price for single-ticker gifts.

To re-seed with the new data: `npm run reset:dunphys` then
`npm run seed:dunphys`.

---

## TL;DR (as built)

Eight demo accounts (Phil + Claire + five gifters + Haley the graduate)
seeded with a realistic Dunphy-family fund state. Auth path same as real
users but flagged `isDemoAccount: true` in the DB so:
- No real Stripe charges (`server/demoSandbox.ts` mocks the money flows)
- No real brokerage orders; all money flows are paper-trading style
- A visitor's own actions reflect via the per-tab sessionStorage overlay
  (`demo-live-gifts.ts`) — the shared seeded data never mutates
- Reset is MANUAL today: `npm run reset:dunphys` (re-seeds from scratch).
  No nightly cron was built; the banner says "amounts reset periodically."
  Demo login clears client-side caches so personas don't bleed.

Shareable credentials. Live at `/demo` with one-click persona logins.

---

## Why this exists

Three jobs only a demo account can do:

1. **Onboarding**. Prospects on the marketing site say "what does this
   actually look like inside?" → demo lets them poke around without
   creating an account.
2. **Sales / press / investor demos**. Live walkthroughs need a
   populated fund. Showing an empty Free account underrepresents the
   product; showing a real customer's fund violates privacy.
3. **The time-machine moment**. The three kids form an ascending arc
   driven by real historical returns (Luke ~$22k at 13 → Alex ~$52k at
   20 → Haley ~$79k handed off at 21+): the same product at three points
   in time, ~$150k aggregate. That arc plus per-gift "now worth" lines
   ("$60 of Apple in 2009 → ~$6,900 today") is the "lean forward" moment
   for investor / press demos. No real customer's data delivers this on
   demand; a seeded demo does. (Exact dollars drift with live prices —
   they're emergent, not hardcoded; see Financial realism above.)

---

## The Dunphy family — full structure

### Parents (custodian accounts)

| Name | Email | Role | Plan |
|---|---|---|---|
| **Phil Dunphy** | `phil@dunphyfamily.com` | Custodian for all three kids | Kiddo Family |
| **Claire Dunphy** | `claire@dunphyfamily.com` | Co-parent on all three funds | (collaborator, no plan) |

### Kids (the lifecycle ladder — source of truth: `script/lib/demo-roster.ts`)

All three funds use CA majority age 21. Balances are EMERGENT from real
historical prices (re-derive with `npm run report:demo-portfolio`); the
figures below are the ~targets the roster is tuned to, not hardcoded values.

| Name | Age | ~Balance | Strategy | Recurring | Job in the demo |
|---|---|---|---|---|---|
| **Luke Dunphy** | 13 | ~$22k | Growth Mix | $100/mo active | The young active fund. Long-horizon projections, smart nudges, the gamer-gift personality (NTDOY/RBLX/MCD). |
| **Alex Dunphy** | 20 (~30 days from majority 21) | ~$52k | Balanced Mix | $50/mo paused | The approaching-handoff demo. Phil's SEALED letter, ceremony/handoff preview, age-18-plan surfaces. |
| **Haley Dunphy** | 22 (PAST majority — handed off) | ~$79k | Conservative Mix | ended at handoff | The graduated adult account ("Haley's Fund", accountType Personal). Log in as Haley for the owner view (unlocked letter, kid-2.0 surfaces); as Phil for the previous-owner read-only story view. |

**Aggregate:** ~$150k emergent across three kids; 19+ gifters per fund's
"Who loves {kid}" roster. The arc IS the pitch: same product, three
points in an 18-year relationship.

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

All eight accounts use the same password: **`dunphyfamily`**

### On password strength

`dunphyfamily` is 12 characters, no numbers or symbols. It meets
Kiddo's current minimum (auth.ts:649 — ≥8 chars, no complexity rules)
and is intentionally simple for a **public demo credential** where
the security posture is "the account is read-only, sandboxed, and
resets nightly — anyone can know the password."

A stronger demo password (`Dunphys2026!`, `dunphy-family-demo-2026`,
etc.) is fine if it reads better in marketing copy, but doesn't add
real security since the password is shared publicly at `/demo`.

**Separate concern: production password requirements.** Kiddo's
current 8-char minimum with no complexity rules is weak by modern
standards. Worth auditing as a separate task — recommend min 10
chars + zxcvbn-style strength scoring instead of arbitrary "must
contain a number and symbol" rules that just produce `Password1!`
patterns. Not blocking this demo, but flag.

| Login | Password | Job |
|---|---|---|
| `phil@dunphyfamily.com` | `dunphyfamily` | Primary demo — parent dashboard, all three kids visible, household view, Family-tier features unlocked |
| `claire@dunphyfamily.com` | `dunphyfamily` | Co-parent view — read-only on funds Phil owns, but can add Memory Book entries (demonstrates the co-parent flow) |
| `jay@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard — shows Jay's lifetime gifts across the three kids |
| `gloria@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard with voice-memo history |
| `mitchell@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard with the recurring-gift flow visible |
| `cameron@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard — three Disney gifts (one per kid) prominent |
| `manny@dunphyfamily.com` | `dunphyfamily` | Gifter dashboard — Roblox + young-gifter angle |
| `haley@dunphyfamily.com` | `dunphyfamily` | The graduate — post-handoff ADULT OWNER view of her own fund (unlocked letter, owner-mode recurring, kid-2.0 doorway) |

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
- The at-majority lifecycle, BOTH SIDES: Alex is ~30 days from majority
  (sealed letter, handoff preview) and Haley is already handed off (log
  in as Haley for the real adult-owner experience; as Phil for the real
  previous-owner read-only view)
- Recurring investments — Luke's $100/mo active; Alex's paused; Haley's
  ended-at-handoff (read-only treatment). Visitor-created recurring
  reflects via the demo overlay (Scheduled tab, recurring chip)
- Interactive sandbox: a sent gift lands in the Activity feed + bell +
  Memory Book + rolls the hero; sell moves money to cash; invest-cash
  buys into a holding — all per-tab overlay, all reconciled so
  invested + cash never drifts
- Co-parent flow — Claire is a seeded co-admin on the minor funds
- Memory Book thank-yous — seeded SENT thank-yous (older gifts) +
  a realistic awaiting backlog (recent + email-less gifts), plus a few
  pinned entries (first gift, Gloria's voice note)

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

## Ship order — ALL PHASES BUILT (kept for the historical record)

Phase 0-4 below all shipped, with implementation differences worth
knowing: the seed is `script/seed-dunphys.ts` (+ `script/lib/demo-roster.ts`
casting + `script/lib/demo-portfolio.ts` engine), NOT a
`server/demoSeedData.ts`; sandboxing is `server/demoSandbox.ts`; there is
NO `demoResetWorker` cron — reset is manual via `npm run reset:dunphys`;
the interactive overlay (`client/src/lib/demo-live-gifts.ts`) and the
lifecycle staging (Haley handed off) were built on top and are not in the
phases below.

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

1. ~~Should `claire@dunphyfamily.com` be a separate login?~~ RESOLVED
   as built: separate login, seeded as a co-admin collaborator on the
   minor funds. Demonstrates the real co-parent UX.

2. **Voice-memo content for Gloria — IP + copyright situation.**
   THREE phases of asset, each with different legal posture:

   - **Phase A (development placeholder, internal only):** A
     YouTube clip of Sofía Vergara's Gloria from Modern Family is
     fine as a TEMPORARY placeholder ON THE DEV BOX while we build.
     Not displayed publicly, not committed to the repo, not deployed.
     Pure scaffolding for "does the audio player render correctly,
     does the Memory Book entry layout work with voice." Same legal
     posture as a designer using a screenshot from another product
     in a Figma mockup — fine internally, never ships.

   - **Phase B (staging/beta, restricted access):** Same
     placeholder can stay through staging if the staging URL is
     behind auth and not publicly indexed. Still TEMPORARY — clear
     ticket to replace before production launch.

   - **Phase C (production demo, public-facing):** MUST be original
     content. Two paths:
       1. **Voice actor on Fiverr (~$50, recommended)** — find a
          Spanish-speaking voice actor with a Latin American accent
          (Colombian preferred to match the source character).
          Script: 30 seconds, Kiddo-owned, royalty-free, with rights
          assignment. Risk: zero.
       2. **AI-generated voice (e.g., ElevenLabs Spanish voice)** —
          legally cleaner than copyrighted media but still has its
          own AI-disclosure considerations depending on jurisdiction.

   **Never use a YouTube/show clip in production.** That's straight
   copyright infringement (the studio owns the audio) AND right-of-
   publicity (Sofía Vergara's voice is protected). The fact that
   Kiddo is small doesn't change the legal exposure — a single
   DMCA takedown or C&D from Disney's IP team would be embarrassing
   and possibly newsworthy.

3. **Character-name IP risk on the Dunphy / Pritchett / Tucker /
   Delgado family itself.** Modern Family's character names are
   trademarks of 20th Century Studios / Disney. Using them in a
   public-facing demo is a calculated risk, not a free lunch:

   - **Low risk while Kiddo is small** — Disney's IP team isn't
     scanning small fintech demos. Realistic exposure is ~0 in
     the first 1,000 users.
   - **Rises with press / scale** — the moment TechCrunch writes
     about Kiddo and mentions the Dunphy demo, the risk surface
     widens. C&D becomes plausible.
   - **Two mitigations if/when this matters:**
     - Add a footer disclaimer: "The Dunphy family is used as a
       cultural reference; Kiddo is not affiliated with or
       endorsed by 20th Century Studios or Disney."
     - Or rename to "The Murphy family" / "The Smith family" /
       homage-but-original character names. Loses the universal-
       recognition benefit but removes the IP question entirely.
   - **Recommendation:** ship as Dunphys, add the disclaimer,
     have a 1-hour pre-baked rename script ready in case a C&D
     ever lands. Don't pre-emptively rename — recognition is the
     whole point of using the characters.

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
   domain Kiddo owns and parks (recommended — protects the demo
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

## Maintaining this (the demo is built; the doc's job changed)

- **Story changes** (ages, amounts, gifters, notes): edit
  `script/lib/demo-roster.ts`, run `npm run report:demo-portfolio` to
  sanity-check the emergent balances offline, then
  `npm run reset:dunphys` + restart the dev server (some demo state —
  Memory Book pins, gifter notification opt-ins — lives in `.local`
  files the server caches in-process; see LOCAL_STATE_TO_POSTGRES_SPEC.md).
- **Staged-demo expansion** (`DEMO_SANDBOX_PLAN.md`) tracks the
  interactive-overlay roadmap; this file tracks the personas + sandbox
  architecture + locked rules.
- **Before any press moment:** revisit Open Question 3 (character-name
  IP) — ship the footer disclaimer, keep the 1-hour rename script ready.
