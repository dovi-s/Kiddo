import { useEffect, useMemo, useRef } from "react";
import { Share2, ChevronRight, Package } from "lucide-react";
import { GIFTER_AVATAR_COLORS } from "@/lib/gifter-avatar";
import PotentialScrubber from "@/components/PotentialScrubber";

/**
 * STAGING-ONLY "clean" hero (?heroProto=5 maximal / =6 floor) — the resolved
 * hero, built to survive a Jobs/Chesky/Verna cut. Four things, in order:
 *   1. the real balance — count-up on load, then it STAYS PUT. The one number that
 *      must always be literally true (a child's custodial money). The soar was
 *      retired: like Acorns, the "watch it grow" drama belongs in the dedicated
 *      Projection page (the "Potential ›" tap), not on the balance.
 *   2. "N people · M gifts" — the light, always-graceful people signal. The people's
 *      DEPTH lives in the "Who loves" roster below, not a face-pile in the hero.
 *   3. a calm slider that rests at the handoff and reads the honest 5-9% RANGE
 *      ("At 21 · ~$44K-$56K"), never a false-precision point.
 *   4. one gold Share — the single loop action.
 *
 * Flags dial the richness: showPeople/showMomentum are EARNED GARNISH (on for =5,
 * off for the =6 floor, where the roster below carries the people instead). The
 * floor is the durable core — identical + complete at any fund scale.
 * Isolated + self-contained; behind DashboardStaging's ?heroProto=5|6.
 */

export interface CleanHeroGifter {
  initials: string;
  colorIdx: number;
  avatarUrl?: string | null;
  name?: string;
}

export interface StagingCleanHeroProps {
  childName: string;
  liveValue: number;
  cachedValue: number;
  /** The green hero's tuned settle easing, so the roll feels native. */
  rollEasing?: (t: number) => number;
  giftCount: number;
  peopleCount: number;
  monthGiftTotal: number;
  /** Top gifters for the faces row (garnish; recency-sorted). */
  gifters: CleanHeroGifter[];
  /** Canonical projection at an age — drives the calm slider. */
  projectAt: (age: number, rate?: number) => number;
  majorityAge: number;
  currentAge: number;
  /** Age the slider rests on (the handoff, or the long-horizon fallback). */
  restAge: number;
  /** Relative resting label ("In 30 years") for no-handoff funds, so the strip
   *  never surfaces an absolute age that reads as a midlife marker. */
  restLabel?: string;
  onOpenPeople?: () => void;
  onOpenPotential?: () => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  /** Earned garnish (on for =5, off for the =6 floor). */
  showPeople?: boolean;
  showMomentum?: boolean;
  /** Drop the forward projection scrubber (graduated keepsake — the fund is the
   *  now-adult's, so an "at 43" projection on it reads as odd). */
  hideProjection?: boolean;
  /** Graduated keepsake: the fund's REAL growth trajectory up to the handoff
   *  (already capped + downsampled by the caller), rendered as a static, non-
   *  interactive curve in place of the forward scrubber. A keepsake, not a tool
   *  — so a handed-off fund reads as "here's what you built," not a dead slot. */
  keepsakeCurve?: { values: number[]; caption: string };
  /** Graduated keepsake context markers. The clean hero replaced the old green
   *  hero as the default, but never carried these — so a handed-off fund lost
   *  the "Handed off · {date}" kicker + "Transferred to {name} · view only"
   *  badge that explain WHY the number is frozen and there's no Share. Passed as
   *  fully-assembled strings (the copy is founder-owned in DashboardStaging). */
  handoffKicker?: string;
  viewOnlyLabel?: string;
}

/** Static keepsake sparkline — the real growth arc up to the handoff. No scrub,
 *  no interaction; it's a picture of the journey, drawn from real snapshots. */
