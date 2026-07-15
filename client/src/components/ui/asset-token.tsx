// AssetToken — a crafted category badge for broad-market ETFs whose real logos
// collide or don't communicate. VTI / VOO / VXUS / BND all resolve to the same
// Vanguard mark, so three mix constituents read as three identical logos; a
// skyline / globe / treasury token distinguishes US vs international vs bonds at
// a glance. INDIVIDUAL company stocks (AAPL, DIS, ...) still use their real logo
// via <StockLogo> — this only kicks in for the broad-market categories + Cash.
//
// Filled-badge register (evergreen disc + cream glyph + gold accent) so it sits
// at the same visual weight as the real logo tokens beside it in a holdings row.
// Placeholder art; a premium illustrator/image-gen pass (see ILLUSTRATION_SPEC.md)
// swaps the paths per category without touching callers.

import { useId, type ReactNode } from "react";

const EG = "hsl(var(--kiddo-evergreen))";
const EGD = "hsl(var(--kiddo-evergreen-deep))";
const CR = "hsl(var(--kiddo-cream))";
const GOLD = "hsl(var(--kiddo-gold-light))";

type Cat = "us" | "intl" | "bonds" | "cash";

// Broad-market index ETFs where a category reading beats the issuer logo.
// Single stocks and distinctive funds (QQQ etc.) are intentionally absent → logo.
const US = new Set(["VTI", "VOO", "IVV", "ITOT", "SPY", "SCHB", "SPTM"]);
const INTL = new Set(["VXUS", "IXUS", "VEA", "VWO", "IEFA", "VT", "VEU"]);
const BONDS = new Set(["BND", "AGG", "ISTB", "BNDX", "GBIL", "SHV", "BIL", "ICSH", "JPST"]);

function categoryFor(ticker?: string | null): Cat | null {
  const t = String(ticker || "").trim().toUpperCase();
  if (!t) return null;
  if (t === "CASH") return "cash";
  if (US.has(t)) return "us";
  if (INTL.has(t)) return "intl";
  if (BONDS.has(t)) return "bonds";
  return null;
}

/** True when we render a category token instead of the real logo. */
export function hasAssetToken(ticker?: string | null): boolean {
  return categoryFor(ticker) !== null;
}

// Fuller / richer than a sparse cream-on-green mark, so a token holds its own
// next to a dense full-color logo: glyphs fill the badge edge-to-edge, windows/
// gaps use evergreen-deep for tonal depth, gold carries a warm highlight.
const ART: Record<Cat, () => ReactNode> = {
  us: () => (
    <>
      {/* warm sun behind the skyline */}
      <circle fill={GOLD} cx="70" cy="27" r="7" />
      {/* four buildings, edge-to-edge, varied heights */}
      <rect fill={CR} x="14" y="46" width="16" height="34" rx="1.6" />
      <rect fill={CR} x="32" y="22" width="19" height="58" rx="1.6" />
      <rect fill={CR} x="53" y="34" width="15" height="46" rx="1.6" />
      <rect fill={CR} x="70" y="52" width="13" height="28" rx="1.6" />
      {/* windows — evergreen-deep for depth */}
      <g fill={EGD}>
        {[50, 57, 64, 71].map((y) => [17.5, 23].map((x) => <rect key={`a${x}-${y}`} x={x} y={y} width="3" height="3" />))}
        {[27, 35, 43, 51, 59, 67].map((y) => [35.5, 41, 46.5].map((x) => <rect key={`b${x}-${y}`} x={x} y={y} width="3" height="3" />))}
        {[39, 46, 53, 60, 67].map((y) => [56, 61.5].map((x) => <rect key={`c${x}-${y}`} x={x} y={y} width="3" height="3" />))}
        {[57, 64, 71].map((y) => [72.5, 78].map((x) => <rect key={`d${x}-${y}`} x={x} y={y} width="2.6" height="2.6" />))}
      </g>
      {/* gold spire on the tallest */}
      <rect fill={GOLD} x="40" y="15" width="2.6" height="7" rx="1" />
    </>
  ),
  intl: () => (
    <>
      {/* clean wireframe globe — cream sphere, evergreen graticule */}
      <circle fill={CR} cx="48" cy="48" r="24" />
      <g fill="none" stroke={EG} strokeWidth="2" strokeLinecap="round">
        <path d="M24 48 h48" />
        <ellipse cx="48" cy="48" rx="9.5" ry="24" />
        <ellipse cx="48" cy="48" rx="19" ry="24" />
        <path d="M29 35 q19 7 38 0" />
        <path d="M29 61 q19 -7 38 0" />
      </g>
      {/* gold location marker on the surface */}
      <circle fill={GOLD} cx="61" cy="35" r="3.6" />
    </>
  ),
  bonds: () => (
    <>
      {/* fuller classical building: wide pediment, 5 columns, stacked steps */}
      <path fill={CR} d="M16 44 L48 22 L80 44 Z" />
      <rect fill={CR} x="20" y="44" width="56" height="5.5" />
      <rect fill={CR} x="24" y="51" width="6.5" height="20" />
      <rect fill={CR} x="35" y="51" width="6.5" height="20" />
      <rect fill={CR} x="45.5" y="51" width="6.5" height="20" />
      <rect fill={CR} x="56" y="51" width="6.5" height="20" />
      <rect fill={CR} x="66.5" y="51" width="6.5" height="20" />
      {/* column shadows for depth */}
      <g fill={EGD}>
        <rect x="30.5" y="51" width="4.5" height="20" /><rect x="41" y="51" width="4.5" height="20" />
        <rect x="52" y="51" width="4" height="20" /><rect x="62.5" y="51" width="4" height="20" />
      </g>
      <rect fill={CR} x="19" y="71" width="58" height="4" />
      <rect fill={CR} x="15" y="75" width="66" height="4.5" />
      <circle fill={GOLD} cx="48" cy="35" r="3.4" />
    </>
  ),
  cash: () => (
    <>
      {/* one clean gold coin: milled cream rim + evergreen $, a small sparkle */}
      <circle fill={GOLD} cx="48" cy="48" r="24" />
      <circle cx="48" cy="48" r="19" fill="none" stroke={CR} strokeWidth="2.4" />
      <text x="48" y="59" textAnchor="middle" fontSize="30" fontWeight="800" fontFamily="Georgia, serif" fill={EG}>$</text>
      <path fill={CR} d="M67 27 l1.5 3.6 3.6 1.5 -3.6 1.5 -1.5 3.6 -1.5 -3.6 -3.6 -1.5 3.6 -1.5z" opacity="0.9" />
    </>
  ),
};

/**
 * Renders the category token for a broad-market ETF / Cash, or null when the
 * ticker isn't a category we tokenize (caller falls back to <StockLogo>).
 * Filled evergreen badge so it sits at logo weight in a holdings row.
 */
export function AssetToken({
  ticker,
  size = 36,
  className,
}: {
  ticker?: string | null;
  size?: number;
  className?: string;
}) {
  const cat = categoryFor(ticker);
  const rawId = useId();
  if (!cat) return null;
  const clip = `at-${rawId.replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={`${cat} holding`}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs><clipPath id={clip}><circle cx="48" cy="48" r="46" /></clipPath></defs>
      <circle cx="48" cy="48" r="46" fill={EG} />
      <g clipPath={`url(#${clip})`}>{ART[cat]()}</g>
    </svg>
  );
}
