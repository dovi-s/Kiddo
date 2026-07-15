// Banner priority + cap for the parent dashboard.
//
// The dashboard can surface ~11 banners/nudges (action items, setup, the
// away-digest, birthday, at-18 welcome, co-parent accepted, first-media,
// recurring-requests, Plus upgrade, milestone, closed-fund). Each is gated
// individually and a few suppress each other ad hoc, but nothing caps the TOTAL
// — so a returning parent on a rich fund (birthday + co-parent + milestone +
// media …) can face a wall of cards before they reach the balance.
//
// This is the single source of truth for "given everything that COULD show,
// which actually should." It's a pure function so it's trivially testable and
// can't drift: feed it the eligibility booleans the render sites already
// compute, gate each render site on the returned set. Four tiers:
//   1. needs-you   — real blockers (action items, closed fund). Always shown.
//   2. setup       — finish-setup nudge. Shown while incomplete.
//   3. celebration — at most ONE, rarest wins (a once-in-childhood at-18 moment
//                    must never stack under a birthday nudge + a milestone).
//   4. nudge       — soft prompts. Suppressed entirely while a needs-you blocker
//                    is present (don't beg for an upsell next to a KYC failure).

export type BannerId =
  // Tier 1 — needs-you
  | "actionItems"
  | "closedFund"
  // Tier 2 — setup
  | "setupProgress"
  // Tier 3 — celebrations (single slot)
  | "kidAt18"
  | "coparentAccepted"
  | "birthday"
  | "milestone"
  | "plusFirstMedia"
  // Tier 4 — nudges
  | "digest"
  | "recurringRequests"
  | "plusUpgrade";

// The single celebration slot, rarest/most-meaningful first. The kid claiming
// the fund at majority is the keystone moment of the whole product; a co-parent
// joining is a relationship milestone; a birthday is recurring; a value
// milestone and a first-media unlock are nice but lesser.
export const CELEBRATION_PRIORITY: readonly BannerId[] = [
  "kidAt18",
  "coparentAccepted",
  "birthday",
  "milestone",
  "plusFirstMedia",
] as const;

const NUDGES: readonly BannerId[] = ["digest", "recurringRequests", "plusUpgrade"] as const;

export interface PickedBanners {
  allowed: Set<BannerId>;
  /** Convenience for gating a render site: `picked.show("birthday")`. */
  show: (id: BannerId) => boolean;
  /** Which celebration (if any) won the single slot — handy for tests/telemetry. */
  winningCelebration: BannerId | null;
}

/**
 * Decide which banners may render, given which are individually eligible.
 * Pure: same input → same output, no globals, no side effects.
 */
export function pickBanners(eligible: Partial<Record<BannerId, boolean>>): PickedBanners {
  const is = (id: BannerId) => eligible[id] === true;
  const allowed = new Set<BannerId>();

  // Tier 1 — needs-you: always shown (rare + genuinely actionable).
  if (is("actionItems")) allowed.add("actionItems");
  if (is("closedFund")) allowed.add("closedFund");
  const hasNeedsYou = allowed.has("actionItems") || allowed.has("closedFund");

  // Tier 2 — setup: shown whenever setup is incomplete.
  if (is("setupProgress")) allowed.add("setupProgress");

  // Tier 3 — celebrations: at most ONE, rarest wins.
  const winningCelebration = CELEBRATION_PRIORITY.find((id) => is(id)) ?? null;
  if (winningCelebration) allowed.add(winningCelebration);

  // Tier 4 — nudges: suppressed entirely while a needs-you blocker is present.
  if (!hasNeedsYou) {
    for (const id of NUDGES) {
      if (is(id)) allowed.add(id);
    }
  }

  return { allowed, show: (id) => allowed.has(id), winningCelebration };
}
