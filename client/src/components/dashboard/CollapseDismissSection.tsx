// Shared dismiss treatment for in-flow dashboard banners (co-parent joined,
// at-18 welcome, first-media celebration, …). The thing that made dismissals
// feel jittery was that they had a nice ENTRANCE but no exit: dismissing set a
// flag and the banner blinked out, so the page below snapped up.
//
// This wraps the banner in an AnimatePresence whose exit COLLAPSES the section —
// fade first (fast), then height/padding/margin glide to 0 — so the surrounding
// layout closes the gap smoothly instead of jumping. The persist-the-dismiss
// side effect runs AFTER the exit completes (onExitComplete), so the animation
// always plays and the banner never reappears.
//
// Why the collapse lives on the <section> itself (not a wrapper): `overflow:
// hidden` clips an element's CONTENT during the height collapse but never its
// own box-shadow, so the card keeps its shadow the whole way down. A wrapper
// with overflow:hidden would clip the child's shadow — this doesn't.
//
// Usage: the caller owns an `open` boolean (starts true; set false on dismiss)
// and passes the persist callback as onExitComplete.

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type CollapseDismissSectionProps = {
  open: boolean;
  onExitComplete?: () => void;
  // When provided, the banner becomes SWIPE-DISMISSABLE (founder call
  // 2026-06-07): drag it sideways past a distance/velocity threshold and it
  // flings off in that direction, then the height-collapse closes the gap —
  // the native card gesture on mobile (works with mouse drag on desktop
  // too). Short drags spring back elastically. Callers pass the same
  // `() => setOpen(false)` their Dismiss button uses, so both paths share
  // one exit + one persistence (onExitComplete). The button stays — it's
  // the discoverable/a11y path; the swipe is the natural one.
  onRequestDismiss?: () => void;
  // When true, the banner GROWS in (height 0 -> auto) instead of the default
  // fade + slide. Use it when the banner reveals AFTER the surrounding content
  // has already settled (e.g. the since-last-visit digest, held until the hero
  // roll cascade finishes) — the height-grow opens the space smoothly so the
  // content below EASES down instead of snapping by a card-height. Default
  // banners appear during the initial paint (nothing to push), so they keep the
  // lighter fade + slide. The exit is identical either way (collapse).
  enterCollapsed?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  // Allow data-* passthrough (e.g. data-testid) onto the rendered <section>.
  [dataAttr: `data-${string}`]: string | boolean | undefined;
};

const SWIPE_DISTANCE = 110; // px of drag that commits the dismiss
const SWIPE_VELOCITY = 600; // px/s fling that commits regardless of distance

export function CollapseDismissSection({
  open,
  onExitComplete,
  onRequestDismiss,
  enterCollapsed,
  className,
  style,
  children,
  ...rest
}: CollapseDismissSectionProps) {
  // Direction of a committing swipe (−1 left, +1 right, 0 = button dismiss).
  // A ref, not state: it's read by the exit prop on the very render that
  // removes the element, and the drag handler sets it synchronously before
  // calling onRequestDismiss — no re-render needed in between.
  const swipeDirRef = useRef(0);
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <motion.section
          initial={enterCollapsed ? { opacity: 0, height: 0 } : { opacity: 0, y: 12 }}
          animate={enterCollapsed ? { opacity: 1, height: "auto" } : { opacity: 1, y: 0 }}
          drag={onRequestDismiss ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={(_e, info) => {
            if (!onRequestDismiss) return;
            const commits = Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY;
            if (!commits) return; // dragConstraints springs it home
            swipeDirRef.current = (info.offset.x || info.velocity.x) >= 0 ? 1 : -1;
            onRequestDismiss();
          }}
          exit={{
            opacity: 0,
            // Swipe-dismissals fly out in the swiped direction while the
            // space closes; button dismissals keep the original in-place
            // fade + collapse (x stays 0).
            x: swipeDirRef.current === 0 ? 0 : swipeDirRef.current * 480,
            height: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingTop: 0,
            paddingBottom: 0,
            transition: {
              // Space closes smoothly; content fades a touch faster so the
              // collapse never reads as a squish; the fling leads slightly
              // so the card is gone before the gap finishes closing.
              duration: 0.32,
              ease: [0.4, 0, 0.2, 1],
              opacity: { duration: 0.18, ease: "easeOut" },
              x: { duration: 0.26, ease: [0.4, 0, 0.2, 1] },
            },
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={className}
          style={{ overflow: "hidden", ...style }}
          {...rest}
          // Marks this as a horizontal swipe-dismiss surface so the global
          // tab-swipe (MobileNav) bails when a touch STARTS inside it —
          // otherwise a sideways fling both dismisses the banner AND switches
          // tabs (Theo -> Memory). Only when actually draggable.
          data-swipe-dismiss={onRequestDismiss ? "true" : undefined}
        >
          {children}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
