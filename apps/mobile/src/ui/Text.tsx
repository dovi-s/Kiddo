// KText — the one text primitive. Every label/number/heading goes through this so
// type scale, weight, color, brand font, and tabular figures stay consistent with
// the web. Never use raw <Text> in screens. Mirrors the web type ladder + the
// "sentence-case warm section label" voice.

import React from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { semanticColors, typography } from "@kora/tokens";
import { bodyFontFamily, headingFontFamily, type FontWeightName } from "./native";

export type TextVariant =
  | "display" // hero number / largest heading (Bricolage)
  | "title" // screen + big section titles (Bricolage)
  | "heading" // card titles
  | "body" // default paragraph
  | "bodyStrong"
  | "label" // small, strong inline label
  | "sectionLabel" // warm sentence-case section header (the web .kiddo-section-label)
  | "caption" // muted small print
  | "eyebrow"; // tiny uppercase tracking label

type VariantSpec = {
  size: number;
  weight: FontWeightName;
  lineHeight: number;
  color: string;
  heading?: boolean;
  letterSpacing?: number;
  uppercase?: boolean;
};

const { size, lineHeight, letterSpacing } = typography;

const VARIANTS: Record<TextVariant, VariantSpec> = {
  display: { size: size["3xl"], weight: "bold", lineHeight: size["3xl"] * lineHeight.tight, color: semanticColors.text.primary, heading: true, letterSpacing: letterSpacing.heading },
  title: { size: size["2xl"], weight: "bold", lineHeight: size["2xl"] * lineHeight.tight, color: semanticColors.text.primary, heading: true, letterSpacing: letterSpacing.heading },
  heading: { size: size.lg, weight: "bold", lineHeight: size.lg * lineHeight.snug, color: semanticColors.text.primary, heading: true, letterSpacing: letterSpacing.heading },
  body: { size: size.base, weight: "regular", lineHeight: size.base * lineHeight.normal, color: semanticColors.text.primary },
  bodyStrong: { size: size.base, weight: "semibold", lineHeight: size.base * lineHeight.normal, color: semanticColors.text.primary },
  label: { size: size.sm, weight: "semibold", lineHeight: size.sm * lineHeight.snug, color: semanticColors.text.primary, letterSpacing: letterSpacing.label },
  sectionLabel: { size: size.base, weight: "bold", lineHeight: size.base * lineHeight.snug, color: semanticColors.text.primary, letterSpacing: letterSpacing.label },
  caption: { size: size.xs, weight: "regular", lineHeight: size.xs * lineHeight.normal, color: semanticColors.text.muted },
  eyebrow: { size: 11, weight: "bold", lineHeight: 11 * lineHeight.normal, color: semanticColors.text.muted, uppercase: true, letterSpacing: 0.8 },
};

export interface KTextProps extends TextProps {
  variant?: TextVariant;
  /** Override the variant's color (e.g. evergreen for a positive number). */
  color?: string;
  /** Tabular figures — REQUIRED for any money/number so columns align (web parity). */
  tabular?: boolean;
  center?: boolean;
  children?: React.ReactNode;
}

export function KText({ variant = "body", color, tabular, center, style, children, ...rest }: KTextProps) {
  const v = VARIANTS[variant];
  const computed: TextStyle = {
    fontSize: v.size,
    lineHeight: v.lineHeight,
    color: color ?? v.color,
    fontWeight: String(typography.weight[v.weight]) as TextStyle["fontWeight"],
    fontFamily: v.heading ? headingFontFamily() : bodyFontFamily(v.weight),
    ...(v.letterSpacing != null ? { letterSpacing: v.letterSpacing } : null),
    ...(v.uppercase ? { textTransform: "uppercase" } : null),
    ...(center ? { textAlign: "center" } : null),
    ...(tabular ? { fontVariant: ["tabular-nums"] } : null),
  };
  return (
    <RNText style={[computed, style]} {...rest}>
      {children}
    </RNText>
  );
}
