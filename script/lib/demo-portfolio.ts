// Pure (DB-free) financial core for the Dunphy demo seed.
//
// Turns a gift schedule into REAL share positions using committed historical
// prices (script/data/historical-prices.json). Every gift buys shares at the
// actual adjusted close on its month; the only position changes after that are
// the product's automatic age-based glide-path (de-risking the managed index
// sleeve as the child nears majority) — NOT discretionary trading.
//
// Because it's pure and imports no server/DB code, the seed AND a tsx test
// harness both call it: the harness verifies emergent balances offline (no
// Postgres), the seed writes the same numbers to the DB.

import { readFileSync } from "node:fs";
import path from "node:path";

export type TickerHistory = {
  current: number;
  currentAsOf: string;
  monthly: Record<string, number>; // "YYYY-MM" -> adjusted close (full history)
  daily?: Record<string, number>; // "YYYY-MM-DD" -> adjusted close (last ~400d)
};
export type PriceData = Record<string, TickerHistory>;

let _prices: PriceData | null = null;
export function loadPrices(): PriceData {
  if (_prices) return _prices;
  const file = path.join(process.cwd(), "script", "data", "historical-prices.json");
  _prices = JSON.parse(readFileSync(file, "utf8")) as PriceData;
  return _prices;
}

export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Adjusted close for a ticker at (or just before) a month. Returns null if the
// ticker wasn't trading yet (date precedes its earliest data).
export function priceOn(prices: PriceData, ticker: string, key: string): number | null {
  const h = prices[ticker];
  if (!h) return null;
  if (h.monthly[key] != null) return h.monthly[key];
  // Walk backward up to 6 months to bridge any single missing bar.
  const [y, m] = key.split("-").map(Number);
  for (let back = 1; back <= 6; back++) {
    let yy = y;
    let mm = m - back;
    while (mm <= 0) { mm += 12; yy -= 1; }
    const k = `${yy}-${String(mm).padStart(2, "0")}`;
    if (h.monthly[k] != null) return h.monthly[k];
  }
  // Before inception entirely → null (caller decides how to handle).
  const keys = Object.keys(h.monthly).sort();
  if (keys.length && key < keys[0]) return null;
  // After last bar (shouldn't happen for past dates) → use current.
  return h.current;
}

export function currentPrice(prices: PriceData, ticker: string): number {
  const h = prices[ticker];
  if (!h) throw new Error(`no price data for ${ticker}`);
  return h.current;
}

function dayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// Adjusted close at a specific DATE: uses the real daily bar when the date is
// within the daily window (walking back a few days over weekends/holidays),
// otherwise falls back to the month's close. Lets the recent chart (1W/1M/1Y)
// move day-to-day with real market movement while deep history stays monthly.
export function priceOnDate(prices: PriceData, ticker: string, date: Date): number | null {
  const h = prices[ticker];
  if (!h) return null;
  if (h.daily) {
    const d = new Date(date);
    for (let back = 0; back <= 6; back++) {
      const k = dayKey(d);
      if (h.daily[k] != null) return h.daily[k];
      d.setUTCDate(d.getUTCDate() - 1);
    }
  }
  return priceOn(prices, ticker, monthKey(date));
}

// Earliest date (ms) for which we have real daily bars (across any ticker that
// has them). Before this, the chart is monthly-resolution; on/after it, daily.
export function dailyStartMs(prices: PriceData): number {
  let min = Infinity;
  for (const h of Object.values(prices)) {
    if (!h.daily) continue;
    for (const k of Object.keys(h.daily)) {
      const t = new Date(`${k}T00:00:00Z`).getTime();
      if (t < min) min = t;
    }
  }
  return min === Infinity ? Date.now() : min;
}

// Portfolio market value as of a specific DATE (replays events up to that
// instant, values positions at that date's price — daily if available, else
// the month's close). Used for the snapshot chart so recent points are real
// day-to-day, not flat-within-a-month.
export function portfolioValueAtDate(prices: PriceData, events: BuildResult["events"], date: Date): { invested: number; basis: number } {
  const cutoff = date.getTime();
  const positions: Positions = new Map();
  for (const ev of events) {
    if (new Date(ev.date).getTime() > cutoff) break;
    if (ev.kind === "gift" && ev.gift) {
      for (const a of ev.gift.allocations) addShares(positions, a.ticker, a.shares, a.costBasis);
    } else if (ev.kind === "rebalance" && ev.rebalance) {
      const target = MIX_TARGETS[ev.rebalance.to];
      const key = monthKey(ev.date);
      let sleeveValue = 0;
      let sleeveBasis = 0;
      for (const t of SLEEVE_TICKERS) {
        const p = positions.get(t);
        if (!p) continue;
        const px = priceOn(prices, t, key);
        if (px == null) continue;
        sleeveValue += p.shares * px;
        sleeveBasis += p.costBasis;
      }
      if (sleeveValue > 0) {
        for (const t of SLEEVE_TICKERS) {
          const px = priceOn(prices, t, key);
          if (px == null) continue;
          positions.set(t, { shares: (sleeveValue * (target[t] ?? 0)) / px, costBasis: sleeveBasis * (target[t] ?? 0) });
        }
      }
    }
  }
  let invested = 0;
  let basis = 0;
  for (const [t, p] of Array.from(positions)) {
    const px = priceOnDate(prices, t, date);
    if (px == null) continue;
    invested += p.shares * px;
    basis += p.costBasis;
  }
  return { invested, basis };
}

