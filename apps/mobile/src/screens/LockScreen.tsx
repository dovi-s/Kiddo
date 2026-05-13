// LockScreen — the smart-lock interstitial. Per FACE_ID_SPEC.md.
//
// Shown when the user has Face ID enabled AND either:
//   1. App just cold-launched (always locks)
//   2. App resumed from >5 min in background (BACKGROUND_RELOCK_MS)
//
// Visual register matches the Kiddo splash screen — same logo, same
// tagline placement. Auto-fires the Face ID prompt on mount so the
// common case is one swipe-up-from-background + look at the phone +
// app opens. Manual "Unlock" button is the recovery path for users
// who dismissed the auto-prompt.
//
// Sign-out is intentionally surfaced (small print at bottom). Not a
// loud CTA — that would invite users out of the app — but visible
// enough that a user whose face enrollment changed isn't trapped.

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@kora/tokens";
import { authenticate } from "../biometric";

interface LockScreenProps {
  onUnlocked: () => void;
  onSignOut: () => void;
}

export function LockScreen({ onUnlocked, onSignOut }: LockScreenProps) {
  const [authing, setAuthing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const tryUnlock = useCallback(async () => {
    if (authing) return;
    setAuthing(true);
    setMessage(null);
    const result = await authenticate("Unlock Kiddo");
    if (result.success) {
      onUnlocked();
      // Don't clear authing — the screen is unmounting.
      return;
    }
    // Friendly per-reason copy. Cancellation gets no message (user
    // intentionally backed out, doesn't need an error). Other failures
    // surface the system message so the user knows what to do next.
    if (result.reason !== "cancelled") {
      setMessage(result.message || "Couldn't verify. Try again.");
    }
    setAuthing(false);
  }, [authing, onUnlocked]);

  // Auto-fire on mount. The common case is "user opens app → Face ID
  // prompt appears → look at phone → app opens" — a single tap.
  // The "Unlock" button below is the recovery for users who dismissed
  // the auto-prompt or whose face wasn't visible the first time.
  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text style={styles.logo}>Kiddo</Text>
        <Text style={styles.tagline}>Locked. Welcome back.</Text>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Unlock Kiddo with Face ID"
          disabled={authing}
          onPress={tryUnlock}
          style={[styles.primaryBtn, authing && styles.primaryBtnBusy]}
        >
          {authing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Unlock</Text>
          )}
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={onSignOut}
        style={styles.signOutBtn}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  logo: { fontSize: 44, fontWeight: "800", color: colors.evergreen },
  tagline: { fontSize: 15, color: "#6B7280", marginBottom: spacing.lg },
  message: {
    fontSize: 13,
    color: "#9A4A2C",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.evergreen,
    borderRadius: radius.control,
    paddingVertical: 14,
    paddingHorizontal: 48,
    minWidth: 200,
    alignItems: "center",
  },
  primaryBtnBusy: { opacity: 0.7 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  signOutBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  signOutText: {
    fontSize: 13,
    color: "#8B8B8B",
    textDecorationLine: "underline",
  },
});
