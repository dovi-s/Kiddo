// ProjectionTrajectoryChart — the visual axis for what's currently
// text-only on Projection.tsx. The page renders a single projected
// dollar number at the target-age slider position; this component
// adds the CURVE that connects "today" to "target" through every
// year in between.
//
// Locked 2026-05-26 alongside the FundTabs + Community Chart on
// Dashboard ships. Real gap closed: Projection.tsx had a slider
// driving an animated number, but no actual visual trajectory of
// growth. Inspired by the BTC chart pattern Acorns / Cash App use
// (clean line + range tabs) but stripped to the calm register
// Kiddo's locked design philosophy enforces:
//   - Handrolled SVG, no chart-library dependency
//   - No gridlines, no axis ticks, no labels on the curve itself
//   - Soft evergreen stroke with a faint area fill below
//   - Single emphasized dot at the target-age position
//   - Tiny anchors at today + target showing dollar values
//   - Mobile-first, scales fluidly to container width
//
// Why not Recharts: the existing DashboardTrendChart uses Recharts,
// but for a single-line projection without scrub interaction the
// Recharts overhead (axes, tooltip, motion, theme) is excessive.
// Handrolling 80 lines of SVG keeps the chart at calm-register
// minimum and follows the handrolled-SVG discipline
// (no chart library, no axis labels).
//
// The math comes from the parent's projectFundValue() helper via
// the `points` prop — the page computes one cumulative projection
// per year and passes the series in. This component is purely
// presentational; it doesn't recompute math, ensuring the curve
// matches the slider's target-age number exactly.

import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { motion } from "framer-motion";

export type TrajectoryPoint = {
  // Age at this point in the projection. Used for ordering + the
  // optional target-age dot match.
  age: number;
  // Projected value in USD at this age.
  value: number;
};

