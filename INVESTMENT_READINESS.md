# Investment offering — go-live readiness

**Date:** 2026-07-06
**Constraint:** `INVESTING_LIVE = false` (custodian is a stub; nothing executes yet).
Everything below is **custody-gated**: it does not block the doors opening (families
can gift, curate, and hold pre-investing), but it must be resolved before the
`CUSTODIAN_PROVIDER` flip, because it all switches on the same day real orders do.

## TL;DR
The *asset-selection* system is well-built and well-guarded. What's thin is
everything that happens to a security **after** it's bought. The one true "not built
at all" item is **dividends / corporate actions** — flag it loudest. The one true
"never tested" item is **reconciling our allowlist against the real custodian**.

## What's solid (no action)
- **Curation:** ~30 kid-recognizable stocks + an 8-ETF mix (VTI, VXUS, BND, VGT, VUG,
  VYM, SCHD, QQQ) + hold-as-cash. Three managed strategies + custom mix.
- **Server-side enforcement (not just client) — audited + closed 2026-07-06:**
  `isAllowedStockPick` gates the gift path (`routes.ts:13053`),
  `CUSTOM_STRATEGY_ALLOWED_TICKERS` gates custom mixes (`fundStrategyConfig.ts`), and
  the prefs / cash-deploy path checks `ADMIN_ASSET_UNIVERSE` (`routes.ts:10737`). The
  audit **found a real hole**: the recurring/one-time parent-contribution **create**
  (`routes.ts` POST `/api/funds/:id/parent-contributions`) and **edit** (PATCH
  `/api/parent-contributions/:id`) stored `selectedTicker` straight from the request
  body with no allowlist check, so a crafted request could point a "pick" schedule at
  any off-list / unsuitable ticker (harmless today with `INVESTING_LIVE=false`, but the
  recurring worker would try to buy it at go-live). **Both now guarded with
  `isAllowedStockPick`.** The in-app one-time gift routes through the (validated) gift
  path. Every user-input ticker path is now validated.
- **Legacy lifecycle exists:** CMCSA (Comcast) + ADBE (Adobe) are in the pricing
  universe but not the pick list = held-but-not-newly-pickable. Intended, not a bug.
- **Fractional proven:** the Alpaca client does notional/fractional orders (verified
  in sandbox). DriveWealth is unwired stubs (`custodianService.ts`).
- **Parents can constrain gift investing:** `GifterInvestmentRulesEditor` is a
  fund-wide "how gifts get invested" control. The gifter-authority concern is covered.

## The gaps (ranked by go-live weight)

### 1. Dividends & corporate actions — NOT BUILT ⭐ (the loudest)
Once live, the ETFs (VYM, SCHD, BND) and dividend stocks (KO, PEP, MCD) pay
dividends. There is **no** DRIP/reinvest logic, no "dividend to cash" path, no
activity row, and no split/merger/delisting handling beyond the legacy flag. A
dividend would silently move a balance with no story, on a "watch it grow" product.
- **Fix (code):** decide DRIP vs cash, represent it (activity row + holding effect),
  and handle splits/merges/delistings (map the custodian's corporate-action feed).
- **Owner:** eng, gated on the custodian pick (the custodian emits the events).
- **Projection-alignment sub-item (don't miss this):** the "~$50k at 21" projections
  already assume dividends reinvested — the 7% real / ~10% nominal rate is a
  *total-return* figure (`shared/projection.ts`), which by definition bakes in
  reinvested dividends. Two things must line up with that promise when live, or the
  product quietly contradicts its own headline math:
  1. **Enable DRIP at the custodian** (Alpaca supports automatic dividend
     reinvestment) so real dividends actually reinvest — matching the total-return
     assumption. If we instead choose dividend-to-cash, the projection rate is then
     overstated and should be revisited.
  2. **Make "growth so far" reflect total return.** Today the live dashboard gain is
     computed from Yahoo *price* quotes on simulated holdings = price-only, so it
     already *understates* real total return (misses the broad-ETF ~1.3% yield). When
     live, the displayed growth must include dividends, or "growth so far"
     (price-only) and the projection (total-return) speak different languages on the
     same screen.

### 2. Custodian-universe reconciliation — NEVER TESTED ⭐ (the binding gate)
Our allowlist has never been checked against the chosen custodian's actual
**tradable + fractionable** list, because nothing executes today. A ticker we allow
that the custodian won't fractionally trade = a failed buy on day one.
- **Fix:** once `CUSTODIAN_PROVIDER` is picked, script a reconcile of
  `ADMIN_ASSET_UNIVERSE` + `ETF_ALLOWLIST` + `STOCK_PICKS` against the custodian's
  tradable + fractionable universe; drop or flag any ticker that isn't both.
- **Owner:** eng, at custodian selection. Feeds `CUSTODIAN_VENDOR_DILIGENCE.md`.

### 3. No concentration limit — POLICY CALL
Nothing stops a fund being 100% one stock. For a minor's custodial account meant to
compound to 18, unbounded single-position weight is a suitability-adjacent gap.
- **Fix (policy → then code):** decide if there's a soft cap or nudge on single-stock
  weight; even a warning is defensible. No enforcement exists today.
- **Owner:** founder (policy), then eng.

### 4. No systematic suitability screen — GUARDRAIL GAP
The list is safe because it's hand-picked, but no *rule* stops a super-admin adding a
leveraged/inverse/penny/OTC ticker to `ADMIN_ASSET_UNIVERSE`.
- **Fix:** a guardrail on the admin-add path (block 3x/inverse/OTC/penny) so "allowed"
  is enforceable, not just curated. Also a counsel question (suitability for a minor).
- **Owner:** eng + counsel (ties to `COUNSEL_ENGAGEMENT_PACKET.md` Parts 1 & 9 — is
  curating/tagging picks "advice"?).

### 5. Idle cash earns nothing (surfaced) — PRODUCT + REVENUE
Uninvested cash just sits: no yield surfaced, no strong "invest it" pressure beyond
the existing card. Ties to the cash-sweep revenue question (`REVENUE_MODEL.md`).
- **Owner:** founder (product + monetization), not launch-blocking.

### 6. Rebalancing drift — DOCUMENTED TRADEOFF (not a bug)
"We don't sell to rebalance" (tax choice) means a large fund's managed mix drifts
from target over 18 years, unbounded. Fine, but worth one honest sentence to the
parent when a fund drifts far. Already partly surfaced in the strategy drift table.

## Pre-`CUSTODIAN_PROVIDER`-flip checklist
- [ ] Reconcile all four ticker lists against the chosen custodian's tradable +
      fractionable universe (gap #2).
- [ ] Build the dividend/corporate-action model (gap #1), AND align it with the
      projection's total-return promise: enable DRIP at the custodian + make
      "growth so far" include dividends (today it's price-only, so it diverges).
- [x] ~~Confirm one-time + recurring contribution paths server-validate the ticker.~~
      Done 2026-07-06 (found the create + edit gap, both now guarded).
- [ ] Founder: decide concentration policy (gap #3) + admin suitability guardrail (#4).
- [ ] Counsel: suitability of the offered set for a custodial minor + whether curation
      is "advice" (packet Parts 1 & 9).

## Cross-references
- `FOUNDER_ACTION_PLAN.md` — the overall launch gate (this is a custody-gated subset).
- `CUSTODIAN_VENDOR_DILIGENCE.md` — where gap #2's reconcile lands.
- `COUNSEL_ENGAGEMENT_PACKET.md` — Parts 1 & 9 (advice / suitability), gap #4.
- `SIPC_COPY_REVIEW.md` — the disclosure side of the same custody flip.
