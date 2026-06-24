// Age-18 handoff welcome walkthrough. Per AGE_18_HANDOFF_SPEC.md
// bucket 1. Five-screen calm tour fired right after the kid completes
// the ownership transfer at /transition/:token.
//
// Why this exists: the age-18 moment is currently handled emotionally
// (parent letter, Memory Book unlock) and legally (fund.userId flip
// in /api/age-transition/:token/complete). What's missing is the
// 60 minutes of orientation where the kid actually learns what they
// own, how taxes work, and what their options are. Without this, the
// most likely failure mode is selling everything to buy a car —
// same outcome cash gifts would have produced. The whole product
// premise depends on this moment landing well.
//
// Layout: single full-screen route. Internal `screen` state drives
// which of the five panels renders. The first three screens are
// load-bearing (no skip); 4 and 5 are skippable. On completion the
// server stamps fund.kidWelcomeCompletedAt and the kid lands on
// /dashboard.

import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Briefcase, Coins, Receipt, Sprout, TrendingUp, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { capFirst } from "@/lib/format-name";
import { projectFundValue, PROJECTION_DISCLAIMER } from "@shared/projection";
import { useToast } from "@/hooks/use-toast";
import { useScrollResetOnChange } from "@/lib/scroll-to-element";
import { MomentParticles } from "@/components/MomentParticles";

type HandoffState = {
  shouldShowWelcome: boolean;
  isKidOwner: boolean;
  welcomeCompleted: boolean;
  fund: {
    id: string;
    name: string;
    recipientFirstName: string | null;
    balance: string;
    totalGain: string | null;
    gainPercent: string | null;
    majorityAge: number;
  };
};

function formatMoney(value: string | number | null | undefined, opts: { decimals?: number } = {}) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(numeric);
}

// Lump-only projection via the canonical projectFundValue (7% net the
// 0.10% AUM fee, effective monthly compounding). Routing through the shared
// module keeps this kid-facing handoff number in lockstep with every other
// surface the kid might check later, instead of a parallel formula.
function projectAt(principal: number, years: number, rate = 0.07): number {
  return projectFundValue({ startingValue: principal, monthlyContribution: 0, yearsAhead: years, annualReturnRate: rate });
}

