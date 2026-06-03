// Brand-font loader. The web app renders in DM Sans (body) + Bricolage Grotesque
// (headings); without these the native app falls back to the system font and
// looks generic / "different from web". The token family names are the
// @expo-google-fonts identifiers (DMSans_400Regular … BricolageGrotesque_700Bold),
// so we register faces under those exact names and KText picks them up via
// markFontsLoaded().
//
//   • Web (Expo web preview): inject @font-face from the Fontsource CDN — works
//     immediately in the browser the founder is testing in.
//   • Native device: load the same faces via expo-font if reachable; if not
//     (offline, or once @expo-google-fonts is bundled instead), it degrades to
//     the clean system fallback. Bundling @expo-google-fonts/dm-sans +
//     bricolage-grotesque is the production path on device.

import { Platform } from "react-native";
import { markFontsLoaded } from "./native";

const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";

const FACES: Array<{ family: string; weight: number; slug: string; w: string }> = [
  { family: "DMSans_400Regular", weight: 400, slug: "dm-sans", w: "400" },
  { family: "DMSans_500Medium", weight: 500, slug: "dm-sans", w: "500" },
  { family: "DMSans_600SemiBold", weight: 600, slug: "dm-sans", w: "600" },
  { family: "DMSans_700Bold", weight: 700, slug: "dm-sans", w: "700" },
  { family: "BricolageGrotesque_700Bold", weight: 700, slug: "bricolage-grotesque", w: "700" },
];

let started = false;

/** Idempotent. Resolves after fonts are registered (or skipped). */
export async function loadBrandFonts(): Promise<void> {
  if (started) return;
  started = true;

  if (Platform.OS === "web") {
    if (typeof document === "undefined") return;
    if (!document.getElementById("kiddo-brand-fonts")) {
      const style = document.createElement("style");
      style.id = "kiddo-brand-fonts";
      style.textContent = FACES.map(
        (f) =>
          `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};` +
          `font-display:swap;src:url('${CDN}/${f.slug}@latest/latin-${f.w}-normal.woff2') format('woff2');}`,
      ).join("");
      document.head.appendChild(style);
    }
    markFontsLoaded();
    return;
  }

  // Native: best-effort remote load. If it throws (offline / format), the kit
  // stays on the system font — no crash, no broken-family fallback.
  try {
    const Font = await import("expo-font");
    const map: Record<string, string> = {};
    for (const f of FACES) map[f.family] = `${CDN}/${f.slug}@latest/latin-${f.w}-normal.ttf`;
    await Font.loadAsync(map);
    markFontsLoaded();
  } catch {
    /* keep system fallback */
  }
}
