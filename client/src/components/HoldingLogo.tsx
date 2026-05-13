// HoldingLogo — render a stock/ETF brand mark for parent + gifter surfaces.
//
// Replaces the older "ticker → emoji" pattern (☕ for Starbucks, 🦉 for
// Duolingo, etc.) with the actual brand logo, sourced from Clearbit's logo
// CDN. The emoji approach worked but read as casual; real brokerage
// surfaces (Robinhood, Public, Fidelity, Apple Stocks) all use real logos
// for trust + recognition. Per `project_brokerage_as_trust_feature` the
// brokerage layer is celebrated, not implied.
//
// Three-tier fallback so the UI never breaks:
// 1. Clearbit logo (the happy path).
// 2. Brand emoji passed via `fallbackEmoji` prop (warm, recognizable,
//    matches the older STATIC_TICKER_META semantics).
// 3. Ticker-initial circle in evergreen (cold but always renders).
//
// Kid View intentionally keeps its own translation (🍎-fruit-style) per
// the comment in Dashboard.tsx STATIC_TICKER_META — that translation is
// load-bearing for the kid surface and is not the same job as this
// component does for parent/gifter.

import { useState } from "react";

import { getTickerDomain, getLogoUrl } from "@/lib/holding-logos";

interface HoldingLogoProps {
  ticker: string;
  /** Pixel size of the rendered logo. Default 32. */
  size?: number;
  /** Brand emoji (e.g. "🦉") used as the warm fallback if the logo fails to load. */
  fallbackEmoji?: string | null;
  /** Extra classes for the outer element. */
  className?: string;
  /** When true, renders inline-block + baseline-aligned for use inside a text run. */
  inline?: boolean;
}

export function HoldingLogo({
  ticker,
  size = 32,
  fallbackEmoji,
  className = "",
  inline = false,
}: HoldingLogoProps) {
  const [errored, setErrored] = useState(false);
  const upperTicker = String(ticker || "").toUpperCase();
  const domain = getTickerDomain(upperTicker);

  // Tier 3 (no domain mapping AND no emoji): ticker-initial circle.
  // Tier 2 (no domain OR errored, but have emoji): emoji.
  // Tier 1 (have domain, not errored): Clearbit image.

  if (!domain || errored) {
    if (fallbackEmoji) {
      return (
        <span
          aria-hidden="true"
          className={`${inline ? "inline-block align-middle" : "inline-flex items-center justify-center"} ${className}`}
          style={{
            fontSize: size * 0.85,
            lineHeight: 1,
            // Reserve the same footprint as the image would have so layout doesn't jump.
            width: inline ? undefined : size,
            height: inline ? undefined : size,
          }}
        >
          {fallbackEmoji}
        </span>
      );
    }
    return <TickerInitial ticker={upperTicker} size={size} className={className} inline={inline} />;
  }

  return (
    <img
      src={getLogoUrl(domain, size)}
      alt={`${upperTicker} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`${inline ? "inline-block align-middle" : ""} rounded-md bg-white object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function TickerInitial({
  ticker,
  size,
  className,
  inline,
}: {
  ticker: string;
  size: number;
  className: string;
  inline: boolean;
}) {
  const letter = ticker.charAt(0) || "•";
  return (
    <span
      aria-hidden="true"
      className={`${inline ? "inline-flex align-middle" : "flex"} items-center justify-center rounded-md bg-[hsl(var(--kiddo-evergreen))] font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45, lineHeight: 1 }}
    >
      {letter}
    </span>
  );
}
