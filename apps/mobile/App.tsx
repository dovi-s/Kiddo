import React from "react";
import * as Notifications from "expo-notifications";
import { ActivityIndicator, AppState, AppStateStatus, Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { colors, radius, spacing } from "@kora/tokens";
import { queryClient } from "./src/queryClient";
import { elevate, loadBrandFonts } from "./src/ui";
import { appCopy } from "@kora/content";
import type { OnboardingAccountType, OnboardingInvestmentChoice, OnboardingStep, PublicGiftDestination } from "@kora/types";

import { GhostButton, PrimaryButton } from "./src/Buttons";
import { ChoiceCard } from "./src/ChoiceCard";
import { ScreenLead } from "./src/ScreenLead";
import { AuthScreen } from "./src/screens/AuthScreen";
import { GiftLinkEntryScreen } from "./src/screens/GiftLinkEntryScreen";
import { GifterFlowScreen } from "./src/screens/GifterFlowScreen";
import { LockScreen } from "./src/screens/LockScreen";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { PrivacyOverlay } from "./src/components/PrivacyOverlay";
import { ConnectivityBanner } from "./src/components/ConnectivityBanner";

import { apiGetFunds, apiGetPublicGiftDestination, apiGetUser, apiLogout, type ApiFund, type ApiUser } from "./src/api";
import {
  BACKGROUND_RELOCK_MS,
  clearLastActive,
  getMillisSinceLastActive,
  isBiometricEnabled,
  recordAppActiveAt,
} from "./src/biometric";

type OnboardStep = Extract<OnboardingStep, "welcome" | "who" | "investment">;

type Screen =
  | { name: "splash" }
  | { name: "boot_error"; message: string }
  | { name: "gifter_resolving"; identifier: string }
  | { name: "onboard"; step: OnboardStep; accountType: OnboardingAccountType; investment: OnboardingInvestmentChoice; ticker: string }
  | { name: "auth" }
  // The authenticated app shell. Fund detail / add fund / future detail
  // screens are now pushed inside RootNavigator's native stack, not separate
  // top-level screens. `initialFund` deep-links straight to a fund detail.
  | { name: "app"; user: ApiUser; initialFund?: ApiFund }
  | { name: "gifter_entry" }
  | { name: "gifter_flow"; identifier: string; destination: PublicGiftDestination }
  // Smart-lock interstitial. Carries the screen to restore once
  // biometric unlock completes — preserves the user's place in the
  // app across background-then-lock cycles, including deep-linked
  // fund details. Per FACE_ID_SPEC.md.
  | { name: "locked"; targetScreen: Screen };

function buildDefaultOnboardScreen(): Screen {
  return {
    name: "onboard",
    step: "welcome",
    accountType: "child",
    investment: "sp500",
    ticker: "DIS",
  };
}

// Lockable screens — the authenticated parent surface that shows
// balances and can move money. Auth / onboard / gifter screens are
// public or pre-login and don't need the biometric gate. Splash /
// boot_error / locked itself are also excluded (locking a locked
// screen would loop).
function isLockableScreen(s: Screen): boolean {
  return s.name === "app";
}

const STATIC_ROUTE_PREFIXES = new Set([
  "login",
  "get-started",
  "onboard",
  "activate",
  "dashboard",
  "profile",
  "activity",
  "events",
  "event",
  "send",
  "claim",
  "gift",
  "settings",
  "faq",
  "how-it-works",
  "pricing",
  "blog",
  "stories",
  "compare",
  "security",
  "age-18",
  "about",
  "personal-funds",
  "contact",
  "legal",
  "admin",
  "memory",
  "gifter",
  "kid",
  "transition",
  "updates",
]);

function resolveGiftIdentifierFromUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const normalizedSegments = segments[0] === "--" ? segments.slice(1) : segments;

    if (url.protocol === "kiddo:" || url.protocol === "kora:" || url.protocol === "exp:") {
      if (!normalizedSegments.length) return null;
      if (normalizedSegments[0] === "gift") {
        if (normalizedSegments[1] === "success") return null;
        return normalizedSegments[1] || null;
      }
      if (STATIC_ROUTE_PREFIXES.has(normalizedSegments[0])) return null;
      return normalizedSegments[normalizedSegments.length - 1] || null;
    }

    if (!normalizedSegments.length) return null;
    if (normalizedSegments[0] === "gift") {
      if (normalizedSegments[1] === "success") return null;
      return normalizedSegments[1] || null;
    }

    if (STATIC_ROUTE_PREFIXES.has(normalizedSegments[0])) return null;
    return normalizedSegments[normalizedSegments.length - 1] || null;
  } catch {
    return null;
  }
}

