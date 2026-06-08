import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// BookOpen replaces Sparkles 2026-05-12 for "Latest Memory Book moment" —
// Sparkles banned per feedback_no_ai_slop.md. BookOpen is the locked Memory
// Book semantic icon per feedback_iconography_consistency.md.
import { Heart, Lock, Mail, Gift, ArrowRight, Bookmark, CalendarDays, BookOpen, BellRing, TrendingUp, Repeat, Crown, Plus, Pause, Play, Pencil, Receipt, ChevronDown, Camera, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { buildTrackedGetStartedHref } from "@/lib/acquisition";
import { useCountUp } from "@/hooks/use-count-up";
import { StockLogo } from "@/components/ui/stock-logo";
import { STOCK_PICKS } from "@shared/stock-picks";
import { readLocalCache, writeLocalCache } from "@/lib/local-cache";

// Ticker → company name for the gift rows (founder catch 2026-06-04: a gifter
// wants to SEE what their money bought — the company + its logo — not a bare
// "GOOGL"). Covers the featured picks; falls back to the ticker for ETFs /
// anything not in the list so the label is never empty.
const TICKER_TO_NAME: Record<string, string> = Object.fromEntries(
  STOCK_PICKS.map((p) => [p.ticker.toUpperCase(), p.name]),
);
function companyNameForTicker(ticker?: string | null): string {
  const t = String(ticker || "").trim().toUpperCase();
  if (!t) return "";
  return TICKER_TO_NAME[t] || t;
}
import { projectFundValue } from "@shared/projection";
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
  // The family's last name — ONLY present when the gifter has gifted to 2+ kids
  // who share it (server nulls it for singletons, so a one-off gifter never
  // sees a last name). Drives the "The {familyName} family" grouping header so
  // a cross-family gifter can tell whose kids are whose. 2026-06-04.
  familyName: string | null;
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
  // Raw recipientBirthdate is intentionally NOT sent to gifters (T&S
  // minimization 2026-06-04) — only the precomputed years-to-majority the
  // projection needs.
  yearsUntilMajority: number | null;
  majorityAge: number;
  childPhase: string;
  fundStatus: string;
  // currentFundValue + holdingsCount + valueHistory30d intentionally NOT in
  // the gifter payload (T&S minimization 2026-06-04): a gifter sees no
  // child net-worth, portfolio size, or value trajectory.
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
  // Per-gift detail for the "Your gifts" expandable (2026-06-04):
  // every gift this gifter sent to this fund, newest first. No live
  // "now worth" (T&S minimization 2026-06-04) — it can be falsified by a
  // parent's sale and leaks fund performance. The parent's thank-you note
  // rides along when one was sent.
  yourGifts?: Array<{
    id: string;
    amount: number;
    createdAt: string | null;
    ticker: string | null;
    message: string | null;
    // No single ticker → the money went into the diversified managed mix
    // (index-fund basket), not cash. Drives the row's "Managed mix" label.
    managedMix?: boolean;
    // A recurring auto-invest cycle (parent auto-invest or a gifter schedule);
    // drives the "↻ Monthly" marker so a long run of identical rows reads as
    // one habit, not N anonymous gifts.
    recurring?: boolean;
    thankYou: { message: string; sentAt: string | null } | null;
  }>;
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
    followingUpdatesCount: number;
  };
  funds: GifterFundRow[];
  sponsoredSubs?: SponsoredSubRow[];
  founderGifts?: FounderGiftRow[];
};

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

