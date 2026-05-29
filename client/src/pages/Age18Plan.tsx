import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Mic, Image as ImageIcon, Users, Mail } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { NoteEditorSheet } from "@/components/NoteEditorSheet";
import { ScheduledLetterEditor } from "@/components/ScheduledLetterEditor";
import { ScheduledLettersList } from "@/components/ScheduledLettersList";
import { useFunds } from "@/hooks/use-funds";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { getAge18Transition, formatAgeTransitionDate } from "@/lib/age-transition";
import { projectFundValue } from "@shared/projection";
import { sumMonthlyEquivalent } from "@shared/recurring-math";
import { getPronouns } from "@/lib/pronouns";
import { capFirst } from "@/lib/format-name";
import { haptic } from "@/lib/haptics";
import { useCountUp } from "@/hooks/use-count-up";

// Checklist items factory — parameterized on majorityAge so copy reflects the
// fund's state-specific transfer age (18 in most states, 21 in CA/KY/IN,
// 19 in AL/NE, 20 in MS). For 21-state customers, hardcoded "18" reads as
// factually wrong and contradicts the state-aware lifecycle worker. Same
// shape as buildTimeline / buildFaq below.
function buildChecklist(majorityAge: number) {
  return [
    {
      id: "money-convo",
      label: "Have the money conversation",
      detail: `Talk about what the fund is, why you built it, and what you hope they do with it. Start at 15 or 16, before the pressure of ${majorityAge} arrives.`,
    },
    {
      id: "tax-position",
      label: "Understand the tax position",
      detail: "UTMA assets are subject to kiddie tax rules. Talk to a CPA about your situation before the transfer happens.",
    },
    {
      id: "investment-strategy",
      label: "Review the investment strategy",
      detail: `You can review and adjust the mix anytime in Settings. Some families choose a steadier allocation as ${majorityAge} nears; whether to is entirely your call.`,
    },
    {
      id: "estate-docs",
      label: "Set the successor custodian",
      detail: `If something happens to you before ${majorityAge}, who manages the fund? Set the in-app successor in Settings (so support knows who to contact), and make sure your will formally names them as successor custodian under your state's UTMA statute. Both layers matter.`,
    },
    {
      id: "co-parent",
      label: "Align with co-parent or guardian",
      detail: `Both parents should understand what happens at ${majorityAge} and agree on what message to give the child before the transfer.`,
    },
  ];
}

// Timeline + FAQ copy is parameterized on the child's first name
// rather than the previous hardcoded "she / her" — those broke for
// any fund whose pronoun setting is "he" or "they". Using the name
// directly also reads more naturally for adult-tone copy
// ("Tell Emma..." beats "Tell her..." in a written FAQ register).
// The few sentences where the name would feel repetitive use
// neutral phrasings ("the 18th birthday", "the fund") instead of
// pronouns. Inverse of the earlier "always pronoun" approach.
// Timeline + FAQ: parameterized on childName AND state-specific majority age.
// The teenage-stage labels (13-14, 15-16, 17, 17.5) are calibrated to attention
// spans + life-events near the transfer — those age ranges stay. The transfer-
// age references ("after 18", "It is yours at 18", "Age 18") become state-aware.
//
// The few sentences where the name would feel repetitive use neutral
// phrasings ("the {majorityOrdinal} birthday", "the fund") instead of
// pronouns. Inverse of the earlier "always pronoun" approach.
function buildTimeline(childName: string, majorityAge: number, majorityOrdinal: string) {
  return [
    {
      label: "Age 13 to 14",
      heading: "Plant the seed",
      detail: `Tell ${childName} the fund exists. Keep it simple: there is money invested in your name. It is yours at ${majorityAge}. Let curiosity do the rest.`,
    },
    {
      label: "Age 15 to 16",
      heading: "Show the numbers",
      detail: `Walk ${childName} through the fund together. Show the holdings, the gift history, the Memory Book. Start talking about what investing means.`,
    },
    {
      label: "Age 17",
      heading: "Have the real conversation",
      detail: `What does ${childName} want to do after ${majorityAge}? College, a business, hold it longer? Align expectations before the transfer.`,
    },
    {
      label: "Age 17.5",
      heading: "Review tax and legal position",
      detail: "Talk to a CPA. Understand gains, kiddie tax rules, and what the transfer means. File correctly the year it happens.",
    },
    {
      label: `Age ${majorityAge}`,
      heading: "Control transfers",
      detail: `Legal custodianship ends. ${childName} gets full control. The investments stay exactly where they are. Nothing sells. Nothing changes except who decides.`,
    },
  ];
}

