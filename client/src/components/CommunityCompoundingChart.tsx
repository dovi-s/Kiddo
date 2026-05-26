// Community Compounding Chart — KidView's self-portrait visual.
//
// Each gifter who contributed to this fund renders as a distinct
// color BAND on a stacked area chart. The bands grow over time as
// gifts arrive. The visual answer to "who built this fund?": the
// answer is a community, layered, growing together. Locked
// 2026-05-18 per the Target-vs-Walmart positioning discussion as
// the single most-powerful asset Kiddo can render against the
// Acorns-tier round-up competition.
//
// Implementation: handrolled SVG (no chart library). Step-style
// stacked area paths — between gift events the cumulative stays
// flat, at each gift event the corresponding band thickens. This
// is honest: no interpolation, just the real shape of the gifts
// that came in.
//
// Tone discipline:
//   - No labels on the axes (this is a feeling, not a spreadsheet).
//   - Soft warm palette (cream + evergreen + gold + dusty rose).
//   - Tiny, calm legend below — name + total per gifter.
//   - Mobile-first; renders cleanly on narrow viewports.
//   - Hides entirely with < 2 series or < 2 events (no chart
//     before there's a community).

import { useMemo } from "react";
import { capFirst } from "@/lib/format-name";

export type CommunitySeries = {
  label: string;
  totalUsd: number;
  points: Array<{ at: string; cumulative: number }>;
};

export type CommunityData = {
  fundStartedAt: string | null;
  totalContributors: number;
  series: CommunitySeries[];
};

interface Props {
  data: CommunityData;
  childFirstName?: string | null;
}

