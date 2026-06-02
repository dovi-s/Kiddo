// Button — the action primitive. Variants map to the brand intents (evergreen
// action, gold monetization, outline, ghost, destructive). Press-spring + haptic,
// 44px+ touch target, loading + disabled states. Mirrors the web Button idiom
// (active:scale-[0.97], haptic-on-press, intent colors).

import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  ActivityIndicator,
  View,
  StyleSheet,
  AccessibilityInfo,
  type ViewStyle,
} from "react-native";
import { semanticColors, radius, spacing, touchTarget } from "@kora/tokens";
import { KText } from "./Text";
import { haptic, type HapticIntent } from "./native";

type Variant = "primary" | "monetization" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  hapticIntent?: HapticIntent;
  style?: ViewStyle;
}

const HEIGHT: Record<Size, number> = { sm: 40, md: touchTarget.minimum, lg: touchTarget.primary };
const PADX: Record<Size, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl };

function fill(variant: Variant): { bg: string; fg: string; border?: string } {
  switch (variant) {
    case "primary": return { bg: semanticColors.buttonIntent.action, fg: semanticColors.text.inverse };
    case "monetization": return { bg: semanticColors.buttonIntent.monetization, fg: semanticColors.text.primary };
    case "destructive": return { bg: semanticColors.buttonIntent.destructive, fg: "#FFFFFF" };
    case "outline": return { bg: "transparent", fg: semanticColors.action.primary, border: semanticColors.surface.muted };
    case "ghost": return { bg: "transparent", fg: semanticColors.action.primary };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  fullWidth,
  hapticIntent = "selection",
  style,
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => {});
  const c = fill(variant);
  const inactive = disabled || loading;

  const spring = (to: number) => {
    if (reduceMotion.current) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };

  const container: ViewStyle = {
    height: HEIGHT[size],
    paddingHorizontal: PADX[size],
    borderRadius: radius.control,
    backgroundColor: c.bg,
    borderWidth: c.border ? 1.5 : 0,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    opacity: inactive ? 0.5 : 1,
    ...(fullWidth ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }),
  };

  return (
    <Pressable
      disabled={inactive}
      onPressIn={() => spring(0.97)}
      onPressOut={() => spring(1)}
      onPress={() => {
        haptic(hapticIntent);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={fullWidth ? styles.stretch : undefined}
    >
      <Animated.View style={[container, { transform: [{ scale }] }, style]}>
        {loading ? (
          <ActivityIndicator color={c.fg} />
        ) : (
          <KText variant="label" color={c.fg} style={size === "lg" ? styles.lgText : undefined}>
            {label}
          </KText>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: "stretch" },
  lgText: { fontSize: 16 },
});