// Whole-dollar money, for summary lines where cents are noise (e.g. a family
// rollup "$3,550 given" reads cleaner than "$3,550.00").
function fmtMoney0(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

// Parse a gifter-safe "Month Day" birthday label (the only birthday signal the
// server sends — no year, by T&S design) into the ms of its NEXT occurrence, so
// the family header can surface "who's birthday is next". Returns null if the
// label is missing or unparseable.
function nextBirthdayMs(label: string | null): number | null {
  if (!label) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const yr of [now.getFullYear(), now.getFullYear() + 1]) {
    const t = new Date(`${label}, ${yr}`).getTime();
    if (!Number.isNaN(t) && t >= startOfToday) return t;
  }
  return null;
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
      // "Personal account", never "adult account", in user-facing copy —
      // terminology locked 2026-06-04 (matches the fund badge "PERSONAL ·
      // Active"; "adult" age-frames an ownership moment + wrong echo for a
      // family brand). The server phase string stays "adult" internally.
      return "Personal account";
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
  // yearsUntilMajority is now precomputed server-side so the gifter payload
  // no longer carries the child's raw birthdate / birth year (T&S
  // minimization 2026-06-04).
  if (fund.yearsUntilMajority == null) return null;
  if (fund.totalGifted <= 0) return null;
  const yearsAhead = fund.yearsUntilMajority;
  if (yearsAhead < 0.5) return null;
  const projected = projectFundValue({
    startingValue: fund.totalGifted,
    monthlyContribution: 0,
    yearsAhead,
    contributionYears: 0,
  });
  return { projected, yearsAhead, majorityAge: fund.majorityAge };
}

