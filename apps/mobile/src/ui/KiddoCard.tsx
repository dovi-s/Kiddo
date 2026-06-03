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
  const isWeb = Platform.OS === "web";

  // Match the web .kiddo-card box-shadow EXACTLY on web (incl. the inset glass
  // edge); use the RN shadow objects on native (which deprecate boxShadow).
  const shadowStyle = (isWeb
    ? {
        boxShadow: hero
          ? "0 2px 8px rgba(26,23,16,0.10), 0 18px 38px rgba(27,58,45,0.20)"
          : "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(26,23,16,0.06), 0 4px 16px rgba(26,23,16,0.06)",
      }
    : hero
      ? shadows.hero
      : shadows.card) as ViewStyle;

  // The web hero is a 145deg evergreen→deep gradient (index.css:1355), not a flat
  // block. On web we reproduce it via backgroundImage; on native we fall back to
  // the deep evergreen solid (expo-linear-gradient is the device upgrade path).
  const heroBg: ViewStyle = hero
    ? isWeb
      ? ({ backgroundImage: `linear-gradient(145deg, ${colors.evergreen} 0%, #0E2618 100%)` } as unknown as ViewStyle)
      : { backgroundColor: colors.evergreen }
    : { backgroundColor: semanticColors.surface.card };

  const base: ViewStyle = {
    borderRadius: r,
    borderWidth: hero ? 0 : 1,
    borderColor: semanticColors.surface.muted,
    padding: padded ? spacing.md : 0,
    // Clip the native gradient bands to the rounded corners.
    ...(hero && !isWeb ? { overflow: "hidden" as const } : null),
    ...heroBg,
    ...shadowStyle,
  };

  const inner = (
    <>
      {/* Native hero gradient — react-native has no CSS gradient and we don't
          take the expo-linear-gradient dep, so approximate the web's 145deg
          evergreen→deep with stacked bands behind the content. Web uses the real
          backgroundImage gradient on `base`. */}
      {hero && !isWeb ? <NativeHeroGradient /> : null}
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

// Diagonal-ish evergreen→deep gradient faked with stacked bands (native only;
// web uses a real CSS backgroundImage gradient). Absolute-fills the hero card
// behind its content; the card clips it via overflow:hidden.
function lerpHex(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function NativeHeroGradient() {
  const BANDS = 14;
  const bands = [];
  for (let i = 0; i < BANDS; i++) {
    bands.push(
      <View key={i} style={{ flex: 1, backgroundColor: lerpHex(colors.evergreen, "#0E2618", i / (BANDS - 1)) }} />,
    );
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "column" }}
    >
      {bands}
    </View>
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
