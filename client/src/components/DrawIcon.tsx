import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DrawIcon — wraps ANY lucide icon and DRAWS IT IN (the strokes trace on like an
// invisible pen), the Acorns-style reward. The icons themselves are untouched —
// this only animates the strokes of the exact icon you pass.
//
// How: lucide icons are stroke SVGs, so each child path/line/circle has a real
// length. We measure it (getTotalLength), hide it (dash = length), then transition
// the dash-offset to 0 — staggered across multiple paths so a multi-part icon
// (a Gift, a Repeat) draws as one gesture.
//
// Reserve it for rare, meaningful peaks — a gift sent, a schedule started, a goal
// hit — NOT everyday chrome (tabs stay instant). Reduced-motion → renders formed.
// One-shot per mount.
// ─────────────────────────────────────────────────────────────────────────────

export function DrawIcon({
  icon: Icon,
  size = 24,
  strokeWidth,
  color,
  duration = 0.55,
  stagger = 0.08,
  play = true,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  color?: string;
  duration?: number;
  stagger?: number;
  play?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const drawnRef = useRef(false);

  useLayoutEffect(() => {
    if (!play || prefersReducedMotion || drawnRef.current) return;
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const els = svg.querySelectorAll<SVGGeometryElement>(
      "path, line, circle, polyline, polygon, rect, ellipse",
    );
    if (!els.length) return;
    drawnRef.current = true;
    els.forEach((el, i) => {
      let len = 0;
      try {
        len = el.getTotalLength();
      } catch {
        /* element type without getTotalLength — skip, it just appears */
      }
      if (!len) return;
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      // Force the hidden state to flush so the transition has a "from".
      void el.getBoundingClientRect();
      el.style.transition = `stroke-dashoffset ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${
        i * stagger
      }s`;
      el.style.strokeDashoffset = "0";
    });
  }, [play, prefersReducedMotion, duration, stagger]);

  return (
    <span ref={ref} className={className} aria-hidden="true">
      <Icon size={size} strokeWidth={strokeWidth} color={color} />
    </span>
  );
}