// Max accepted profile photo upload — matches Profile.tsx + the server's
// data-url validation on PATCH /api/user/profile.
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// The gifter's own profile photo, editable in place on the hero — the gifter
// dashboard doubles as the gifter's profile (founder, 2026-06-05), mirroring
// how the child's photo anchors the fund page top-left. The photo set here is
// the SAME users.profileImageUrl the family's surfaces render: the Dashboard
// gifter roster, the Memory Book byline, and the printed fund snapshot all
// enrich gift rows from it. So the motivating frame in the copy is presence
// ("families see this beside your gifts"), not vanity. Add = tap to pick;
// edit/remove = tap opens a small menu. Removal PATCHes profileImageUrl: ""
// (the server's explicit-clear contract).
function GifterHeroAvatar({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const photoUrl: string | null = user?.profileImageUrl || null;
  const initial = String(user?.preferredName || user?.firstName || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  const patchPhoto = async (profileImageUrl: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileImageUrl }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        queryClient.setQueryData(["/api/auth/user"], payload);
        haptic("success");
        toast(
          profileImageUrl === ""
            ? { title: "Photo removed" }
            : { title: "Photo updated", description: "Families will see this beside your gifts." },
        );
      } else {
        toast({
          title: "Couldn't update photo",
          description: payload?.error || "Please try a smaller image.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn't update photo",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "That's not an image", description: "Please choose a photo file.", variant: "destructive" });
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      toast({ title: "Photo too large", description: "Please choose an image under 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patchPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          haptic("light");
          if (photoUrl) setMenuOpen((v) => !v);
          else fileInputRef.current?.click();
        }}
        className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-white/25 sm:h-16 sm:w-16"
        aria-label={photoUrl ? "Change or remove your profile photo" : "Add a profile photo"}
        data-testid="button-gifter-avatar"
      >
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-heading text-xl font-semibold text-white sm:text-2xl">{initial}</span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
          </span>
        )}
      </button>
      {/* Camera badge — the quiet "this is editable" affordance. */}
      <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--kiddo-gold))] text-[hsl(153,48%,11%)] ring-2 ring-[hsl(153,48%,11%)]/40">
        <Camera className="h-3 w-3" />
      </span>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border border-black/5 bg-white p-2 text-foreground shadow-xl">
            <p className="px-3 pb-1.5 pt-1 text-[11px] leading-snug text-muted-foreground">
              Families see this photo beside your gifts.
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-black/5"
              onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
              data-testid="button-gifter-avatar-change"
            >
              <Camera className="h-4 w-4 text-muted-foreground" /> Change photo
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              onClick={() => patchPhoto("")}
              data-testid="button-gifter-avatar-remove"
            >
              <Trash2 className="h-4 w-4" /> Remove photo
            </button>
          </div>
        </>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
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

  // Group the gifter's funds by FAMILY (server-provided `familyName`, present
  // only when this gifter has gifted to 2+ kids who share a last name). This
  // is for the cross-family super-gifter — the loop's actual engine — who
  // otherwise faces a flat wall of first-name cards where "just Luke" tells
  // them nothing. Funds in a family cluster under a "The Dunphy family" header;
  // singletons render headerless (and never expose a last name). Group order
  // follows the server's recency sort — the first fund seen claims the slot, so
  // a family stays anchored to its most recent gift.
  type FundGroup = {
    key: string;
    familyName: string | null;
    funds: GifterFundRow[];
    total: number; // total this gifter has given across the family
    count: number;
    nextBirthday: { childName: string; label: string; ms: number } | null; // soonest upcoming birthday in the family
  };
  const fundGroups = useMemo<FundGroup[]>(() => {
    const rows = data?.funds ?? [];
    const groups: FundGroup[] = [];
    const indexByKey = new Map<string, number>();
    for (const f of rows) {
      const fam = f.familyName ? f.familyName.trim() : "";
      const key = fam ? `fam:${fam.toLowerCase()}` : `solo:${f.fundId}`;
      const existing = indexByKey.get(key);
      if (existing != null) {
        groups[existing].funds.push(f);
      } else {
        indexByKey.set(key, groups.length);
        groups.push({ key, familyName: fam || null, funds: [f], total: 0, count: 0, nextBirthday: null });
      }
    }
    // Per-family rollups — the summary the super-gifter scans: how much they've
    // put into this family, how many kids, and who's birthday is next (the
    // actionable "show up for them next" cue).
    for (const g of groups) {
      g.total = g.funds.reduce((sum, f) => sum + (f.totalGifted || 0), 0);
      g.count = g.funds.length;
      let soonest: { childName: string; label: string; ms: number } | null = null;
      for (const f of g.funds) {
        const ms = nextBirthdayMs(f.nextBirthdayLabel);
        if (ms != null && (soonest == null || ms < soonest.ms)) {
          soonest = { childName: f.childName, label: f.nextBirthdayLabel || "", ms };
        }
      }
      g.nextBirthday = soonest;
    }
    return groups;
  }, [data?.funds]);

  // Sort control for the cross-family super-gifter (only surfaces at scale — see
  // the >= 4 gate in the render — so Jay's 3-kid view stays clean). Reorders the
  // FAMILY groups; "recent" keeps the server's recency order.
  const [groupSort, setGroupSort] = useState<"recent" | "given" | "birthday">("recent");
  const sortedGroups = useMemo<FundGroup[]>(() => {
    const gs = [...fundGroups];
    if (groupSort === "given") gs.sort((a, b) => b.total - a.total);
    else if (groupSort === "birthday") gs.sort((a, b) => (a.nextBirthday?.ms ?? Infinity) - (b.nextBirthday?.ms ?? Infinity));
    return gs;
  }, [fundGroups, groupSort]);

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
  // "Your gifts" expandable per fund card + tap-to-read thank-you notes
  // (2026-06-04). One open fund at a time keeps the two-column grid stable.
  const [openGiftsFundId, setOpenGiftsFundId] = useState<string | null>(null);
  const [openThankGiftId, setOpenThankGiftId] = useState<string | null>(null);
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
      toast({ title: "Recurring updated", description: `Now ${fmtMoney(amountNum)} ${editFrequency} to ${sch.fundName}, starting next cycle.` });
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
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm"
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
                {/* Avatar + greeting row — the gifter's own face anchors the
                    hero the same way the child's photo anchors the fund page.
                    The avatar is the add/edit/remove entry point (see
                    GifterHeroAvatar above). */}
                <div className="flex items-start gap-4">
                  {isAuthenticated && <GifterHeroAvatar user={user} />}
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Your gifts</p>
                    <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
                      Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
                    </h1>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
                      {savedFundCount > 0
                        ? `You've shown up for ${savedFundCount} ${savedFundCount === 1 ? "child" : "children"}, and what you gave keeps growing for them.`
                        : "The funds you've gifted to, in one place."}
                    </p>
                  </div>
                </div>

                {/* First-paint honesty: with no localStorage cache (new
                    device / fresh context) the query is in flight and these
                    lifetime stats would briefly render "$0.00 / 0 / 0" — a
                    returning gifter reads that as "my gifts are gone."
                    While loading with no data, hold quiet pulse blocks
                    instead; the count-ups take over the moment data lands.
                    (Caught in the 2026-06-05 avatar verification run.) */}
                {isLoading && !data ? (
                  <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4" aria-hidden="true">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Total gifted</p>
                      <span className="mt-1.5 block h-9 w-28 animate-pulse rounded-lg bg-white/15 sm:h-10" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Children</p>
                      <span className="mt-1.5 block h-7 w-8 animate-pulse rounded-lg bg-white/15" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Following</p>
                      <span className="mt-1.5 block h-7 w-8 animate-pulse rounded-lg bg-white/15" />
                    </div>
                  </div>
                ) : (
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
                )}

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
                  <Repeat size={18} strokeWidth={2} />
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
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                            data-testid={`hero-pause-recurring-${sch.id}`}
                          >
                            <Pause className="h-3.5 w-3.5" />
                            {busy ? "…" : "Pause"}
                          </button>
                          <button
                            type="button"
                            onClick={() => (isEditing ? setEditingId(null) : openEditor(sch))}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium transition-colors ${isEditing ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                            data-testid={`hero-edit-recurring-${sch.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHistory(sch)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium transition-colors ${isHistoryOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
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
                            className="ml-auto inline-flex items-center rounded-lg px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
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
                                    className="h-10 w-full bg-transparent px-1 text-base sm:text-sm tabular-nums outline-none"
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
                              New amount and cadence take effect next cycle. You won't be charged anything extra today.
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
                                This is a gift reminder, not an automatic charge. Nothing is billed to your card. You'll get an email each cycle so you can choose to give.
                              </p>
                            ) : history.count === 0 ? (
                              <p className="text-xs text-muted-foreground">No charges yet. Your first one will appear here.</p>
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
                          className="inline-flex items-center rounded-lg px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
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
                    <Crown size={18} strokeWidth={2} />
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
                    <Crown size={18} strokeWidth={2} />
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
                    Each card shows the fund's value, every gift you've sent and what it's worth now, and thank-yous from the family.
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
                <div className="mt-5 space-y-8">
                  {/* Sort control — surfaces ONLY at scale (4+ families/cards),
                      so the common 1-3 fund view stays clean. For the prolific
                      cross-family gifter, reorders families by recency, total
                      given, or whose birthday is next. */}
                  {fundGroups.length >= 4 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="gifter-sort">
                      <span className="mr-0.5 text-muted-foreground">Sort</span>
                      {([["recent", "Recent"], ["given", "Most given"], ["birthday", "Soonest birthday"]] as const).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setGroupSort(k)}
                          className={`rounded-full px-2.5 py-1 font-medium transition-colors ${groupSort === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {sortedGroups.map((group) => (
                    <div key={group.key}>
                      {/* Family header — only for a real family cluster (2+ kids
                          sharing a last name). Gives the cross-family gifter the
                          context a flat first-name list can't: whose kids, how
                          much they've put in, and whose birthday is next. */}
                      {group.familyName && (
                        <div className="mb-3">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <h3 className="font-heading text-lg font-semibold text-foreground">The {group.familyName} family</h3>
                            <span className="text-xs text-muted-foreground">
                              {group.count} {group.count === 1 ? "kid" : "kids"}
                              {/* The per-family total is a meaningful BREAKDOWN only
                                  when there are 2+ families; with one family it just
                                  duplicates the hero's "Total gifted". So show it
                                  only across families, rounded (cents are noise). */}
                              {fundGroups.length >= 2 ? ` · ${fmtMoney0(group.total)} given` : ""}
                            </span>
                          </div>
                          {group.nextBirthday && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Next up: {group.nextBirthday.childName}'s birthday · {group.nextBirthday.label}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="grid gap-4 md:grid-cols-2">
                  {group.funds.map((fund, fundIdx) => {
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
                      {/* CHILD-MONEY MINIMIZATION (founder call 2026-06-04):
                          the gifter no longer sees the fund's TOTAL VALUE or its
                          30-day value sparkline — that's the child's accumulated
                          net worth + the parent's investment performance, none
                          of a gifter's business. The gifter's card shows only
                          gifter-owned context: what THEY gave. (The "watch it
                          grow" story is the forward, hypothetical projection
                          below — safe because it's "if invested" and can't be
                          falsified by a parent's later sale, unlike a live
                          current-value figure.) */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">Your total gifts</p>
                          <p className="mt-1 font-medium text-foreground tabular-nums">{fmtMoney(fund.totalGifted)}</p>
                        </div>
                        <div className="rounded-2xl bg-muted/40 p-3">
                          {String(fund.fundStatus || "").toLowerCase() === "active" ? (
                            <>
                              <p className="text-xs text-muted-foreground">Gifts you've sent</p>
                              <p className="mt-1 font-medium text-foreground tabular-nums">{fund.giftCount ?? (fund.yourGifts?.length ?? 0)}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-muted-foreground">Status</p>
                              <p className="mt-1 font-medium text-foreground">{statusLabel(fund.fundStatus)}</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Detail rows 2026-05-25 audit: 'Birthday anchor'
                          was internal jargon ('anchor' = the date used to
                          peg upcoming-event calendars); a gifter doesn't
                          need the term, they need 'when's the next
                          birthday'. Renamed to 'Next birthday'. */}
                      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                        <p>Last gift: {fmtDate(fund.lastGiftAt)}</p>
                        <p>Next birthday: {fund.nextBirthdayLabel || "Not added yet"}</p>
                        {/* holdings COUNT dropped (2026-06-04): portfolio size
                            is fund-state with zero gifter utility. Active
                            events stay — they're occasions to gift to. */}
                        {fund.activeEventCount > 0 && (
                          <p>{fund.activeEventCount} {fund.activeEventCount === 1 ? "occasion" : "occasions"} to gift to</p>
                        )}
                      </div>

                      {/* "What your gifts bought" — a logo strip visible WITHOUT
                          expanding the list (founder catch 2026-06-04: "what did
                          he invest in for each"). Distinct tickers across this
                          gifter's gifts to this fund, newest first. Answers the
                          gifter's first question at a glance; the expandable
                          below carries the per-gift detail. */}
                      {(() => {
                        const tickers = Array.from(new Set(
                          (fund.yourGifts || [])
                            .map((g) => String(g.ticker || "").trim().toUpperCase())
                            .filter(Boolean),
                        )).slice(0, 6);
                        // Most contributions (recurring auto-invest) go into the
                        // diversified managed mix, which has no single ticker — so
                        // without this the strip implied the money bought ONLY the
                        // few single stocks. Surface "Managed mix" when any did.
                        const hasManagedMix = (fund.yourGifts || []).some((g) => g.managedMix || !g.ticker);
                        if (tickers.length === 0 && !hasManagedMix) return null;
                        return (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid={`gift-tickers-${fund.fundId}`}>
                            <span className="text-xs text-muted-foreground">Your gifts bought</span>
                            {hasManagedMix && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5">
                                <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-[11px] font-medium text-foreground/80">Managed mix</span>
                              </span>
                            )}
                            {tickers.map((t) => (
                              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5">
                                <StockLogo ticker={t} size={14} fallbackText={false} className="shrink-0" />
                                <span className="text-[11px] font-medium text-foreground/80">{companyNameForTicker(t)}</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}

                      {/* "Your gifts" expandable (2026-06-04) — the per-gift
                          receipt the card's "7 gifts sent" number was hiding:
                          each gift's date, ticker, amount, and what it's worth
                          NOW, plus the parent's thank-you note when one was
                          sent (tap the heart line to read it). This is the
                          loop's emotional engine — "your $200 in 2019 is $560
                          today" — shown to the person who spreads it. */}
                      {(fund.yourGifts?.length ?? 0) > 0 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              haptic("light");
                              setOpenThankGiftId(null);
                              setOpenGiftsFundId(openGiftsFundId === fund.fundId ? null : fund.fundId);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/40"
                            data-testid={`button-your-gifts-${fund.fundId}`}
                            aria-expanded={openGiftsFundId === fund.fundId}
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${openGiftsFundId === fund.fundId ? "rotate-180" : ""}`}
                            />
                            {openGiftsFundId === fund.fundId
                              ? "Hide your gifts"
                              : `See your ${fund.yourGifts!.length === 1 ? "gift" : `${fund.yourGifts!.length} gifts`}`}
                          </button>
                          {openGiftsFundId === fund.fundId && (
                            <ul className="mt-2 max-h-72 divide-y divide-border/50 overflow-y-auto rounded-2xl border border-border/60 bg-card px-3" data-testid={`your-gifts-list-${fund.fundId}`}>
                              {fund.yourGifts!.map((g) => {
                                const companyName = companyNameForTicker(g.ticker);
                                return (
                                  <li key={g.id} className="py-2.5">
                                    <div className="flex items-center justify-between gap-2 text-sm">
                                      <span className="flex min-w-0 items-center gap-2">
                                        {/* Logo + company name answer "what did my
                                            gift buy" at a glance; the date drops to
                                            a sub-line so the row leads with the
                                            company, not the calendar. ETFs/unknown
                                            tickers fall back to the symbol. */}
                                        {g.ticker ? <StockLogo ticker={g.ticker} size={22} className="shrink-0" /> : null}
                                        <span className="flex min-w-0 flex-col">
                                          {/* Lead with WHAT the money bought, not a bare
                                              "Gift". A single-stock pick shows the company;
                                              everything else went into the diversified
                                              managed mix (a basket of index funds) — never
                                              cash — so say so. A recurring auto-invest cycle
                                              gets a "↻ Monthly" tag so a long run of
                                              identical rows reads as one habit. */}
                                          <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                                            {companyName || "Managed mix"}
                                            {g.recurring && (
                                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                                <Repeat className="h-2.5 w-2.5" />
                                                Monthly
                                              </span>
                                            )}
                                          </span>
                                          <span className="text-xs text-muted-foreground">{fmtDate(g.createdAt)}</span>
                                        </span>
                                      </span>
                                      {/* The gift AMOUNT only — no live "now worth"
                                          (founder call 2026-06-04). A current value
                                          can become a LIE the moment the parent
                                          sells those shares (the gift row keeps the
                                          recorded shares; the holding is gone), it
                                          implies a donor claim on a gift that's the
                                          child's now, and it leaks fund performance.
                                          The honest growth story is the forward
                                          "if invested" projection below. */}
                                      <span className="shrink-0 tabular-nums text-foreground">
                                        {fmtMoney(g.amount)}
                                      </span>
                                    </div>
                                    {g.message && (
                                      <p className="mt-1 truncate text-xs italic text-muted-foreground">"{g.message}"</p>
                                    )}
                                    {g.thankYou && (
                                      <div className="mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            haptic("light");
                                            setOpenThankGiftId(openThankGiftId === g.id ? null : g.id);
                                          }}
                                          className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--kiddo-evergreen))] hover:underline"
                                          data-testid={`button-thank-you-${g.id}`}
                                        >
                                          <Heart className="h-3 w-3" />
                                          {openThankGiftId === g.id ? "Hide their thank-you" : "They sent a thank-you"}
                                        </button>
                                        {openThankGiftId === g.id && (
                                          <div className="mt-1.5">
                                            <blockquote className="whitespace-pre-line rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.06)] px-3 py-2 text-xs leading-relaxed text-foreground">
                                              {g.thankYou.message}
                                              {g.thankYou.sentAt && (
                                                <span className="mt-1 block text-[10px] text-muted-foreground">{fmtDate(g.thankYou.sentAt)}</span>
                                              )}
                                            </blockquote>
                                            {/* The loop closing twice: a just-read thank-you is the
                                                warmest moment to invite the next gift. Occasion-aware
                                                when the next birthday is known; src-tagged so the
                                                k-factor panel can attribute regifts to this nudge. */}
                                            <Link href={`${fund.sharePath}${fund.sharePath.includes("?") ? "&" : "?"}src=thank_you_regift`}>
                                              <button
                                                type="button"
                                                onClick={() => haptic("light")}
                                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline"
                                                data-testid={`button-regift-${g.id}`}
                                              >
                                                {fund.nextBirthdayLabel
                                                  ? `Send another for ${fund.childName}'s birthday (${fund.nextBirthdayLabel})`
                                                  : `Send ${fund.childName} another gift`}
                                                <ArrowRight className="h-3 w-3" />
                                              </button>
                                            </Link>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

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
                            {/* Server computes this off the GIFTER's own lifetime total
                                ([100,500,1000,2500] vs stats.totalGifted) — the old
                                "Next family milestone" label claimed it was fund-wide,
                                which read absurd on an $80k fund ("next: $2,500"). */}
                            <p className="font-medium text-foreground">Your next giving milestone</p>
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
                    </div>
                  ))}
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
                {" "}for your CPA or your records.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
