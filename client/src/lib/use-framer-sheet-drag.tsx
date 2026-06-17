// Swipe-down-to-dismiss for the app's STANDALONE framer-motion bottom sheets
// (AddFundSheet, NoteEditorSheet, CreateEventSheet, etc.) — the ones that render
// their own motion.div panel with an onClose callback, rather than going through
// the Radix dialog/sheet primitives (those use use-sheet-drag-dismiss instead).
//
// Framer-native so it composes with the panel's own animate/exit (the y:100
// slide) instead of fighting an inline transform:
//   - drag="y" + dragControls + dragListener:false → the panel only drags when
//     the HANDLE starts it, so it never steals the body's scroll.
//   - dragConstraints 0/0 + dragElastic lets it pull down and spring back; past
//     the threshold (or a fast flick) it calls onClose, and the panel's existing
//     AnimatePresence exit plays the slide-out.
//
// Usage (inside a framer bottom-sheet):
//   const { dragProps, handle } = useFramerSheetDrag(onClose);
//   <motion.div {...dragProps} className="relative …">  // panel must be relative
//     {handle}
//     {…sheet body…}
//   </motion.div>

import * as React from "react";
import { useDragControls, type PanInfo } from "framer-motion";
import { haptic } from "@/lib/haptics";

const DISMISS_THRESHOLD_PX = 110;
const FLICK_VELOCITY = 600;

export function useFramerSheetDrag(onClose: () => void, opts?: { threshold?: number }) {
  const dragControls = useDragControls();
  const threshold = opts?.threshold ?? DISMISS_THRESHOLD_PX;

  const dragProps = {
    drag: "y" as const,
    dragControls,
    dragListener: false, // only the handle starts a drag (never the scrollable body)
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 0.6 },
    onDragEnd: (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      if (info.offset.y > threshold || info.velocity.y > FLICK_VELOCITY) {
        haptic("selection");
        onClose();
      }
    },
  };

  // A normal (non-absolute) centered grab bar — drops in as the first child of a
  // panel's pinned top region (sticky header, or the panel top) without needing
  // per-sheet positioning. Mobile only (desktop renders these centered, where
  // drag-down reads oddly). touch-none so grabbing it never scrolls the body.
  const handle = (
    <div
      onPointerDown={(e) => dragControls.start(e)}
      className="flex shrink-0 justify-center pt-2.5 pb-1 touch-none cursor-grab active:cursor-grabbing sm:hidden"
      aria-hidden="true"
      data-testid="sheet-drag-handle"
    >
      <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
    </div>
  );

  return { dragProps, handle };
}
