import { motion, useReducedMotion } from "framer-motion";
import { easeOutExpo, easeOutBack } from "@/lib/animations";

/**
 * The Generational Loop — Parent → Kid → Adult → back to Parent.
 *
 * Investor / business-plan surface. NOT the fast gifter-loop (k-factor) — this
 * is the slow lifecycle loop: the structural answer to "isn't this a kids' app
 * that ages out of its market?" The market doesn't age out; it loops back into
 * itself. Drawn as structure, never claimed as proven (honesty = the moat).
 *
 * Geometry: three nodes 120° apart on a ring (centre 220,220 · R 132). Arcs run
 * clockwise with ~22.5° insets so each arrow nearly touches its nodes (~6px gap)
 * and reads as connecting them, not floating between them. Arc caps are BUTT,
 * not round: a round cap pokes half a stroke-width past the arrowhead vertex and
 * shows as a stub the gold head can't cover. One gold accent (the arrowheads)
 * against evergreen — restraint over rainbow.
 */

const EVER = "#1B3A2D";
const GOLD = "#C5821E";
const GOLDINK = "#6F4611";
const MUTED = "#5C655F";

// role nodes: centre coords, label, and a plain one-line descriptor
const NODES = [
  { id: "parent", cx: 220, cy: 88, label: "Parent", desc: "starts the fund", descY: 152, delay: 0.05 },
  { id: "kid", cx: 334, cy: 286, label: "Kid", desc: "watches it grow", descY: 350, delay: 0.8 },
  { id: "adult", cx: 106, cy: 286, label: "Adult", desc: "it becomes theirs", descY: 350, delay: 1.4 },
] as const;

// arcs: path, start (sx,sy) → arrowhead (hx,hy) for the gradient, tangent
// rotation, caption, timing. Each stroke warms evergreen → gold toward its
// handoff, so the line and its arrowhead read as one gesture.
//
// Choreography: the whole loop draws FIRST (nodes pop, arcs draw, arrowheads
// land), then all three captions settle onto the finished diagram together
// (capDelay > last headDelay + head duration). A label never floats next to a
// half-built diagram, and the captions render last so they're always on top.
// Captions sit just OUTSIDE the ring at each arc's midpoint (radial-out), so the
// interior stays open and the bottom third stops competing with the descriptors.
const ARCS = [
  { id: "g1", d: "M270.5 98 A132 132 0 0 1 351 237", sx: 270.5, sy: 98, hx: 351, hy: 237, rot: 97.5, cap: "the gift", capX: 366, capY: 140, arcDelay: 0.25, headDelay: 0.9, capDelay: 2.55 },
  { id: "g2", d: "M300 325 A132 132 0 0 1 140 325", sx: 300, sy: 325, hx: 140, hy: 325, rot: 217.5, cap: "the handoff", capX: 220, capY: 398, arcDelay: 0.9, headDelay: 1.55, capDelay: 2.63 },
  { id: "g3", d: "M89 237 A132 132 0 0 1 170 98", sx: 89, sy: 237, hx: 170, hy: 98, rot: -22.5, cap: "the return", capX: 74, capY: 140, arcDelay: 1.55, headDelay: 2.2, capDelay: 2.71 },
] as const;

