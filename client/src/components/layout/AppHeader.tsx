import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Plus, RefreshCw, Share2, User } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { getActiveFundId, setActiveFundId, ACTIVE_FUND_CHANGE_EVENT, ADD_FUND_EVENT } from "@/hooks/use-active-fund";
import { isHouseholdScopedPath, isUserScopedPath, shouldSuppressFundChrome, shouldHidePrimaryNav, isFundSubPage } from "@/lib/page-scope";
import { rememberAppLocation, readLastAppLocation, formatBackLabel, backTargetHref } from "@/lib/last-location";
import { capFirst } from "@/lib/format-name";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { NotificationsPanel, useBellUnreadCount } from "@/components/NotificationsPanel";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { ShareModal, type SharePage } from "@/components/ui/share-modal";
import { MOTION_DURATION } from "@/lib/motion";
import type { Fund } from "@shared/schema";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Home",
  "/events": "Occasions",
  "/settings": "Settings",
  "/activity": "Activity",
  "/account": "Account",
  "/profile": "Profile",
  "/activate": "Activate",
  "/age-18-plan": "Age 18",
  "/tax-documents": "Taxes",
  // Household-glance surface. "Funds" reads as the section name
  // (parallel to "Activity", "Settings"); the dropdown trigger right
  // next to it carries the active scope ("Your funds"). Same two-part
  // header pattern every other page uses.
  "/funds": "Funds",
};

function getPageTitle(location: string): string {
  if (location.startsWith("/memory")) return "Memory Book";
  if (location.startsWith("/event/create")) return "New Event";
  if (location.startsWith("/events")) return "Occasions";
  if (location.startsWith("/dashboard")) return "Home";
  if (location.startsWith("/projection")) return "Potential";
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (location === path || location.startsWith(path + "/") || location.startsWith(path + "?")) return title;
  }
  return "";
}

