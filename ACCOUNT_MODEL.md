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
  (10/25/40) preserved.

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

## 6. P2P "cash or Disney stock" — NORTH STAR (deferred)

The dinner-debt mechanic ("want that $30 in cash or Disney stock?" → claim link →
Claim Tank account → "turn it into a head start for your own kid") is the gifting
loop escaping childhood into everyday adult life. Strategically right; keep it as
North Star.

**But it is a regulated beast, not a sprint:** P2P money/stock transfer + a Claim
Tank that holds strangers' funds = **money-transmission licensing** (state-by-state
MTLs) and/or a bank/BD partner — months-to-years of regulatory processing regardless
of build speed. **Do not let it touch launch scope.** Vision yes; roadmap far after
custody is even live.

---

## 7. Locked-rule ledger (what this doc keeps vs. revises)

**REVISED (this doc):**
- "Sub fully retires at majority / AUM is the only post-handoff revenue" → "no forced
  inherited sub; optional adult sub for active features; AUM continues." (§5)

**ADDED (this doc):**
- Holding-tank threshold before a real brokerage account opens. (§3)
- AUM applies above-threshold at all stages (not adults-only). (§2a)
- Parent/adult = one account, two modes. (§4)
- The self-directed pivot: drop glide path + nudges, keep the fee. (§2b, lawyer-gated)

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
