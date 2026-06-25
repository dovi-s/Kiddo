// Swipe-down-to-dismiss for bottom sheets (founder ask 2026-06-14: "anything
// that slides up should slide down to dismiss"). Shared by the two Radix sheet
// primitives — dialog.tsx (`<DialogContent sheet>`) and sheet.tsx
// (`<SheetContent side="bottom">`) — so the gesture is defined once.
//
// Two grab zones, both ending in the SAME real Radix close (so onOpenChange +
// the slide-out exit fire exactly as they would from the X — no divergent path):
//
//   1. HANDLE grab (`handleProps`). The little handle/strip is `touch-none`, so
//      dragging it never scrolls the body — robust even when the sheet is
//      scrolled down (well, as far as the handle is reachable).
//   2. CONTENT grab (native listeners on the content, added 2026-06-25). The
//      iOS-native gesture: swipe down from ANYWHERE in the sheet to dismiss, but
//      ONLY when the content is scrolled to the very top (`scrollTop <= 0`) and
//      the gesture is clearly downward (vertical > horizontal). Otherwise the
//      touch is left alone and scrolls normally — this is the classic
//      bottom-sheet-vs-scroll conflict, resolved by the at-top + direction gate.
//      Needs a NON-PASSIVE touchmove (to preventDefault the scroll once we commit
//      to a dismiss-drag), so it's a manual addEventListener, not a React prop.
//
// Shared rules: down-only, a short drag (< threshold) springs back, past the
// threshold it animates the rest of the way down then clicks the hidden Close.
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
// Below this much movement we haven't committed to scroll-vs-dismiss yet.
const DECIDE_SLOP_PX = 4;
const SPRING = "transform 0.22s cubic-bezier(0.16,1,0.3,1)";

export function useSheetDragDismiss<T extends HTMLElement>(
  forwardedRef: React.Ref<T>,
) {
  const contentRef = React.useRef<T | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  // Tracked in state (not just the ref) so the content-gesture effect re-runs
  // and binds its listeners once Radix actually mounts the content node.
  const [contentEl, setContentEl] = React.useState<T | null>(null);
  const drag = React.useRef({ startY: 0, dy: 0, active: false });

  const setContentRef = React.useCallback(
    (node: T | null) => {
      contentRef.current = node;
      setContentEl(node);
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<T | null>).current = node;
    },
    [forwardedRef],
  );

  // Shared "let it fall the rest of the way, then really close" tail.
  const finishDrag = React.useCallback((el: HTMLElement, dy: number) => {
    el.style.transition = SPRING;
    if (dy > DISMISS_THRESHOLD_PX) {
      haptic("selection");
      el.style.transform = "translateY(100%)";
      window.setTimeout(() => {
        closeRef.current?.click();
        el.style.transform = "";
      }, 180);
    } else {
      el.style.transform = "translateY(0px)";
    }
  }, []);

  // 1) HANDLE grab — React handlers on the (touch-none) handle strip.
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
        drag.current.active = false;
        if (contentRef.current) finishDrag(contentRef.current, drag.current.dy);
      },
    }),
    [finishDrag],
  );

  // 2) CONTENT grab — native listeners (non-passive move) so we can dismiss-drag
  //    from anywhere in the sheet, but only from the top + downward.
  React.useEffect(() => {
    const el = contentEl;
    if (!el || typeof window === "undefined") return;

    // Is the scroll container UNDER the finger at its top? We can't just read
    // el.scrollTop: in sheet.tsx the ref'd node IS the scroller, but in
    // dialog.tsx it's `flex flex-col` and a flex-1 CHILD scrolls — so el.scrollTop
    // is always 0 there. Walk up from the touched node to find the real scroller
    // (and handle any nested scroll area) and check that one. No scroller found
    // (e.g. a short sheet) → treat as at-top, dismiss allowed.
    const scrollerAtTop = (target: EventTarget | null): boolean => {
      let node: Node | null = target instanceof Node ? target : null;
      while (node && node !== el.parentElement) {
        if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight) {
          const oy = window.getComputedStyle(node).overflowY;
          if (oy === "auto" || oy === "scroll") return node.scrollTop <= 0;
        }
        if (node === el) break;
        node = node.parentNode;
      }
      return true;
    };

    let startX = 0;
    let startY = 0;
    let dy = 0;
    let decided = false;
    let dragging = false;
    let fromHandle = false;
    let startTarget: EventTarget | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      dy = 0;
      decided = false;
      dragging = false;
      startTarget = e.target;
      // Handle touches are owned by handleProps above — don't double-handle.
      fromHandle = !!(
        e.target instanceof Element &&
        e.target.closest('[data-testid="sheet-drag-handle"]')
      );
    };

    const onMove = (e: TouchEvent) => {
      if (fromHandle) return;
      const t = e.touches[0];
      const d = t.clientY - startY;
      const dx = t.clientX - startX;
      if (!decided) {
        if (Math.abs(d) < DECIDE_SLOP_PX && Math.abs(dx) < DECIDE_SLOP_PX) return;
        decided = true;
        // Commit to dismiss-drag ONLY if: the scroll area under the finger is at
        // its top, moving down, and the gesture is more vertical than horizontal.
        // Else leave it alone to scroll.
        dragging = d > 0 && Math.abs(d) > Math.abs(dx) && scrollerAtTop(startTarget);
        if (dragging) el.style.transition = "none";
      }
      if (!dragging) return;
      dy = Math.max(0, d);
      e.preventDefault(); // stop the body from scrolling while we drag the sheet
      el.style.transform = `translateY(${dy}px)`;
    };

    const onEnd = () => {
      if (fromHandle || !dragging) return;
      dragging = false;
      finishDrag(el, dy);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [contentEl, finishDrag]);

  return { setContentRef, closeRef, handleProps };
}
