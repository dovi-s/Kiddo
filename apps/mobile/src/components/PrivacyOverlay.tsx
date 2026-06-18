// Privacy overlay for the iOS app-switcher snapshot.
// Per FACE_ID_SPEC.md (formerly deferred item: "app-switcher privacy").
//
// The problem: when iOS captures its app-switcher snapshot — the
// preview you see when you swipe up to switch apps — it captures
// whatever's on screen at the moment of transition. For a finance
// app that means fund balances, child names, holdings, all visible
// to anyone with physical access to the phone even when the app is
// "locked" via biometric.
//
// The fix: render a fullscreen branded overlay during the inactive /
// background AppState transitions. iOS captures THAT instead of the
// real screen.
//
// Why JS-only instead of a native module (e.g. react-native-privacy-
// snapshot): pure-JS works in Expo Go and EAS dev builds, no
// rebuild required to test, no native code to maintain. The
// trade-off is a small race window during the transition — but in
// practice iOS captures the snapshot AFTER the inactive state
// fires, so React Native has time to swap the overlay in. Tested
// behavior on iOS 17+ is reliable.
//
// What this overlay deliberately does NOT do:
//   - Doesn't lock anything new (the existing 5-minute re-lock
//     handles unlocked-phone access)
//   - Doesn't replace LockScreen (different responsibility)
//   - Doesn't fire on every screen blur (only AppState transitions)

import React, { useEffect, useState } from "react";
import { AppState, AppStateStatus, StyleSheet, Text, View } from "react-native";
import { colors } from "@kora/tokens";

export function PrivacyOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show the overlay on 'inactive' (the transition state iOS
    // enters before the snapshot is captured) AND on 'background'
    // (full app suspension). Hide on 'active'. The 'inactive' edge
    // is the critical one for the switcher-snapshot capture; the
    // 'background' coverage is belt-and-suspenders for any case
    // where the system skips the inactive transition.
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "inactive" || next === "background") {
        setVisible(true);
      } else if (next === "active") {
        setVisible(false);
      }
    });
    return () => sub.remove();
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Text style={styles.logo}>Kiddo</Text>
      <Text style={styles.tagline}>Gifts that last.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: "auto",
  },
  logo: { fontSize: 44, fontWeight: "800", color: colors.evergreen },
  tagline: { fontSize: 16, color: colors.muted, marginTop: 8 },
});