function buildFaq(childName: string, majorityAge: number, majorityOrdinal: string) {
  return [
    {
      q: `Does the fund automatically liquidate at ${majorityAge}?`,
      a: `No. Nothing sells automatically. On the ${majorityOrdinal} birthday, legal control transfers under state UTMA law. The investments stay exactly where they are. ${childName} decides whether to hold, sell, or reinvest.`,
    },
    {
      q: `Can ${childName} access the fund before ${majorityAge}?`,
      a: `No. Only you, as the custodian, can authorize transactions before the transfer. After ${majorityAge}, full control transfers.`,
    },
    {
      q: `What if ${childName} doesn't want the money at ${majorityAge}?`,
      a: "The fund can stay invested. Nothing forces a decision. It keeps compounding. There's no rush.",
    },
    {
      q: "What taxes are owed?",
      a: `UTMA gains are taxed to ${childName}, not you. But the kiddie tax can still apply while ${childName} is under 19 (or a full-time student under 24), taxing larger unearned gains at your rate rather than theirs. Once that no longer applies, a low-income young adult's long-term capital gains can be taxed as low as 0%. Talk to a CPA about your specific situation.`,
    },
    {
      q: `What happens if I pass away before ${childName} turns ${majorityAge}?`,
      a: "The successor custodian named in your will takes over management of the fund. If no custodian is named, the court appoints one. Update your estate documents to reflect your wishes.",
    },
  ];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// Projection math is centralized in shared/projection.ts (projectFundValue):
// 7% historical average, 0.10% AUM fee netted, effective monthly compounding,
// contributions capped at the majority window. The disclaimer travels with
// every render so a parent who reconciles against reality never feels oversold.
const KIDDO_PROJECTION_DISCLAIMER = "Assuming 7% yearly average. Markets vary. Time is what compounds.";

function projectAt18(balance: number, yearsLeft: number, monthlyContrib: number): number {
  return projectFundValue({ startingValue: balance, monthlyContribution: monthlyContrib, yearsAhead: yearsLeft });
}

export default function Age18Plan() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: funds = [] } = useFunds();
  // Plan-state for the parent letter media gate. Per the Memory Book
  // tier policy: gifter-attached media is always free (locked retention
  // mechanic), but PARENT-authored Memory Book entries with media are
  // a Kiddo+ differential. The Age18Plan parent letter is parent-authored,
  // so it inherits the gate. Free parents see the upgrade callout inside
  // the NoteEditorSheet's MemoryMediaPicker; paid parents see the full
  // photo/video/voice trio.
  const { data: subscription } = useSubscription();
  const effectivePlan = subscription?.effectivePlan ?? "free";
  const noteEditorRequiresPlus = effectivePlan === "free";
  // Active fund held in component state so the page reacts to AppHeader
  // fund switches. Was reading getActiveFundId() inline every render —
  // pulls fresh from localStorage but doesn't trigger a re-render when
  // the user changes funds (localStorage writes don't auto-rerender
  // React). Same parallel bug Projection.tsx and TaxDocuments.tsx had;
  // same listener-based fix.
  const [storedFundId, setStoredFundId] = useState<string>(() => getActiveFundId());
  useEffect(() => {
    const handler = (e: Event) => {
      const newId = (e as CustomEvent<{ id: string }>).detail?.id;
      if (newId && typeof newId === "string") setStoredFundId(newId);
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  const activeFund = funds.find((f) => f.id === storedFundId) ?? funds[0];

  // Active recurring on THIS fund — used to seed the projection slider's
  // default so the "Projected value at {majority}" centerpiece reflects
  // the parent's REAL monthly (e.g. Luke's $75/mo), not a hardcoded $50
  // that matched no schedule and made this page's headline disagree with
  // the Dashboard's "On track for $X when {child} turns {majority}" number.
  // Same endpoint + monthly-normalization the Dashboard uses.
  const { data: parentContributions = [] } = useQuery<Array<{ amount: string; frequency: string; status: string }>>({
    queryKey: ["/api/funds", activeFund?.id, "parent-contributions"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFund?.id}/parent-contributions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFund?.id,
    staleTime: 30_000,
  });
  // Monthly-equivalent of all ACTIVE schedules, snapped to the slider's
  // 25-step grid and clamped to its 0–300 range. Falls back to 0 (the
  // honest gifts-only floor) when nothing is active — never a fiction.
  const activeRecurringMonthly = useMemo(() => {
    const active = (parentContributions || []).filter(
      (c) => String(c?.status || "").toLowerCase() === "active",
    );
    const monthly = sumMonthlyEquivalent(active as any);
    const snapped = Math.round(monthly / 25) * 25;
    return Math.max(0, Math.min(300, snapped));
  }, [parentContributions]);

  const age18Transition = useMemo(
    () => getAge18Transition(activeFund?.recipientBirthdate, Number((activeFund as any)?.majorityAge) || 18),
    [activeFund?.recipientBirthdate, (activeFund as any)?.majorityAge],
  );

  const totalValue = useMemo(() => {
    if (!activeFund) return 0;
    return (
      parseFloat(String(activeFund.balance || 0)) +
      parseFloat(String(activeFund.pendingBalance || 0)) +
      parseFloat(String((activeFund as any).cashBalance || 0))
    );
  }, [activeFund]);

  const yearsLeft = age18Transition ? age18Transition.daysUntil18 / 365.25 : 0;

  // Minute-tick — once-per-minute re-render so the live countdown's hour and
  // minute values stay current. Deliberately NOT once-per-second:
  //   - Seconds-resolution on a 4000+-day countdown is the streak/dazzle
  //     pattern feedback_no_ai_slop.md rejects
  //   - 1Hz re-renders are pointless CPU when the visible numbers don't move
  // Once-per-minute is enough for the hours/minutes line to feel alive
  // (it ticks visibly when you're staring at the page) without becoming a
  // game.
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMinuteTick((t) => (t + 1) % 1_000_000), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Compute the live countdown from the actual 18th-birthday timestamp.
  // Re-runs every minute via minuteTick. Returns null when adult/no fund —
  // the countdown card is gated separately.
  const liveCountdown = useMemo(() => {
    if (!age18Transition || age18Transition.stage === "adult") return null;
    const target = age18Transition.eighteenthBirthday.getTime();
    const now = Date.now();
    const diffMs = Math.max(0, target - now);
    const totalMinutes = Math.floor(diffMs / 60_000);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    const years = Math.floor(totalDays / 365.25);
    const daysAfterYears = Math.floor(totalDays - years * 365.25);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    return {
      years,
      daysAfterYears,
      hours,
      minutes,
      totalDays,
      // When the event is 5+ years out, the hours/minutes line is visually
      // inert (the numbers do change but the eye doesn't notice on a 4000+
      // day count). Hide them then to keep the screen calm.
      showHoursMinutes: totalDays <= 365 * 5,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age18Transition, minuteTick]);

  const projections = [
    { label: "Gifts only, no monthly", monthly: 0 },
    { label: "+ $25/month recurring", monthly: 25 },
    { label: "+ $50/month recurring", monthly: 50 },
    { label: "+ $100/month recurring", monthly: 100 },
  ].map((p) => ({ ...p, value: projectAt18(totalValue, yearsLeft, p.monthly) }));

  // Count-up on the projection numbers. Two surfaces here:
  //   1. The "On track for" hero number — projectionAt18 from current
  //      fund state (zero-monthly scenario).
  //   2. The four "What it could look like" scenarios in the grid
  //      below.
  // The countdown clock above intentionally STAYS plain — it ticks
  // every minute by design and a count-up there would conflict with
  // the live-update register.
  const heroProjection = projectAt18(totalValue, yearsLeft, 0);
  const { value: animatedHeroProjection, isAnimating: heroProjectionAnimating } = useCountUp({
    from: heroProjection * 0.6,
    to: heroProjection,
    duration: 1200,
    enabled: heroProjection > 0,
  });
  // Each scenario gets its own count-up. The four are hoisted to
  // fixed-position hooks (rules-of-hooks) and re-bound to the
  // corresponding scenario's value via array indexing below.
  const { value: animatedProj0, isAnimating: proj0Animating } = useCountUp({
    from: projections[0].value * 0.6,
    to: projections[0].value,
    duration: 1200,
    enabled: projections[0].value > 0,
  });
  const { value: animatedProj1, isAnimating: proj1Animating } = useCountUp({
    from: projections[1].value * 0.6,
    to: projections[1].value,
    duration: 1200,
    enabled: projections[1].value > 0,
  });
  const { value: animatedProj2, isAnimating: proj2Animating } = useCountUp({
    from: projections[2].value * 0.6,
    to: projections[2].value,
    duration: 1200,
    enabled: projections[2].value > 0,
  });
  const { value: animatedProj3, isAnimating: proj3Animating } = useCountUp({
    from: projections[3].value * 0.6,
    to: projections[3].value,
    duration: 1200,
    enabled: projections[3].value > 0,
  });
  const animatedProjections = [animatedProj0, animatedProj1, animatedProj2, animatedProj3];
  const projectionsAnimating = [proj0Animating, proj1Animating, proj2Animating, proj3Animating];

  // ───────────────────────────────────────────────────────────────────
  // Demo-only "What she inherits" centerpiece state.
  //
  // Strategic context: Kiddo's answer to Acorns' Potential slider. Same
  // interaction (drag to see future value), but the projection isn't
  // *just* the dollar number — it's the dollar number ALONGSIDE the
  // emotional layer the platform has accumulated (voice memos, photos,
  // contributors, the parent's sealed letter). Acorns can match the
  // slider in a sprint; they cannot match the family record next to it.
  //
  // Per the locked decision in DUNPHY_DEMO_SPEC.md and the 2026-05-20
  // strategic reset: ships inside the public Dunphy demo first, not
  // into the live product yet. The user.isDemoAccount gate below keeps
  // real customer accounts on the existing 4-row static projection
  // until we're ready to graduate this.
  //
  // Slider range 0–300 step 25 covers the realistic monthly-add spread
  // (gifts-only is $0, aspirational savers go to $200-300). Defaults to
  // the fund's ACTUAL active recurring (activeRecurringMonthly), set via
  // the effect below once it loads — so the centerpiece opens "lived in"
  // AND consistent with the Dashboard's headline projection, instead of a
  // hardcoded $50 that matched no real schedule. Initialized to 0 so the
  // first paint never shows money that isn't there; the effect snaps it
  // up to the real rate (the count-up animates the jump).
  const isDemoUser = Boolean((user as any)?.isDemoAccount);
  const [sliderMonthly, setSliderMonthly] = useState<number>(0);
  // Seed the slider once from the real recurring, unless the user has
  // already dragged it (sliderTouchedRef guards against stomping their
  // choice when the query refetches).
  const sliderTouchedRef = useRef(false);
  useEffect(() => {
    if (sliderTouchedRef.current) return;
    setSliderMonthly(activeRecurringMonthly);
  }, [activeRecurringMonthly]);
  // When the slider is hidden (yearsLeft < 1), the hero number must
  // NOT silently bake in the slider's $50 default — that'd inflate
  // Haley's "what you inherit" number by money that doesn't exist.
  // Force zero monthly in that branch so the hero shows the honest
  // current-balance-compounded-over-the-remaining-runway value.
  const sliderVisible = yearsLeft >= 1;
  const effectiveSliderMonthly = sliderVisible ? sliderMonthly : 0;
  const sliderProjectedValue = useMemo(
    () => projectAt18(totalValue, yearsLeft, effectiveSliderMonthly),
    [totalValue, yearsLeft, effectiveSliderMonthly],
  );
  // "What this could pay for" — illustrative real-world anchors, mapped
  // by inheritance value bucket. Costs reflect US-typical 2026 values;
  // college and home prices typically outpace inflation, so the
  // disclaimer next to this line stays load-bearing. The ordering is
  // most-modest first so the lookup picks the largest bucket that
  // still fits the value.
  function whatThisCouldPayFor(value: number): string {
    if (value < 5_000) return "a semester of in-state college tuition";
    if (value < 15_000) return "a year of in-state college, or a reliable used car";
    if (value < 35_000) return "two years of community college, or a starter car outright";
    if (value < 75_000) return "half of an in-state bachelor's degree";
    if (value < 150_000) return "a full bachelor's at a state school, or a 20% down payment on a $500k home";
    if (value < 300_000) return "graduate school, or a 20% down payment on a $750k starter home";
    return "a debt-free education and the start of a business";
  }
  // Count-up on the slider projection so the number eases between
  // slider stops rather than snapping. Short duration so the slider
  // still feels live, not laggy.
  const { value: animatedSliderValue } = useCountUp({
    from: sliderProjectedValue * 0.92,
    to: sliderProjectedValue,
    duration: 350,
    enabled: sliderProjectedValue > 0,
  });

  // Memory Book entries query. One fetch, two derivations:
  //   1. `parentLetter` — feeds the "Your note" card + NoteEditorSheet
  //      pre-load (re-recording a 5-minute message you already left
  //      would be cruel UX).
  //   2. `memoryStats` — feeds the demo-only "What she inherits"
  //      centerpiece (voice / photo / note / contributor counts).
  // Used to be two separately-keyed queries hitting the same endpoint;
  // merged 2026-05-21 when the demo centerpiece landed and the second
  // round-trip became pointless duplication.
  // authorName is `string | undefined` (not `... | null`) to stay
  // structurally assignable to NoteEditorSheet's existingEntry prop —
  // its MemoryEntry interface declares authorName?: string without the
  // null branch. The other media fields keep `| null` because that's
  // what the server returns.
  type MemoryEntry = {
    id: string;
    content: string;
    type: string;
    authorRole?: string;
    authorName?: string;
    photoUrl?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
    audioTranscript?: string | null;
    giftId?: string | null;
    createdAt?: string;
  };
  const { data: memoryEntries = [] } = useQuery<MemoryEntry[]>({
    queryKey: ["memory", activeFund?.id],
    queryFn: async () => {
      if (!activeFund?.id) return [];
      const res = await fetch(`/api/funds/${activeFund.id}/memory`, { credentials: "include" });
      if (!res.ok) return [];
      const entries: any[] = await res.json();
      return entries as MemoryEntry[];
    },
    enabled: !!activeFund?.id,
    staleTime: 1000 * 60 * 5,
  });
  const parentLetter = useMemo(
    () => memoryEntries.find((e) => e.type === "parent_letter") ?? null,
    [memoryEntries],
  );
  // Memory stats for the demo centerpiece. Counts entries by their
  // emotional layer: voice memos (audioUrl present), photos
  // (photoUrl present), text-only notes (no media), plus gift count.
  // Contributors come from the fund row itself — same value the
  // Dashboard hero uses, no double-counting.
  const memoryStats = useMemo(() => {
    let voice = 0;
    let photo = 0;
    let video = 0;
    let notes = 0;
    let gifts = 0;
    for (const e of memoryEntries) {
      if (e.audioUrl) voice += 1;
      if (e.photoUrl) photo += 1;
      if (e.videoUrl) video += 1;
      if (e.type === "gift") gifts += 1;
      if (!e.audioUrl && !e.photoUrl && !e.videoUrl && e.type !== "parent_letter") notes += 1;
    }
    return { voice, photo, video, notes, gifts, total: memoryEntries.length };
  }, [memoryEntries]);
  const contributors = Number((activeFund as any)?.contributorCount || 0);

  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  // Scheduled-letter (sealed for a specific date) editor state. Per
  // pricing-v3 Prong B Phase 3 (locked 2026-05-23), the parent can
  // schedule a sealed letter for any future date in addition to the
  // canonical at-18 letter. Plus-gated: Free parents see the
  // FeatureWallModal instead of the composer. Per
  // project_sealed_letters_implementation_plan.md.
  const [scheduledLetterOpen, setScheduledLetterOpen] = useState(false);
  // Edit mode — when present, the composer opens pre-filled with this
  // existing sealed entry. Cleared on close. Set from the
  // ScheduledLettersList's per-entry edit button.
  const [editingScheduledEntry, setEditingScheduledEntry] = useState<any | null>(null);

  // Checklist - persisted in localStorage per fund
  const checklistKey = `age18-checklist-${activeFund?.id}`;
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(checklistKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!activeFund?.id) return;
    try { localStorage.setItem(checklistKey, JSON.stringify(Array.from(checked))); } catch {}
  }, [checked, checklistKey]);

  const toggle = useCallback((id: string) => {
    haptic("selection");
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openTimeline, setOpenTimeline] = useState<number | null>(null);

  const childName = activeFund?.recipientFirstName || "your child";
  // Use the actual stored pronoun on the fund — Emma's set to "she", Jordan
  // might be "they". Falls back to they/their when no pronoun is stored,
  // matching getPronouns()' default. Old code guessed from name presence
  // and ignored the explicit choice the parent made at fund creation.
  const fundPronouns = getPronouns((activeFund as any)?.pronoun);
  const she = fundPronouns.subject;
  const her = fundPronouns.possAdj;
  const hers = fundPronouns.possNoun;
  // State-specific UTMA majority age (18-21 by state). Same locked discipline
  // as Projection.tsx — every "18" in copy must derive from fund.majorityAge.
  // For 21-state customers (CA, KY, IN), hardcoded "18" reads as factually
  // wrong and contradicts the state-aware lifecycle worker. See
  // project_state_majority_age_sweep.md.
  const majorityAge = Number((activeFund as any)?.majorityAge) || 18;
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
  // Derive checklist, timeline, FAQ arrays from the state-aware factories
  // once per render. Single source of truth — every usage below picks up
  // the same majority-age-aware copy.
  const checklistItems = buildChecklist(majorityAge);
  const timelineItems = buildTimeline(childName, majorityAge, majorityOrdinal);
  const faqItems = buildFaq(childName, majorityAge, majorityOrdinal);
  const progress = Math.round((checked.size / checklistItems.length) * 100);
  // Verb agreement helper — "she reads" vs "they read". Without this,
  // sentences like "she reads it on her 18th birthday" silently break
  // for any fund with pronoun="they".
  const reads = fundPronouns.singular ? "reads" : "read";
  // capFirst imported from shared format-name helper. Used here for
  // pronouns ("She reads..." / "They read..." / "Hers forever." /
  // "Theirs forever."). Pronouns are single-segment so the shared
  // helper's multi-segment branch is a non-op; behavior unchanged.
  const eighteenthDate = age18Transition ? formatAgeTransitionDate(age18Transition.eighteenthBirthday) : "";
  const parentName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const noteWordCount = parentLetter?.content
    ? parentLetter.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
      <AppHeader />
      <div className="kiddo-canvas px-4 py-6 space-y-0 max-w-lg">
        {/* No in-content back link — the AppHeader Back arrow (mobile)
            + DesktopSidebar Back button (desktop) handle nav on this
            page now. Age18Plan is registered as a fund-sub-page in
            page-scope.ts (isFundSubPage), which triggers (a) the
            mobile AppHeader Back arrow, (b) the MobileNav Home-tap
            pop-to-root behavior, and (c) skipped lastLocation save so
            Back resolves to the SOURCE page (typically Dashboard).
            Locked 2026-05-18 per user feedback "needs a back button
            top left." */}

        {/* Page title */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            What happens when {childName} turns {majorityAge}.
          </h1>
          {eighteenthDate && (
            <p className="text-sm text-muted-foreground mt-1">
              {activeFund?.recipientFirstName
                ? `${activeFund.recipientFirstName}'s ${majorityOrdinal} birthday`
                : `The ${majorityOrdinal} birthday`} &middot; {eighteenthDate}
            </p>
          )}
        </div>

        {/* Countdown — live, ticking once per minute. Multi-unit display
            (years / days / hours / minutes) when within 5 years; coarsens
            to years + days only when farther out. Within ~18 months, the
            primary unit becomes months so the headline number isn't always
            "0 years" for kids close to majority. No seconds: see comment
            above on minuteTick. */}
        {age18Transition && age18Transition.stage !== "adult" && liveCountdown && (
          <div className="kiddo-card p-5 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Time remaining</p>
                {age18Transition.monthsUntil18 <= 18 ? (
                  // Final 18 months — months as the headline unit so the
                  // number doesn't read "0 years" the whole runway.
                  <>
                    <p className="text-3xl font-bold text-foreground font-heading leading-none tabular-nums">
                      {age18Transition.monthsUntil18} month{age18Transition.monthsUntil18 === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                      {age18Transition.daysUntil18.toLocaleString()} days
                      {liveCountdown.showHoursMinutes && (
                        <> · {liveCountdown.hours}h {liveCountdown.minutes}m</>
                      )}
                    </p>
                  </>
                ) : (
                  // Multi-year runway — years headline, days secondary,
                  // hours+minutes only when within 5 years.
                  <>
                    <div className="flex items-baseline gap-3 flex-wrap tabular-nums">
                      <span className="text-3xl font-bold text-foreground font-heading leading-none">
                        {liveCountdown.years}
                        <span className="text-base font-semibold text-muted-foreground ml-1">{liveCountdown.years === 1 ? "year" : "years"}</span>
                      </span>
                      <span className="text-3xl font-bold text-foreground font-heading leading-none">
                        {liveCountdown.daysAfterYears}
                        <span className="text-base font-semibold text-muted-foreground ml-1">days</span>
                      </span>
                    </div>
                    {liveCountdown.showHoursMinutes && (
                      <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                        {liveCountdown.hours} hours · {liveCountdown.minutes} minutes
                      </p>
                    )}
                    {!liveCountdown.showHoursMinutes && (
                      <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                        {age18Transition.daysUntil18.toLocaleString()} days total
                      </p>
                    )}
                  </>
                )}
              </div>
              {totalValue > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">On track for</p>
                  <p
                    className="text-2xl font-bold text-[hsl(var(--kiddo-evergreen))] font-heading leading-none tabular-nums"
                    aria-live={heroProjectionAnimating ? "off" : "polite"}
                    aria-label={formatCurrency(heroProjection)}
                  >
                    {formatCurrency(animatedHeroProjection)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">at 7% yearly average*</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nothing sells automatically. Legal control transfers to {childName} under state UTMA law.
                The investments stay exactly where they are.
              </p>
              {totalValue > 0 && (
                <p className="text-[10px] text-muted-foreground/55 leading-snug mt-2">
                  *{KIDDO_PROJECTION_DISCLAIMER}
                </p>
              )}
            </div>
          </div>
        )}

        {/* WHAT SHE INHERITS — demo-only centerpiece (the Combined
            Emotional + Financial Projection slider). Gated on the
            user being signed into a demo account; real customer
            accounts see the simpler 4-row static projection further
            down. Per the 2026-05-20 strategic decision: this is
            Kiddo's answer to Acorns' Potential slider, and ships in
            the public Dunphy demo first. */}
        {isDemoUser && totalValue > 0 && (
          <div className="kiddo-card mb-4 overflow-hidden border-2 border-[hsl(var(--kiddo-evergreen)/0.25)]">
            <div className="px-5 pt-5 pb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                What {childName} inherits at {majorityAge}
              </p>
              <p className="text-xs text-muted-foreground/80 leading-snug mb-4">
                The money, the record of who showed up, and the first thing {she} {reads}.
              </p>

              {/* Hero number — slider-driven projection */}
              <div className="rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.08)] px-5 py-5 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--kiddo-evergreen))/0.85] mb-1.5">
                  Projected value at {majorityAge}
                </p>
                <p className="text-4xl font-bold text-[hsl(var(--kiddo-evergreen))] font-heading leading-none tabular-nums">
                  {formatCurrency(animatedSliderValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Enough for {whatThisCouldPayFor(sliderProjectedValue)}.
                </p>
              </div>

              {/* Slider — drag to see what monthly adds become */}
              {sliderVisible && (
                <div className="mb-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      If you add{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {sliderMonthly === 0 ? "nothing" : `$${sliderMonthly}`}
                      </span>
                      {sliderMonthly > 0 ? " each month" : " on top"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 tabular-nums">
                      {yearsLeft.toFixed(1)} years to go
                    </p>
                  </div>
                  <Slider
                    value={[sliderMonthly]}
                    onValueChange={(v) => {
                      const next = Array.isArray(v) ? v[0] : sliderMonthly;
                      if (next !== sliderMonthly) {
                        sliderTouchedRef.current = true;
                        setSliderMonthly(next);
                        haptic("selection");
                      }
                    }}
                    min={0}
                    max={300}
                    step={25}
                    aria-label="Monthly add to fund"
                  />
                  <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60 tabular-nums">
                    <span>$0</span>
                    <span>$150</span>
                    <span>$300</span>
                  </div>
                </div>
              )}

              {/* Emotional layer — the part Acorns can't match in a sprint */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2.5">
                And the family record so far
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {memoryStats.voice > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                    <Mic className="w-3.5 h-3.5 text-[hsl(var(--kiddo-evergreen))] shrink-0" />
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-bold tabular-nums">{memoryStats.voice}</span>{" "}
                      <span className="text-muted-foreground">voice memo{memoryStats.voice === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                )}
                {memoryStats.photo > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[hsl(var(--kiddo-evergreen))] shrink-0" />
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-bold tabular-nums">{memoryStats.photo}</span>{" "}
                      <span className="text-muted-foreground">photo{memoryStats.photo === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                )}
                {contributors > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                    <Users className="w-3.5 h-3.5 text-[hsl(var(--kiddo-evergreen))] shrink-0" />
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-bold tabular-nums">{contributors}</span>{" "}
                      <span className="text-muted-foreground">contributor{contributors === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                )}
                {memoryStats.gifts > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                    <Mail className="w-3.5 h-3.5 text-[hsl(var(--kiddo-evergreen))] shrink-0" />
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-bold tabular-nums">{memoryStats.gifts}</span>{" "}
                      <span className="text-muted-foreground">gift{memoryStats.gifts === 1 ? "" : "s"} with a note</span>
                    </p>
                  </div>
                )}
              </div>

              {/* First thing she'll see — the parent's sealed letter */}
              <div className="rounded-xl border border-border bg-card/50 px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  First thing {she} {reads} on {her} {majorityOrdinal}
                </p>
                {parentLetter ? (
                  <>
                    <p className="text-sm text-foreground leading-relaxed italic">
                      "{parentLetter.content.length > 140
                        ? parentLetter.content.slice(0, 140).trim() + "…"
                        : parentLetter.content}"
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-2">
                      — {parentLetter.authorName || parentName || "Dad"}
                    </p>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { haptic("medium"); setNoteEditorOpen(true); }}
                    className="text-sm font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline"
                  >
                    Write the first thing {she} {reads} →
                  </button>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground/55 leading-snug mt-3">
                Projection assumes 7% yearly average. Illustrative payment examples; costs vary by region and typically rise with inflation.
              </p>
            </div>
          </div>
        )}

        {/* THE FUND */}
        <div className="kiddo-card mb-4 overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">The fund</p>
            {/* Italic pull-quote "Everything stays exactly where it is..."
                removed 2026-05-20. Same anti-pattern as the
                "doesn't just receive a fund / She receives a letter"
                teaser audited out 2026-05-11 (see comments in "Your
                note" and "Memory Book" cards below): authorial prose
                styled as a quote with no source, marketing voice on a
                product surface. The three ✅ bullets below already
                say the same thing (Legal control transfers, UTMA law,
                nothing automatic) without the serif-italic register
                or the borrowed-authority quote marks. */}
            <div className="space-y-2.5">
              {[
                `Legal control transfers to ${childName} on ${eighteenthDate || `the ${majorityOrdinal} birthday`}.`,
                `Based on your state's UTMA law. Your child gets full control at ${majorityAge}.`,
                // countdownLabel from age-transition.ts is state-aware
                // ("X months until age 21" for 21-state). Strip the matching
                // suffix so we don't double-print the majority age in the
                // compact line — was hardcoded " until age 18" which silently
                // left the suffix in for non-18 states.
                age18Transition
                  ? `Nothing happens automatically. You have ${age18Transition.countdownLabel.replace(` until age ${majorityAge}`, "")} to prepare.`
                  : "Nothing happens automatically.",
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5 shrink-0">✅</span>
                  <p className="text-sm text-muted-foreground leading-snug">{line}</p>
                </div>
              ))}
            </div>
            {totalValue > 0 && age18Transition && (
              <div className="mt-4 bg-[hsl(var(--kiddo-evergreen)/0.08)] rounded-xl px-4 py-3">
                <p className="text-xs text-[hsl(var(--kiddo-evergreen))] font-medium">
                  On track for <strong>{formatCurrency(projectFundValue({ startingValue: totalValue, monthlyContribution: 0, yearsAhead: age18Transition.daysUntil18 / 365.25 }))}</strong> by {majorityAge} at 7% yearly average.<span className="opacity-60">*</span>
                </p>
              </div>
            )}
          </div>
          <div className="h-px bg-border/40 mx-5 mt-5" />
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              What can {childName} do at {majorityAge}? Keep investing. Add to it. Manage it {fundPronouns.reflexive}.
              Withdraw some or all for college, a business, a house. Anything. No restrictions. No penalties.
            </p>
          </div>
        </div>

        {/* YOUR NOTE */}
        <div className="kiddo-card mb-4 overflow-hidden">
          <div className="px-5 pt-5 pb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Your note</p>
            {/* Italic "doesn't just receive a fund. She receives a letter."
                teaser removed 2026-05-11. Three things wrong:
                  1. Marketing voice on a product surface (AI-slop
                     rhythm "doesn't just X. She Y.")
                  2. "Receives a fund" is technically wrong — the kid
                     takes legal ownership at majority, doesn't
                     receive it like a gift item
                  3. Hardcoded "She" pronoun ignored the fund's
                     pronoun setting; broke for he/they kids
                The eyebrow + status + Edit button below already say
                what the card IS. No teaser needed. */}
            {parentLetter ? (
              <div>
                {(() => {
                  // Acknowledge whatever the parent has actually saved — if
                  // they recorded a voice memory but didn't type anything,
                  // "0 words saved" is wrong and erases the artifact they
                  // DID create.
                  const parts: string[] = [];
                  if (noteWordCount > 0) parts.push(`${noteWordCount} word${noteWordCount === 1 ? "" : "s"}`);
                  if (parentLetter.audioUrl) parts.push("voice");
                  if (parentLetter.videoUrl) parts.push("video");
                  if (parentLetter.photoUrl) parts.push("photo");
                  const summary = parts.length === 0 ? "Letter started" : parts.join(" + ") + " saved";
                  return (
                    <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] mb-1">
                      ✓ {summary}
                    </p>
                  );
                })()}
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  {capFirst(she)} {reads} it on {her} {majorityOrdinal} birthday.
                </p>
                <button
                  type="button"
                  onClick={() => { haptic("medium"); setNoteEditorOpen(true); }}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-foreground bg-muted/60 hover:bg-muted transition-colors rounded-full px-4 py-2"
                >
                  ✉️ Edit →
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Write or record something for {childName} to read or hear on {her} {majorityOrdinal} birthday.
                </p>
                <Button
                  className="rounded-full text-xs h-9 px-5"
                  onClick={() => { haptic("medium"); setNoteEditorOpen(true); }}
                >
                  ✉️ Write {childName !== "your child" ? `${activeFund?.recipientFirstName}'s` : "the"} letter →
                </Button>
              </div>
            )}
            {/* Schedule-a-letter CTA (pricing-v3 Prong B, Phase 3 shipped
                2026-05-23). Sits below the canonical at-18 letter CTA
                because the at-18 letter is the load-bearing emotional
                moment; arbitrary-date sealed letters are the Plus-only
                extension. Composer Plus-gates itself if the parent isn't
                on Plus/Family/trial on this fund. Per
                project_sealed_letters_implementation_plan.md. */}
            {/* Copy tightened 2026-05-25 audit. Was "Or schedule a
                letter..." implying it was an alternative to the at-18
                note above. Parents can do BOTH (one at-18 + unlimited
                scheduled letters at any date, plus yearly recurring).
                Now reads "Schedule another letter..." which is honest
                about the additive shape: the at-18 letter sits in the
                first slot; this button adds more, each with its own
                deliver-at date. */}
            <div className="mt-3 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => { haptic("selection"); setScheduledLetterOpen(true); }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
                data-testid="button-schedule-sealed-letter"
              >
                🕯️ Schedule another letter for a specific moment (13th birthday, graduation, every birthday, etc.) →
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled letters list (Phase 3 follow-on shipped 2026-05-23).
            Surfaces the parent's pending sealed letters so they don't get
            lost. Component is self-suppressing — returns null when no
            scheduled letters exist, so Free parents and Plus parents who
            haven't scheduled anything see nothing here. Per
            project_sealed_letters_implementation_plan.md.
            onEdit wires per-entry edit through the same composer
            (reschedule UI, locked 2026-05-23 follow-on). */}
        {activeFund?.id && (
          <div className="mb-4">
            <ScheduledLettersList
              fundId={activeFund.id}
              childName={activeFund?.recipientFirstName || "them"}
              onEdit={(entry) => {
                setEditingScheduledEntry(entry);
                setScheduledLetterOpen(true);
              }}
            />
          </div>
        )}

        {/* THE MEMORY BOOK */}
        <div className="kiddo-card mb-4 overflow-hidden">
          <div className="px-5 pt-5 pb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">The Memory Book</p>
            {/* Italic teaser removed (same anti-pattern as the "Your
                note" card above — marketing rhythm, wrong verb,
                hardcoded pronoun). Bullets below describe what the
                Memory Book IS without the "believed in her future"
                love-mark phrasing the kid-at-18 lens flags. */}
            {/* Bullet copy retoned 2026-05-19 — was three "Every X."
                lines reading as marketing-page register inside a
                product surface. Now states what the Memory Book
                contains without the slogan rhythm. */}
            {/* Bullet 3 "Searchable, shareable, ${hers} forever." cut
                2026-05-20. Was the last slogan-rhythm holdout — three-
                beat adjective triple with a possessive close, same
                marketing-page register as the italic pull-quotes
                removed elsewhere on this page. The two remaining
                bullets state what the Memory Book contains; the
                "hers/his/theirs after majorityAge" point is already
                load-bearing on the countdown card AND the "The fund"
                bullets, so dropping the third line here doesn't lose
                signal — it removes a 4th repetition of the handoff
                claim and the only marketing-voice line left in the
                card. */}
            <div className="space-y-2 mb-4">
              {[
                "Gifts, notes, photos, and milestones, kept in one place.",
                "Names and messages from everyone who gave.",
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-sm shrink-0">📖</span>
                  <p className="text-sm text-muted-foreground leading-snug">{line}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { haptic("selection"); setLocation(`/memory/${activeFund?.id}`); }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-[hsl(var(--kiddo-evergreen))] hover:opacity-90 transition-opacity rounded-full px-4 py-2"
            >
              Open Memory Book →
            </button>
          </div>
        </div>

        {/* Handoff checklist */}
        <div className="kiddo-card mb-4 overflow-hidden">
          <div className="p-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-foreground">Preparation checklist</h2>
              <span className="text-sm font-semibold text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-[hsl(var(--kiddo-evergreen))] rounded-full"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <div className="space-y-0">
              {checklistItems.map((item, i) => (
                <div key={item.id}>
                  {i > 0 && <div className="border-t border-border/40 my-1" />}
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-start gap-3 py-3 text-left"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      checked.has(item.id)
                        ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen))]"
                        : "border-border"
                    }`}>
                      {checked.has(item.id) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-snug ${checked.has(item.id) ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.detail}</p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Suggested timeline */}
        <div className="kiddo-card mb-4 overflow-hidden">
          <div className="p-5">
            <h2 className="text-base font-bold text-foreground mb-4">Suggested timeline</h2>
            <div className="space-y-0">
              {timelineItems.map((item, i) => (
                <div key={i}>
                  {i > 0 && <div className="border-t border-border/40" />}
                  <button
                    type="button"
                    onClick={() => { haptic("selection"); setOpenTimeline(openTimeline === i ? null : i); }}
                    className="w-full flex items-start gap-3 py-3.5 text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--kiddo-evergreen))] mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-foreground">{item.heading}</p>
                      <AnimatePresence>
                        {openTimeline === i && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-xs text-muted-foreground leading-relaxed mt-1.5 overflow-hidden"
                          >
                            {item.detail}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="shrink-0 mt-1">
                      {openTimeline === i
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Growth projections — the static 4-row table. Hidden for
            demo users, who get the Combined Emotional + Financial
            Projection slider card up top instead (showing both would
            be the same number twice). Live customer accounts still
            see this until the slider graduates out of demo. */}
        {!isDemoUser && totalValue > 0 && yearsLeft > 0 && (
          <div className="kiddo-card mb-4 overflow-hidden">
            <div className="p-5">
              <h2 className="text-base font-bold text-foreground mb-1">What the fund could look like at {majorityAge}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Starting from {formatCurrency(totalValue)} &middot; assumes 7% yearly average*
              </p>
              <div className="space-y-2">
                {projections.map((p, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      i === 0 ? "bg-[hsl(var(--kiddo-evergreen)/0.08)]" : "bg-muted/40"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground leading-snug">{p.label}</p>
                    <p
                      className="text-sm font-bold text-foreground font-heading tabular-nums"
                      aria-live={projectionsAnimating[i] ? "off" : "polite"}
                      aria-label={formatCurrency(p.value)}
                    >{formatCurrency(animatedProjections[i] ?? p.value)}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                *{KIDDO_PROJECTION_DISCLAIMER} Illustrative only. Past performance does not guarantee future results. Kiddo does not provide investment advice.
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="kiddo-card mb-4 overflow-hidden">
          <div className="p-5">
            <h2 className="text-base font-bold text-foreground mb-4">Common questions</h2>
            <div className="space-y-0">
              {faqItems.map((item, i) => (
                <div key={i}>
                  {i > 0 && <div className="border-t border-border/40" />}
                  <button
                    type="button"
                    onClick={() => { haptic("selection"); setOpenFaq(openFaq === i ? null : i); }}
                    className="w-full flex items-start gap-2 py-3.5 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{item.q}</p>
                      <AnimatePresence>
                        {openFaq === i && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-xs text-muted-foreground leading-relaxed mt-2 overflow-hidden"
                          >
                            {item.a}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      {openFaq === i
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* After the handoff — kid-2.0 funnel signpost. Locked principle
            per project_kid_2.0_handoff_funnel.md: "The 18-handoff is the
            only product-transition window the company has. It must
            route TOWARD a next Kiddo product, NOT OUT. NEVER ship a
            'thanks for using Kiddo, take care' exit beat." Audit
            2026-05-25 caught that this page previously ended at the
            FAQ + the money-conversation essay with zero forward-looking
            signal — reading as exactly the exit-beat the locked memory
            forbids. This section fixes that with three concrete-today
            facts (kid onboarding ships in Age18Welcome.tsx, subscription
            retires at majority per project_subscription_retires_at_majority.md,
            AUM-only post-handoff per the locked Fee Architecture)
            plus one near-future signpost (Roth IRA path, waitlist
            already live at parent signup + kid-side Age18Welcome
            screen 4). No "coming soon" framing — every claim here
            is concrete today or describes a real waitlist already
            accepting signups. */}
        <div className="kiddo-card mb-4 p-5">
          <h2 className="text-base font-bold text-foreground mb-3">After the handoff</h2>
          <p className="text-sm text-foreground/85 leading-relaxed mb-3">
            Once {childName} takes legal control, three things change for you.
          </p>
          <ul className="space-y-2.5 text-sm text-foreground/85 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-foreground/40 shrink-0" aria-hidden>·</span>
              <p>
                <span className="font-semibold text-foreground">{childName} gets a walkthrough</span> on the {majorityOrdinal} birthday. We explain the fund, the investments, and the choices in front of {childName}. Calm and factual, no pressure to act.
              </p>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground/40 shrink-0" aria-hidden>·</span>
              <p>
                <span className="font-semibold text-foreground">Your Plus subscription for this fund ends.</span> Kiddo+ is for parents managing custody, so it retires once {childName} owns the fund. {childName} never inherits a bill. If {childName} later wants to actively manage it (auto-invest, recurring, or start a fund for a child of their own), Plus is there by choice, never forced.
              </p>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground/40 shrink-0" aria-hidden>·</span>
              <p>
                <span className="font-semibold text-foreground">Pricing simplifies to the 0.10% AUM line.</span> About 10 cents per $100 invested per year. By default it is the only ongoing charge after the handoff.
              </p>
            </li>
          </ul>
          {/* Roth IRA signpost — tightened 2026-05-25 audit. Was three
              sentences with a misleading middle: '{childName} can join the
              waitlist at the handoff' implied the parent has nothing to
              do on this page about it (true), but also didn't add value
              for the parent reading it now. The waitlist itself was
              already captured at parent signup per the locked kid-2.0
              spec. Removed the passive line; replaced with the Roth-
              specific insight: tax-free growth is uniquely valuable
              when the kid's tax bracket is near zero, not when they're
              47. Kept the compound-the-same-way anchor (the strongest
              beat — connects the future Roth to the existing fund
              metaphor). Per project_kid_2.0_handoff_funnel.md. */}
          <p className="text-xs text-muted-foreground leading-relaxed mt-4 pt-3 border-t border-border/50">
            Building next: a Roth IRA path for when {childName} starts earning income (a teen job, early college work). Tax-free growth is uniquely valuable when you're 17, not 47. Earned-income dollars compound the same way the gifts in this fund have.
          </p>
        </div>

        {/* The money conversation */}
        <div className="kiddo-card mb-4 p-5">
          <p className="text-sm font-bold text-foreground mb-2">The money conversation does not start at {majorityAge}.</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Families who do this well start at 13 or 14. Not about the numbers.
            About the values behind the numbers. What does money mean? What would you do with it?
            What does {childName} care about?
          </p>
        </div>

        {/* "Coming soon" Physical Book + Kiddo Card cards REMOVED
            2026-05-19 per the marketing-copy-in-product audit. The
            physical book printed-and-mailed-at-18 and the Kiddo Card
            at-18 are real product ideas, but until either ships in
            code, surfacing them on a parent-facing product page
            creates a "when?" question with no answer.

            The persona this product is now built for (sophisticated
            parent who could run a Schwab UTMA themselves) reads
            "Coming soon" as either (a) "they're stalling" or (b)
            "they don't actually ship things." Both readings cost
            trust.

            When either feature actually ships: bring its card back
            here as a REAL CTA ("Order Emma's printed book →") not
            a teaser. The kid-at-18 narrative on this page doesn't
            need vapor footnotes to land — the countdown, the
            preparation checklist, and the sealed note already
            carry the emotional weight.

            Move the "physical book at 18" pitch to marketing pages
            (Home, About, Age18) only. Marketing-page register can
            sell aspiration; product-page register cannot. Per
            project_five_towns_persona_and_heirloom_positioning.md
            (the "no feature theater" rule). */}

        {/* Closing italic quote ("You started this fund. You grew it.
            You protected it. ... That's the whole thing.") removed
            2026-05-20. Same anti-pattern as the opening pull-quote on
            "The fund" card and the "doesn't just receive a fund / She
            receives a letter" teaser cut 2026-05-11: authorial prose
            styled as a quote with no source, marketing-page rhythm
            ("You X. You Y. You Z. On DATE, NAME does THING. That's
            the whole thing.") on a product surface. The "money
            conversation does not start at ${majorityAge}" wisdom line
            above is plenty of close. Per the locked discipline against
            marketing voice in product copy + the no-AI-slop ending
            rule (no "That's the whole thing" / "is the whole
            thing"-style closers). */}

        <TrustMicroStrip />

      </div>

      <NoteEditorSheet
        open={noteEditorOpen}
        onClose={() => setNoteEditorOpen(false)}
        fundId={activeFund?.id ?? ""}
        childName={activeFund?.recipientFirstName || "them"}
        parentName={parentName}
        pronoun={(activeFund as any)?.pronoun}
        majorityAge={majorityAge}
        recipientBirthdate={activeFund?.recipientBirthdate ? String(activeFund.recipientBirthdate) : null}
        existingEntry={parentLetter ?? null}
        requiresPlus={noteEditorRequiresPlus}
        onSaved={() => {
          // Single key now — the memory query feeds both parentLetter
          // and memoryStats off one fetch. Old `parent_letter` sub-key
          // retired when the two queries merged 2026-05-21.
          void queryClient.invalidateQueries({ queryKey: ["memory", activeFund?.id] });
        }}
      />
      <ScheduledLetterEditor
        open={scheduledLetterOpen}
        onClose={() => { setScheduledLetterOpen(false); setEditingScheduledEntry(null); }}
        fundId={activeFund?.id ?? ""}
        childName={activeFund?.recipientFirstName || "them"}
        parentName={parentName}
        pronoun={(activeFund as any)?.pronoun}
        recipientBirthdate={activeFund?.recipientBirthdate ? String(activeFund.recipientBirthdate) : null}
        // Same Plus-on-fund gate the NoteEditorSheet's media picker
        // uses: noteEditorRequiresPlus=true means the parent is on
        // Free for this fund (the picker shows the wall). For the
        // ScheduledLetterEditor we want the INVERSE — isPlusOnFund
        // is true when the parent IS on a paid plan (so the composer
        // renders; otherwise the FeatureWallModal renders instead).
        isPlusOnFund={!noteEditorRequiresPlus}
        existingEntry={editingScheduledEntry}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["memory", activeFund?.id] });
        }}
      />
    </div>
  );
}
