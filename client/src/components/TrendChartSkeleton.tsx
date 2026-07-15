// Calm loading placeholder for the lazy DashboardTrendChart.
//
// Recharts is a heavy dependency, so the trend chart is code-split (lazy) to
// keep it out of the Dashboard's critical bundle. The cost was that the chart
// arrived LAST — its chunk downloads after everything else — and the previous
// Suspense fallback was a near-invisible evergreen gradient box, which read as
// a BLANK area that then "rolled in" once the chunk landed.
//
// This shows a chart-SHAPED pulse instead, so the area reads as "a chart is
// loading" (the same pulse-gate discipline used across the app) rather than
// broken. Paired with an idle-time prefetch of the chunk (see the Dashboard /
// DashboardLab onIdle hooks), so in the common case the chart is already warm
// and this barely flashes; it's the graceful safety net for the slow-load tail.
export function TrendChartSkeleton({ heightPx = 180 }: { heightPx?: number }) {
  return (
    <div className="w-full animate-pulse" style={{ height: heightPx }} aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 180"
        preserveAspectRatio="none"
        role="img"
        aria-label="Loading chart"
      >
        <defs>
          <linearGradient id="trend-skel-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--kiddo-evergreen))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--kiddo-evergreen))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Soft upward-drift silhouette — a generic rising shape, never real
            data. Area fill + line, both faint, so it reads as a calm placeholder
            in the chart's own footprint. */}
        <path
          d="M0,150 C60,140 95,118 140,108 C190,97 225,68 320,40 L320,180 L0,180 Z"
          fill="url(#trend-skel-fill)"
        />
        <path
          d="M0,150 C60,140 95,118 140,108 C190,97 225,68 320,40"
          fill="none"
          stroke="hsl(var(--kiddo-evergreen))"
          strokeOpacity="0.18"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