// Warm community palette — distinct enough at a glance, cohesive
// as one image. Redesigned 2026-05-26 after audit-flagged the
// previous palette mixed warm + cool tones (slate blue, plum)
// which broke the "warm community" register. New palette is all-
// warm, sorted by saturation: evergreen anchors the biggest band
// (most generous contributor), then warm-yellow gold, terracotta,
// sage, muted ochre, sienna, dusty mauve. Reads as ONE warm
// painting, not a generic stacked area chart.
const PALETTE: Array<{ fill: string }> = [
  { fill: "hsl(155, 38%, 34%)" }, // deep evergreen — anchor
  { fill: "hsl(38, 70%, 58%)"  }, // warm gold
  { fill: "hsl(15, 55%, 58%)"  }, // terracotta
  { fill: "hsl(155, 24%, 56%)" }, // sage
  { fill: "hsl(28, 38%, 52%)"  }, // muted ochre
  { fill: "hsl(8, 45%, 52%)"   }, // sienna
  { fill: "hsl(345, 25%, 60%)" }, // dusty mauve
];

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function CommunityCompoundingChart({ data, childFirstName }: Props) {
  const childName = capFirst(childFirstName) || "this kid";

  // Build the chart geometry. Memoized so resize doesn't re-compute
  // unnecessarily; recomputes when the data shape changes.
  const geometry = useMemo(() => {
    if (!data || !data.series || data.series.length === 0) return null;
    // Filter series that have at least one event.
    const series = data.series.filter((s) => s.points.length > 0);
    if (series.length === 0) return null;

    // Collect every distinct timestamp across all series + the
    // fund-start anchor. This gives the chart's X-axis tick set.
    const tsSet = new Set<number>();
    if (data.fundStartedAt) tsSet.add(new Date(data.fundStartedAt).getTime());
    for (const s of series) {
      for (const p of s.points) tsSet.add(new Date(p.at).getTime());
    }
    // Add NOW as the final anchor so the rightmost edge of the
    // chart shows where the community sits today (otherwise the
    // chart visually ends at the last gift, which can be a while
    // ago).
    tsSet.add(Date.now());
    const timestamps = Array.from(tsSet).sort((a, b) => a - b);
    if (timestamps.length < 2) return null;

    const tMin = timestamps[0];
    const tMax = timestamps[timestamps.length - 1];
    const tRange = Math.max(1, tMax - tMin);

    // Per-series running cumulative at each timestamp. Looks up the
    // most recent (at <= ts) point's cumulative; defaults to 0.
    const cumulativeAt = (s: CommunitySeries, ts: number): number => {
      let total = 0;
      for (const p of s.points) {
        const pt = new Date(p.at).getTime();
        if (pt <= ts) total = p.cumulative;
        else break;
      }
      return total;
    };

    // For each timestamp, compute each series' cumulative and the
    // stack y-position (cumulative offset from baseline).
    const stacked = timestamps.map((ts) => {
      const tops: number[] = [];
      let running = 0;
      for (const s of series) {
        running += cumulativeAt(s, ts);
        tops.push(running);
      }
      return { ts, tops };
    });

    const maxTotal = Math.max(...stacked.map((row) => row.tops[row.tops.length - 1] || 0), 1);

    return { series, timestamps, tMin, tRange, stacked, maxTotal };
  }, [data]);

  if (!geometry) return null;
  // Hide chart when there's only one gifter and < 2 events — the
  // visual needs at least one stacking + one progression to read
  // as "compounding."
  if (geometry.series.length < 1) return null;
  if (geometry.series.length === 1 && geometry.series[0].points.length < 2) return null;

  // Chart dimensions — taller than v1 (90 → 150) so the bands have
  // room to breathe and the visual reads as a landscape rather than
  // a thin strip. viewBox 600x300 (2:1 ratio) plays well at the
  // typical card width (480-720px on mobile, 600-800px on desktop)
  // with `xMidYMid meet` preservation.
  const width = 600;
  const height = 300;
  const padX = 6;
  const padTop = 10;
  const padBottom = 4;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  // x: timestamp → pixel
  const xAt = (ts: number) => padX + ((ts - geometry.tMin) / geometry.tRange) * plotW;
  // y: cumulative dollar → pixel (inverted; bigger value = higher = lower y)
  const yAt = (v: number) => padTop + plotH - (v / geometry.maxTotal) * plotH;

  // Build per-series stacked path. LINEAR interpolation between
  // event timestamps (was step-style; v1 looked computational —
  // long flats with sudden vertical jumps). Linear diagonals read
  // as organic growth and tile perfectly between adjacent bands
  // (same data point → same screen coordinate on both edges; no
  // smoothing artifact where an upper band's bottom dips below
  // the lower band's top). Audit-flagged 2026-05-26.
  const paths = geometry.series.map((s, sIdx) => {
    const topPts = geometry.stacked.map((row) => row.tops[sIdx]);
    const bottomPts = geometry.stacked.map((row) => (sIdx === 0 ? 0 : row.tops[sIdx - 1]));

    // Top edge: diagonal line through every event timestamp.
    const topD: string[] = [];
    for (let i = 0; i < geometry.timestamps.length; i += 1) {
      const x = xAt(geometry.timestamps[i]);
      const y = yAt(topPts[i]);
      topD.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)},${y.toFixed(2)}`);
    }
    // Bottom edge: diagonal line back, right to left.
    const bottomD: string[] = [];
    for (let i = geometry.timestamps.length - 1; i >= 0; i -= 1) {
      const x = xAt(geometry.timestamps[i]);
      const y = yAt(bottomPts[i]);
      bottomD.push(`L ${x.toFixed(2)},${y.toFixed(2)}`);
    }
    const d = `${topD.join(" ")} ${bottomD.join(" ")} Z`;
    const palette = PALETTE[sIdx % PALETTE.length];
    return { d, label: s.label, totalUsd: s.totalUsd, fill: palette.fill };
  });

  return (
    <div className="rounded-2xl border border-border/40 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
        How the community grew
      </p>
      <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
        Every band is someone who showed up for {childName}. The thicker the band, the more they gave.
      </p>
      {/* Background: subtle warm-evergreen radial-ish gradient via two
          stops; richer than the v1 near-white pastel which read as
          empty space. The 92% lightness on the top stop is bright
          enough to keep "calm warm community" register but dark
          enough that the bands actually have something to sit on. */}
      <div className="w-full overflow-hidden rounded-xl bg-gradient-to-b from-[hsl(155,32%,92%)] to-[hsl(38,45%,93%)] p-3">
        <svg
          width="100%"
          height="auto"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block"
          style={{ width: "100%", height: "auto" }}
          role="img"
          aria-label={`Community of ${data.totalContributors} ${data.totalContributors === 1 ? "person who" : "people who"} gave to ${childName}'s fund over time`}
        >
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.fill}
              stroke="none"
            />
          ))}
        </svg>
      </div>
      {/* Legend — vertical list, sorted by amount desc (the series
          already arrive sorted by totalUsd descending from the
          aggregator). Was a 2-3 col grid in v1; for 3-5 contributors
          a vertical list reads cleaner and matches the band order
          visually (top band = top legend row). Color dot is bigger
          (3.5 → 4.5) so the band-to-legend visual link is obvious. */}
      <div className="mt-3 space-y-1.5">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-2.5" data-testid={`community-legend-${i}`}>
            <span
              className="h-3 w-3 rounded-sm shrink-0"
              style={{ background: p.fill }}
              aria-hidden
            />
            <span className="text-[12px] text-foreground truncate flex-1">{p.label}</span>
            <span className="text-[12px] font-semibold text-foreground tabular-nums">
              {fmtUsd(p.totalUsd)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
