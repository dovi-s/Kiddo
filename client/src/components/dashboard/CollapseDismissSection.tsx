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

import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type CollapseDismissSectionProps = {
  open: boolean;
  onExitComplete?: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  // Allow data-* passthrough (e.g. data-testid) onto the rendered <section>.
  [dataAttr: `data-${string}`]: string | boolean | undefined;
};

export function CollapseDismissSection({
  open,
  onExitComplete,
  className,
  style,
  children,
  ...rest
}: CollapseDismissSectionProps) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            height: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingTop: 0,
            paddingBottom: 0,
            transition: {
              // Space closes smoothly; content fades a touch faster so the
              // collapse never reads as a squish.
              duration: 0.32,
              ease: [0.4, 0, 0.2, 1],
              opacity: { duration: 0.18, ease: "easeOut" },
            },
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={className}
          style={{ overflow: "hidden", ...style }}
          {...rest}
        >
          {children}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
