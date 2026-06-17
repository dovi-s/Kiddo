import { useEffect } from "react";
import { useLocation } from "wouter";

// Dynamic status-bar / browser-chrome tint (the Acorns "seamless top" effect,
// but honest about iOS's constraint). We update the single <meta name="theme-color">
// to match whatever opaque background currently sits DIRECTLY under the iOS
// status bar, so the strip blends into the screen you're on instead of being
// locked to cream.
//
// THE iOS CONSTRAINT (see feedback_status_bar_blends_not_green): the status-bar
// GLYPHS (time/wifi/battery) are dark — set by `apple-mobile-web-app-status-bar-style:
// default` — and iOS will NOT flip glyph color live for a PWA. So we only ever
// tint to LIGHT colors (where dark glyphs stay readable); anything dark falls
// back to cream rather than swallowing the glyphs. Across Kiddo's cream/white/
// pale palette that reads as "the bar follows the app"; on a genuinely dark top
// it stays safely cream.
//
// NOTE: dynamic theme-color updates reliably in mobile Safari. An INSTALLED
// standalone PWA on iOS may freeze the bar at its load-time color until next
// launch — that's an OS limitation, not a bug here.

const CREAM = "#F9F7F3";
// Relative luminance below this = treat as "dark", keep glyphs safe with cream.
const LIGHT_THRESHOLD = 0.55;

type Rgb = { r: number; g: number; b: number; a: number };

function parseRgb(value: string): Rgb | null {
  const m = value.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(",").map((v) => parseFloat(v.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

function luminance({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Walk up from the topmost element under the status bar until we hit a
// non-transparent background. elementFromPoint is sampled a couple px down so
// we read the content that draws under the reserved status-bar area.
function sampleTopColor(): Rgb | null {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const x = Math.max(1, Math.floor(window.innerWidth / 2));
  let el = document.elementFromPoint(x, 2) as Element | null;
  let guard = 0;
  while (el && guard++ < 16) {
    const bg = getComputedStyle(el).backgroundColor;
    const rgb = parseRgb(bg);
    if (rgb && rgb.a >= 0.5) return rgb;
    el = el.parentElement;
  }
  return null;
}

function apply(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const rgb = sampleTopColor();
  const next =
    rgb && luminance(rgb) >= LIGHT_THRESHOLD
      ? `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`
      : CREAM;
  if (meta.getAttribute("content") !== next) meta.setAttribute("content", next);
}

export function useStatusBarColor(): void {
  const [location] = useLocation();

  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };

    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // childList catches overlays (sheets / dialogs / drawers) mounting and
    // unmounting over the top; attributes are intentionally NOT observed —
    // framer-motion mutates inline styles every frame and would spin this.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Re-sample after each route change once the new screen has painted.
  useEffect(() => {
    const raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [location]);
}
