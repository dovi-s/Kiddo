import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Custom, branded pull-to-refresh. Runs EVERYWHERE (tab + installed PWA): we
// disabled the browser's native pull-to-refresh app-wide via `overscroll-behavior`
// (it was firing by accident), so this JS gesture is now the ONE refresh path.
// Pull down from the top of the scrolled content, past a threshold, and the React
// Query cache refetches. Deliberate by design (72px threshold + 0.5 damping +
// at-top + vertical-only guards), so a normal scroll flick never triggers it.
//
// Spinner-only (we don't translate the page content). That keeps it
// non-invasive: it never wraps or transforms the app's scroll container, so it
// can't interfere with the window-scrolling the app relies on elsewhere.
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    // Runs EVERYWHERE now (2026-07-01). We disabled the browser's native
    // pull-to-refresh app-wide via `overscroll-behavior` (it fired by accident),
    // so this branded gesture is the only refresh — it must work in a tab too, not
    // just standalone. Deliberate by design: a 72px threshold + 0.5 damping means
    // it never triggers on a normal scroll flick.
    const THRESHOLD = 72;
    const MAX = 110;
    const apply = (v: number) => { pullRef.current = v; setPull(v); };

    // Is the scroll container UNDER the finger at its top? window.scrollY alone is
    // wrong here — the dashboard (and other pages) scroll inside a DIV, not the
    // window. Walk up from the touched node to the real scroller and check that.
    const scrollerAtTop = (target: EventTarget | null): boolean => {
      let n: Node | null = target instanceof Node ? target : null;
      while (n && n instanceof HTMLElement) {
        if (n.scrollHeight > n.clientHeight + 1) {
          const oy = getComputedStyle(n).overflowY;
          if (oy === "auto" || oy === "scroll") return n.scrollTop <= 0;
        }
        n = n.parentElement;
      }
      return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    };

    let startX = 0;
    const onStart = (e: TouchEvent) => {
      if (busyRef.current || e.touches.length !== 1) { startY.current = null; return; }
      // A sheet/dialog owns its own gestures; and only start a pull when the
      // content under the finger is actually scrolled to the top.
      if (document.querySelector('[role="dialog"]') || !scrollerAtTop(e.target)) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      pulling.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || busyRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX;
      // Upward, or clearly horizontal (a tab swipe) → not a pull-to-refresh.
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        if (pulling.current) { pulling.current = false; apply(0); }
        if (dy <= 0) startY.current = null;
        return;
      }
      pulling.current = true;
      // Hold the page still while pulling (we own this gesture now).
      if (e.cancelable) e.preventDefault();
      apply(Math.min(MAX, dy * 0.5));
    };
    const finish = () => {
      if (startY.current == null) { return; }
      const go = pulling.current && pullRef.current >= THRESHOLD;
      startY.current = null;
      pulling.current = false;
      if (!go) { apply(0); return; }
      busyRef.current = true;
      setRefreshing(true);
      apply(THRESHOLD);
      const t0 = Date.now();
      Promise.resolve(queryClient.invalidateQueries())
        .catch(() => {})
        .then(() => {
          // Keep the spinner up at least ~600ms so the refresh reads as a
          // deliberate beat, not a flicker.
          const wait = Math.max(0, 600 - (Date.now() - t0));
          window.setTimeout(() => {
            busyRef.current = false;
            setRefreshing(false);
            apply(0);
          }, wait);
        });
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", finish, { passive: true });
    window.addEventListener("touchcancel", finish, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", finish);
      window.removeEventListener("touchcancel", finish);
    };
  }, [queryClient]);

  if (pull <= 0 && !refreshing) return null;

  const progress = Math.min(1, pull / 72);
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: "max(8px, env(safe-area-inset-top))",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 60,
        transform: `translateY(${Math.max(0, pull - 28)}px)`,
        transition: pull === 0 ? "transform 0.25s cubic-bezier(0.16,1,0.3,1)" : "none",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9999,
          background: "white",
          boxShadow: "0 2px 12px hsl(var(--kiddo-ink) / 0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader2
          size={18}
          className={refreshing ? "animate-spin" : ""}
          style={{
            color: "hsl(var(--kiddo-evergreen))",
            opacity: refreshing ? 1 : 0.35 + progress * 0.65,
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
          }}
        />
      </div>
    </div>
  );
}
