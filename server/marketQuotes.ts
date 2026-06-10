import fs from "fs/promises";
import path from "path";

// Fallback prices used only when the live quote providers (Finnhub / Alpha
// Vantage) are unavailable — e.g. local dev / the public demo with no API key.
// They must stay roughly current, because surfaces that RECOMPUTE a position's
// value from a live quote × shares (the dashboard one-time card, Memory Book
// "now worth", etc.) use these when live fails. When they were stale (AAPL
// $214 while it traded ~$306), a real gift showed a fake LOSS because the
// holding was seeded at the true price but the card valued it at the stale one.
// The demo-relevant tickers below are kept in sync with the committed price
// fixture (script/data/historical-prices.json) so the demo is internally
// consistent. Refreshed 2026-06-02.
const AUTO_INVEST_PRICE_ESTIMATES: Record<string, number> = {
  VTI: 373.40,
  VXUS: 86.31,
  BND: 73.18,
  VGT: 572.9,
  DIS: 102.85,
  AAPL: 306.31,
  NKE: 80,
  TSLA: 250,
  NFLX: 700,
  RBLX: 47,
  SBUX: 85,
  AMZN: 200,
  GOOGL: 376.37,
  SPOT: 380,
};

export const MARKET_QUOTE_ESTIMATES: Record<string, number> = {
  ...AUTO_INVEST_PRICE_ESTIMATES,
  DIS: 102.85,
  AAPL: 306.31,
  NKE: 92.14,
  SBUX: 89.63,
  NFLX: 612.9,
  AMZN: 184.85,
  GOOGL: 376.37,
  TSLA: 171.27,
  SPOT: 618.92,
  RBLX: 47,
  MSFT: 415.00,
  MCD: 295.00,
  MAT: 19.00,
  HAS: 67.00,
  NVDA: 140.00,
  KO: 68.00,
  HSY: 185.00,
  CROX: 110.00,
};

export const ADMIN_ASSET_UNIVERSE: Record<string, { name: string; type: "ETF" | "Stock"; source: "auto_invest" | "stock_pick" | "both" }> = {
  // ETFs — managed-mix only
  VTI:   { name: "Total Market Stocks",       type: "ETF",   source: "auto_invest" },
  VXUS:  { name: "International Stocks",      type: "ETF",   source: "auto_invest" },
  BND:   { name: "Bonds",                     type: "ETF",   source: "auto_invest" },
  VGT:   { name: "Tech ETF",                  type: "ETF",   source: "auto_invest" },
  VUG:   { name: "Growth ETF",                type: "ETF",   source: "auto_invest" },
  VYM:   { name: "Dividend ETF",              type: "ETF",   source: "auto_invest" },
  SCHD:  { name: "Dividend Growth",           type: "ETF",   source: "auto_invest" },
  QQQ:   { name: "Nasdaq 100",                type: "ETF",   source: "auto_invest" },
  // Stocks — gifter-pick only
  DIS:   { name: "Disney",    type: "Stock", source: "stock_pick" },
  AAPL:  { name: "Apple",     type: "Stock", source: "stock_pick" },
  NKE:   { name: "Nike",      type: "Stock", source: "stock_pick" },
  NFLX:  { name: "Netflix",   type: "Stock", source: "stock_pick" },
  RBLX:  { name: "Roblox",    type: "Stock", source: "stock_pick" },
  SBUX:  { name: "Starbucks", type: "Stock", source: "stock_pick" },
  AMZN:  { name: "Amazon",    type: "Stock", source: "stock_pick" },
  GOOGL: { name: "Google",    type: "Stock", source: "stock_pick" },
  SPOT:  { name: "Spotify",   type: "Stock", source: "stock_pick" },
  TSLA:  { name: "Tesla",      type: "Stock", source: "stock_pick" },
  MSFT:  { name: "Microsoft",  type: "Stock", source: "stock_pick" },
  MCD:   { name: "McDonald's", type: "Stock", source: "stock_pick" },
  TGT:   { name: "Target",    type: "Stock", source: "stock_pick" },
  CMCSA: { name: "Comcast",   type: "Stock", source: "stock_pick" },
  DUOL:  { name: "Duolingo",  type: "Stock", source: "stock_pick" },
  ABNB:  { name: "Airbnb",    type: "Stock", source: "stock_pick" },
  NTDOY: { name: "Nintendo",  type: "Stock", source: "stock_pick" },
  DPZ:   { name: "Domino's",  type: "Stock", source: "stock_pick" },
  CHWY:  { name: "Chewy",     type: "Stock", source: "stock_pick" },
  ADBE:  { name: "Adobe",     type: "Stock", source: "stock_pick" },
  // Roster 2026-06-09 additions
  MAT:   { name: "Mattel",    type: "Stock", source: "stock_pick" },
  HAS:   { name: "Hasbro",    type: "Stock", source: "stock_pick" },
  NVDA:  { name: "Nvidia",    type: "Stock", source: "stock_pick" },
  KO:    { name: "Coca-Cola", type: "Stock", source: "stock_pick" },
  HSY:   { name: "Hershey",   type: "Stock", source: "stock_pick" },
  CROX:  { name: "Crocs",     type: "Stock", source: "stock_pick" },
  // Z (Zillow) intentionally NOT in the gifter/parent picker. It's not on the approved list
  // (not warm, not child-friendly). Legacy Zillow holdings still resolve via ticker-names.ts
  // and HoldingDetailSheet's TICKER_INFO so historical positions render correctly, but the
  // ticker is no longer offered for new investments.
};

