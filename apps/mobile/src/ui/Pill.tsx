// Pill — a rounded chip for filters / small badges / status. Active vs inactive
// states match the web filter-pill + segmented-control idiom (evergreen-tinted
// when active, muted when not).

import React from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText } from "./Text";
import { haptic } from "./native";

export interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Non-interactive badge (no press). */
  badge?: boolean;
  style?: ViewStyle;
}

export function Pill({ label, active, onPress, badge, style }: PillProps) {
  const container: ViewStyle = {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: active ? "rgba(27,58,45,0.08)" : semanticColors.surface.card,
    borderColor: active ? colors.evergreen : semanticColors.surface.muted,
    alignSelf: "flex-start",
  };
  const fg = active ? colors.evergreen : semanticColors.text.muted;
  const content = (
    <View style={[container, style]}>
      <KText variant="label" color={fg}>{label}</KText>
    </View>
  );

  if (badge || !onPress) return content;
  return (
    <Pressable
      onPress={() => { haptic("selection"); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {content}
    </Pressable>
  );
}
