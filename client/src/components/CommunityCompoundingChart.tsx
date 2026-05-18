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

// Warm community palette — distinct enough at a glance, soft
// enough to read as one image. The first band (biggest gifter)
// gets evergreen so the "foundation" of the community looks like
// Kiddo's primary color. Subsequent bands rotate through cream,
// gold, dusty rose, slate blue, warm taupe.
const PALETTE: Array<{ fill: string; stroke: string }> = [
  { fill: "hsl(155, 35%, 32%)", stroke: "hsl(155, 35%, 26%)" }, // evergreen
  { fill: "hsl(38, 68%, 56%)",  stroke: "hsl(38, 68%, 48%)"  }, // warm gold
  { fill: "hsl(15, 50%, 60%)",  stroke: "hsl(15, 50%, 50%)"  }, // dusty rose
  { fill: "hsl(210, 35%, 55%)", stroke: "hsl(210, 35%, 45%)" }, // slate blue
  { fill: "hsl(30, 18%, 50%)",  stroke: "hsl(30, 18%, 40%)"  }, // warm taupe
  { fill: "hsl(155, 22%, 60%)", stroke: "hsl(155, 22%, 50%)" }, // sage
  { fill: "hsl(280, 18%, 55%)", stroke: "hsl(280, 18%, 45%)" }, // muted plum
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

  const width = 320;
  const height = 90;
  const padX = 2;
  const padTop = 4;
  const padBottom = 2;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  // x: timestamp → pixel
  const xAt = (ts: number) => padX + ((ts - geometry.tMin) / geometry.tRange) * plotW;
  // y: cumulative dollar → pixel (inverted; bigger value = higher = lower y)
  const yAt = (v: number) => padTop + plotH - (v / geometry.maxTotal) * plotH;

  // Build per-series stacked path. Step-style: between consecutive
  // timestamps the cumulative stays flat, then jumps. Bottom of band
  // = previous series' top (or baseline for series 0). Top of band =
  // this series' top.
  const paths = geometry.series.map((s, sIdx) => {
    const topPts = geometry.stacked.map((row) => row.tops[sIdx]);
    const bottomPts = geometry.stacked.map((row) => (sIdx === 0 ? 0 : row.tops[sIdx - 1]));

    // Top edge step-line, left to right.
    const topD: string[] = [];
    for (let i = 0; i < geometry.timestamps.length; i += 1) {
      const x = xAt(geometry.timestamps[i]);
      const y = yAt(topPts[i]);
      if (i === 0) {
        topD.push(`M ${x.toFixed(2)},${y.toFixed(2)}`);
      } else {
        // Step: horizontal then vertical (cumulative held flat until
        // the new event, then jumps at the timestamp).
        const prevY = yAt(topPts[i - 1]);
        topD.push(`L ${x.toFixed(2)},${prevY.toFixed(2)}`);
        topD.push(`L ${x.toFixed(2)},${y.toFixed(2)}`);
      }
    }
    // Bottom edge step-line, right to left.
    const bottomD: string[] = [];
    for (let i = geometry.timestamps.length - 1; i >= 0; i -= 1) {
      const x = xAt(geometry.timestamps[i]);
      const y = yAt(bottomPts[i]);
      if (i === geometry.timestamps.length - 1) {
        bottomD.push(`L ${x.toFixed(2)},${y.toFixed(2)}`);
      } else {
        const nextY = yAt(bottomPts[i + 1]);
        bottomD.push(`L ${x.toFixed(2)},${nextY.toFixed(2)}`);
        bottomD.push(`L ${x.toFixed(2)},${y.toFixed(2)}`);
      }
    }
    const d = `${topD.join(" ")} ${bottomD.join(" ")} Z`;
    const palette = PALETTE[sIdx % PALETTE.length];
    return { d, label: s.label, totalUsd: s.totalUsd, fill: palette.fill, stroke: palette.stroke };
  });

  return (
    <div className="rounded-2xl border border-border/40 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
        How the community grew
      </p>
      <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
        Every band is someone who showed up for {childName}. The thicker the band, the more they gave.
      </p>
      <div className="w-full overflow-hidden rounded-xl bg-gradient-to-b from-[hsl(155,28%,96%)] to-[hsl(38,40%,96%)] p-2">
        <svg
          width="100%"
          height={height + 4}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="block"
          role="img"
          aria-label={`Community of ${data.totalContributors} ${data.totalContributors === 1 ? "person who" : "people who"} gave to ${childName}'s fund over time`}
        >
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.fill}
              stroke={p.stroke}
              strokeWidth={0.6}
              opacity={0.92}
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0" data-testid={`community-legend-${i}`}>
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: p.fill }}
              aria-hidden
            />
            <span className="text-[11px] text-muted-foreground truncate">{p.label}</span>
            <span className="text-[11px] font-semibold text-foreground tabular-nums ml-auto">
              {fmtUsd(p.totalUsd)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
