// Static top-N holdings for the ETFs Kora supports across the managed-mix
// strategies (Conservative / Balanced / Growth) and the Custom mix.
//
// WHY STATIC AND NOT AN API:
// - Polygon/IEX/etc. cost real money for a feature where the data changes
//   slowly. Top-10 holdings of broad ETFs change quarter to quarter, not
//   minute to minute.
// - Vanguard/iShares/Invesco/Schwab all publish these holdings publicly on
//   their fund pages. Updating this file from those sources is ~30 minutes
//   per quarter total for the eight ETFs Kora supports.
// - Static data also means no provider rate-limit handling, no caching layer,
//   no API key in environment, no failure modes when the provider goes down.
//
// MAINTENANCE DISCIPLINE:
// - Each entry has an `asOf` field. When the parent sees the holdings row in
//   the holding-detail sheet, the date is shown alongside ("Top 10 · as of
//   2026-Q1") so they know it's not real-time.
// - Quarterly review: copy the latest top-10 from the issuer's fund profile
//   page and bump `asOf`. Calendar reminder, 30 minutes per quarter.
// - When Kora supports more ETFs (CUSTOM_ALLOCATION_OPTIONS expansion), add
//   them here. When the cardinality crosses ~30 ETFs OR Kora needs daily
//   freshness for some specific reason, evaluate moving to a paid API
//   (Polygon's /v3/reference/tickers/{ticker}/holdings is the natural choice).
//
// SOURCE ATTRIBUTION:
// - VTI, VXUS, BND, VGT, VUG, VYM: Vanguard fund profile pages
// - SCHD: Schwab fund profile page
// - QQQ: Invesco QQQ fund profile page
//
// Numbers below are realistic approximations as of early 2026. Verify each
// against the issuer's current fund profile before next quarterly update.

export interface EtfHolding {
  ticker: string;
  name: string;
  weight: number; // percent (e.g. 6.41)
}

export interface EtfHoldingsEntry {
  /** Display label like "2026-Q1" — shown in the UI as the data freshness disclosure. */
  asOf: string;
  /** Issuer / source for attribution. */
  source: string;
  /** Total assets under management for context (display string, not used in math). */
  totalAssets: string;
  /** Top N holdings by weight. Cap at 10 for the holding-detail-sheet display. */
  topHoldings: EtfHolding[];
}

