import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// BookOpen replaces Sparkles 2026-05-12 for "Latest Memory Book moment" —
// Sparkles banned per feedback_no_ai_slop.md. BookOpen is the locked Memory
// Book semantic icon per feedback_iconography_consistency.md.
import { Heart, Lock, Mail, Gift, ArrowRight, Bookmark, CalendarDays, BookOpen, BellRing, TrendingUp, Repeat, Crown, Plus, Pause, Play, Pencil, Receipt, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
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
import { PROJECTION_DISCLAIMER } from "@shared/legal-copy";

// Per-user gifter dashboard cache. Same caching trio pattern (initialData
// + writeLocalCache + 5-minute staleTime) as the rest of the codebase
// (funds, activities, events, co-parent collaborators, bank-accounts,
// memory book events, etc.). Added 2026-05-20 because the previous setup
// (no staleTime, no initialData) made every /gifter mount briefly render
// the 'Loading your saved funds...' text before the network resolved.
// The data is per-user and lifetime-aggregated; mutations (save fund,
// follow updates, send gift) invalidate the query explicitly so the cache
// stays accurate for actionable events.
//
// 2026-05-31 FIX: this key + the query key were a single CONSTANT, NOT
// per-user despite the comment above claiming "per-user". So switching
// accounts (e.g. flipping demo personas Jay → Cameron → Manny) showed the
// PREVIOUS user's saved-fund cards — identical "$3,250 from you" cards
// under every persona — until the network refetch landed (and the
// localStorage initialData re-seeded the stale blob on the next mount).
// The hero (fresh from refetch) and the cards (stale cache) could even
// disagree on the same screen. The cache is now namespaced by user id so
// each account reads only its own gifts. `${base}.${userId}` mirrors the
// shape used by the other per-user caches in this codebase.
const GIFTER_DASHBOARD_CACHE_BASE = "kiddo.gifter-dashboard.v1";

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
  // Sponsor-Plus eligibility per fund. True when the fund is on Free
  // tier (could meaningfully receive a year of Plus / Family from a
  // gifter sponsor). False when already covered. Drives the inline
  // sponsor pill on the fund card. Added 2026-05-25 to replace the
  // previously-removed (false-claim) Sponsor-Plus 'discovery card.'
  eligibleForSponsorship?: boolean;
  // 30-day fund-value history for the inline sparkline. Server-
  // populated; sparse weeks are fine — the sparkline interpolates
  // linearly between snapshots. Empty array when no snapshots
  // exist (brand-new fund). Locked 2026-05-19 per the gifter
  // read-only fund tracking enrichment.
  valueHistory30d?: Array<{ at: string; totalValue: number }>;
};

type SponsoredSubRow = {
  id: string;
  fundId: string;
  fundSlug: string | null;
  childName: string;
  tier: string;
  status: string;
  activatedAt: string;
  expiresAt: string;
};

