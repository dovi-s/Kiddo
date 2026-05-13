import { useEffect, useState } from "react";

// Smooth value-transition hook — animates the displayed number from its
// previous value to the new target with ease-out cubic. Used for the
// dashboard hero balance, projection sliders, anywhere a number changes
// and we want it to "find its home" rather than snap. Restraint matters:
// fires once per real value change, NEVER loops, never animates downward
// (the brand explicitly avoids gamification — losses are honest, not
// theatrical). The single-shot count-up on the way up is the Acorns
// /Robinhood /Cash App pattern that does work — it's a transition, not
// a celebration.
//
// `precision` controls how many decimal places the in-flight frames
// preserve. 0 = whole dollars (looks clean for hero balance even when the
// real value has cents — final frame snaps to exact target via the
// strict-equality early return). 2 = cent precision (use when the cents
// matter mid-animation, e.g. exact-amount displays).
//
// Honors prefers-reduced-motion: skips animation entirely and returns the
// target value immediately.
//
// Two call signatures supported:
//   useCountUp(target, duration?, precision?) → number          // legacy positional
//   useCountUp({ from?, to, duration?, enabled?, precision? }) → { value, isAnimating } // object-arg style used by useCachedFirstNumber
export type UseCountUpOptions = {
  from?: number;
  to: number;
  duration?: number;
  enabled?: boolean;
  precision?: number;
};

export type UseCountUpResult = { value: number; isAnimating: boolean };

// Overload signatures
export function useCountUp(target: number, duration?: number, precision?: number): number;
export function useCountUp(options: UseCountUpOptions): UseCountUpResult;
export function useCountUp(
  targetOrOptions: number | UseCountUpOptions,
  duration: number = 600,
  precision: number = 0,
): number | UseCountUpResult {
  const isObjectArg = typeof targetOrOptions === "object";
  const target = isObjectArg ? targetOrOptions.to : targetOrOptions;
  const fromOpt = isObjectArg ? targetOrOptions.from : undefined;
  const enabled = isObjectArg ? targetOrOptions.enabled !== false : true;
  const effectiveDuration = isObjectArg ? targetOrOptions.duration ?? 600 : duration;
  const effectivePrecision = isObjectArg ? targetOrOptions.precision ?? 0 : precision;

  const initial = fromOpt !== undefined && Number.isFinite(fromOpt) ? fromOpt : target;
  const [display, setDisplay] = useState(initial);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (!enabled) {
      setDisplay(target);
      setIsAnimating(false);
      return;
    }
    if (display === target) return;

    // Respect OS-level motion preference. No animation, just snap.
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplay(target);
      setIsAnimating(false);
      return;
    }

    const start = display;
    const delta = target - start;

    // Never animate downward — losses snap. Per brand: honest losses are
    // shown, not eased into. Only easing the "good direction" prevents the
    // animation from sugar-coating a bad day.
    if (delta < 0) {
      setDisplay(target);
      setIsAnimating(false);
      return;
    }

    const startedAt = performance.now();
    const factor = effectivePrecision > 0 ? Math.pow(10, effectivePrecision) : 1;
    setIsAnimating(true);

    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - startedAt) / effectiveDuration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const raw = start + delta * eased;
      const value = effectivePrecision > 0 ? Math.round(raw * factor) / factor : Math.round(raw);
      setDisplay(value);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(target); // ensure final frame lands exactly on target
        setIsAnimating(false);
      }
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, effectiveDuration, effectivePrecision, enabled]);

  if (isObjectArg) {
    return { value: display, isAnimating };
  }
  return display;
}
