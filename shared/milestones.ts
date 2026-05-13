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

export const MONEY_CROSS_COPY: Record<number, MoneyCrossCopy> = {
  100: {
    title: "First $100",
    description: (n) => `${n}'s fund just crossed $100. The first century. Every gift from here builds on this.`,
    emotionalLine: "The first century. Every gift from here builds on this.",
  },
  500: {
    title: "Fund crossed $500",
    description: (n) => `${n}'s fund hit $500. Real momentum.`,
    emotionalLine: "Real momentum.",
  },
  1000: {
    title: "Four figures",
    description: (n) => `${n}'s fund crossed $1,000. Years of small gifts compound into something serious.`,
    emotionalLine: "Years of small gifts compound into something serious.",
  },
  2500: {
    title: "Fund crossed $2,500",
    description: (n) => `${n}'s fund just hit $2,500.`,
    emotionalLine: "The compounding is real now.",
  },
  5000: {
    title: "Fund crossed $5,000",
    description: (n) => `${n}'s fund crossed $5,000. A year of community college, paid in full.`,
    emotionalLine: "A year of community college, paid in full.",
  },
  10000: {
    title: "Five figures",
    description: (n) => `${n}'s fund hit $10,000. This is a real number now.`,
    emotionalLine: "This is a real number now.",
  },
  25000: {
    title: "Fund crossed $25,000",
    description: (n) => `${n}'s fund crossed $25,000. Pre-college territory.`,
    emotionalLine: "Pre-college territory.",
  },
  50000: {
    title: "Half-college",
    description: (n) => `${n}'s fund hit $50,000. Half of a four-year private college, in the bank.`,
    emotionalLine: "Half of a four-year private college, in the bank.",
  },
  100000: {
    title: "Six figures",
    description: (n) => `${n}'s fund crossed $100,000. A full state-school year, plus.`,
    emotionalLine: "A full state-school year, plus.",
  },
};

// Format a milestone amount for display ($5,000 → "$5K", $1,000,000 → "$1M").
// Used in the in-app card's headline number + share text.
export function formatMilestone(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// Returns the milestone threshold that was just crossed, or null if no
// threshold was crossed in this update. Both the in-app celebration card
// (client) and the server-side milestone engine use this so a $250 → $1100
// jump correctly reports the highest crossed threshold (or, in the server
// engine's case, fires for both $500 AND $1,000 by iterating the array).
export function getMilestoneCrossed(prev: number, current: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(current)) return null;
  if (prev <= 0) return null;
  // Walk highest-to-lowest so the most-impressive crossed threshold is what
  // shows on the card (no point celebrating $500 when the same gift crossed
  // $1,000). The server engine iterates ascending and writes one row per
  // crossed threshold — different concern, different traversal.
  for (let i = MONEY_CROSS_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    const m = MONEY_CROSS_THRESHOLDS[i];
    if (prev < m && current >= m) return m;
  }
  return null;
}