interface Props {
  points: TrajectoryPoint[];
  // The age the slider currently targets. The component emphasizes
  // this point with a dot + tiny dollar label.
  targetAge: number;
  // The current balance value (start anchor). Rendered as a tiny
  // dollar label at the start of the curve.
  currentValue: number;
  // The current age (anchor for the "today" label). Optional —
  // when missing, the start dot has no age label.
  currentAge?: number;
  // Optional CSS height. Defaults to 168px.
  heightPx?: number;
  // Optional milestone marker drawn ON the curve, distinct from the
  // target endpoint — e.g. the at-majority handoff age. Renders a small
  // hollow dot + tiny label at that age so the curve reads as "the climb
  // CONTINUES past this point" (the handoff is a waypoint, not the finish
  // line). When omitted, no milestone is drawn (Projection.tsx behaviour
  // is unchanged).
  milestoneAge?: number;
  milestoneLabel?: string;
  // When false, hide the target-endpoint DOLLAR label (e.g. "$114K") while keeping
  // the "Age NN" eyebrow + the curve. Use when the surrounding copy already states the
  // projected number — so the chart shows the SHAPE and the text carries the figure
  // (with its honest conditional framing the bare chart number can't). Default true
  // preserves standalone behavior (Projection.tsx + live dashboards).
  showTargetValue?: boolean;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function ProjectionTrajectoryChart({
  points,
  targetAge,
  currentValue,
  currentAge,
  heightPx = 168,
  milestoneAge,
  milestoneLabel,
  showTargetValue = true,
}: Props) {
  // Measure the container so the viewBox ratio MATCHES the rendered
  // box. Previously the viewBox was locked to a fixed 3:1 ratio with
  // preserveAspectRatio="meet" — on a wide card the chart got pinned
  // by its height and floated as a small island with empty gutters on
  // either side ("a square in a rectangle"). By widening the viewBox's
  // horizontal extent to the live width:height ratio, "meet" becomes a
  // no-op (ratios match) so the curve fills the whole card AND circles
  // stay perfectly round + text un-stretched. Fixed 2026-05-29.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Hide entirely with fewer than 2 points — the curve needs a
  // start and an end to render meaningfully. The slider page
  // always passes a series of length yearsAhead+1, so this is
  // mostly defensive; the empty state is "no chart" rather than
  // "empty chart with axes."
  const ok = Array.isArray(points) && points.length >= 2;

  // Vertical resolution is fixed at 200 (all font sizes + paddings are
  // calibrated against it). The horizontal extent tracks the live
  // container ratio so the viewBox aspect ratio === the rendered box —
  // the chart fills the card edge-to-edge with no side gutters. Falls
  // back to a 3.4:1 ratio before the first measurement.
  const VB_H = 200;
  const ratio = containerWidth > 0 ? containerWidth / heightPx : 3.4;
  const VB_W = Math.round(VB_H * ratio);
  const PAD_X_PCT = 0.04;
  // Top padding must clear the FULL target callout, not just the dot:
  // the "Age NN" eyebrow sits 32 units above the dot (fontSize 10, so
  // its glyphs reach ~40 units above the dot center). The highest data
  // point maps to y = padTop, so padTop needs to exceed that ~40-unit
  // stack or the eyebrow clips off the top edge. 0.22 * 200 = 44 clears
  // it with margin. (Was 0.18 = 36, which cut off "Age 40".)
  const PAD_TOP_PCT = 0.22;
  const PAD_BOT_PCT = 0.08;

  const drawnArea = useMemo(() => {
    if (!ok) return null;
    const xs = points.map((p) => p.age);
    const ys = points.map((p) => p.value);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    // Avoid divide-by-zero when the user is at $0 and target = today
    // (degenerate single-point case). The `ok` guard catches len < 2
    // already; this further guards the math.
    const xRange = xMax === xMin ? 1 : xMax - xMin;
    const yRange = yMax === yMin ? 1 : yMax - yMin;
    const padX = VB_W * PAD_X_PCT;
    const padTop = VB_H * PAD_TOP_PCT;
    const padBot = VB_H * PAD_BOT_PCT;
    const drawW = VB_W - padX * 2;
    const drawH = VB_H - padTop - padBot;
    // Map a point's data coords to SVG coords.
    const toX = (age: number) => padX + ((age - xMin) / xRange) * drawW;
    const toY = (value: number) => padTop + drawH - ((value - yMin) / yRange) * drawH;
    // Build the line + the fill area below it. The fill closes at
    // the chart's baseline so the area reads as a soft hill, not a
    // floating curve.
    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.age).toFixed(2)},${toY(p.value).toFixed(2)}`)
      .join(" ");
    const baseY = padTop + drawH;
    const firstX = toX(points[0].age);
    const lastX = toX(points[points.length - 1].age);
    const fillPath = `${linePath} L${lastX.toFixed(2)},${baseY.toFixed(2)} L${firstX.toFixed(2)},${baseY.toFixed(2)} Z`;
    // Find the point closest to the target age for the emphasis dot.
    let targetIdx = 0;
    let targetDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.age - targetAge);
      if (d < targetDist) {
        targetDist = d;
        targetIdx = i;
      }
    });
    const targetPoint = points[targetIdx];
    const targetX = toX(targetPoint.age);
    const targetY = toY(targetPoint.value);
    const startX = toX(points[0].age);
    const startY = toY(points[0].value);
    // Milestone marker (e.g. the handoff age) — the curve point nearest
    // milestoneAge, so it sits ON the line and the trajectory visibly
    // continues to the right of it.
    let milestone: { x: number; y: number; value: number; age: number } | null = null;
    if (typeof milestoneAge === "number") {
      let mIdx = 0;
      let mDist = Infinity;
      points.forEach((p, i) => {
        const d = Math.abs(p.age - milestoneAge);
        if (d < mDist) { mDist = d; mIdx = i; }
      });
      const mp = points[mIdx];
      milestone = { x: toX(mp.age), y: toY(mp.value), value: mp.value, age: mp.age };
    }
    return {
      linePath,
      fillPath,
      targetX,
      targetY,
      targetValue: targetPoint.value,
      targetAgeReal: targetPoint.age,
      startX,
      startY,
      startValue: points[0].value,
      baseY,
      milestone,
    };
  }, [ok, points, targetAge, milestoneAge, VB_W, VB_H]);

  if (!ok || !drawnArea) return null;

  const evergreen = "hsl(var(--kiddo-evergreen))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full"
      data-testid="projection-trajectory-chart"
      ref={containerRef}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        // The viewBox ratio now tracks the live container ratio (see
        // the ResizeObserver above), so "meet" no longer letterboxes —
        // it fills the card edge-to-edge while keeping circles round
        // and text un-stretched (uniform scale). The old fixed 3:1
        // viewBox under "meet" left empty side gutters on wide cards.
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: heightPx, display: "block" }}
        aria-label={`Projected growth trajectory from ${fmtCompact(currentValue)}${currentAge ? ` at age ${currentAge}` : ""} to ${fmtCompact(drawnArea.targetValue)} at age ${drawnArea.targetAgeReal}`}
        role="img"
      >
        {/* Gradient for the area fill — stronger top stop than the
            v1 (0.24 vs 0.18) so the curve reads against the card
            background instead of fading into it. Still soft at the
            bottom (0.03) so the calm register holds. */}
        <defs>
          <linearGradient id="trajectory-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={evergreen} stopOpacity="0.24" />
            <stop offset="100%" stopColor={evergreen} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Filled area below the curve. */}
        <motion.path
          d={drawnArea.fillPath}
          fill="url(#trajectory-area-fill)"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        />

        {/* The curve itself. Bolder stroke (3 vs 2.5 in v1) so the
            line reads confidently. vector-effect keeps the visual
            width identical across responsive scales — the curve
            never goes "thin" when the chart is wide. */}
        <motion.path
          d={drawnArea.linePath}
          fill="none"
          stroke={evergreen}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0.6 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />

        {/* Start dot — anchors "today" at the curve's beginning. */}
        <circle
          cx={drawnArea.startX}
          cy={drawnArea.startY}
          r={4.5}
          fill="white"
          stroke={evergreen}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {/* Milestone marker (e.g. the handoff age) — a hollow dot ON the
            curve with a tiny label below it. Distinct from the target dot
            (which is the far endpoint) so the eye reads the climb as
            CONTINUING past the milestone, not ending at it. */}
        {drawnArea.milestone && (
          <>
            <circle
              cx={drawnArea.milestone.x}
              cy={drawnArea.milestone.y}
              r={5}
              fill="white"
              stroke={evergreen}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
            {milestoneLabel && (
              <text
                x={drawnArea.milestone.x}
                y={drawnArea.milestone.y + 18}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="hsl(var(--kiddo-ink) / 0.5)"
                style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}
              >
                {milestoneLabel}
              </text>
            )}
          </>
        )}

        {/* Target dot — bigger (r=7 vs 6 in v1) so the focal point
            actually reads as the focal point on mobile-sized charts.
            (No position animation: the chart auto-rescales so the target
            point is always the curve's top-right anchor — max age =
            rightmost, max value = topmost — so its pixel position is
            constant across slider values. A "glide" here verifiably moved
            0px, so it stays a clean mount-only scale-in.) */}
        <motion.circle
          cx={drawnArea.targetX}
          cy={drawnArea.targetY}
          r={7}
          fill={evergreen}
          stroke="white"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 380, damping: 22 }}
        />

        {/* Target callout — bigger dollar label (16 vs 14 in v1)
            and stronger age eyebrow weight. The calm register said
            "single label, no axis ticks" — that's still true — but
            the one label we DO render needs to anchor the chart's
            emotional point ("where does this end up").

            Horizontal anchoring: the target dot is ALWAYS the rightmost
            point (max age = rightmost), so it sits at x = VB_W - padX,
            flush against the right edge. A centered label overflows the
            viewBox and clips ("$784K" / "Age 65" cut off on the right).
            Anchor the label to whichever edge it's near — end on the
            right, start on the left, middle in between — so it grows
            inward and stays inside the chart. Fixed 2026-06-09 (the
            horizontal twin of the PAD_TOP "Age 40" vertical-clip fix). */}
        {(() => {
          const edgeBand = VB_W * (PAD_X_PCT + 0.06);
          const labelAnchor =
            drawnArea.targetX > VB_W - edgeBand
              ? "end"
              : drawnArea.targetX < edgeBand
                ? "start"
                : "middle";
          return (
            <>
              {showTargetValue && (
                <text
                  x={drawnArea.targetX}
                  y={drawnArea.targetY - 16}
                  textAnchor={labelAnchor}
                  fontSize="16"
                  fontWeight="700"
                  fill={evergreen}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmtCompact(drawnArea.targetValue)}
                </text>
              )}
              {/* When the dollar label is hidden, drop the age eyebrow down to where
                  the value sat (−16) so it stays snug above the dot instead of floating
                  with an empty gap below it. */}
              <text
                x={drawnArea.targetX}
                y={drawnArea.targetY - (showTargetValue ? 32 : 16)}
                textAnchor={labelAnchor}
                fontSize="10"
                fontWeight="600"
                fill="hsl(var(--kiddo-ink) / 0.55)"
                style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                Age {drawnArea.targetAgeReal}
              </text>
            </>
          );
        })()}
      </svg>
    </motion.div>
  );
}