// The managed index sleeve and its target weights per strategy. Contributions
// always buy the GROWTH target (the lifelong accumulation default); the
// glide-path rebalances the sleeve toward balanced/conservative at age
// milestones. Mirrors the real product's managed presets (server
// DEFAULT_INVESTMENT_CONFIG) — growth went ALL-EQUITY 2026-06-11 (was
// VTI 62 / VXUS 28 / BND 10), so demo growth holdings match production.
// (ACCOUNT_MODEL.md §2b may want the same growth update.)
export const MIX_TARGETS: Record<"growth" | "balanced" | "conservative", Record<string, number>> = {
  growth: { VTI: 0.70, VXUS: 0.30 },
  balanced: { VTI: 0.50, VXUS: 0.25, BND: 0.25 },
  conservative: { VTI: 0.42, VXUS: 0.18, BND: 0.40 },
};
const SLEEVE_TICKERS = ["VTI", "VXUS", "BND"];

// Split a dollar amount across mix weights, redistributing any sleeve that
// wasn't trading yet at `key` (e.g. VXUS before 2011) onto the survivors,
// pro-rata by their weights. Keeps the math honest for deep-history gifts.
function allocateMix(
  prices: PriceData,
  amount: number,
  key: string,
  weights: Record<string, number>,
): Array<{ ticker: string; dollars: number }> {
  // Only sleeves that (a) were trading at `key` AND (b) carry a positive weight
  // for this strategy. The weight>0 guard matters now that the Growth target is
  // all-equity (no BND): without it, a 0-weight sleeve would still get a $0 leg
  // and seed an ugly "Bonds $0.00" holding/ledger row.
  const active = SLEEVE_TICKERS.filter((t) => priceOn(prices, t, key) != null && (weights[t] ?? 0) > 0);
  const activeWeightSum = active.reduce((s, t) => s + (weights[t] ?? 0), 0);
  if (activeWeightSum <= 0) {
    // Nothing in the sleeve traded yet — put it all in the broadest survivor.
    return [{ ticker: active[0] ?? "VTI", dollars: amount }];
  }
  return active.map((t) => ({ ticker: t, dollars: amount * ((weights[t] ?? 0) / activeWeightSum) }));
}

export type Position = { shares: number; costBasis: number };
export type Positions = Map<string, Position>;

function addShares(pos: Positions, ticker: string, shares: number, dollars: number) {
  const p = pos.get(ticker) ?? { shares: 0, costBasis: 0 };
  p.shares += shares;
  p.costBasis += dollars;
  pos.set(ticker, p);
}

// A gift to process. `ticker` set => single-stock pick; undefined => managed mix.
export type GiftInput = {
  date: string;       // ISO
  amount: number;     // gross dollars invested
  ticker?: string;    // pick ticker, or undefined for the diversified mix
};

export type GiftAllocationResult = {
  ticker: string;
  shares: number;
  costBasis: number;
};

export type ProcessedGift = GiftInput & {
  sharesAcquired: number;
  priceAtPurchase: number; // blended = amount / sharesAcquired
  allocations: GiftAllocationResult[];
};

// Resolve ONE gift into real share lots at its month's historical price. Pure
// and independent of other gifts (a buy only depends on its own date), so the
// seed calls this per gift to write gift.sharesAcquired / priceAtPurchase and
// the gift_allocations ledger rows. Single-stock pick when `ticker` is set;
// otherwise the diversified managed mix (growth target, with any not-yet-
// trading sleeve redistributed onto the survivors).
export function allocateGift(prices: PriceData, gift: GiftInput): ProcessedGift {
  const key = monthKey(gift.date);
  const legs = gift.ticker
    ? [{ ticker: gift.ticker, dollars: gift.amount }]
    : allocateMix(prices, gift.amount, key, MIX_TARGETS.growth);
  const allocations: GiftAllocationResult[] = legs.map((leg) => {
    const px = priceOn(prices, leg.ticker, key);
    if (px == null || px <= 0) {
      throw new Error(`No price for ${leg.ticker} at ${key} (gift ${gift.date})`);
    }
    return { ticker: leg.ticker, shares: leg.dollars / px, costBasis: leg.dollars };
  });
  const sharesAcquired = allocations.reduce((s, a) => s + a.shares, 0);
  return {
    ...gift,
    sharesAcquired,
    priceAtPurchase: sharesAcquired > 0 ? gift.amount / sharesAcquired : 0,
    allocations,
  };
}