function normalizeDeepLink(rawUrl: string | null | undefined) {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) {
    return `https://kiddofund.com${trimmed}`;
  }

  return trimmed;
}

function extractDeepLinkFromNotification(response: Notifications.NotificationResponse | null | undefined) {
  const data = response?.notification?.request?.content?.data;
  const deepLink = typeof data?.deepLink === "string" ? data.deepLink : null;
  return normalizeDeepLink(deepLink);
}

function resolveRouteFromUrl(rawUrl: string | null | undefined) {
  const normalized = normalizeDeepLink(rawUrl);
  if (!normalized) {
    return { type: "none" as const };
  }

  const giftIdentifier = resolveGiftIdentifierFromUrl(normalized);
  if (giftIdentifier) {
    return { type: "gift" as const, identifier: giftIdentifier };
  }

  try {
    const url = new URL(normalized);
    const segments = url.pathname.split("/").filter(Boolean);
    const normalizedSegments = segments[0] === "--" ? segments.slice(1) : segments;
    const [first = "", second = ""] = normalizedSegments;

    switch (first) {
      case "":
      case "dashboard":
      case "activity":
      case "events":
      case "event":
      case "settings":
      case "profile":
      case "updates":
      case "activate":
        return { type: "dashboard" as const };
      case "memory":
      case "kid":
      case "fund":
      case "funds":
        return second ? { type: "fund" as const, identifier: second } : { type: "dashboard" as const };
      case "transition":
      case "claim":
        return { type: "dashboard" as const, reason: first };
      default:
        return { type: "dashboard" as const };
    }
  } catch {
    return { type: "none" as const };
  }
}
function AppContent() {
  const [screen, setScreen] = React.useState<Screen>({ name: "splash" });

  // Ref tracks the latest `screen` for the AppState listener — the
  // listener is subscribed once on mount but needs the current value
  // every time it fires. State alone would close over the stale
  // initial value. Updated on every render below.
  const screenRef = React.useRef<Screen>(screen);
  screenRef.current = screen;

  // Routes any "going to authenticated content" intent through the
  // smart-lock gate. If the user has Face ID enabled, the target
  // screen is wrapped in a `locked` interstitial; otherwise it sets
  // directly. Used by boot, openDeepLink, openFundDetailFromIdentifier,
  // and notification-tap handlers. Per FACE_ID_SPEC.md.
  const gotoAuthenticatedScreen = React.useCallback(async (target: Screen) => {
    if (!isLockableScreen(target)) {
      setScreen(target);
      return;
    }
    try {
      const locked = await isBiometricEnabled();
      if (locked) {
        setScreen({ name: "locked", targetScreen: target });
        return;
      }
    } catch {
      // SecureStore failure shouldn't block app boot; fall through to
      // unlocked screen.
    }
    setScreen(target);
  }, []);

  const openGiftDestination = React.useCallback(async (identifier: string) => {
    setScreen({ name: "gifter_resolving", identifier });
    try {
      const destination = await apiGetPublicGiftDestination(identifier);
      setScreen({ name: "gifter_flow", identifier, destination });
    } catch {
      setScreen({ name: "gifter_entry" });
    }
  }, []);

  const openFundDetailFromIdentifier = React.useCallback(
    async (user: ApiUser, identifier: string) => {
      try {
        const funds = await apiGetFunds();
        const matchedFund = funds.find((fund) => fund.id === identifier || fund.slug === identifier);
        if (matchedFund) {
          await gotoAuthenticatedScreen({ name: "app", user, initialFund: matchedFund });
          return true;
        }
      } catch {
        // Fall back to dashboard when a deep-linked fund cannot be resolved.
      }

      await gotoAuthenticatedScreen({ name: "app", user });
      return false;
    },
    [gotoAuthenticatedScreen],
  );

  const openDeepLink = React.useCallback(
    async (rawUrl: string | null | undefined, userOverride?: ApiUser | null) => {
      const route = resolveRouteFromUrl(rawUrl);
      if (route.type === "none") return false;

      if (route.type === "gift") {
        await openGiftDestination(route.identifier);
        return true;
      }

      const user = userOverride ?? (await apiGetUser());
      if (!user) {
        setScreen({ name: "auth" });
        return true;
      }

      if (route.type === "fund") {
        await openFundDetailFromIdentifier(user, route.identifier);
        return true;
      }

      await gotoAuthenticatedScreen({ name: "app", user });
      return true;
    },
    [gotoAuthenticatedScreen, openFundDetailFromIdentifier, openGiftDestination],
  );

  React.useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void (async () => {
        try {
          const deepLink = extractDeepLinkFromNotification(response);
          if (deepLink) {
            const handled = await openDeepLink(deepLink);
            if (handled) return;
          }

          const user = await apiGetUser();
          if (user) {
            await gotoAuthenticatedScreen({ name: "app", user });
            return;
          }
          setScreen({ name: "auth" });
        } catch {
          setScreen(buildDefaultOnboardScreen());
        }
      })();
    });

    return () => subscription.remove();
  }, [gotoAuthenticatedScreen, openDeepLink]);

  React.useEffect(() => {
    let active = true;

    async function boot() {
      let notificationDeepLink: string | null = null;
      if (Platform.OS !== "web" && Notifications.getLastNotificationResponseAsync) {
        try {
          const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
          notificationDeepLink = extractDeepLinkFromNotification(lastNotificationResponse);
        } catch {
          // Notifications not available on this platform (expected on web simulators)
        }
      }

      if (notificationDeepLink && Platform.OS !== "web") {
        const handled = await openDeepLink(notificationDeepLink);
        if (handled || !active) return;
      }

      const initialUrl = await Linking.getInitialURL();
      const handledInitialUrl = await openDeepLink(initialUrl);
      if (handledInitialUrl || !active) {
        return;
      }

      try {
        const user = await apiGetUser();
        if (!active) return;
        if (user) {
          // Cold launches ALWAYS lock when the toggle is on — per
          // FACE_ID_SPEC.md, process restart invalidates any prior
          // "last active" timestamp. The dashboard target is wrapped
          // in the locked interstitial inside gotoAuthenticatedScreen
          // when biometric is enabled.
          await clearLastActive().catch(() => undefined);
          await gotoAuthenticatedScreen({ name: "app", user });
        } else {
          setScreen(buildDefaultOnboardScreen());
        }
      } catch (err: any) {
        if (!active) return;
        // Any network failure falls through to auth/onboarding so the app is never
        // stuck on a dead-end error screen. The user can sign in once connectivity returns.
        setScreen(buildDefaultOnboardScreen());
      }
    }

    const t = setTimeout(
      () =>
        void boot().catch(() => {
          // Last-resort guard: any unexpected throw in boot must never strand
          // the user on the splash screen. Fall through to onboarding.
          if (active) setScreen(buildDefaultOnboardScreen());
        }),
      600,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [gotoAuthenticatedScreen, openDeepLink]);

  // AppState listener — drives the background re-lock. On background
  // transition we stamp `now` into SecureStore. On active transition
  // we check how long we were gone; if longer than the spec's 5-min
  // window AND biometric is enabled AND the current screen is one
  // that shows authenticated content, we push the current screen
  // into `targetScreen` and replace with the locked interstitial.
  // Per FACE_ID_SPEC.md re-lock policy.
  React.useEffect(() => {
    let prevState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        // Always stamp — cheap. Decision happens on the active edge.
        void recordAppActiveAt();
      } else if (next === "active" && prevState !== "active") {
        void (async () => {
          // Already locked → nothing to do; the existing locked
          // screen handles re-prompt itself.
          if (screenRef.current.name === "locked") return;
          if (!isLockableScreen(screenRef.current)) return;
          const enabled = await isBiometricEnabled();
          if (!enabled) return;
          const millis = await getMillisSinceLastActive();
          if (millis < BACKGROUND_RELOCK_MS) return;
          setScreen({ name: "locked", targetScreen: screenRef.current });
        })();
      }
      prevState = next;
    });
    return () => subscription.remove();
  }, []);

  React.useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void openDeepLink(url);
    });

    return () => subscription.remove();
  }, [openDeepLink]);

  if (screen.name === "splash") {
    return (
      <View style={splashStyles.screen}>
        <StatusBar barStyle="dark-content" />
        <Text style={splashStyles.logo}>Kiddo</Text>
        <Text style={splashStyles.tagline}>Gifts that last.</Text>
      </View>
    );
  }

  if (screen.name === "boot_error") {
    return (
      <View style={bootErrorStyles.screen}>
        <StatusBar barStyle="dark-content" />
        <Text style={bootErrorStyles.icon}>📡</Text>
        <Text style={bootErrorStyles.title}>No connection right now</Text>
        <Text style={bootErrorStyles.body}>{screen.message || "The fund is safe. Try again when you are back online."}</Text>
        <Pressable onPress={() => setScreen({ name: "splash" })} style={bootErrorStyles.btn}>
          <Text style={bootErrorStyles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (screen.name === "gifter_resolving") {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.card}>
          <View style={styles.stack}>
            <ScreenLead
              eyebrow="Opening gift"
              title="Taking you straight to the gift page."
              description={`Loading ${screen.identifier} from the link you opened.`}
            />
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.evergreen} />
              <Text style={styles.loadingText}>Opening the gift flow in the app...</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (screen.name === "locked") {
    const locked = screen;
    return (
      <LockScreen
        onUnlocked={() => {
          // Stamp now() so the AppState listener doesn't immediately
          // re-lock on the next foreground edge (e.g. iOS firing
          // active → inactive → active during the prompt teardown).
          void recordAppActiveAt();
          setScreen(locked.targetScreen);
        }}
        onSignOut={() => {
          void apiLogout().catch(() => undefined);
          setScreen({ name: "auth" });
        }}
      />
    );
  }

  if (screen.name === "auth") {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <AuthScreen onAuth={(user) => setScreen({ name: "app", user })} />
      </>
    );
  }

  if (screen.name === "app") {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <RootNavigator
          user={screen.user}
          initialFund={screen.initialFund}
          onLogout={() => setScreen(buildDefaultOnboardScreen())}
        />
      </>
    );
  }

  if (screen.name === "gifter_entry") {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <GiftLinkEntryScreen onBack={() => setScreen(buildDefaultOnboardScreen())} onOpen={openGiftDestination} />
      </>
    );
  }

  if (screen.name === "gifter_flow") {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <GifterFlowScreen
          identifier={screen.identifier}
          destination={screen.destination}
          onBack={() => setScreen({ name: "gifter_entry" })}
          onStartFund={() => setScreen(buildDefaultOnboardScreen())}
        />
      </>
    );
  }

  const ob = screen;
  if (ob.name === "onboard") {
    const update = (patch: Partial<typeof ob>) => setScreen({ ...ob, ...patch } as Screen);

    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.card}>
          {ob.step === "welcome" && (
            <View style={styles.stack}>
              <ScreenLead
                eyebrow="Kiddo"
                title="Cash gifts disappear. Kiddo gifts last."
                description="Set up a fund in 2 minutes. Anyone can gift. No account needed for gifters."
              />
              <View style={styles.miniGrid}>
                <MiniStat label="2 min" caption="to set up" />
                <MiniStat label="1 link" caption="to share" />
                <MiniStat label="No app" caption="for gifters" />
              </View>
              <PrimaryButton label="Start a fund" onPress={() => update({ step: "who" })} />
              <GhostButton label="I already have an account" onPress={() => setScreen({ name: "auth" })} />
              <GhostButton label="I have a gift link" onPress={() => setScreen({ name: "gifter_entry" })} />
            </View>
          )}

          {ob.step === "who" && (
            <View style={styles.stack}>
              <ScreenLead
                eyebrow="Step 1"
                title="Who is this fund for?"
                description="Start with one child. You can add more later."
              />
              <ChoiceCard
                title="For my child"
                description="A fund for birthdays, baby showers, and every milestone. She gets full control at 18. That is the whole point."
                active={ob.accountType === "child"}
                onPress={() => update({ accountType: "child", step: "investment" })}
              />
              <GhostButton label="Back" onPress={() => update({ step: "welcome" })} />
            </View>
          )}

          {ob.step === "investment" && (
            <View style={styles.stack}>
              <ScreenLead
                eyebrow="Step 2"
                title="How gifts get invested"
                description="We'll start with our Growth Mix. You can change this anytime in Settings."
              />
              <ChoiceCard
                title="Growth Mix"
                description="Diversified stocks and bonds, managed automatically. Best for most families building long-term."
                active={ob.investment === "sp500"}
                onPress={() => update({ investment: "sp500" })}
              />
              <View style={styles.actions}>
                <GhostButton label="Back" onPress={() => update({ step: "who" })} />
                <PrimaryButton label="Create account" onPress={() => setScreen({ name: "auth" })} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { error: String(error) };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={bootErrorStyles.screen}>
          <StatusBar barStyle="dark-content" />
          <Text style={bootErrorStyles.icon}>⚠️</Text>
          <Text style={bootErrorStyles.title}>Something went wrong</Text>
          <Text style={bootErrorStyles.body}>{this.state.error}</Text>
          <Pressable onPress={() => this.setState({ error: null })} style={bootErrorStyles.btn}>
            <Text style={bootErrorStyles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Load the brand fonts (DM Sans + Bricolage Grotesque) and force one re-render
  // once they register, so KText swaps from the system fallback to the brand
  // typeface. Without this the whole app renders generic and looks unlike web.
  const [, setFontTick] = React.useState(0);
  React.useEffect(() => {
    loadBrandFonts()
      .then(() => setFontTick((t) => t + 1))
      .catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <SafeAreaProvider>
            <AppContent />
            {/* PrivacyOverlay sits OUTSIDE AppContent on purpose. It needs
            to be the last child of SafeAreaProvider so it renders on
            top of every screen via z-index + absolute positioning. Its
            AppState listener is independent of the rest of the app's
            navigation state, which is correct — it should fire on
            inactive/background regardless of which screen the user is
            on. Per FACE_ID_SPEC.md app-switcher privacy item. */}
            {/* Slides in whenever the API is unreachable; auto-hides on the
                next successful request. Top-level so it overlays every screen. */}
            <ConnectivityBanner />
            <PrivacyOverlay />
          </SafeAreaProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function MiniStat({ label, caption }: { label: string; caption: string }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniCaption}>{caption}</Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", gap: 8 },
  logo: { fontSize: 40, fontWeight: "800", color: colors.evergreen },
  tagline: { fontSize: 16, color: "#6B7280" },
});

const bootErrorStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  icon: { fontSize: 40 },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  body: { fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 22 },
  btn: { marginTop: spacing.sm, backgroundColor: colors.evergreen, borderRadius: radius.control, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, minHeight: "100%", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.container,
    padding: spacing.lg,
    gap: spacing.lg,
    ...elevate({ y: 10, blur: 24, opacity: 0.08, color: colors.ink }),
  },
  stack: { gap: spacing.md },
  miniGrid: { flexDirection: "row", gap: spacing.sm },
  miniCard: { flex: 1, backgroundColor: "#F8F3EA", borderRadius: radius.inner, padding: spacing.sm, gap: spacing.xs },
  miniLabel: { color: colors.ink, fontWeight: "700" },
  miniCaption: { color: "#5E675F", fontSize: 12 },
  actions: { gap: spacing.sm },
  comingSoonCard: {
    borderRadius: radius.card,
    backgroundColor: "#F9F7F3",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: spacing.md,
    gap: 6,
    opacity: 0.7,
  },
  comingSoonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  comingSoonTitle: { fontSize: 16, fontWeight: "600", color: "#6B7280" },
  comingSoonBadge: { backgroundColor: "#F3F4F6", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  comingSoonBadgeText: { fontSize: 11, fontWeight: "600", color: "#9CA3AF" },
  comingSoonBody: { fontSize: 13, color: "#9CA3AF" },
  loadingCard: {
    borderRadius: radius.card,
    backgroundColor: "#F6EFE3",
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  loadingText: { color: "#5E675F", fontSize: 14, textAlign: "center" },
  stockGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stockCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: "#E6DDD0",
    padding: spacing.md,
    gap: spacing.xs,
  },
  stockCardActive: { borderColor: colors.gold, backgroundColor: "#FFF8EE" },
  stockTitle: { color: colors.ink, fontWeight: "700" },
  stockTicker: { color: "#5E675F" },
});
