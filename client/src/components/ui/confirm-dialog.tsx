// ConfirmDialog — a small, on-brand replacement for window.confirm.
//
// The app's real modal language is the warm cream card/sheet (see the invest
// editor, CreateEventSheet, the action sheets), NOT the OS-native confirm box.
// Native window.confirm is jarring — different font, different chrome, breaks
// the standalone-PWA feel, and can't say WHAT is about to happen with any care.
// This gives destructive / consequential actions a confirm that matches the
// rest of the app: cream card, brand buttons, haptics, focus-safe, esc/backdrop
// to dismiss. Driven by simple state on the caller (no context/provider needed).
//
// Usage:
//   const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
//   ...onClick={() => setConfirm({ title, body, confirmLabel, destructive, onConfirm })}
//   <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptics";

export type ConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const open = !!request;

  // Esc to dismiss — parity with the native confirm's keyboard behavior.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && request && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-5"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            role="alertdialog"
            aria-modal="true"
            aria-label={request.title}
            className="w-full max-w-[340px] rounded-3xl p-6"
            style={{ background: "hsl(var(--kiddo-cream))", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.35)" }}
          >
            <h2 className="font-heading text-lg font-bold text-foreground">{request.title}</h2>
            {request.body ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{request.body}</p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => { haptic(request.destructive ? "warning" : "selection"); request.onConfirm(); onClose(); }}
                className="kiddo-press w-full rounded-full py-3 text-sm font-bold text-white"
                style={{ background: request.destructive ? "rgb(170,38,38)" : "hsl(var(--kiddo-evergreen))" }}
                data-testid="confirm-dialog-confirm"
              >
                {request.confirmLabel || "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => { haptic("selection"); onClose(); }}
                className="kiddo-press w-full rounded-full py-3 text-sm font-semibold text-foreground/70"
                data-testid="confirm-dialog-cancel"
              >
                {request.cancelLabel || "Never mind"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
