// Skeleton — a soft shimmer placeholder that previews the post-load SHAPE (never a
// blank spinner). Slow opacity breath (1.6s), respects reduced motion (static when
// reduced). Mirrors the web KiddoSkeleton register.

import React, { useEffect, useRef } from "react";
import { Animated, AccessibilityInfo, Platform, type ViewStyle, type DimensionValue } from "react-native";
import { semanticColors, radius } from "@kora/tokens";

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 14, rounded = radius.control, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled || reduced) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 0.85, duration: 800, useNativeDriver: Platform.OS !== "web" }),
            Animated.timing(pulse, { toValue: 0.55, duration: 800, useNativeDriver: Platform.OS !== "web" }),
          ]),
        );
        loop.start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: rounded,
          backgroundColor: semanticColors.surface.muted,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}
