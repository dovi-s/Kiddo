// Brand-font loader. The web app renders in DM Sans (body) + Bricolage Grotesque
// (headings); without these the app falls back to the system font and looks
// generic / "different from web" — on a physical device most of all.
//
// The TTFs are BUNDLED in apps/mobile/assets/fonts and loaded via expo-font.
// Metro bundles .ttf as an asset and expo-font registers it under the exact
// family names the design tokens reference (DMSans_400Regular …
// BricolageGrotesque_700Bold). Once loaded, markFontsLoaded() flips KText from
// the system fallback to the brand faces.

import * as Font from "expo-font";
import { markFontsLoaded } from "./native";

let started = false;
// Surfaced in the Settings build marker so we can SEE on a real device whether
// the brand fonts actually registered (the #1 "looks off vs web" cause). null
// while pending, "" on success, an error string on failure.
export let fontLoadError: string | null = null;

/** Idempotent. Resolves after the brand fonts register (or records the error). */
export async function loadBrandFonts(): Promise<void> {
  if (started) return;
  started = true;
  try {
    await Font.loadAsync({
      DMSans_400Regular: require("../../assets/fonts/DMSans_400Regular.ttf"),
      DMSans_500Medium: require("../../assets/fonts/DMSans_500Medium.ttf"),
      DMSans_600SemiBold: require("../../assets/fonts/DMSans_600SemiBold.ttf"),
      DMSans_700Bold: require("../../assets/fonts/DMSans_700Bold.ttf"),
      BricolageGrotesque_700Bold: require("../../assets/fonts/BricolageGrotesque_700Bold.ttf"),
    });
    fontLoadError = "";
    markFontsLoaded();
  } catch (e: any) {
    // Record the reason (shown in the build marker) instead of swallowing it.
    fontLoadError = String(e?.message || e).slice(0, 90) || "load failed";
  }
}
