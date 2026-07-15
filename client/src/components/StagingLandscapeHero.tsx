import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Share2, ChevronRight } from "lucide-react";

/**
 * STAGING-ONLY landscape hero (founder taste-call, 2026-07-06).
 *
 * A React port of the downloaded landscape-hero prototype, rewired to the
 * fund's REAL data: live balance count-up, real gift/people counts, the app's
 * canonical projection on the scrubber, the real Share CTA, real child name +
 * handoff date. No hardcoded prototype numbers, no fake "gift landed" theater.
 *
 * The ENTIRE scene is React-driven from a single `tod` (time-of-day) value, so
 * the sky, sun/moon, stars and TEXT LIGHTNESS can never desync (the earlier
 * imperative-querySelector version left light text on a pale sky = invisible).
 * Grass blades are generated deterministically (seeded RNG) so they render on
 * first paint. Only the balance count-up is imperative (60fps, via a ref).
 *
 * Rendered only behind DashboardStaging's `heroProto` flag (?heroProto=0 for
 * the original green hero). Not promoted to /dashboard. Undo = delete this file
 * + the flag/branch in DashboardStaging.
 *
 * All CSS is scoped under `.lh-root`; keyframes are `lh-`-prefixed so the
 * prototype's generic class names can't collide with the app.
 */

type TOD = "dawn" | "day" | "dusk" | "night";

interface StateDef {
  sky: [string, string, string];
  atmos: [string, number];
  sun: { x: number; y: number; s: number; fill: string; gi: string; gm: string };
  night: boolean;
  clouds: string;
  lightText: boolean;
  greet: string;
  bird: string;
}

const STATES: Record<TOD, StateDef> = {
  dawn: { sky: ["#DCE0EA", "#F3DCD0", "#F6C9A8"], atmos: ["#F3B98A", 0.08], sun: { x: 772, y: 436, s: 0.86, fill: "#F4C79A", gi: "#F7C9A6", gm: "#EFA97E" }, night: false, clouds: "#FFFDF8", lightText: false, greet: "Good morning", bird: "#3A5A46" },
  day: { sky: ["#F1F4EF", "#F6EFDF", "#F3E2C0"], atmos: ["#000000", 0], sun: { x: 792, y: 300, s: 1, fill: "#F0C86A", gi: "#F6D98A", gm: "#E9B45C" }, night: false, clouds: "#FFFDF8", lightText: false, greet: "Good afternoon", bird: "#2C5A3C" },
  dusk: { sky: ["#3E3A63", "#8A5A6E", "#E8A15C"], atmos: ["#B8542E", 0.20], sun: { x: 780, y: 560, s: 1.18, fill: "#EF8C43", gi: "#F6A84E", gm: "#E5622F" }, night: false, clouds: "#FFFDF8", lightText: true, greet: "Good evening", bird: "#EDE7D6" },
  night: { sky: ["#0C1D17", "#132A21", "#1C3A2C"], atmos: ["#081420", 0.32], sun: { x: 792, y: 250, s: 1, fill: "#F0C86A", gi: "#F6D98A", gm: "#E9B45C" }, night: true, clouds: "#FFFDF8", lightText: true, greet: "Good evening", bird: "#D9D2C0" },
};
const ORDER: TOD[] = ["dawn", "day", "dusk", "night"];

// Flat-backdrop mode (?heroProto=flat): the SAME rolling-value + band slider, but
// on the app's evergreen hero gradient instead of the living sky — a backdrop A/B.
// Stops mirror the green hero exactly: hsl(158 45% 19%) -> --kiddo-evergreen
// (#143A2C) -> --kiddo-evergreen-deep (#0B2018). No atmos grade, no time-of-day.
const FLAT_GREEN: StateDef = {
  sky: ["#1B4636", "#143A2C", "#0B2018"], atmos: ["#000000", 0],
  sun: { x: 0, y: 0, s: 1, fill: "#000", gi: "#000", gm: "#000" },
  night: true, clouds: "#000", lightText: true, greet: "", bird: "#000",
};

