# Account Model — Source of Truth

> Created 2026-05-28. Purpose: lock the account/fee/lifecycle architecture so it
> stops getting re-litigated every session. This is the companion to
> `CUSTODIAN_SOURCE_OF_TRUTH.md` (which governs the custody decision) and the AUM
> lawyer engagement brief in memory (which governs the RIA decision). Where this
> doc says "GATED," the decision is real but cannot ship until the named gate
> clears — do not treat a gated decision as buildable-now.
>
> Status legend:
> - **DECIDED** — locked; build it this way.
> - **RECOMMENDED (lawyer-gated)** — the chosen direction, pending the RIA memo's
>   blessing. Build behind a flag; don't expose until blessed.
> - **GATED** — correct, but blocked on an external clock (lawyer / custodian /
>   licensing). Not buildable-now regardless of engineering speed.
> - **NORTH STAR** — directionally right, deliberately deferred past launch.

---

## 0. The two gates that govern everything below

Almost every money/fee/handoff decision in this doc is downstream of two external
clocks that **engineering speed cannot shorten** (we control the code; we do not
control these):

1. **The RIA / AUM legal memo** (see the AUM lawyer engagement brief in memory).
   Decides whether the 0.10% fee + any advice surface forces RIA registration.
   The fee model is downstream of this. **Cheapest unblock we have; start it today.**
2. **Live custody** (see `CUSTODIAN_SOURCE_OF_TRUTH.md`). No AUM deduction, no real
   retitle-at-majority, no real investing exists until a custodian is wired and the
   partnership/agreement is signed. The custodian's compliance clock is theirs, not ours.

**Operating principle (locked 2026-05-28):** the bottleneck is never our build
velocity — it's the external clocks. So: start every external clock immediately
(lawyer brief out, custodian conversations open) and build everything we control
in parallel, so the code is waiting the moment a clock finishes ticking.

---

## 1. The lifecycle spine — DECIDED

The product's backbone. This narrative is correct and locked:

```
BIRTH      Parent creates a fund. Free. Gifts come in. (Holding tank — §3.)
GROWTH     Parent sees it grow, wants auto-invest → upgrades to Plus.
FAMILY     Second/third kid → upgrades to Family.
MAJORITY   Kid hits 18/19/21 (per-fund, state UTMA law). Fund spins off into
           the kid's OWN adult account. Parent keeps their account + other funds.
ADULT      Kid inherits everything (assets + Memory Book + soul). Sub optional.
           Can create a fund for their own kid → loop closes.
DYNASTY    Zero-CAC generational compounding.
```

This is the kid-2.0 lifetime funnel and the whole thesis. Don't disturb the spine.

---

## 2. The fee model — RECOMMENDED (lawyer-gated)

### 2a. AUM fee: keep it, but understand what it is
- **The 0.10% AUM fee is a long-game ANNUITY, not launch revenue.** On a $10k fund
  it's $10/yr. For years 1–5, subscriptions ARE the business; AUM is a rounding
  error. AUM becomes the fortune later — especially post-handoff when funds are
  large and the sub is gone. Do NOT over-rely on it early.
- It applies to **invested assets at every stage** — parent-held child funds AND
  adult accounts — **not adults-only**. But only on funds **above the holding-tank
  threshold** (§3), and only once the RIA frame is resolved.
- It does **NOT** violate "no fee on gifts." That rule = no skim on the gift
  transaction (gifter sends $50, all $50 lands). An ongoing fee on *invested
  balance* is a different thing. They coexist.
- Collection mechanics: deducted from assets (the robo/adviser standard) — which
  requires live custody + the right regulatory posture. GATED on §0.

### 2b. The self-directed pivot — the key decision of 2026-05-28
**The AUM fee and the RIA question are the same decision.** What pushes Kiddo over
the adviser line is not the fee alone — it's the fee PLUS advice-like features:

| Feature | Regulatory effect | Decision |
|---|---|---|
| Auto age-banded **glide path** (allocation auto-shifts with age) | Discretionary management — the STRONGEST adviser trigger (robo-adviser territory) | **DROP / defer past launch** |
| **"Strategy review" nudges** | Ongoing advice | **DROP / replace with factual nudges** ("fund grew 12%", "a gift arrived") |
| **Curated baskets** | Defensible *if* presented as a neutral menu the user picks; advice if tailored/recommended/pre-selected | **KEEP as neutral menu** — no "recommended for Emma's age" labels; watch defaults |
| **0.10% asset-based fee** | Hallmark of advisory; weaker trigger as a *platform fee* on a self-directed platform | **KEEP**, reframed as platform/technology fee |