export type MarketQuoteSource = "finnhub" | "alpha_vantage" | "yahoo" | "cache" | "estimate";

export type MarketQuote = {
  symbol: string;
  name: string;
  price: number;
  change?: number;
  changePercent?: number;
  source: MarketQuoteSource;
  isEstimate: boolean;
  asOf: string;
};

type CachedQuoteFile = Record<string, MarketQuote>;

const MARKET_QUOTE_CACHE_MS = 60 * 1000;
const MARKET_QUOTE_STALE_CACHE_MAX_MS = 24 * 60 * 60 * 1000;
const MARKET_QUOTE_CACHE_PATH = path.join(process.cwd(), ".local", "market-quotes-cache.json");
const marketQuoteCache = new Map<string, { quote: MarketQuote; expiresAt: number }>();
let fileCacheLoaded = false;
let fileCache: CachedQuoteFile = {};
let cacheRefresherStarted = false;

function isValidPrice(value: unknown): value is number {
  const price = Number(value);
  return Number.isFinite(price) && price > 0;
}

async function loadFileCache() {
  if (fileCacheLoaded) return;
  fileCacheLoaded = true;

  try {
    const raw = await fs.readFile(MARKET_QUOTE_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CachedQuoteFile;
    if (parsed && typeof parsed === "object") fileCache = parsed;
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.warn("[market-quotes] stale cache unavailable:", error?.message || error);
    }
    fileCache = {};
  }
}

async function persistLiveQuote(quote: MarketQuote) {
  if (quote.source === "cache" || quote.source === "estimate") return;

  try {
    await loadFileCache();
    await fs.mkdir(path.dirname(MARKET_QUOTE_CACHE_PATH), { recursive: true });
    fileCache[quote.symbol] = quote;
    await fs.writeFile(MARKET_QUOTE_CACHE_PATH, JSON.stringify(fileCache, null, 2), "utf8");
  } catch (error) {
    console.warn("[market-quotes] failed to persist quote cache:", (error as Error)?.message || error);
  }
}

async function fetchFinnhubQuote(symbol: string): Promise<{ price: number; change?: number; changePercent?: number } | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;

  try {
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("token", token);
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const data = await response.json() as { c?: number; d?: number; dp?: number };
    const price = Number(data?.c);
    if (!isValidPrice(price)) return null;
    const result: { price: number; change?: number; changePercent?: number } = { price };
    if (data?.d != null && Number.isFinite(Number(data.d))) result.change = Number(data.d);
    if (data?.dp != null && Number.isFinite(Number(data.dp))) result.changePercent = Number(data.dp);
    return result;
  } catch (error) {
    console.warn("[market-quotes] Finnhub quote unavailable:", symbol, (error as Error)?.message || error);
    return null;
  }
}

async function fetchAlphaVantageQuote(symbol: string): Promise<{ price: number; change?: number; changePercent?: number } | null> {
  const token = process.env.ALPHA_VANTAGE_API_KEY;
  if (!token) return null;

  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", token);
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) return null;
    const data = await response.json() as { "Global Quote"?: { "05. price"?: string; "09. change"?: string; "10. change percent"?: string } };
    const gq = data?.["Global Quote"];
    const price = Number(gq?.["05. price"]);
    if (!isValidPrice(price)) return null;
    const result: { price: number; change?: number; changePercent?: number } = { price };
    const change = Number(gq?.["09. change"]);
    if (Number.isFinite(change)) result.change = change;
    const changePctStr = String(gq?.["10. change percent"] || "").replace("%", "");
    const changePct = Number(changePctStr);
    if (Number.isFinite(changePct)) result.changePercent = changePct;
    return result;
  } catch (error) {
    console.warn("[market-quotes] Alpha Vantage quote unavailable:", symbol, (error as Error)?.message || error);
    return null;
  }
}

async function getStaleCachedQuote(symbol: string): Promise<MarketQuote | null> {
  await loadFileCache();
  const cached = fileCache[symbol];
  if (!cached) return null;

  const cachedAt = Date.parse(cached.asOf);
  if (Number.isNaN(cachedAt) || Date.now() - cachedAt > MARKET_QUOTE_STALE_CACHE_MAX_MS) return null;

  return {
    ...cached,
    source: "cache",
    isEstimate: true,
  };
}