type FounderGiftRow = {
  recipientName: string;
  recipientEmail: string;
  position: number;
  createdAt: string;
  message: string | null;
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
  sponsoredSubs?: SponsoredSubRow[];
  founderGifts?: FounderGiftRow[];
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

// Card eyebrow label from the server's age phase. Previously this was an
// inline `childPhase === "teen" ? "Teen fund" : "Child fund"` ternary,
// which mislabeled a graduated ADULT (server phase "adult", e.g. Haley at
// 22 past CA majority 21) as a "Child fund" — the oldest recipient reading
// as a child while the younger two read "Teen". The server already
// distinguishes "adult" (age >= majority = handed off); honor it here so a
// post-handoff account reads as the grown-up account it is. "unknown"
// (missing/invalid birthdate) falls back to a neutral "Fund". 2026-05-31.
function phaseLabel(phase: string): string {
  switch (String(phase || "").toLowerCase()) {
    case "adult":
      return "Adult account";
    case "teen":
      return "Teen fund";
    case "child":
      return "Child fund";
    default:
      return "Fund";
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
  const isDemoUser = Boolean((user as any)?.isDemoAccount);

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

  // Per-user cache namespace — keyed by the signed-in user's id so one
  // account never reads another's saved-fund blob (the cross-persona
  // bleed fixed 2026-05-31). Falls back to "anon" pre-auth; the query is
  // gated on isAuthenticated so the anon bucket is never actually written.
  const gifterCacheKey = `${GIFTER_DASHBOARD_CACHE_BASE}.${user?.id ?? "anon"}`;

  const { data, isLoading } = useQuery<GifterDashboardData>({
    queryKey: ["/api/gifter-account/dashboard", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/gifter-account/dashboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load your saved funds");
      const payload = await res.json();
      writeLocalCache(gifterCacheKey, payload);
      return payload;
    },
    enabled: isAuthenticated,
    initialData: () => readLocalCache<GifterDashboardData>(gifterCacheKey),
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
    // True for real auto-charging Stripe subs; false for Free-fund
    // reminder cadences (date is a reminder email, not a charge).
    autoCharge?: boolean;
  };
  const { data: recurringData } = useQuery<{ schedules: GifterRecurringRow[] }>({
    // user?.id in the key for the same cross-account reason as the
    // dashboard query above — otherwise a persona switch shows the prior
    // account's recurring schedules until refetch. (invalidateQueries on
    // the bare ["/api/gifter-account/recurring"] prefix still matches.)
    queryKey: ["/api/gifter-account/recurring", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/gifter-account/recurring", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load recurring schedules");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const recurringSchedules = recurringData?.schedules ?? [];
  const sponsoredSubs = data?.sponsoredSubs ?? [];
  const founderGifts = data?.founderGifts ?? [];
  // Active commitments — what the user has on the line RIGHT NOW.
  // Drives the hero section's existence: if zero, show empty state;
  // if non-zero, lead with these. Per the IA restructure 2026-05-23.
  const hasActiveCommitments =
    recurringSchedules.some((s) => s.status === "active") ||
    sponsoredSubs.some((s) => s.status === "active" && new Date(s.expiresAt).getTime() > Date.now());
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

  // Follow / unfollow updates on a saved fund. Added 2026-05-25 after
  // the gifter-dashboard audit found the "You are not following updates
  // for this fund yet" status was a dead-end with no associated action.
  // Optimistic UI: flip the local cached fund state immediately, then
  // refetch on resolve so the server is the source of truth. Failure
  // path: rollback + toast.
  const [updatingFollowId, setUpdatingFollowId] = useState<string | null>(null);
  const handleToggleFollow = async (fundId: string, currentlyFollowing: boolean) => {
    if (updatingFollowId) return;
    setUpdatingFollowId(fundId);
    const action = currentlyFollowing ? "unfollow" : "follow";
    try {
      const res = await fetch(`/api/gifter-account/funds/${fundId}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      haptic("success");
      toast({
        title: currentlyFollowing ? "Updates off" : "Following updates",
        description: currentlyFollowing
          ? "You'll stop receiving milestone and Memory Book emails for this fund."
          : "You'll get milestone, anniversary, and Memory Book emails for this fund.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gifter-account/dashboard"] });
    } catch (err) {
      haptic("error");
      toast({
        title: currentlyFollowing ? "Could not turn off updates" : "Could not follow updates",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFollowId(null);
    }
  };

  // ── Active-recurring management: pause / resume / edit / history ──
  // The hero used to offer Cancel only. These add the rest of the
  // lifecycle a gifter actually needs: pause ("skip this year"), resume,
  // edit (change amount/cadence), and a per-schedule charge history
  // ("you've given $300 across 3 charges"). Backend endpoints branch on
  // whether the row is a real Stripe subscription or a reminder cadence.
  const refreshRecurring = () => queryClient.invalidateQueries({ queryKey: ["/api/gifter-account/recurring"] });
  const [busyScheduleId, setBusyScheduleId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editFrequency, setEditFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  type ChargeHistory = {
    charges: Array<{ id: string; amount: number; at: string | null }>;
    totalCharged: number;
    count: number;
    reminderOnly: boolean;
  };
  const [historyById, setHistoryById] = useState<Record<string, ChargeHistory | "loading" | "error">>({});

  const handlePauseResume = async (sch: GifterRecurringRow, pause: boolean) => {
    if (busyScheduleId) return;
    setBusyScheduleId(sch.id);
    try {
      const res = await fetch(`/api/gifter-account/recurring/${sch.id}/${pause ? "pause" : "resume"}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      haptic("success");
      toast({
        title: pause ? "Recurring paused" : "Recurring resumed",
        description: pause
          ? `No further charges to ${sch.fundName} until you resume.`
          : `Charges to ${sch.fundName} will continue on schedule.`,
      });
      refreshRecurring();
    } catch (err) {
      haptic("error");
      toast({ title: pause ? "Could not pause" : "Could not resume", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setBusyScheduleId(null);
    }
  };

  const openEditor = (sch: GifterRecurringRow) => {
    setEditingId(sch.id);
    setEditAmount(String(sch.amount));
    // Defensive: legacy/demo rows may carry non-canonical cadence values
    // (e.g. "annual"). Normalize to the three the editor + /update accept
    // so the dropdown shows a valid selection and Save doesn't 400.
    const freq = String(sch.frequency);
    setEditFrequency(freq === "annual" ? "yearly" : (["weekly", "monthly", "yearly"].includes(freq) ? (freq as "weekly" | "monthly" | "yearly") : "monthly"));
    setHistoryOpenId(null);
  };

  const handleSaveEdit = async (sch: GifterRecurringRow) => {
    const amountNum = parseFloat(editAmount);
    if (!Number.isFinite(amountNum) || amountNum < 1) {
      toast({ title: "Enter a valid amount", description: "At least $1.", variant: "destructive" });
      return;
    }
    setBusyScheduleId(sch.id);
    try {
      const res = await fetch(`/api/gifter-account/recurring/${sch.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: amountNum, frequency: editFrequency }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      haptic("success");
      toast({ title: "Recurring updated", description: `Now ${fmtMoney(amountNum)} ${editFrequency} to ${sch.fundName}. New terms apply next cycle.` });
      setEditingId(null);
      refreshRecurring();
    } catch (err) {
      haptic("error");
      toast({ title: "Could not update", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setBusyScheduleId(null);
    }
  };

  const handleToggleHistory = async (sch: GifterRecurringRow) => {
    if (historyOpenId === sch.id) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(sch.id);
    setEditingId(null);
    if (historyById[sch.id] && historyById[sch.id] !== "error") return;
    setHistoryById((prev) => ({ ...prev, [sch.id]: "loading" }));
    try {
      const res = await fetch(`/api/gifter-account/recurring/${sch.id}/history`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as ChargeHistory;
      setHistoryById((prev) => ({ ...prev, [sch.id]: payload }));
    } catch {
      setHistoryById((prev) => ({ ...prev, [sch.id]: "error" }));
    }
  };

  // Count-up on the five summary cards. The gifter surface is
  // Robinhood-minimal register; count-up belongs because these are
  // lifetime stats that mean "look what you did for these kids" —
  // they should settle in rather than flash. Counts round to int
  // on render; currency stays at default precision.
  const savedFundCount = data?.summary.savedFundCount ?? 0;
  const totalGifted = data?.summary.totalGifted ?? 0;
  // totalGifts stays as a raw number — used by the CSV-download gate
  // below (only renders when the gifter has actually given at least
  // once). The stat-chip + its useCountUp were dropped 2026-05-25 audit.
  const totalGifts = data?.summary.totalGifts ?? 0;
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
          // Land the gifter on the brandable /my-gifts URL (was /gifter,
          // an internal-vocab name they shouldn't see in their address
          // bar). Both routes resolve to the same component.
          setLocation("/my-gifts");
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
      const result = await login({ email: email.trim(), password });
      if ((result as any)?.twoFactorRequired) {
        // 2FA-enrolled account: no session yet. Finish sign-in (incl. the code
        // step) on the full login page, then return to the gifter dashboard.
        window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
    } catch (error) {
      toast({ title: "Could not sign in", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <Logo />
          {/* Demo users came in via the /demo persona picker; sending them
              to the marketing root ("/") on "back" dumps them out of the
              demo entirely. Route them back to /demo instead so they can
              keep exploring (or switch personas). Real gifters still go to
              the marketing home. Per DUNPHY_DEMO_SPEC.md. */}
          <Link
            href={isDemoUser ? "/demo" : "/"}
            className="text-sm text-muted-foreground hover:text-foreground"
            data-testid="link-gifter-back"
          >
            {isDemoUser ? "Back to demo" : "Back to Kiddo"}
          </Link>
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
                <p className="text-sm font-medium">Free gifter account</p>
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
              {/* Magic-link gifters set up recurring with NO password, so a
                  password form alone locks them out of their own dashboard (the
                  one place to cancel a charge). Route them to /login, which has
                  the passwordless "email me a sign-in link" flow; AuthMagic lands
                  them back on /my-gifts after verify. */}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                No password? <Link href="/login" className="font-medium text-primary hover:underline">Email me a sign-in link</Link>
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                We only use this account to help you come back to the funds you care about. It does not make you the owner of any child's investments.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* ── Branded impact hero ──────────────────────────────
                Redesign 2026-05-26: the gifter surface previously opened
                on a flat white card with three muted stat-chips — visually
                the weakest hero in the app. This replaces it with the
                evergreen-gradient hero treatment used on the Dashboard
                (.kiddo-hero-card), leading with the gifter's PROUD lifetime
                number (total gifted, count-up) and a warm impact line. The
                same three stats survive, but they now read as "look what
                you did for these kids" rather than a utilitarian strip.
                Stats counts are preserved verbatim (saved / gifted /
                following) with their count-up + aria-live attributes. */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8"
              style={{ background: "linear-gradient(145deg, hsl(var(--kiddo-evergreen)) 0%, hsl(153 48% 11%) 100%)" }}
              data-testid="gifter-hero"
            >
              {/* Soft gold glow, top-right — the warmth accent that keeps
                  the dark hero from reading as a bank statement. */}
              <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[hsl(var(--kiddo-gold)/0.20)] blur-3xl" />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Your gifts</p>
                <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
                  Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
                </h1>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
                  {savedFundCount > 0
                    ? `You've shown up for ${savedFundCount} ${savedFundCount === 1 ? "child" : "children"} — and what you gave keeps growing for them.`
                    : "The funds you've gifted to, in one place."}
                </p>

                <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Total gifted</p>
                    <p
                      className="mt-0.5 font-heading text-3xl font-bold tabular-nums sm:text-4xl"
                      aria-live={totalGiftedAnimating ? "off" : "polite"}
                      aria-label={fmtMoney(totalGifted)}
                    >{fmtMoney(animatedTotalGifted)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">{savedFundCount === 1 ? "Child" : "Children"}</p>
                    <p
                      className="mt-0.5 font-heading text-2xl font-semibold tabular-nums"
                      aria-live={savedFundCountAnimating ? "off" : "polite"}
                      aria-label={String(savedFundCount)}
                    >{Math.round(animatedSavedFundCount)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Following</p>
                    <p
                      className="mt-0.5 font-heading text-2xl font-semibold tabular-nums"
                      aria-live={followingUpdatesCountAnimating ? "off" : "polite"}
                      aria-label={String(followingUpdatesCount)}
                    >{Math.round(animatedFollowingUpdatesCount)}</p>
                  </div>
                </div>

                {sessionId && mode === "save" && (
                  <div className="mt-5 inline-flex rounded-2xl bg-white/10 px-4 py-2.5 text-sm text-white backdrop-blur-sm">
                    {saveInFlight ? "Saving this fund..." : "This gift page is ready to save."}
                  </div>
                )}
              </div>
            </motion.div>

            {/* ─── Active commitments hero ─────────────────────
                2026-05-25 audit: the previous version of this card
                ALSO rendered when there were no active recurring or
                sponsorship commitments, showing 'Nothing on your
                plate right now' as a full hero card with a Repeat
                icon. That was the central confusion the user kept
                flagging: a gifter who has given $475 across 6 gifts
                isn't 'doing nothing' — they're a real customer with
                history. Celebrating emptiness as the second card on
                the page was wrong framing.

                Now: this card ONLY renders when there's actually
                something active. When empty, we skip it entirely
                and let the fund cards below carry the page. The
                'Start a fund for someone you love' CTA that used
                to live inside the empty-state body has been moved
                to the page footer alongside Founder gifting. */}
            {hasActiveCommitments && (
            <div
              className="rounded-[28px] border border-[hsl(var(--kiddo-evergreen))]/30 bg-[hsl(var(--kiddo-evergreen))]/6 p-6 sm:p-8"
              data-testid="hero-active-commitments"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen))] text-white">
                  <Repeat size={18} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    What's happening with your gifts
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Active recurring schedules and sponsorships. Cancel or change anything below.
                  </p>
                </div>
              </div>

              {/* Active recurring schedules — promoted to hero. Each row
                  is now a full management surface: pause/resume, edit
                  (amount + cadence, applied next cycle), an expandable
                  charge history, and cancel. Redesign 2026-05-26. */}
              {recurringSchedules.filter((s) => s.status === "active").length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active recurring</p>
                  {recurringSchedules
                    .filter((s) => s.status === "active")
                    .map((sch) => {
                      const isEditing = editingId === sch.id;
                      const isHistoryOpen = historyOpenId === sch.id;
                      const busy = busyScheduleId === sch.id;
                      const history = historyById[sch.id];
                      return (
                      <div
                        key={sch.id}
                        className="rounded-2xl border border-border/60 bg-background p-4"
                        data-testid={`hero-recurring-${sch.id}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground tabular-nums">
                              {fmtMoney(sch.amount)} {sch.frequency} to {sch.fundName}
                            </p>
                            {sch.nextChargeDate && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{sch.autoCharge === false ? "Next reminder:" : "Next charge:"}</span>{" "}
                                {new Date(sch.nextChargeDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action bar */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePauseResume(sch, true)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                            data-testid={`hero-pause-recurring-${sch.id}`}
                          >
                            <Pause className="h-3.5 w-3.5" />
                            {busy ? "…" : "Pause"}
                          </button>
                          <button
                            type="button"
                            onClick={() => (isEditing ? setEditingId(null) : openEditor(sch))}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isEditing ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                            data-testid={`hero-edit-recurring-${sch.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHistory(sch)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isHistoryOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                            data-testid={`hero-history-recurring-${sch.id}`}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            History
                            <ChevronDown className={`h-3 w-3 transition-transform ${isHistoryOpen ? "rotate-180" : ""}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelRecurring(sch.id)}
                            disabled={cancellingId === sch.id}
                            className="ml-auto inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            aria-label={`Cancel recurring gift of ${fmtMoney(sch.amount)} ${sch.frequency} to ${sch.fundName}`}
                            data-testid={`hero-cancel-recurring-${sch.id}`}
                          >
                            {cancellingId === sch.id ? "Cancelling…" : "Cancel"}
                          </button>
                        </div>

                        {/* Inline editor */}
                        {isEditing && (
                          <div className="mt-3 rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.2)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-3" data-testid={`hero-editor-recurring-${sch.id}`}>
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="flex-1 min-w-[120px]">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</span>
                                <div className="mt-1 flex items-center rounded-lg border border-border bg-background px-3">
                                  <span className="text-sm text-muted-foreground">$</span>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    inputMode="decimal"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="h-10 w-full bg-transparent px-1 text-sm tabular-nums outline-none"
                                    data-testid={`hero-edit-amount-${sch.id}`}
                                  />
                                </div>
                              </label>
                              <label className="flex-1 min-w-[120px]">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cadence</span>
                                <select
                                  value={editFrequency}
                                  onChange={(e) => setEditFrequency(e.target.value as "weekly" | "monthly" | "yearly")}
                                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none"
                                  data-testid={`hero-edit-frequency-${sch.id}`}
                                >
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="yearly">Yearly</option>
                                </select>
                              </label>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(sch)} disabled={busy} data-testid={`hero-save-edit-${sch.id}`}>
                                {busy ? "Saving…" : "Save changes"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
                                Cancel
                              </Button>
                            </div>
                            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                              New amount and cadence take effect next cycle — you won't be charged anything extra today.
                            </p>
                          </div>
                        )}

                        {/* Charge history */}
                        {isHistoryOpen && (
                          <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3" data-testid={`hero-history-panel-${sch.id}`}>
                            {history === "loading" || history === undefined ? (
                              <p className="text-xs text-muted-foreground">Loading charge history…</p>
                            ) : history === "error" ? (
                              <p className="text-xs text-muted-foreground">Couldn't load history. Try again in a moment.</p>
                            ) : history.reminderOnly ? (
                              <p className="text-xs leading-snug text-muted-foreground">
                                This is a gift reminder, not an automatic charge — nothing is billed to your card. You'll get an email each cycle so you can choose to give.
                              </p>
                            ) : history.count === 0 ? (
                              <p className="text-xs text-muted-foreground">No charges yet — your first one will appear here.</p>
                            ) : (
                              <>
                                <p className="text-xs font-semibold text-foreground">
                                  {fmtMoney(history.totalCharged)} given to {sch.fundName} across {history.count} {history.count === 1 ? "charge" : "charges"}
                                </p>
                                <ul className="mt-2 divide-y divide-border/60">
                                  {history.charges.map((c) => (
                                    <li key={c.id} className="flex items-center justify-between py-1.5 text-xs">
                                      <span className="text-muted-foreground">{c.at ? fmtDate(c.at) : "—"}</span>
                                      <span className="font-medium text-foreground tabular-nums">{fmtMoney(c.amount)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                </div>
              )}

              {/* Active sponsored Plus subs — promoted to hero. Shows
                  ones that haven't expired yet, sorted by nearest-
                  expiry-first so urgent renewals surface. */}
              {sponsoredSubs.filter((s) => s.status === "active" && new Date(s.expiresAt).getTime() > Date.now()).length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active sponsorships</p>
                  {sponsoredSubs
                    .filter((s) => s.status === "active" && new Date(s.expiresAt).getTime() > Date.now())
                    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
                    .map((sub) => {
                      const expiresLabel = new Date(sub.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                      const tierLabel = sub.tier === "family" ? "Kiddo Family" : "Kiddo Plus";
                      return (
                        <div
                          key={sub.id}
                          className="rounded-2xl border border-border/60 bg-background p-4"
                          data-testid={`hero-sponsorship-${sub.id}`}
                        >
                          <p className="font-semibold text-foreground">
                            {tierLabel} on {sub.childName}'s fund
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Expires {expiresLabel}. Your card won't be re-charged; {sub.childName}'s family decides whether to renew directly.
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}

            </div>
            )}

            {/* Recurring schedules (history view) — Tier-1 deferred work
                restored 2026-05-21 per project_gifter_recurring_restoration.md.
                Shows PAUSED + cancelled-recently schedules. Active ones
                are surfaced in the HERO above; this section is now the
                history/state-management surface for non-active rows.
                Cancel button per Decision A (stable cancellation home
                for account-bound gifters). Paused schedules show the
                reason: "payment_failed" surfaces an "Update card" CTA;
                "user" was a manual pause. */}
            {recurringSchedules.filter((s) => s.status !== "active").length > 0 && (
              <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8">
                <h2 className="font-heading text-2xl font-semibold text-foreground">Paused recurring gifts</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Schedules that need your attention before they resume.
                </p>
                <div className="mt-5 grid gap-3">
                  {recurringSchedules.filter((s) => s.status !== "active").map((sch) => (
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
                        {sch.status === "paused" && sch.pauseReason === "payment_failed" && (
                          <p className="mt-1 text-xs text-amber-800">
                            Your last charge didn't go through. Update your payment to resume.
                          </p>
                        )}
                        {sch.status === "paused" && sch.pauseReason === "user" && (
                          <p className="mt-1 text-xs text-muted-foreground">Paused by you.</p>
                        )}
                        {sch.status === "paused" && sch.pauseReason === "majority_handoff" && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            This recurring gift ended when {sch.fundName.replace(/['’]s Fund$/i, "").trim() || "the recipient"} received their fund at the age of majority. It is theirs to grow now.
                          </p>
                        )}
                        {sch.status === "paused" && sch.pauseReason !== "payment_failed" && sch.pauseReason !== "user" && sch.pauseReason !== "majority_handoff" && (
                          <p className="mt-1 text-xs text-muted-foreground">This recurring gift is paused.</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {sch.status === "paused" && sch.pauseReason === "user" && (
                          <button
                            type="button"
                            onClick={() => handlePauseResume(sch, false)}
                            disabled={busyScheduleId === sch.id}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] transition-colors hover:bg-[hsl(var(--kiddo-evergreen)/0.08)] disabled:opacity-50"
                            data-testid={`resume-recurring-${sch.id}`}
                          >
                            <Play className="h-3.5 w-3.5" />
                            {busyScheduleId === sch.id ? "Resuming…" : "Resume"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCancelRecurring(sch.id)}
                          disabled={cancellingId === sch.id}
                          className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          data-testid={`cancel-recurring-${sch.id}`}
                        >
                          {cancellingId === sch.id ? "Cancelling…" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sponsorship history — full list (active + expired + refunded).
                Active sponsorships are surfaced in the hero above; this is
                the receipt/audit-trail section for everything the gifter
                has ever sponsored. Includes expired rows so the gifter
                can see "you gave Emma's family a year of Plus" as a
                historical fact even after it ran out. Rendered only if
                the gifter has at least one sponsorship row. */}
            {sponsoredSubs.length > 0 && (
              <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8" data-testid="section-sponsorships">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-evergreen))]/10 text-[hsl(var(--kiddo-evergreen))]">
                    <Crown size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h2 className="font-heading text-2xl font-semibold text-foreground">Sponsorships you've given</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Years of Kiddo Plus or Family you bought for the families you care about.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  {sponsoredSubs.map((sub) => {
                    const tierLabel = sub.tier === "family" ? "Kiddo Family" : "Kiddo Plus";
                    const activatedLabel = new Date(sub.activatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const expiresLabel = new Date(sub.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const isActive = sub.status === "active" && new Date(sub.expiresAt).getTime() > Date.now();
                    const isExpired = !isActive && sub.status !== "refunded";
                    return (
                      <div
                        key={sub.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background p-4"
                        data-testid={`sponsorship-row-${sub.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">
                              {tierLabel} on {sub.childName}'s fund
                            </p>
                            {isActive && (
                              <span className="rounded-full bg-[hsl(var(--kiddo-evergreen))]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">
                                Active
                              </span>
                            )}
                            {isExpired && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Expired
                              </span>
                            )}
                            {sub.status === "refunded" && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                Refunded
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Activated {activatedLabel} · {isActive ? "Expires" : "Ended"} {expiresLabel}
                          </p>
                        </div>
                        {sub.fundSlug && (
                          <Link href={`/${sub.fundSlug}`}>
                            <Button variant="ghost" size="sm" className="text-xs">
                              View fund
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Founder gifts — Founding Members slots the gifter has
                bought as gifts. Each row shows recipient + position +
                date. No "view" link because Founder slots redeem via
                a code emailed at purchase; the founder-membership
                surface is the recipient's, not the gifter's. */}
            {founderGifts.length > 0 && (
              <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8" data-testid="section-founder-gifts">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-evergreen))]/10 text-[hsl(var(--kiddo-evergreen))]">
                    <Crown size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h2 className="font-heading text-2xl font-semibold text-foreground">Founder slots you've gifted</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Founding Member slots you bought for people in your life. Each one carries the lifetime price lock.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  {founderGifts.map((gift, idx) => {
                    const giftedLabel = new Date(gift.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    return (
                      <div
                        key={`${gift.recipientEmail}-${gift.createdAt}-${idx}`}
                        className="rounded-2xl border border-border/60 bg-background p-4"
                        data-testid={`founder-gift-row-${idx}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">
                            Founder #{gift.position} for {gift.recipientName}
                          </p>
                          <p className="text-xs text-muted-foreground">{giftedLabel}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Sent to {gift.recipientEmail}
                        </p>
                        {gift.message && (
                          <p className="mt-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-foreground italic">
                            "{gift.message}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  {/* Header tightened 2026-05-25 audit. Was "Saved
                      children and funds" with a 16-word subtitle; now
                      "Funds you've gifted to" + a single-line subtitle
                      that names what's actionable on each card (gift
                      again, follow updates, sponsor a year).  */}
                  <h2 className="font-heading text-2xl font-semibold text-foreground">Funds you've gifted to</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Each card shows fund value, milestone progress, and your follow-updates toggle.
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
                  {data.funds.map((fund, fundIdx) => {
                    const attribution = computeGifterAttribution(fund);
                    return (
                    <motion.div
                      key={fund.fundId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: Math.min(fundIdx * 0.05, 0.3) }}
                      className="rounded-3xl border border-border/60 bg-background p-5 shadow-[0_1px_3px_rgba(26,23,16,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(26,23,16,0.10)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{phaseLabel(fund.childPhase)}</p>
                          <h3 className="mt-2 font-heading text-xl font-semibold text-foreground">{fund.childName}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {fund.giftCount > 0 ? `${fund.giftCount} gifts sent • ${fmtMoney(fund.totalGifted)} from you` : "Saved for the next event"}
                          </p>
                        </div>
                        <Heart className="h-5 w-5 text-primary" />
                      </div>

                      {/* Stats row 2026-05-25 audit: the second cell used
                          to be 'Status: Live and receiving gifts' which
                          was dashboard cosplay — 99% of funds shown here
                          are live (otherwise they wouldn't accept gifts).
                          When status IS non-active (paused/closed) we
                          surface a different cell ('Status: Paused' etc).
                          When active, the slot now goes to 'Your total
                          gifts' which is gifter-owned context. */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-muted/40 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Fund value now</p>
                              <p className="mt-1 font-medium text-foreground tabular-nums">{fmtMoney(fund.currentFundValue)}</p>
                            </div>
                            {(fund.valueHistory30d ?? []).length >= 2 && (
                              <GifterFundSparkline points={fund.valueHistory30d ?? []} className="mt-0.5 shrink-0" />
                            )}
                          </div>
                        </div>
                        {String(fund.fundStatus || "").toLowerCase() === "active" ? (
                          <div className="rounded-2xl bg-muted/40 p-3">
                            <p className="text-xs text-muted-foreground">Your total gifts</p>
                            <p className="mt-1 font-medium text-foreground tabular-nums">{fmtMoney(fund.totalGifted)}</p>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-muted/40 p-3">
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="mt-1 font-medium text-foreground">{statusLabel(fund.fundStatus)}</p>
                          </div>
                        )}
                      </div>

                      {/* Detail rows 2026-05-25 audit: 'Birthday anchor'
                          was internal jargon ('anchor' = the date used to
                          peg upcoming-event calendars); a gifter doesn't
                          need the term, they need 'when's the next
                          birthday'. Renamed to 'Next birthday'. */}
                      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                        <p>Last gift: {fmtDate(fund.lastGiftAt)}</p>
                        <p>Next birthday: {fund.nextBirthdayLabel || "Not added yet"}</p>
                        <p>{fund.holdingsCount} holdings • {fund.activeEventCount} active events</p>
                      </div>

                      {/* Follow-updates toggle (replaced passive 2026-05-25).
                          Was a flat sentence with a BellRing icon and no
                          action; the dashboard audit found it was a dead-
                          end ("You are not following updates for this
                          fund yet" → no button → user can't do anything
                          about it). Now: a real toggle button that flips
                          the subscriber row server-side. Visually
                          differentiated by state (filled evergreen when
                          following, outline when not). */}
                      <button
                        type="button"
                        onClick={() => handleToggleFollow(fund.fundId, !!fund.updatesEnabled)}
                        disabled={updatingFollowId === fund.fundId}
                        className={`mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          fund.updatesEnabled
                            ? "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.16)]"
                            : "border border-[hsl(var(--kiddo-evergreen)/0.3)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.06)]"
                        }`}
                        data-testid={`button-follow-${fund.fundId}`}
                        aria-label={fund.updatesEnabled ? `Stop following updates for ${fund.childName}` : `Follow updates for ${fund.childName}`}
                      >
                        <BellRing className="h-3.5 w-3.5" />
                        {updatingFollowId === fund.fundId
                          ? "Saving..."
                          : fund.updatesEnabled
                            ? "Following updates"
                            : "Follow updates"}
                      </button>

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
                            {PROJECTION_DISCLAIMER}
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
                        {/* Sponsor-Plus pill — ONLY renders when the
                            fund's coverage state is Free (server-derived
                            `eligibleForSponsorship`). Replaces the
                            previously-removed 'discovery card' that made
                            a false 'scroll up' claim — now the pill IS
                            the discovery, in the right place (per-fund
                            context), with a real deep-link to the
                            sponsor sidebar on GiftCheckout. Soft
                            language ('Cover Plus for $29'), gold tint
                            differentiates from primary Gift-again CTA
                            so it reads as an additional option, not a
                            competing primary action. Per
                            project_gifter_sponsors_plus_subscription.md. */}
                        {/* Suppressed on adult/handed-off accounts (server
                            phase "adult"): a gifter "covering Plus" on a kid's
                            FAMILY fund is the gesture; once the fund has
                            transferred to the now-grown owner, they manage
                            their own subscription, so the sponsor pill is
                            nonsensical there. This was the "why is Plus only
                            over Haley?" confusion — her graduated account was
                            the lone Free-coverage fund, so it was the only one
                            still showing the pill. 2026-05-31. */}
                        {fund.eligibleForSponsorship && fund.childPhase !== "adult" && (
                          <Link href={`${fund.sharePath}${fund.sharePath.includes("?") ? "&" : "?"}sponsor=1&src=gifter_dashboard_pill`}>
                            <Button
                              variant="outline"
                              className="border-[hsl(var(--kiddo-gold)/0.45)] bg-[hsl(var(--kiddo-gold)/0.06)] text-[hsl(var(--kiddo-ink))] hover:bg-[hsl(var(--kiddo-gold)/0.12)]"
                              data-testid={`button-sponsor-plus-${fund.fundId}`}
                            >
                              <Crown className="mr-2 h-4 w-4" />
                              Cover Plus for $29
                            </Button>
                          </Link>
                        )}
                      </div>
                    </motion.div>
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

            {/* Page footer — small actionable items 2026-05-25 audit
                rewrite. Was previously a full 'Give beyond a single
                gift' section with two cards: a Founder-membership
                CTA (real, actionable) AND a Sponsor-Plus 'discovery
                card' whose body literally said 'Open any of your
                saved funds above to find the sponsor option.' That
                second card was making a false claim: the per-fund
                card doesn't surface a sponsor button, and Sponsor-
                Plus is only eligible on Free-tier funds anyway. The
                user-flagged confusion ('I don't think it's perfect')
                kept pointing at this telling-the-user-to-scroll-up
                non-action.

                Now: a single footer strip with the two real,
                directly-actionable links — Start a fund (was inside
                the empty-state hero we just removed) and Gift a
                Founder slot (kept). Sponsor-Plus discovery now lives
                where it CAN actually deep-link (GiftCheckout on
                eligible funds), not on a dashboard that doesn't have
                the tier metadata. */}
            <div className="rounded-2xl border border-border/60 bg-card px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">More ways to show up</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Start a fund for someone you love, or gift a Founder slot.</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
                <Link href={startFundHref}>
                  <Button variant="ghost" size="sm" className="rounded-xl">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Start a fund
                  </Button>
                </Link>
                <Link href="/founding-members">
                  <Button variant="outline" size="sm" className="rounded-xl" data-testid="cta-gift-founder">
                    <Crown className="mr-1.5 h-3.5 w-3.5" />
                    Gift a Founder slot
                  </Button>
                </Link>
              </div>
            </div>

            {/* Page-level tiny utilities — CSV export lives here as a
                small text-link rather than as a hero card up top. Only
                renders when the gifter has actually given (totalGifts
                > 0); a brand-new account with no gifts has nothing to
                export. */}
            {totalGifts > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                <a
                  href="/api/gifter-account/gifts.csv"
                  download
                  onClick={() => haptic("selection")}
                  className="underline-offset-4 hover:underline"
                  data-testid="button-download-gifter-csv"
                  aria-label="Download gift history CSV"
                >
                  Download your gift history (CSV)
                </a>
                {" "}— for your CPA or your records.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
