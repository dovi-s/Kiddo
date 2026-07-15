// Single source of truth for the managed-portfolio strategy names + emoji.
// These strings were hand-typed across ~10 surfaces and drifted: the middle
// tier showed up as "Steady & Balanced", "Balanced Mix", and "Balanced", and
// the emoji were semantically backwards. Centralized here so they can't drift
// again (same lesson as reserved-slugs / legal-copy).
//
// FORM: the canonical label carries the "Mix" noun. It turns the risk
// adjective into a noun phrase ("Emma's Balanced Mix", "into the Growth Mix")
// and disambiguates "Growth" the strategy from "Growth" the money gain (the
// app uses the latter for portfolio return). Reach for STRATEGY_SHORT ONLY
// where the word already sits inside a "mix" context, e.g. the parenthetical
// "Emma's mix (Balanced)", so it doesn't read as "mix mix".

import type { LucideIcon } from "lucide-react";
import { TrendingUp, Scale, Shield, SlidersHorizontal } from "lucide-react";

export type StrategyKey = "growth" | "balanced" | "conservative" | "custom";

export const STRATEGY_LABEL: Record<StrategyKey, string> = {
  growth: "Growth Mix",
  balanced: "Balanced Mix",
  conservative: "Conservative Mix",
  custom: "Custom ETF Mix",
};

// Bare adjective form, for contexts that already say "mix" nearby.
export const STRATEGY_SHORT: Record<StrategyKey, string> = {
  growth: "Growth",
  balanced: "Balanced",
  conservative: "Conservative",
  custom: "Custom",
};

// Emoji read semantically: chart-up = growth, scales = balance, shield =
// capital preservation, control sliders = "set your own mix". (Previously the
// scales sat on Conservative and the brand sprout on Balanced, both off; the
// sprout is the product mark and shouldn't be spent on a single tier. Custom
// was 🎯 but a bullseye reads "goal/aim", not "build your own"; 🎛️ literally
// means "adjust the levels", matching "pick your own ETFs and weights".)
export const STRATEGY_EMOJI: Record<StrategyKey, string> = {
  growth: "📈",
  balanced: "⚖️",
  conservative: "🛡️",
  custom: "🎛️",
};

// Bespoke monochrome glyph per strategy — the SAME semantic read as the emoji
// above (chart-up=growth, scales=balanced, shield=conservative, sliders=custom)
// rendered as brand Lucide icons so strategy reads as one crafted system, not
// colorful system emoji. This is what the dashboard StrategyIcon uses; centralize
// it here so every surface (Activity strategy-change rows, sheets, etc.) can share
// the same glyphs instead of re-typing an emoji map. Prefer THIS over
// STRATEGY_EMOJI on any in-app parent surface; the emoji stays only where a bare
// string glyph is the only option (plain-text/notification contexts).
export const STRATEGY_ICONS: Record<StrategyKey, LucideIcon> = {
  growth: TrendingUp,
  balanced: Scale,
  conservative: Shield,
  custom: SlidersHorizontal,
};
