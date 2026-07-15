import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Self-contained age-scrubber + honest 5-9% range, extracted from the staging
 * landscape hero so it can live on the GREEN hero too (an A/B: is the scrubber
 * the valuable part, or the whole landscape?). Tone-aware via currentColor.
 *
 * Drag the age Today..65 to see the projected value + range at that age; release
 * springs back to the handoff (a peek gesture). Tapping the title opens the full
 * Projection page. Staging-only.
 */

const bandK = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.round(n / 1000) + "K");
function shortMoney(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M";
  // 10K+ rounds to a clean whole K: a projection to 2033 reading "~$50K" is
  // honest-er than the over-precise "~$49.7K", and matches the round band below.
  // Under 10K keeps a decimal so small near-term figures don't collapse to "$2K".
  if (n >= 10000) return Math.round(n / 1000) + "K";
  return (Math.round(n / 100) / 10).toFixed(1) + "K";
}

export interface PotentialScrubberProps {
  /** Canonical projection at an age; optional annual rate (default moderate 7%). */
  projectAt: (age: number, rate?: number) => number;
  majorityAge: number;
  /** Child's current age — the scrubber minimum ("Today"). */
  currentAge: number;
  onOpenPotential?: () => void;
  /** Resting age the scrubber defaults + springs back to. Majority by default;
   *  the caller drops it to the long horizon (65) via the same near-handoff gate
   *  the main hero uses, when the at-majority number is flat (deposits, not
   *  growth) and would read broken. */
  restAge?: number;
  /** Lead with the honest 5-9% RANGE ("At 21 · ~$44K-$56K") instead of a single
   *  point ("At 21 ~$49.6K") — the point implies a precision the market can't give.
   *  The canonical clean hero uses this; the green-hero A/B kept the point form. */
  rangeFirst?: boolean;
  /** Overrides the resting eyebrow. Kid funds leave it undefined ("At 21", the
   *  handoff). Adult / no-handoff funds pass a RELATIVE label ("In 30 years") so
   *  the resting strip never surfaces an absolute age that reads as a midlife
   *  marker. Only affects the resting position; scrubbing still names the age. */
  restLabel?: string;
}

