// Small SVG sparkline for the Gifter Dashboard saved-fund cards.
//
// Renders a 30-day trajectory of total fund value as a single
// evergreen path with a soft gradient fill. Sized to fit inline on
// a card without dominating; the card's currentFundValue + last gift
// date carry the primary signal.
//
// Locked 2026-05-19 per the Five Towns gifter polish — gifters
// (sophisticated grandparents, especially) want to know not just
// "what is the balance" but "is it growing or sliding." The
// sparkline answers that in a glance without a dedicated detail
// page. Privacy boundary: same data domain as the existing
// currentFundValue exposure on the card (total fund value, not
// per-position or per-gifter breakdown).
//
// Renders nothing when fewer than 2 snapshot points — a single
// point is not a trajectory.

interface GifterFundSparklineProps {
  // Series of {at: ISO date, totalValue: USD} points, sorted ASC by
  // server. Sparse data (e.g. 5 snapshots across 30 days) handled
  // gracefully via straight-line interpolation between points.
  points: Array<{ at: string; totalValue: number }>;
  // Width/height in pixels. Defaults sized for the card row context.
  width?: number;
  height?: number;
  // Optional className passthrough for caller alignment.
  className?: string;
}

export function GifterFundSparkline({
  points,
  width = 88,
  height = 28,
  className = "",
}: GifterFundSparklineProps) {
  if (!points || points.length < 2) return null;

  const values = points.map((p) => p.totalValue);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  // Flat line (no variation) gets a centered horizontal stroke rather
  // than divide-by-zero NaN. Sparkline of a brand-new fund with no
  // gifts yet would land here.
  const range = maxV - minV;
  const padding = 2;
  const usableW = Math.max(0, width - padding * 2);
  const usableH = Math.max(0, height - padding * 2);

  const xAt = (i: number) =>
    padding + (points.length === 1 ? usableW / 2 : (i / (points.length - 1)) * usableW);
  const yAt = (v: number) => {
    if (range <= 0) return padding + usableH / 2;
    // Higher value → lower y (SVG origin top-left).
    return padding + (1 - (v - minV) / range) * usableH;
  };

  // Path for the stroke line.
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.totalValue).toFixed(2)}`)
    .join(" ");
  // Path for the gradient fill — closes the line down to the bottom
  // edge so the fill reads as "area under the curve."
  const fillPath = `${linePath} L ${xAt(points.length - 1).toFixed(2)} ${(padding + usableH).toFixed(2)} L ${xAt(0).toFixed(2)} ${(padding + usableH).toFixed(2)} Z`;

  // Trend tone: green when the period ends higher than it started,
  // muted otherwise. The sparkline is decorative; the parent's
  // dashboard carries the real performance number. Don't go red on
  // a down period — that creates anxiety in a gifter who has no
  // control over the fund.
  const firstV = values[0];
  const lastV = values[values.length - 1];
  const isUp = lastV >= firstV;
  const strokeColor = isUp
    ? "hsl(var(--kiddo-evergreen))"
    : "rgba(140,130,122,0.85)";
  const fillId = `sparkline-fill-${isUp ? "up" : "flat"}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className}
      data-testid="gifter-fund-sparkline"
    >
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={isUp ? 0.22 : 0.10} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${fillId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
