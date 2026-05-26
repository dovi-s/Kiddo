// MomentParticles — soft, calm celebration motion for "this matters"
// product moments. Locked 2026-05-26 alongside the Age18Welcome
// climax upgrade. Reusable across:
//
//   - Age18Welcome Screen 1 (handoff moment — "this is yours now")
//   - First-gift ceremony on Dashboard (the parent's first-gift beat)
//   - Future milestone celebrations (first $1K, year-one anniversary,
//     compound-doubled — see the polish backlog 10-tier moments list)
//
// Design discipline (intentionally different from typical confetti):
//   - Particles DRIFT UP, not fall down. Birthday-party confetti
//     falls; growth-product moments rise.
//   - Soft pastel palette (evergreen, warm gold, cream, dusty rose) —
//     no neon, no rainbow, no noise. Matches the locked calm
//     register.
//   - Particles are small dots (3-5px), not paper rectangles or
//     emoji. Restraint over festivity.
//   - Plays ONCE on mount, no loop, no replay. Confetti loops are
//     ad-tech tells; ours is a single moment of arrival.
//   - Total duration ~2.5s. After that the particles are gone and
//     the surface returns to product-register calm.
//   - Respects prefers-reduced-motion: zero particles render if the
//     user has reduced motion enabled. The static composition still
//     works.
//   - Particles are absolutely positioned within their parent, so
//     the consumer wraps it in a `relative` container.

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  // Number of particles to emit. Default 14 — enough to feel
  // alive, sparse enough to stay calm. 6-8 for a more restrained
  // beat, 18-24 for a bigger moment.
  count?: number;
  // Duration of each particle's life in ms. Default 2200.
  durationMs?: number;
  // Optional delay before the burst starts (ms). Useful when
  // there's a hero animation that should play first.
  startDelayMs?: number;
  // Color palette override. Defaults to the locked calm register
  // tones. Pass shorter array for monochrome moments.
  colors?: string[];
}

const DEFAULT_COLORS = [
  "hsl(var(--kiddo-evergreen))",
  "hsl(var(--kiddo-gold))",
  "hsl(43, 65%, 55%)",   // warm amber
  "hsl(20, 55%, 75%)",   // dusty rose
  "hsl(var(--kiddo-cream-deep, 35 25% 88%))",
];

export function MomentParticles({
  count = 14,
  durationMs = 2200,
  startDelayMs = 0,
  colors = DEFAULT_COLORS,
}: Props) {
  const reduce = useReducedMotion();

  // Generate particle data once on mount — fixed positions and
  // timings make the animation feel composed rather than random
  // noise. Each particle gets a stable seed so the React render
  // doesn't shuffle on every parent re-render.
  const particles = useMemo(() => {
    if (reduce) return [];
    return Array.from({ length: count }, (_, i) => {
      // Spread across the horizontal span, with light random
      // jitter so they don't form a perfect grid.
      const xStartPct = ((i + 0.5) / count) * 100 + (Math.random() - 0.5) * 6;
      // Each particle gets a randomized stagger within the first
      // 35% of the duration so they don't all fire simultaneously.
      const delayMs = (Math.random() * durationMs * 0.35) + startDelayMs;
      // Vertical drift distance — between 60% and 95% of container.
      const driftPct = 60 + Math.random() * 35;
      // Slight horizontal drift to feel natural (a gentle current,
      // not a straight-up rocket).
      const drift = (Math.random() - 0.5) * 20;
      const size = 3 + Math.random() * 3.5;
      const color = colors[i % colors.length];
      const rotateAmt = (Math.random() - 0.5) * 180;
      return {
        id: i,
        xStartPct,
        delayMs,
        driftPct,
        drift,
        size,
        color,
        rotateAmt,
      };
    });
  }, [count, durationMs, startDelayMs, reduce, colors]);

  if (reduce || particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-testid="moment-particles"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{
            opacity: 0,
            x: 0,
            y: "100%",
            scale: 0.6,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: p.drift,
            y: `${-p.driftPct}%`,
            scale: [0.6, 1, 1, 0.85],
            rotate: p.rotateAmt,
          }}
          transition={{
            duration: durationMs / 1000,
            delay: p.delayMs / 1000,
            ease: "easeOut",
            times: [0, 0.18, 0.78, 1],
          }}
          style={{
            position: "absolute",
            left: `${p.xStartPct}%`,
            bottom: 0,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}55`,
          }}
        />
      ))}
    </div>
  );
}
