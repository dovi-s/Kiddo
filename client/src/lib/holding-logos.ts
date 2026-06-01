// Ticker → corporate domain map for Clearbit's logo API
// (https://logo.clearbit.com/{domain}). Used by <HoldingLogo /> to render
// real brand marks for stock holdings on parent + gifter surfaces.
//
// Why a static map instead of a heuristic:
// - Some tickers don't match the company name (NTDOY → nintendo.com, GOOGL → google.com, CMCSA → comcast.com)
// - ETFs are issued by the fund company, not the ticker (VOO → vanguard.com, SPY → ssga.com)
// - We want explicit control over which brand each ticker represents
//
// Add new entries as new tickers become orderable. Keep in sync with
// STATIC_TICKER_META in Dashboard.tsx and AUTO_INVEST_STOCKS picker.

export const TICKER_DOMAIN: Record<string, string> = {
  // Consumer brands (parent + gifter view)
  DIS: "disney.com",
  AAPL: "apple.com",
  NKE: "nike.com",
  NFLX: "netflix.com",
  RBLX: "roblox.com",
  SBUX: "starbucks.com",
  AMZN: "amazon.com",
  GOOGL: "google.com",
  SPOT: "spotify.com",
  TGT: "target.com",
  CMCSA: "comcast.com",
  DUOL: "duolingo.com",
  ABNB: "airbnb.com",
  NTDOY: "nintendo.com",
  DPZ: "dominos.com",
  CHWY: "chewy.com",
  ADBE: "adobe.com",
  TSLA: "tesla.com",
  MSFT: "microsoft.com",
  MCD: "mcdonalds.com",
  Z: "zillow.com",

  // Common ETFs (issuer brand, not ticker name)
  VOO: "vanguard.com",
  VTI: "vanguard.com",
  VXUS: "vanguard.com",
  BND: "vanguard.com",
  SPY: "ssga.com",
  QQQ: "invesco.com",
  IVV: "ishares.com",
  ITOT: "ishares.com",
};

export function getTickerDomain(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  return TICKER_DOMAIN[ticker.toUpperCase()] ?? null;
}

// Clearbit's logo CDN. Free tier, served at edge, ~50ms p50.
// Endpoint pattern: https://logo.clearbit.com/{domain}?size={px}
// If Clearbit ever shuts down or rate-limits, the <HoldingLogo /> component
// gracefully falls back to brand emoji (passed via prop) and finally to a
// ticker-initial circle. UI never breaks.
export function getLogoUrl(domain: string, size: number): string {
  // Request 2x for retina; Clearbit caps at 256.
  const requested = Math.min(Math.max(Math.round(size * 2), 32), 256);
  return `https://logo.clearbit.com/${domain}?size=${requested}`;
}
