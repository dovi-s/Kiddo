// Occasion glyphs — Lucide line icons, deliberately the SAME family + weight as
// the strategy mix icons (lib/strategy.ts: TrendingUp / Scale / Shield), which
// the founder loves. Earlier this rendered hand-drawn FILLED evergreen shapes;
// those read "off." Switched to outlined Lucide marks (2026-07-08) so occasions
// and strategy read as one crafted icon system. Evergreen stroke, no fill, sized
// to drop into the tile slot the emoji occupied. Types we don't map return null
// → the caller falls back to the emoji (cultural-tradition long tail unaffected).

import type { ReactNode } from "react";
import { Cake, GraduationCap, Baby, Gift, Heart, Home, Car, Plane, Briefcase, Umbrella, type LucideIcon } from "lucide-react";

// One Lucide icon per supported key — occasion types + savings-goal types.
const ICON: Record<string, LucideIcon> = {
  // occasions
  birthday: Cake,
  graduation: GraduationCap,
  baby_shower: Baby,
  holiday: Gift,
  just_because: Heart,
  // NOTE: "custom" intentionally has NO glyph — a custom occasion is whatever the
  // person names it, so it shows their name, not a generic pencil. Callers render
  // the entered occasion name for custom instead of a mark.
  // savings goals
  college: GraduationCap,
  car: Car,
  home: Home,
  travel: Plane,
  business: Briefcase,
  emergency: Umbrella,
};

// Fold synonyms onto a mapped key. Same lookup priority as getEventCoverTheme:
// suggestion key → savings-goal type → event type.
const ALIAS: Record<string, string> = {
  college: "graduation",
  baby: "baby_shower",
  christmas: "holiday",
  hanukkah: "holiday",
};

function resolveKey(opts: {
  suggestionKey?: string | null;
  savingsGoalType?: string | null;
  eventType?: string | null;
}): string | null {
  const cands = [opts.suggestionKey, opts.savingsGoalType, opts.eventType]
    .map((v) => String(v || "").toLowerCase())
    .filter(Boolean);
  for (const c of cands) {
    const k = ALIAS[c] || c;
    if (ICON[k]) return k;
  }
  return null;
}

/** True when we have a crafted glyph for this occasion (else caller uses emoji). */
export function hasOccasionIllustration(opts: {
  suggestionKey?: string | null;
  savingsGoalType?: string | null;
  eventType?: string | null;
}): boolean {
  return resolveKey(opts) !== null;
}

/**
 * Returns the occasion's Lucide glyph (evergreen, strokeWidth 2 — matching the
 * strategy icons), or null when we have no mark for this type (caller falls back
 * to the emoji).
 */
export function renderOccasionGlyph(opts: {
  suggestionKey?: string | null;
  savingsGoalType?: string | null;
  eventType?: string | null;
  size?: number;
  title?: string;
  // Color override. Defaults to evergreen (matches the parent surfaces). Pass e.g.
  // "text-white" for a glyph sitting on a gold CTA so it matches the button's text.
  className?: string;
}): ReactNode {
  const key = resolveKey(opts);
  if (!key) return null;
  const Icon = ICON[key];
  return (
    <Icon
      size={opts.size ?? 26}
      strokeWidth={2}
      className={opts.className ?? "text-[hsl(var(--kiddo-evergreen))]"}
      aria-label={opts.title || key.replace(/_/g, " ")}
    />
  );
}
