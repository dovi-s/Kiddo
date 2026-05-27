// Shared Y-axis domain for the dashboard trend chart.
//
// The old domain was hard-zero-based (`[0, dataMax + pad]`). That's right for
// long windows (ALL/5Y) where the value climbs from ~$0 and fills the chart,
// but for short windows (1W/1M/YTD) where the value sits at ~$20k and moves
// <1%, it pinned the whole line dead-flat at the top of a $0→$22k axis. Every
// brokerage chart auto-scales the axis to the visible window instead — so a
// 0.6% week is visible movement, not a flat line.
//
// This auto-scales to the window's [min, max], but floors the visible span at
// ~1% of the value so a genuinely flat window reads as *gently* flat rather
// than a jagged zoom into rounding/intraday noise. The lower bound clamps to 0
// (a fund value is never negative); for long windows dataMin ≈ 0 so the floor
// hits 0 and the familiar "grow from zero" shape is preserved.
//
// Lives in its own module (not the chart component) so BOTH the chart's YAxis
// AND the Dashboard's live-dot position math import the SAME function — the two
// coordinate spaces can never drift apart, which is the bug the old
// copy-pasted dot math kept reintroducing.
export function trendYDomain([dataMin, dataMax]: [number, number]): [number, number] {
  if (!Number.isFinite(dataMax)) return [0, 1];
  const lo = Number.isFinite(dataMin) ? dataMin : 0;
  const span = Math.max(dataMax - lo, Math.abs(dataMax) * 0.01, 1);
  const pad = span * 0.18;
  const mid = (dataMax + lo) / 2;
  const half = span / 2 + pad;
  return [Math.max(0, mid - half), mid + half];
}