function KeepsakeSparkline({ values }: { values: number[] }) {
  const W = 300, H = 60, pad = 4;
  const n = values.length;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  return (
    <svg className="ch-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <defs>
        <linearGradient id="ch-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(227,184,96,0.26)" />
          <stop offset="100%" stopColor="rgba(227,184,96,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ch-spark-fill)" />
      <path d={line} fill="none" stroke="#E3B860" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r={3.4} fill="#E3B860" />
    </svg>
  );
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StagingCleanHero(props: StagingCleanHeroProps) {
  const { childName, liveValue, cachedValue, rollEasing, giftCount, peopleCount, monthGiftTotal, gifters, projectAt, majorityAge, currentAge, restAge, restLabel, onOpenPeople, onOpenPotential, onShare, isReadOnly, showPeople = true, showMomentum = true, hideProjection = false, keepsakeCurve, handoffKicker, viewOnlyLabel } = props;

  const balanceRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<number>(cachedValue);
  const rafRef = useRef<number | null>(null);
  const liveRef = useRef<number>(liveValue);
  liveRef.current = liveValue;
  const enteredRef = useRef(false);
  const prevLiveRef = useRef(liveValue);
  const reduceMotion = useMemo(() => { try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; } catch { return false; } }, []);

  const renderLive = (n: number) => {
    if (!balanceRef.current) return;
    const p = fmt2(n).split(".");
    balanceRef.current.innerHTML = "$" + p[0] + '<span class="ch-cents">.' + p[1] + "</span>";
  };
  // Rolling count-up (entrance + live re-roll). The number never scrubs, so it only
  // ever rolls between real values — never a projection.
  const morphTo = (target: number, ms: number, after?: () => void, easing?: (t: number) => number) => {
    if (!Number.isFinite(target)) return;
    if (reduceMotion) { shownRef.current = target; renderLive(target); if (after) after(); return; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = Number.isFinite(shownRef.current) ? shownRef.current : target;
    const willRoll = from !== target;
    // Freshening cue: flash the number gold WHILE it rolls, ease back to cream on
    // settle — the app-canonical white->gold->white hero-roll signature.
    if (willRoll && balanceRef.current) balanceRef.current.style.color = "hsl(var(--kiddo-gold-light))";
    const start = performance.now();
    const ease = easing || ((t: number) => 1 - Math.pow(1 - t, 3));
    const step = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      shownRef.current = from + (target - from) * ease(t);
      renderLive(shownRef.current);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else { rafRef.current = null; if (balanceRef.current) balanceRef.current.style.color = ""; if (after) after(); }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    shownRef.current = cachedValue;
    renderLive(cachedValue);
    if (reduceMotion) { shownRef.current = liveRef.current; renderLive(liveRef.current); enteredRef.current = true; return; }
    // Linger on the cached number, then climb — matching the dashboard's canonical
    // HERO_ROLL_START_DELAY_MS (850ms) so the roll fires in lockstep with the rest.
    const t = setTimeout(() => { morphTo(liveRef.current, 1200, () => { enteredRef.current = true; }, rollEasing); }, 850);
    return () => { clearTimeout(t); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live re-roll when the real value changes (a gift lands / refetch).
  useEffect(() => {
    const prev = prevLiveRef.current;
    prevLiveRef.current = liveValue;
    if (!enteredRef.current || prev === liveValue) return;
    morphTo(liveValue, 820);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveValue]);

  const faces = gifters.slice(0, 5);
  const monthChip = monthGiftTotal > 0
    ? "+" + monthGiftTotal.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) + " this month"
    : "";
  const peopleWord = peopleCount === 1 ? "person" : "people";
  // Compact "12 people · 134 gifts" social-proof line — lead with people (the moat).
  // Only fold the count in when the faces element ISN'T already showing it (else it
  // doubles). Guard >=2 so a solo-parent fund reads "134 gifts", never "1 person".
  const showPeopleInMeta = !showPeople && peopleCount >= 2;
  const metaText = `${showPeopleInMeta ? `${peopleCount} people · ` : ""}${giftCount} ${giftCount === 1 ? "gift" : "gifts"}`;

  return (
    <div className="ch-root">
      <style dangerouslySetInnerHTML={{ __html: CH_CSS }} />
      <div className={`ch-hero${isReadOnly ? " ch-hero-ro" : ""}`} data-testid="hero-card">
        {/* 1 — the number (stays put) */}
        <div className="ch-top">
          <div className="ch-label">{childName}'s future</div>
          {/* Graduated keepsake markers — restore the handoff context the old green
              hero carried, so a frozen number + no Share button reads as "handed
              off," not "broken." Kicker (when it happened) + view-only pill (whose
              it is now), both above the number they explain. */}
          {handoffKicker && (
            <div className="ch-kicker" data-testid="text-hero-handoff-kicker">{handoffKicker}</div>
          )}
          {viewOnlyLabel && (
            <div className="ch-viewonly" data-testid="badge-hero-view-only">
              <Package size={11} strokeWidth={2.25} aria-hidden />
              <span>{viewOnlyLabel}</span>
            </div>
          )}
          <div className="ch-balance" ref={balanceRef}>${fmt0(cachedValue)}<span className="ch-cents">.00</span></div>
          <div className="ch-sub">
            {showMomentum && monthChip && <span className="ch-chip">{monthChip}</span>}
            <span className="ch-meta">{metaText}</span>
          </div>
        </div>

        <div className="ch-rows">
          {/* 2 — the people (garnish; off on the floor, where the roster below owns them) */}
          {showPeople && peopleCount > 0 && (
            <button type="button" className="ch-row ch-people" onClick={onOpenPeople} data-testid="hero-people">
              <span className="ch-faces">
                {faces.map((g, i) => {
                  const c = GIFTER_AVATAR_COLORS[g.colorIdx] || GIFTER_AVATAR_COLORS[0];
                  return (
                    <span key={i} className="ch-face" style={{ background: c.bg, color: c.text, zIndex: faces.length - i }}>
                      {g.avatarUrl ? <img src={g.avatarUrl} alt="" className="ch-face-img" loading="lazy" /> : g.initials}
                    </span>
                  );
                })}
              </span>
              <span className="ch-row-label">Built by {peopleCount} {peopleWord}</span>
              <ChevronRight size={16} className="ch-chev" />
            </button>
          )}

          {/* 3 — the future: calm slider, rests at the handoff, reads the honest range.
              The balance above never moves; the "watch it soar" drama lives one tap
              deeper on the Projection page (the "Potential ›" doorway). */}
          {!hideProjection ? (
            <div className="ch-scrub">
              <PotentialScrubber
                rangeFirst
                projectAt={projectAt}
                majorityAge={majorityAge}
                currentAge={currentAge}
                restAge={restAge}
                restLabel={restLabel}
                onOpenPotential={onOpenPotential}
              />
            </div>
          ) : keepsakeCurve && keepsakeCurve.values.length >= 4 ? (
            /* Graduated keepsake: the forward scrubber makes no sense on a fund
               that's already been handed over, but an empty slot read as
               "stripped." A static curve of what was actually built fills it
               with the story instead — real snapshots, no interaction. */
            <div className="ch-keepsake" data-testid="hero-keepsake-curve">
              <KeepsakeSparkline values={keepsakeCurve.values} />
              <div className="ch-keepsake-cap">{keepsakeCurve.caption}</div>
            </div>
          ) : null}
        </div>

        {/* 4 — the single action */}
        {!isReadOnly && (
          <button type="button" className="ch-share" onClick={onShare} data-testid="hero-share">
            <Share2 size={16} />
            <span>Share {childName}'s link</span>
          </button>
        )}
      </div>
    </div>
  );
}

const CH_CSS = `
.ch-root{--ch-cream:#F7F3EC;--ch-ease:cubic-bezier(.22,1,.36,1);
  width:100%;box-sizing:border-box;color:var(--ch-cream);
  font-family:var(--font-sans),'DM Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ch-root *{box-sizing:border-box}
.ch-hero{position:relative;width:100%;min-height:clamp(392px,52svh,430px);overflow:hidden;
  /* EXACTLY the proto-0 green hero gradient (DashboardStaging ~L7339) so the
     chameleon AppHeader blends against it seamlessly on scroll. The header tracks
     a VERTICAL stop set (hsl(158 45% 19%) 0% -> evergreen 46% -> evergreen-deep 100%)
     and reads the color at the 58px seam; a diagonal (162deg) or mismatched stops
     opened a visible band as the hero scrolled under the bar. Keep this identical
     to the header STOPS in AppHeader.tsx and the proto-0 hero. */
  background:linear-gradient(180deg,hsl(158 45% 19%) 0%,hsl(var(--kiddo-evergreen)) 46%,hsl(var(--kiddo-evergreen-deep)) 100%);
  display:flex;flex-direction:column;padding:30px 24px 22px}
/* Read-only (graduated / previous-owner) hero: no Share button, so the 392px
   min-height — sized to seat that bottom-anchored action — left a dead slab of
   dark green under the content. Drop the floor so the keepsake hero hugs its
   content (value + people + the calm scrubber) with no empty slot; "Your part of
   the story" carries the warmth as its own card below. Founder catch 2026-07-09. */
.ch-hero-ro{min-height:0}
/* 1 — number. Sentence-case label (warm, not the shouty all-caps kicker). */
.ch-top{opacity:0;animation:ch-in .7s var(--ch-ease) .1s forwards}
.ch-label{font-size:13.5px;font-weight:600;letter-spacing:.005em;opacity:.82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* graduated keepsake markers */
.ch-kicker{margin-top:9px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(247,243,236,.6)}
.ch-viewonly{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:3px 10px;border-radius:9999px;background:rgba(247,243,236,.12);border:1px solid rgba(247,243,236,.18);font-size:10.5px;font-weight:600;letter-spacing:.02em;color:rgba(247,243,236,.82)}
.ch-balance{font-family:var(--font-serif),'Bricolage Grotesque',system-ui,sans-serif;font-size:62px;font-weight:700;letter-spacing:-.024em;line-height:1;margin-top:8px;white-space:nowrap;text-shadow:0 1px 12px rgba(8,20,14,.28);transition:color .55s ease}
.ch-balance .ch-cents{font-size:27px;font-weight:400;opacity:.5}
.ch-sub{margin-top:14px;display:flex;align-items:center;gap:10px;font-size:13px;min-height:18px;white-space:nowrap}
.ch-chip{font-weight:600;color:#E3B860}
.ch-meta{opacity:.6;font-weight:400}
/* rows */
.ch-rows{margin-top:24px;display:flex;flex-direction:column}
.ch-row{display:flex;align-items:center;gap:12px;width:100%;padding:14px 2px;background:transparent;border:none;border-top:1px solid rgba(247,243,236,.13);cursor:pointer;color:inherit;font-family:inherit;text-align:left;transition:background .16s ease}
.ch-people{opacity:0;animation:ch-in .6s var(--ch-ease) .16s forwards}
.ch-people:hover{background:rgba(247,243,236,.05)}
.ch-people:focus-visible{outline:2px solid #E3B860;outline-offset:-2px;border-radius:8px}
.ch-chev{flex:0 0 auto;opacity:.5;margin-left:auto}
.ch-row-label{font-size:14px;font-weight:600;opacity:.9}
/* faces */
.ch-faces{display:inline-flex;align-items:center;flex:0 0 auto}
.ch-face{position:relative;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:11px;font-weight:800;box-shadow:0 0 0 2px #143A2C;overflow:hidden}
.ch-face + .ch-face{margin-left:-9px}
.ch-face-img{width:100%;height:100%;object-fit:cover}
/* 3 — the future (PotentialScrubber is tone-aware: currentColor = cream) */
.ch-scrub{border-top:1px solid rgba(247,243,236,.13);padding:18px 2px 4px;opacity:0;animation:ch-in .6s var(--ch-ease) .2s forwards}
/* 3' — graduated keepsake curve (static; replaces the scrubber on a handed-off fund) */
.ch-keepsake{border-top:1px solid rgba(247,243,236,.13);padding:16px 2px 2px;opacity:0;animation:ch-in .6s var(--ch-ease) .2s forwards}
.ch-spark{width:100%;height:auto;display:block;overflow:visible}
.ch-keepsake-cap{margin-top:9px;font-size:12px;font-weight:500;opacity:.58;letter-spacing:.01em}
/* 4 — share */
.ch-share{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;appearance:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:700;letter-spacing:.01em;color:#fff;background:hsl(var(--kiddo-gold));padding:16px 20px;border-radius:14px;transition:transform .18s var(--ch-ease),filter .25s ease;box-shadow:0 1px 2px rgba(14,37,24,.22),0 5px 14px rgba(14,37,24,.16),inset 0 1px 0 rgba(255,255,255,.18);opacity:0;animation:ch-in .6s var(--ch-ease) .24s forwards}
.ch-share:hover{filter:brightness(1.05);transform:translateY(-1px)}
.ch-share:active{transform:translateY(0) scale(.985)}
.ch-share:focus-visible{outline:2.5px solid #fff;outline-offset:2px}
@keyframes ch-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (max-width:400px){.ch-balance{font-size:54px}}
@media (prefers-reduced-motion:reduce){.ch-top,.ch-people,.ch-scrub,.ch-keepsake,.ch-share{animation:none!important;opacity:1!important;transform:none!important}}
`;
