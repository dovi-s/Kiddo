import { useEffect } from "react";

/**
 * Browser-level "Leave without saving?" guard. While `dirty` is true, a tab
 * close / refresh / browser-back fires the native `beforeunload` confirm so a
 * staged-but-unsaved change (e.g. a picked-but-not-saved investment strategy)
 * isn't lost by accident.
 *
 * Scope note: this guards BROWSER leaves (close/refresh/back/forward). It does
 * NOT block in-app SPA navigation (wouter has no navigation-block primitive),
 * and the staged changes this protects are re-selectable in one tap — so this
 * deliberately covers the genuine accidental-leave cases without nagging on
 * every in-app tab switch. Typed-content surfaces that CAN'T be cheaply redone
 * (e.g. the sealed-letter editor) carry their own in-app discard-confirm.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // returnValue must be a NON-EMPTY (truthy) string — an empty string is
      // falsy and some browsers then skip the prompt. The text is ignored by
      // modern browsers (they show a generic message); only its presence matters.
      // NOTE: iOS Safari ignores beforeunload entirely (Apple disabled it), so
      // this is a no-op on iPhone/iPad — it only guards desktop browsers.
      e.returnValue = "You have unsaved changes.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
