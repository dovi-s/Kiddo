// Phase-1 shared-element-transition prototype — see SHARED_ELEMENT_TRANSITIONS_PROPOSAL.md.
//
// The "magic move": tapping a holding row morphs its logo into the
// HoldingDetailSheet header (the row's StockLogo and the sheet header's StockLogo
// share one Framer layout node, so Framer animates the handoff between them).
//
// OFF by default — live is byte-identical to today (layoutId resolves to undefined,
// so no layout animation is registered). Flip to true (or feel it on /staging) to
// A/B the morph. This is a FOUNDER-OWNED taste call: whether it should be the logo
// (this), the whole row, or just the value — and the spring/duration — wants a human
// eye. Reduced-motion is guarded at each usage site (no morph under prefers-reduced-motion).
export const SHARED_ELEMENT_HOLDING_MORPH = false;

// Stable per-ticker layout id. The SAME string on the row logo and the sheet-header
// logo is what makes Framer treat them as one node and animate between them. Returns
// undefined when disabled so callers can spread it straight onto a motion element
// (layoutId={undefined} = a normal, un-tracked element — zero overhead when off).
export function holdingMorphId(
  ticker: string | null | undefined,
  enabled: boolean,
): string | undefined {
  if (!enabled || !ticker) return undefined;
  return `holding-morph-${String(ticker).toUpperCase()}`;
}
