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
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, ChevronRight, Gift, Heart, Plus } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { GiftersAcrossFundsSheet } from "@/components/GiftersAcrossFundsSheet";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
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
  // 30-day GIFT inflow in USD (excludes parent contributions).
  // Distinct from delta30dUsd (which includes market move + every
  // dollar in). Null when zero — client hides the line rather than
  // showing "$0 in gifts." The Family-tier roll-up signal: comparing
  // inflow across kids tells you whether gifting was balanced. Per
  // Tier-2 deferred item #4, shipped 2026-05-23.
  thisMonthGiftUsd?: number | null;
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
function HouseholdSparkline({
  history,
  deltaOverride,
}: {
  history: Array<{ date: string; total: number }>;
  // When provided, the "+$X · last 30 days" callout uses THIS value instead
  // of (history[last] − history[0]). The aggregate series' first in-window
  // day can be a PARTIAL-household sum — a fund whose boundary-day snapshot
  // falls just before the exact NOW−30d timestamp is excluded from that
  // day, so history[0] undercounts the household and the raw delta overstates
  // growth (observed ~2× the true number). The per-fund delta rows each use
  // their own correct baseline, so their sum is the trustworthy household
  // 30-day change — and matching the callout to it keeps the hero consistent
  // with the per-fund "· 30d" lines below. The sparkline SHAPE still comes
  // from the aggregate series (shape-only, no axis), so the edge artifact is
  // cosmetic there.
  deltaOverride?: number | null;
}) {
  if (!history || history.length < 2) return null;
  // Upgraded 2026-05-26 — the v1 sparkline was 36px tall with a
  // 1.5px stroke at 85% opacity, barely visible on the evergreen
  // hero card. Audit said "the chart" felt anemic next to Dashboard's
  // trend chart. Two changes:
  //   1. The sparkline itself is more confident — taller (60px),
  //      stronger stroke (2px @ 95% opacity), stronger fill
  //      gradient top stop (0.20 → 0.32). Still shape-only — no
  //      gridlines, no dots, no labels — preserves the locked
  //      "household-glance is shape, not numbers" rule.
  //   2. A small data-context callout below the SVG shows the 30d
  //      delta in dollars. Calm-register text, no celebration —
  //      this is just the spread of data points the sparkline
  //      already plots, made readable. Skipped when delta is < $1
  //      (would be noise like "+$0").
  const width = 280;
  const height = 60;
  const padding = 2; // breathing room so endpoints don't clip on stroke
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

  // 30-day delta callout. The history endpoint already filters to
  // the last 30 days (per server/routes.ts:21385+ SQL — interval
  // '30 days'), so the spread of first → last total IS the
  // household's 30-day net change. Skip when the delta is below $1
  // to avoid noisy "+$0" / "−$0" lines on inactive households.
  const delta = typeof deltaOverride === "number"
    ? deltaOverride
    : history[history.length - 1].total - history[0].total;
  const showDelta = Math.abs(delta) >= 1;
  const deltaPrefix = delta >= 0 ? "+" : "−";
  return (
    <div className="mt-4">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="opacity-95 block"
        aria-hidden
      >
        <defs>
          <linearGradient id="household-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#household-sparkline-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showDelta && (
        <p
          className="mt-2 text-[11px] font-semibold tabular-nums opacity-80"
          data-testid="household-sparkline-delta"
        >
          {deltaPrefix}{new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(Math.abs(delta))}
          <span className="opacity-60"> · last 30 days</span>
        </p>
      )}
    </div>
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
  // Plan-fit nudge (read-only): the household view is where a parent sees the fund
  // count drop after a handoff, so surface the "you could pay less" prompt here too,
  // linking to the full switch on billing. Server-gated to the safe one-fund case.
  // See SUBSCRIPTION_DOWNGRADE_SPEC.md.
  const { data: subscription } = useSubscription();
  const planFit = (subscription as any)?.planFit as
    | { kind: "downgrade_to_plus" | "no_plan_needed"; fund: { id: string; name: string; childName: string | null } | null }
    | null
    | undefined;
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
  // Order the list so the funds that actually have money come first.
  // With several empty / just-created funds, the one funded fund would
  // otherwise sink to the bottom and the whole page reads as lifeless.
  // Stable within each group (preserves the API's order — typically
  // creation order — so it stays predictable), and transferred (handed-
  // off) funds sink to the bottom as historical. Pure reorder, no new
  // framing — stays within project_funds_overview_rules.md.
  const sortedFunds = useMemo(() => {
    const rank = (f: OverviewFund) => {
      if (f.accessRole === "previous_owner") return 2; // transferred → bottom
      const bal =
        parseFloat(String(f.balance || "0")) +
        parseFloat(String(f.pendingBalance || "0")) +
        parseFloat(String(f.cashBalance || "0"));
      return bal >= 1 ? 0 : 1; // funded → top, not-yet-funded → middle
    };
    return funds
      .map((f, i) => ({ f, i }))
      .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
      .map((x) => x.f);
  }, [funds]);
  const thisMonth = data?.thisMonth;
  const occasions = data?.upcomingOccasions ?? [];
  const recurring = data?.recurring;
  const recurringItems = recurring?.items ?? [];
  const uniqueGifterCount = data?.uniqueGifterCount ?? 0;
  const aggregateHistory = data?.aggregateHistory ?? [];

  // Household 30-day change = sum of the per-fund deltas. This is the
  // number the hero callout shows, NOT the raw aggregate-series spread
  // (which overstates growth when the first in-window day is a partial-
  // household sum — see HouseholdSparkline). Null when no fund has a
  // prior snapshot, so the callout falls back to the series-based delta.
  const householdDelta30d = useMemo(() => {
    const vals = funds
      .map((f) => (typeof f.delta30dUsd === "number" ? f.delta30dUsd : null))
      .filter((v): v is number => v != null);
    return vals.length ? vals.reduce((sum, v) => sum + v, 0) : null;
  }, [funds]);

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

  // ?then=settings sets the post-pick destination to /settings instead
  // of /dashboard. Used by the Account-page cross-link "Choose a fund
  // to edit →" so a multi-fund parent can pick which kid's settings
  // they want to edit (vs landing randomly in the active fund's
  // settings, which was the audit-flagged confusion 2026-05-26). Other
  // landing surfaces (Dashboard, schedules, deep-links) ignore the
  // param and route normally.
  const search = useSearch();
  const thenDestination = (() => {
    try {
      const params = new URLSearchParams(search || "");
      const then = String(params.get("then") || "").toLowerCase();
      return then === "settings" ? "/settings" : "/dashboard";
    } catch {
      return "/dashboard";
    }
  })();

  const handleOpenFund = (fundId: string) => {
    haptic("selection");
    setActiveFundId(fundId);
    setLocation(thenDestination);
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
  // Two distinct sub-cases — don't collapse them into one "Open
  // Dashboard" CTA:
  //
  //   - 1 fund: this IS a parent, just below the 2-fund overview
  //     threshold. The single-fund Dashboard is their overview, so
  //     bounce there.
  //   - 0 funds: this user owns no funds at all. On /funds — a
  //     parent-only household-aggregation page — that's almost always
  //     a GIFTER who wandered in (gift-receipt link, sidebar, typed
  //     URL). "Open Dashboard" sends them to ANOTHER empty parent
  //     surface; their real home is /my-gifts. Offer that as the
  //     primary path, with a quiet "start your own fund" escape for
  //     the rare would-be parent. (No auto-redirect: a hard bounce
  //     would surprise a parent mid-onboarding and risks a loop.)
  if (!enabled) {
    const fundCount = data?.fundCount ?? 0;
    const hasNoFunds = fundCount === 0;
    return (
      <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-funds-overview">
        <AppHeader />
        <main className="kiddo-canvas px-4 py-6">
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="font-heading text-lg font-semibold text-foreground">
              {hasNoFunds ? "This view is for funds you manage." : "The overview unlocks at 2 or more funds."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasNoFunds
                ? "You don't manage any funds yet. If you've been gifting, your gifts live in one place."
                : "You have 1 fund. Open the Dashboard for the full view."}
            </p>
            {hasNoFunds ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setLocation("/my-gifts")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                  data-testid="button-funds-empty-view-gifts"
                >
                  View your gifts
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setLocation("/get-started")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
                  data-testid="button-funds-empty-start-fund"
                >
                  Start your own fund
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLocation("/dashboard")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                Open Dashboard
                <ArrowRight size={14} />
              </button>
            )}
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
          {/* Hero context line — was just "across N funds" which read
              as administrative scaffolding. Added this-month signal
              (gifts in + parent contributions) inline so the hero
              actually has a heartbeat. Falls back gracefully to the
              old "across N funds" line when no thisMonth data exists.
              Audit-flagged 2026-05-26: hero felt anemic compared to
              Dashboard's hero. This closes the gap without violating
              the locked "calm administrative, not emotional" rule —
              one factual contextual line, no celebration copy. */}
          {thisMonth && (thisMonth.giftCount > 0 || parseFloat(String(thisMonth.contribTotal || "0")) > 0) ? (
            <p className="text-sm opacity-75 tabular-nums">
              {thisMonth.giftCount > 0 && (
                <span>{thisMonth.giftCount} {thisMonth.giftCount === 1 ? "gift" : "gifts"} · {fmtCurrency(thisMonth.giftTotal, { whole: true })} this month</span>
              )}
              {thisMonth.giftCount > 0 && parseFloat(String(thisMonth.contribTotal || "0")) > 0 && <span className="opacity-60"> · </span>}
              {parseFloat(String(thisMonth.contribTotal || "0")) > 0 && (
                <span>{fmtCurrency(thisMonth.contribTotal, { whole: true })} from you</span>
              )}
            </p>
          ) : (
            <p className="text-sm opacity-70">
              across {funds.length} fund{funds.length === 1 ? "" : "s"}
            </p>
          )}
          {/* Household sparkline. Shape only — direction, not
              percentage. Respects the locked 'no aggregate return %'
              rule (combining returns across different time horizons
              would be mathematical fiction). 30 daily points; renders
              nothing when there are fewer than 2 snapshots in the
              window (brand-new accounts skip the visual entirely
              rather than show a flat line that reads as 'no growth').
              Added 2026-05-18. */}
          <HouseholdSparkline history={aggregateHistory} deltaOverride={householdDelta30d} />
        </motion.section>

        {/* Plan-fit nudge. Surfaced here (the household view) because this is where a
            parent sees the fund count drop after a kid hands off. Links to the full
            switch on the billing page rather than duplicating it. Server-gated to the
            safe one-fund case (planFit). See SUBSCRIPTION_DOWNGRADE_SPEC.md. */}
        {planFit?.kind === "downgrade_to_plus" && (
          <button
            type="button"
            onClick={() => { haptic("selection"); setLocation("/account?tab=plan"); }}
            className="flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--kiddo-gold)/0.45)] bg-[hsl(var(--kiddo-gold)/0.08)] p-4 text-left transition-colors hover:bg-[hsl(var(--kiddo-gold)/0.12)]"
            data-testid="button-overview-planfit"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[hsl(var(--kiddo-gold-ink))]">You're managing one fund now</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Kiddo+ covers one child for less than Kiddo Family. Review your plan whenever it suits you.
              </p>
            </div>
            <ArrowRight size={18} className="shrink-0 text-[hsl(var(--kiddo-gold-ink))]" />
          </button>
        )}

        {/* Per-fund list. Each card routes to the kid's Dashboard via
            setActiveFundId — same mechanism the AppHeader switcher
            uses. Cards staged in 80ms apart for the staged-reveal
            motion vocabulary. No emotional copy here; each kid's
            individual surface carries the warmth. */}
        <section className="rounded-3xl border border-border bg-card p-5">
          <p className="kiddo-section-label mb-3">Each fund</p>
          <div className="space-y-2">
            {sortedFunds.map((f, i) => {
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
              // Funded vs unfunded visual differentiation — audit
              // 2026-05-26 flagged that a $1,967 fund and a $0 test
              // fund rendered at identical visual weight, so on
              // scan you couldn't tell which fund actually had
              // money. Funded rows get a subtle evergreen left
              // accent + slightly bolder balance typography. Unfunded
              // rows get muted name + balance. Transferred rows
              // still get the existing opacity-70 treatment (gentle
              // dim of the whole row). The accent stays well within
              // the locked "calm administrative" register — no
              // celebration, no glow, just visual hierarchy that
              // matches information hierarchy.
              const isFunded = balance >= 1 && !isTransferred;
              return (
                <motion.button
                  key={f.id}
                  type="button"
                  onClick={() => handleOpenFund(f.id)}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut", delay: 0.18 + i * 0.08 }}
                  className={`relative w-full flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-colors ${
                    isTransferred
                      ? "opacity-70 border-[hsl(var(--kiddo-border))]"
                      : isFunded
                        ? "border-[hsl(var(--kiddo-evergreen)/0.18)] hover:border-[hsl(var(--kiddo-evergreen)/0.32)] shadow-[inset_3px_0_0_hsl(var(--kiddo-evergreen)/0.55)]"
                        : "border-[hsl(var(--kiddo-border))] hover:border-[hsl(var(--kiddo-border))]/80"
                  }`}
                  data-testid={`overview-fund-${f.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Photo when the parent set one (Dashboard / sidebar
                        / header all do the same). Falls back to the
                        monogram chip — same evergreen tint as the
                        empty-state avatars elsewhere. The container
                        clips the photo with `overflow-hidden` so it
                        fills the circle cleanly. Unfunded fund rows
                        get a slightly more muted chip background so
                        the funded row's avatar pops by comparison. */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${
                      isFunded
                        ? "bg-[hsl(var(--kiddo-evergreen)/0.12)] text-[hsl(var(--kiddo-evergreen))]"
                        : "bg-[hsl(var(--kiddo-evergreen)/0.06)] text-[hsl(var(--kiddo-evergreen)/0.7)]"
                    }`}>
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
                      <p className={`text-sm font-semibold truncate ${isFunded ? "text-foreground" : "text-foreground/65"}`}>
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
                      <p className={`tabular-nums ${
                        isFunded
                          ? "text-base font-bold text-foreground"
                          : "text-sm font-semibold text-foreground/55"
                      }`}>{fmtCurrency(balance)}</p>
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
                      {/* Per-fund gift inflow this month. Family-tier
                          roll-up signal: scan the cards, see which kid
                          got more love this month. Hidden when zero
                          (line itself would read awkwardly as "$0").
                          Skipped on transferred funds (the gift loop
                          is over for those — would be misleading).
                          Distinct from delta30dUsd above which counts
                          market moves too. Per Tier-2 deferred #4. */}
                      {!isTransferred && typeof f.thisMonthGiftUsd === "number" && f.thisMonthGiftUsd >= 1 && (
                        <p
                          className="text-[10px] tabular-nums leading-tight mt-0.5 text-muted-foreground"
                          data-testid={`overview-fund-inflow-${f.id}`}
                        >
                          {fmtCurrency(f.thisMonthGiftUsd, { whole: true })} in gifts
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
