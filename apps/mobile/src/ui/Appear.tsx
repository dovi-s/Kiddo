// Appear — a one-shot entrance animation (fade + gentle rise) for the brand's
// "alive" feel, matching the web's framer-motion staggered card reveals. Wrap a
// section and pass an incrementing `delay` to stagger a group on mount. Respects
// reduced motion (renders instantly, no animation). Uses the brand outExpo curve.

import React, { useEffect, useRef } from "react";
import { Animated, Easing, AccessibilityInfo, Platform, type ViewStyle } from "react-native";

export function Appear({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return;
        if (reduced) {
          v.setValue(1);
          return;
        }
        Animated.timing(v, {
          toValue: 1,
          duration: 420,
          delay,
          easing: Easing.bezier(0.16, 1, 0.3, 1), // brand outExpo
          useNativeDriver: Platform.OS !== "web",
        }).start();
      })
      .catch(() => v.setValue(1));
    return () => {
      cancelled = true;
    };
  }, [delay, v]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