function autoState(hour: number): TOD {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
function shortMoney(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M";
  if (n >= 100000) return Math.round(n / 1000) + "K";
  return (Math.round(n / 100) / 10).toFixed(1) + "K";
}


export interface StagingLandscapeHeroProps {
  childName: string;
  liveValue: number;
  cachedValue: number;
  giftCount: number;
  peopleCount: number;
  monthGiftTotal: number;
  currentAge: number;
  majorityAge: number;
  handoffLabel: string;
  /** Canonical projection at a given age; optional annual rate (default moderate). */
  projectAt: (age: number, rate?: number) => number;
  /** Real monthly recurring total (sumMonthlyEquivalent) — shown as the projection's assumption. */
  monthlyContribution: number;
  /** Set to the amount when a new gift just landed (else null) — triggers the roll-in + flash. */
  giftFlashAmount?: number | null;
  /** The gifter's name for the "+$X · Name" flash. */
  giftFlashName?: string;
  /** The green hero's tuned two-stage settle easing (heroSettleEase) for the entrance roll. */
  rollEasing?: (t: number) => number;
  /** Viewer's first name for the greeting ("Good evening, Elena"). Empty in owner mode. */
  viewerName?: string;
  /** Opens the full Projection page (the strip is the teaser doorway). */
  onOpenPotential?: () => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  /** Flat evergreen backdrop instead of the living sky (backdrop A/B). Drops the
   *  time-of-day scene + toggle; same rolling-value + band slider. */
  flatBackdrop?: boolean;
  /** Age the RESTING Potential strip anchors on. Defaults to the majority age,
   *  but the caller drops it to the long horizon (65) via the main hero's
   *  near-handoff gate when a kid is so close to majority that the at-majority
   *  number is flat (deposits, not growth) and would "read broken". */
  restAnchorAge?: number;
  /** Overrides the resting eyebrow text. Kid funds leave this undefined and show
   *  "At {age}" (the handoff milestone). Adult-owned funds pass a RELATIVE label
   *  like "In 30 years" so the resting strip never surfaces an absolute age that
   *  reads as a life-stage / midlife marker. */
  restAnchorLabel?: string;
  /** Changes when the fund changes. On change, the scrub resets to Today (rest)
   *  WITHOUT remounting — so switching funds doesn't leave the slider dot stuck at
   *  the old fund's position, and doesn't replay the whole entrance reveal. */
  resetKey?: string;
}

export default function StagingLandscapeHero(props: StagingLandscapeHeroProps) {
  const { childName, liveValue, cachedValue, giftCount, peopleCount, monthGiftTotal, currentAge, majorityAge, handoffLabel, projectAt, giftFlashAmount, giftFlashName, rollEasing, onOpenPotential, onShare, isReadOnly, flatBackdrop, restAnchorAge, restAnchorLabel, resetKey } = props;
  // The resting Potential strip teases this age (majority by default; the long
  // horizon when the caller's near-handoff gate says at-majority reads flat).
  const anchorAge = restAnchorAge ?? majorityAge;

  const balanceRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const chipTextRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const metaRef = useRef<HTMLSpanElement>(null);
  const updatedRef = useRef<HTMLDivElement>(null);
  const horizonRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<number>(cachedValue);
  const rafRef = useRef<number | null>(null);
  const scrubAgeRef = useRef<number>(0);
  const springRafRef = useRef<number | null>(null);
  const reduceMotion = useMemo(() => { try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; } catch { return false; } }, []);
  // Always roll to the LATEST live value (refetches/gifts can change it after mount).
  const liveValueRef = useRef(liveValue);
  liveValueRef.current = liveValue;
  const hasEnteredRef = useRef(false); // true once the entrance roll has finished
  const prevLiveRef = useRef(liveValue);

  const minAge = Math.max(0, Math.min(currentAge, majorityAge - 1, 64));
  // Rail ends at 65 (retirement) for kid funds. For an adult-owned fund the anchor
  // is a 30-year horizon that can land past 65, so extend the rail to keep the
  // resting dot on-track with room to drag right (never pinned to the rail).
  const maxAge = Math.max(65, anchorAge + 6);
  const span = Math.max(1, maxAge - minAge);
  const pct = (age: number) => ((age - minAge) / span) * 100;

  const [tod, setTod] = useState<TOD>(() => { try { return autoState(new Date().getHours()); } catch { return "day"; } });
  // Thumb starts at "Today" (the left end) so the resting position matches the
  // resting value (today's balance) and you drag ONE direction — right, into the
  // future. (Defaulting mid-track to the handoff age made "today" ambiguous.)
  const [scrubAge, setScrubAge] = useState<number>(() => minAge);
  const s = flatBackdrop ? FLAT_GREEN : STATES[tod];

  // The big sky number owns the POINT + age (the dramatic count-up). The strip
  // complements it with the honest 5-9% BAND — never a repeat of the point.
  // A single number implies a precision the market can't give; the band is the
  // honest shape, mirroring the full Projection page.
  const bandK = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.round(n / 1000) + "K");
  const bandStr = (age: number) => `~$${bandK(projectAt(age, 0.05))}-$${bandK(projectAt(age, 0.09))}`;
  // At rest the big number shows TODAY, so the strip teases the target range.
  // Kid fund: "At 21 · ~$43K-$55K" (the handoff milestone). Adult fund: a relative
  // "In 30 years · …" via restAnchorLabel, so no absolute age (which would read as
  // a midlife marker) is ever surfaced at rest. While scrubbing, the strip drops
  // the label entirely and just names the band ("5-9% range").
  const restEyebrow = restAnchorLabel ?? `At ${anchorAge}`;
  const stripRest = () => `<span class="lh-eyebrow">${restEyebrow}</span><span class="lh-number lh-rangeNum">${bandStr(anchorAge)}</span><div class="lh-range">5-9% a year</div>`;
  const stripScrub = (age: number) => `<span class="lh-eyebrow">5-9% range</span><span class="lh-number lh-rangeNum">${bandStr(age)}</span>`;

  const renderLive = (n: number) => {
    if (!balanceRef.current) return;
    const p = fmt2(n).split(".");
    balanceRef.current.innerHTML = "$" + p[0] + '<span class="lh-cents">.' + p[1] + "</span>";
  };
  const renderProj = (n: number) => {
    if (!balanceRef.current) return;
    let v = n;
    if (v < 100000) v = Math.round(v / 100) * 100;
    else if (v < 1000000) v = Math.round(v / 1000) * 1000;
    else v = Math.round(v / 10000) * 10000;
    balanceRef.current.innerHTML = '<span class="lh-approx">~</span>$' + fmt0(v);
  };
  const morphTo = (target: number, ms: number, proj: boolean, after?: () => void, easing?: (t: number) => number) => {
    // Guard: never animate to/from a non-finite value (a bad projection input
    // during a fast scrub would otherwise render garbage millions/billions).
    if (!Number.isFinite(target)) return;
    if (!Number.isFinite(shownRef.current)) shownRef.current = target;
    // Reduced-motion: snap instead of rolling (matches the green hero).
    if (reduceMotion) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      shownRef.current = target;
      if (proj) renderProj(target); else renderLive(target);
      if (after) after();
      return;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = shownRef.current;
    const start = performance.now();
    // Default = ease-out cubic; the entrance passes the green hero's tuned
    // two-stage settle (heroSettleEase) so the "climb then come to rest" roll
    // matches the main dashboard exactly.
    const ease = easing || ((t: number) => 1 - Math.pow(1 - t, 3));
    const step = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      shownRef.current = from + (target - from) * ease(t);
      if (proj) renderProj(shownRef.current); else renderLive(shownRef.current);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else { rafRef.current = null; if (after) after(); }
    };
    rafRef.current = requestAnimationFrame(step);
  };
  // Snap the value instantly (no animation) — used while scrubbing so the number
  // tracks the slider exactly (direct manipulation). Animating between far-apart
  // values (projection <-> today) let a fast scrub catch mid-roll intermediates,
  // which read as garbage huge numbers at the wrong slider position. The count-up
  // morph stays for the passive hero reveal on load only.
  const snapTo = (value: number, proj: boolean) => {
    if (!Number.isFinite(value)) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    shownRef.current = value;
    if (proj) renderProj(value); else renderLive(value);
  };

  // Only show the "+$X this month" chip when there's a real figure — no vague
  // "Growing quietly" filler next to the real social-proof line.
  const monthChip = monthGiftTotal > 0
    ? "+" + monthGiftTotal.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) + " this month"
    : "";
  const metaText = `${giftCount} ${giftCount === 1 ? "gift" : "gifts"} · ${peopleCount} ${peopleCount === 1 ? "person" : "people"}`;

  const setAge = (age: number) => {
    if (fillRef.current) fillRef.current.style.width = pct(age) + "%";
    if (age <= minAge) {
      if (labelRef.current) labelRef.current.textContent = `${childName}'s future`;
      snapTo(liveValue, false);
      if (chipRef.current) chipRef.current.style.display = monthGiftTotal > 0 ? "inline-flex" : "none";
      if (chipTextRef.current) chipTextRef.current.textContent = monthChip;
      if (metaRef.current) metaRef.current.textContent = metaText;
      if (updatedRef.current) updatedRef.current.textContent = "Updated just now";
      if (horizonRef.current) horizonRef.current.innerHTML = stripRest();
    } else {
      const v = projectAt(age);
      if (labelRef.current) labelRef.current.textContent = `Projected value · age ${age}`;
      snapTo(v, true);
      // No "+$X of growth ahead" chip: the climbing number + the range band
      // already tell the growth story, so a third number is just clutter.
      if (chipRef.current) chipRef.current.style.display = "none";
      // One confident, grounding line: what the number assumes. Deposits only run
      // UNTIL the handoff, so the line flips at 21 to market-only. We don't spell
      // out a "$X/mo" figure — it contradicted the recurring chip (the chip shows
      // just the parent deposit; this summed in recurring gifts too) and baked in
      // a shaky "every gift repeats forever" assumption. The range carries it.
      if (metaRef.current) {
        metaRef.current.textContent = age > majorityAge
          ? `illustrative · market only after ${majorityAge}`
          : `illustrative · 7% a year`;
      }
      if (updatedRef.current) updatedRef.current.textContent = " ";
      if (horizonRef.current) horizonRef.current.innerHTML = stripScrub(age);
    }
  };

  // Spring-back: the slider is a "peek the future" gesture — on release it rolls
  // the number back down and eases the thumb back to Today, so the hero always
  // rests on the real today value (not a projection someone might misread). Only
  // fires on pointer/touch release, not keyboard, so arrow-key users can park it.
  const cancelSpring = () => { if (springRafRef.current) { cancelAnimationFrame(springRafRef.current); springRafRef.current = null; } };
  const springToToday = () => {
    cancelSpring();
    const from = scrubAgeRef.current;
    if (from <= minAge) return;
    const start = performance.now();
    const dur = 520;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const age = Math.round(from + (minAge - from) * ease(t));
      scrubAgeRef.current = age;
      setScrubAge(age);
      setAge(age);
      if (t < 1) springRafRef.current = requestAnimationFrame(step);
      else { springRafRef.current = null; scrubAgeRef.current = minAge; setScrubAge(minAge); setAge(minAge); }
    };
    springRafRef.current = requestAnimationFrame(step);
  };

  // Publish the current sky-top tone so the app header (chameleon) can match
  // its background + text color to the landscape instead of the green hero's
  // fixed tone. Fires on mount + every time-of-day change; resets on unmount.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("kiddo:staging-hero-tone", { detail: { seam: s.sky[0], light: s.lightText } }));
  }, [tod, flatBackdrop]);
  useEffect(() => {
    return () => { window.dispatchEvent(new CustomEvent("kiddo:staging-hero-tone", { detail: null })); };
  }, []);

  // count-up on mount: seed cached, roll to live (honest cached -> fresh).
  useEffect(() => {
    shownRef.current = cachedValue;
    renderLive(cachedValue);
    if (horizonRef.current) horizonRef.current.innerHTML = stripRest();
    if (fillRef.current) fillRef.current.style.width = pct(minAge) + "%";
    // BEAT 3 — the number is the finale: once the land has settled and the words
    // are in (0.85s, matching the main dashboard's HERO_ROLL_START_DELAY_MS), it
    // counts up cached -> live over 1200ms with the same tuned settle easing, so
    // the roll FEELS identical to the green hero. Reads liveValueRef so a value
    // that changed mid-entrance still lands on the fresh number.
    const t = setTimeout(() => {
      morphTo(liveValueRef.current, 1200, false, () => { if (updatedRef.current) updatedRef.current.textContent = "Updated just now"; }, rollEasing);
    }, 850);
    scrubAgeRef.current = minAge;
    hasEnteredRef.current = false;
    // Arm the live re-roll only after the finale settles, so it never fights the intro.
    const enteredT = setTimeout(() => { hasEnteredRef.current = true; }, 2150);
    return () => { clearTimeout(t); clearTimeout(enteredT); if (rafRef.current) cancelAnimationFrame(rafRef.current); if (springRafRef.current) cancelAnimationFrame(springRafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FUND SWITCH: the parent keeps this component mounted and swaps in the new fund's
  // props (resetKey = fund id). Reset the scrub to Today so the dot doesn't stay
  // stuck at the old fund's position — which would also freeze the big number on the
  // old projection, since the live re-roll bails while "scrubbed". Skip the very first
  // run (the entrance effect above owns the initial reveal); fire only on an actual
  // switch, snapping the number to the new balance — no full scene/count-up replay.
  const didFundResetRef = useRef(false);
  useEffect(() => {
    if (!didFundResetRef.current) { didFundResetRef.current = true; return; }
    cancelSpring();
    scrubAgeRef.current = minAge;
    setScrubAge(minAge);
    setAge(minAge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // LIVE re-roll: when the real value changes after the entrance (a gift lands, a
  // refetch), roll the resting today number up to it — matching the green hero's
  // useCachedFirstNumber "always live, roll not jump" behavior. Only while the
  // hero is resting on Today (not scrubbing / mid-spring), and never before the
  // entrance roll has finished (so it doesn't fight it).
  useEffect(() => {
    const prev = prevLiveRef.current;
    prevLiveRef.current = liveValue;
    if (!hasEnteredRef.current) return;
    if (prev === liveValue) return;
    if (scrubAgeRef.current > minAge || springRafRef.current) return;
    // roll from the current shown (the old value) up into the new one — a touch
    // snappier than the entrance (a reaction should feel more immediate than the
    // cinematic intro; that difference is deliberate, not arbitrary).
    morphTo(liveValue, 820, false, () => { if (updatedRef.current) updatedRef.current.textContent = "Updated just now"; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveValue]);

  // NEW-GIFT beat: when a gift lands the value re-rolls (above); this adds the
  // "+$X · Name" flash + a brief gold bloom on the number, the same beat the green
  // hero fires. Shown ~2.6s, then fades.
  const [giftFlash, setGiftFlash] = useState<{ amount: number; name: string } | null>(null);
  useEffect(() => {
    if (!giftFlashAmount || giftFlashAmount <= 0) return;
    if (scrubAgeRef.current > minAge) return; // don't hijack a scrub
    setGiftFlash({ amount: giftFlashAmount, name: (giftFlashName || "").split(/\s+/)[0] || "" });
    // Bloom the number gold imperatively (so React never re-touches its innerHTML).
    if (balanceRef.current && !reduceMotion) balanceRef.current.style.filter = "drop-shadow(0 0 16px rgba(227,184,96,.55))";
    const clear = setTimeout(() => { setGiftFlash(null); if (balanceRef.current) balanceRef.current.style.filter = ""; }, 2600);
    return () => clearTimeout(clear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftFlashAmount]);

  return (
    <div className="lh-root">
      <style dangerouslySetInnerHTML={{ __html: LH_CSS }} />
      {/* Immersive: the whole hero lives ON the scene — value up top, Potential
          in the mid-sky, Share + time toggle low over the meadow. The landscape
          is the backdrop; content overlays it in a flex column. Chrome anchor
          (data-testid/landscape/sky*) stays on THIS element so the header keeps
          matching the sky per time-of-day (the square SVG fills it vertically,
          so the sky-gradient the header samples is unchanged). */}
      <div className={`lh-hero${s.lightText ? " lh-lighttext" : ""}`} data-testid="hero-card" data-landscape="1" data-sky0={s.sky[0]} data-sky1={s.sky[1]} data-sky2={s.sky[2]} data-atmos={s.atmos[0]} data-atmosop={String(s.atmos[1])}>
          <svg className="lh-scene-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMax slice" role="img" aria-label={flatBackdrop ? "A calm evergreen backdrop" : "A calm sky that shifts with the time of day"}>
            <defs>
              <linearGradient id="lh-sky" x1="0" y1="0" x2="0" y2="1">
                <stop className="lh-sky-stop" offset="0" stopColor={s.sky[0]} />
                <stop className="lh-sky-stop" offset="0.55" stopColor={s.sky[1]} />
                <stop className="lh-sky-stop" offset="1" stopColor={s.sky[2]} />
              </linearGradient>
            </defs>

            <g className="lh-layer lh-l-sky"><rect x="0" y="0" width="1000" height="1000" fill="url(#lh-sky)" /></g>

            <rect className="lh-atmos" x="0" y="0" width="1000" height="1000" fill={s.atmos[0]} opacity={s.atmos[1]} pointerEvents="none" />

          </svg>

          {/* Content overlays the scene in a flex column: value at top, Potential
              in the mid-sky, Share + toggle low over the meadow. No scrim (it
              tinted the sky the header matches); the tone system keeps text
              legible, with a soft text-shadow over the busy moon/star area. */}
          <div className="lh-content">
            <div className="lh-overlay lh-top">
            <div className="lh-label" ref={labelRef}>{childName}'s future</div>
            <div className="lh-balance" ref={balanceRef}>${fmt0(cachedValue)}<span className="lh-cents">.00</span></div>
            {giftFlash && (
              <div className="lh-giftflash" key={`${giftFlash.amount}-${giftFlash.name}`}>
                {"+" + new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(giftFlash.amount) ? 0 : 2 }).format(giftFlash.amount)}
                {giftFlash.name && <span className="lh-giftflash-name"> · {giftFlash.name}</span>}
              </div>
            )}
            <div className="lh-subline">
              <span className="lh-chip" ref={chipRef} style={{ display: monthGiftTotal > 0 ? undefined : "none" }}>
                <span ref={chipTextRef}>{monthChip}</span>
              </span>
              <span className="lh-meta" ref={metaRef}>{metaText}</span>
            </div>
            </div>

            <div className="lh-mid">
            {/* The title+number row is the doorway to the full Projection page
                (preview here, tap for the rate selector / money-in-vs-market /
                trajectory). The slider below stays a live control, so only this
                row is the tap target. */}
            <div
              className="lh-horizon-copy"
              {...(onOpenPotential ? { role: "button", tabIndex: 0, onClick: onOpenPotential, onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenPotential(); } } } : {})}
              style={onOpenPotential ? { cursor: "pointer" } : undefined}
            >
              <div className="lh-horizon-title">
                Potential
                {onOpenPotential && <ChevronRight size={12} strokeWidth={2.5} style={{ marginLeft: 3, verticalAlign: "-1px", opacity: 0.5 }} />}
              </div>
              <div className="lh-horizon-state" ref={horizonRef}>
                <span className="lh-eyebrow">At {anchorAge}</span>
                <span className="lh-number">~$0K</span>
              </div>
            </div>
            {/* data-swipe-dismiss: the horizontal drag here must NOT bubble to
                MobileNav's swipe-between-tabs gesture (it reads this attr to bail),
                or a fast scrub flings you to the next tab mid-drag. */}
            <div className="lh-trackwrap" data-swipe-dismiss="true">
              <div className="lh-track" />
              <div className="lh-fill" ref={fillRef} />
              <input className="lh-scrub" type="range" min={minAge} max={maxAge} step={1} value={scrubAge}
                aria-label={`Scrub ${childName}'s age to see the projected value of the fund`}
                onTouchStart={(e) => e.stopPropagation()}
                onPointerDown={cancelSpring}
                onPointerUp={springToToday}
                onPointerCancel={springToToday}
                onChange={(e) => { const a = Number(e.target.value); cancelSpring(); scrubAgeRef.current = a; setScrubAge(a); setAge(a); }} />
            </div>
            {/* Just the range ends — the age between them is named dynamically by
                the "At {age}" eyebrow as you drag, and the caption above already
                establishes the {majorityAge} handoff, so a middle tick repeats it. */}
            <div className="lh-agelabels">
              <span>Today</span>
              <span>65</span>
            </div>
            </div>

            <div className="lh-bottom">
            <div className="lh-actions">
          {!isReadOnly && (
            <button className="lh-btn-gift" onClick={onShare}>
              <Share2 size={16} />
              <span>Share {childName}'s link</span>
            </button>
          )}
          {!flatBackdrop && <button className="lh-btn-toggle" data-state={tod} aria-label="Change time of day"
            onClick={() => setTod((cur) => ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length])}>
            <svg className="lh-i-dawn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 9V3M9 6l3-3 3 3" /></svg>
            <svg className="lh-i-day" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            <svg className="lh-i-dusk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 3v6M9 6l3 3 3-3" /></svg>
            <svg className="lh-i-night" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          </button>}
            </div>
            </div>
          </div>
      </div>
    </div>
  );
}

function ordinalSuffix(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const LH_CSS = `
.lh-root{--lh-evergreen:#143A2C;--lh-cream:#F7F3EC;--lh-brass:#C68F30;--lh-gilt:#E3B860;
  --lh-ease-spring:cubic-bezier(.22,1,.36,1);--lh-ease-soft:cubic-bezier(.4,0,.2,1);
  width:100%;max-width:none;margin:0;color:var(--lh-evergreen);
  /* Use the APP's type voice (DM Sans body, Bricolage Grotesque numerals), not
     the prototype's Inter, so the hero reads as native, not pasted in. */
  font-family:var(--font-sans),'DM Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;box-sizing:border-box}
.lh-root *{box-sizing:border-box}
/* Full-bleed to match the app hero (the green hero is edge-to-edge, no radius,
   no shadow). The prototype's rounded floating card fights that treatment. */
/* Immersive full-bleed hero: fills the screen below the 56px header, the square
   landscape SVG covers it (fills vertically, so the header's sky-gradient math is
   unchanged), and content overlays in a top/mid/bottom flex column. */
.lh-hero{position:relative;width:100%;min-height:clamp(392px,52svh,430px);overflow:hidden;background:var(--lh-cream)}
.lh-scene-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
/* Value + Potential group at the top; Share drops to the floor with a modest
   gap (no scene to fill the middle anymore, so the height is trimmed). */
.lh-content{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;justify-content:flex-start;padding:26px 24px 20px;color:var(--lh-evergreen)}
.lh-lighttext .lh-content{color:var(--lh-cream)}
.lh-mid{margin-top:60px}
.lh-bottom{margin-top:auto;display:flex;flex-direction:column}
.lh-lighttext .lh-mid,.lh-lighttext .lh-bottom{text-shadow:0 1px 10px rgba(8,20,14,.3)}
/* Time-of-day COLOR is kept: the sky gradient stops + the atmos grade both
   transition smoothly when the hour (or the toggle) changes. */
.lh-sky-stop{transition:stop-color 1.4s ease}
.lh-atmos{transition:opacity 1.4s ease,fill 1.4s ease}
.lh-layer{opacity:0;animation:lh-layerIn .8s var(--lh-ease-spring) forwards;animation-delay:var(--lh-d,0s)}
@keyframes lh-layerIn{from{opacity:0;transform:translateY(42px)}to{opacity:1;transform:translateY(0)}}
.lh-l-sky{--lh-d:0s}
/* BEAT 2 — the words arrive as the land settles (0.38s), just before the number. */
.lh-overlay{position:relative;opacity:0;animation:lh-textIn .75s var(--lh-ease-spring) .38s forwards}
.lh-giftflash{position:absolute;left:0;top:58px;z-index:4;pointer-events:none;white-space:nowrap;font-family:var(--font-serif),'Bricolage Grotesque',system-ui,sans-serif;font-size:21px;font-weight:700;letter-spacing:-.02em;color:var(--lh-gilt);text-shadow:0 2px 14px rgba(227,184,96,.5);animation:lh-giftRise 2.6s var(--lh-ease-soft) forwards}
.lh-giftflash-name{font-size:15px;font-weight:600;opacity:.85}
@keyframes lh-giftRise{0%{opacity:0;transform:translateY(26px) scale(.9)}14%{opacity:1;transform:translateY(8px) scale(1)}70%{opacity:1;transform:translateY(-2px)}100%{opacity:0;transform:translateY(-40px)}}
@media (prefers-reduced-motion:reduce){.lh-giftflash{animation:none;opacity:1;transform:none}}
.lh-lighttext .lh-overlay .lh-greeting,.lh-lighttext .lh-overlay .lh-label,.lh-lighttext .lh-overlay .lh-balance,.lh-lighttext .lh-overlay .lh-updated{text-shadow:0 1px 10px rgba(8,20,14,.35)}
@keyframes lh-textIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
.lh-greeting{font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-bottom:16px;transition:color .8s ease}
.lh-label{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .8s ease}
.lh-balance{font-family:var(--font-serif),'Bricolage Grotesque',system-ui,sans-serif;font-size:62px;font-weight:700;letter-spacing:-.024em;line-height:1;margin-top:8px;white-space:nowrap;font-variant-numeric:tabular-nums;transition:color .8s ease,filter .5s ease}
.lh-balance .lh-approx{font-size:30px;font-weight:400;color:var(--lh-brass);margin-right:2px;vertical-align:6px}
.lh-balance .lh-cents{font-size:27px;font-weight:400;opacity:.55}
.lh-subline{margin-top:14px;display:flex;align-items:center;gap:10px;font-size:13px;min-height:18px;white-space:nowrap;transition:color .8s ease}
.lh-chip{display:inline-flex;align-items:center;gap:5px;font-weight:600;color:var(--lh-brass);white-space:nowrap}
.lh-chip svg{width:13px;height:13px;flex:0 0 13px}
.lh-meta{opacity:.55;font-weight:400}
.lh-updated{margin-top:4px;font-size:11.5px;line-height:1.3;min-height:15px;letter-spacing:.02em;opacity:.45;transition:opacity .4s ease,color .8s ease}
.lh-greeting,.lh-label,.lh-balance,.lh-subline,.lh-updated{color:var(--lh-evergreen)}
.lh-lighttext .lh-greeting,.lh-lighttext .lh-label,.lh-lighttext .lh-balance,.lh-lighttext .lh-subline,.lh-lighttext .lh-updated{color:var(--lh-cream)}
.lh-lighttext .lh-greeting{opacity:.62}.lh-lighttext .lh-label{opacity:.78}
/* Potential in the mid-sky — tone-aware (inherits currentColor from .lh-content,
   which flips cream/evergreen with the sky), styled to feel like part of the
   scene: a thin luminous track + a glowing dot thumb, not a chrome slider. */
.lh-potential-card{position:relative;padding:0}
.lh-horizon-copy{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:9px}
.lh-horizon-title{display:inline-flex;align-items:center;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.62}
.lh-horizon-state{text-align:right;font-variant-numeric:tabular-nums;line-height:1;min-height:31px;white-space:nowrap}
.lh-horizon-state .lh-eyebrow{font-size:11px;font-weight:650;letter-spacing:.04em;opacity:.6;margin-right:7px}
.lh-horizon-state .lh-number{font-family:var(--font-serif),'Bricolage Grotesque',system-ui,sans-serif;font-size:22px;font-weight:650;letter-spacing:-.035em}
.lh-horizon-state .lh-rangeNum{font-size:16px;font-weight:650;letter-spacing:-.02em;white-space:nowrap}
.lh-horizon-state .lh-range{font-size:10px;font-weight:600;letter-spacing:.01em;opacity:.55;margin-top:2px;white-space:nowrap}
.lh-trackwrap{position:relative;height:34px;display:flex;align-items:center}
.lh-track{position:absolute;left:0;right:0;top:50%;height:3px;transform:translateY(-50%);background:currentColor;opacity:.24;border-radius:999px}
.lh-fill{position:absolute;left:0;top:50%;height:3px;transform:translateY(-50%);background:currentColor;opacity:.85;border-radius:999px;width:0%;box-shadow:0 0 10px 1px currentColor}
.lh-scrub{position:relative;width:100%;appearance:none;-webkit-appearance:none;background:transparent;height:34px;cursor:pointer;z-index:2;margin:0}
.lh-scrub::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:currentColor;border:none;box-shadow:0 0 0 4px rgba(247,243,236,.14),0 0 14px 3px currentColor;transition:transform .18s var(--lh-ease-spring),box-shadow .2s ease}
.lh-scrub:active::-webkit-slider-thumb{transform:scale(1.14);box-shadow:0 0 0 6px rgba(247,243,236,.18),0 0 20px 5px currentColor}
.lh-scrub::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:currentColor;border:none;box-shadow:0 0 14px 3px currentColor}
.lh-scrub:focus-visible{outline:none}
.lh-scrub:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px var(--lh-brass),0 0 14px 3px currentColor}
.lh-agelabels{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;letter-spacing:.04em;font-variant-numeric:tabular-nums;margin-top:1px;opacity:.72}
.lh-actions{display:flex;align-items:center;gap:12px;margin-top:14px}
.lh-btn-gift{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;appearance:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:700;letter-spacing:.01em;color:#fff;background:hsl(var(--kiddo-gold));padding:16px 20px;border-radius:14px;transition:transform .18s var(--lh-ease-spring),box-shadow .25s ease,filter .25s ease;box-shadow:0 1px 2px rgba(14,37,24,.22),0 5px 14px rgba(14,37,24,.16),inset 0 1px 0 rgba(255,255,255,.18)}
.lh-btn-gift svg{flex:0 0 auto}
.lh-btn-gift:hover{filter:brightness(1.05);transform:translateY(-1px)}
.lh-btn-gift:active{transform:translateY(0) scale(.985)}
.lh-btn-gift:focus-visible{outline:2.5px solid #fff;outline-offset:2px}
.lh-btn-toggle{appearance:none;cursor:pointer;width:54px;height:54px;flex:0 0 54px;border-radius:16px;border:1.5px solid currentColor;background:rgba(247,243,236,.08);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;color:inherit;transition:background .2s ease,transform .18s var(--lh-ease-spring)}
.lh-btn-toggle:hover{background:rgba(247,243,236,.16);transform:translateY(-1px)}
.lh-btn-toggle:focus-visible{outline:2.5px solid var(--lh-brass);outline-offset:2px}
.lh-btn-toggle svg{width:22px;height:22px;display:none}
.lh-btn-toggle[data-state="dawn"] .lh-i-dawn{display:block}
.lh-btn-toggle[data-state="day"] .lh-i-day{display:block}
.lh-btn-toggle[data-state="dusk"] .lh-i-dusk{display:block}
.lh-btn-toggle[data-state="night"] .lh-i-night{display:block}
.lh-caption{text-align:center;font-size:11.5px;opacity:.62;margin-top:14px;letter-spacing:.02em}
@media (max-width:400px){.lh-balance{font-size:54px}}
@media (prefers-reduced-motion:reduce){
  .lh-layer,.lh-overlay{animation:none!important;opacity:1!important;transform:none!important}
}
`;