export default function PotentialScrubber({ projectAt, majorityAge, currentAge, onOpenPotential, restAge, rangeFirst, restLabel }: PotentialScrubberProps) {
  const minAge = Math.max(0, Math.min(currentAge, majorityAge - 1, 64));
  const maxAge = 65;
  const rest = Math.min(restAge ?? majorityAge, maxAge);
  const span = Math.max(1, maxAge - minAge);
  const pct = (age: number) => ((age - minAge) / span) * 100;

  const [scrubAge, setScrubAge] = useState<number>(() => rest);
  const scrubAgeRef = useRef<number>(rest);
  const numRef = useRef<HTMLSpanElement>(null);
  const eyeRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<number | null>(null);

  const bandStr = (age: number) => `~$${bandK(projectAt(age, 0.05))}-$${bandK(projectAt(age, 0.09))}`;

  const noteStr = (age: number) => rangeFirst
    ? (age > majorityAge ? `5-9% a year · market only after ${majorityAge}` : `5-9% a year`)
    : (age > majorityAge ? `5-9%: ${bandStr(age)} · market only after ${majorityAge}` : `5-9%: ${bandStr(age)}`);
  // Range-first: the age is a small muted EYEBROW ("At 21") so the honest range
  // number stands out — matching the landscape/flat hero's readout hierarchy,
  // instead of "At 21" competing at the same size as the range.
  // At the resting age, an adult fund shows the relative label ("In 30 years")
  // instead of "At {age}" (which would read as a midlife marker). While scrubbing
  // (age !== rest) it names the age the user dragged to, and the spring-back lands
  // back on the label when it settles at rest.
  const eyeStr = (age: number) => (rangeFirst ? (restLabel && age === rest ? restLabel : `At ${age}`) : "");
  const numStr = (age: number) => rangeFirst ? bandStr(age) : `At ${age} ~$${shortMoney(projectAt(age))}`;

  const paint = (age: number) => {
    if (fillRef.current) fillRef.current.style.width = pct(age) + "%";
    if (rangeFirst && eyeRef.current) eyeRef.current.textContent = eyeStr(age);
    if (numRef.current) numRef.current.textContent = numStr(age);
    if (noteRef.current) noteRef.current.textContent = noteStr(age);
  };

  const cancelSpring = () => { if (springRef.current) { cancelAnimationFrame(springRef.current); springRef.current = null; } };

  // Fund switch: the parent swaps projectAt/currentAge/restAge for the new fund but
  // keeps THIS component mounted, so scrubAge (init'd on mount only) would stay stuck
  // at the old fund's position — and can land outside the new fund's [minAge, maxAge],
  // jamming the dot. Re-center it to the resting position whenever the derived range
  // or rest changes (i.e. on a fund switch). Deps are numbers, so it only fires on a
  // real change, not every render.
  useEffect(() => {
    cancelSpring();
    scrubAgeRef.current = rest;
    setScrubAge(rest);
    paint(rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest, minAge]);

  const springToHandoff = () => {
    cancelSpring();
    const from = scrubAgeRef.current, to = rest;
    if (from === to) return;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min((now - start) / 480, 1);
      const age = Math.round(from + (to - from) * ease(t));
      scrubAgeRef.current = age; setScrubAge(age); paint(age);
      if (t < 1) springRef.current = requestAnimationFrame(step);
      else { springRef.current = null; scrubAgeRef.current = to; setScrubAge(to); paint(to); }
    };
    springRef.current = requestAnimationFrame(step);
  };

  const openProps = onOpenPotential
    ? { role: "button" as const, tabIndex: 0, onClick: onOpenPotential, style: { cursor: "pointer" } as const,
        onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenPotential(); } } }
    : {};

  return (
    <div className="ps-root">
      <style dangerouslySetInnerHTML={{ __html: PS_CSS }} />
      <div className="ps-copy" {...openProps}>
        <div className="ps-title">Potential{onOpenPotential && <ChevronRight size={12} strokeWidth={2.5} style={{ marginLeft: 3, verticalAlign: "-1px", opacity: 0.55 }} />}</div>
        <div className="ps-state">
          {rangeFirst && <span className="ps-eyebrow" ref={eyeRef}>{eyeStr(rest)}</span>}
          <span className="ps-num" ref={numRef}>{numStr(rest)}</span>
          <div className="ps-note" ref={noteRef}>{noteStr(rest)}</div>
        </div>
      </div>
      <div className="ps-track" data-swipe-dismiss="true">
        <div className="ps-rail" />
        <div className="ps-fill" ref={fillRef} style={{ width: pct(rest) + "%" }} />
        <input className="ps-scrub" type="range" min={minAge} max={maxAge} step={1} value={scrubAge}
          aria-label="Scrub the age to see projected value"
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={cancelSpring}
          onPointerUp={springToHandoff}
          onPointerCancel={springToHandoff}
          onChange={(e) => { const a = Number(e.target.value); cancelSpring(); scrubAgeRef.current = a; setScrubAge(a); paint(a); }} />
      </div>
      <div className="ps-labels"><span>Today</span><span>65</span></div>
    </div>
  );
}

const PS_CSS = `
.ps-root{--ps-ease:cubic-bezier(.22,1,.36,1);width:100%;color:inherit;font-variant-numeric:tabular-nums}
.ps-copy{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:8px}
.ps-title{display:inline-flex;align-items:center;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.6}
.ps-state{text-align:right;line-height:1;min-height:31px;white-space:nowrap}
.ps-eyebrow{font-size:11px;font-weight:650;letter-spacing:.03em;opacity:.6;margin-right:7px}
.ps-num{font-family:var(--font-serif),'Bricolage Grotesque',system-ui,sans-serif;font-size:18px;font-weight:650;letter-spacing:-.02em}
.ps-note{font-size:10px;font-weight:600;opacity:.55;margin-top:3px;white-space:nowrap}
.ps-track{position:relative;height:34px;display:flex;align-items:center}
.ps-rail{position:absolute;left:0;right:0;top:50%;height:3px;transform:translateY(-50%);background:currentColor;opacity:.22;border-radius:999px}
.ps-fill{position:absolute;left:0;top:50%;height:3px;transform:translateY(-50%);background:currentColor;opacity:.85;border-radius:999px;box-shadow:0 0 10px 1px currentColor}
.ps-scrub{position:relative;width:100%;appearance:none;-webkit-appearance:none;background:transparent;height:34px;cursor:pointer;z-index:2;margin:0}
.ps-scrub::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:currentColor;border:none;box-shadow:0 0 0 4px rgba(247,243,236,.14),0 0 14px 3px currentColor;transition:transform .18s var(--ps-ease),box-shadow .2s ease}
.ps-scrub:active::-webkit-slider-thumb{transform:scale(1.14)}
.ps-scrub::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:currentColor;border:none;box-shadow:0 0 14px 3px currentColor}
.ps-scrub:focus-visible{outline:none}
.ps-labels{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;letter-spacing:.04em;opacity:.7;margin-top:1px}
@media (prefers-reduced-motion:reduce){.ps-fill{box-shadow:none}}
`;
