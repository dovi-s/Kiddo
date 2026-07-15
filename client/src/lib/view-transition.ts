import { flushSync } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────────
// Browser View Transitions — a real TWO-SIDED push: the OUTGOING page parallaxes
// out while the incoming page slides in over it (the native iOS/Android feel the
// old enter-only framer slide couldn't do, because it had no way to keep/animate
// the departing page). The browser snapshots BOTH DOM states and cross-slides them
// per the CSS in index.css (`::view-transition-old/new(root)`), so we never need
// the outgoing React tree mounted.
//
// Integration point: wouter v3 patches history.pushState to fire its store event
// (use-browser-location.js), so we layer OUR patch on top — call wouter's version
// inside startViewTransition + flushSync, and React commits the route change
// synchronously INSIDE the snapshot window. One patch = every forward navigation
// (Link + setLocation) animates, no touching call sites.
//
// FORWARD only (pushState). BACK is a popstate — the URL has already changed by
// the time we hear it, and the History API gives no hook to wrap that re-render
// (the Navigation API would, but Safari lacks it). So back stays on NavTransition's
// enter-from-left framer slide. Feature-detected + reduced-motion + tab-switch
// aware, so unsupported browsers and tab bars are untouched.
// ─────────────────────────────────────────────────────────────────────────────

// True while a router-driven View Transition is animating. NavTransition reads this
// and stands down (its framer slide would otherwise double-animate the page).
let vtActive = false;
export const isViewTransitionActive = () => vtActive;

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && typeof (document as any).startViewTransition === "function";
}

// Tab bar destinations — switching between them stays INSTANT (native tab bars
// don't slide), matching NavTransition's own tab rule.
const TAB_PREFIXES = ["/dashboard", "/staging", "/activity", "/memory", "/settings", "/event/"];
const isTab = (p: string) => TAB_PREFIXES.some((t) => p.startsWith(t));

// Allowlist of destinations whose FRAME-ONE content is GUARANTEED (findFundInCaches
// resolves the fund from a durable cache synchronously). VT freezes the first frame,
// so animating a route that still shows a loading skeleton would freeze the skeleton
// — we opt routes IN as they're hardened, never blanket. Everything else falls back
// to NavTransition's (skeleton-free) enter-only slide.
const VT_ROUTES = ["/projection", "/age-18-plan", "/tax-documents"];

// A VT route only animates once its lazy CHUNK has loaded — VT freezes the first
// frame, so firing before the chunk resolves would freeze the Suspense skeleton.
// App.tsx eager-imports these and calls markVtRouteReady when each resolves; until
// then the nav falls back to NavTransition's (graceful, non-freezing) slide.
const vtRouteReady = new Set<string>();
export function markVtRouteReady(routePrefix: string): void { vtRouteReady.add(routePrefix); }
const shouldVt = (p: string) => VT_ROUTES.some((r) => p.startsWith(r) && vtRouteReady.has(r));
const pathOf = (url: string): string => {
  try { return new URL(url, window.location.origin).pathname; } catch { return url; }
};

let installed = false;

/** Patch history.pushState so every forward navigation runs inside a View
 *  Transition. Returns an uninstaller. No-op (and no patch) when unsupported. */
export function installForwardViewTransitions(): () => void {
  if (installed || !supportsViewTransitions() || typeof history === "undefined") return () => {};
  // Default ON, scoped to VT_ROUTES (whose frame-one content is guaranteed, so the
  // API's first-frame freeze lands on content, not a skeleton). Escape hatch:
  // localStorage['kiddo:vt']='0' disables it entirely.
  const disabled = (() => { try { return window.localStorage.getItem("kiddo:vt") === "0"; } catch { return false; } })();
  if (disabled) return () => {};
  installed = true;
  const origPush = history.pushState.bind(history);
  history.pushState = function (data: any, unused: string, url?: string | URL | null) {
    try {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const fromPath = window.location.pathname;
      const toPath = url != null ? pathOf(String(url)) : fromPath;
      // Skip the transition (plain navigate → NavTransition's slide) for:
      // reduced-motion, a query-only change (same pathname), tab<->tab switches
      // (instant, iOS tab-bar feel), and any destination not on the frame-one-
      // content allowlist (else VT would freeze that page's loading skeleton).
      if (reduce || toPath === fromPath || (isTab(fromPath) && isTab(toPath)) || !shouldVt(toPath)) {
        return origPush(data, unused, url as any);
      }
      document.documentElement.dataset.vtDir = "forward";
      vtActive = true;
      const transition = (document as any).startViewTransition(() => {
        // flushSync so React commits the route swap synchronously in-callback;
        // otherwise the browser snapshots the old DOM as BOTH states and nothing
        // moves. origPush is wouter's patched pushState → it fires the store event
        // that drives the re-render.
        flushSync(() => { origPush(data, unused, url as any); });
      });
      const clear = () => { vtActive = false; delete document.documentElement.dataset.vtDir; };
      (transition.finished as Promise<void>).then(clear, clear);
      return undefined as any;
    } catch {
      // Any failure in the transition path must never break navigation.
      vtActive = false;
      return origPush(data, unused, url as any);
    }
  } as any;
  return () => { history.pushState = origPush; installed = false; };
}