**Why this is doubly correct:** the proven analog (Stockpile — gift-stock-for-kids)
operated as a self-directed broker-dealer, NOT an RIA, precisely because users
picked specific stocks with no advice. The robo-advisers that do glide paths + AUM
(Acorns, Betterment) ARE registered RIAs. Kiddo's brand — "own the companies you
love" (Disney, Roblox) — is *already* self-directed-stock-picking DNA, not
index-glide-path DNA. The age-banded models were pulling us toward RIA registration
AND away from our own voice. Dropping them removes the biggest legal trigger and
realigns the product with itself.

**Net recommended structure:** keep the 0.10% fee, drop the glide path + nudges,
keep curated baskets as a neutral menu → land on the **broker-dealer side** of the
line (Stockpile posture), not the robo-adviser (RIA) side.

**Lawyer-gated caveat:** an asset-based fee *without* advice is unusual and a
regulator may still ask "why asset-based if not advising?" The memo must confirm
the platform-fee framing holds and draw the exact menu-vs-recommendation line. This
is Question 8 in the AUM lawyer engagement brief.

#### Implementation status (2026-05-28) — partially SHIPPED
On inspection, the feared **auto age-banded glide path never existed** — the
`MANAGED_STRATEGY_ALLOCATIONS` tiers are static risk-preference baskets the parent
selects, and the code already deliberately avoided target-date de-risking. So the
biggest feared trigger was a non-issue. The two advice surfaces that *did* exist
were neutralized now (safe/reversible direction; a lawyer would not require keeping
either):
- **Age-based "Strategy review" recommendation nudge** (`Dashboard.tsx` ~6684):
  recommended a specific mix based on the child's age + one-tap switch to Kiddo's
  pick. This was the clearest "advice based on the client's circumstances" surface.
  **DISABLED** behind `STRATEGY_NUDGE_ENABLED = false` (code intact; one-line
  re-enable if counsel blesses a recommendation surface).