export default function GenerationalLoopDiagram({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // collapse all sequencing to an instant final frame for reduced-motion
  const ease = (delay: number, duration: number) =>
    reduce ? { duration: 0 } : { delay, duration, ease: easeOutExpo };

  return (
    <motion.svg
      viewBox="0 0 440 450"
      className={className}
      role="img"
      aria-label="The generational loop: a parent starts a fund, the kid watches it grow, at eighteen it becomes theirs, and as an adult they start one for their own child, so the loop repeats."
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
    >
      <defs>
        <filter id="loop-node-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor={EVER} floodOpacity="0.14" />
        </filter>
        {ARCS.map((a) => (
          <linearGradient key={a.id} id={`loop-${a.id}`} gradientUnits="userSpaceOnUse" x1={a.sx} y1={a.sy} x2={a.hx} y2={a.hy}>
            <stop offset="0" stopColor={EVER} />
            <stop offset="0.62" stopColor={EVER} />
            <stop offset="1" stopColor={GOLD} />
          </linearGradient>
        ))}
      </defs>

      {/* faint guide ring — the quiet "on repeat" hint, very slow rotation */}
      <motion.circle
        cx={220}
        cy={220}
        r={132}
        fill="none"
        stroke={EVER}
        strokeOpacity={0.09}
        strokeWidth={1}
        strokeDasharray="2 9"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 70, ease: "linear", repeat: Infinity }}
      />

      {/* arcs */}
      {ARCS.map((a) => (
        <motion.path
          key={a.d}
          d={a.d}
          fill="none"
          stroke={`url(#loop-${a.id})`}
          strokeWidth={2.5}
          strokeLinecap="butt"
          variants={{
            hidden: { pathLength: reduce ? 1 : 0, opacity: reduce ? 0.85 : 0 },
            visible: {
              pathLength: 1,
              opacity: 0.85,
              transition: { pathLength: ease(a.arcDelay, 0.6), opacity: ease(a.arcDelay, 0.25) },
            },
          }}
        />
      ))}

      {/* arrowheads — the single gold accent, arriving as each arc lands.
          Positioning lives on a static <g> (SVG transform attribute); the inner
          motion.path animates only scale + opacity, so framer's CSS transform
          never fights the translate/rotate. */}
      {ARCS.map((a) => (
        <g key={`h-${a.d}`} transform={`translate(${a.hx} ${a.hy}) rotate(${a.rot})`}>
          <motion.path
            d="M -11 -8.5 L 0 0 L -11 8.5"
            fill="none"
            stroke={GOLD}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { opacity: 0, scale: reduce ? 1 : 0.4 },
              visible: { opacity: 1, scale: 1, transition: reduce ? { duration: 0 } : { delay: a.headDelay, duration: 0.3, ease: easeOutBack } },
            }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        </g>
      ))}

      {/* nodes */}
      {NODES.map((n) => (
        <motion.g
          key={n.id}
          variants={{
            hidden: { opacity: 0, scale: reduce ? 1 : 0.6 },
            visible: { opacity: 1, scale: 1, transition: reduce ? { duration: 0 } : { delay: n.delay, duration: 0.5, ease: easeOutExpo } },
          }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <circle cx={n.cx} cy={n.cy} r={46} fill="#FFFFFF" stroke={EVER} strokeOpacity={0.16} strokeWidth={1.25} filter="url(#loop-node-shadow)" />
          <text x={n.cx} y={n.cy} textAnchor="middle" dominantBaseline="central" className="font-serif" fontSize={19} fontWeight={600} fill={EVER}>
            {n.label}
          </text>
          <text x={n.cx} y={n.descY} textAnchor="middle" className="font-sans" fontSize={11.5} fill={MUTED}>
            {n.desc}
          </text>
        </motion.g>
      ))}

      {/* arc captions — rendered LAST (always on top) and revealed only after the
          loop has finished drawing, so a label never floats by a half-built
          diagram or sits behind a node. */}
      {ARCS.map((a) => (
        <motion.text
          key={`c-${a.cap}`}
          x={a.capX}
          y={a.capY}
          textAnchor="middle"
          className="font-serif"
          fontSize={15}
          fontStyle="italic"
          fill={GOLDINK}
          // opacity ONLY — never animate x/y on a motion.text: framer drives
          // them as SVG position attributes and fights the fixed capX/capY,
          // which slides the label through the wrong place mid-transition.
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 0.92, transition: ease(a.capDelay, 0.45) },
          }}
        >
          {a.cap}
        </motion.text>
      ))}
    </motion.svg>
  );
}
