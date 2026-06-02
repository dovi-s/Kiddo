// One-time dev-tool: fetch real historical monthly prices for the demo seed.
//
// The Dunphy demo (script/seed-dunphys.ts) buys REAL shares at the REAL
// historical price on each gift's date, so balances are emergent from honest
// market math rather than hand-picked constants. To stay deterministic AND
// offline-reproducible, we fetch once here and COMMIT the result to
// script/data/historical-prices.json; the seed only ever reads that fixture.
//
// Run: `npm run fetch:historical-prices` (or `tsx script/fetch-historical-prices.ts`)
//
// Source: Yahoo Finance v8 chart endpoint (same one server/routes.ts already
// uses for client charts). We take ADJUSTED close (split + dividend adjusted),
// i.e. true total-return: shares = dollars / adjClose(date), and
// currentValue = shares * currentPrice correctly reflects total return
// including splits (AAPL 4:1, GOOGL 20:1) and reinvested dividends. The
// share counts are therefore total-return-equivalent, which is the honest
// "what the gift grew to" — exactly what a demo should show.

import { promises as fsp } from "node:fs";
import path from "node:path";

// Tickers the demo uses: single-stock picks + the diversified-mix sleeves.
//   AAPL (Mitchell), GOOGL (Jay), DIS (Gloria/Cam), RBLX (Manny),
//   VTI/VXUS/BND (the auto-invest managed mix: Phil recurring, Claire, etc.)
const TICKERS = ["AAPL", "GOOGL", "DIS", "RBLX", "VTI", "VXUS", "BND"] as const;

type TickerHistory = {
  current: number;
  currentAsOf: string;
  // month-key "YYYY-MM" -> adjusted close (deep history, full fund life)
  monthly: Record<string, number>;
  // day-key "YYYY-MM-DD" -> adjusted close (last ~400 days, so the 1W/1M/1Y
  // chart tabs move with real day-to-day market movement)
  daily: Record<string, number>;
};

// Fetch one interval (1mo or 1d) over an explicit window and return a key->close
// map plus the meta current price. NOT range=max: it downsamples long histories
// to ~quarterly. Keys are "YYYY-MM" (monthly) or "YYYY-MM-DD" (daily).
async function fetchSeries(
  ticker: string,
  interval: "1mo" | "1d",
  period1: number,
  period2: number,
): Promise<{ map: Record<string, number>; current: number | undefined }> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}&includeAdjustedClose=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Kiddo/1.0)" },
  });
  if (!res.ok) throw new Error(`${ticker} (${interval}): HTTP ${res.status}`);
  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`${ticker} (${interval}): no chart result`);
  const timestamps: number[] = result.timestamp ?? [];
  const adj: (number | null)[] =
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    [];
  const map: Record<string, number> = {};
  for (let i = 0; i < timestamps.length; i++) {
    const close = adj[i];
    if (close == null || !Number.isFinite(close)) continue;
    const d = new Date(timestamps[i] * 1000);
    const key = interval === "1mo"
      ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    map[key] = Math.round(close * 10000) / 10000;
  }
  return { map, current: result.meta?.regularMarketPrice };
}

async function fetchTicker(ticker: string): Promise<TickerHistory> {
  const now = Math.floor(Date.now() / 1000);
  // Monthly: 2005 → now (the demo's oldest fund is ~18 years).
  const monthlyP1 = Math.floor(Date.UTC(2005, 0, 1) / 1000);
  // Daily: last ~400 days (covers the 1Y/1M/1W chart tabs with real dailies).
  const dailyP1 = now - 400 * 24 * 60 * 60;

  const monthlyRes = await fetchSeries(ticker, "1mo", monthlyP1, now);
  await new Promise((r) => setTimeout(r, 250));
  const dailyRes = await fetchSeries(ticker, "1d", dailyP1, now);

  const current = monthlyRes.current ?? dailyRes.current;
  if (current == null || !Number.isFinite(current)) {
    throw new Error(`${ticker}: no current price in meta`);
  }

  return {
    current: Math.round(current * 10000) / 10000,
    currentAsOf: new Date().toISOString(),
    monthly: monthlyRes.map,
    daily: dailyRes.map,
  };
}

async function main() {
  const out: Record<string, TickerHistory> = {};
  for (const ticker of TICKERS) {
    process.stdout.write(`Fetching ${ticker} ... `);
    const h = await fetchTicker(ticker);
    const months = Object.keys(h.monthly).sort();
    const days = Object.keys(h.daily).sort();
    out[ticker] = h;
    console.log(
      `${months.length} months (${months[0]} → ${months[months.length - 1]}) + ${days.length} daily (${days[0] ?? "—"} → ${days[days.length - 1] ?? "—"}), current $${h.current}`,
    );
    // Be polite to Yahoo between calls.
    await new Promise((r) => setTimeout(r, 400));
  }

  const dir = path.join(process.cwd(), "script", "data");
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, "historical-prices.json");
  await fsp.writeFile(file, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${file}`);
}

main().catch((err) => {
  console.error("\nfetch-historical-prices failed:", err?.message ?? err);
  process.exit(1);
});
