// LockScreen — the smart-lock interstitial. Per FACE_ID_SPEC.md.
//
// Shown when the user has Face ID enabled AND either cold-launched or resumed
// from >5 min in background. Auto-fires the Face ID prompt on mount; the Unlock
// button is the recovery path. Sign-out is small print (visible, not loud).
//
// Rebuilt onto the design-system kit (2026-06-02) — off the grey hardcodes onto
// brand tokens + KText/Button. Logic unchanged.

import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, semanticColors, spacing } from "@kora/tokens";
import { authenticate } from "../biometric";
import { KText, Button } from "../ui";

interface LockScreenProps {
  onUnlocked: () => void;
  onSignOut: () => void;
}

export function LockScreen({ onUnlocked, onSignOut }: LockScreenProps) {
  const insets = useSafeAreaInsets();
  const [authing, setAuthing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const tryUnlock = useCallback(async () => {
    if (authing) return;
    setAuthing(true);
    setMessage(null);
    const result = await authenticate("Unlock Kiddo");
    if (result.success) {
      onUnlocked();
      return; // screen is unmounting — don't clear authing
    }
    if (result.reason !== "cancelled") {
      setMessage(result.message || "Couldn't verify. Try again.");
    }
    setAuthing(false);
  }, [authing, onUnlocked]);

  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <KText variant="display" color={colors.evergreen}>Kiddo</KText>
        <KText variant="caption" style={styles.tagline}>Locked. Welcome back.</KText>
        {message ? (
          <KText variant="caption" color={semanticColors.danger.text} center style={styles.message}>
            {message}
          </KText>
        ) : null}
        <Button label="Unlock" onPress={tryUnlock} loading={authing} size="lg" fullWidth hapticIntent="medium" />
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={onSignOut} style={styles.signOutBtn}>
        <KText variant="caption" color={semanticColors.text.muted} style={styles.signOutText}>Sign out</KText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: semanticColors.surface.app,
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  tagline: { marginBottom: spacing.lg },
  message: { maxWidth: 280, marginBottom: spacing.sm },
  signOutBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  signOutText: { textDecorationLine: "underline" },
});
