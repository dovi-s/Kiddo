// Swipe-down-to-dismiss for bottom sheets (founder ask 2026-06-14: "anything
// that slides up should slide down to dismiss"). Shared by the two Radix sheet
// primitives — dialog.tsx (`<DialogContent sheet>`) and sheet.tsx
// (`<SheetContent side="bottom">`) — so the gesture is defined once.
//
// Design choices that make it robust:
//   - HANDLE-ONLY grab. The drag is wired to a small handle/strip, never the
//     whole sheet, so it never fights the body's scroll (the classic
//     bottom-sheet-vs-scroll conflict). `touch-none` on the handle keeps the
//     page from scrolling mid-drag.
//   - Real close, not a fake hide. Past the threshold it animates the sheet the
//     rest of the way down, then clicks a hidden Radix Close — so onOpenChange +
//     the slide-out exit fire exactly as they would from the X. No consumer
//     changes, no divergent close path.
//   - Down-only + snap-back. Upward drag is ignored; a short drag springs back.
//
// Usage (inside a forwardRef sheet content component):
//   const { setContentRef, closeRef, handleProps } = useSheetDragDismiss(ref);
//   <Content ref={setContentRef}>
//     <div {...handleProps} className="… touch-none">{/* handle bar */}</div>
//     <PrimitiveClose ref={closeRef} className="sr-only" tabIndex={-1} aria-hidden>close</PrimitiveClose>
//     {children}
//   </Content>

import * as React from "react";
import { haptic } from "@/lib/haptics";

// Past this many px of downward drag, dismiss; otherwise spring back.
const DISMISS_THRESHOLD_PX = 110;

export function useSheetDragDismiss<T extends HTMLElement>(
  forwardedRef: React.Ref<T>,
) {
  const contentRef = React.useRef<T | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const drag = React.useRef({ startY: 0, dy: 0, active: false });

  const setContentRef = React.useCallback(
    (node: T | null) => {
      contentRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<T | null>).current = node;
    },
    [forwardedRef],
  );

  const handleProps = React.useMemo(
    () => ({
      onTouchStart: (e: React.TouchEvent) => {
        drag.current = { startY: e.touches[0].clientY, dy: 0, active: true };
        if (contentRef.current) contentRef.current.style.transition = "none";
      },
      onTouchMove: (e: React.TouchEvent) => {
        if (!drag.current.active) return;
        const dy = Math.max(0, e.touches[0].clientY - drag.current.startY);
        drag.current.dy = dy;
        if (contentRef.current) contentRef.current.style.transform = `translateY(${dy}px)`;
      },
      onTouchEnd: () => {
        if (!drag.current.active) return;
        const { dy } = drag.current;
        drag.current.active = false;
        const el = contentRef.current;
        if (el) el.style.transition = "transform 0.22s cubic-bezier(0.16,1,0.3,1)";
        if (dy > DISMISS_THRESHOLD_PX) {
          haptic("selection");
          if (el) el.style.transform = "translateY(100%)";
          window.setTimeout(() => {
            closeRef.current?.click();
            if (el) el.style.transform = "";
          }, 180);
        } else if (el) {
          el.style.transform = "translateY(0px)";
        }
      },
    }),
    [],
  );

  return { setContentRef, closeRef, handleProps };
}
