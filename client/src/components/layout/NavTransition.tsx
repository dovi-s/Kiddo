import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "wouter";
import { MOTION_EASE } from "@/lib/motion";
import { hasActiveDeepLink } from "@/lib/deep-link-highlight";

// ─────────────────────────────────────────────────────────────────────────────
// NavTransition — the app's "spatial navigation" layer.
//
// Replaces the old RouteFader (a flat opacity cross-fade with mode="wait") +
// ScrollToTop. The fade read as a *website* page-swap: no direction, a brief
// dip-to-blank between pages (mode="wait"), and back always dumped you at the
// top. This gives push navigation a sense of SPACE instead:
//
//   • Directional slide — forward enters from the RIGHT, back enters from the
//     LEFT (the Apple-Settings / iOS-nav-stack model). ~240ms, outExpo, no
//     bounce.
//   • No blank dip — enter-only on a keyed element: the new page mounts and
//     animates in immediately (no mode="wait" sequential gap). Snappier than
//     the old fade, and nothing flashes empty between pages.
//   • Scroll restoration — each path remembers its scroll; BACK restores it
//     (you return to where you were), FORWARD resets to the top.
//   • Edge swipe-back — an edge pan pops the stack, guarded so it never walks
//     off the app when there's no in-app history.
//
// Deliberately NOT here (yet): a true two-sided parallax push (old page slides
// out under the new) needs per-page scroll containers — a separate architecture
// change. Tabs stay instant (iOS tab bars don't slide); only PUSH navigation
// (into a fund / memory / settings sub-page / projection) animates.
// ─────────────────────────────────────────────────────────────────────────────

const TAB_PATHS = ["/dashboard", "/activity", "/memory", "/settings"];
const isTabPath = (p: string) => TAB_PATHS.some((t) => p.startsWith(t));

// Visual left→right order of the bottom-nav tabs (Share is an action, not a stop).
// Used to give a tab SWIPE a direction: a higher index slides in from the right,
// lower from the left — so swiping between tabs reads as moving sideways through them.
const tabOrderIndex = (p: string) => {
  if (p.startsWith("/dashboard") || p.startsWith("/staging")) return 0;
  if (p.startsWith("/memory")) return 1;
  if (p.startsWith("/activity") || p.startsWith("/event/")) return 2;
  if (p.startsWith("/settings")) return 3;
  return -1;
};

// Per-path scroll memory. Module-level so it survives the component's own
// re-renders (and is shared across the single NavTransition instance).
const scrollMemory = new Map<string, number>();

// How far the entering page slides, as a % of viewport width (responsive). The
// cross-fade masks the trailing gap — the page is near-invisible at peak offset
// and opaque as it lands — so a generous slide reads clearly as "a page arriving
// from the side" without exposing a strip of background. 24% is plainly felt on
// a phone (the 44px first pass was too subtle to notice). One knob to tune.
const SLIDE_PCT = 24;

// PROTOTYPE — flip to feel a crisper, more native "push": the entering page slides in
// nearly OPAQUE (a light 0.85→1 fade instead of 0→1) WITH a leading-edge shadow that fades
// as it lands — so it reads as a solid page sliding OVER the previous one (the iOS push
// depth cue) rather than a soft, website-y cross-fade. Default OFF keeps the founder-tuned
// cross-fade live and changes nothing; toggle to A/B the feel in dev. 2026-06-25.
const CRISP_PUSH = true;

