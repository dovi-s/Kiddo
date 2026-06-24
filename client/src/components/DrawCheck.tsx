import { motion, useReducedMotion } from "framer-motion";
import { MOTION_EASE } from "@/lib/motion";

// ─────────────────────────────────────────────────────────────────────────────
// DrawCheck — a success checkmark that DRAWS ITSELF (the ring traces on, then
// the check follows), the way Acorns rewards an interaction. Reserved for rare,
// meaningful peaks (a gift sent / contribution confirmed) — not everyday chrome —
// so it stays special. Uses the same framer `pathLength` draw the marketing
// loop diagram already proved.
//
//   • Reduced-motion safe — renders fully formed, no draw.
//   • `currentColor` for stroke — the parent sets the color (evergreen success).
//   • `play` gates the draw (default true; set false to hold it formed).
// ─────────────────────────────────────────────────────────────────────────────

export function DrawCheck({
  size = 64,
  className,
  play = true,
  strokeWidth = 2.5,
  onDone,
}: {
  size?: number;
  className?: string;
  play?: boolean;
  strokeWidth?: number;
  onDone?: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const draw = play && !prefersReducedMotion;

  const ring = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration: 0.5, ease: MOTION_EASE.outExpo },
        opacity: { duration: 0.08 },
      },
    },
  };
  // The check starts as the ring is ~2/3 drawn — overlapping reads as one
  // continuous gesture rather than two separate strokes.
  const check = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration: 0.32, ease: MOTION_EASE.outExpo, delay: 0.34 },
        opacity: { duration: 0.08, delay: 0.34 },
      },
    },
  };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      className={className}
      initial={draw ? "hidden" : "visible"}
      animate="visible"
      // a whisper of a settle-pop as it lands — the "it's done" beat
      {...(draw
        ? {
            // svg-level scale via style-transform-safe props
            style: { transformOrigin: "center" },
          }
        : {})}
      onAnimationComplete={onDone}
      aria-hidden="true"
    >
      <motion.circle
        cx="26"
        cy="26"
        r="23"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        variants={ring}
      />
      <motion.path
        d="M16 26.5 L23 33.5 L37 18.5"
        stroke="currentColor"
        strokeWidth={strokeWidth + 0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        variants={check}
      />
    </motion.svg>
  );
}