export default function Age18Welcome() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const search = useSearch();
  const fundId = useMemo(() => new URLSearchParams(search).get("fundId") || "", [search]);

  const { data, isLoading } = useQuery<HandoffState>({
    queryKey: ["/api/funds", fundId, "handoff-state"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/handoff-state`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!fundId,
  });

  // Community data for the supporters strip on Screen 1. The
  // moment-of-arrival reveal lands EMOTIONALLY harder when the
  // kid sees "built by 11 people who showed up for you" alongside
  // the balance number. Same endpoint the parent Dashboard uses;
  // after the handoff the fund's userId is the kid's, so the
  // ownership middleware lets them through. Shipped 2026-05-26
  // alongside the MomentParticles ship as the Age18Welcome climax
  // upgrade. The strip is calmly hidden when there's no community
  // data (< 2 gifters) — the calm register doesn't ship empty
  // states with placeholder copy.
  const { data: communityData } = useQuery<{
    fundStartedAt: string | null;
    totalContributors: number;
    series: Array<{ label: string; totalUsd: number; points: Array<{ at: string; cumulative: number }> }>;
  }>({
    queryKey: ["/api/funds", fundId, "community"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/community`, { credentials: "include" });
      if (!res.ok) return { fundStartedAt: null, totalContributors: 0, series: [] };
      return res.json();
    },
    enabled: !!fundId,
    staleTime: 5 * 60_000, // 5 minutes — the kid won't be reloading this
  });

  // The OLDEST note, surfaced as a taste on Screen 1. The supporters strip
  // proves people showed up (a count + names); this lets the kid actually
  // READ one at the climax instead of deferring every word to the Memory Book
  // at the end. Feeling a real sentence someone wrote years ago is the beat;
  // the number is the smaller gift. Best-effort + gated, so it silently adds
  // nothing when there are no notes (no empty state in the calm register).
  const { data: memoryPreview } = useQuery<any[]>({
    queryKey: ["/api/funds", fundId, "memory"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/memory`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fundId,
    staleTime: 5 * 60_000,
  });
  const oldestNote = useMemo(() => {
    const notes = (memoryPreview || []).filter((e: any) => String(e?.content || "").trim() && e?.type !== "parent_letter");
    return notes.slice().sort((a: any, b: any) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime())[0] || null;
  }, [memoryPreview]);

  const [screen, setScreen] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [hasJob, setHasJob] = useState<boolean | null>(null);
  const [bracket, setBracket] = useState<"0_45" | "45_100" | "100_plus" | null>(null);
  // Roth IRA waitlist opt-in. Per project_kid_2.0_handoff_funnel.md:
  // the 18-handoff is the highest-engagement moment we get with this
  // user, and Roth IRA is the right first beachhead in the kid-2.0
  // funnel (DriveWealth has IRA products; taps the earned-income
  // moment naturally). The Settings tax section already has this
  // toggle and the server endpoint already exists — but ZERO users
  // were being added to the waitlist at the walkthrough moment
  // because screen 4 never called it. Default OFF so this is opt-in,
  // never dark-pattern. Locked 2026-05-23.
  const [rothInterest, setRothInterest] = useState<boolean>(false);
  // Screen transitions are state-driven, not URL-driven — so the
  // global ScrollToTop never fires. Without this, screen 4 (Roth
  // pitch with income-bracket toggles) inherits screen 3's scroll
  // position and the kid sees the bottom of the previous screen on
  // mount. Per the 2026-05-13 onboarding scroll audit.
  useScrollResetOnChange(screen);

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Save the income bracket only if the kid answered. Skipping
      // screen 4 leaves these null on the server — fine, the first-
      // sell tax explainer will ask again when it ships.
      if (hasJob !== null) {
        await fetch(`/api/users/me/earned-income`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            hasEarnedIncome: hasJob,
            estimatedIncomeBracket: bracket,
          }),
        });
      }
      // Roth waitlist signal — only fire when the kid actively opted
      // in via screen 4 toggle. Never auto-stamp on hasJob=true (that
      // would be dark-pattern: "you said you have a job, so we added
      // you to a list you didn't see"). Endpoint is idempotent —
      // safe to call with interested=false to clear later.
      if (rothInterest) {
        await fetch(`/api/users/me/roth-interest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ interested: true }),
        }).catch(() => {
          // Best-effort: the waitlist signal is nice-to-have, never
          // block walkthrough completion. The Settings tax section
          // also exposes this toggle so the kid can opt in later
          // if this request silently fails.
        });
      }
      const res = await fetch(`/api/funds/${fundId}/welcome-complete`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not complete");
      return res.json();
    },
    onSuccess: () => {
      setLocation("/dashboard");
    },
    onError: (err) => {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : "Try again." });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Guard: if the user isn't the kid-owner or already completed the
  // walkthrough, bounce to dashboard. Server returns these flags from
  // /handoff-state; we trust them as the single source of truth.
  if (!data.shouldShowWelcome) {
    setLocation("/dashboard");
    return null;
  }

  const fund = data.fund;
  const balance = parseFloat(String(fund.balance || "0"));
  const totalGain = parseFloat(String(fund.totalGain || "0"));
  const at65Years = 65 - fund.majorityAge;
  const projectedAt65 = projectAt(balance, at65Years);
  // Multi-gen projection — Treatment 5 of the five DUNPHY_DEMO_SPEC.md
  // projection treatments. Anchors the heirloom-continuity narrative
  // concretely: "your kid could inherit ~$X at their majority." 35-year
  // horizon is the heuristic for "you have a kid at 30 and they reach
  // 21" — close enough to the average modern-parent timing without
  // pretending the user has a specific timeline. The number stays
  // illustrative; the value of this card is the FRAME (this can keep
  // running across generations), not a financial forecast.
  const multiGenHorizonYears = 35;
  const projectedMultiGen = projectAt(balance, multiGenHorizonYears);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-6 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-1 w-6 rounded-full transition-colors ${
                n <= screen ? "bg-foreground" : "bg-foreground/15"
              }`}
              aria-hidden
            />
          ))}
        </div>
      </header>

      <main className="px-6 py-12 max-w-2xl mx-auto">
        {screen === 1 && (
          <ScreenShell key="s1">
            {/* Climax upgrade shipped 2026-05-26. Three additions
                to the previous text-only reveal:
                  1. MomentParticles burst on mount — calm, sparse,
                     drift-up motion (not festive falling confetti).
                     Single play, ~2.5s, then quiet.
                  2. Breathing scale on the balance number — subtle
                     rhythm (1.0 → 1.015 → 1.0 over 4s, infinite).
                     Reduced-motion users see static.
                  3. Supporters strip below the gain card showing
                     "built by N people who showed up for you" with
                     top-contributor names. Closes the locked
                     "Acorns 18-handoff is paperwork; ours is the
                     moment" thesis — the kid SEES the community at
                     the climax, not just the balance number.
                The hero still ships a static composition for
                reduced-motion users; particles + breathing are
                pure additive layers. */}
            <div className="relative">
              <MomentParticles count={16} durationMs={2400} />
              <Eyebrow icon={<Sprout size={14} />}>This is yours now.</Eyebrow>
              <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
                {fund.recipientFirstName ? `Hi, ${capFirst(fund.recipientFirstName)}.` : "Welcome."}
                <br />
                <motion.span
                  className="inline-block text-primary"
                  animate={{ scale: [1, 1.015, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: "left center" }}
                >
                  {formatMoney(balance)}
                </motion.span>{" "}
                <span className="text-2xl md:text-3xl font-semibold text-muted-foreground">is yours.</span>
              </h1>
            </div>
            <p className="text-base text-foreground/80 leading-relaxed">
              What you see here is yours legally as of today. Nothing was sold or moved. Only the name
              on the paperwork changed. Your fund kept growing the whole time you were growing up.
            </p>
            {totalGain > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total gain so far</p>
                <p className="font-heading text-2xl font-bold text-emerald-700">
                  +{formatMoney(totalGain)}
                </p>
                <p className="text-xs text-muted-foreground">
                  The cash gifts cousins gave you would be long gone by now. This grew instead.
                </p>
              </div>
            )}
            {/* Supporters strip — the "who showed up" beat. Lists the
                top contributors by name as small pills, with the
                total count headlined above. Self-hides when there
                are fewer than 2 distinct contributors (we don't ship
                "built by 1 person" — that's the parent's number, not
                a community beat). Tap-through to Memory Book later
                if we wire one; for now it's calm read-only chrome. */}
            {communityData && communityData.totalContributors >= 2 && Array.isArray(communityData.series) && communityData.series.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-5 space-y-3"
                data-testid="age18-supporters-strip"
              >
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
                  <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] uppercase tracking-wide">
                    Built by {communityData.totalContributors} {communityData.totalContributors === 1 ? "person" : "people"} who showed up for you
                  </p>
                </div>
                {oldestNote && (() => {
                  const raw = String(oldestNote.content).trim();
                  const excerpt = raw.length > 140 ? raw.slice(0, 140).replace(/\s+\S*$/, "") + "…" : raw;
                  const author = String(oldestNote.authorName || "").trim();
                  const yr = oldestNote.createdAt ? new Date(oldestNote.createdAt).getFullYear() : null;
                  return (
                    <figure className="m-0 border-l-2 border-[hsl(var(--kiddo-gold))]/50 pl-3">
                      <p className="text-sm italic leading-relaxed text-foreground/85">&ldquo;{excerpt}&rdquo;</p>
                      <figcaption className="mt-1 text-[11px] text-muted-foreground">
                        {author || "someone who showed up"}{yr ? ` · the first note, ${yr}` : ""}
                      </figcaption>
                    </figure>
                  );
                })()}
                <div className="flex flex-wrap gap-1.5">
                  {communityData.series.map((s, idx) => (
                    <motion.span
                      key={`${s.label}-${idx}`}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + idx * 0.06, type: "spring", stiffness: 320, damping: 22 }}
                      className="inline-flex items-center rounded-full border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-white px-3 py-1 text-xs font-medium text-foreground/80"
                    >
                      {s.label}
                    </motion.span>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Every gift they sent kept compounding. The Memory Book has all of it: notes, photos, the moments behind each one.
                </p>
              </motion.div>
            )}
            <Continue onClick={() => setScreen(2)}>What can I do with this?</Continue>
          </ScreenShell>
        )}

        {screen === 2 && (
          <ScreenShell key="s2">
            <Eyebrow icon={<TrendingUp size={14} />}>Your options from here.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              You have real choices now.
            </h1>
            <div className="space-y-3">
              <ChoiceCard
                title="Keep growing it"
                math={
                  balance > 0
                    ? `${formatMoney(balance)} today becomes about ${formatMoney(projectedAt65, { decimals: 0 })} by 65 if you don't touch it. Markets average ~7% a year long-term; estimate is net of Kiddo's annual fee.`
                    : "Markets average ~7% a year long-term. Compounding works while you sleep."
                }
                tone="grow"
              />
              <ChoiceCard
                title="Withdraw some cash"
                math="Move money from your fund to a bank account. You pay no tax on withdrawing. Tax is on selling, not on moving cash you already own."
                tone="cash"
              />
              <ChoiceCard
                title="Sell some shares"
                math="Selling turns shares into cash. The gain (sale price minus what was paid) is what's taxed. The next screen explains how that works."
                tone="sell"
              />
            </div>
            {/* Multi-gen / heirloom-continuity callout. The fund
                doesn't have to end with you. If you keep it and
                eventually pass it to your own kid, the same mechanism
                that delivered it to you compounds for another generation.
                Calmly framed: the value of this card is the FRAME
                ("this can keep running across generations"), not the
                forecast. Locked 2026-05-21 per the heirloom-positioning
                roadmap; same locked 7% assumption + illustrative
                disclaimer as the at-65 number above. */}
            {balance > 0 && (
              <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.06)] p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
                  <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] uppercase tracking-wide">
                    Or pass it down
                  </p>
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed">
                  You don't have to be the last person this fund belongs to. Keep it invested through your own life and your own kids' childhoods, and {multiGenHorizonYears} years from now it could be worth around{" "}
                  <span className="font-semibold text-foreground">{formatMoney(projectedMultiGen, { decimals: 0 })}</span>
                  . That's enough to start another Kiddo for the next generation.
                </p>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">
                  {PROJECTION_DISCLAIMER}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground italic">
              You don't have to decide anything right now. Most people don't.
            </p>
            <Continue onClick={() => setScreen(3)}>How do taxes work?</Continue>
          </ScreenShell>
        )}

        {screen === 3 && (
          <ScreenShell key="s3">
            <Eyebrow icon={<Receipt size={14} />}>Taxes, in 60 seconds.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              Three things that matter.
            </h1>
            <div className="space-y-4">
              <TaxConcept
                title="Long-term gains are taxed gently."
                body="Anything you've held over a year gets long-term capital-gains rates: 0%, 15%, or 20%, depending on your income."
              />
              <TaxConcept
                title="The kiddie tax may not be over yet."
                body="If you're under 19, or a full-time student under 24 whose parents still cover most of your support, larger investment gains can still be taxed at their rate, not yours. Once that stops applying, you're fully on your own rates. Either way, you file your own taxes now, and we send a 1099 every January with the numbers."
              />
              <TaxConcept
                title="Low-income years are sell-friendly years."
                body="Once you're on your own tax rates, selling in a low-earning year can mean 0% on long-term gains; selling at 30 earning $80k might be 15%. The year you sell changes the bill on the same shares."
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">General information, not tax advice. A CPA can confirm what applies to you.</p>
            <Continue onClick={() => setScreen(4)}>Got it.</Continue>
          </ScreenShell>
        )}

        {screen === 4 && (
          <ScreenShell key="s4">
            <Eyebrow icon={<Briefcase size={14} />}>One more thing, if you have a job.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              Earned income makes Roth IRA dollars.
            </h1>
            <p className="text-base text-foreground/80 leading-relaxed">
              Every dollar you earn at a job, you can put up to that much into a Roth IRA (up to $7,000/yr).
              You pay tax on it going in. Every dollar of growth comes out <strong>tax-free</strong> at 59½.
            </p>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <p className="text-sm font-semibold">The math</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                $6,000 into a Roth at 18. Never add another dollar. At 65 it's worth about{" "}
                <span className="font-semibold text-emerald-700">$130,000</span>. Tax-free.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold">Do you have a job right now?</p>
              <div className="grid grid-cols-2 gap-2">
                <ToggleBtn active={hasJob === true} onClick={() => setHasJob(true)}>
                  Yes
                </ToggleBtn>
                <ToggleBtn
                  active={hasJob === false}
                  onClick={() => {
                    // Clear any previously-picked bracket when switching to
                    // "Not yet" — the bracket field hides, but a stale value
                    // would otherwise still feed the server's tax math.
                    // Mirrors Settings.tsx updateEarnedIncome(false, null).
                    setHasJob(false);
                    setBracket(null);
                  }}
                >
                  Not yet
                </ToggleBtn>
              </div>
              {hasJob === true && (
                <>
                  <p className="text-xs text-muted-foreground pt-2">
                    Roughly what's your yearly income? We use this to estimate taxes when you sell.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <ToggleBtn active={bracket === "0_45"} onClick={() => setBracket("0_45")} small>
                      Under $45k
                    </ToggleBtn>
                    <ToggleBtn active={bracket === "45_100"} onClick={() => setBracket("45_100")} small>
                      $45k–$100k
                    </ToggleBtn>
                    <ToggleBtn active={bracket === "100_plus"} onClick={() => setBracket("100_plus")} small>
                      Over $100k
                    </ToggleBtn>
                  </div>
                </>
              )}
            </div>

            {/* Roth IRA waitlist opt-in. Per the kid-2.0 handoff funnel
                principle: the 18-moment is the highest-engagement
                window we get, and the Roth pitch is right above this
                toggle — capturing intent HERE means we have a real
                waitlist when DriveWealth IRA support ships. Default
                off (no dark pattern). Can also be toggled later from
                Settings → Tax. */}
            {hasJob === true && (
              <button
                type="button"
                onClick={() => setRothInterest(!rothInterest)}
                className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${
                  rothInterest
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-foreground/30"
                }`}
                data-testid="age18-roth-waitlist-toggle"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                      rothInterest ? "border-primary bg-primary" : "border-border bg-card"
                    }`}
                    aria-hidden
                  >
                    {rothInterest && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2.5 6.5L5 9l4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Notify me when Roth IRA is ready in Kiddo.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      One email when it's actually live so you can move the first $1 in. No spam.
                    </p>
                  </div>
                </div>
              </button>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setScreen(5)}
              >
                Skip
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => setScreen(5)}
              >
                Next
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </ScreenShell>
        )}

        {screen === 5 && (
          <ScreenShell key="s5">
            <Eyebrow icon={<BookOpen size={14} />}>One last thing.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              The Memory Book is open.
            </h1>
            <p className="text-base text-foreground/80 leading-relaxed">
              Everyone who put money into this fund left notes, photos, and voice memos along the way.
              Some of it was reserved for today. It's all yours to read now.
            </p>
            {/* Generational identity seed. Screen 2's "pass it down" callout makes
                the MONEY case (this can fund the next generation); this closing beat
                makes the IDENTITY case at the emotional climax: the people in this
                book showed up for you, and one day you'll be the one who shows up.
                That reframes retention from "don't sell" (defensive) to "this is who
                I am now" (the kid-2.0 loop closing as a relationship). Calm register,
                no CTA, no push. */}
            <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-5">
              <p className="text-sm text-foreground/85 leading-relaxed">
                Someone started this for you before you were old enough to ask. One day there may be
                someone whose future you want to show up for the same way, and now you know how it's
                done: a little, early, and kept up over years. The book you're about to open shows you
                what that looks like.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  completeMutation.mutate(undefined, {
                    onSuccess: () => setLocation("/memory"),
                  });
                }}
                disabled={completeMutation.isPending}
              >
                Open the Memory Book
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? "Saving..." : "Go to your fund"}
              </Button>
            </div>
          </ScreenShell>
        )}
      </main>
    </div>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
      <span className="text-primary">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Continue({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" className="w-full" onClick={onClick}>
      {children}
      <ArrowRight size={14} className="ml-1" />
    </Button>
  );
}

function ChoiceCard({
  title,
  math,
  tone,
}: {
  title: string;
  math: string;
  tone: "grow" | "cash" | "sell";
}) {
  const Icon = tone === "grow" ? TrendingUp : tone === "cash" ? Coins : Receipt;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex gap-3">
      <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Icon size={16} />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-foreground/70 leading-relaxed">{math}</p>
      </div>
    </div>
  );
}

function TaxConcept({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-1.5">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-foreground/70 leading-relaxed">{body}</p>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 transition-colors ${
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border bg-card text-foreground/70 hover:border-foreground/30"
      } ${small ? "py-2 px-2 text-xs" : "py-3 px-4 text-sm"} font-medium`}
    >
      {children}
    </button>
  );
}
