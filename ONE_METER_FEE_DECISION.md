# One Meter vs Two Fees — the subscription + AUM pricing decision

*2026-06-12. A founder-owned pricing decision, written up against real numbers so it
gets decided deliberately rather than by default. Grounded in `shared/monetization.ts`
(the price source of truth), `client/src/pages/Pricing.tsx` (live disclosure),
`UNIT_ECONOMICS.md` (the revenue model), and the fee-sensitivity research
(`project_pricing_fee_sensitivity_research` in memory). Companion to
`BUSINESS_STRUCTURE.md` and `COMPETITIVE_LANDSCAPE.md`.*

## STATUS: greater-of REVERTED (2026-06-12) — model is "0.10% always + subscription-for-features"

Greater-of was shipped then **reverted the same day.** The crossover it created
(market-moving threshold, sub-vs-AUM billing switch) was over-engineered, and the
founder chose the simpler, more profitable, clearer model:

- **The subscription and the 0.10% are two different fees for two different things:**
  the subscription is for product features (Memory Book authoring, multiple kids,
  co-parent, custom mix); the 0.10% is the fee on the *invested assets themselves* and
  applies on every plan. Gifts are always whole. No "greater-of", no "never both", no
  crossover.
- **The two-fee optic is handled by FRAMING + trust signals**, not a crossover
  mechanic: gifts free, viewing free, gifter media always visible, tax summary free,
  unlimited occasions, the kid never pays a subscription. The 0.10% is tiny and aligned;
  the subscription is honest feature pricing.
- **Removed:** `resolveEffectiveAnnualFee()` + tests; all "never both / whichever is
  larger / subscription covers it" copy across Pricing, Account, Legal, FAQ,
  TrustMicroStrip, education. The "only fee on the investment itself" framing stays
  (it correctly distinguishes investment fee from product subscription).
- Still custody-gated: the 0.10% is display-only until custody; at custody it applies
  on all plans (simple, no guard needed). The options analysis below is kept for the record.

## TL;DR

