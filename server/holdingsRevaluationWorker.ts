// holdingsRevaluationWorker — marks simulated holdings to market.
//
// WHY: pre-custody (INVESTING_LIVE=false) holdings are simulated — the DB stores
// `shares` + a `currentValue`/`gain` that were frozen at COST when the gift was
// invested (webhookHandlers sets currentValue = costBasis, gain = 0). Nothing
// ever re-prices them, so every position sits flat forever and the app never
// reflects real market movement even though `marketQuotes.ts` has live prices.
//
// WHAT: on an interval, revalue each holding at the real current price
// (currentValue = shares × livePrice, gain = currentValue − costBasis) and
// PERSIST it, then recompute + persist each fund's stored aggregates
// (balance = Σ currentValue, totalGain = Σ gain, gainPercent). Persisting (vs.
// computing on read) is deliberate: the dashboard sums holdings.currentValue but
// ~10 other surfaces (sidebar, FundsOverview, KidView, MemoryBook, snapshots,
// cross-fund roll-up) read the STORED funds.balance/totalGain and have no
// holdings query — writing the fields keeps every surface consistent at once.
// `balance` keeps its existing meaning (invested value only); cashBalance /
// pendingBalance are NOT touched (they aren't market-priced).
//
// SAFETY:
//   • OFF by default — set HOLDINGS_REVALUATION_MINUTES > 0 to enable.
//   • Never runs once custody is live (INVESTING_LIVE): a real broker owns the
//     valuation then, not this simulation.
//   • Skips any holding whose quote is an estimate fallback (isEstimate) so a
//     missing provider price never bakes a fabricated $ value into stored money.
//   • Only writes when the value actually moved (avoids pointless churn/updatedAt
//     bumps every tick).

import { pool } from "./db";
import { storage } from "./storage";
import { getMarketQuotes } from "./marketQuotes";
import { INVESTING_LIVE } from "@shared/legal-copy";

let running = false;

export async function runHoldingsRevaluationWorker(
  log: (message: string, source?: string) => void = console.log,
): Promise<void> {
  if (running) return;
  if (INVESTING_LIVE) return; // real custody owns valuation once live
  running = true;
  try {
    const { rows } = await pool.query<{ fund_id: string }>(
      `SELECT DISTINCT fund_id FROM holdings WHERE fund_id IS NOT NULL`,
    );
    const fundIds = rows.map((r) => String(r.fund_id)).filter(Boolean);
    if (fundIds.length === 0) return;

    // Load every fund's holdings once, collect the distinct tickers, and
    // batch-quote them in a single pass (marketQuotes dedupes + caches).
    const fundHoldings = new Map<string, any[]>();
    const tickers = new Set<string>();
    for (const fundId of fundIds) {
      const hs = await storage.getHoldingsByFund(fundId);
      fundHoldings.set(fundId, hs);
      for (const h of hs) {
        const t = String(h.ticker || "").trim().toUpperCase();
        if (t) tickers.add(t);
      }
    }
    if (tickers.size === 0) return;
    const quotes = await getMarketQuotes(Array.from(tickers));

    let revaluedHoldings = 0;
    let revaluedFunds = 0;
    let skippedEstimate = 0;

    for (const fundId of fundIds) {
      const hs = fundHoldings.get(fundId) || [];
      let anyChange = false;

      for (const h of hs) {
        const ticker = String(h.ticker || "").trim().toUpperCase();
        const shares = parseFloat(h.shares || "0");
        const quote = ticker ? quotes.get(ticker) : undefined;
        if (!quote || !(quote.price > 0) || !(shares > 0)) continue;
        // Never persist a fabricated value — only real provider prices.
        if (quote.isEstimate) { skippedEstimate++; continue; }

        const newValue = shares * quote.price;
        const prevValue = parseFloat(h.currentValue || "0");
        if (Math.abs(newValue - prevValue) < 0.005) continue; // unchanged

        const costBasis = parseFloat(h.costBasis || "0");
        const newGain = newValue - costBasis;
        await storage.updateHolding(h.id, {
          currentValue: newValue.toFixed(2),
          gain: newGain.toFixed(2),
        });
        // Keep the in-memory row current so the fund aggregate below is exact.
        h.currentValue = newValue.toFixed(2);
        h.gain = newGain.toFixed(2);
        revaluedHoldings++;
        anyChange = true;
      }

      if (!anyChange) continue;
      // Recompute the fund's stored aggregates from the now-market-valued rows.
      // balance keeps its "invested value" meaning (Σ currentValue); cash/pending
      // are separate columns and intentionally left alone.
      const sumValue = hs.reduce((s, h) => s + parseFloat(h.currentValue || "0"), 0);
      const sumCost = hs.reduce((s, h) => s + parseFloat(h.costBasis || "0"), 0);
      const totalGain = sumValue - sumCost;
      const gainPercent = sumCost > 0 ? (totalGain / sumCost) * 100 : 0;
      await storage.updateFund(fundId, {
        balance: sumValue.toFixed(2),
        totalGain: totalGain.toFixed(2),
        gainPercent: gainPercent.toFixed(2),
      });
      revaluedFunds++;
    }

    if (revaluedHoldings > 0) {
      log(
        `revalued ${revaluedHoldings} holding(s) across ${revaluedFunds} fund(s) at live prices` +
          (skippedEstimate > 0 ? ` (${skippedEstimate} skipped — estimate-only quote)` : ""),
        "holdings-revaluation-worker",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`holdings revaluation failed: ${message}`, "holdings-revaluation-worker");
  } finally {
    running = false;
  }
}

export function startHoldingsRevaluationWorker(
  log: (message: string, source?: string) => void = console.log,
): NodeJS.Timeout | null {
  if (INVESTING_LIVE) return null;
  const minutes = Number(process.env.HOLDINGS_REVALUATION_MINUTES || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return null; // OFF by default
  const intervalMs = Math.max(minutes, 5) * 60 * 1000;
  void runHoldingsRevaluationWorker(log);
  const interval = setInterval(() => void runHoldingsRevaluationWorker(log), intervalMs);
  log(
    `holdings revaluation worker started (every ${Math.max(minutes, 5)} min, live prices on simulated shares)`,
    "holdings-revaluation-worker",
  );
  return interval;
}
