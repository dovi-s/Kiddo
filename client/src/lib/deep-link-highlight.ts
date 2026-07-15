// Canonical "deep-link landing" highlight + scroll style.
//
// One look across the app: when a user taps a summary row that says "View →"
// or "See in Memory Book", the destination page lands on the EXACT row the
// summary referred to with a brief gold-on-cream wash so the eye knows where
// it was sent. This file centralizes the look so we don't end up with three
// drifting variants (which we did briefly — the cream halo from Memory Book
// vs the thin gold ring from Activity).
//
// The look is the Activity "Scheduled" row treatment — what the user signed
// off on after seeing it for the auto-invest "Next: $25 · View →" path.
// Subtle, Apple-Settings-register, NOT shouty.
//
// Usage in a row:
//   <div style={getDeepLinkHighlightStyle(highlightedId === rowId)} ... />
//
// Usage in a deep-link page:
//   const cancel = scrollToTestId(`memory-entry-${target.id}`, {
//     onFound: () => { ... clear highlight after HIGHLIGHT_HOLD_MS ... },
//     onMissed: () => { ... },
//   });

import type { CSSProperties } from "react";

/** ms to keep the highlight visible after scroll lands. Long enough to read,
 *  short enough to feel intentional rather than persistent state. */
export const HIGHLIGHT_HOLD_MS = 2500;

/** URL params that signal an in-flight deep-link. Pages that auto-reset
 *  pagination / filters on every render should consult this list and SKIP
 *  the reset while a deep-link is being consumed — otherwise the reset
 *  clobbers the visibleCount/filter bump the deep-link effect just made. */
export const DEEP_LINK_PARAMS = ["gift", "gifter", "highlight", "scrollTo", "anchor"] as const;

/** Returns true when the current URL has any deep-link param. Read by
 *  list-page effects so they don't reset state mid-landing. */
export function hasActiveDeepLink(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  for (const key of DEEP_LINK_PARAMS) if (params.has(key)) return true;
  return false;
}

/** Row variant — the look. Soft gold wash, thin gold ring, faded transition.
 *  Returns ONLY the highlight-specific properties (background / boxShadow /
 *  transition / borderRadius) so callers can compose with their own
 *  padding/margin without conflict. For surfaces that want the bg to bleed
 *  past the row edges (Activity does this with its own margin: 0 -8px /
 *  padding: 0 8px), apply that alongside this style.
 *
 *  borderRadius is set unconditionally to 12 so the box doesn't square-snap
 *  during the fade-out — matches the smooth visual register the user signed
 *  off on after seeing the auto-invest "Next: $25 · View →" landing.
 *
 *  Use for: a single row in a list (Activity Scheduled rows, Memory Book
 *  timeline rows) where the row itself IS the visual element.
 *  DON'T use for: a card nested inside a wrapper with extra gutter padding
 *  (e.g., Memory Book story view's timeline wrapper) — the highlight would
 *  cover the gutter, not the card. Use `getDeepLinkHighlightCardStyle`. */
export function getDeepLinkHighlightStyle(isHighlighted: boolean): CSSProperties {
  return {
    borderRadius: 12,
    background: isHighlighted ? "hsl(var(--kiddo-gold) / 0.10)" : "transparent",
    boxShadow: isHighlighted ? "inset 0 0 0 1px hsl(var(--kiddo-gold) / 0.30)" : "none",
    transition: "background 0.4s ease, box-shadow 0.4s ease",
  };
}

/** Soft variant — for FLUSH, card-LESS sections: a label + flush rows that
 *  have no border/background of their own (e.g. DashboardLab's "Your part"
 *  recurring / one-time groups, which are deliberately flush "no card" to match
 *  the holdings sub-groups). The card variant's crisp 2px ring + 16px radius
 *  drew a hard CARD box around content that's meant to be border-less — it read
 *  as a baggy, mismatched box (worse when the group also contains its own
 *  bordered "+ Add another", giving a box-in-box). This is a gentle gold WASH
 *  with only a whisper of edge: a soft "you landed here" spotlight that suits
 *  flush content and fades like the others. Radius kept small (12) so the wash
 *  reads soft, not card-like. */
export function getDeepLinkHighlightSoftStyle(isHighlighted: boolean, radius = 12): CSSProperties {
  return {
    // Ring-less soft gleam. The old 1px gold ring drew a literal BOX around the
    // section, which read as a tacked-on "highlight" (founder: "so AI, not on
    // par"). Dropped the ring and softened the wash so it's a gentle warm glow
    // that fades as the eye settles — the scroll motion already tells you where
    // you landed, so the cue only needs to whisper, not outline.
    background: isHighlighted ? "hsl(var(--kiddo-gold) / 0.06)" : undefined,
    ...(isHighlighted ? { borderRadius: radius } : {}),
    transition: "background 0.7s ease",
  };
}

/** Card variant — for surfaces where the highlight needs to land on a CARD
 *  element with its OWN border-radius and box-shadow (Memory Book story view,
 *  any future "card-in-a-wrapper" layout). Composes with the card's existing
 *  shadow rather than replacing it.
 *
 *  - background: gold wash overlay (overrides the card's bg-card; revert by
 *    not passing isHighlighted).
 *  - boxShadow: the card's existing shadow PLUS an inner gold ring at 2px so
 *    the gold reads at card-edge density.
 *  - borderRadius: NOT set — caller controls via Tailwind `rounded-*`.
 *
 *  Pass the card's existing baseBoxShadow string (typically the same string
 *  you'd put in a Tailwind `shadow-[...]` arbitrary value) so the gold ring
 *  composes onto it. When not highlighted, returns the base shadow unchanged. */
export function getDeepLinkHighlightCardStyle(
  isHighlighted: boolean,
  baseBoxShadow = "",
  // Radius the gold halo rounds to WHILE highlighted (px), so the ring matches
  // the app's card language instead of snapping to a sharp rectangle. Defaults
  // to 16 (rounded-2xl / .kiddo-card, the app's card standard) — needed because
  // some targets get their rounding from a PARENT wrapper and are themselves a
  // bare content div (e.g. DashboardLab's `recurring-list-view` = just
  // `overflow-hidden`, no radius → the ring drew as a weird square). Only
  // applied while highlighted, so a target's resting geometry is never touched.
  // Pass a different value for a card whose corners aren't 16px.
  radius = 16,
): CSSProperties {
  const goldRing = "inset 0 0 0 2px hsl(var(--kiddo-gold) / 0.55)";
  return {
    background: isHighlighted ? "hsl(var(--kiddo-gold) / 0.10)" : undefined,
    boxShadow: isHighlighted
      ? (baseBoxShadow ? `${baseBoxShadow}, ${goldRing}` : goldRing)
      : (baseBoxShadow || undefined),
    ...(isHighlighted ? { borderRadius: radius } : {}),
    transition: "background 0.4s ease, box-shadow 0.4s ease",
  };
}