There is **no emergency and nothing live is broken.** The live `/pricing` page already
discloses all three fee layers honestly and frames them well ("same side of the table,"
"the kid never pays a subscription on the fund they inherit," "the only ongoing fee,
across every plan"). The 0.10% AUM fee is **display-only until custody is live**, so no
double-charge has ever actually billed.

The one real critique the fee-sensitive adjacency would level is **structural**: a
paying family carries a subscription *and* the 0.10% AUM on the same account. If you
want to remove that optic, the smart way is **not** "waive AUM on paid plans." It is
**bill the greater of the two, never the sum** ("one meter"). Same trust win, far lower
revenue cost, and it protects the AUM annuity on exactly the large, mature balances the
long-term thesis depends on.

Because nothing bills until custody, **you can decide the framing now and implement at
custody** with zero lost revenue in the meantime.

## The fact base (verified in code)

- Three layers (`shared/monetization.ts`): subscription (Free / Kiddo+ $3.99/mo or
  $29/yr / Family $6.99/mo or $59/yr), **0.10% AUM on invested assets**, and **$0
  platform fee on gifts** (full amount to the fund).
- The 0.10% AUM is a **flat rate across every plan** (`estimateAnnualAumFee = assets *
  0.001`, no plan branch in `routes.ts`). Paid plans do **not** waive it today.
- The subscription buys *product* features (multiple funds, Memory Book media, premium
  occasions); the AUM is the only fee attached to the *fund itself* (which is why the
  inherited fund carries no subscription).

## The only real critique

From the research (review sites + the SEC small-balance bulletin; **not** a viral named
meme, do not overstate): a **flat subscription stacked with an asset fee on one small
account** is the structure the fee-sensitive crowd dunks on. We disclose it honestly,
but the *structure* is the screenshot. Everything else we do already counters the
category's loudest complaints ($0 on gifts, frictionless cancel, "same side of the
table").

## The numbers

Per-fund annual AUM at 0.10%, and where it crosses the yearly subscription:

| Invested balance | AUM @ 0.10%/yr | vs Kiddo+ ($29/yr) | vs Family ($59/yr) |
|---|---|---|---|
| $1,000 | $1 | trivial | trivial |
| $5,000 | $5 | trivial | trivial |
| $10,000 | $10 | < sub | < sub |
| $29,000 | $29 | **= sub** | < sub |
| $59,000 | $59 | > sub | **= sub** |
| $100,000 | $100 | > sub | > sub |

So the AUM only **exceeds** the subscription above ~**$29k** (Kiddo+) / ~**$59k**
(Family). Monthly billers pay more sub ($48 / $84 a year), pushing those crossovers
higher. Below the crossover, the AUM is the *smaller* of the two fees.

Aggregate cost at the `$100M`-scale model (~1M paying funds), if you fully **waive**
AUM on paid plans:

| Avg paid-fund balance | Foregone AUM / yr |
|---|---|
| $5,000 | ~$5M |
| $10,000 | ~$10M |
| $20,000 | ~$20M |
| $30,000 | ~$30M |

Material but not fatal (single-digit to low-tens of millions on a $100M+ business),
and it scales with paid-fund balance, which is precisely the AUM annuity
`UNIT_ECONOMICS.md` counts on compounding as accounts age.

## The options

**A. Status quo — subscription + AUM, honestly disclosed.**
Cost: $0. Risk: the "two fees on one account" optic. Defensible (the live page handles
it well), and the research says it is not a viral meme. A legitimate choice.

**B. Waive the 0.10% AUM on paid plans.**
Cleanest optic (a paying family literally never sees the AUM line). Cost: foregone AUM
on paid funds (table above). Downside: it quietly forgoes AUM on the *high-balance*
paid funds too, which is where the annuity is most valuable.

**C. "One meter" — bill the GREATER of (subscription, AUM), never the sum. (Recommended.)**
A paying family always sees exactly one number: their plan, or the 0.10% fee if the
fund ever grows large enough that 0.10% would exceed the plan, but **never both**.
- Identical optic to B (one fee, never stacked).
- **Strictly cheaper than B:** you only forgo the *smaller* of the two per fund. Below
  the crossover you forgo the small AUM (same as B); above the crossover you keep the
  larger AUM instead of throwing it away. The high-balance tail — mature, long-held,
  handoff-adjacent funds — keeps paying.
- Honest one-liner: "Your plan covers the fund's annual fee. If a fund ever grows large
  enough that the 0.10% would be more than your plan, you simply pay that instead, never
  both."

At today's small balances B and C cost the same; C's whole advantage is future-proofing
the large-balance tail. Since this thesis is the long game (compounding to the handoff),
C is the structurally correct version of the idea.

## Recommendation

1. **No rush, no live fix needed.** Status quo is honestly disclosed and nothing bills
   pre-custody.
2. **If you remove the optic, do it as Option C (greater-of), not a flat waive.** Same
   trust win, protects the annuity where it matters.
3. **Decide the framing now; implement at custody.** Zero revenue lost by waiting, and
   it keeps the model coherent before the first dollar bills.

This trades a little AUM revenue against the "sub-led to $100M" model in
`UNIT_ECONOMICS.md`; the trade is small at current balances and bounded by the
subscription per fund under Option C. Resolve it as a deliberate model choice.

## What we can charge on (and what is off the table)

- **Charge on invested BALANCE, not earnings/gains.** 0.10% of invested assets,
  prorated daily, $0 on cash, pending, and gifts. Standard robo/advisor structure and
  the aligned one (we earn more only as the fund grows).
- **A performance/earnings fee is not a design choice we have.** Performance-based
  fees (Advisers Act Rule 205-3) are restricted to "qualified clients" (roughly $1.1M
  with the adviser or $2.2M net worth). A kid's custodial account never qualifies. Off
  the table. (Not legal advice; for the counsel packet.)
- Today's 0.10% is deliberately a **platform** fee, not advisory (`BUSINESS_STRUCTURE.md`),
  to stay out of RIA while the account is self-directed.

## The vertical-integration arc (what owning the stack unlocks)

Already locked strategy (rent the rails now, own the regulated core later). In order of
value:
1. **Advisory fee instead of platform fee.** Become an RIA, offer a genuinely managed
   rebalanced product, charge ~0.25% (robo rate) on managed assets. ~2.5x the
   per-dollar take. The model shows the mature 1M cohort going from ~$75M to ~$143M on
   this alone.
2. **Net interest / "Kiddo Cash" (a parent HYSA).** A NEW pool of idle cash that
   actually sits still (unlike the kid's gifted money, which we invest), earning the
   program-bank spread. The float on the kid's money is a *weak* lever for us precisely
   because we deploy it; the parent HYSA is the real float play. Caveat: pay a FAIR
   rate or become the next r/Schwab screenshot.
3. **Securities lending** (post-BD), passive at scale.

Heavy regulatory + capital cost, so this is Phase 3, funded by strategic capital after
the loop is proven. Renting first loses nothing; the backend swap is clean.

## Other revenue streams (ranked by leverage)

1. **Advisory fee (post-RIA)** — biggest per-asset lever (0.10% to ~0.25%).
2. **Handoff to adult LTV** — the $1B lever; worth more than all others combined if
   retention holds (kept kid = a 60-year financial customer acquired at ~$0 CAC).
3. **Kiddo Cash (parent HYSA)** — program-bank spread on a new, sticky cash pool.
4. **Gifter-side a la carte** (premium occasions, keepsake add-ons) — already exists,
   on-thesis (the gifter is the customer), pay-per-use not subscription.
5. **B2B distribution** (employer benefit, registry partners, institutional
   aggregators) — revenue plus loop fuel.

Deliberately avoid: PFOF (trust cost), debit-card interchange (Greenlight's job, off
thesis), and monetizing education (it is the retention moat, not a revenue line).

## The model

`script/revenue-model.mjs` (run `node script/revenue-model.mjs`) is an editable
calculator, not a forecast. Set conversion, balance distribution, take rate, and
retention; rev and ARPU fall out. The reads it makes visible:
- A **young cohort's ARPU is ~the subscription** ($60), because balances are tiny. So
  "10k paying funds = $600k" is the FLOOR, not the business.
- As a cohort **matures, funds cross the ~$29k line and AUM takes over, so ARPU RISES
  with zero new signups** — the same families, more revenue, because the asset
  compounded. That annuity is invisible on a sub-ARR line.
- **Adult LTV dwarfs both** once retention holds (10M lifetime funds x 60% kept x $170
  ~ $1.02B/yr). Measure funded-k, balance growth, and retention-at-18, not sub ARR.

## Hard rules from the graveyard (mostly already true — adopt explicitly)

- **Lock pricing and grandfather it forever.** Post-launch hikes are the one universal
  trust-killer (EarlyBird $1→$5, Acorns $1→$3, Stash $1→$3 all drew named backlash).
- **Keep cancel frictionless.** Already true (no contracts, no fees, access to period
  end). Billing-after-cancel is the sharpest trust wound in the category (Greenlight).
- **Make "your money and memories are always exportable" an explicit promise.**
  Non-portable funds were EarlyBird's most user-hostile moment when Acorns wound it down.
- **Never deduct a fee in any way that pulls cash out of a kid's account** (the Stockpile
  mistake). The AUM fee mechanics at custody must respect this.

## How the fee is actually collected — DESIGN LOCKED in `AUM_FEE_COLLECTION_SPEC.md`

**Status today: the 0.10% is a DISPLAYED number only** (`routes.ts:12732-12735`, plus
the "(est.)" tax-year figure at `routes.ts ~22878`). No accrual ledger, no job, no
deduction. Nothing is charged, because custody is not live. Correct, not a gap.

**The collection mechanism is already designed and locked** (`AUM_FEE_COLLECTION_SPEC.md`,
2026-05-28) and it already resolves the Stockpile / taxable-sale landmine:
- **Cash-first:** collect from un-invested cash (gift cash, dividends, settlement cash)
  before ever touching invested positions.
- **Never force a taxable sale** to collect a routine fee; if cash is short the fee
  **accrues as a payable** and settles from the next cash inflow. (Selling a child's
  shares would realize a gain and trigger kiddie-tax, the exact thing we ban.)
- **Accrue daily, collect monthly;** basis = invested assets only; the custodian is
  authoritative once live. Account close / withdrawal settles any outstanding accrual
  from the proceeds at that point (no extra surprise sale).

**One interaction to honor when greater-of is built (this memo x that spec):** under
greater-of, an account where the SUBSCRIPTION is the larger fee must NOT also accrue an
AUM payable, or the daily-accrual job would collect both and re-create the very
double-charge greater-of exists to remove. Accrue AUM only for funds where AUM currently
exceeds the subscription (the post-crossover / no-active-sub state, including
post-handoff inherited funds, which carry no sub). Build the AUM accrual behind the
greater-of test, not independently.

## Customer-facing clarity (one live nit + the ready future copy)

**Today's live `/pricing` copy is accurate and clear** and should NOT be changed to
imply greater-of before it is real (greater-of is unratified, AUM is display-only). Do
not repeat the `/fee-preview` mistake of shipping an unbuilt fee story.

**One clarity nit in today's copy worth a founder call (proposal, not slipped in):**
`Pricing.tsx:644` reads "$1 per year per $1,000 invested is the only ongoing fee. Across
every plan." A paying parent also pays the monthly subscription, so "the only ongoing
fee" can read as not-quite-true out of context (in context, under "the kid never pays a
subscription on the fund they inherit," it means the only fee on the FUND). Precise fix
that keeps the true intent and removes the ambiguity:
> "$1 per year per $1,000 invested is the only ongoing fee **on the investment itself**.
> Across every plan. No hidden charges. No data sales."
Founder-owned copy. Surface, do not auto-change.

**Ready future copy for greater-of (DO NOT SHIP until greater-of is ratified + custody
live + counsel-cleared):**
- One-liner: "Your plan covers your fund's annual fee. If a fund ever grows large enough
  that the 0.10% would be more than your plan, you simply pay that instead. Never both."
- FAQ "Do I pay the subscription AND the 0.10%?": "No, you pay whichever is larger,
  never both. While a fund is small the plan is the only fee; once a fund grows large
  enough that the 0.10% for the year would be more than your plan, you pay that instead.
  A family never pays two fees on one fund." (Do NOT cite a fixed crossover dollar
  amount in customer copy: it is ~$29k for an annual Kiddo+ but ~$48k for a monthly
  Kiddo+, since the crossover is the annual-equivalent subscription / 0.10%. Internal
  memo above carries the precise annual figures + the monthly caveat.)

This keeps "clear to customers" prepared and on-voice for the moment the gates clear,
without shipping a claim before it is true.

## Gating

The 0.10% AUM is display-only and counsel-gated until live custody
(`BUSINESS_STRUCTURE.md`, `COUNSEL_ENGAGEMENT_PACKET.md`). This memo is a model
decision, not a code change; implement the chosen structure when custody goes live.