// Glide-path rebalance: at `date`, reset the managed sleeve (VTI/VXUS/BND) to
// the target weights. No new money; aggregate sleeve cost basis is preserved
// and redistributed pro-rata to the new per-ticker values. Single-stock gift
// holdings are untouched (they're intentional picks, not the managed pot).
export type Rebalance = { date: string; to: "balanced" | "conservative" };

export type BuildResult = {
  positions: Positions;
  processedGifts: ProcessedGift[];
  // Sorted timeline of events for snapshot replay.
  events: Array<{ date: string; kind: "gift" | "rebalance"; gift?: ProcessedGift; rebalance?: Rebalance }>;
};

export function buildPortfolio(
  prices: PriceData,
  gifts: GiftInput[],
  rebalances: Rebalance[] = [],
): BuildResult {
  // Interleave gifts + rebalances chronologically.
  const timeline: Array<{ date: string; kind: "gift" | "rebalance"; gift?: GiftInput; rebalance?: Rebalance }> = [
    ...gifts.map((g) => ({ date: g.date, kind: "gift" as const, gift: g })),
    ...rebalances.map((r) => ({ date: r.date, kind: "rebalance" as const, rebalance: r })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const positions: Positions = new Map();
  const processedGifts: ProcessedGift[] = [];
  const events: BuildResult["events"] = [];

  for (const ev of timeline) {
    const key = monthKey(ev.date);
    if (ev.kind === "gift" && ev.gift) {
      const processed = allocateGift(prices, ev.gift);
      for (const a of processed.allocations) addShares(positions, a.ticker, a.shares, a.costBasis);
      processedGifts.push(processed);
      events.push({ date: ev.date, kind: "gift", gift: processed });
    } else if (ev.kind === "rebalance" && ev.rebalance) {
      const target = MIX_TARGETS[ev.rebalance.to];
      // Value the managed sleeve at this date.
      let sleeveValue = 0;
      let sleeveBasis = 0;
      for (const t of SLEEVE_TICKERS) {
        const p = positions.get(t);
        if (!p) continue;
        const px = priceOn(prices, t, key);
        if (px == null) continue;
        sleeveValue += p.shares * px;
        sleeveBasis += p.costBasis;
      }
      if (sleeveValue > 0) {
        for (const t of SLEEVE_TICKERS) {
          const px = priceOn(prices, t, key);
          if (px == null) continue;
          const targetValue = sleeveValue * (target[t] ?? 0);
          positions.set(t, {
            shares: targetValue / px,
            costBasis: sleeveBasis * (target[t] ?? 0), // preserve aggregate basis
          });
        }
      }
      events.push({ date: ev.date, kind: "rebalance", rebalance: ev.rebalance });
    }
  }

  return { positions, processedGifts, events };
}

// Portfolio market value as of a month (replays events up to that month).
export function portfolioValueAt(prices: PriceData, events: BuildResult["events"], key: string): { invested: number; basis: number } {
  const positions: Positions = new Map();
  for (const ev of events) {
    if (monthKey(ev.date) > key) break;
    if (ev.kind === "gift" && ev.gift) {
      for (const a of ev.gift.allocations) addShares(positions, a.ticker, a.shares, a.costBasis);
    } else if (ev.kind === "rebalance" && ev.rebalance) {
      const target = MIX_TARGETS[ev.rebalance.to];
      let sleeveValue = 0;
      let sleeveBasis = 0;
      for (const t of SLEEVE_TICKERS) {
        const p = positions.get(t);
        if (!p) continue;
        const px = priceOn(prices, t, monthKey(ev.date));
        if (px == null) continue;
        sleeveValue += p.shares * px;
        sleeveBasis += p.costBasis;
      }
      if (sleeveValue > 0) {
        for (const t of SLEEVE_TICKERS) {
          const px = priceOn(prices, t, monthKey(ev.date));
          if (px == null) continue;
          positions.set(t, { shares: (sleeveValue * (target[t] ?? 0)) / px, costBasis: sleeveBasis * (target[t] ?? 0) });
        }
      }
    }
  }
  let invested = 0;
  let basis = 0;
  for (const [t, p] of Array.from(positions)) {
    const px = priceOn(prices, t, key);
    if (px == null) continue;
    invested += p.shares * px;
    basis += p.costBasis;
  }
  return { invested, basis };
}

// Final holdings rolled up from positions, valued at the current price.
export type Holding = { ticker: string; shares: number; costBasis: number; currentValue: number; gain: number };
export function holdingsFromPositions(prices: PriceData, positions: Positions): Holding[] {
  const out: Holding[] = [];
  for (const [ticker, p] of Array.from(positions)) {
    if (p.shares <= 1e-9) continue;
    const currentValue = p.shares * currentPrice(prices, ticker);
    out.push({
      ticker,
      shares: p.shares,
      costBasis: p.costBasis,
      currentValue,
      gain: currentValue - p.costBasis,
    });
  }
  return out;
}

export function totalValue(holdings: Holding[]): number {
  return holdings.reduce((s, h) => s + h.currentValue, 0);
}
