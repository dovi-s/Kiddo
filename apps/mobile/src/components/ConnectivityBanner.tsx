// ConnectivityBanner — a top overlay that slides in when the app can't reach the
// server (network error / timeout), so a connectivity problem is never a silent
// mystery (the bug that made the app look "stuck on the splash"). It auto-hides
// the moment any request succeeds. Dev builds show an extra hint about the
// backend, since that is the usual local cause.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@kora/tokens";
import { KText } from "../ui";
import { apiHealthPing, setNetworkStatusListener } from "../api";

export function ConnectivityBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const slide = useRef(new Animated.Value(-160)).current;
  const fails = useRef(0);

  useEffect(() => {
    // Require TWO consecutive failures before showing (a single slow/timed-out
    // request shouldn't flash the banner), and hide immediately on any success.
    setNetworkStatusListener((online) => {
      if (online) {
        fails.current = 0;
        setOffline(false);
      } else {
        fails.current += 1;
        if (fails.current >= 2) setOffline(true);
      }
    });
    return () => setNetworkStatusListener(null);
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: offline ? 0 : -160,
      duration: 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [offline, slide]);

  // Self-heal: while shown, quietly re-probe every 5s. A successful ping flips
  // the listener back to online and hides the banner, so a transient failure
  // cluster (e.g. a couple of slow requests timing out) never leaves it stuck.
  useEffect(() => {
    if (!offline) return;
    const id = setInterval(() => {
      void apiHealthPing();
    }, 5000);
    return () => clearInterval(id);
  }, [offline]);

  const retry = async () => {
    setChecking(true);
    const ok = await apiHealthPing();
    setChecking(false);
    if (ok) setOffline(false);
  };

  return (
    <Animated.View
      pointerEvents={offline ? "auto" : "none"}
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm, transform: [{ translateY: slide }] }]}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <KText variant="caption" color="#F8F5F0">
            Can't reach Kiddo. Check your connection.
          </KText>
          {__DEV__ ? (
            <KText variant="caption" color="rgba(248,245,240,0.6)" style={{ marginTop: 2 }}>
              Dev: is the API running? (npm run dev)
            </KText>
          ) : null}
        </View>
        <Pressable onPress={retry} hitSlop={10} style={styles.retry}>
          <KText variant="caption" color="#EDC164">
            {checking ? "Checking..." : "Retry"}
          </KText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: colors.ink,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: radius.inner,
    borderBottomRightRadius: radius.inner,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  retry: { paddingVertical: 4, paddingHorizontal: 8 },
});
