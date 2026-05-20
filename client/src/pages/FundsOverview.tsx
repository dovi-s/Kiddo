// Funds Overview — the Family-plan administrative aggregation surface.
//
// What this page is FOR: a parent with 2+ kids' funds glancing at the
// household's combined picture. Total invested, who gave this month, what
// occasions are coming up, how many people have shown up across all the
// kids. Useful for tax/budget planning + cross-fund event awareness.
//
// What this page is NOT: a "Family Portrait" / "Dynasty" surface. It's
// Apple-Settings register, not Mubi-emotional. See
// project_funds_overview_rules.md for the locked banned-list:
//   - No aggregate return %. Combining returns across different time
//     horizons is mathematical fiction + FINRA-adjacent.
//   - No weighted-age projections.
//   - No Memory Book aggregation — kid-at-18 lens requires per-kid
//     Memory Books to stay separate.
//   - No "family portrait" / "dynasty" framing copy.
//   - No leaderboards / social-proof love-marks.
//
// Surface registers as administrative glance. Per-fund navigation routes
// to the kid's individual Dashboard, where the real emotional anchor
// (count-up balance, gift strip, Memory Book) lives. This page is the
// big-picture; the kid pages are the management + emotional layers.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, ChevronRight, Gift, Heart, Plus } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { GiftersAcrossFundsSheet } from "@/components/GiftersAcrossFundsSheet";
import { useAuth } from "@/hooks/use-auth";
import { ADD_FUND_EVENT, setActiveFundId } from "@/hooks/use-active-fund";
import { capFirst } from "@/lib/format-name";
import { useCountUp } from "@/hooks/use-count-up";
import { haptic } from "@/lib/haptics";
import { usePageSeo } from "@/lib/seo";

type OverviewFund = {
  id: string;
  name: string;
  slug?: string;
  recipientFirstName: string | null;
  recipientBirthdate: string | null;
  // When set, the per-fund card avatar renders the photo instead of
  // the monogram. Same field name + nullability the rest of the app
  // already uses (Dashboard, sidebar fund switcher, header switcher).
  childPhotoUrl?: string | null;
  balance: string;
  pendingBalance: string;
  cashBalance?: string | null;
  accessRole: "owner" | "co-admin" | "viewer" | "previous_owner";
  // Set only on transferred funds (accessRole='previous_owner').
  // Drives the "Transferred · {date}" pill rendering. ISO date string.
  transferredAt?: string | null;
  // 30-day balance delta in USD. Null for funds without enough
  // history (newly-created accounts). Drives the subtle "+$12 this
  // month" line under each per-fund row.
  delta30dUsd?: number | null;
};

type OverviewRecurringItem = {
  id: string;
  fundId: string;
  recipientFirstName: string | null;
  fundName: string | null;
  childPhotoUrl: string | null;
  amount: string;
  frequency: string;
  nextRunDate: string | null;
  // Differentiating fields — without them two recurrings on the same
  // fund render as identical rows. executionModel = "auto" | "pick"
  // | "family"; selectedTicker is populated only when the parent
  // chose a specific stock for this schedule (pick model). bankName +
  // accountLast4 are the final tiebreaker (also independently useful
  // for budget review).
  selectedTicker: string | null;
  executionModel: string;
  bankName: string | null;
  accountLast4: string | null;
  // True when 2+ active schedules share the same fund + model +
  // ticker + frequency + bank + amount. Both rows in the duplicate
  // group are flagged so the parent sees the collision from either
  // side. Real-money safety: a forgotten-then-redone recurring
  // schedule would silently double the monthly outflow.
  isDuplicate: boolean;
  monthlyEquivalent: string;
};

type OverviewResponse = {
  enabled: boolean;
  fundCount: number;
  aggregateBalance?: string;
  funds?: OverviewFund[];
  thisMonth?: {
    giftCount: number;
    giftTotal: string;
    contribCount: number;
    contribTotal: string;
  };
  upcomingOccasions?: Array<{
    id: string;
    fundId: string;
    name: string;
    eventDate: string;
    eventType: string | null;
    recipientFirstName: string | null;
  }>;
  // Forward-looking commitment data — locked as the ONE forward
  // -looking section on /funds. See project_funds_overview_rules.md
  // for the banned framings (no annual projection, no inline pause).
  recurring?: {
    monthlyTotal: string;
    activeCount: number;
    items: OverviewRecurringItem[];
  };
  uniqueGifterCount?: number;
  // Up to 30 daily points of the household's aggregate balance.
  // Drives the household sparkline at the hero. Shape only — the
  // sparkline shows direction not percentage, respecting the locked
  // 'no aggregate return %' rule.
  aggregateHistory?: Array<{ date: string; total: number }>;
};

