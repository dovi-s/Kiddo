import { useEffect, useRef, useState } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import { MOTION_COUNT_UP_MS } from "@/lib/motion";

type UseCachedFirstNumberOptions = {
  seedValue: number | null | undefined;
  liveValue: number;
  duration?: number;
  minDelta?: number;
  // Hold at the seed/from value for this many ms before rolling. Used to
  // STAGGER a secondary number (e.g. the hero projection) so it rolls only
  // after the focal hero balance has settled, instead of both at once.
  startDelay?: number;
};

export function useCachedFirstNumber({
  seedValue,
  liveValue,
  duration = MOTION_COUNT_UP_MS,
  minDelta = 0.01,
  startDelay = 0,
}: UseCachedFirstNumberOptions) {
  const normalizedSeed = typeof seedValue === "number" && Number.isFinite(seedValue) ? seedValue : null;
  const [cachedValue, setCachedValue] = useState<number | null>(normalizedSeed);
  const [hasPainted, setHasPainted] = useState(false);

  useEffect(() => {
    setCachedValue(normalizedSeed);
  }, [normalizedSeed]);

  useEffect(() => {
    setHasPainted(false);
    if (typeof window === "undefined") return;
    let frameOne = 0;
    let frameTwo = 0;
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => setHasPainted(true));
    });
    return () => {
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
    };
  }, [normalizedSeed]);

  // Track the previous liveValue across polling ticks. Without this, every
  // new server update (a gift arriving, a price refresh) re-anchored the
  // count-up's "from" to the ORIGINAL session-start cachedValue — so the
  // displayed balance visually JUMPED BACK to the session-start value
  // before counting up to the new value. Reproducible bug from the user:
  // "very slow and jittery, I miss it each time." After this fix, the
  // count-up animates from where the user was just looking (previous live
  // value) to the new live value — smooth growth instead of a jump-back.
  const prevLiveRef = useRef<number>(liveValue);
  useEffect(() => {
    if (!hasPainted) {
      // Pre-paint: don't override the seed-driven cachedValue. The initial
      // count-up plays from cached seed → first liveValue and that's what
      // the user expects on cold mount (last known balance flashes, then
      // settles to current).
      prevLiveRef.current = liveValue;
      return;
    }
    if (liveValue !== prevLiveRef.current) {
      // Post-paint: a real in-session change. Anchor the next count-up to
      // where the user was JUST looking (previous live value), not the
      // session-start seed. Then update the ref so the next change anchors
      // to the value the user is about to see settle here.
      setCachedValue(prevLiveRef.current);
      prevLiveRef.current = liveValue;
    }
  }, [liveValue, hasPainted]);

  const delta = cachedValue !== null ? liveValue - cachedValue : 0;
  // Only animate UP - if the value went down, update silently so the user never
  // watches a number drop during the loading sequence.
  const shouldAnimate = hasPainted && cachedValue !== null && delta >= minDelta;
  const { value: animatedValue, isAnimating } = useCountUp({
    from: cachedValue ?? undefined,
    to: liveValue,
    duration,
    enabled: shouldAnimate,
    startDelay,
  });

  const displayValue = !hasPainted && cachedValue !== null
    ? cachedValue
    : shouldAnimate
      ? animatedValue
      : liveValue;

  return {
    displayValue,
    cachedValue,
    delta,
    hasPainted,
    isAnimating,
    shouldAnimate,
  };
}
