# Kiddo — Revenue & Pricing Model (canonical, 2026)

> Created 2026-05-26. The committed revenue/pricing model + future + growth
> levers + low-hanging fruit. Completes the strategy trio with
> `ARCHITECTURE_2026.md` (how it's built + legal) and `GTM.md` (how it grows).
>
> **Supersedes `REVENUE_MODEL_CURRENT_STATE.md`,** which is stale: it lists
> gifter contribution fees ($2 flat / 1% over $200) and a large-gift fee that
> are all **retired** — those constants are `0` in `shared/monetization.ts`,
> and **gifters never pay.** It also uses pre-pricing-v3 prices and the old
> "Kado" name. The current truth is below.

---

## First principle: it's a STACK, not a fee

EarlyBird relied on a single ~$5/mo sub and died at $480K ARR. **No single
stream is big enough early.** Survival = stacking brand-safe streams now while
the real prize (kid-2.0 LTV) is years out. Stop asking "what's the price" and
ask "what's the stack."

---

## Current model (verified against `shared/monetization.ts` + the pricing-v3 lock)

- **Subscriptions:** Free / **Plus $3.99/mo or $29/yr** / **Family $6.99/mo or
  $59/yr** / **Founding $19/yr lifetime** (cap 1,000). Plus gates parent
  features (recurring, custom mix, co-parent, parent-authored media); Family =
  Plus across all kids in the household.
- **Gifters NEVER pay.** The old "$2 flat / 1% over $200 / 0.1% large-gift"
  fees are **retired** (`KORA_FREE_GIFT_FEE`, `KORA_FREE_VARIABLE_RATE`,
  `KORA_LARGE_GIFT_*` all `0`). Kid View is free. Viewing is never gated;
  authoring is the Plus differential.
- **AUM 0.10%** — the **post-handoff** mechanism (bimodal model: subscription
  for the parent-custodian pre-majority, AUM for the kid-owner post-majority).
- **Stripe-first** for gift checkout, subscriptions, and billing portal.

---

## Pricing model — and the brutal truths

1. **You're at EarlyBird's exact price band — the one that died.** Pricing is
   *not* your lever. Don't race lower (Target, not Walmart), and don't expect a
   few dollars more to fix unit economics. CAC + the stack + LTV fix it.
2. **The RIA fork rewrites the AUM fee** (see `ARCHITECTURE_2026.md`). Go
   self-directed to avoid RIA → you likely **drop the 0.10% AUM advisory fee**
   and lean on sub + float + sponsorship + B2B2C. Register as an RIA → keep it.
   This is the single pricing decision that matters; it's the lawyer call.
3. **Willingness-to-pay is unproven; founding members are the test.** The $19/yr
   take-rate is your cleanest pre-launch signal — watch it.

---

## The revenue stack (forward) — honest sizing

| Stream | Near-term | At scale | Notes |
|---|---|---|---|
| **Parent subscription** | small | moderate | The base. Necessary, insufficient (EarlyBird's proof). |
| **Cash-float interest** | small | high-margin | Interest on uninvested gift cash. Alpaca pays ~3.6% on cash — confirm the **partner spread split**. Passive, never touches the user. |
| **Gifter-sponsors-Plus** | small | moderate | The *only* brand-safe way to monetize gifters — they buy a sub, not pay a toll. Already built. |
| **B2B2C** | the real near-term scaler | could exceed B2C | One employer = hundreds of parents at ~zero CAC + high ACV. See `B2B_GIFTING_SPEC.md`. |
| **AUM 0.10%** (conditional on RIA) | ≈ $0 | compounds for decades | ~$5/yr on a $5k fund. A scale/future asset, not a near-term lever. |
| **18-handoff keepsake** (premium Memory Book print/binding) | — | the emotional-climax upsell | The one moment families pay real money. The future "Legacy" tier. |
| **Kid-2.0 funnel** (Roth → banking → P2P → interchange) | — | the whole thesis | The 40-year LTV that makes you worth more than EarlyBird's $5/mo. |

**Honest near-term reality:** B2B2C + founding members + sponsorship are your
real early dollars; sub + float are thin; AUM ≈ $0; kid-2.0 is deferred. Don't
let "we also have AUM + kid-2.0" comfort you about *near-term* economics.

---

## The future (where real money comes from at scale)

The thesis isn't "more subs." It's the **kid-2.0 funnel**: the 18-handoff routes
the now-adult into Roth → banking → adult brokerage → P2P. That's Greenlight-style
**interchange + a 40-year relationship + eventually their own kids' funds** — the
only LTV story that beats EarlyBird's few-years-of-$5/mo. Plus **AUM compounding**
as funds mature and multiply, and **B2B2C scaling** past B2C. All deferred; all
the reason you're not just a prettier EarlyBird.

---

## Growth levers (ranked by leverage)

1. **Gifter→parent conversion rate** — the loop's k-factor. 0.5%→2% quadruples
   organic growth at *zero* CAC. The #1 lever. (Instrumented: `gaveToOthersFundBefore`.)
2. **B2B2C deals** — step-function: each = hundreds of parents, near-zero CAC.
3. **Free→paid conversion** — turns the free base into revenue. (Instrumented:
   `plan_purchased`.)
4. **Recurring adoption** (parent contributions + recurring gifters) — compounds
   AUM + retention.
5. **Gifter-sponsors-Plus attach rate** — monetizes the gifter base, loop-safe.
6. **Multi-kid / Family expansion** — more funds per household.
7. **Float optimization** — passive revenue scaling with assets.

---

## Low-hanging fruit (cheap, high-ROI, do-now)

- **EarlyBird-orphan capture + `/earlybird-alternative` page** — warm, urgent,
  ~free. Highest-ROI thing this week. (See `GTM.md`.)
- **Sharpen the post-gift "start one for yours" moment** — tiny UX, massive
  leverage on lever #1 (the visceral "$50 → $X at 18" pitch).
- **Surface gifter-sponsors-Plus harder** — already built; push it.
- **Turn on cash float the day custody is live** — passive money, zero product work.
- **One B2B2C manual pilot** — one yes validates the whole CAC escape.
- **Founding-members push** — willingness-to-pay proof + pre-launch capital +
  advocates in one.
- **15-minute delayed data** — a cost cut is effective revenue; on-brand.
- **Recurring-gift restoration** (already scoped) — drives AUM + retention.

---

## The synthesis (what to actually do)

Don't fiddle pricing — it's not the lever, and it's locked sensibly. Don't chase
the AUM fee if it triggers RIA — decide that consciously with the lawyer. **Pour
energy into the two levers that move the model: gifter→parent conversion (sharpen
the loop UX, measure weekly) and one B2B2C yes.** Stack the brand-safe streams
(sub + float + sponsorship) underneath, and keep the kid-2.0 funnel as the north
star that justifies the whole thing existing. The pricing is fine; the **stack
and the loop** are the company.
