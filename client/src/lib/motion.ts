// JS-side motion tokens — the bridge between CSS variables (which can't be
// read from JS) and framer-motion / inline `transition: {...}` values.
//
// Use these instead of inline `duration: 0.2`. Picking from this map keeps
// perceived speed consistent across surfaces — mid-tier apps drift into
// 4-5 different durations on the same page; premium apps hold to 2-3.
//
// Mirrors the CSS `--duration-*` and `--ease-*` tokens in client/src/index.css.
// If you change a value here, change it there too.
//
// Rule of thumb:
//   • Enter / arrive   → easeOut    (decelerates; lands gently)
//   • Exit / dismiss   → easeIn     (accelerates; gets out of the way)
//   • Bounce / playful → easeOutBack (sparingly — celebration moments)
//   • > 300ms          → reconsider; users start feeling the lag

/** Animation durations in seconds (framer-motion's preferred unit). */
export const MOTION_DURATION = {
  /** 100ms — exits, dismissals, micro-feedback. Out-of-the-way fast. */
  instant: 0.10,
  /** 150ms — hover states, button presses, icon swaps. Default for most UI. */
  fast: 0.15,
  /** 180ms — route entries, focused arrivals. The "deliberate" arrival pace. */
  routeEnter: 0.18,
  /** 200ms — card lifts, modal open, drawer reveal. */
  normal: 0.20,
  /** 280ms — page-level entrances, heavy reveals. Maximum before lag-feel. */
  slow: 0.28,
} as const;

/** Cubic-bezier easing curves. Same shapes as the --ease-* CSS variables. */
export const MOTION_EASE = {
  /** Apple's default: fast start, gentle settle. Use for entrances. */
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Accelerates as it leaves. Use for exits. */
  inQuad: [0.4, 0, 1, 1] as [number, number, number, number],
  /** Slight overshoot — playful. Reserved for celebration moments. */
  outBack: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  /** Bigger overshoot — use VERY sparingly (toast pops, success haptic). */
  spring: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
} as const;

/** Composed presets — the most-used combinations as one-liners. */
export const MOTION = {
  /** Standard arrival animation. */
  enter: { duration: MOTION_DURATION.routeEnter, ease: MOTION_EASE.outExpo },
  /** Standard dismissal animation. */
  exit: { duration: MOTION_DURATION.instant, ease: MOTION_EASE.inQuad },
  /** Quick hover/press transition. */
  fast: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.outExpo },
  /** Modal/drawer open. */
  modal: { duration: MOTION_DURATION.normal, ease: MOTION_EASE.outExpo },
} as const;
