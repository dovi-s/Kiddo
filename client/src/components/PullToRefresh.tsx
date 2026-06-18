import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Custom pull-to-refresh for the installed (standalone) PWA. A standalone PWA
// has no browser chrome, so iOS/Android give it NO native pull-to-refresh — the
// gesture that works in a Safari tab simply isn't provided. This re-creates it
// in JS: pull down from the very top of the page, past a threshold, and the
// React Query cache refetches.
//
// Gated to standalone ONLY. In a normal browser tab the OS still provides native
// pull-to-refresh, so we stay completely inert there (the component renders null
// and attaches no listeners) — no double gesture, no risk to browser scrolling.
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
    const isStandalone =
      (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
      (navigator as any).standalone === true;
    if (!isStandalone) return; // browser tab → native pull-to-refresh; do nothing.

    const THRESHOLD = 72;
    const MAX = 110;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    const apply = (v: number) => { pullRef.current = v; setPull(v); };

    const onStart = (e: TouchEvent) => {
      if (busyRef.current || e.touches.length !== 1 || !atTop()) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || busyRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || !atTop()) {
        if (pulling.current) { pulling.current = false; apply(0); }
        if (!atTop()) startY.current = null;
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
          boxShadow: "0 2px 12px rgba(26,23,16,0.18)",
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