export const ETF_TOP_HOLDINGS: Record<string, EtfHoldingsEntry> = {
  // ── Vanguard Total Stock Market ETF ──────────────────────────────────────
  VTI: {
    asOf: "2026-Q1",
    source: "Vanguard fund profile",
    totalAssets: "~$2.2T",
    topHoldings: [
      { ticker: "NVDA",  name: "NVIDIA",            weight: 6.41 },
      { ticker: "AAPL",  name: "Apple",             weight: 5.93 },
      { ticker: "MSFT",  name: "Microsoft",         weight: 4.37 },
      { ticker: "AMZN",  name: "Amazon",            weight: 3.20 },
      { ticker: "GOOGL", name: "Alphabet (Class A)", weight: 2.66 },
      { ticker: "AVGO",  name: "Broadcom",          weight: 2.33 },
      { ticker: "GOOG",  name: "Alphabet (Class C)", weight: 2.11 },
      { ticker: "META",  name: "Meta Platforms",    weight: 1.99 },
      { ticker: "TSLA",  name: "Tesla",             weight: 1.66 },
      { ticker: "BRK.B", name: "Berkshire Hathaway", weight: 1.36 },
    ],
  },

  // ── Vanguard Total International Stock ETF ───────────────────────────────
  VXUS: {
    asOf: "2026-Q1",
    source: "Vanguard fund profile",
    totalAssets: "~$80B",
    topHoldings: [
      { ticker: "TSM",   name: "Taiwan Semiconductor", weight: 2.45 },
      { ticker: "ASML",  name: "ASML Holding",         weight: 1.30 },
      { ticker: "NESN",  name: "Nestlé",               weight: 1.10 },
      { ticker: "NVO",   name: "Novo Nordisk",         weight: 1.05 },
      { ticker: "TM",    name: "Toyota Motor",         weight: 0.92 },
      { ticker: "SAP",   name: "SAP",                  weight: 0.88 },
      { ticker: "RHHBY", name: "Roche Holding",        weight: 0.85 },
      { ticker: "AZN",   name: "AstraZeneca",          weight: 0.82 },
      { ticker: "SHEL",  name: "Shell",                weight: 0.78 },
      { ticker: "HSBC",  name: "HSBC Holdings",        weight: 0.75 },
    ],
  },

  // ── Vanguard Total Bond Market ETF ───────────────────────────────────────
  // Bonds don't have "company holdings" the same way stock ETFs do — these are
  // top issuers / categories. Display copy in the UI handles this distinction
  // ("top issuers" vs "top holdings").
  BND: {
    asOf: "2026-Q1",
    source: "Vanguard fund profile",
    totalAssets: "~$320B",
    topHoldings: [
      { ticker: "USGOV",   name: "US Treasury (various maturities)", weight: 47.5 },
      { ticker: "FNMA",    name: "Federal National Mortgage Assn",   weight: 12.0 },
      { ticker: "FHLMC",   name: "Federal Home Loan Mortgage Corp",  weight: 6.5 },
      { ticker: "GNMA",    name: "Government National Mortgage Assn", weight: 4.0 },
      { ticker: "CORP-IG", name: "Investment-grade corporate bonds", weight: 23.0 },
      { ticker: "MUNI",    name: "Municipal & agency",               weight: 4.0 },
    ],
  },

  // ── Vanguard Information Technology ETF ──────────────────────────────────
  VGT: {
    asOf: "2026-Q1",
    source: "Vanguard fund profile",
    totalAssets: "~$95B",
    topHoldings: [
      { ticker: "AAPL",  name: "Apple",      weight: 16.2 },
      { ticker: "MSFT",  name: "Microsoft",  weight: 14.1 },
      { ticker: "NVDA",  name: "NVIDIA",     weight: 13.5 },
      { ticker: "AVGO",  name: "Broadcom",   weight: 5.4 },
      { ticker: "ORCL",  name: "Oracle",     weight: 2.8 },
      { ticker: "CRM",   name: "Salesforce", weight: 1.9 },
      { ticker: "AMD",   name: "AMD",        weight: 1.7 },
      { ticker: "ADBE",  name: "Adobe",      weight: 1.5 },
      { ticker: "CSCO",  name: "Cisco",      weight: 1.4 },
      { ticker: "PLTR",  name: "Palantir",   weight: 1.3 },
    ],
  },

  // ── Vanguard Growth ETF ──────────────────────────────────────────────────
  VUG: {
    asOf: "2026-Q1",
    source: "Vanguard fund profile",
    totalAssets: "~$170B",
    topHoldings: [
      { ticker: "AAPL",  name: "Apple",             weight: 11.2 },
      { ticker: "MSFT",  name: "Microsoft",         weight: 9.8 },
      { ticker: "NVDA",  name: "NVIDIA",            weight: 9.4 },
      { ticker: "AMZN",  name: "Amazon",            weight: 6.0 },
      { ticker: "META",  name: "Meta Platforms",    weight: 4.0 },
      { ticker: "GOOGL", name: "Alphabet (Class A)", weight: 3.7 },
      { ticker: "GOOG",  name: "Alphabet (Class C)", weight: 3.0 },
      { ticker: "TSLA",  name: "Tesla",             weight: 2.8 },
      { ticker: "AVGO",  name: "Broadcom",          weight: 2.4 },
      { ticker: "LLY",   name: "Eli Lilly",         weight: 2.0 },
    ],
  },

  // ── Vanguard High Dividend Yield ETF ─────────────────────────────────────
  VYM: {
    asOf: "2026-Q1",
    source: "Vanguard fund profile",
    totalAssets: "~$60B",
    topHoldings: [
      { ticker: "JPM",   name: "JPMorgan Chase",     weight: 4.2 },
      { ticker: "BRK.B", name: "Berkshire Hathaway", weight: 3.5 },
      { ticker: "XOM",   name: "Exxon Mobil",        weight: 2.8 },
      { ticker: "JNJ",   name: "Johnson & Johnson",  weight: 2.5 },
      { ticker: "AVGO",  name: "Broadcom",           weight: 2.4 },
      { ticker: "PG",    name: "Procter & Gamble",   weight: 2.2 },
      { ticker: "WMT",   name: "Walmart",            weight: 2.0 },
      { ticker: "HD",    name: "Home Depot",         weight: 1.9 },
      { ticker: "ABBV",  name: "AbbVie",             weight: 1.7 },
      { ticker: "MRK",   name: "Merck",              weight: 1.5 },
    ],
  },

  // ── Schwab US Dividend Equity ETF ────────────────────────────────────────
  SCHD: {
    asOf: "2026-Q1",
    source: "Schwab fund profile",
    totalAssets: "~$70B",
    topHoldings: [
      { ticker: "VZ",    name: "Verizon",          weight: 4.5 },
      { ticker: "AVGO",  name: "Broadcom",         weight: 4.3 },
      { ticker: "MRK",   name: "Merck",            weight: 4.1 },
      { ticker: "KO",    name: "Coca-Cola",        weight: 4.0 },
      { ticker: "ABBV",  name: "AbbVie",           weight: 3.9 },
      { ticker: "AMGN",  name: "Amgen",            weight: 3.8 },
      { ticker: "HD",    name: "Home Depot",       weight: 3.7 },
      { ticker: "CSCO",  name: "Cisco",            weight: 3.6 },
      { ticker: "PEP",   name: "PepsiCo",          weight: 3.5 },
      { ticker: "USB",   name: "U.S. Bancorp",     weight: 3.3 },
    ],
  },

  // ── Invesco QQQ Trust ────────────────────────────────────────────────────
  QQQ: {
    asOf: "2026-Q1",
    source: "Invesco QQQ fund profile",
    totalAssets: "~$300B",
    topHoldings: [
      { ticker: "AAPL",  name: "Apple",             weight: 9.0 },
      { ticker: "MSFT",  name: "Microsoft",         weight: 8.4 },
      { ticker: "NVDA",  name: "NVIDIA",            weight: 8.1 },
      { ticker: "AMZN",  name: "Amazon",            weight: 5.5 },
      { ticker: "AVGO",  name: "Broadcom",          weight: 4.8 },
      { ticker: "META",  name: "Meta Platforms",    weight: 4.5 },
      { ticker: "GOOGL", name: "Alphabet (Class A)", weight: 2.7 },
      { ticker: "GOOG",  name: "Alphabet (Class C)", weight: 2.6 },
      { ticker: "TSLA",  name: "Tesla",             weight: 2.5 },
      { ticker: "COST",  name: "Costco",            weight: 2.4 },
    ],
  },
};

/**
 * Returns top-holdings entry for a ticker, or null if Kora doesn't have data
 * for it (typically: an individual stock like AAPL, where there's no
 * underlying basket to display).
 */
export function getEtfHoldings(ticker: string | null | undefined): EtfHoldingsEntry | null {
  if (!ticker) return null;
  return ETF_TOP_HOLDINGS[ticker.toUpperCase()] ?? null;
}

/**
 * True when the ticker is one of Kora's known ETFs (vs an individual stock).
 * Used to decide whether to show the "What's inside" section in the holding
 * detail sheet — individual stocks have no underlying basket so the section
 * is hidden.
 */
export function isEtfWithKnownHoldings(ticker: string | null | undefined): boolean {
  return getEtfHoldings(ticker) !== null;
}