export function NavTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const prevLocationRef = useRef(location);
  const stackRef = useRef<string[]>([location]);
  const firstRenderRef = useRef(true);

  // ── Direction detection ──────────────────────────────────────────────────
  // Maintain a stack of visited paths. If the new path is already in the stack
  // (below the top), it's a BACK (pop); otherwise a FORWARD (push). Handles the
  // browser back button, our swipe-back, and programmatic navigate() uniformly.
  const isNav = prevLocationRef.current !== location;
  let direction: 1 | -1 = 1; // 1 = forward (from right), -1 = back (from left)
  if (isNav) {
    const idx = stackRef.current.lastIndexOf(location);
    direction = idx >= 0 && idx < stackRef.current.length - 1 ? -1 : 1;
  }
  const tabSwitch =
    isNav && isTabPath(prevLocationRef.current) && isTabPath(location);
  // Tab switches now SLIDE (founder ask: swipe between tabs feels like moving
  // sideways through them) — direction by the tab's left→right order, not the
  // push/pop stack. Higher index → enters from the right, lower → from the left.
  if (tabSwitch) {
    const d = tabOrderIndex(location) - tabOrderIndex(prevLocationRef.current);
    if (d !== 0) direction = d > 0 ? 1 : -1;
  }

  // Commit the stack + prev-location AFTER render (never mutate refs that drive
  // this render's output during render — keeps StrictMode double-renders clean).
  useEffect(() => {
    if (prevLocationRef.current !== location) {
      const idx = stackRef.current.lastIndexOf(location);
      stackRef.current =
        idx >= 0 && idx < stackRef.current.length - 1
          ? stackRef.current.slice(0, idx + 1)
          : [...stackRef.current, location];
      prevLocationRef.current = location;
    }
    firstRenderRef.current = false;
  }, [location]);

  // ── Scroll memory: continuously record the current path's scroll ───────────
  useEffect(() => {
    const onScroll = () => scrollMemory.set(location, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location]);

  // ── Scroll restore (back) / reset (forward) ────────────────────────────────
  // Take ownership of scroll positioning (manual restoration) so this is
  // authoritative. Preserves the deep-link contract: a ?gift=/?gifter=/#anchor
  // navigation positions itself, so we leave scroll alone.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      /* older browsers — fall through */
    }
  }, []);

  useLayoutEffect(() => {
    try {
      if (hasActiveDeepLink()) return;
      if (window.location.hash && window.location.hash !== "#") return;
    } catch {
      /* best-effort */
    }
    const saved = scrollMemory.get(location);
    const target = direction === -1 && saved != null ? saved : 0;
    // Safe restore: go to the saved position ONLY if the page is tall enough to
    // hold it; otherwise a clean top — never a janky partial. A heavy page (the
    // dashboard) lays out its content async, so it may not be tall enough yet;
    // re-checking at a couple of delays catches pages that grow into range,
    // while the reachability guard keeps a too-short page from snapping to a
    // half-scrolled middle. Forward (target 0) is always reachable.
    const restore = () => {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const dest = target > 0 && maxScroll < target - 2 ? 0 : target;
      window.scrollTo(0, dest);
      if (document.documentElement) document.documentElement.scrollTop = dest;
      if (document.body) document.body.scrollTop = dest;
    };
    restore();
    const t1 = window.setTimeout(restore, 140);
    const t2 = window.setTimeout(restore, 360);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // direction is fresh per render; location drives the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Edge swipe-back ────────────────────────────────────────────────────────
  // Touchstart within 24px of the left edge + a clear rightward swipe pops the
  // stack. Guarded: only when there's in-app history to pop (stack depth > 1),
  // so it never walks the user off the app on a deep-linked first screen.
  useEffect(() => {
    if (prefersReducedMotion) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && t.clientX <= 24) {
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
      } else {
        tracking = false;
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // clear horizontal intent, and only if we have somewhere to go back to
      if (dx > 70 && dy < 50 && stackRef.current.length > 1) {
        window.history.back();
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [prefersReducedMotion]);

  // ── Render ─────────────────────────────────────────────────────────────────
  // Skip the slide on: first paint (cold load / deep link / hot reload), tab
  // switches (instant, iOS tab-bar feel), and reduced-motion. Scroll handling
  // above still runs in every case.
  const skip =
    firstRenderRef.current || prefersReducedMotion;

  // CRISP_PUSH adds a leading-edge shadow that animates from present → gone as the page
  // lands (so nothing lingers at rest), and starts the page nearly opaque. The shadow sits
  // on the LEADING edge — left for forward, right for back — hence the -direction offset.
  const crisp = CRISP_PUSH && !skip;
  const leadingShadow = `${-direction * 12}px 0 32px hsl(var(--kiddo-ink) / 0.13)`;
  return (
    <motion.div
      key={location}
      initial={
        skip
          ? false
          : crisp
            ? { opacity: 0.85, x: `${direction * SLIDE_PCT}%`, boxShadow: leadingShadow }
            : { opacity: 0, x: `${direction * SLIDE_PCT}%` }
      }
      animate={crisp ? { opacity: 1, x: 0, boxShadow: "0px 0 0px hsl(var(--kiddo-ink) / 0)" } : { opacity: 1, x: 0 }}
      transition={
        skip
          ? { duration: 0 }
          : { duration: 0.28, ease: MOTION_EASE.outExpo }
      }
      style={{ minHeight: "100dvh", ...(crisp ? { background: "hsl(var(--kiddo-cream))" } : {}) }}
    >
      {children}
    </motion.div>
  );
}
