import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// BookOpen replaces Sparkles 2026-05-12 for "Latest Memory Book moment" —
// Sparkles banned per feedback_no_ai_slop.md. BookOpen is the locked Memory
// Book semantic icon per feedback_iconography_consistency.md.
import { Heart, Lock, Mail, Gift, ArrowRight, Bookmark, CalendarDays, BookOpen, BellRing, TrendingUp, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { buildTrackedGetStartedHref } from "@/lib/acquisition";
import { useCountUp } from "@/hooks/use-count-up";
import { GifterFundSparkline } from "@/components/GifterFundSparkline";
import { readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { projectFundValue, yearsBetween } from "@shared/projection";

// Per-user gifter dashboard cache. Same caching trio pattern (initialData
// + writeLocalCache + 5-minute staleTime) as the rest of the codebase
// (funds, activities, events, co-parent collaborators, bank-accounts,
// memory book events, etc.). Added 2026-05-20 because the previous setup
// (no staleTime, no initialData) made every /gifter mount briefly render
// the 'Loading your saved funds...' text before the network resolved.
// The data is per-user and lifetime-aggregated; mutations (save fund,
// follow updates, send gift) invalidate the query explicitly so the cache
// stays accurate for actionable events.
const GIFTER_DASHBOARD_CACHE_KEY = "kiddo.gifter-dashboard.v1";

type GifterFundRow = {
  fundId: string;
  childName: string;
  fundName: string;
  sharePath: string;
  totalGifted: number;
  giftCount: number;
  lastGiftAt: string | null;
  savedAt: string | null;
  nextBirthdayLabel: string | null;
  // Treatment 3 attribution fields — added 2026-05-21. The server
  // already exposes nextBirthdayLabel + currentFundValue; these two
  // add the missing pieces (date + majority-age) so the client can
  // compute "your gifts could be worth ~$X when {child} turns N".
  recipientBirthdate: string | null;
  majorityAge: number;
  childPhase: string;
  fundStatus: string;
  currentFundValue: number;
  holdingsCount: number;
  activeEventCount: number;
  nextMilestoneTarget: number | null;
  nextMilestoneProgress: number;
  recentMemoryPreview: string | null;
  recentMemoryAuthor: string | null;
  recentMemoryAt: string | null;
  updatesEnabled: boolean;
  // 30-day fund-value history for the inline sparkline. Server-
  // populated; sparse weeks are fine — the sparkline interpolates
  // linearly between snapshots. Empty array when no snapshots
  // exist (brand-new fund). Locked 2026-05-19 per the gifter
  // read-only fund tracking enrichment.
  valueHistory30d?: Array<{ at: string; totalValue: number }>;
};

type GifterDashboardData = {
  summary: {
    savedFundCount: number;
    totalGifted: number;
    totalGifts: number;
    trackedFundValue: number;
    followingUpdatesCount: number;
  };
  funds: GifterFundRow[];
};

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function fmtDate(value: string | null) {
  if (!value) return "Not yet gifted";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(value: string) {
  switch (String(value || "").toLowerCase()) {
    case "active":
      return "Live and receiving gifts";
    case "draft":
      return "Waiting for investing activation";
    default:
      return "In progress";
  }
}

// "Your gift, projected forward" attribution per fund. Computes the
// future value of the gifter's lifetime contributions to this kid at
// the kid's UTMA majority. Returns null when there's no birthdate to
// anchor against, no gifts yet, or the kid is already past majority
// (no projection horizon). Treatment 3 of the five DUNPHY_DEMO_SPEC.md
// projection treatments — the "Gloria, you sent $X and it'll be worth
// ~$Y when Haley turns 21" moment.
function computeGifterAttribution(fund: GifterFundRow): {
  projected: number;
  yearsAhead: number;
  majorityAge: number;
} | null {
  if (!fund.recipientBirthdate) return null;
  if (fund.totalGifted <= 0) return null;
  const majorityDate = new Date(fund.recipientBirthdate);
  majorityDate.setFullYear(majorityDate.getFullYear() + fund.majorityAge);
  const yearsAhead = yearsBetween(new Date(), majorityDate);
  if (yearsAhead < 0.5) return null;
  const projected = projectFundValue({
    startingValue: fund.totalGifted,
    monthlyContribution: 0,
    yearsAhead,
    contributionYears: 0,
  });
  return { projected, yearsAhead, majorityAge: fund.majorityAge };
}

export default function GifterDashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const mode = params.get("mode") || "";
  const sessionId = params.get("session_id") || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, login, register, isLoggingIn, isRegistering } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [saveInFlight, setSaveInFlight] = useState(false);
  const startFundHref = buildTrackedGetStartedHref("", {
    ref: "gifter-dashboard",
    src: "gifter_dashboard",
    loop_touchpoint: "gifter_dashboard_cta",
    loop_channel: "web",
  });

  const { data, isLoading } = useQuery<GifterDashboardData>({
    queryKey: ["/api/gifter-account/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/gifter-account/dashboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load your saved funds");
      const payload = await res.json();
      writeLocalCache(GIFTER_DASHBOARD_CACHE_KEY, payload);
      return payload;
    },
    enabled: isAuthenticated,
    initialData: () => readLocalCache<GifterDashboardData>(GIFTER_DASHBOARD_CACHE_KEY),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  // Active + paused recurring schedules belonging to this gifter.
  // Powers the "Your recurring gifts" section per locked Decision A
  // (project_gifter_recurring_restoration.md).
  type GifterRecurringRow = {
    id: string;
    fundId: string;
    fundName: string;
    fundSlug: string | null;
    amount: number;
    frequency: "weekly" | "monthly" | "yearly";
    status: "active" | "paused" | "cancelled";
    pauseReason: string | null;
    nextChargeDate: string | null;
    createdAt: string;
  };
  const { data: recurringData } = useQuery<{ schedules: GifterRecurringRow[] }>({
    queryKey: ["/api/gifter-account/recurring"],
    queryFn: async () => {
      const res = await fetch("/api/gifter-account/recurring", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load recurring schedules");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const recurringSchedules = recurringData?.schedules ?? [];
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const handleCancelRecurring = async (scheduleId: string) => {
    if (!window.confirm("Cancel this recurring gift? Future charges stop; charges already made aren't affected.")) return;
    setCancellingId(scheduleId);
    try {
      const res = await fetch(`/api/gifter-account/recurring/${scheduleId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Cancel failed");
      haptic("success");
      toast({ title: "Recurring cancelled", description: "No further charges will fire." });
      queryClient.invalidateQueries({ queryKey: ["/api/gifter-account/recurring"] });
    } catch (err) {
      haptic("error");
      toast({ title: "Could not cancel", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  // Count-up on the five summary cards. The gifter surface is
  // Robinhood-minimal register; count-up belongs because these are
  // lifetime stats that mean "look what you did for these kids" —
  // they should settle in rather than flash. Counts round to int
  // on render; currency stays at default precision.
  const savedFundCount = data?.summary.savedFundCount ?? 0;
  const totalGifted = data?.summary.totalGifted ?? 0;
  const totalGifts = data?.summary.totalGifts ?? 0;
  const trackedFundValue = data?.summary.trackedFundValue ?? 0;
  const followingUpdatesCount = data?.summary.followingUpdatesCount ?? 0;
  const { value: animatedSavedFundCount, isAnimating: savedFundCountAnimating } = useCountUp({
    from: 0,
    to: savedFundCount,
    duration: 700,
    enabled: savedFundCount > 0,
  });
  const { value: animatedTotalGifted, isAnimating: totalGiftedAnimating } = useCountUp({
    from: totalGifted * 0.9,
    to: totalGifted,
    duration: 1000,
    enabled: totalGifted > 0,
  });
  const { value: animatedTotalGifts, isAnimating: totalGiftsAnimating } = useCountUp({
    from: 0,
    to: totalGifts,
    duration: 700,
    enabled: totalGifts > 0,
  });
  const { value: animatedTrackedFundValue, isAnimating: trackedFundValueAnimating } = useCountUp({
    from: trackedFundValue * 0.9,
    to: trackedFundValue,
    duration: 1000,
    enabled: trackedFundValue > 0,
  });
  const { value: animatedFollowingUpdatesCount, isAnimating: followingUpdatesCountAnimating } = useCountUp({
    from: 0,
    to: followingUpdatesCount,
    duration: 700,
    enabled: followingUpdatesCount > 0,
  });

  useEffect(() => {
    if (!isAuthenticated || !sessionId || mode !== "save" || saveInFlight) return;
    let cancelled = false;
    const run = async () => {
      try {
        setSaveInFlight(true);
        const res = await fetch("/api/gifter-account/save-fund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId, source: "gift_success" }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Could not save this fund.");
        if (!cancelled) {
          haptic("success");
          toast({ title: "Fund saved", description: `${payload?.childName || "This fund"} is now in your gifter dashboard.` });
          queryClient.invalidateQueries({ queryKey: ["/api/gifter-account/dashboard"] });
          setLocation("/gifter");
        }
      } catch (error) {
        if (!cancelled) {
          toast({ title: "Could not save fund", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setSaveInFlight(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionId, mode, saveInFlight, queryClient, setLocation]);

  const handleCreateAccount = async () => {
    try {
      const [firstName, ...rest] = name.trim().split(/\s+/);
      await register({
        email: email.trim(),
        password,
        firstName: firstName || undefined,
        lastName: rest.join(" ") || undefined,
      });
    } catch (error) {
      toast({ title: "Could not create account", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleLogin = async () => {
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      toast({ title: "Could not sign in", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to Kiddo</Link>
        </div>

        {!isAuthenticated ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8">
              <p className="text-sm font-medium text-primary">Gifter account</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground">Save the children you gift to often.</h1>
              <p className="mt-3 text-muted-foreground">
                Keep favorite fund links in one place, see your gifting history, and come back in one tap for the next birthday or holiday.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <Bookmark className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">Saved funds</p>
                  <p className="mt-1 text-sm text-muted-foreground">No more asking for the link every time.</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <Gift className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">Gift history</p>
                  <p className="mt-1 text-sm text-muted-foreground">See who you have supported and how often.</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">Birthday-ready</p>
                  <p className="mt-1 text-sm text-muted-foreground">Jump back in fast for the next event or birthday.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8">
              <div className="flex items-center gap-2 text-primary">
                <Lock className="h-4 w-4" />
                <p className="text-sm font-medium">Free forever</p>
              </div>
              <h2 className="mt-3 font-heading text-2xl font-semibold text-foreground">
                {mode === "save" ? "Create your gifter account to save this fund" : "Sign in or create your gifter account"}
              </h2>
              <div className="mt-5 space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                />
              </div>
              <div className="mt-4 grid gap-3">
                <Button onClick={handleCreateAccount} disabled={isRegistering || isLoggingIn}>
                  {isRegistering ? "Creating account..." : "Create free gifter account"}
                </Button>
                <Button variant="outline" onClick={handleLogin} disabled={isLoggingIn || isRegistering}>
                  {isLoggingIn ? "Signing in..." : "I already have an account"}
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                We only use this account to help you come back to the funds you care about. It does not make you the owner of any child's investments.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary">Your gifts</p>
                  <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground">
                    Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
                  </h1>
                  <p className="mt-2 text-muted-foreground">Everything you have saved or gifted to regularly, in one place.</p>
                </div>
                {sessionId && mode === "save" && (
                  <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm text-primary">
                    {saveInFlight ? "Saving this fund..." : "This gift page is ready to save."}
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Saved funds</p>
                  <p
                    className="mt-1 font-heading text-2xl text-foreground tabular-nums"
                    aria-live={savedFundCountAnimating ? "off" : "polite"}
                    aria-label={String(savedFundCount)}
                  >{Math.round(animatedSavedFundCount)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Total gifted</p>
                  <p
                    className="mt-1 font-heading text-2xl text-foreground tabular-nums"
                    aria-live={totalGiftedAnimating ? "off" : "polite"}
                    aria-label={fmtMoney(totalGifted)}
                  >{fmtMoney(animatedTotalGifted)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Total gifts</p>
                  <p
                    className="mt-1 font-heading text-2xl text-foreground tabular-nums"
                    aria-live={totalGiftsAnimating ? "off" : "polite"}
                    aria-label={String(totalGifts)}
                  >{Math.round(animatedTotalGifts)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Tracked fund value</p>
                  <p
                    className="mt-1 font-heading text-2xl text-foreground tabular-nums"
                    aria-live={trackedFundValueAnimating ? "off" : "polite"}
                    aria-label={fmtMoney(trackedFundValue)}
                  >{fmtMoney(animatedTrackedFundValue)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Following updates</p>
                  <p
                    className="mt-1 font-heading text-2xl text-foreground tabular-nums"
                    aria-live={followingUpdatesCountAnimating ? "off" : "polite"}
                    aria-label={String(followingUpdatesCount)}
                  >{Math.round(animatedFollowingUpdatesCount)}</p>
                </div>
              </div>

              {/* Download your gift history — CSV export. For
                  sophisticated gifters tracking Form 709 annual-exclusion
                  compliance, family-office bookkeeping, or CPA hand-off
                  at year-end. Authenticated server endpoint scopes to
                  this gifter's email. Locked 2026-05-19 per the
                  Five Towns roadmap P5. */}
              {totalGifts > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/60 bg-background p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Download your gift history</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">CSV with every gift, date, amount, recipient, and occasion. For your CPA or your records.</p>
                  </div>
                  <a
                    href="/api/gifter-account/gifts.csv"
                    download
                    onClick={() => haptic("selection")}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.12)]"
                    data-testid="button-download-gifter-csv"
                    aria-label="Download gift history CSV"
                  >
                    Download CSV
                  </a>
                </div>
              )}
            </div>

            {/* Recurring schedules — Tier-1 deferred work restored
                2026-05-21 per project_gifter_recurring_restoration.md.
                Shows active + paused recurring schedules belonging to
                this gifter. Cancel button per Decision A (stable
                cancellation home for account-bound gifters). Paused
                schedules show the reason: "payment_failed" surfaces
                an "Update card" CTA; "user" was a manual pause. */}
            {recurringSchedules.length > 0 && (
              <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8">
                <h2 className="font-heading text-2xl font-semibold text-foreground">Your recurring gifts</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Active schedules charge automatically on the cadence you picked. Cancel any time.
                </p>
                <div className="mt-5 grid gap-3">
                  {recurringSchedules.map((sch) => (
                    <div
                      key={sch.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background p-4"
                      data-testid={`recurring-row-${sch.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Repeat className="h-4 w-4 text-primary" />
                          <p className="font-semibold text-foreground">
                            {fmtMoney(sch.amount)} {sch.frequency} to {sch.fundName}
                          </p>
                          {sch.status === "paused" && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Paused
                            </span>
                          )}
                        </div>
                        {sch.status === "active" && sch.nextChargeDate && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Next charge: {new Date(sch.nextChargeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                        {sch.status === "paused" && sch.pauseReason === "payment_failed" && (
                          <p className="mt-1 text-xs text-amber-800">
                            Your last charge didn't go through. Update your payment to resume.
                          </p>
                        )}
                        {sch.status === "paused" && sch.pauseReason === "user" && (
                          <p className="mt-1 text-xs text-muted-foreground">Paused by you.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCancelRecurring(sch.id)}
                        disabled={cancellingId === sch.id}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                        data-testid={`cancel-recurring-${sch.id}`}
                      >
                        {cancellingId === sch.id ? "Cancelling…" : "Cancel"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-semibold text-foreground">Saved children and funds</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This is your read-only relationship view: who you have helped, how those funds are doing now, and whether updates are still reaching you.
                  </p>
                </div>
                <Link href={startFundHref}>
                  <Button variant="outline">
                    Start your own fund
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              {isLoading ? (
                <p className="mt-4 text-sm text-muted-foreground">Loading your saved funds...</p>
              ) : data?.funds?.length ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {data.funds.map((fund) => {
                    const attribution = computeGifterAttribution(fund);
                    return (
                    <div key={fund.fundId} className="rounded-3xl border border-border/60 bg-background p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{fund.childPhase === "teen" ? "Teen fund" : "Child fund"}</p>
                          <h3 className="mt-2 font-heading text-xl font-semibold text-foreground">{fund.childName}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {fund.giftCount > 0 ? `${fund.giftCount} gifts sent • ${fmtMoney(fund.totalGifted)} from you` : "Saved for the next event"}
                          </p>
                        </div>
                        <Heart className="h-5 w-5 text-primary" />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-muted/40 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Fund value now</p>
                              <p className="mt-1 font-medium text-foreground tabular-nums">{fmtMoney(fund.currentFundValue)}</p>
                            </div>
                            {/* 30-day sparkline — landing 2026-05-19 as the
                                gifter read-only enrichment from the Five
                                Towns roadmap. Renders only when we have
                                2+ snapshot points so brand-new funds don't
                                show a misleading flat line. Same data
                                domain as currentFundValue (total fund
                                value, no per-position or per-gifter PII). */}
                            {(fund.valueHistory30d ?? []).length >= 2 && (
                              <GifterFundSparkline points={fund.valueHistory30d ?? []} className="mt-0.5 shrink-0" />
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="mt-1 font-medium text-foreground">{statusLabel(fund.fundStatus)}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                        <p>Last gift: {fmtDate(fund.lastGiftAt)}</p>
                        <p>Birthday anchor: {fund.nextBirthdayLabel || "Not added yet"}</p>
                        <p>{fund.holdingsCount} holdings • {fund.activeEventCount} active events</p>
                        <p className="flex items-center gap-2">
                          <BellRing className="h-4 w-4 text-primary" />
                          {fund.updatesEnabled ? "You are following updates for this fund" : "You are not following updates for this fund yet"}
                        </p>
                      </div>

                      {/* Gifter attribution projection — Treatment 3 of
                          the five DUNPHY_DEMO_SPEC.md projection
                          treatments. Anchors lifetime contributions to
                          their projected impact at the kid's majority.
                          Calmly worded ("could be worth ~$X") with the
                          locked assumptions footer. Hidden when there's
                          no birthdate / no gifts / kid already at
                          majority — handled inside computeGifterAttribution.
                          Lives on the live gifter dashboard, not demo-
                          gated: a grandma seeing the long-tail impact of
                          her $50 birthday gift is exactly the retention
                          mechanic the gifter loop depends on. */}
                      {attribution && (
                        <div className="mt-4 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.06)] p-4">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-[hsl(var(--kiddo-evergreen))]" />
                            <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] uppercase tracking-wide">
                              Your gifts, projected forward
                            </p>
                          </div>
                          <p className="mt-2 font-heading text-2xl font-bold text-foreground tabular-nums">
                            ~{fmtMoney(attribution.projected)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground leading-snug">
                            Your {fmtMoney(fund.totalGifted)} to {fund.childName} could be worth this when {fund.childName} turns {attribution.majorityAge}, if it stays invested.
                          </p>
                          <p className="mt-2 text-[10px] text-muted-foreground/60 leading-snug">
                            Assumes 7% yearly average net of Kiddo's annual fee ($1/yr per $1,000 invested). Markets vary.
                          </p>
                        </div>
                      )}

                      {fund.nextMilestoneTarget && (
                        <div className="mt-4 rounded-2xl bg-muted/30 p-4">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <p className="font-medium text-foreground">Next family milestone</p>
                            <p className="text-muted-foreground">{fmtMoney(fund.nextMilestoneTarget)}</p>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${fund.nextMilestoneProgress}%` }} />
                          </div>
                        </div>
                      )}

                      {fund.recentMemoryPreview && (
                        <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
                          <div className="flex items-center gap-2 text-primary">
                            <BookOpen className="h-4 w-4" />
                            <p className="text-sm font-medium">Latest Memory Book moment</p>
                          </div>
                          <p className="mt-2 text-sm text-foreground">"{fund.recentMemoryPreview}"</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {fund.recentMemoryAuthor ? `${fund.recentMemoryAuthor} • ` : ""}{fmtDate(fund.recentMemoryAt)}
                          </p>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link href={fund.sharePath}>
                          <Button>
                            Gift again
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                        {/* Disabled "Read-only tracking" button REMOVED
                            2026-05-19 per the Five Towns gifter audit.
                            The card itself IS the read-only tracking view:
                            it surfaces current fund value, holdings count,
                            active events, last gift date, next milestone
                            progress, and latest Memory Book preview. A
                            separate "tracking" destination would either
                            duplicate the card or expose PII the parent's
                            privacy settings haven't authorized. Promising
                            a feature via a disabled button is worse than
                            not promising it. If a dedicated detail view
                            ships later (per-holding allocation, balance
                            chart, etc.) this is the slot for its CTA. */}
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <Mail className="mx-auto h-5 w-5 text-primary" />
                  <p className="mt-3 font-medium text-foreground">No saved funds yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">The next time you finish a gift, use "Save this fund" and it will show up here with fund value, milestones, and memory updates.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
