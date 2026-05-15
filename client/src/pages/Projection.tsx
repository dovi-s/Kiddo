import { useState, useMemo, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Share2, Info } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { useFunds } from "@/hooks/use-funds";
import { ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { useQuery } from "@tanstack/react-query";
import { getAge18Transition } from "@/lib/age-transition";
import { sumMonthlyEquivalent, WEEKS_PER_MONTH, DAYS_PER_MONTH } from "@shared/recurring-math";
import { projectFundValue } from "@shared/projection";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCountUp as useSharedCountUp } from "@/hooks/use-count-up";

// Thin local wrapper around shared/projection.ts so the original
// call signature in this file keeps working. The shared helper is
// the canonical math (locked: 7% annual compounded monthly, 0.10%
// AUM fee netted out, two-phase contribution window, no
// hardcoded majority age). See shared/projection.ts for the math
// + the audit history that motivated extracting it.
function projectFund(
  currentBalance: number,
  monthlyContribution: number,
  annualReturnRate: number,
  years: number,
  contributionYears?: number,
): number {
  return projectFundValue({
    startingValue: currentBalance,
    monthlyContribution,
    yearsAhead: years,
    contributionYears,
    annualReturnRate,
  });
}

function fmtMoney(n: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

// Thin wrapper around the shared `useCountUp` hook (`hooks/use-count-up.ts`)
// so this page's call signature stays "pass a target, get a number." The
// previous local implementation was a duplicate of the shared hook with a
// different easing curve (cubic vs. expo) and duration (420 vs. 800ms),
// which violated `project_count_up_animation_consistency.md`. The wrapper
// preserves the slider-drag UX (420ms; values rounded to int because the
// projection is whole-dollar) while routing through the shared primitive
// — so the OS `prefers-reduced-motion` check, the consistency-pass
// duration-ladder, and any future improvements at the hook level
// automatically apply here.
function useCountUp(target: number, duration = 420): number {
  const { value } = useSharedCountUp({ to: target, duration });
  return Math.round(value);
}

// Snap-to milestones — the slider stops at exactly these ages, not every year. The point
// is to make age feel personal ("when she's 30") rather than abstract ("13 years from now").
const MILESTONE_AGES = [18, 21, 25, 30, 40, 50, 65] as const;

const RETURN_RATES = [
  { id: "conservative", label: "Conservative", rate: 0.05, sub: "5% / yr" },
  { id: "moderate", label: "Moderate", rate: 0.07, sub: "7% / yr" },
  { id: "optimistic", label: "Optimistic", rate: 0.09, sub: "9% / yr" },
] as const;

// Round-number presets for the monthly lever sheet. $0 stays in the list because "what if
// I added nothing" is a real comparison parents want to make.
const MONTHLY_PRESETS = [0, 25, 50, 100, 250, 500] as const;

export default function Projection() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/projection/:fundId");
  const fundId = params?.fundId || "";

  const { data: funds = [] } = useFunds();
  const activeFund = funds.find((f) => f.id === fundId);

  // Sync URL with the global active-fund context. The header's fund switcher
  // (and any other UI that calls setActiveFundId) dispatches the
  // ACTIVE_FUND_CHANGE_EVENT, but the Projection page resolves its fund from
  // the URL only — so a fund switch left the URL on the previous fund and
  // the page kept showing the old child's projection. Now: when the active
  // fund changes, navigate to /projection/{newFundId} so the page re-resolves
  // to the right fund.
  useEffect(() => {
    const handler = (e: Event) => {
      const newId = (e as CustomEvent<{ id: string }>).detail?.id;
      if (newId && newId !== fundId) {
        setLocation(`/projection/${newId}`);
      }
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, [fundId, setLocation]);

  const totalValue = useMemo(() => {
    if (!activeFund) return 0;
    return (
      parseFloat(String(activeFund.balance || 0)) +
      parseFloat(String(activeFund.pendingBalance || 0)) +
      parseFloat(String((activeFund as any).cashBalance || 0))
    );
  }, [activeFund]);

  // State-specific majority age — UTMA transfer is 18 by default but can be
  // 19 / 20 / 21 depending on state law. Locked-discipline rule
  // (filed 2026-05-12): every user-visible "18" must derive from this
  // variable, never be hardcoded. Same shape as the pronoun audit on this
  // page's sibling surfaces — derived value exists, must be plumbed
  // through copy. Falls back to 18 when fund.majorityAge isn't set.
  const majorityAge = Number((activeFund as any)?.majorityAge) || 18;
  // Ordinal form for "{X}th birthday" copy. UTMA values 18-21 only:
  // 18/19/20 → "Xth", 21 → "21st". Future-proof for arbitrary n via
  // standard English ordinal rules.
  const majorityOrdinal = (() => {
    const n = majorityAge;
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
    const lastOne = n % 10;
    if (lastOne === 1) return `${n}st`;
    if (lastOne === 2) return `${n}nd`;
    if (lastOne === 3) return `${n}rd`;
    return `${n}th`;
  })();

  const age18Transition = useMemo(
    () => getAge18Transition(activeFund?.recipientBirthdate, majorityAge),
    [activeFund?.recipientBirthdate, majorityAge],
  );

  // `yearsTo18` and `currentAge` variable names retained for stability —
  // their VALUES are correctly majority-age-aware (not literally "18").
  // `daysUntil18` from getAge18Transition is already majority-aware.
  const yearsTo18 = age18Transition ? Math.max(0, age18Transition.daysUntil18 / 365.25) : 0;
  const currentAge = age18Transition ? Math.max(0, majorityAge - yearsTo18) : 0;

  const { data: parentContributions = [] } = useQuery<any[]>({
    queryKey: ["projection-parent-contributions", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/parent-contributions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fundId,
    staleTime: 60_000,
  });

  // Sum all active recurring schedules normalized to monthly. This is the truth the
  // page seeds the monthly lever to. Uses the shared toMonthlyEquivalent helper so
  // every surface (Dashboard summary, hero projection, this page, server worker)
  // agrees — historically two factors floated around (4.333 vs 4.345) and the same
  // schedules rendered as $725 in one place and $727 in another.
  const activeMonthly = useMemo(() => {
    const activeRows = (parentContributions as any[]).filter(
      (c) => String(c?.status || "").toLowerCase() === "active",
    );
    return Math.round(sumMonthlyEquivalent(activeRows));
  }, [parentContributions]);

  // Per-schedule breakdown for the "Use my current rate" line in the Change sheet — so
  // the parent can SEE that "$677/mo combined" came from "$25/mo + $50/wk + $100/wk"
  // instead of trusting a number that's quietly normalizing weekly schedules to monthly
  // equivalents under the hood.
  const activeScheduleBreakdown = useMemo(() => {
    const items: Array<string> = [];
    for (const c of parentContributions as any[]) {
      if (String(c.status || "").toLowerCase() !== "active") continue;
      const amt = parseFloat(String(c.amount || "0"));
      if (!Number.isFinite(amt) || amt <= 0) continue;
      const freq = String(c.frequency || "").toLowerCase();
      const freqAbbr =
        freq === "monthly" ? "mo"
          : freq === "weekly" ? "wk"
            : freq === "daily" ? "day"
              : freq === "yearly" ? "yr"
                : freq;
      items.push(`$${Math.round(amt)}/${freqAbbr}`);
    }
    return items;
  }, [parentContributions]);

  // Only show milestones the child hasn't already passed. For a 17-year-old, all 7 apply.
  // For a fund tied to a 35-year-old (Personal account), only 40 / 50 / 65 show.
  const visibleMilestones = useMemo(
    () => MILESTONE_AGES.filter((age) => age > currentAge),
    [currentAge],
  );

  // Slider index into visibleMilestones. Default to the LAST one (age 65 for kids) — the
  // emotional anchor per the user spec ("the number that makes parents put their phone
  // down and stare at the ceiling").
  const [milestoneIdx, setMilestoneIdx] = useState<number>(0);
  useEffect(() => {
    if (visibleMilestones.length === 0) return;
    setMilestoneIdx((prev) =>
      prev >= visibleMilestones.length || prev < 0 ? visibleMilestones.length - 1 : prev,
    );
    // Run once when milestones first become non-empty so the slider lands on age 65.
    // After that the parent's drags own it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMilestones.length]);

  // Seed from `activeMonthly` once schedules load. The page entry has to MATCH
  // the dashboard hero's number, otherwise the parent taps "$165k at 65" on the
  // hero and lands on a "$708 at 18 / $0/mo" page that contradicts what they
  // were just promised. The Change sheet still lets them slide to $0 ("what if
  // we stopped today") or to any other amount; this is just the honest default.
  const [monthly, setMonthly] = useState<number>(0);
  const [monthlySeeded, setMonthlySeeded] = useState(false);
  useEffect(() => {
    if (monthlySeeded) return;
    // Only seed AND lock when we actually have a real activeMonthly > 0. If we
    // locked on the initial activeMonthly = 0 reading (query still loading), we'd
    // miss the eventual real value and the page would default to $0/mo forever.
    // Parents with no recurring stay at $0 by design (correct default for them).
    if (activeMonthly > 0) {
      setMonthly(activeMonthly);
      setMonthlySeeded(true);
    }
  }, [activeMonthly, monthlySeeded]);

  // UTMA accounts cap parent contributions at age 18 (control transfers to the
  // child). Personal accounts have no such cap — the parent funds their own
  // account indefinitely. This single boolean drives the projection model fork.
  const isUtma = String((activeFund as any)?.accountType || "").toLowerCase() === "utma";

  const [rateId, setRateId] = useState<(typeof RETURN_RATES)[number]["id"]>("moderate");

  // "Change monthly" sheet — opens with the current monthly preselected. The pending
  // value lets the parent preview an option before committing via the Update button.
  const [changeSheetOpen, setChangeSheetOpen] = useState(false);
  const [pendingMonthly, setPendingMonthly] = useState<number>(0);
  const [customInput, setCustomInput] = useState<string>("");
  const [explainerOpen, setExplainerOpen] = useState(false);

  const openChangeSheet = () => {
    haptic("selection");
    setPendingMonthly(monthly);
    setCustomInput(MONTHLY_PRESETS.includes(monthly as any) ? "" : String(monthly));
    setChangeSheetOpen(true);
  };

  const applyMonthlyChange = () => {
    haptic("selection");
    setMonthly(pendingMonthly);
    setChangeSheetOpen(false);
  };

  const targetAge = visibleMilestones[milestoneIdx] ?? 65;
  const yearsAhead = Math.max(0, targetAge - currentAge);
  const rate = RETURN_RATES.find((r) => r.id === rateId) ?? RETURN_RATES[1];

  // For UTMAs, contributions only flow until the child turns 18. For personal
  // accounts (or if we somehow have no birthdate), use the full horizon.
  const contributionYearsCap = isUtma ? Math.max(0, Math.min(yearsAhead, yearsTo18)) : yearsAhead;

  const projected = useMemo(
    () => projectFund(totalValue, monthly, rate.rate, yearsAhead, contributionYearsCap),
    [totalValue, monthly, rate.rate, yearsAhead, contributionYearsCap],
  );

  // All three rates' projections, so the hero can show the band as a
  // calm subtitle without forcing the parent to chip-tap through each.
  // The 5-to-9 spread over a 47-year horizon (kid at 18 → kid at 65)
  // is ~6× — that's the compounding lesson visible at-a-glance instead
  // of buried behind interaction. The selected rate stays the hero
  // number; the OTHER two are surfaced as small text alongside.
  const projectedByRate = useMemo(() => {
    return RETURN_RATES.map((r) => ({
      id: r.id,
      sub: r.sub,
      rate: r.rate,
      value: projectFund(totalValue, monthly, r.rate, yearsAhead, contributionYearsCap),
    }));
  }, [totalValue, monthly, yearsAhead, contributionYearsCap]);
  // "You contributed" is the realistic total — current balance plus monthly
  // contributions for ONLY the months they actually flow (capped at 18 for UTMAs).
  // Under the old continuous model this number was inflated by 47 years of
  // post-18 contributions that never happen, which made parent contribution
  // look more impressive than the market growth. Two-phase truth: small
  // contributed, big market growth. That IS the compounding lesson.
  const totalContributed = useMemo(
    () => totalValue + monthly * Math.round(contributionYearsCap * 12),
    [totalValue, monthly, contributionYearsCap],
  );
  const marketAdded = Math.max(0, projected - totalContributed);

  // Pending preview (used inside the change sheet so the parent can see what tapping a
  // preset would do at the slider's current age before committing).
  const pendingPreview = useMemo(
    () => projectFund(totalValue, pendingMonthly, rate.rate, yearsAhead, contributionYearsCap),
    [totalValue, pendingMonthly, rate.rate, yearsAhead, contributionYearsCap],
  );

  const childName = capFirst(activeFund?.recipientFirstName) || "your child";
  const she = activeFund?.recipientFirstName ? "she" : "they";
  const her = activeFund?.recipientFirstName ? "her" : "their";
  const possessive = `${childName}${childName.endsWith("s") ? "'" : "'s"}`;

  const fundSlug = (activeFund as any)?.slug;
  const handleShare = async () => {
    haptic("medium");
    // Tighten the loop: pass the live projection number and target age along to the
    // gift checkout page. When a recipient lands there, GiftCheckout echoes the same
    // "$X at age Y" line the parent just shared, so the message and the destination
    // tell the same story instead of one teasing a number the other never mentions.
    const params = new URLSearchParams();
    if (projected > 0) params.set("potential", String(projected));
    if (targetAge > 0) params.set("age", String(targetAge));
    if (monthly > 0) params.set("monthly", String(monthly));
    if (rate?.rate) params.set("rate", String(rate.rate));
    const baseUrl = fundSlug
      ? `${window.location.origin}/${fundSlug}`
      : `${window.location.origin}/gift`;
    const queryString = params.toString();
    const shareUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    // Friend-texting-a-friend tone: lead with what the parent did, show the today→future
    // through-line as a single readable sentence, end with a soft CTA. Uses the child's
    // name everywhere it can (instead of "by the time she is 65") so it reads naturally.
    // Monthly tag only appears when the slider is non-zero — silence is honest at $0.
    const named = !!activeFund?.recipientFirstName;
    const childOrPronoun = named ? capFirst(activeFund!.recipientFirstName!) : "they";
    const verb = named ? "is" : "are";
    const childPossessive = named ? `${childOrPronoun}'s` : "their";
    const monthlyTag = monthly > 0 ? ` (with ${fmtMoney(monthly)}/mo)` : "";
    const text = `I started a fund for ${childOrPronoun}. ${fmtMoney(totalValue)} today → could be ${fmtMoney(projected)} by the time ${childOrPronoun} ${verb} ${targetAge}${monthlyTag} 🌱

Add a gift if you want to be part of ${childPossessive} story:
${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${possessive} potential`, text });
      } else {
        await navigator.clipboard.writeText(text);
        // Switched to elegant "saved" pill variant 2026-05-12 — the default
        // toast variant was reading too heavy for a "Copied" confirmation,
        // and the prior description ("Paste anywhere — the link goes straight
        // to Emma's gift page") was redundant (parent just clicked Share,
        // they know what was copied) + violated the no-em-dash rule
        // (feedback_no_emdash.md). The saved variant auto-dismisses in 1200ms
        // and reads as the calm Apple-Settings register Kora locks for
        // transient feedback.
        toast({ title: "Link copied", variant: "saved" });
      }
    } catch {
      // user cancelled — no-op
    }
  };

  const handleIncreaseAutoInvest = () => {
    haptic("medium");
    setChangeSheetOpen(false);
    setLocation("/settings");
  };

  if (!activeFund) {
    return (
      <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
        <AppHeader />
        <div className="kiddo-canvas px-4 py-6 max-w-lg">
          <p className="text-sm text-muted-foreground">Loading projection…</p>
        </div>
      </div>
    );
  }

  // Smoothly animate the projected number on every slider/lever change.
  const projectedDisplay = useCountUp(projected);
  // Filled portion of the slider track for the gradient. With N stops, slot i fills
  // i/(N-1) of the track. Single-stop case renders fully filled.
  const sliderFillPct = visibleMilestones.length > 1
    ? (milestoneIdx / (visibleMilestones.length - 1)) * 100
    : 100;

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
      <AppHeader />
      <div className="kiddo-canvas px-4 py-6 space-y-6 max-w-lg">
        {/* Back */}
        <button
          type="button"
          onClick={() => { haptic("selection"); setLocation("/dashboard"); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
          data-testid="button-projection-back"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        {/* Title */}
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
            {possessive} Potential <span aria-hidden>🌱</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Drag the age slider to feel the future. The number updates as you move.
          </p>
        </div>

        {/* HERO: today + slider + projected number + breakdown + tagline */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl p-6 text-white space-y-6"
          style={{
            background: "linear-gradient(135deg, rgb(26,67,50) 0%, rgb(34,80,60) 50%, rgb(46,94,72) 100%)",
            boxShadow: "0 12px 40px rgba(26,67,50,0.25)",
          }}
          data-testid="section-headline"
        >
          {/* Today */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/60 mb-1">Today</p>
            <p className="text-2xl font-bold tabular-nums" data-testid="text-projection-current">
              {fmtMoney(totalValue, 2)}
            </p>
          </div>

          {/* Age slider — snap to milestones. Custom-styled track + thumb so it actually
              feels like Kiddo: cream/translucent track, evergreen-on-gold filled portion,
              gold thumb. Browser default `accent-color` doesn't get this. */}
          {visibleMilestones.length > 0 && (
            <div>
              {/* Scoped slider styling. Lives inside the component so it travels with the
                  page and doesn't pollute the global stylesheet. The inline gradient on the
                  WebKit track is generated below from sliderFillPct so the filled portion
                  follows the thumb position smoothly as the parent drags. */}
              <style>{`
                input.kiddo-age-slider { -webkit-appearance: none; appearance: none; background: transparent; height: 28px; padding: 0; cursor: pointer; }
                input.kiddo-age-slider:focus { outline: none; }
                input.kiddo-age-slider::-webkit-slider-runnable-track {
                  height: 6px; border-radius: 9999px;
                  background: linear-gradient(to right,
                    rgb(255,217,142) 0%,
                    rgb(255,217,142) var(--kiddo-fill, 50%),
                    rgba(255,255,255,0.18) var(--kiddo-fill, 50%),
                    rgba(255,255,255,0.18) 100%);
                }
                input.kiddo-age-slider::-moz-range-track {
                  height: 6px; border-radius: 9999px;
                  background: rgba(255,255,255,0.18);
                }
                input.kiddo-age-slider::-moz-range-progress {
                  height: 6px; border-radius: 9999px;
                  background: rgb(255,217,142);
                }
                input.kiddo-age-slider::-webkit-slider-thumb {
                  -webkit-appearance: none; appearance: none;
                  width: 22px; height: 22px; border-radius: 9999px;
                  background: rgb(255,255,255);
                  border: 3px solid rgb(184,121,26);
                  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                  margin-top: -8px; cursor: grab;
                  transition: transform 0.12s ease;
                }
                input.kiddo-age-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.08); }
                input.kiddo-age-slider::-moz-range-thumb {
                  width: 22px; height: 22px; border-radius: 9999px;
                  background: rgb(255,255,255);
                  border: 3px solid rgb(184,121,26);
                  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                  cursor: grab;
                }
              `}</style>
              <input
                type="range"
                min={0}
                max={Math.max(0, visibleMilestones.length - 1)}
                step={1}
                value={milestoneIdx}
                onChange={(e) => { haptic("light"); setMilestoneIdx(parseInt(e.target.value, 10)); }}
                data-testid="slider-target-age"
                className="w-full kiddo-age-slider"
                style={{ ["--kiddo-fill" as any]: `${sliderFillPct}%` }}
              />
              <div className="flex justify-between mt-1">
                {visibleMilestones.map((age, idx) => {
                  // Majority age is the inflection point for UTMA accounts —
                  // contributions stop, control transfers to the kid. Mark
                  // the majority-age tick with a small dot above it so the
                  // slider's two-phase nature reads visually: dragging past
                  // majority means "this is what compounds without your
                  // contributions." Only fires for UTMA; personal accounts
                  // have no such inflection. State-aware: 18 in most states,
                  // 21 in some (CA, MD, etc.). Fund's majorityAge field
                  // drives the comparison. Edge case: states with majority
                  // 19/20 don't have those in MILESTONE_AGES so no inflection
                  // mark renders — acceptable since those are rare states.
                  const isUtmaInflection = isUtma && age === majorityAge;
                  return (
                    <button
                      key={age}
                      type="button"
                      onClick={() => { haptic("light"); setMilestoneIdx(idx); }}
                      data-testid={`milestone-tap-${age}`}
                      className="px-1 py-0.5 -mx-0.5 relative"
                      title={isUtmaInflection ? `${childName} takes control at ${majorityAge}` : undefined}
                      style={{
                        fontSize: 11,
                        fontWeight: idx === milestoneIdx ? 800 : 600,
                        color: idx === milestoneIdx ? "rgb(255,217,142)" : "rgba(255,255,255,0.5)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        transition: "color 0.18s",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {isUtmaInflection && (
                        <span
                          aria-hidden
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                          style={{ background: "rgb(255,217,142)", opacity: 0.85 }}
                        />
                      )}
                      {age}
                    </button>
                  );
                })}
              </div>
              {/* Inflection caption — surfaces what the dot above majority
                  age means without forcing the parent to hover or guess.
                  Only renders for UTMA where the inflection is real, AND
                  only when the kid's majority age is in the visible milestone
                  set (18/21 are; 19/20 aren't, so the caption hides for those
                  rare states — same edge case as the dot itself). */}
              {isUtma && visibleMilestones.includes(majorityAge as any) && (
                <p className="text-[10px] italic text-white/55 mt-1 text-center">
                  {childName} takes control at {majorityAge} · what grows past then is pure market compound
                </p>
              )}
            </div>
          )}

          {/* The big projected number — count-up animated. Fades in slightly on each
              update too so the change feels alive, not a hard repaint. */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/60 mb-1">
              At age {targetAge}
            </p>
            <p
              className="font-heading text-5xl sm:text-6xl font-bold tabular-nums text-white leading-none"
              data-testid="text-projection-value"
              style={{ letterSpacing: "-0.02em" }}
            >
              {fmtMoney(projectedDisplay)}
            </p>
            {/* Rate-band subtitle — shows the OTHER two rates' projections
                alongside the headline so the parent feels the variance
                of compounding without having to chip-tap each rate. The
                5-to-9 spread over a 47-year horizon (kid at 18 → 65) is
                roughly 6× — that's the compounding lesson the hero
                number alone hides. Suppressed when yearsAhead is 0
                (nothing to project) so the line doesn't appear with
                three identical "today" values. Per the 2026-05-13 audit
                on whether we're showing the magnitude brilliantly. */}
            {yearsAhead > 0 && (
              <p className="text-[11px] text-white/55 mt-2 tabular-nums">
                {projectedByRate
                  .filter((r) => r.id !== rateId)
                  .map((r) => `${r.sub.replace(" / yr", "")}: ${fmtMoney(r.value)}`)
                  .join("   ·   ")}
              </p>
            )}
            {/* Inline assumption note — locks the projection's two-phase
                nature to the parent's eye instead of burying it in the
                disclaimer below. For UTMA accounts: contributions through
                18 + market compound after. For personal accounts:
                contributions continue throughout. Without this line, a
                parent looking at "$42,891 at 65" might assume $50/mo
                continued for 47 years (which would be incorrect for UTMA);
                this surfaces the actual model in one quiet sentence. */}
            {monthly > 0 && targetAge > currentAge && (
              <p className="text-xs italic text-white/65 mt-2 leading-relaxed">
                {isUtma
                  ? targetAge <= majorityAge
                    ? <>Assumes {fmtMoney(monthly)}/mo through {childName}'s {majorityOrdinal} birthday.</>
                    : <>Assumes {fmtMoney(monthly)}/mo through {childName}'s {majorityOrdinal} birthday, then market growth alone.</>
                  : <>Assumes {fmtMoney(monthly)}/mo for the full duration.</>
                }
              </p>
            )}
          </div>

          {/* Contribution breakdown — the "feel it working" moment */}
          <div className="rounded-2xl bg-white/8 border border-white/10 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Of that</p>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-white/80">You added</p>
              <p className="text-sm font-bold tabular-nums text-white">{fmtMoney(totalContributed)}</p>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-white/80">Market added</p>
              <p className="text-sm font-bold tabular-nums text-[hsl(143,55%,72%)]">
                +{fmtMoney(marketAdded)} 🌱
              </p>
            </div>
          </div>

          {/* Tagline removed 2026-05-12 — italic teaser quote violated
              feedback_no_marketing_teaser_quotes.md ("italic 'doesn't just
              X. She Y.' promo quotes are AI-slop on signed-in product
              surfaces — eyebrow + content + CTA is enough"). The section
              above (Today + slider + projection breakdown + "what grows
              past then is pure market compound" subtitle at line 515)
              already lands the message; the italic line was rhetorical-
              marketing-voice noise on a calm product surface. */}
        </motion.section>

        {/* Monthly contribution lever. The "until [Child] turns 18" subline matters:
            without it, parents read "$677/mo" as a forever-implied number and assume
            it flows for the full horizon. UTMA reality is contributions stop at 18.
            Surfacing the cap inline beats burying it in the disclaimer. */}
        <button
          type="button"
          onClick={openChangeSheet}
          data-testid="button-change-monthly"
          className="w-full flex items-center justify-between rounded-2xl border border-border bg-card hover:bg-muted/40 transition-colors p-4"
        >
          <div className="text-left min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Monthly contribution
            </p>
            <p className="font-heading text-xl font-bold tabular-nums text-foreground">
              {fmtMoney(monthly)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
            </p>
            {monthly > 0 && isUtma && yearsTo18 > 0 && (() => {
              // Months remaining until 18, rounded honest.
              const monthsLeft = Math.max(0, Math.round(yearsTo18 * 12));
              const yearsLeftDisplay = yearsTo18 >= 1
                ? `${monthsLeft} months until ${childName} turns ${majorityAge}`
                : `${monthsLeft === 1 ? "1 month" : `${monthsLeft} months`} until ${childName} turns ${majorityAge}`;
              return (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {yearsLeftDisplay}
                </p>
              );
            })()}
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">
            Change
            <ArrowRight size={14} />
          </span>
        </button>

        {/* Return rate — tertiary, below the monthly lever */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Assumed return
            </p>
            <button
              type="button"
              onClick={() => { haptic("selection"); setExplainerOpen(true); }}
              data-testid="button-rate-explainer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info size={11} />
              How we calculate this
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {RETURN_RATES.map((r) => {
              const active = r.id === rateId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { haptic("selection"); setRateId(r.id); }}
                  data-testid={`button-rate-${r.id}`}
                  className={`rounded-lg px-2 py-2 text-center transition-all ${
                    active
                      ? "bg-[hsl(var(--kiddo-evergreen))] text-white"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <p className="text-[10px] font-semibold leading-tight">{r.label}</p>
                  <p className="text-[11px] font-bold tabular-nums leading-tight">{r.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* "Power of starting early" comparison section deleted 2026-05-13.
            Was previously age-gated to currentAge < 10 (after the 2026-05-12
            partial restraint pass that hid it for older kids per
            feedback_no_greenwashing_losses.md). Audit landed at: the slider
            hero above already does the projection job for every kid; the
            comparison tiles ("wildly different at 18") read as Acorns-style
            marketing copy that doesn't match Kiddo's calm register; and
            parents of kids under 10 don't need to be sold on starting early
            because they ALREADY started. Preaching to the choir at a volume
            that doesn't match the brand. Deleted entirely. */}

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          data-testid="button-share-projection"
          className="w-full rounded-2xl bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.92)] text-white py-4 font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Share2 size={16} />
          Share {possessive} potential 🎁
        </button>

        {/* Disclaimer. Honest about the model: contributions stop at 18 for UTMAs
            (which matches the math), continuous for personal accounts. No em-dashes
            per the locked copy rule. */}
        <p className="text-[10.5px] text-muted-foreground/80 leading-relaxed text-center px-2">
          For illustrative purposes only. Based on long-term historical market averages, not guaranteed.{" "}
          {isUtma
            ? <>Assumes monthly investing continues until {childName}'s {majorityOrdinal} birthday, then pure compound at the chosen rate. At {majorityAge}, UTMA control transfers to {childName}; what {she} does next is {her} decision.</>
            : <>Assumes monthly investing continues at the chosen rate for the full duration.</>
          }{" "}
          Investing involves risk, including possible loss of principal.
        </p>
      </div>

      {/* Change-monthly bottom sheet */}
      <Dialog open={changeSheetOpen} onOpenChange={(o) => { if (!o) setChangeSheetOpen(false); }}>
        <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Change monthly amount</DialogTitle>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-sm font-medium text-primary">Recurring investment</p>
              <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">
                {monthly > 0 ? "Change the monthly amount" : "Add a monthly amount"} <span aria-hidden>🌱</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick an amount, watch the at-{targetAge} number move.
              </p>
            </div>

            {/* Quick-tap row: parent's actual current rate (sum of all active schedules
                normalized to monthly). Surfaces here so a parent who wants their REAL
                trajectory can pull it in with one tap, instead of being defaulted into a
                summed number that surprises them on first load. Only renders when there's
                actually an active rate. */}
            {activeMonthly > 0 && (
              <button
                type="button"
                onClick={() => {
                  haptic("selection");
                  setPendingMonthly(activeMonthly);
                  setCustomInput("");
                }}
                data-testid="preset-current-rate"
                className={`w-full rounded-xl border-2 py-3 px-4 text-left transition-all ${
                  pendingMonthly === activeMonthly && customInput === ""
                    ? "bg-[hsl(var(--kiddo-evergreen)/0.08)] border-[hsl(var(--kiddo-evergreen))]"
                    : "bg-[hsl(var(--kiddo-cream))] border-[hsl(var(--kiddo-evergreen)/0.3)] hover:bg-[hsl(var(--kiddo-cream)/0.7)]"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">
                  Use my current rate
                </p>
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {fmtMoney(activeMonthly)}/mo
                  {activeScheduleBreakdown.length > 1 && (
                    <span className="text-[11px] font-normal text-muted-foreground"> combined</span>
                  )}
                </p>
                {/* Source breakdown — when the combined number wraps multiple schedules,
                    surface them here in their native frequencies so the math is visible.
                    E.g. "$25/mo + $50/wk + $100/wk" → why the combined is $677/mo. */}
                {activeScheduleBreakdown.length > 1 && (
                  <p className="text-[10.5px] text-muted-foreground mt-1 leading-relaxed">
                    {activeScheduleBreakdown.join(" + ")}
                  </p>
                )}
              </button>
            )}

            <div className="grid grid-cols-3 gap-2">
              {MONTHLY_PRESETS.map((amt) => {
                const active = pendingMonthly === amt && customInput === "";
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      haptic("selection");
                      setPendingMonthly(amt);
                      setCustomInput("");
                    }}
                    data-testid={`preset-monthly-${amt}`}
                    className={`rounded-xl py-3 font-bold text-sm transition-all ${
                      active
                        ? "bg-[hsl(var(--kiddo-evergreen))] text-white"
                        : "bg-muted/40 text-foreground hover:bg-muted/60"
                    }`}
                  >
                    ${amt}
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Custom amount
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={5}
                  inputMode="numeric"
                  value={customInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomInput(v);
                    const n = parseInt(v, 10);
                    if (Number.isFinite(n) && n >= 0) setPendingMonthly(n);
                  }}
                  placeholder="Type any amount"
                  data-testid="input-custom-monthly"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>

            <div className="rounded-xl bg-[hsl(var(--kiddo-cream))] border border-[hsl(var(--kiddo-gold)/0.25)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                At {fmtMoney(pendingMonthly)}/mo · age {targetAge}
              </p>
              {/* Cadence equivalence — translates the monthly amount into
                  ~daily and ~weekly so parents who think in those cadences
                  can map without a separate cadence toggle on the input.
                  Uses the shared WEEKS_PER_MONTH (4.348) and DAYS_PER_MONTH
                  (30.4375) so this line agrees with the recurring-schedule
                  math on every other surface. Hidden when monthly is 0
                  (would render "$0.00/day · $0.00/wk" which is noise). */}
              {pendingMonthly > 0 && (() => {
                const perWeek = pendingMonthly / WEEKS_PER_MONTH;
                const perDay = pendingMonthly / DAYS_PER_MONTH;
                // Daily values under $1 deserve cents; bigger ones round
                // to whole dollars to match the at-18 number's register.
                const formatPer = (v: number) => v < 1
                  ? `$${v.toFixed(2)}`
                  : v < 10
                    ? `$${v.toFixed(2)}`
                    : `$${Math.round(v)}`;
                return (
                  <p className="text-[10.5px] italic text-muted-foreground/75 mt-0.5">
                    ≈ {formatPer(perDay)}/day · {formatPer(perWeek)}/week
                  </p>
                );
              })()}
              <p className="font-heading text-2xl font-bold text-foreground tabular-nums mt-1">
                {fmtMoney(pendingPreview)}
              </p>
              {pendingMonthly !== monthly && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {pendingPreview > projected ? "+" : "−"}
                  {fmtMoney(Math.abs(pendingPreview - projected))} vs current scenario
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={applyMonthlyChange}
                data-testid="button-apply-monthly"
                className="w-full rounded-xl py-3 font-bold text-sm text-white bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.92)] transition-colors flex items-center justify-center gap-1.5"
              >
                Update
                <ArrowRight size={14} />
              </button>
              {pendingMonthly > activeMonthly && (
                <button
                  type="button"
                  onClick={handleIncreaseAutoInvest}
                  data-testid="button-go-to-settings"
                  className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Want to actually set this up? Open recurring investment settings →
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return-rate explainer */}
      <Dialog open={explainerOpen} onOpenChange={(o) => { if (!o) setExplainerOpen(false); }}>
        <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">How we calculate the return rate</DialogTitle>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm font-medium text-primary">How we calculate this</p>
              <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">Long-term averages.</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">7%</strong> is roughly the historical average annual return of the US stock market over multi-decade windows. Some years are higher, some are lower, sometimes much lower. Over decades it tends to land in this neighborhood.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">5%</strong> is a more conservative pick, closer to a bond-heavy mix.
              <strong className="text-foreground"> 9%</strong> is optimistic, closer to long-running US equity index returns.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kiddo's <strong className="text-foreground">0.10% annual fee</strong> on invested assets is already netted out of the projection above, so the number you see reflects what stays in the fund.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Past performance is not guaranteed. Investing involves risk, including possible loss of principal.
            </p>
            <button
              type="button"
              onClick={() => setExplainerOpen(false)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