- **VGT tech sector tilt** in all three baskets (the lawyer brief's hardest-to-
  defend line; competitor's fiduciary deliberately avoided sector bets).
  **REMOVED** → pure broad market-cap weighting (VTI + VXUS), bond gradient
  (10/25/40) preserved. **Correction (same day):** the first commit removed VGT
  only from the client `Dashboard` *display* constant — the actual server
  allocation engine (`webhookHandlers.ts` `DEFAULT_AUTO_STRATEGIES` +
  `getAutoInvestBasket`, `routes.ts` `autoStrategies`), the parent-facing
  `Settings` mixes, `Admin`, and the custom-mix default all still carried the
  tilt, so the pivot was cosmetic until completed. Now harmonized across EVERY
  default-allocation surface to one VGT-free set matching the documented 90/75/60%
  equity gradient (growth VTI .62/VXUS .28/BND .10, balanced .50/.25/.25,
  conservative .42/.18/.40). VGT stays available only as an explicit user CUSTOM
  pick. (This also fixed a pre-existing display-vs-engine drift: the server had
  drifted to BND .15/.35 vs the documented .10/.25.)

Still DEFERRED to the lawyer / a dedicated product pass (not changed unilaterally —
debatable + invasive, and not the safe-direction slam-dunk the above two were):
- Risk-suitability **basket labels** (Growth/Balanced/Conservative Mix) → whether to
  rename to content-descriptive neutral-menu labels.
- **Default-to-growth** without a suitability assessment (lawyer brief flag #3).

---

## 3. The account minimum — DECIDED (the holding tank)

The EarlyBird lesson ("don't service no-value accounts") is real, but it's a **cost
problem, not a fee problem.** Skipping a $0.05 fee doesn't reduce the cost of
hosting a dead $20 account (storage, emails, and the killer: per-account custodian
cost). So:

- **No hard signup minimum, ever.** The loop requires open access — grandma's $25
  must always land.
- **Holding-tank investment threshold = $50** (provisional — easy to tune; chosen
  low enough that a single decent gift crosses it, high enough to keep dust
  accounts off the custodian's per-account meter). Below it, gifts accumulate in
  **pooled cash** — NO custodial brokerage account opened, no per-account cost, no
  investing, no AUM, no RIA exposure. The fund still *exists* in-product, the loop
  runs, the Memory Book works. At threshold, open the real custodial account,
  invest, AUM begins.
- **The threshold applies to FREE funds only.** A **paid** fund (parent on Plus /
  Family) opens its custodial account immediately regardless of balance — the
  subscription already covers the per-account servicing cost, so there's no
  no-value-account problem to gate against. The holding tank exists to protect
  margin on *free* dust funds; paid funds have paid for the seat.

This one decision solves four problems at once: no-value-account servicing cost,
loop friction (zero), AUM-collection deferral, and per-account custodian cost.

**Flags (name, don't resolve here):**
- Pooling customer cash has a money-transmission/FBO/escrow wrinkle — but we already
  hold gift cash pre-claim, so it's the same surface. Confirm with custodian + lawyer.
- Heavy media (video/voice) is the real storage cost sink and collides with the
  "gifter media always free" moat rule on sub-threshold free funds. Open tension.

---

## 4. Parent vs. adult account — DECIDED

**Same infrastructure, two modes. One person can be both.**

- **Parent mode:** holds child funds; pays a sub for active features; pays AUM on
  invested child funds (above threshold).
- **Adult mode:** holds own/inherited fund; sub optional; AUM continues.
- A 28-year-old who was a Kiddo kid and is now a mom is **both** — one account, both
  modes, one continuous soul. That IS the generational loop, baked into the account model.

**Legal vs product distinction (don't blur it):** at majority the adult account is
a *new legal entity* (individual brokerage, the kid's own KYC, an in-kind retitle of
assets — not literally the parent's custodial account record). But the *product
experience* is continuous: same app, same identity, same Memory Book. New legal
account; continuous product soul.

**Parents are custodians ONLY — no parent self-investing account (DECIDED 2026-05-28).**
A parent who signs up today (an adult who was never a Kiddo kid) is a *custodian* of
their kids' UTMAs — they do NOT get a personal individual investing fund. This is a
positioning moat, not a missing feature:
- Letting parents invest for themselves would turn Kiddo into Acorns (an adult app
  with a kids' feature) — a commodity adult-brokerage surface where we have zero edge
  (no Memory Book, no gifter loop). Kiddo's bet is the inverse: own the KID
  relationship; the adult customer arrives later, as the grown-up kid (kid-2.0).
- The individual/adult account is the **graduation prize** (the 18 handoff). If every
  parent had one on day one, it stops being the special moment — the scarcity is the story.
- A "parent who also holds an individual account" exists ONLY via (a) they grew up on
  Kiddo and later became a parent (the loop closing — one login, both modes), or (b)
  P2P receipt (an adult, who happens to be a parent, gets sent stock and needs somewhere
  for it to land — the future P2P expansion). Never as a default parent feature.
- Pitch implication: the "adult / household opportunity" is the **graduated kid** (+ P2P
  + future Roth/banking), NOT parents investing for themselves. In the demo, Haley (past
  21) IS the adult account; Phil stays a custodian. Don't give Phil his own fund.

---

## 5. The majority handoff — DECIDED (revises a locked rule)

At 18/19/21 (per-fund, frozen at creation from state UTMA law — see lawyer brief
Q9 on the relocation edge case):

- The UTMA terminates by law; assets retitle in-kind to the kid's individual adult
  account. **GATED on live custody** (today `custodianTransfer.ts` is a stub and the
  flip is "in-Kiddo" only).
- The kid **inherits everything**: assets, full Memory Book, all gifts/notes/photos,
  the physical book. **Never strip the soul** — the Memory Book is the un-ACAT-able
  moat (the money is portable the day they turn 18; 18 years of grandma's voice notes
  are not). Retention at the cliff is emotional, not financial.

**Revised locked rule (was: "sub fully retires at majority; AUM is the ONLY
post-handoff revenue"):**
> Everything the kid HAD as a kid stays free forever — viewing, the Memory Book, the
> assets, receiving gifts. New **adult-mode active capabilities** — auto-investing
> their own money, recurring, creating funds for their own kids — are an **opt-in**
> sub. **Not a forced sub. An offered one.** The AUM fee continues across the
> handoff; the sub is elective after it.

This honors the spirit of the old rule (no inherited bill, no paywall on what they
already had) while monetizing the adult as the real customer they now are.

Direct answers to the recurring questions:
- **"Are we only charging 0.10% to adults?"** → No. AUM applies at every stage on
  above-threshold invested assets (parent-held child funds AND adult accounts).
- **"And then a sub to adults?"** → Subs exist at both stages but are **never forced
  on the inheriting kid.** Parent pays a sub pre-18; the adult may opt into one for
  adult active features.

---

## 6. P2P "cash or Disney stock" — SPLIT (revised 2026-05-28)

The dinner-debt mechanic ("want that $30 in cash or Disney stock?" → claim link →
account → "turn it into a head start for your own kid") is the gifting loop escaping
childhood into everyday adult life. On reflection it is **not one monolithic
licensing-gated beast** — it splits cleanly, and only half is heavy:

- **STOCK leg — gift stock to another adult.** Structurally this is the gift flow
  Kiddo *already ships*, just pointed at an adult recipient instead of a kid's UTMA:
  money in via Stripe → buys securities in the recipient's brokerage account.
  Gifting securities into a brokerage account is a brokerage funding/purchase, **NOT
  money transmission** (same regulatory posture as today's gifts — confirm with the
  same counsel). So this leg is gated on the **same live-custody clock as everything
  else** (it needs adult recipient accounts to exist), NOT on a separate licensing
  project. **Promote from "far North Star" → "fast-follow once custody is live."**
- **CASH leg — let the recipient take the $30 as withdrawable cash.** This moves
  money person-to-person *out* of the securities ecosystem → **money transmission**
  (state MTLs) or a licensed partner (Stripe Treasury/Connect, Dwolla, a bank).
  Months-to-years, expensive. The genuinely deferred, licensed piece. It is also the
  leg that makes the mechanic a true Venmo-settling behavior — the *choice* is the
  magic — so **the viral payoff and the regulatory wall are the same leg.**

**Net:** build neither now, but they are not the same size. When custody lands, the
stock leg is a cheap fast-follow, not a new regulatory program; the cash leg is the
licensed long-pole. Engineering speed shortens neither clock (stock waits on custody,
cash waits on licensing) — it only means we're ready the instant either clears.
Building the UI shell earlier is worth it ONLY as a demo/fundraising prototype (it
can't connect to a real backend pre-custody). **A pitch mock ships at `/p2p-preview`
(client-side only, fully fenced) — commit `7a1da82`.**

### 6a. The account-to-account model — the design that routes around the MTL gate (2026-05-28)
The cash-leg licensing problem largely *evaporates* if value stays **inside the
platform**, account-to-account, instead of cashing out to an external bank:

- **Account → account = an internal book transfer / securities journal** between two
  customers of the same broker-dealer. That's a normal brokerage operation, **NOT
  money transmission.** The MTL trigger comes from sending money to *external*
  parties/locations, not from journaling cash/positions between two on-platform
  accounts. Keep it in the ecosystem and the cash-leg landmine mostly disappears.
- **Recipient onboards at claim (Cash-App-exact) — do NOT require a pre-existing
  account.** Send to anyone (phone/email); existing user → credits their account; new
  person → the send IS the invite and they sign up to claim. The recipient always
  ends with an account, but it's created *at claim* — which preserves the acquisition
  loop that is the entire strategic point. (Requiring accounts on both ends up front
  = clean plumbing serving almost nobody.)
- **"Cash" reframed to stay in-ecosystem:** "cash" = an *uninvested balance held in
  their Kiddo account* (fine — brokerages hold cash). "Withdraw to my bank" = a
  *separate, standard brokerage ACH withdrawal the custodian already provides*, not a
  money-transmitter we build. So both halves of "cash or stock" live inside the
  account; only the external withdrawal rides the custodian's existing rails.
- **The gate that does NOT go away:** live custody — both ends need real brokerage
  accounts, and the custodian must support **internal transfers/journals of cash and
  fractional positions between two customer accounts.** Added as a custodian-selection
  question (`CUSTODIAN_DECISION_BRIEF.md`). Under this model P2P is a clean
  custody-gated fast-follow with NO separate licensing program for the in-ecosystem
  path.

---

## 6c. Large gifts ($2k–$25k+) — DECIDED 2026-06-06

Prompted by Acorns' "Request" beta + the founder's "what about people who want
to send real money?" The posture, in five lines:

1. **The whale is not the wedge — and that's correct, not a gap.** The loop's
   math is breadth (gifters-per-fund × conversion); one $25k check adds AUM but
   zero k. The $25k giver is advised estate-planning money (529 superfunding,
   trusts) choosing by tax treatment — we don't win that comparison today and
   shouldn't pretend to compete for it.
2. **The big check FOLLOWS trust; it doesn't lead.** The realistic arc: $100 at
   the birthday → watches it land → trusts the rail → $5k year-end check. The
   wedge earns the whale; no separate whale product. The advisor-grade
   `FundSnapshot` is already the artifact that moment needs.
3. **Gifter-never-pays holds even for whales.** The large-gift fee scaffold in
   `shared/monetization.ts` (`KORA_LARGE_GIFT_*`) stays ZEROED. The AUM meter
   monetizes a whale better than any transaction fee ($25k at 10bps compounding
   beats a one-time skim) and keeps the trust anchor clean. Reversal condition:
   only if at-scale unit economics show large-gift processing/support as a real
   cost center — and even then prefer raising the rail, never a percentage skim.
4. **Rails are already right:** ACH at 0.8% capped at $5 (a $25k gift costs ~$5
   to process vs ~$725 on a card rail — structurally better than Acorns
   Request's Venmo mechanics). No per-gift cap. Keep it that way.
5. **What large amounts DO require (clock-gated, not build-now):** custody live
   + the legal memo before encouraging big checks at all (a $25k gift into the
   pre-custody holding model is risk, not revenue); and a neutral disclosure
   near large amounts — above the annual exclusion (~$19k/giver/yr) the GIVER
   hits Form 709 reporting, and kiddie tax stops being boilerplate at that
   size. `shared/legal-copy.ts` pattern; counsel-packet adjacent. A concierge
   path (wire-in, advisor hand-off) is a plausible post-custody feature, not
   launch scope.

## 7. Locked-rule ledger (what this doc keeps vs. revises)

**REVISED (this doc):**
- "Sub fully retires at majority / AUM is the only post-handoff revenue" → "no forced
  inherited sub; optional adult sub for active features; AUM continues." (§5)

**ADDED (this doc):**
- Holding-tank threshold before a real brokerage account opens. (§3)
- AUM applies above-threshold at all stages (not adults-only). (§2a)
- Parent/adult = one account, two modes. (§4)
- The self-directed pivot: drop glide path + nudges, keep the fee. (§2b, lawyer-gated)
- Large gifts: whale-follows-trust, fee scaffold stays zeroed, AUM monetizes,
  709/kiddie-tax disclosure near big amounts. (§6c)

**DO NOT TOUCH (load-bearing moat — breaking these is the EarlyBird-into-Acorns
soul-strip):**
- Gifter never pays.
- Viewing is never gated.
- No fee on the gift transaction.
- The Memory Book inherits at majority.

---

## 8. What's buildable now vs. clock-gated

**Build now, fast (pure engineering/product — no external clock):**
- Holding-tank model (pooled-cash funds below threshold).
- Adult-account two-mode architecture.
- Dropping the glide path; neutralizing nudges; neutral-menu basket UX.
- The P2P *UX* shell (not the money movement).

**Clock-gated (engineering can't shorten):**
- Anything that charges/collects the AUM fee → RIA memo + live custody.
- The real retitle-at-majority → live custody.
- P2P money movement → money-transmission licensing.

---

## Cross-references
- `CUSTODIAN_SOURCE_OF_TRUTH.md` — the custody decision (Alpaca/DriveWealth/Apex).
- AUM lawyer engagement brief (memory) — the RIA decision; Question 8 is the
  self-directed-pivot question that gates §2b.
- `project_subscription_retires_at_majority` (memory) — the rule §5 revises.
- `project_competitor_earlybird_economics` (memory) — why variable revenue + no
  zero-value accounts matter.
