// Brand-font loader. The web app renders in DM Sans (body) + Bricolage Grotesque
// (headings); without these the app falls back to the system font and looks
// generic / "different from web" — on a physical device most of all.
//
// The TTFs are BUNDLED in apps/mobile/assets/fonts and loaded via expo-font
// (already a dependency). This works on a real device AND on web with no extra
// install — Metro bundles .ttf as an asset and expo-font registers it under the
// exact @expo-google-fonts family names the design tokens reference
// (DMSans_400Regular … BricolageGrotesque_700Bold). Once loaded, markFontsLoaded()
// flips KText from the system fallback to the brand faces.

import { markFontsLoaded } from "./native";

let started = false;

/** Idempotent. Resolves after the brand fonts register (or quietly skips). */
export async function loadBrandFonts(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const Font = await import("expo-font");
    await Font.loadAsync({
      DMSans_400Regular: require("../../assets/fonts/DMSans_400Regular.ttf"),
      DMSans_500Medium: require("../../assets/fonts/DMSans_500Medium.ttf"),
      DMSans_600SemiBold: require("../../assets/fonts/DMSans_600SemiBold.ttf"),
      DMSans_700Bold: require("../../assets/fonts/DMSans_700Bold.ttf"),
      BricolageGrotesque_700Bold: require("../../assets/fonts/BricolageGrotesque_700Bold.ttf"),
    });
    markFontsLoaded();
  } catch {
    // Font load failed (rare) — the kit stays on the clean system fallback.
  }
}
