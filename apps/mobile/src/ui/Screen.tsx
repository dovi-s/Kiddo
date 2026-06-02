// Screen — the safe-area canvas every screen sits in. Cream background, honors the
// device insets (notch/home-indicator), optional scroll. The web's `kiddo-canvas`
// equivalent. Use react-native-safe-area-context (already installed), NOT the
// deprecated CSS env() safeArea token.

import React from "react";
import { View, ScrollView, StyleSheet, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { semanticColors, spacing } from "@kora/tokens";

export interface ScreenProps {
  children: React.ReactNode;
  /** Scrollable body (default true). Set false for fixed full-screen layouts. */
  scroll?: boolean;
  /** Horizontal padding (default md = 16). */
  padded?: boolean;
  /** Background override (default cream app surface). */
  background?: string;
  contentStyle?: ViewStyle;
  /** Apply bottom inset (set false when a bottom tab bar owns that space). */
  edgeBottom?: boolean;
}

export function Screen({ children, scroll = true, padded = true, background, edgeBottom = true, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: insets.top,
    paddingBottom: edgeBottom ? insets.bottom : 0,
    paddingHorizontal: padded ? spacing.md : 0,
  };
  const bg = { backgroundColor: background ?? semanticColors.surface.app };

  if (!scroll) {
    return <View style={[styles.fill, bg, pad, contentStyle]}>{children}</View>;
  }
  return (
    <View style={[styles.fill, bg]}>
      <ScrollView
        contentContainerStyle={[
          { paddingTop: insets.top, paddingBottom: (edgeBottom ? insets.bottom : 0) + spacing.xl, paddingHorizontal: padded ? spacing.md : 0 },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
