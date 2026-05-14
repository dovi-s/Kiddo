// Params that represent one-shot deep-link targets: stripping them on a
// "fresh landing" tap is intentional. Things like ?fund=, ?tab=, etc. are
// load-bearing user state and must be preserved.
import { useLayoutEffect } from "react";
import { DEEP_LINK_PARAMS } from "./deep-link-highlight";
const CONSUMED_DEEP_LINK_PARAMS = DEEP_LINK_PARAMS;

// Tap-active-nav handler — when a user taps the nav item for the page they're
// already on, scroll smoothly to top AND drop any consumed deep-link params
// (?gift=, ?gifter=, ?highlight=, ?anchor=, ?scrollTo=) plus any URL hash so
// the page reads as "fresh landing." Matches the iOS / Twitter / Instagram
// pattern where tapping the same tab again resets the view. Preserves
// load-bearing params like ?fund= (fund picker) and ?filter= (page filter).
//
// Returns true if it handled the click (caller should preventDefault), false
// if the caller should let normal navigation proceed.
export function tapActiveNavScrollToTop(
  isActive: boolean,
  href: string,
  setLocation: (path: string) => void,
): boolean {
  if (!isActive) return false;
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Build a "cleaned" URL with consumed deep-link params removed but
  // anything else preserved. Only navigate if the cleaned URL differs from
  // the current one — avoids a useless pushState.
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const param of CONSUMED_DEEP_LINK_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    if (url.hash) {
      url.hash = "";
      changed = true;
    }
    if (changed) {
      const search = url.searchParams.toString();
      setLocation(`${url.pathname}${search ? `?${search}` : ""}`);
    }
  } catch {
    // best-effort; if URL parsing somehow fails, the smooth scroll above
    // still ran and the click is consumed.
  }
  return true;
}

// Robust "scroll to a row by data-testid" used by every deep-link landing
// (Memory Book ?gift=, Activity ?highlight=, etc).
//
// Why this exists: a one-shot requestAnimationFrame + querySelector pattern
// fails silently when the target row hasn't rendered yet (data still loading,
// virtualization hasn't expanded, lazy chunk still mounting). We poll for the
// element with short attempts so the scroll fires the moment the row exists.
//
// Returns a cancel function so the caller can abort if the user navigates away.

export type ScrollToOpts = {
  /** ms between attempts. 60ms ≈ 4 frames. */
  intervalMs?: number;
  /** absolute cap on attempts. 100 * 60ms = 6s — long enough for slow first network fetch + render of 100+ entries, short enough to give up before the user thinks the page is broken. */
  maxAttempts?: number;
  /** scroll alignment, defaults to "center". */
  block?: ScrollLogicalPosition;
  /** called once, when the element is found (or never if it never appears). */
  onFound?: (el: HTMLElement) => void;
  /** called if we run out of attempts. Useful for analytics / fallback UX. */
  onMissed?: () => void;
};

export function scrollToTestId(
  testId: string,
  opts: ScrollToOpts = {},
): () => void {
  const {
    intervalMs = 60,
    maxAttempts = 100,
    block = "center",
    onFound,
    onMissed,
  } = opts;

  let attempts = 0;
  let cancelled = false;
  let timer: number | null = null;

  const tick = () => {
    if (cancelled) return;
    const el = document.querySelector(`[data-testid="${CSS.escape(testId)}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block });
      onFound?.(el);
      return;
    }
    if (++attempts >= maxAttempts) {
      onMissed?.();
      return;
    }
    timer = window.setTimeout(tick, intervalMs);
  };

  // Kick off after one frame so we don't fight a render React just queued.
  const raf = window.requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(raf);
    if (timer != null) window.clearTimeout(timer);
  };
}

// Imperative "reset window scroll to top" — same three-phase reset the
// global ScrollToTop component does on URL change. Use this in multi-
// step state-driven flows (GetStarted, Age18Welcome, EventCreate, etc.)
// where step transitions happen via React state, not URL navigation —
// so the global ScrollToTop never fires and the user stays scrolled at
// their previous step's position.
//
// Three-phase reset defeats both the AnimatePresence wait-mode delay
// and any post-mount layout shift on the next step's content:
//   1) immediate → resets while the current frame is still mounted
//   2) rAF → resets right after browser paints the transition
//   3) post-transition timeout → catches the moment the new step
//      actually swaps in
//
// Some Safari versions need both html.scrollTop and body.scrollTop set
// independently when the layout viewport disagrees with the visual one.
export function scrollWindowToTop(): void {
  if (typeof window === "undefined") return;
  const reset = () => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };
  reset();
  window.requestAnimationFrame(reset);
  window.setTimeout(reset, 140);
  // No cleanup needed — by the time the next step transition fires
  // this helper, the previous timers have already done their work or
  // harmlessly fired against a window that's still at top.
}

// React hook variant — pass a dependency that changes on step transition,
// and the window scrolls to top whenever that dep changes. Mounted once
// per multi-step page; no need to remember to call scrollWindowToTop()
// in each individual setStep / moveToStep handler.
//
// Skips the very first render (initial mount) so the page lands at top
// naturally without an extra reset cycle. Only fires on actual changes.
export function useScrollResetOnChange(dep: unknown): void {
  useLayoutEffect(() => {
    scrollWindowToTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}

/**
 * Try multiple test-id patterns in order. First one that resolves wins. Same
 * polling shape as scrollToTestId — useful for pages that render the same
 * domain object under different test-id prefixes per tab (Activity does this:
 * scheduled-contrib-X / activity-card-X / pending-row-X).
 */
export function scrollToFirstMatchingTestId(
  testIds: string[],
  opts: ScrollToOpts = {},
): () => void {
  const {
    intervalMs = 60,
    maxAttempts = 100,
    block = "center",
    onFound,
    onMissed,
  } = opts;

  let attempts = 0;
  let cancelled = false;
  let timer: number | null = null;

  const tick = () => {
    if (cancelled) return;
    for (const id of testIds) {
      const el = document.querySelector(`[data-testid="${CSS.escape(id)}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block });
        onFound?.(el);
        return;
      }
    }
    if (++attempts >= maxAttempts) {
      onMissed?.();
      return;
    }
    timer = window.setTimeout(tick, intervalMs);
  };

  const raf = window.requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(raf);
    if (timer != null) window.clearTimeout(timer);
  };
}
