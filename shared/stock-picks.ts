// Canonical individual-stock pick universe — the SINGLE source of truth for
// every "choose a stock" surface (public gift checkout, parent one-time +
// recurring auto-invest, onboarding, mobile).
//
// Before this file, each flow hardcoded its own list and they had drifted:
//   • gifter checkout (GiftCheckout STOCK_PICKS) ........ 17, no Tesla
//   • parent auto-invest (Dashboard AUTO_INVEST_STOCKS).. 17, no Tesla, DIFFERENT
//                                                          taglines + emoji
//   • onboarding (packages/utils onboardingStockChoices). 10, WITH Tesla
//   • the documented server STOCK_ALLOWLIST ............. dead code, referenced
//                                                          nowhere → the server
//                                                          accepted ANY ticker.
// So Tesla was a phantom (offered only in onboarding), onboarding showed fewer
// brands than the gift page, and there was no real curation gate. This module
// is the one list everything should converge on, plus the allow-set the server
// enforces.
//
// Rules:
//   • INDIVIDUAL STOCKS only — a gifter/parent pick. They never appear in the
//     managed mix (that's ETFs; see ETF_ALLOWLIST in server/fundStrategyConfig).
//     The architectural split is intact.
//   • Curated to brands a child recognizes and feels something about — the
//     "companies they know and love" thesis.
//   • Adding a ticker requires BOTH a logo (client/src/lib/holding-logos.ts)
//     AND quote metadata (server/marketQuotes.ts) or its price won't resolve.
//     (Tesla already has both — that's why it's safe to make first-class here.
//     Microsoft / McDonald's etc. would need that metadata added first.)
//   • `featured` controls the first-shown tier; the rest sit behind "show more".
//   • fallbackPrice renders ONLY when the live /api/market/quotes call fails.

export interface StockPick {
  ticker: string;
  name: string;
  tagline: string;
  featured: boolean;
  fallbackPrice: number;
  emoji: string;
}

// Roster 2026-06-01: added Microsoft (Minecraft + Xbox — the biggest miss for a
// child-recognizable list) and McDonald's; dropped Adobe + Comcast (off-thesis
// for "companies they know and love" — a kid doesn't feel anything about
// Comcast or Adobe). Existing Adobe/Comcast holdings still display via
// holding-logos + marketQuotes; they're just no longer offered for new picks.
export const STOCK_PICKS: readonly StockPick[] = [
  { ticker: "DIS",   name: "Disney",     tagline: "for the magic",                featured: true,  fallbackPrice: 106.42, emoji: "🏰" },
  { ticker: "AAPL",  name: "Apple",      tagline: "for the future",               featured: true,  fallbackPrice: 214.38, emoji: "🍎" },
  { ticker: "NKE",   name: "Nike",       tagline: "for the ones who go for it",   featured: true,  fallbackPrice: 92.14,  emoji: "👟" },
  { ticker: "SBUX",  name: "Starbucks",  tagline: "for the everyday wins",        featured: true,  fallbackPrice: 89.63,  emoji: "☕" },
  { ticker: "NFLX",  name: "Netflix",    tagline: "for the storytellers",         featured: true,  fallbackPrice: 612.9,  emoji: "🎬" },
  { ticker: "AMZN",  name: "Amazon",     tagline: "for the builders",             featured: true,  fallbackPrice: 184.85, emoji: "📦" },
  { ticker: "GOOGL", name: "Google",     tagline: "for the curious ones",         featured: true,  fallbackPrice: 172.63, emoji: "🔍" },
  { ticker: "SPOT",  name: "Spotify",    tagline: "for the music lovers",         featured: true,  fallbackPrice: 618.92, emoji: "🎵" },
  { ticker: "RBLX",  name: "Roblox",     tagline: "for the gamers",               featured: true,  fallbackPrice: 37.44,  emoji: "🎮" },
  { ticker: "TSLA",  name: "Tesla",      tagline: "for the road ahead",           featured: true,  fallbackPrice: 171.27, emoji: "🚗" },
  { ticker: "MSFT",  name: "Microsoft",  tagline: "for the world-builders",       featured: true,  fallbackPrice: 415.00, emoji: "🧱" },
  { ticker: "NTDOY", name: "Nintendo",   tagline: "for the players",              featured: false, fallbackPrice: 13.40,  emoji: "🎮" },
  { ticker: "DUOL",  name: "Duolingo",   tagline: "for the lifelong learners",    featured: false, fallbackPrice: 200.00, emoji: "🦉" },
  { ticker: "DPZ",   name: "Domino's",   tagline: "for the Friday night classic", featured: false, fallbackPrice: 470.00, emoji: "🍕" },
  { ticker: "CHWY",  name: "Chewy",      tagline: "for the animal lovers",        featured: false, fallbackPrice: 30.00,  emoji: "🐾" },
  { ticker: "ABNB",  name: "Airbnb",     tagline: "for the travelers",            featured: false, fallbackPrice: 130.00, emoji: "🌍" },
  { ticker: "TGT",   name: "Target",     tagline: "for the everyday family",      featured: false, fallbackPrice: 150.00, emoji: "🎯" },
  { ticker: "MCD",   name: "McDonald's", tagline: "for the little treats",        featured: false, fallbackPrice: 295.00, emoji: "🍟" },
] as const;

export const FEATURED_STOCK_PICKS: readonly StockPick[] = STOCK_PICKS.filter((s) => s.featured);
export const ADDITIONAL_STOCK_PICKS: readonly StockPick[] = STOCK_PICKS.filter((s) => !s.featured);

// The allow-set the server enforces on selectedTicker. Superset of every list
// any client flow currently offers, so turning enforcement on can't reject a
// pick that's already selectable somewhere.
export const ALLOWED_STOCK_TICKERS: ReadonlySet<string> = new Set(STOCK_PICKS.map((s) => s.ticker));

export function isAllowedStockPick(ticker: string | null | undefined): boolean {
  return !!ticker && ALLOWED_STOCK_TICKERS.has(String(ticker).trim().toUpperCase());
}

export const STOCK_PICK_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  STOCK_PICKS.map((s) => [s.ticker, s.name]),
);