// Keyless fallback via Yahoo's public chart endpoint (the same one
// /api/stock-price already uses for charts). The chart meta carries the live
// price AND the prior close, so we get a real daily change with no API key.
// This is what keeps quotes (and the holding sheet's "Today" tile) populated
// in dev and anywhere the keyed providers are missing or rate-limited.
async function fetchYahooQuote(symbol: string): Promise<{ price: number; change?: number; changePercent?: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const data = await response.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }> };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    if (!isValidPrice(price)) return null;
    const result: { price: number; change?: number; changePercent?: number } = { price };
    const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    if (Number.isFinite(prevClose) && prevClose > 0) {
      result.change = Math.round((price - prevClose) * 100) / 100;
      result.changePercent = Math.round(((price - prevClose) / prevClose) * 10000) / 100;
    }
    return result;
  } catch (error) {
    console.warn("[market-quotes] Yahoo quote unavailable:", symbol, (error as Error)?.message || error);
    return null;
  }
}

async function fetchProviderQuote(symbol: string): Promise<{ price: number; change?: number; changePercent?: number; source: Exclude<MarketQuoteSource, "cache" | "estimate"> } | null> {
  const finnhub = await fetchFinnhubQuote(symbol);
  if (finnhub) return { ...finnhub, source: "finnhub" };

  const alpha = await fetchAlphaVantageQuote(symbol);
  if (alpha) return { ...alpha, source: "alpha_vantage" };

  // Universal keyless fallback before the static estimate, so a missing key
  // never silently degrades a real quote to a flat placeholder.
  const yahoo = await fetchYahooQuote(symbol);
  if (yahoo) return { ...yahoo, source: "yahoo" };

  return null;
}

export async function getMarketQuote(symbol: string): Promise<MarketQuote | null> {
  const normalized = symbol.trim().toUpperCase();
  const asset = ADMIN_ASSET_UNIVERSE[normalized];
  if (!asset) return null;

  const cached = marketQuoteCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  const providerQuote = await fetchProviderQuote(normalized);
  if (providerQuote) {
    const quote: MarketQuote = {
      symbol: normalized,
      name: asset.name,
      price: providerQuote.price,
      ...(providerQuote.change != null ? { change: providerQuote.change } : {}),
      ...(providerQuote.changePercent != null ? { changePercent: providerQuote.changePercent } : {}),
      source: providerQuote.source,
      isEstimate: false,
      asOf: new Date().toISOString(),
    };
    marketQuoteCache.set(normalized, { quote, expiresAt: Date.now() + MARKET_QUOTE_CACHE_MS });
    void persistLiveQuote(quote);
    return quote;
  }

  const staleQuote = await getStaleCachedQuote(normalized);
  if (staleQuote) {
    marketQuoteCache.set(normalized, { quote: staleQuote, expiresAt: Date.now() + MARKET_QUOTE_CACHE_MS });
    return staleQuote;
  }

  // Last-resort estimate (provider + both caches missed). A configured per-ticker
  // estimate is a sensible stand-in; a BARE $100 is not — once custody is live it
  // would record the wrong share count for a real gift (dollars ÷ $100) and bake a
  // fabricated gain when the position later re-prices. Pre-custody this only touches
  // the local simulation, but surface the gap loudly so the estimate table is
  // completed before it can mis-value real money. See REAL_VS_SIMULATED.md.
  const configuredEstimate = MARKET_QUOTE_ESTIMATES[normalized];
  if (configuredEstimate == null) {
    console.warn(`[market-quotes] no estimate configured for universe ticker ${normalized}; valuing at the $100 placeholder. Add it to MARKET_QUOTE_ESTIMATES before custody goes live.`);
  }
  const fallbackPrice = configuredEstimate || 100;
  const quote: MarketQuote = {
    symbol: normalized,
    name: asset.name,
    price: fallbackPrice,
    source: "estimate",
    isEstimate: true,
    asOf: new Date().toISOString(),
  };
  marketQuoteCache.set(normalized, { quote, expiresAt: Date.now() + MARKET_QUOTE_CACHE_MS });
  return quote;
}

async function warmMarketQuoteCache() {
  const symbols = Object.keys(ADMIN_ASSET_UNIVERSE);
  await Promise.allSettled(symbols.map((symbol) => getMarketQuote(symbol)));
}

export function startMarketQuoteCacheRefresher() {
  if (cacheRefresherStarted) return;
  const minutes = Number(process.env.MARKET_QUOTES_REFRESH_MINUTES || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  cacheRefresherStarted = true;
  const intervalMs = Math.max(minutes, 5) * 60 * 1000;

  void warmMarketQuoteCache().catch((error) => {
    console.warn("[market-quotes] initial cache warm failed:", (error as Error)?.message || error);
  });

  setInterval(() => {
    void warmMarketQuoteCache().catch((error) => {
      console.warn("[market-quotes] scheduled cache warm failed:", (error as Error)?.message || error);
    });
  }, intervalMs).unref();
}
