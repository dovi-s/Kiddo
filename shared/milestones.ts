// Threshold definitions and copy for fund-value milestones. Shared so the
// server-side milestone engine (writes activity rows + Memory Book entries
// + parent emails) and the client in-app celebration card stay in lockstep.
// Drift between the two surfaces is what creates "the card celebrates $250k
// but no activity log entry" inconsistency, which used to exist before this
// module landed.
//
// Copy honors the locked design rules: no em-dashes, no AI-slop incantations,
// concrete per-threshold emotional anchors (e.g. "a year of community college,
// paid in full" — anchored to a specific real-world cost, not vibes).

export const MONEY_CROSS_THRESHOLDS = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000] as const;

export type MoneyCrossCopy = {
  title: string;
  description: (childName: string) => string;
  emotionalLine: string;
};

// Prescriptive cost-anchors dropped 2026-05-21. Earlier iterations
// mapped each threshold to a specific real-world purchase
// ("community college", "used car", "private college"). Reading
// audit:
//   - PRESCRIPTIVE — telling parents what their kid's money is FOR
//     is patronizing and class-coded. Parents whose kid is headed to
//     Stanford read "community college" as demeaning; parents
//     perfectly happy with community college read "half a private
//     college" as guilt-tripping.
//   - INDUSTRY: Acorns / Apple Wallet / Robinhood all keep their
//     achievement copy generic for exactly this reason. The number
//     itself IS the celebration; the parent gives it meaning.
//   - VARIANCE: a $5,000 milestone hits very differently for a kid
//     entering kindergarten than for one near 18. The prescription
//     ("a year of college") that fits the older kid is irrelevant
//     to the younger.
// Now the copy is just the announcement: "{Child}'s fund crossed
// $X." No cost anchor, no implied purchase, no class-coded close.
// emotionalLine is kept on the type for back-compat with consumers
// that still read it (gifter notification worker, etc.) but is
// empty everywhere — the render code already handles empty as
// "skip the sub-line."
export const MONEY_CROSS_COPY: Record<number, MoneyCrossCopy> = {
  100: {
    title: "First $100",
    description: (n) => `${n}'s fund crossed $100.`,
    emotionalLine: "",
  },
  500: {
    title: "Fund crossed $500",
    description: (n) => `${n}'s fund crossed $500.`,
    emotionalLine: "",
  },
  1000: {
    title: "Four figures",
    description: (n) => `${n}'s fund crossed $1,000.`,
    emotionalLine: "",
  },
  2500: {
    title: "Fund crossed $2,500",
    description: (n) => `${n}'s fund crossed $2,500.`,
    emotionalLine: "",
  },
  5000: {
    title: "Fund crossed $5,000",
    description: (n) => `${n}'s fund crossed $5,000.`,
    emotionalLine: "",
  },
  10000: {
    title: "Five figures",
    description: (n) => `${n}'s fund crossed $10,000.`,
    emotionalLine: "",
  },
  25000: {
    title: "Fund crossed $25,000",
    description: (n) => `${n}'s fund crossed $25,000.`,
    emotionalLine: "",
  },
  50000: {
    title: "Fund crossed $50,000",
    description: (n) => `${n}'s fund crossed $50,000.`,
    emotionalLine: "",
  },
  100000: {
    title: "Six figures",
    description: (n) => `${n}'s fund crossed $100,000.`,
    emotionalLine: "",
  },
};

// Format a milestone amount for display. Returns the full dollar
// figure with commas ($5,000 not $5K) — locked 2026-05-21 to match
// the Apple-Settings product register rather than the Robinhood-
// brand register the previous "$5K / $1M" abbreviation belonged to.
// Above $1M, abbreviate to keep the hero number readable (no kid's
// UTMA realistically hits $1M+ pre-handoff, but keep the branch).
export function formatMilestone(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString("en-US")}`;
}

// Returns the milestone threshold that was just crossed, or null if no
// threshold was crossed in this update. Both the in-app celebration card
// (client) and the server-side milestone engine use this so a $250 → $1100
// jump correctly reports the highest crossed threshold (or, in the server
// engine's case, fires for both $500 AND $1,000 by iterating the array).
//
// 2026-05-15 fix: was previously `if (prev <= 0) return null` — this gate
// skipped FIRST-GIFT crossings entirely. A brand-new fund receiving its
// first $250 gift had prev = 0, so the client celebration card never
// rendered even though the gift legitimately crossed the $100 threshold.
// The server engine (fireMoneyCrossMilestones, server/milestones.ts)
// uses `prev < t && current >= t` unconditionally and correctly fires
// the activity + Memory Book row for the first-gift case. The client
// card was the only surface skipping it — bad asymmetry. Now both
// surfaces agree: any crossing fires, including from prev = 0.
//
// Negative prev is still excluded (would imply a broken state read).
// Treat undefined / NaN inputs as no-crossing.
export function getMilestoneCrossed(prev: number, current: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(current)) return null;
  if (prev < 0) return null;
  // Round both sides to cents to match how the server engine sees them.
  // The fund's balance fields are decimal strings (e.g., "499.999...") and
  // float arithmetic on raw parseFloat values can put prev or current 1e-9
  // off from the integer milestone — enough to misfire above or below.
  // Cents-rounding matches what the user reads on screen.
  const prevC = Math.round(prev * 100) / 100;
  const currC = Math.round(current * 100) / 100;
  // Walk highest-to-lowest so the most-impressive crossed threshold is what
  // shows on the card (no point celebrating $500 when the same gift crossed
  // $1,000). The server engine iterates ascending and writes one row per
  // crossed threshold — different concern, different traversal.
  for (let i = MONEY_CROSS_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    const m = MONEY_CROSS_THRESHOLDS[i];
    if (prevC < m && currC >= m) return m;
  }
  return null;
}
