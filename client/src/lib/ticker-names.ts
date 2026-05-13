// Plain-English names for ETFs. Stocks (Disney, Apple, etc.) don't need this
// because their names are already intuitive.
const ETF_FRIENDLY: Record<string, string> = {
  VTI:  "Total Market Stocks",
  VXUS: "International Stocks",
  BND:  "Bonds",
  VGT:  "Tech Stocks",
  VOO:  "S&P 500 Stocks",
  SPY:  "S&P 500 Stocks",
  QQQ:  "Nasdaq 100 Stocks",
  AGG:  "Bonds",
  BNDX: "International Bonds",
  VEA:  "Developed Market Stocks",
  VWO:  "Emerging Market Stocks",
  SCHB: "Total Market Stocks",
  ITOT: "Total Market Stocks",
  IEFA: "International Stocks",
  IXUS: "International Stocks",
  IJR:  "Small Company Stocks",
  IWM:  "Small Company Stocks",
  GLD:  "Gold",
  IAU:  "Gold",
  VNQ:  "Real Estate",
};

// True if the raw DB name looks like a fund-company name (e.g. "Vanguard …")
function looksLikeFundName(name: string): boolean {
  return /vanguard|ishares|schwab|invesco|spdr|fidelity|blackrock/i.test(name);
}

/**
 * Returns the display name for a holding.
 *
 * ETFs → "Plain English (TICKER)"   e.g. "Total Market Stocks (VTI)"
 * Stocks → clean name               e.g. "Disney", "Apple"
 */
export function friendlyHoldingName(ticker: string, dbName?: string | null): string {
  const t = ticker.toUpperCase();
  const friendly = ETF_FRIENDLY[t];
  if (friendly) return `${friendly} (${t})`;

  // Fall through to the DB name, cleaned up
  const raw = String(dbName || "").replace(/\s+stock$/i, "").trim();
  // If DB name is a full fund-company name and we have no friendly mapping, strip company prefix
  if (looksLikeFundName(raw)) {
    // Last resort: use ticker
    return t;
  }
  return raw && raw.toUpperCase() !== t ? raw : t;
}
