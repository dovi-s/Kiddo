import { useEffect } from "react";
import { useLocation } from "wouter";

// Status-bar tint that tracks whatever is scrolled under it (the Acorns
// "seamless top"). iOS IGNORES <meta name="theme-color"> for the status-bar
// region — verified by forcing it red on iPhone Safari + installed PWA and
// seeing no change. With viewport-fit=cover the page draws under the status
// bar, so the only reliable lever is to PAINT it: a fixed opaque strip over the
// top safe-area whose background we keep matched to the content currently below
// it. We also still update theme-color, which Android/Chrome DOES honor.
//
// Glyphs note: the status-bar glyphs (time/wifi/battery) are dark — set by
// `apple-mobile-web-app-status-bar-style: default`, which iOS won't flip live —
// so a genuinely dark strip would hide them. The app is cream/light throughout,
// so faithful matching stays readable in practice; revisit only if a dark-topped
// screen ships.

const FILL_ID = "kiddo-statusbar-fill";
const DEFAULT = "#F8F5F0"; // --kiddo-cream, matches the app header (avoids a load flash)

type Rgb = { r: number; g: number; b: number; a: number };

function parseRgb(value: string): Rgb | null {
  const m = value.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const p = m[1].split(",").map((v) => parseFloat(v.trim()));
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
  return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
}

// Normalize ANY computed CSS color (rgb, rgba, #hex, and CSS Color 4 forms like
// oklab()/oklch()/color() that Tailwind v4 emits) to rgb via a canvas, which the
// browser uses to convert. Falls back to null if the engine rejects the value.
let _ctx: CanvasRenderingContext2D | null | undefined;
const SENTINEL = "#010203";
function toRgb(value: string): Rgb | null {
  const direct = parseRgb(value);
  if (direct) return direct;
  if (typeof document === "undefined") return null;
  if (_ctx === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    _ctx = c.getContext("2d");
  }
  if (!_ctx) return null;
  try {
    _ctx.fillStyle = SENTINEL;
    _ctx.fillStyle = value; // browser normalizes; leaves SENTINEL if rejected
    const norm = _ctx.fillStyle as string;
    if (norm === SENTINEL && value.trim().toLowerCase() !== SENTINEL) return null;
    if (norm.startsWith("#")) {
      const hex = norm.length === 4
        ? norm.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3")
        : norm;
      return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
        a: 1,
      };
    }
    return parseRgb(norm);
  } catch {
    return null;
  }
}

// The fixed strip that physically paints the status-bar area. Created once and
// reused. Height is the iOS safe-area inset (0 on non-notched devices → no-op).
function ensureFill(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(FILL_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = FILL_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);" +
      "z-index:2147483646;pointer-events:none;background:" + DEFAULT + ";";
    document.body.appendChild(el);
  }
  return el;
}

// Read the first opaque background just BELOW the status-bar strip — that's what
// the bar should match. Skips the strip itself.
function sampleBelow(fillHeight: number): Rgb | null {
  if (typeof window === "undefined") return null;
  const x = Math.max(1, Math.floor(window.innerWidth / 2));
  const y = Math.max(4, Math.round(fillHeight) + 4);
  let el = document.elementFromPoint(x, y) as Element | null;
  let guard = 0;
  while (el && guard++ < 16) {
    if (el.id === FILL_ID) {
      el = el.parentElement;
      continue;
    }
    const rgb = toRgb(getComputedStyle(el).backgroundColor);
    if (rgb && rgb.a >= 0.5) return rgb;
    el = el.parentElement;
  }
  return null;
}

function apply(): void {
  const fill = ensureFill();
  if (!fill) return;
  const rgb = sampleBelow(fill.offsetHeight);
  if (!rgb) return;
  const color = `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  if (fill.style.background !== color) fill.style.background = color;
  const meta = document.querySelector('meta[name="theme-color"]'); // Android honors this
  if (meta && meta.getAttribute("content") !== color) meta.setAttribute("content", color);
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
    // childList catches overlays (sheets / dialogs / drawers) mounting over the
    // top; attributes are intentionally NOT observed — framer-motion mutates
    // inline styles every frame and would spin this.
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
