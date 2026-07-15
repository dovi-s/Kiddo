// Native bridges for the design system: brand-font resolution + haptics.
// Both are written to degrade gracefully until the optional native deps are
// installed (expo-font / @expo-google-fonts, expo-haptics), so the UI kit
// compiles and runs today on RN core alone.

import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import { typography, haptics as HAPTIC_PATTERNS } from "@kora/tokens";

// ── Fonts ──────────────────────────────────────────────────────────────
// Brand fonts (DM Sans + Bricolage Grotesque) are loaded at runtime in App.tsx
// via expo-font once that dep is added. Until markFontsLoaded() is called we
// return `undefined` for fontFamily so RN renders the clean SYSTEM font rather
// than a broken missing-family fallback. After Font.loadAsync resolves, call
// markFontsLoaded() and every <KText> picks up the brand face automatically.
let fontsLoaded = false;
export function markFontsLoaded(): void {
  fontsLoaded = true;
}
export function areFontsLoaded(): boolean {
  return fontsLoaded;
}

export type FontWeightName = "regular" | "medium" | "semibold" | "bold";

const BODY_FAMILY: Record<FontWeightName, string> = {
  regular: typography.family.body,
  medium: typography.family.bodyMedium,
  semibold: typography.family.bodySemiBold,
  bold: typography.family.bodyBold,
};

export function bodyFontFamily(weight: FontWeightName): string | undefined {
  return fontsLoaded ? BODY_FAMILY[weight] : undefined;
}
export function headingFontFamily(): string | undefined {
  return fontsLoaded ? typography.family.heading : undefined;
}

// ── Elevation ────────────────────────────────────────────────────────────
// Platform-correct shadow. react-native-web deprecates the shadow* style props
// (it warns once per offending StyleSheet) in favor of CSS boxShadow; native
// ignores boxShadow and needs the RN shadow* props + Android elevation. Spread
// this into a StyleSheet entry instead of hand-rolling shadows — one source of
// truth, zero web console noise. Mirrors KiddoCard's own platform split.
//
//   card: { ...elevate({ y: 14, blur: 24, opacity: 0.12 }) }
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function elevate(opts: {
  y?: number;
  blur?: number;
  opacity?: number;
  color?: string;
}): object {
  const { y = 4, blur = 12, opacity = 0.1, color = "#1A1710" } = opts;
  if (Platform.OS === "web") {
    return { boxShadow: `0px ${y}px ${blur}px ${hexToRgba(color, opacity)}` };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: y },
    shadowRadius: blur,
    shadowOpacity: opacity,
    elevation: Math.max(2, Math.round(blur / 2)),
  };
}

// ── Haptics ────────────────────────────────────────────────────────────
export type HapticIntent = keyof typeof HAPTIC_PATTERNS;

// iOS ignores Vibration pattern arrays, so the fallback only fires a single buzz
// for MEANINGFUL events and stays silent for light taps to avoid a constant
// rumble. (Only used when expo-haptics is unavailable, e.g. web preview.)
const IOS_MEANINGFUL: ReadonlySet<HapticIntent> = new Set<HapticIntent>([
  "success",
  "gift",
  "milestone",
  "error",
  "warning",
]);

function vibrateFallback(intent: HapticIntent): void {
  try {
    const pattern = [...HAPTIC_PATTERNS[intent]];
    if (Platform.OS === "android") {
      Vibration.vibrate(pattern);
    } else if (Platform.OS === "ios" && IOS_MEANINGFUL.has(intent)) {
      Vibration.vibrate();
    }
  } catch {
    // Vibration unavailable (web preview, permissions) — silently ignore.
  }
}

// Primary path: expo-haptics, mapped by INTENT (not the raw ms arrays) onto the
// platform's native Taptic / vibration engine — the real "premium feel" per
// CRAFT_BAR.md §3. gift + milestone are short sequences meant to be fired in
// sync with the visual celebration beat at the call site. The token ms-arrays
// stay as the cross-platform fallback (web). Fire-and-forget; never throws.
export function haptic(intent: HapticIntent = "light"): void {
  if (Platform.OS === "web") {
    vibrateFallback(intent);
    return;
  }
  const run = async () => {
    switch (intent) {
      case "selection":
        return Haptics.selectionAsync();
      case "light":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case "medium":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case "heavy":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case "success":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case "warning":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case "error":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case "gift": {
        // "A gift landed" — soft, pause, firmer. (token gift [15,80,25])
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }, 90);
        return;
      }
      case "milestone": {
        // Crescendo for crossing a milestone. (token milestone [80,60,120])
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }, 70);
        setTimeout(() => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }, 200);
        return;
      }
      default:
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  run().catch(() => vibrateFallback(intent));
}
