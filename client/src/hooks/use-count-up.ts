import { useEffect, useState } from "react";
import { MOTION_COUNT_UP_MS } from "@/lib/motion";

// Default climb easing: ease-out cubic ("find its home" deceleration).
const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);

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
  // Hold at `from` for this many ms BEFORE the roll begins. Lets a secondary
  // number STAGGER after a focal one (e.g. the projection rolling only after
  // the hero balance has settled) instead of both animating at once and
  // splitting the eye. Default 0 = roll immediately.
  startDelay?: number;
  // Easing applied to climb progress t∈[0,1]. Default ease-out cubic. Pass a
  // stronger curve (e.g. ease-out quart) for a slower, more pronounced settle at
  // the very end — useful when finer digits (cents) should land last.
  easing?: (t: number) => number;
};

export type UseCountUpResult = { value: number; isAnimating: boolean; isRolling: boolean };

// Overload signatures
export function useCountUp(target: number, duration?: number, precision?: number): number;
export function useCountUp(options: UseCountUpOptions): UseCountUpResult;
export function useCountUp(
  targetOrOptions: number | UseCountUpOptions,
  duration: number = MOTION_COUNT_UP_MS,
  precision: number = 0,
): number | UseCountUpResult {
  const isObjectArg = typeof targetOrOptions === "object";
  const target = isObjectArg ? targetOrOptions.to : targetOrOptions;
  const fromOpt = isObjectArg ? targetOrOptions.from : undefined;
  const enabled = isObjectArg ? targetOrOptions.enabled !== false : true;
  const effectiveDuration = isObjectArg ? targetOrOptions.duration ?? MOTION_COUNT_UP_MS : duration;
  const effectivePrecision = isObjectArg ? targetOrOptions.precision ?? 0 : precision;
  const effectiveStartDelay = isObjectArg ? targetOrOptions.startDelay ?? 0 : 0;
  const effectiveEasing = isObjectArg ? targetOrOptions.easing ?? EASE_OUT_CUBIC : EASE_OUT_CUBIC;

  const initial = fromOpt !== undefined && Number.isFinite(fromOpt) ? fromOpt : target;
  const [display, setDisplay] = useState(initial);
  // `isAnimating` = the whole beat is in progress, INCLUDING the startDelay hold
  // (drives aria-live="off" so a screen reader doesn't read intermediate frames).
  // `isRolling` = the number is ACTIVELY climbing right now — true only during
  // the rAF loop, false during the linger/hold. Use this for "warm the number
  // while it moves" visual cues so the static old number doesn't pre-light.
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const hasFrom = fromOpt !== undefined && Number.isFinite(fromOpt);

    if (!enabled) {
      // Gated (roll not permitted yet) or a settled value. If a roll is PENDING
      // — we hold a `from` anchor BELOW the live target — sit at the anchor so we
      // don't snap to the target and turn the upcoming roll into a no-op (the bug
      // that ate the cold-load roll: `display` pre-snapped to target, then the
      // enabled run early-returned because display === target). Otherwise (no
      // anchor, or a down / no-op move) snap straight to the target.
      setDisplay(hasFrom && (fromOpt as number) < target ? (fromOpt as number) : target);
      setIsAnimating(false);
      setIsRolling(false);
      return;
    }

    // The roll ALWAYS starts from the explicit `from` anchor when provided —
    // never from the current `display`, which may have been pre-snapped to the
    // target while the roll was gated. Legacy positional callers pass no `from`
    // and keep rolling from wherever the number currently sits.
    const start = hasFrom ? (fromOpt as number) : display;
    if (start === target) return;

    // Respect OS-level motion preference. No animation, just snap.
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplay(target);
      setIsAnimating(false);
      setIsRolling(false);
      return;
    }

    const delta = target - start;

    // Never animate downward — losses snap. Per brand: honest losses are
    // shown, not eased into. Only easing the "good direction" prevents the
    // animation from sugar-coating a bad day.
    if (delta < 0) {
      setDisplay(target);
      setIsAnimating(false);
      setIsRolling(false);
      return;
    }

    const factor = effectivePrecision > 0 ? Math.pow(10, effectivePrecision) : 1;
    setDisplay(start); // anchor the first visible frame at `from` so the climb begins there
    setIsAnimating(true);
    setIsRolling(false); // linger/hold phase: the beat has begun but isn't climbing yet

    let frame = 0;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    const runRoll = () => {
      setIsRolling(true); // the actual climb starts now (after any startDelay)
      const startedAt = performance.now();
      frame = requestAnimationFrame(function tick(now) {
        const t = Math.min(1, (now - startedAt) / effectiveDuration);
        const eased = effectiveEasing(t); // default ease-out cubic; caller may override
        const raw = start + delta * eased;
        const value = effectivePrecision > 0 ? Math.round(raw * factor) / factor : Math.round(raw);
        setDisplay(value);
        if (t < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          setDisplay(target); // ensure final frame lands exactly on target
          setIsAnimating(false);
          setIsRolling(false);
        }
      });
    };

    if (effectiveStartDelay > 0) {
      // Hold at `start` (the `from` value) through the delay, then roll — so a
      // secondary number can follow the focal one in sequence rather than
      // competing for the eye. isAnimating stays true across the wait so
      // consumers treat the whole beat as in-progress.
      delayTimer = setTimeout(runRoll, effectiveStartDelay);
    } else {
      runRoll();
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, effectiveDuration, effectivePrecision, enabled, effectiveStartDelay, fromOpt]);

  if (isObjectArg) {
    return { value: display, isAnimating, isRolling };
  }
  return display;
}
