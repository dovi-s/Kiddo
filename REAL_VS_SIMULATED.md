# Real vs. Simulated — and the custody-wiring map

What's genuinely real in Kiddo today, what's a local simulation, and the exact
list of swaps that flips "paper" → "legit" when a custodian (DriveWealth /
Alpaca / Apex) is wired. Verified against the code 2026-05-31. This is the
faithful current-state map AND the spec for the highest-value future milestone.

## The three layers
1. **Market prices (real, custodian-independent).** Two third-party feeds, *not*
   a custodian:
   - Per-stock **chart**: Yahoo Finance (`routes.ts:12249`, `query1.finance.yahoo.com/.../chart/{ticker}`).
   - Live **valuation quote**: `getMarketQuote` (`server/marketQuotes.ts`) — provider
     **Finnhub / Alpha Vantage** → in-memory cache → file cache → per-ticker
     **estimate** (last resort). Returns null only for a ticker not in
     `ADMIN_ASSET_UNIVERSE`.
2. **Holdings / cost basis / gains / "worth today" (local simulation).** On gift
   settle (`webhookHandlers.ts` `investGiftImmediatelyIfNeeded`, ~595+), the app
   writes a `holdings` row: `shares = dollars ÷ live price`, `costBasis = dollars`,
   `currentValue` then tracks `shares × price`. **No brokerage account holds these
   shares; no buy order is placed.** It's paper-trading at real prices. `funds.balance`
   is recomputed from `sum(holdings.current_value)` (`routes.ts:19575`).
3. **DriveWealth / custodian (the not-yet-wired layer).** Scaffold stub only
   (`driveWealthAccountSetup.ts`, `custodianTransfer.ts`). This is the layer that
   makes layer 2 *real*: execution, custody, SIPC, 1099s, authoritative share count.

## Real vs. simulated today — precise
| Thing | Status |
|---|---|
| Gift dollars (Stripe) | **Real** (mocked in demo) |
| Market prices / the up-and-down | **Real** (Yahoo chart; Finnhub/Alpha Vantage quote) |
| Cost-basis math | **Real** (dollars invested) |
| The *holding itself* (owning shares) | **Simulated** — DB ledger, no brokerage |
| Trade execution | **Simulated** — no buy order ever placed |
| 1099 tax forms | **None** — page says "once investing is live" everywhere |
| 0.10% AUM fee | **Display-only estimator** (`estimateAnnualAumFee`); nothing charged |
| Demo (Rivera) holdings + multi-year history | **Seed-fabricated** (see below) |

## How the demo works (so it's not mistaken for live)
The demo *is* the real app with seeded data — same code paths. The differences:
- **Holdings are seeded directly** (`seed-dunphys.ts:181-245`: `{ticker, shares,
  costBasis, currentValue}` hardcoded), so the demo never runs the settle path and
  its per-holding values are fixed at seed time, not live-revalued.
- **The 17-year growth curve is synthetic** — the seed generates a "real-shape"
  return series (~7%/yr + realistic monthly noise) because there's no genuine trade
  history for fictional people.
- **The per-stock detail chart is live** (real ticker → real Yahoo data).
- **"Dollar amounts reset periodically"** = re-baked on each reseed.

## 🔧 The custody-wiring swap list — paper → legit
When the custodian is wired (behind the `custodianService` interface per CLAUDE.md —
never inline in `routes.ts`), these are the swaps:
1. **Execution** — on gift settle, place a real buy with the custodian instead of
   writing a simulated `holdings` row. Share count + fill price come back from the
   broker, not from `getMarketQuote`.
2. **Authoritative positions** — holdings/`funds.balance` reconcile against the
   custodian's position of record, not the local quote-derived value.
3. **SIPC / segregation** — real account, real protection (the copy is already
   entity-agnostic and conditional; flip from "once investing is live").
4. **1099s** — real forms slot into the Tax Documents empty state (built to accept
   them with no rebuild).
5. **AUM fee collection** — turn on the collector per `AUM_FEE_COLLECTION_SPEC.md`
   (cash-first, never force a taxable share sale). Today it's display-only.
6. **Orphan reconciliation** — `giftOrphanMonitorWorker.ts` already watches for
   charged-but-not-invested gifts; it becomes load-bearing the moment a real BD can
   reject a transfer.

## ⚠️ Known latent edges to fix AT custody time (harmless in sim, real-money then)
- **Fabricated price → wrong share count.** Settle uses `price = quote?.price || 100`
  (`webhookHandlers.ts:610,670`; `routes.ts:9473`) and `getMarketQuote` bottoms out at
  a bare `$100` for a universe ticker with no configured estimate
  (`marketQuotes.ts:233`). Either path records `shares = dollars ÷ $100` — permanently
  wrong, and it fabricates a gain when later re-priced. **Hardened 2026-05-31:** the
  bare-$100 path now logs a loud ops warning so the gap is visible. **At custody:** the
  settle path should **park dollars as cash** when no real fill price is available
  (the honest pattern already used for a missing ticker at `webhookHandlers.ts:604-607`)
  rather than fabricate a price. Real execution removes the issue entirely (the broker
  returns the real fill).
- **Demo holding values are fixed** between reseeds (seeded, not live-revalued); only
  the detail chart is live. Fine for an illustrative demo; not a real-fund behavior.

## One-line mental model
Prices are real (two feeds) → holdings are a real-priced **simulation** → the
custodian is the one swap that turns the simulation into real, custodied, taxable
positions. Everything that says "once investing is live" is gated on that swap.