// `/profile` stays excluded because it's a pre-fund identity step (auth +
// onboarding lives there). `/account` was previously excluded on the theory
// that account settings are "global, not per-fund" — but the parent uses the
// active fund context (balance, share button, fund switcher) on every other
// page and noticed the gap. Consistency wins: keep the strip on Account too.
const NO_FUND_PAGES = ["/profile"];
function showsFundContext(location: string): boolean {
  return !NO_FUND_PAGES.some((p) => location === p || location.startsWith(p + "?"));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function AppHeader() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  // Listen for the global open-notifications event. The ActionItemList
  // overflow row ("3 more items in your inbox →") dispatches this when
  // a parent taps the overflow link on a capped Action Items section
  // (Activity, Dashboard). Wiring the listener here means the bell
  // panel opens regardless of which page the overflow was on. Locked
  // 2026-05-19 per the action-items pruning pass.
  useEffect(() => {
    const handler = () => setNotifOpen(true);
    window.addEventListener("kiddo:open-notifications", handler);
    return () => window.removeEventListener("kiddo:open-notifications", handler);
  }, []);
  const [fundPickerOpen, setFundPickerOpen] = useState(false);
  // Local share modal — opens for non-Dashboard pages where the in-page
  // (richer) Dashboard modal isn't mounted to listen for the event. Without
  // this, clicking the header Share on Memory Book / Activity / Settings
  // fires the event into the void and nothing happens.
  const [headerShareOpen, setHeaderShareOpen] = useState(false);
  const fundPickerRef = useRef<HTMLDivElement>(null);
  // Bell badge uses the noise-filtered count so it agrees with the
  // notifications panel's own header count and with what the panel
  // actually shows when tapped. Routine flows (auto-invest fires,
  // subscription renewals, parent's own admin actions) live in the
  // Activity tab — see useBellUnreadCount comment for the canonical
  // "bell vs tab dot" split.
  // Scope-aware bell badge. On non-fund-scoped pages (/funds, /account)
  // the badge counts across ALL funds — fund context doesn't apply, so
  // limiting the count to the implicit active fund would silently hide
  // notifications from other kids' funds. On fund-scoped pages, keep
  // the default per-fund scope so the badge matches the page context.
  // location is already declared at the top of the component (line 63).
  // See project_chrome_scope_tiers.md.
  const unreadCount = useBellUnreadCount(shouldSuppressFundChrome(location) ? "all" : "active");

  // Manual refresh affordance. Browser-native pull-to-refresh + SSE +
  // 30s polling + window-focus refetch already cover most freshness
  // cases; this is the explicit-control affordance for users who want
  // to force a sync. Especially useful on installed PWAs where browser
  // PTR doesn't fire, and on desktop where there's no pull gesture at
  // all. Invalidates the three queries that matter (funds list,
  // dashboard-summary for the active fund, activities feed) and shows
  // a brief 700ms spinner state so the click reads as a real action
  // even when the network is fast.
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Page scope drives every chrome adjustment below. /funds is
  // household-scoped (Tier 2), /account is user-scoped (Tier 3) —
  // both suppress fund-specific chrome but differ in how the
  // dropdown trigger reads. See client/src/lib/page-scope.ts.
  const isFundsOverview = isHouseholdScopedPath(location);
  const isUserScoped = isUserScopedPath(location);
  const suppressFundChrome = shouldSuppressFundChrome(location);
  // /account hides primary nav entirely; the header gets a Back
  // arrow so mobile users still have a clear exit. Active fund's
  // recipient first name in the back-target when known.
  const hideNav = shouldHidePrimaryNav(location);
  // Fund sub-pages (Age18Plan, Projection, Tax Documents) also show
  // the mobile Back arrow. Tier-1 fund-scoped but conceptually a
  // sub-screen of Dashboard — without a Back arrow, mobile users
  // had no in-page exit (the bottom-nav Home tab was marked active
  // but only scrolled-to-top instead of popping). See isFundSubPage
  // doc-block in page-scope.ts. Locked 2026-05-18.
  const isSubPage = isFundSubPage(location);
  const showBackArrow = hideNav || isSubPage;
  const handleRefresh = useCallback(() => {
    haptic("selection");
    setRefreshing(true);
    const active = getActiveFundId();
    void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    if (active) {
      void queryClient.invalidateQueries({ queryKey: ["/api/funds", active, "dashboard-summary"] });
    }
    // On the all-funds overview surface, the household aggregate is
    // the load-bearing query — invalidate that too so refresh is the
    // single source of truth for the visible page state.
    if (isFundsOverview) {
      void queryClient.invalidateQueries({ queryKey: ["/api/funds-overview"] });
    }
    void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    window.setTimeout(() => setRefreshing(false), 700);
  }, [queryClient, isFundsOverview]);

  const { data: funds = [] } = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      writeLocalCache(LOCAL_CACHE_KEYS.funds, data);
      return data;
    },
    enabled: isAuthenticated,
    initialData: () => readLocalCache<Fund[]>(LOCAL_CACHE_KEYS.funds),
    initialDataUpdatedAt: 0,
    staleTime: 2 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const [activeFundId, setActiveFundIdState] = useState(() => getActiveFundId() || "");
  useEffect(() => {
    const handler = () => setActiveFundIdState(getActiveFundId() || "");
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);

  const activeFund = (activeFundId ? funds.find((f) => f.id === activeFundId) : null) ?? funds[0] ?? null;

  const shareUrl = activeFund ? `${window.location.origin}/${(activeFund as any).slug || ""}` : "";

  // Build the basic share-pages list for the local modal — just the
  // canonical fund gift page. Dashboard renders its own richer modal with
  // event-specific pages too; for every other route, this minimal version
  // covers the "I want to send this kid's gift link to someone" need.
  const headerSharePages = useMemo<SharePage[]>(() => {
    if (!activeFund || !(activeFund as any).slug) return [];
    const childFirst = capFirst(activeFund.recipientFirstName) || activeFund.name || "your child";
    // Owner mode: the label in the owner's own share UI reads "your"; the destination gift
    // page stays targeted to them (gifters give TO the owner).
    const ownerMode = Boolean((activeFund as any).transferredAt && (activeFund as any).accessRole === "owner");
    return [
      {
        label: ownerMode ? "Your gift page" : `${childFirst}'s gift page`,
        description: "Anyone can give in under a minute. No account needed.",
        url: shareUrl,
        isPermanent: true,
      },
    ];
  }, [activeFund, shareUrl]);

  const handleShare = useCallback(() => {
    haptic("selection");
    if (!activeFund || !(activeFund as any).slug) {
      toast({ title: "No gift link yet", description: "Add your child's details to generate a gift link." });
      return;
    }
    // On Dashboard, defer to the richer in-page modal (it's mounted there
    // and includes event-specific share pages we don't have at header level).
    // Anywhere else, open our own basic modal so the click actually does
    // something instead of dispatching an event nobody's listening for.
    if (location.startsWith("/dashboard")) {
      window.dispatchEvent(new CustomEvent("kiddo:open-share-modal"));
    } else {
      setHeaderShareOpen(true);
    }
  }, [activeFund, location]);

  const selectFund = useCallback((fund: Fund) => {
    setActiveFundId(fund.id);
    setActiveFundIdState(fund.id);
    setFundPickerOpen(false);
    haptic("selection");
    if (location.startsWith("/memory")) setLocation(`/memory/${fund.id}`);
    else if (location.startsWith("/dashboard")) setLocation(`/dashboard?fund=${fund.id}`);
    // From /funds, picking a kid means "drill into that kid" — go to
    // their Dashboard. Without this branch the dropdown just silently
    // updates the active-fund state and the user stays parked on the
    // household-glance page, which reads as "the dropdown isn't
    // working" (reproduced 2026-05-11 — the bug surfaced after we
    // promoted /funds to nav-hidden tier; the per-fund row tap in
    // the page body already had this behavior).
    else if (location === "/funds") setLocation(`/dashboard?fund=${fund.id}`);
    // Other surfaces (Activity, Settings, Tax Documents, etc.) read
    // the active fund from localStorage and re-derive on next render —
    // no URL change needed; the active-fund event handler covers them.
  }, [location, setLocation]);

  // Mirror of DesktopSidebar.handleAddFund — fires the global
  // ADD_FUND_EVENT after navigating to /dashboard (where AddFundSheet
  // is mounted). Header dropdown was missing this affordance, so a
  // single-fund parent on Memory Book or Settings had no way to start
  // a second fund without going to the desktop sidebar (mobile users
  // had no path at all).
  const handleAddFund = useCallback(() => {
    setFundPickerOpen(false);
    haptic("selection");
    if (!location.startsWith("/dashboard")) setLocation("/dashboard");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(ADD_FUND_EVENT)), 0);
  }, [location, setLocation]);

  useEffect(() => {
    if (!fundPickerOpen) return;
    const handler = (e: PointerEvent) => {
      if (!fundPickerRef.current?.contains(e.target as Node)) setFundPickerOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [fundPickerOpen]);

  const pageTitle = getPageTitle(location);
  const withFund = showsFundContext(location) && activeFund;

  // Track last non-/account location so the /account Back button
  // can return there (instead of always defaulting to the fund's
  // Dashboard). Saves on every location change EXCEPT when the
  // current location is /account itself — that filter is inside
  // rememberAppLocation. Reads from `location` (wouter pathname)
  // + window.location.search because wouter doesn't expose search
  // in its first return value. See client/src/lib/last-location.ts.
  useEffect(() => {
    rememberAppLocation({
      path: location,
      search: typeof window !== "undefined" ? window.location.search : "",
      label: pageTitle || "",
    });
  }, [location, pageTitle]);

  // On /account OR a fund sub-page, read the prior location to build
  // the Back target. Falls back to the active fund's Dashboard
  // ("Back to {Kid}'s fund") if no prior location was recorded —
  // covers cold deep-link entries.
  const lastLocation = showBackArrow ? readLastAppLocation() : null;
  const backHref = backTargetHref(lastLocation, activeFund?.id ?? null);
  const backLabel = formatBackLabel(lastLocation, capFirst(activeFund?.recipientFirstName) || null);
  const accountType = activeFund ? String((activeFund as any).accountType || "UTMA").toUpperCase() : "";
  // Owner mode: the post-handoff recipient viewing their OWN fund (transferred AND
  // current owner). Flips the header fund label to "Your Fund" — the biggest "it's
  // mine" signal, on every page. Same signal as Projection.tsx. The share LABEL in the
  // owner's OWN UI reads "your"; only the gift PAGE a recipient lands on stays "{kid}'s"
  // (the people she shares with really do give TO her).
  const isOwnerMode = Boolean(activeFund && (activeFund as any).transferredAt && (activeFund as any).accessRole === "owner");
  const statusLabel = activeFund ? ((activeFund as any).status === "active" ? "Active" : "Draft") : "";
  // Badge suppressed on any non-fund-scoped page (household /funds
  // and user-scoped /account both). The "UTMA · Active" label is a
  // per-fund status; it's noise on pages where the user isn't
  // operating on a specific fund.
  // Owner mode: a UTMA terminates at the age of majority and the assets become the owner's
  // outright, so "UTMA" is stale for them — show "Personal" (the platform's adult-account
  // type) instead.
  const displayAccountType = isOwnerMode && accountType ? "Personal" : accountType;
  const badgeText = suppressFundChrome
    ? ""
    : displayAccountType && statusLabel
      ? `${displayAccountType} · ${statusLabel}`
      : statusLabel;

  return (
    <>
      <motion.header
        className="sticky top-0 z-50"
        style={{
          background: "hsl(var(--kiddo-cream) / 0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(26, 23, 16, 0.10)",
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 20,
          paddingRight: 20,
          gap: 12,
        }}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: MOTION_DURATION.routeEnter }}
        data-testid="app-header"
      >
        {/* Left: page title + fund context */}
        <div ref={fundPickerRef} className="relative flex min-w-0 flex-1 items-center gap-2">
          {/* Context-aware Back arrow (target + aria-label come from the last
              location — Memory Book → here → Back lands on Memory Book; see
              client/src/lib/last-location.ts).
              Visibility by surface (fixed 2026-05-28):
                - FUND SUB-PAGES (/age-18-plan, /projection, /tax-documents):
                  show on BOTH mobile and desktop. The desktop sidebar's Back is
                  gated to /account (isUserScoped) and never covered these, so
                  desktop had NO back affordance at all — this is the only one.
                - /account (hideNav, not a fund sub-page): MOBILE ONLY. On desktop
                  the sidebar renders its own Back, so this stays md:hidden to
                  avoid two affordances pointing at the same place. */}
          {showBackArrow && (
            <button
              type="button"
              onClick={() => {
                haptic("selection");
                setLocation(backHref);
              }}
              className={`${isSubPage ? "" : "md:hidden"} -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-[hsl(var(--kiddo-cream))] transition-colors`}
              data-testid="header-back-to-home"
              aria-label={backLabel}
            >
              <ArrowLeft size={17} strokeWidth={2.2} />
            </button>
          )}
          <h1
            className="font-heading shrink-0 text-[15px] font-bold text-foreground"
            data-testid="header-page-title"
          >
            {pageTitle}
          </h1>

          {withFund && !isUserScoped && (
            <>
              {/* Separator only renders when there's a left-side
                  pageTitle to separate from. /funds has no page-title
                  entry, so "·" with empty left side reads as broken
                  punctuation.
                  Also suppressed entirely on user-scoped pages
                  (/account) — the fund-switcher trigger doesn't render
                  there, so there's nothing to separate from anyway. */}
              {pageTitle && (
                <span className="shrink-0 text-[18px] leading-none text-foreground/15">·</span>
              )}

              {/* Fund name — always tappable. Even with one fund, the
                  dropdown opens to expose the "+ Add child fund"
                  affordance. Previously gated on funds.length > 1 so
                  single-fund parents had no path to add a second from
                  the header (mobile = no path at all).
                  Hidden on user-scoped pages (/account) — see
                  project_chrome_scope_tiers.md: when the user is
                  operating on themselves, fund context shouldn't
                  reach into the chrome. The sidebar nav still
                  drills into the last-active fund for escape. */}
              <button
                type="button"
                onClick={() => {
                  setFundPickerOpen((v) => !v);
                  haptic("light");
                }}
                className="flex min-w-0 items-center gap-1 truncate text-[13px] text-muted-foreground cursor-pointer hover:text-foreground"
                data-testid="header-fund-name"
              >
                <span className="truncate">
                  {isFundsOverview
                    ? "Your funds"
                    : isOwnerMode
                      ? "Your Fund"
                      : activeFund.recipientFirstName
                        ? `${capFirst(activeFund.recipientFirstName)}'s Fund`
                        : activeFund.name || "Fund"}
                </span>
                <ChevronDown size={12} className={`shrink-0 transition-transform text-muted-foreground ${fundPickerOpen ? "rotate-180" : ""}`} />
              </button>

              {badgeText && (
                <span
                  className="hidden shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-[0.02em] sm:inline-block"
                  style={{ background: "hsl(var(--kiddo-evergreen) / 0.10)", color: "hsl(var(--kiddo-evergreen))" }}
                >
                  {badgeText}
                </span>
              )}
            </>
          )}

          {/* Fund picker dropdown */}
          {fundPickerOpen && (
            <div
              className="absolute left-0 top-[calc(100%+10px)] z-50 min-w-[220px] overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-border))] bg-white shadow-[0_22px_60px_rgba(26,23,16,0.18)]"
              role="listbox"
            >
              {/* Family-plan overview entry. Appears ONLY when the user
                  has 2+ funds — single-fund users don't need an overview
                  (the Dashboard IS the overview at that scale). Sits at
                  the TOP of the picker so it reads as the household
                  glance, with the per-kid entries below it as the
                  individual surfaces. Routes to /funds — see
                  project_funds_overview_rules.md for what that surface
                  is allowed to show. */}
              {funds.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    haptic("selection");
                    setFundPickerOpen(false);
                    setLocation("/funds");
                  }}
                  className={`flex w-full items-center gap-3 border-b border-[hsl(var(--kiddo-border))] px-4 py-3 text-left text-sm transition-colors ${
                    isFundsOverview
                      ? "bg-[hsl(var(--kiddo-evergreen)/0.08)]"
                      : "hover:bg-[hsl(var(--kiddo-cream))]"
                  }`}
                  data-testid="header-funds-overview-entry"
                  role="option"
                  aria-selected={isFundsOverview}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] text-xs">
                    🌱
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold text-foreground">Your funds</p>
                    <p className="text-[11px] text-muted-foreground">All {funds.length} together</p>
                  </div>
                  {isFundsOverview && <Check size={14} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />}
                </button>
              )}
              {/* Render the fund list only when there's more than one
                  to switch between. Single-fund parents still get the
                  "+ Add child fund" footer below — that's the whole
                  reason this dropdown opens for them. */}
              {funds.length > 1 && funds.map((fund) => {
                // When on the funds-overview page, none of the per-fund
                // rows are "selected" — the household entry up top owns
                // the check. Otherwise the active per-fund row gets it.
                const isActive = !isFundsOverview && fund.id === activeFund?.id;
                const val = parseFloat(String(fund.balance || "0")) +
                  parseFloat(String((fund as any).pendingBalance || "0")) +
                  parseFloat(String((fund as any).cashBalance || "0"));
                return (
                  <button
                    key={fund.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectFund(fund)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${isActive ? "bg-[hsl(var(--kiddo-evergreen)/0.08)]" : "hover:bg-[hsl(var(--kiddo-cream))]"}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen))] text-xs font-bold text-white overflow-hidden">
                      {fund.childPhotoUrl
                        ? <img src={fund.childPhotoUrl} alt="" className="h-full w-full object-cover" />
                        : (fund.recipientFirstName || fund.name || "F").slice(0, 1).toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {fund.recipientFirstName ? `${capFirst(fund.recipientFirstName)}'s Fund` : fund.name || "Fund"}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(val)}</p>
                    </div>
                    {isActive && <Check size={14} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />}
                  </button>
                );
              })}
              {/* Add child fund — same affordance the DesktopSidebar
                  fund-switcher menu has. Single-fund parents need this
                  to start a second; multi-fund parents need it for the
                  third+. Border-top only when there are funds above to
                  separate it visually. */}
              <button
                type="button"
                onClick={handleAddFund}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[hsl(var(--kiddo-evergreen))] transition-colors hover:bg-[hsl(var(--kiddo-cream))] ${funds.length > 1 ? "border-t border-[hsl(var(--kiddo-border))]" : ""}`}
                data-testid="header-add-fund"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.08)]">
                  <Plus size={14} />
                </span>
                Add child fund
              </button>
            </div>
          )}
        </div>

        {/* Right: bell + share. Balance and gain pulled from the header
            entirely — the Dashboard hero is the canonical balance surface
            (full-width, emotionally anchored, exactly once per page) and
            the DesktopSidebar already shows it on desktop. Repeating it
            in the header pulls the parent into "is it up today" psychology
            on a long-horizon product, contrary to the locked design lens
            and feedback_no_ai_slop's anti-streak-gamification rule. */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Refresh — leftmost in the right-cluster. Explicit user
              control to force a sync; the SSE + polling + focus-refetch
              combo means manual refresh is rarely needed, but discovery
              of "I can force this" matters more on installed PWAs
              (where browser pull-to-refresh doesn't fire) and on
              desktop (where there's no pull gesture at all). Disabled
              briefly while the spinner is showing so a double-tap
              doesn't queue two invalidations. */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            // Base + hover both via className. Inline `background` had
            // been killing the hover affordance per the chrome audit.
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[rgb(237,244,238)] border-[rgb(224,237,227)] transition-colors disabled:opacity-60 hover:bg-[rgb(224,237,227)] focus-visible:bg-[rgb(224,237,227)] focus-visible:outline-none"
            data-testid="header-refresh"
            aria-label="Refresh"
          >
            <RefreshCw
              size={15}
              strokeWidth={1.8}
              color="#1A3D2B"
              className={refreshing ? "animate-spin" : ""}
            />
          </button>

          {/* Bell — second in the mobile right-cluster (situational
              alert, scanned occasionally). Convention: rightmost slot in
              a mobile header is for the durable identity / profile entry
              point (Gmail, LinkedIn, Notion, iOS Settings, Apple HIG).
              Bell sits inside that, profile sits at the far edge below. */}
          <button
            type="button"
            onClick={() => { haptic("selection"); setNotifOpen((v) => !v); }}
            // Base + hover both via className so the :hover pseudo-class can
            // override the base — inline `style` props had higher specificity
            // and were silently killing the hover affordance. Hover darkens
            // the muted-evergreen tint a notch so the bell reads as
            // interactive on cursor approach. focus-visible mirror for kbd.
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[rgb(237,244,238)] border-[rgb(224,237,227)] transition-colors hover:bg-[rgb(224,237,227)] focus-visible:bg-[rgb(224,237,227)] focus-visible:outline-none"
            data-testid="header-bell"
            aria-label="Notifications"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z" stroke="#1A3D2B" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
              <path d="M8 16a2 2 0 004 0" stroke="#1A3D2B" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {unreadCount > 0 && (
              <div
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white px-0.5 text-[9px] font-black text-white"
                style={{ background: "rgb(26,61,43)" }}
              >
                {/* Cap as "9+" to match DesktopSidebar's nav badge
                    convention. Previously displayed bare "9" for any
                    count >9 which read as "exactly 9" rather than
                    "9 or more." min-w-4 lets the badge widen by ~2px
                    to accommodate the plus glyph. */}
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </button>

          {/* Profile — rightmost on mobile. Routes to /account (identity
              surface, distinct from /settings which is fund control panel).
              Right-edge thumb-reach + dominant convention: Gmail / LinkedIn /
              Notion / Figma / iOS Settings all put the user/account
              control at the far right. Desktop hides via md:hidden because
              the DesktopSidebar already carries an identity lockup at the
              bottom — chrome-on-chrome there. */}
          {/* Profile photo when set, fallback to User glyph. Same pattern
              as Gmail / LinkedIn / Notion / iOS Settings — when the user
              has a face on file, the corner shows the face. The
              evergreen-tinted ring around the photo matches the icon
              variant's border so the visual weight stays consistent. */}
          {(() => {
            const photoUrl = String((user as any)?.profileImageUrl || "").trim();
            return (
              <button
                type="button"
                onClick={() => { haptic("selection"); setLocation("/account"); }}
                // Same audit: base bg moved off inline so :hover can apply.
                // Hover darkens the tint slightly. Empty-photo and
                // has-photo cases share the same chrome (border + base bg
                // ring around the avatar).
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[rgb(237,244,238)] border-[rgb(224,237,227)] transition-colors md:hidden overflow-hidden p-0 hover:bg-[rgb(224,237,227)] focus-visible:bg-[rgb(224,237,227)] focus-visible:outline-none"
                data-testid="header-profile"
                aria-label="Account"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt=""
                    // 32×32 inside a 36×36 button (h-8 w-8 vs h-9 w-9 button) —
                    // the 2px breathing ring around the photo turns it from a
                    // "hero crop" into a "framed avatar." Same convention as
                    // Twitter / Instagram / Gmail header photos. Tap target
                    // (the button) stays at 36×36 so it matches the bell next
                    // to it; only the visible photo content is inset.
                    className="h-8 w-8 rounded-full object-cover"
                    onError={(e) => {
                      // If the image fails to load (404, broken URL, CORS),
                      // fall back to the icon by hiding the img and letting
                      // the sibling icon show. Cheap defensive pattern.
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (sibling) sibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <User
                  size={16}
                  strokeWidth={1.6}
                  style={{
                    color: "rgb(26,61,43)",
                    display: photoUrl ? "none" : "block",
                  }}
                />
              </button>
            );
          })()}

          {/* Share link — desktop only. Mobile has its own Share CTA
              dead-center on the bottom-nav (gold pill, slightly elevated
              above the rail). Showing both would create two competing
              primary CTAs on the same mobile screen — Apple HIG +
              one-primary-action-per-screen rule both flag this. md:flex
              keeps the desktop sidebar nav (which has no Share) backed by
              this header button; hidden below 768px.
              Hidden on /funds because sharing is per-kid — there is no
              aggregate household share link, so an active "Share" button
              that silently shares Emma's link from the household surface
              would be a stealth-context-switch foot-gun. Same reasoning
              on /account: user-scoped page → the active fund is
              irrelevant → an active Share button there would silently
              share Emma's link if tapped, same foot-gun. */}
          {withFund && !suppressFundChrome && (
            <button
              type="button"
              onClick={handleShare}
              // Base gold + hover (slightly darker gold) via className so the
              // pseudo-class can apply. Previously the inline `background:
              // "rgb(184,121,26)"` had higher specificity than any `hover:bg-`
              // utility — chrome audit fix. Gold is the brand-primary action
              // color (kiddo-gold), so the hover stays in the same hue family,
              // just slightly darker. active:scale stays for tap feedback.
              className="hidden md:flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-white bg-[rgb(184,121,26)] transition-all hover:bg-[rgb(155,99,17)] focus-visible:bg-[rgb(155,99,17)] focus-visible:outline-none active:scale-[0.97]"
              style={{ letterSpacing: "-0.01em" }}
              data-testid="header-share-link"
            >
              {/* Share2 (Lucide 3-prong) — converged here from a custom inline
                  iOS-style arrow-up SVG that diverged from every other share
                  button in the app. One icon, one job, used consistently. */}
              <Share2 size={12} strokeWidth={2} />
              {/* Compound copy uses the kid's first name when known, fallback
                  to "Share gift link" otherwise. Addresses the financial-
                  ambiguity concern (stock "share" vs link-share action) by
                  adding the object — "Share Emma's link" reads as the
                  verb-action, not the stock noun. See locked rule in
                  feedback_share_vs_gift_distinction.md ("approved
                  adjustment if the generic-feel concern persists"). */}
              {isOwnerMode
                ? "Share your link"
                : activeFund.recipientFirstName
                  ? `Share ${capFirst(activeFund.recipientFirstName)}'s link`
                  : "Share gift link"}
            </button>
          )}
        </div>
      </motion.header>

      <NotificationsPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      {headerSharePages.length > 0 && (
        <ShareModal
          open={headerShareOpen}
          onClose={() => setHeaderShareOpen(false)}
          pages={headerSharePages}
          recipientName={capFirst(activeFund?.recipientFirstName) || activeFund?.name || "your child"}
          snapshotHref={activeFund?.id ? `/fund/${activeFund.id}/snapshot` : undefined}
          recipientIsOwner={Boolean((activeFund as any)?.transferredAt)}
        />
      )}
    </>
  );
}
