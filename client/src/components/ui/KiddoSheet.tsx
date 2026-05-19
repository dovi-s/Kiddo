// KiddoSheet — the canonical bottom-sheet / centered-modal primitive
// for the app. Replaces the ad-hoc modal patterns scattered across
// MemoryBook, Dashboard, Settings, GiftCheckout, etc.
//
// Why this exists: an audit on 2026-05-19 found roughly a dozen
// distinct modal implementations in the codebase, each making its
// own decisions about:
//   - Spring physics (some used `damping: 25, stiffness: 300`,
//     others used the SPRING_SHEET token (damping: 38, stiffness:
//     400), others used arbitrary durations)
//   - Close-button placement (top-right inside header vs top-right
//     floating absolute vs no close button)
//   - Header treatment (h2 vs h3 vs no header)
//   - Backdrop blur (some had blur(4px), others blur(6px), others
//     no blur)
//   - Sheet (bottom-up) vs Center (popover) vs Full-screen
//   - Footer button placement (sticky bottom vs inline scroll)
//
// Individually each worked; cumulatively the inconsistency added up
// to a "drifty" feel even for users who couldn't articulate why.
//
// This primitive encodes the locked conventions:
//   - Motion: SPRING_SHEET for sheet entry/exit (damping 38, stiffness
//     400); DUR_NORMAL + EASE_DECEL for centered modal scale-in.
//   - Backdrop: rgba(0,0,0,0.4) + backdrop-blur-sm.
//   - Close button: top-right, X icon, 32px touch target, muted.
//   - Header: sticky top, flex-shrink-0, h2 lg font-heading.
//   - Reduced-motion: opacity-only fade when prefers-reduced-motion.
//   - Body: scrollable inside flex-col so footer (if any) stays
//     pinned.
//
// API:
//   <KiddoSheet
//     open={open}
//     onClose={() => setOpen(false)}
//     title="Add memory"
//     mode="sheet"                  // "sheet" | "center"
//     maxWidth="md"                 // "sm" | "md" | "lg"
//     footer={<Button>Save</Button>} // optional sticky footer
//   >
//     {body content}
//   </KiddoSheet>
//
// Migration plan (NOT shipped in this commit, deliberate):
//   Phase 1 (this commit): introduce KiddoSheet, document conventions
//     in this file's header, no caller changes.
//   Phase 2 (next session): sweep highest-impact callers — Memory
//     Book composer (most-touched), Memory Book share-update sheet,
//     Dashboard recurring-contribution modal, Settings auth modals.
//   Phase 3: sweep remaining modals.
//
// Don't ship Phase 2 in the same commit as Phase 1 — landing the
// primitive without sweeping callers means existing modals continue
// to work unchanged. Phase 2 each call-site rewrite is bounded
// (drop in <KiddoSheet>, remove ad-hoc framer config).

import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import {
  DUR_FAST,
  DUR_NORMAL,
  EASE_DECEL,
  SPRING_SHEET,
} from "@/lib/motion";

export type KiddoSheetMode = "sheet" | "center";
export type KiddoSheetMaxWidth = "sm" | "md" | "lg";

interface KiddoSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  // sheet: slides up from the bottom on mobile, centers on desktop.
  //   Best default for any flow where the user is mid-task and the
  //   modal asks for more input (composers, pickers).
  // center: zooms in centered. Best for short confirmations + alerts.
  mode?: KiddoSheetMode;
  // sm = 24rem (auth forms, simple pickers)
  // md = 28rem / max-md (composer sheets — default)
  // lg = 32rem (rich content like Memory Book composer w/ media)
  maxWidth?: KiddoSheetMaxWidth;
  // Optional sticky footer rendered below the scrollable body. The
  // most common pattern: a primary action button. Footer renders
  // outside the body's overflow-y-auto so it always stays visible.
  footer?: ReactNode;
  // Body content. Scrolls if it exceeds the sheet's max-height.
  children: ReactNode;
  // data-testid override for the outer wrapper. Defaults to "kiddo-sheet".
  testId?: string;
  // aria-label for the close button when title is omitted. Defaults
  // to "Close".
  closeLabel?: string;
  // Hide the close button entirely (use sparingly — most flows want
  // an explicit exit). When true, the only way to dismiss is via
  // backdrop tap or programmatic onClose.
  hideClose?: boolean;
  // Lock body scroll while the sheet is open. Default true.
  lockBodyScroll?: boolean;
}

const MAX_WIDTH_CLASS: Record<KiddoSheetMaxWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function KiddoSheet({
  open,
  onClose,
  title,
  mode = "sheet",
  maxWidth = "md",
  footer,
  children,
  testId = "kiddo-sheet",
  closeLabel = "Close",
  hideClose = false,
  lockBodyScroll = true,
}: KiddoSheetProps) {
  const prefersReducedMotion = useReducedMotion();

  // Body-scroll lock while open. Necessary so the underlying page
  // doesn't scroll on iOS when the sheet is being swiped/tapped.
  // Pattern matches Memory Book's existing lightbox + composer body-
  // lock approach.
  useEffect(() => {
    if (!open || !lockBodyScroll || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lockBodyScroll]);

  // Escape-to-close. Standard modal hygiene.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Sheet (bottom-up on mobile, centered on desktop) uses SPRING_SHEET
  // with a y-translate. Centered (alert / confirmation) uses a scale+
  // opacity DUR_NORMAL EASE_DECEL — Apple-style modal entry.
  const sheetMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: DUR_FAST },
      }
    : mode === "sheet"
      ? {
          initial: { y: 100, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 100, opacity: 0 },
          transition: SPRING_SHEET,
        }
      : {
          initial: { scale: 0.96, opacity: 0, y: 8 },
          animate: { scale: 1, opacity: 1, y: 0 },
          exit: { scale: 0.97, opacity: 0, y: 4 },
          transition: { duration: DUR_NORMAL, ease: EASE_DECEL },
        };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-[60] flex ${mode === "sheet" ? "items-end sm:items-center" : "items-center"} justify-center`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR_FAST }}
          data-testid={testId}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-testid={`${testId}-overlay`}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? closeLabel}
            className={`relative w-full ${MAX_WIDTH_CLASS[maxWidth]} bg-card ${mode === "sheet" ? "rounded-t-3xl sm:rounded-2xl" : "rounded-2xl"} border border-border/50 shadow-premium-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]`}
            {...sheetMotion}
          >
            {/* Sticky header. flex-shrink-0 prevents it from collapsing
                under flex-col when the body grows. Omitted entirely
                when title is undefined AND hideClose is true. */}
            {(title || !hideClose) && (
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50 flex-shrink-0">
                {title ? (
                  <h2 className="text-lg font-heading font-semibold text-foreground" data-testid={`${testId}-title`}>
                    {title}
                  </h2>
                ) : (
                  <span aria-hidden />
                )}
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    data-testid={`${testId}-close`}
                    aria-label={closeLabel}
                  >
                    <X size={18} className="text-muted-foreground" />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable body. Grows to fill the sheet; scrolls when
                content exceeds available space. The sticky footer
                (if present) sits below this. */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
              {children}
            </div>

            {/* Sticky footer. Always visible regardless of body scroll
                position. Common pattern: primary action button (Save,
                Confirm, Send). flex-shrink-0 mirrors the header. */}
            {footer && (
              <div className="border-t border-border/50 p-4 sm:p-5 flex-shrink-0 bg-card">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
