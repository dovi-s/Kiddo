// Native bridges for the design system: brand-font resolution + haptics.
// Both are written to degrade gracefully until the optional native deps are
// installed (expo-font / @expo-google-fonts, expo-haptics), so the UI kit
// compiles and runs today on RN core alone.

import { Platform, Vibration } from "react-native";
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

// ── Haptics ────────────────────────────────────────────────────────────
export type HapticIntent = keyof typeof HAPTIC_PATTERNS;

// Interim implementation via RN's Vibration API. Android honors the millisecond
// pattern arrays from the tokens; iOS ignores patterns, so we only fire a single
// buzz for MEANINGFUL events (success/gift/milestone/error/warning) and stay
// silent for light taps to avoid an annoying constant rumble. When expo-haptics
// is installed, replace this with the proper mapping:
//   selection → Haptics.selectionAsync()
//   success/gift/milestone → notificationAsync(...) ; light/medium/heavy → impactAsync(...)
// Never throws.
const IOS_MEANINGFUL: ReadonlySet<HapticIntent> = new Set<HapticIntent>([
  "success",
  "gift",
  "milestone",
  "error",
  "warning",
]);

export function haptic(intent: HapticIntent = "light"): void {
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