// Tiny SVG sparkline. No library — handrolled so it stays inline
// with the rest of the page's no-chart-dependencies posture. Renders
// shape only; no axes, no labels, no percentage. Accepts a list of
// {date, total} points; returns null when there's not enough data
// for a meaningful curve (< 2 points).
function HouseholdSparkline({ history }: { history: Array<{ date: string; total: number }> }) {
  if (!history || history.length < 2) return null;
  const width = 280;
  const height = 36;
  const padding = 1; // 1px breathing room so endpoints don't clip on stroke
  const totals = history.map((h) => h.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  // Flat-line case: render a centered horizontal line rather than
  // dividing by zero on max-min.
  const range = max - min;
  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - padding * 2);
    const y = range === 0
      ? height / 2
      : padding + (1 - (h.total - min) / range) * (height - padding * 2);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-3 opacity-90"
      aria-hidden
    >
      <defs>
        <linearGradient id="household-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#household-sparkline-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function fmtCurrency(value: string | number | null | undefined, opts?: { whole?: boolean }) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.whole ? 0 : 2,
    maximumFractionDigits: opts?.whole ? 0 : 2,
  }).format(n);
}

function ageLabel(birthdate: string | null): string {
  if (!birthdate) return "";
  const bd = new Date(birthdate);
  if (Number.isNaN(bd.getTime())) return "";
  const now = new Date();
  const months = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  if (months < 1) return "newborn";
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  return `${years}yr`;
}

function fmtEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const daysAway = Math.round((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const base = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (daysAway <= 0) return `today · ${base}`;
  if (daysAway === 1) return `tomorrow · ${base}`;
  if (daysAway < 14) return `in ${daysAway} days · ${base}`;
  return base;
}

// Compact "Next run" label for recurring rows. Same shape as
// fmtEventDate but tighter (no leading "in 3 days · " — that's
// useful for occasions but cluttery in a sub-row). "Today" /
// "Tomorrow" / month-day everywhere else.
function fmtRecurringNextRun(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const daysAway = Math.round((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysAway <= 0) return "today";
  if (daysAway === 1) return "tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Secondary-line text for a recurring row. Composes up to three
// signals separated by middle-dots:
//   - destination: ticker (pick model) or "Family mix" (family); auto
//     model has no destination label (it's the default)
//   - schedule:    "Next {date}"
//   - source:      "{Bank} {last4}" when a bank is linked
//
// All three contribute to row differentiation: two recurrings on
// the same fund can tie on destination + schedule but the bank
// source breaks every remaining collision (Chase 1234 vs BofA 5678).
// Falls back to "Recurring investment" if we have no signals at all
// (newly-created schedule that hasn't computed next-run yet AND has
// no bank yet — an edge case during setup).
//
// Naming locked: NEVER "auto-invest" in UI copy (see
// project_recurring_contributions memory). For the auto execution
// model we just show the next date — no strategy label needed; the
// default is the implied destination.
function buildRecurringRowSubtitle(item: OverviewRecurringItem): string {
  const parts: string[] = [];

  // 1. Destination. ALWAYS show it — without a destination label the
  // diversified-mix row reads as a generic "Next May 29" with nothing
  // to compare against a ticker-pick row's "DUOL · Next May 29". The
  // canonical Dashboard copy ("Investing across the diversified mix")
  // shortened to "Diversified mix" here to keep the row scannable.
  if (item.executionModel === "pick" && item.selectedTicker) {
    parts.push(item.selectedTicker);
  } else if (item.executionModel === "family") {
    parts.push("Family mix");
  } else {
    parts.push("Diversified mix");
  }

  // 2. Schedule.
  // dateLabel from fmtRecurringNextRun is either "today", "tomorrow",
  // or a concrete date string ("May 21"). Prefixing with "Next" reads
  // fine for the date variant ("Next May 21") but produces awkward
  // "Next tomorrow" / "Next today" for the relative variants. Branch
  // on the value so warm relative-day labels stand alone (capitalized)
  // and concrete dates keep the "Next" prefix that frames them as the
  // upcoming run. Locked 2026-05-19 per user catch.
  const dateLabel = fmtRecurringNextRun(item.nextRunDate);
  if (dateLabel) {
    const isRelative = dateLabel === "today" || dateLabel === "tomorrow";
    parts.push(isRelative ? dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1) : `Next ${dateLabel}`);
  }

  // 3. Source. "Chase 1234" — bank name + last4, no dot/mask glyphs
  // (cleaner at small font sizes and avoids unicode-rendering
  // inconsistencies across browsers). Bank info appears even when
  // other fields would already differentiate — it's independently
  // useful as "which account is this drawing from?" context.
  if (item.bankName && item.accountLast4) {
    parts.push(`${item.bankName} ${item.accountLast4}`);
  } else if (item.accountLast4) {
    parts.push(`Bank ${item.accountLast4}`);
  }

  if (parts.length === 0) return "Recurring investment";
  return parts.join(" · ");
}

export default function FundsOverview() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  // Slide-up sheet for the cross-fund gifter view. Opens from the
  // "Across all funds" card below. The household-glance answer to
  // "Grandma gave to whom and what did she give them?" Closed by
  // default; the page itself stays calm + administrative.
  const [giftersSheetOpen, setGiftersSheetOpen] = useState(false);

  usePageSeo({
    title: "Your funds | Kiddo",
    description: "A calm overview of every fund in your household.",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login?redirect=/funds");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const { data, isLoading, error, refetch } = useQuery<OverviewResponse>({
    queryKey: ["/api/funds-overview"],
    queryFn: async () => {
      const res = await fetch("/api/funds-overview", { credentials: "include" });
      if (!res.ok) {
        // Carry status into the error so the page can distinguish "no
        // funds" from "endpoint blew up" — previously a 500 silently
        // rendered the "0 funds" empty state which masked real bugs.
        const text = await res.text().catch(() => "");
        const msg = `funds-overview ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`;
        throw new Error(msg);
      }
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    retry: 1,
  });

  // Count-up on the aggregate balance. Same vocabulary as Dashboard /
  // KidView — 900ms ease-out-expo, anchored from a low start so the
  // first paint feels like growth rather than a flicker. Hook lives
  // ABOVE the early returns (rules-of-hooks lesson learned earlier).
  // `isAnimating` drives aria-live="off" during the count-up so screen
  // readers don't fire ~60 announcements/sec on the cascading numbers;
  // pattern locked per project_count_up_animation_consistency.md.
  const aggregateLive = parseFloat(String(data?.aggregateBalance || "0"));
  const { value: animatedAggregate, isAnimating: aggregateAnimating } = useCountUp({
    from: aggregateLive * 0.95,
    to: aggregateLive,
    duration: 900,
    enabled: aggregateLive > 0,
  });

  const enabled = data?.enabled === true;
  const funds = useMemo(() => data?.funds ?? [], [data]);
  const thisMonth = data?.thisMonth;
  const occasions = data?.upcomingOccasions ?? [];
  const recurring = data?.recurring;
  const recurringItems = recurring?.items ?? [];
  const uniqueGifterCount = data?.uniqueGifterCount ?? 0;
  const aggregateHistory = data?.aggregateHistory ?? [];

  // Fires the global add-fund event after navigating to /dashboard
  // (where AddFundSheet is mounted). Same pattern as the sidebar /
  // AppHeader add-fund affordances. Locked 2026-05-18 to close the
  // 'parent can't add another kid from /funds' gap.
  const handleAddFund = () => {
    haptic("selection");
    setLocation("/dashboard");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(ADD_FUND_EVENT)), 0);
  };

  // Count-up on the recurring monthly total — matches the vocabulary
  // used for aggregateBalance above. Currency settles in from 95%,
  // 900ms ease-out-expo. Section is hidden entirely when there's
  // nothing active, so we don't need to gate the animation here.
  const recurringMonthlyLive = parseFloat(String(recurring?.monthlyTotal || "0"));
  const { value: animatedRecurringMonthly, isAnimating: recurringAnimating } = useCountUp({
    from: recurringMonthlyLive * 0.95,
    to: recurringMonthlyLive,
    duration: 900,
    enabled: recurringMonthlyLive > 0,
  });

  const handleOpenFund = (fundId: string) => {
    haptic("selection");
    setActiveFundId(fundId);
    setLocation("/dashboard");
  };

  // Recurring rows route to the SCHEDULE's detail modal, not just the
  // fund. Dashboard.tsx already accepts ?detail=schedule:<id> on mount
  // and opens DetailHistoryModal scoped to that contribution — see
  // Dashboard's detailScope effect. Without this, clicking "Emma · DUOL
  // · Next Jun 6" landed on Emma's Dashboard hero with no way to see
  // the schedule's history, which is the question the click actually
  // asks. Per the memory's "every notification destination must match
  // the verb in its description" rule, extended here to cards.
  const handleOpenSchedule = (fundId: string, contributionId: string) => {
    haptic("selection");
    setActiveFundId(fundId);
    setLocation(`/dashboard?detail=schedule:${encodeURIComponent(contributionId)}`);
  };

  // Explicit error branch. Without this, a 500 from the API silently
  // fell through to the "0 funds" not-enabled state because `data` was
  // undefined and `data?.fundCount ?? 0` resolved to 0. Now an error
  // says so and offers a retry — the diagnostic stays visible.
  if (error && !data) {
    return (
      <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-funds-overview">
        <AppHeader />
        <main className="kiddo-canvas px-4 py-6">
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="font-heading text-lg font-semibold text-foreground">
              Could not load your funds overview.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {(error as any)?.message || "Something went wrong on the server."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setLocation("/dashboard")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
              >
                Open Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return (
      <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-funds-overview">
        <AppHeader />
        <main className="kiddo-canvas px-4 py-6">
          <div className="rounded-3xl bg-card border border-border p-6">
            <div className="h-3 w-20 rounded bg-muted/50 mb-4" />
            <div className="h-10 w-48 rounded bg-muted/50 mb-6" />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted/40" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-muted/50" />
                      <div className="h-2.5 w-16 rounded bg-muted/30" />
                    </div>
                  </div>
                  <div className="h-3 w-20 rounded bg-muted/40" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Edge case: user landed on this page but doesn't have 2+ funds.
  // Bounce to the Dashboard rather than render an empty state — the
  // single-fund Dashboard IS the overview.
  if (!enabled) {
    return (
      <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-funds-overview">
        <AppHeader />
        <main className="kiddo-canvas px-4 py-6">
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="font-heading text-lg font-semibold text-foreground">
              The overview unlocks at 2 or more funds.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              You have {data?.fundCount ?? 0} fund{(data?.fundCount ?? 0) === 1 ? "" : "s"}.
              Open the Dashboard for the full view.
            </p>
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Open Dashboard
              <ArrowRight size={14} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-funds-overview">
      <AppHeader />
      <main className="kiddo-canvas px-4 py-6 space-y-4">
        {/* Header card. Cream + evergreen palette per the 60-30-10 rule.
            The aggregate balance is the only "number that counts up"
            on this page — every other figure stays static. Calm, not
            celebratory: the surface is administrative glance, not the
            emotional anchor that the per-kid Dashboard hero is. */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-[hsl(var(--kiddo-evergreen))] text-white p-6 shadow-lg"
        >
          <p className="text-sm font-medium opacity-70 mb-1">Your funds</p>
          <h1
            className="font-heading text-4xl font-bold leading-none mb-2"
            style={{ fontVariantNumeric: "tabular-nums" }}
            aria-live={aggregateAnimating ? "off" : "polite"}
            aria-label={fmtCurrency(aggregateLive)}
          >
            {fmtCurrency(animatedAggregate)}
          </h1>
          <p className="text-sm opacity-70">
            across {funds.length} fund{funds.length === 1 ? "" : "s"}
          </p>
          {/* Household sparkline. Shape only — direction, not
              percentage. Respects the locked 'no aggregate return %'
              rule (combining returns across different time horizons
              would be mathematical fiction). 30 daily points; renders
              nothing when there are fewer than 2 snapshots in the
              window (brand-new accounts skip the visual entirely
              rather than show a flat line that reads as 'no growth').
              Added 2026-05-18. */}
          <HouseholdSparkline history={aggregateHistory} />
        </motion.section>

        {/* Per-fund list. Each card routes to the kid's Dashboard via
            setActiveFundId — same mechanism the AppHeader switcher
            uses. Cards staged in 80ms apart for the staged-reveal
            motion vocabulary. No emotional copy here; each kid's
            individual surface carries the warmth. */}
        <section className="rounded-3xl border border-border bg-card p-5">
          <p className="kiddo-section-label mb-3">Each fund</p>
          <div className="space-y-2">
            {funds.map((f, i) => {
              const balance =
                parseFloat(String(f.balance || "0")) +
                parseFloat(String(f.pendingBalance || "0")) +
                parseFloat(String(f.cashBalance || "0"));
              const age = ageLabel(f.recipientBirthdate);
              const displayName = capFirst(f.recipientFirstName) || f.name;
              const isShared = f.accessRole !== "owner";
              const isTransferred = f.accessRole === "previous_owner";
              // Format "Transferred on Apr 14, 2027" for the pill on
              // post-handoff funds. The locale-formatted date is
              // calmer than ISO and matches the rest of the app's
              // date rendering register.
              const transferredLabel = isTransferred && f.transferredAt
                ? `Transferred · ${new Date(f.transferredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : null;
              return (
                <motion.button
                  key={f.id}
                  type="button"
                  onClick={() => handleOpenFund(f.id)}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut", delay: 0.18 + i * 0.08 }}
                  className={`w-full flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4 text-left hover:border-[hsl(var(--kiddo-border))]/80 transition-colors ${isTransferred ? "opacity-70" : ""}`}
                  data-testid={`overview-fund-${f.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Photo when the parent set one (Dashboard / sidebar
                        / header all do the same). Falls back to the
                        monogram chip — same evergreen tint as the
                        empty-state avatars elsewhere. The container
                        clips the photo with `overflow-hidden` so it
                        fills the circle cleanly. */}
                    <div className="h-10 w-10 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {f.childPhotoUrl ? (
                        <img
                          src={f.childPhotoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        String(displayName || "?").slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {displayName}
                        {age && <span className="ml-1.5 text-xs text-muted-foreground font-normal">({age})</span>}
                      </p>
                      {/* Micro-CTA varies by balance state. "Open fund" is
                          honest for funded rows; "Share to start" is the
                          calmer fix for zero-balance rows where "Open
                          fund · $0.00" reads as dead-zero. Avoiding the
                          emotional-aggregation framing ("first gift
                          starts the story") that another AI proposed —
                          that's the wrong register for this Apple-
                          Settings surface; the emotional cue belongs on
                          the per-kid Dashboard. See
                          project_funds_overview_rules.md. */}
                      <p className="text-[11px] text-muted-foreground">
                        {transferredLabel
                          ? transferredLabel
                          : (
                            <>
                              {isShared ? "Shared with you · " : ""}
                              {balance > 0 ? "Open fund" : "Share to start"}
                            </>
                          )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                      <p className="text-sm font-semibold text-foreground tabular-nums">{fmtCurrency(balance)}</p>
                      {/* 30-day delta. Subtle at-a-glance growth read.
                          Skips for transferred funds (their numbers
                          aren't moving) + funds without prior snapshot
                          (delta30dUsd === null). Threshold: hide when
                          |delta| < $1 to avoid noise like '+$0.04'.
                          Locked 2026-05-18. */}
                      {!isTransferred && typeof f.delta30dUsd === "number" && Math.abs(f.delta30dUsd) >= 1 && (
                        <p
                          className={`text-[10px] tabular-nums leading-tight mt-0.5 ${f.delta30dUsd >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-[hsl(var(--kora-gold))]"}`}
                          data-testid={`overview-fund-delta-${f.id}`}
                        >
                          {f.delta30dUsd >= 0 ? "+" : "−"}{fmtCurrency(Math.abs(f.delta30dUsd), { whole: true })}
                          <span className="text-muted-foreground"> · 30d</span>
                        </p>
                      )}
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Add-fund CTA. Closes the gap where a Family-tier parent
              landing on /funds with intent to add a 4th kid had no
              direct affordance — they'd have to bounce to Dashboard
              or the sidebar dropdown. Dispatches ADD_FUND_EVENT after
              navigating to /dashboard (where AddFundSheet is mounted).
              Same mechanism the sidebar + AppHeader use. */}
          <button
            type="button"
            onClick={handleAddFund}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--kiddo-border))] bg-card p-3 text-sm font-medium text-muted-foreground hover:border-[hsl(var(--kiddo-evergreen))]/40 hover:text-foreground transition-colors"
            data-testid="overview-add-fund"
          >
            <Plus size={14} />
            Add another child fund
          </button>
        </section>

        {/* This-month rollup. The actual reason a Family-plan parent
            wants this view — "how much did I spend / how much came
            in from the village this period." Tax + budget framing,
            not celebration. Three lines, no editorial. */}
        {thisMonth && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.18 + funds.length * 0.08 + 0.05 }}
            className="rounded-3xl border border-border bg-card p-5"
          >
            <p className="kiddo-section-label mb-3">This month</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground inline-flex items-center gap-2">
                  <Gift size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
                  Gifts from people
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {thisMonth.giftCount === 0
                    ? "—"
                    : `${thisMonth.giftCount} · ${fmtCurrency(thisMonth.giftTotal)}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground inline-flex items-center gap-2">
                  <Heart size={14} className="text-[hsl(var(--kiddo-gold))]" />
                  You added
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {parseFloat(String(thisMonth.contribTotal || "0")) > 0
                    ? fmtCurrency(thisMonth.contribTotal)
                    : "—"}
                </span>
              </div>
            </div>
          </motion.section>
        )}

        {/* Growing automatically — the ONE forward-looking commitment
            section on /funds. The "This month" card above is backward
            -looking (what happened this calendar month). This card is
            forward-looking (what's committed going out). Different
            temporal frames separated into different cards.
            See project_funds_overview_rules.md for the banned framings:
            no annual projection, no inline pause/edit, no "set up
            recurring" empty-state CTA. Whole section hides when there
            are zero active recurring contributions — same pattern as
            "Upcoming occasions" below. Naming locked: section header
            "Growing automatically" (NEVER "auto-invest" in UI copy)
            per project_recurring_contributions memory. */}
        {recurring && recurring.activeCount > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.18 + funds.length * 0.08 + 0.075 }}
            className="rounded-3xl border border-border bg-card p-5"
          >
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <p className="kiddo-section-label">Growing automatically</p>
              <p className="text-[11px] text-muted-foreground">
                {recurring.activeCount} active
              </p>
            </div>
            <div className="mb-3">
              <p
                className="font-heading text-2xl font-bold text-foreground tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums" }}
                aria-live={recurringAnimating ? "off" : "polite"}
                aria-label={fmtCurrency(recurringMonthlyLive)}
              >
                {fmtCurrency(animatedRecurringMonthly)}
              </p>
              <p className="text-[11px] text-muted-foreground">per month total</p>
            </div>
            <div className="space-y-2">
              {recurringItems.map((item) => {
                const displayName = capFirst(item.recipientFirstName) || item.fundName || "Fund";
                // Format the per-row amount + frequency in the
                // user's mental model ($50/mo, $25/wk, etc.) — NOT
                // the monthly-equivalent. The total above already
                // does the conversion; here we show what the
                // parent actually set.
                const amt = parseFloat(String(item.amount || "0"));
                const freqSuffix = (() => {
                  const f = String(item.frequency || "monthly").toLowerCase();
                  if (f === "weekly") return "/wk";
                  if (f === "daily") return "/day";
                  if (f === "yearly" || f === "annual" || f === "annually") return "/yr";
                  return "/mo";
                })();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenSchedule(item.fundId, item.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-3 text-left hover:border-[hsl(var(--kiddo-border))]/80 transition-colors"
                    data-testid={`overview-recurring-${item.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {item.childPhotoUrl ? (
                          <img src={item.childPhotoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          String(displayName).slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                          {/* Duplicate chip — appears on both rows of a
                              duplicate group. Amber/gold register so it
                              reads as "review this" (calm hygiene flag)
                              rather than red-alert. Tap behavior on the
                              row is unchanged: drills into the kid's
                              Dashboard where the parent can cancel one
                              of the duplicates. Server-side detection
                              groups by (fund, model, ticker, frequency,
                              bank, amount). */}
                          {item.isDuplicate && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{
                                background: "hsl(var(--kora-gold) / 0.14)",
                                color: "hsl(var(--kora-gold))",
                                letterSpacing: "0.04em",
                              }}
                              data-testid={`overview-recurring-duplicate-${item.id}`}
                            >
                              Duplicate
                            </span>
                          )}
                        </div>
                        {/* Subtitle composes destination (ticker / family
                            mix) + next-run date + bank so two recurrings
                            on the same fund don't render as identical
                            rows. See buildRecurringRowSubtitle for the
                            format choices. */}
                        <p className="text-[11px] text-muted-foreground truncate">
                          {buildRecurringRowSubtitle(item)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {fmtCurrency(amt)}<span className="text-muted-foreground font-normal">{freqSuffix}</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Upcoming occasions across all funds. Useful — three kids
            means three sets of birthdays + holidays, and a single
            calendar view beats hopping between fund dashboards to
            see what's next. 5-row cap from the server to keep this
            calm. Each row routes to that kid's Dashboard. */}
        {occasions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.18 + funds.length * 0.08 + 0.10 }}
            className="rounded-3xl border border-border bg-card p-5"
          >
            <p className="kiddo-section-label mb-3">Coming up</p>
            <div className="space-y-2">
              {occasions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleOpenFund(o.fundId)}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-3 text-left hover:border-[hsl(var(--kiddo-border))]/80 transition-colors"
                  data-testid={`overview-occasion-${o.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CalendarClock size={16} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {o.recipientFirstName ? `${capFirst(o.recipientFirstName)} · ` : ""}{o.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{fmtEventDate(o.eventDate)}</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </motion.section>
        )}

        {/* Across-all-funds village stat. Calm, not a love-mark. The
            copy says "people have given to your children" — accurate
            and warm without crossing into "family portrait" or
            "dynasty" territory. A single line, no profile circles,
            no avatars, no leaderboard energy.
            Tappable as of 2026-05-14: opens the cross-fund gifter
            sheet (GiftersAcrossFundsSheet) which answers the
            household-glance question per-fund Memory Books can't.
            "Grandma gave to whom and what did she give them?" The
            sheet itself respects the same calm register (no avatars,
            no leaderboard); chronologically sorted. The page itself
            stays visually unchanged; the affordance is just a chevron
            and a hover tint. */}
        {uniqueGifterCount > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.18 + funds.length * 0.08 + 0.15 }}
          >
            <button
              type="button"
              onClick={() => setGiftersSheetOpen(true)}
              className="w-full text-left rounded-3xl border border-border bg-card p-5 transition-colors hover:bg-[hsl(var(--kiddo-cream))] focus-visible:bg-[hsl(var(--kiddo-cream))] focus-visible:outline-none"
              data-testid="across-all-funds-gifters-trigger"
              aria-label="View gifters across all funds"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="kiddo-section-label mb-2">Across all funds</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    <span className="font-semibold">{uniqueGifterCount}</span>{" "}
                    {uniqueGifterCount === 1 ? "person has" : "people have"} given to your{" "}
                    {funds.length === 1 ? "child" : "children"}.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    See who gave to who.
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  strokeWidth={2}
                  className="shrink-0 mt-1 text-muted-foreground"
                  aria-hidden
                />
              </div>
            </button>
          </motion.section>
        )}

        {/* Honest footer note. Surfaces are not pretending to be the
            kid-emotional anchor — they're an administrative glance.
            Per-fund navigation is the answer for everything else. */}
        <p className="text-center text-[11px] text-muted-foreground/70 pt-2 pb-6">
          Each fund stays separate. Open one to see its Memory Book, activity, and settings.
        </p>
      </main>

      {/* Cross-fund gifter sheet. Mounted at the page root so its
          backdrop covers the full viewport (not just the main column)
          and the slide-up motion doesn't fight any internal layout. */}
      <GiftersAcrossFundsSheet
        open={giftersSheetOpen}
        onClose={() => setGiftersSheetOpen(false)}
      />
    </div>
  );
}
