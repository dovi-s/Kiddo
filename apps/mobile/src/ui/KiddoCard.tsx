// KiddoCard — THE brand card. The web original is a 3-layer compound shadow
// (inset glass edge + near + depth) RN can't express in one shadow, so we render:
//   • the warm-ink RN shadow (shadows.card / .hero)
//   • a 1px top "glass edge" hairline (the single biggest premium-vs-flat detail)
//   • a soft warm border + 16px radius (20 for hero)
// Tappable variant adds a restrained press-spring (Apple HIG: felt, not seen),
// respecting reduced motion. The hero variant is the evergreen gradient card —
// for now a solid evergreen fill; swap to expo-linear-gradient once installed
// (TODO marked). Pixel-tune the shadow/edge on a real device during the loop.

import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  Platform,
  View,
  StyleSheet,
  AccessibilityInfo,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { colors, semanticColors, radius, spacing, shadows, glassEdge } from "@kora/tokens";
import { haptic } from "./native";

export interface KiddoCardProps {
  children: React.ReactNode;
  /** "default" = cream card; "hero" = evergreen feature card (light text on top). */
  variant?: "default" | "hero";
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
}

export function KiddoCard({ children, variant = "default", onPress, style, padded = true }: KiddoCardProps) {
  const hero = variant === "hero";
  const r = hero ? radius.hero : radius.card;

  // Native uses RN shadow props; web uses boxShadow (react-native-web deprecates
  // shadow*). Same visual weight, no console warning on either platform.
  const shadowStyle = (Platform.OS === "web"
    ? { boxShadow: hero ? "0 16px 30px rgba(14,37,24,0.18)" : "0 4px 12px rgba(26,23,16,0.10)" }
    : hero ? shadows.hero : shadows.card) as ViewStyle;

  const base: ViewStyle = {
    borderRadius: r,
    backgroundColor: hero ? colors.evergreen : semanticColors.surface.card,
    borderWidth: hero ? 0 : 1,
    borderColor: semanticColors.surface.muted,
    padding: padded ? spacing.md : 0,
    ...shadowStyle,
  };

  const inner = (
    <>
      {/* Glass edge — faint top highlight that catches light. Skipped on hero
          (its gradient owns the top). Clipped to the rounded top corners. */}
      {!hero && (
        <View style={[styles.glassEdge, { borderTopLeftRadius: r, borderTopRightRadius: r, pointerEvents: "none" }]} />
      )}
      {children}
    </>
  );

  if (!onPress) {
    return <View style={[base, style]}>{inner}</View>;
  }
  return <PressableCard baseStyle={[base, style]} onPress={onPress}>{inner}</PressableCard>;
}

function PressableCard({
  baseStyle,
  onPress,
  children,
}: {
  baseStyle: StyleProp<ViewStyle>;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  // Best-effort reduced-motion check (async; defaults to motion on).
  AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => {});

  const spring = (to: number) => {
    if (reduceMotion.current) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: Platform.OS !== "web", speed: 50, bounciness: 0 }).start();
  };

  return (
    <Pressable
      onPressIn={() => spring(0.985)}
      onPressOut={() => spring(1)}
      onPress={() => {
        haptic("selection");
        onPress();
      }}
      accessibilityRole="button"
    >
      <Animated.View style={[baseStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: glassEdge,
  },
});
