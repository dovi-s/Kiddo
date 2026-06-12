import { useEffect, useRef, useState } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import { MOTION_COUNT_UP_MS } from "@/lib/motion";

// A number that rolls up ONCE PER KEY — the first time each fund/kid is shown —
// from a prior "from" value up to the live value (the Acorns "here's what
// changed" moment). After a key has rolled, that key just TRACKS live (snap):
// switching BACK to a kid you've already seen, background polls, a gift landing
// while you watch — all snap, never re-roll. With no `rollKey` it's once-per-mount.
//
// Why per-key with a completion lock: a fund switch isn't atomic — the id
// changes and the new fund's value loads async — so a naive "snap on switch"
// races the data, and a per-render seed (the demo's synthetic prior) re-applies
// and re-rolls every settle. Locking each key AFTER its first roll completes
// removes that whole class of bug deterministically, while still letting each
// NEW kid roll exactly once.
type UseCachedFirstNumberOptions = {
  seedValue: number | null | undefined;
  liveValue: number;
  duration?: number;
  minDelta?: number;
  // Hold at the "from" value this many ms before rolling — used to STAGGER a
  // secondary number (e.g. the hero projection) after the focal balance settles.
  startDelay?: number;
  // Roll once per DISTINCT value of this key (e.g. the active fund id): each kid
  // rolls the first time it's shown and snaps on every later return. Omit to roll
  // once per mount.
  rollKey?: string | number;
};

export function useCachedFirstNumber({
  seedValue,
  liveValue,
  duration = MOTION_COUNT_UP_MS,
  minDelta = 0.01,
  startDelay = 0,
  rollKey,
}: UseCachedFirstNumberOptions) {
  const normalizedSeed =
    typeof seedValue === "number" && Number.isFinite(seedValue) ? seedValue : null;

  // The identity we lock per-roll. A stable sentinel when no rollKey is given, so
  // once-per-mount falls out of the same machinery.
  const keyFor = rollKey ?? "__mount__";

  // Keys whose cold-load roll has completed → they snap from now on. A ref (not
  // state) so reads are current mid-render; the setAnchor(live) at lock time
  // forces the re-render that makes the lock visible.
  const lockedKeysRef = useRef<Set<string | number>>(new Set());
  const isLocked = lockedKeysRef.current.has(keyFor);

  // `anchor` = the value the count-up rolls FROM (the seed while a key rolls;
  // live once that key is locked).
  const [anchor, setAnchor] = useState<number | null>(normalizedSeed);

  // Two-frame paint gate so the count-up shows one frame AT the anchor before the
  // live target (or the browser coalesces from→to and the roll is never seen).
  // Re-arms while the seed resolves for the CURRENT key's first roll; NEVER for a
  // locked key — so returning to a kid you've already seen can't resurrect a
  // roll. Also resets the per-roll "did it run" flag so each new key rolls fresh.
  const [painted, setPainted] = useState(false);
  const rollRanRef = useRef(false);
  useEffect(() => {
    if (isLocked) return;
    rollRanRef.current = false;
    setPainted(false);
    if (typeof window === "undefined") return;
    let frameOne = 0;
    let frameTwo = 0;
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => setPainted(true));
    });
    return () => {
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
    };
  }, [normalizedSeed, keyFor, isLocked]);

  // Locked key: anchor follows live (snap). Otherwise pre-paint: anchor follows
  // the seed (the roll's FROM).
  useEffect(() => {
    if (isLocked) {
      setAnchor(liveValue);
      return;
    }
    if (painted) return;
    setAnchor(normalizedSeed);
  }, [normalizedSeed, liveValue, painted, keyFor, isLocked]);

  // Roll decision — from PROPS (not the one-render-lagging anchor) so it can't
  // flicker false→true and trip the lock early. Only UP, past minDelta, unlocked.
  const coldDelta = normalizedSeed !== null ? liveValue - normalizedSeed : 0;
  const rollingColdLoad =
    !isLocked && painted && normalizedSeed !== null && liveValue > 0 && coldDelta >= minDelta;

  const { value: animatedValue, isAnimating, isRolling } = useCountUp({
    from: anchor ?? undefined,
    to: liveValue,
    duration,
    enabled: rollingColdLoad,
    startDelay,
  });

  // Lock the CURRENT key ONLY after its actual CLIMB has run and finished
  // (`isRolling` true → false). Crucially we key off `isRolling`, NOT
  // `isAnimating`: `isAnimating` is true across the whole beat INCLUDING the
  // startDelay linger, and it's noisy during the cold-load settle (it toggles as
  // the effect re-runs while seed/live stabilize) — locking off it froze the fund
  // mid-linger before the climb ever started (the observed "it just snaps" bug).
  // `isRolling` is true ONLY during the real rAF climb, so the lock can't fire
  // until a genuine roll has actually played. A fund that needs no roll has
  // delta < minDelta, so it never climbs and never locks — it simply shows live.
  // Only real climbs lock, which is what prevents a re-roll when you switch back
  // to a kid you've already seen.
  useEffect(() => {
    if (isLocked) return;
    if (isRolling) {
      rollRanRef.current = true;
      return;
    }
    if (rollRanRef.current) {
      lockedKeysRef.current.add(keyFor);
      setAnchor(liveValue);
    }
  }, [isRolling, keyFor, isLocked]);

  const displayValue =
    !painted && anchor !== null ? anchor : rollingColdLoad ? animatedValue : liveValue;

  return {
    displayValue,
    cachedValue: anchor,
    delta: coldDelta,
    hasPainted: painted,
    isAnimating,
    // True only while the number is ACTIVELY climbing (not during the startDelay
    // linger) — use for "warm the number while it moves" cues.
    isRolling,
    shouldAnimate: rollingColdLoad,
  };
}
