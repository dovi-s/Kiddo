// The managed-mix mark — a Layers "basket" glyph in an evergreen-tinted tile.
//
// One-mark-one-meaning (2026-07-08 icon-system pass): the managed mix is a
// diversified auto-managed basket. It must NOT reuse:
//   • the strategy SELECTOR icons (TrendingUp/Scale/Shield — those stay in the
//     picker where you choose a risk level),
//   • the money-GAIN up-arrow (owns "+$X growth"),
//   • the "What you own" PIE (owns the whole portfolio).
// So managed-mix schedules/holdings that sit next to stock logos get Layers.
// Matches the StrategyIcon tile so recurring rows read as one family.

import { Layers } from "lucide-react";

/**
 * The bare managed-mix glyph (no tile) — for inline slots too small for the tile:
 * a text-prefix next to a gift note, a 16px schedule marker. Same Layers mark as
 * the tile so "managed mix" reads identically whether it sits in an avatar slot or
 * inline. Pass style/color from the caller (it usually matches adjacent text).
 */
export function ManagedMixGlyph({
  size = 14,
  strokeWidth = 2,
  className,
  style,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <Layers size={size} strokeWidth={strokeWidth} className={className} style={style} aria-hidden />;
}

export function ManagedMixIcon({
  size = 40,
  paused = false,
  className,
}: {
  size?: number;
  paused?: boolean;
  className?: string;
}) {
  const iconSize = Math.round(size * 0.46);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: paused ? "hsl(43,80%,94%)" : "hsl(var(--kiddo-evergreen) / 0.10)",
        borderColor: paused ? "rgba(184,121,26,0.18)" : "hsla(157,42%,18%,0.12)",
        opacity: paused ? 0.85 : 1,
      }}
      aria-hidden="true"
    >
      <Layers
        size={iconSize}
        strokeWidth={2.25}
        color={paused ? "rgba(120,113,100,0.75)" : "hsl(var(--kiddo-evergreen))"}
        aria-hidden
      />
    </div>
  );
}
