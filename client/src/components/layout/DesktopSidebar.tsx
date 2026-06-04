import { Link, useLocation, useSearch } from "wouter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, BookOpen, Activity, LogOut, ShieldCheck, ChevronDown, Check, Plus, ChevronRight, Settings as SettingsIcon, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { haptic } from "@/lib/haptics";
import { prefetchDashboard, prefetchMemoryBook, prefetchActivity } from "@/lib/prefetch";
import { tapActiveNavScrollToTop } from "@/lib/scroll-to-element";
import { ACTIVE_FUND_CHANGE_EVENT, ADD_FUND_EVENT, getActiveFundId, setActiveFundId } from "@/hooks/use-active-fund";
import { isHouseholdScopedPath, isUserScopedPath, shouldSuppressFundChrome, shouldHidePrimaryNav } from "@/lib/page-scope";
import { readLastAppLocation, formatBackLabel, backTargetHref } from "@/lib/last-location";
import { capFirst } from "@/lib/format-name";
import { Logo } from "@/components/ui/logo";
import { toast } from "@/hooks/use-toast";
import type { Fund, Event } from "@shared/schema";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { useNotificationUnreadCount } from "@/components/NotificationsPanel";
import { useMemoryUnreadCount } from "@/pages/MemoryBook";

export function DesktopSidebar() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [fundMenuOpen, setFundMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const fundMenuRef = useRef<HTMLDivElement | null>(null);

  // Hover-prefetch: when the parent mouseovers a nav link, kick off the
  // destination's primary data query so by the time they click, the page
  // renders from cache. Cheap (network only fires once per page session
  // until staleTime expires) and risk-free (no UI changes).
  const handleNavHover = useCallback((href: string, fundId?: string) => {
    if (href.startsWith("/dashboard") || href === "/") {
      prefetchDashboard(queryClient, fundId);
    } else if (href.startsWith("/memory") && fundId) {
      prefetchMemoryBook(queryClient, fundId);
    } else if (href.startsWith("/activity")) {
      prefetchActivity(queryClient, 50);
    }
  }, [queryClient]);

  const hiddenPaths = ["/checkout", "/get-started", "/onboard", "/activate", "/login", "/claim", "/give", "/gift", "/fund/"];
  const shouldHide = hiddenPaths.some(path => location.startsWith(path));
  const isHome = location === "/";
  const isPublicPage =
    isHome ||
    location.startsWith("/faq") ||
    location.startsWith("/about") ||
    location.startsWith("/legal") ||
    location.startsWith("/how-it-works") ||
    location.startsWith("/pricing") ||
    location.startsWith("/blog") ||
    location.startsWith("/stories") ||
    location.startsWith("/security") ||
    location.startsWith("/kid/");

  const enabled = isAuthenticated && !shouldHide && !isPublicPage;

  const { data: funds = [] } = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      writeLocalCache(LOCAL_CACHE_KEYS.funds, data);
      return data;
    },
    initialData: () => readLocalCache<Fund[]>(LOCAL_CACHE_KEYS.funds),
    initialDataUpdatedAt: 0,
    enabled,
    staleTime: 30000,
    refetchOnMount: "always",
  });

  // Active fund id is held in state + kept in sync with the global
  // ACTIVE_FUND_CHANGE_EVENT. Without this listener, switching funds via
  // AppHeader on a page that doesn't change the URL (e.g. /activity,
  // /settings) leaves the sidebar's Memory link and unread dot scoped to
  // the previous fund. URL ?fund= still wins when present (Dashboard's
  // canonical pattern); the listener is the localStorage-driven fallback.
  const [storedFundId, setStoredFundId] = useState<string>(() => getActiveFundId());
  useEffect(() => {
    // Parameter typed as `globalThis.Event` to disambiguate from the
    // schema `Event` (gifting event row) imported above.
    const handler = (e: globalThis.Event) => {
      const newId = (e as CustomEvent<{ id: string }>).detail?.id;
      if (typeof newId === "string") setStoredFundId(newId);
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  const selectedFundId = new URLSearchParams(search).get("fund") || storedFundId || "";
  // Defensive: funds can be null/undefined when the API errors out
  // (initialData reads from local cache which may serialize JSON
  // null; the queryFn falls back to [] on non-OK responses but
  // initialData can land first). Wrap with (?? []) so the .find /
  // [0] calls never crash the sidebar — a 500 from /api/funds
  // should degrade to "no active fund," not bring down the chrome
  // and bubble to AppErrorBoundary. Caught after the
  // 2026-05-14 connection-drop spiral, where the sidebar crash
  // amplified a recoverable API failure into a full-page
  // error-boundary state.
  const safeFunds = funds ?? [];
  const activeFund = (selectedFundId ? safeFunds.find((f) => f.id === selectedFundId) : null) ?? safeFunds[0] ?? null;
  const memoryBookHref = activeFund ? `/memory/${activeFund.id}` : "/memory";
  // Scope tiers — household (/funds) and user-scoped (/account)
  // both suppress per-fund affordances; they differ in whether the
  // sidebar fund-switcher card stays visible.
  //   household: card stays as "Your funds" entry-point (drill-in)
  //   user: card hidden entirely (active fund is irrelevant)
  // See client/src/lib/page-scope.ts + project_chrome_scope_tiers.md.
  const isFundsOverview = isHouseholdScopedPath(location);
  const isUserScoped = isUserScopedPath(location);
  const suppressFundChrome = shouldSuppressFundChrome(location);
  // Stricter than suppressFundChrome — on /account specifically, the
  // four primary nav items (Home / Memory Book / Activity / Settings)
  // are ALL fund-scoped destinations, and showing them on a page
  // that's user-orthogonal reads as scope-mismatched. Replace with
  // a single context-aware Back link. See project_chrome_scope_tiers.md.
  const hideNav = shouldHidePrimaryNav(location);
  // Back target + label come from the session-recorded last
  // non-/account location (recorded by AppHeader on every change).
  // Memory Book → Account → Back routes to Memory Book; Dashboard
  // → Account → Back routes to Dashboard. Falls back to active
  // fund's home for cold deep-links.
  const lastLocation = hideNav ? readLastAppLocation() : null;
  const backHref = backTargetHref(lastLocation, activeFund?.id ?? null);
  const backLabel = formatBackLabel(lastLocation, capFirst(activeFund?.recipientFirstName) || null);

  // Unread counts for the sidebar nav dots — same hooks the bottom-nav
  // uses, so the two surfaces stay in lockstep. Mark-as-read on either
  // surface clears the dot on both. Memory dot is per-fund; Activity
  // dot reflects active-fund scope already inside the hook.
  const sidebarActivityUnread = useNotificationUnreadCount();
  const sidebarMemoryUnread = useMemoryUnreadCount(activeFund?.id);

  const childName = capFirst(activeFund?.recipientFirstName) || null;
  // Post-handoff adult owner: flips sidebar fund labels to "Your Fund"/"your" and hides
  // Kid View (a custodian->child feature that doesn't apply once the owner IS the adult).
  const isOwnerMode = Boolean((activeFund as any)?.transferredAt && (activeFund as any)?.accessRole === "owner");
  const fundSlug = (activeFund as any)?.slug || null;

  // Share the SAME query key as Dashboard (no "-sidebar" suffix) so any
  // invalidation triggered from the Dashboard (e.g. after the parent
  // approves/declines a teen suggestion, or saves new kid-view settings)
  // also refreshes the sidebar's view of the same data. Two separate cache
  // keys meant the sidebar's "X new suggestions" badge would lag behind
  // the actual state until the 60s staleTime elapsed.
  const { data: kidViewSettings } = useQuery<any>({
    queryKey: ["/api/funds", activeFund?.id, "kid-view-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFund!.id}/kid-view-settings`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    // Don't even fire for a HANDED-OFF fund (transferredAt) or one the viewer
    // only PREVIOUSLY owned — Kid View no longer applies, and the request 403'd
    // (logging a console error) since the parent no longer owns it. 2026-06-04.
    enabled: enabled
      && !!activeFund?.id
      && !(activeFund as any)?.transferredAt
      && (activeFund as any)?.accessRole !== "previous_owner",
    staleTime: 60_000,
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });

  const featuredEvent = useMemo(() => {
    if (!activeFund?.id) return null;
    const active = events.filter((e) => e.fundId === activeFund.id && e.status === "active" && !(e as any).isPermanent);
    if (!active.length) return null;
    // prefer the one with the soonest event date, fall back to most recently created
    const withDate = active.filter((e) => (e as any).eventDate);
    if (withDate.length) {
      return withDate.sort((a, b) => new Date((a as any).eventDate).getTime() - new Date((b as any).eventDate).getTime())[0];
    }
    return active[0];
  }, [events, activeFund]);

  const getFundValue = (fund: Fund | null) =>
    fund
      ? parseFloat(String(fund.balance || "0")) +
        parseFloat(String((fund as any).pendingBalance || "0")) +
        parseFloat(String((fund as any).cashBalance || "0"))
      : 0;
  const fundValue = getFundValue(activeFund);
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

  const selectFund = (fund: Fund) => {
    setActiveFundId(fund.id);
    setFundMenuOpen(false);
    haptic("selection");
    if (location.startsWith("/memory")) setLocation(`/memory/${fund.id}`);
    else if (location.startsWith("/dashboard")) setLocation(`/dashboard?fund=${fund.id}`);
    // From /funds the implicit intent of picking a kid is "open that
    // kid's fund" — same semantics as the page-body "Open fund" CTA
    // on each card. Without this, picking from the sidebar dropdown
    // silently switches activeFundId but leaves the parent on /funds,
    // which reads as a no-op.
    else if (isFundsOverview) setLocation(`/dashboard?fund=${fund.id}`);
  };

  const handleAddFund = () => {
    setFundMenuOpen(false);
    haptic("selection");
    if (!location.startsWith("/dashboard")) setLocation("/dashboard");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(ADD_FUND_EVENT)), 0);
  };

  const handleShareLink = useCallback(() => {
    haptic("selection");
    if (!fundSlug) {
      toast({ title: "No gift link yet", description: "Add your child's details to generate a gift link." });
      return;
    }
    // GlobalShareModal listens for this event at the App level, so the modal
    // opens inline on whatever page the parent is on (Memory Book, Activity,
    // Settings, etc.) — no detour through Dashboard. Was previously
    // setLocation("/dashboard?openShare=1") which forced a route change first.
    window.dispatchEvent(new CustomEvent("kiddo:open-share-modal"));
  }, [fundSlug]);

  useEffect(() => {
    if (!fundMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!fundMenuRef.current?.contains(event.target as Node)) setFundMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFundMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [fundMenuOpen]);

  if (shouldHide || isPublicPage || isLoading || !isAuthenticated) return null;

  const navItems = [
    {
      href: "/dashboard",
      icon: Home,
      // Generic "Home" on any non-fund-scoped surface (household
      // /funds or user-scoped /account). The kid's first name in
      // this slot reads as a lie anywhere the user isn't actually
      // inside that kid's surface. Matches the MobileNav fix from
      // the chrome-scope-tier rollout — DesktopSidebar was missed.
      // Clicking still drills into the last-active fund's
      // Dashboard.
      label: suppressFundChrome ? "Home" : (isOwnerMode ? "Your Fund" : capFirst(activeFund?.recipientFirstName) || "Home"),
      // isActive is ONLY true on /dashboard itself. /age-18-plan was
      // previously included here to visually mark "you're inside
      // Emma's section" while on the age-18-plan sub-page, but that
      // broke the click semantics: the sidebar item's click handler
      // treats `isActive` as "scroll to top of CURRENT page" instead
      // of navigating. So from /age-18-plan, clicking "Emma" would
      // scroll-to-top of the age-18-plan page rather than navigate
      // to /dashboard, which is the user's actual intent (and the
      // expectation that flagged this 2026-05-26). Per-sub-page
      // visual cues for "you're in the fund section" live elsewhere
      // (AppHeader's fund dropdown shows the active fund); the
      // sidebar item's job is "click = take me home." Same applies
      // to /settings, /activity, /memory — those have their own
      // sidebar items with their own isActive matchers, so the
      // dashboard item doesn't need to mirror them.
      isActive: location === "/dashboard" || location.startsWith("/dashboard?") || location.startsWith("/dashboard/"),
    },
    {
      href: memoryBookHref,
      icon: BookOpen,
      label: "Memory Book",
      isActive: location.startsWith("/memory"),
    },
    {
      href: "/activity",
      icon: Activity,
      label: "Activity",
      isActive: location.startsWith("/activity"),
    },
    // Settings sits after Activity, mirroring the mobile bottom-nav
    // rightmost slot. Routes to /settings (the canonical control-panel
    // surface — fund / billing / privacy / account all live there),
    // not /account, so a tap on the gear lands on the gear screen.
    {
      href: "/settings",
      icon: SettingsIcon,
      label: "Settings",
      isActive: location.startsWith("/settings"),
    },
  ];

  // Quick Links is a per-fund cluster (share / gifter page / Kid
  // View / new occasion / featured event). Suppress on ANY non-fund
  // -scoped surface (household /funds AND user-scoped /account) —
  // there's no implicit "active kid" being operated on, so an
  // active Share quick-link there silently fires Emma's link, same
  // stealth-context-switch foot-gun the AppHeader Share button has.
  const quickLinks = suppressFundChrome ? [] : [
    activeFund && {
      id: "share",
      // Compound copy disambiguates from the financial-noun reading
      // of "share" (stock-share). "Share Emma's link" reads as the
      // verb-action. See feedback_share_vs_gift_distinction.md.
      label: copiedLink
        ? "Copied!"
        : isOwnerMode
          ? "Share your link"
          : activeFund.recipientFirstName
            ? `Share ${capFirst(activeFund.recipientFirstName)}'s link`
            : "Share gift link",
      onClick: handleShareLink,
      href: null,
    },
    fundSlug && {
      id: "gifter-page",
      // Same-tab navigation matches every other Quick Link (Share, Kid's
      // View, New occasion, active occasion). Opening the gifter page in
      // a new tab broke the row's behavioral consistency — the only
      // affordance that punched the user out to a new window. The gifter
      // page is a real route in the SPA, not an external destination, so
      // setLocation is the correct semantics.
      label: "View gifter page",
      href: `/${fundSlug}`,
      external: false,
      onClick: null,
    },
    activeFund?.id && !isOwnerMode && !(activeFund as any)?.transferredAt && (activeFund as any)?.accessRole !== "previous_owner" && {
      id: "kid-view",
      label: childName ? `${childName}'s View` : "Kid's View",
      href: null,
      external: false,
      onClick: () => {
        if (location.startsWith("/dashboard")) {
          window.dispatchEvent(new CustomEvent("kiddo:open-kid-view-config"));
        } else {
          setLocation("/dashboard?openKidView=1");
        }
      },
    },
    activeFund?.id && {
      id: "new-occasion",
      label: "New occasion",
      href: null,
      external: false,
      onClick: () => window.dispatchEvent(new CustomEvent("kiddo:create-event")),
    },
    featuredEvent && {
      id: "active-event",
      label: featuredEvent.name || "Active occasion",
      // Route to the actual gift page for this event (/{fundSlug}/{eventSlug}),
      // NOT /dashboard?fund=ID. The previous /dashboard route just switched the
      // active fund and went home — it never opened the event itself, which is
      // the whole point of a "quick link to active occasion." Falls back to
      // dashboard only when slugs are somehow missing (legacy data).
      href: activeFund?.slug && (featuredEvent as any).slug
        ? `/${activeFund.slug}/${(featuredEvent as any).slug}`
        : `/dashboard?fund=${activeFund?.id}`,
      external: false,
      onClick: null,
    },
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    href: string | null;
    external?: boolean;
    onClick: (() => void) | null;
  }>;

  return (
    <aside
      className="kiddo-sidebar hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col bg-white"
      style={{ borderRight: "1px solid rgba(26,23,16,0.10)" }}
      data-testid="desktop-sidebar"
    >
      {/* Logo. Wordmark is solid evergreen — the gradient-text version drifted
          from the no-AI-slop guideline (no gradient bleeds) AND from the Home
          page's plain wordmark. Brand identity belongs in the Logo mark itself;
          the wordmark just labels it. */}
      <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: "1px solid rgba(26,23,16,0.06)" }}>
        <Logo size="md" className="text-foreground" showWordmark={false} />
        <div>
          <div
            className="font-heading text-[21px] font-bold text-[hsl(var(--kiddo-evergreen))]"
            style={{ letterSpacing: "-0.3px", lineHeight: 1.1 }}
          >
            Kiddo
          </div>
          {/* Tagline "Gifts that last." removed 2026-05-12. Marketing-tone
              copy fails the Mario-star test in ambient app chrome (fires on
              every page → becomes wallpaper). The locked confirmation
              pattern ("gifts that actually last 🌱" per
              project_confirmation_screen_pattern.md) fires the tagline-feel
              contextually at success moments where it earns its weight.
              Apple-Settings register for the parent surface keeps app chrome
              minimal — iOS Settings doesn't tagline itself; the wordmark
              alone is the identity. Tagline still lives on marketing pages
              (Compare, Blog meta) and the public GiftSuccess confirmation —
              those are the appropriate contexts. */}
        </div>
      </div>

      {/* Fund switcher card. Visible on every fund-scoped page AND on
          /funds itself (the household-glance surface): on /funds the
          card renders in its "Your funds 🌱 · N funds" form, dropdown
          lets the parent drill into any kid without leaving the
          sidebar, which matches the page's launching-pad purpose.
          Hidden only on /account — there the user is operating on
          themselves, no implicit active kid, so a sidebar kid-picker
          would read as scope-mismatched. Earlier pass hid the card on
          BOTH /account and /funds on a "redundant with AppHeader"
          theory, but the AppHeader trigger is a small inline ⌄ button
          while this is the load-bearing kid-switcher affordance;
          re-introduced on /funds for parity with fund-scoped pages.
          See project_chrome_scope_tiers.md. */}
      {activeFund && (!hideNav || isFundsOverview) && (
        <div className="relative px-3.5 py-3" ref={fundMenuRef}>
          <button
            type="button"
            onClick={() => { setFundMenuOpen((open) => !open); haptic("light"); }}
            style={{
              width: "100%",
              borderRadius: 16,
              padding: "11px 13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              textAlign: "left",
            }}
            // Visual state lives on className so hover/focus apply. Base is
            // the muted-evergreen tint (same as the original inline value);
            // hover bumps the tint slightly darker so the dropdown affordance
            // reads on cursor approach. Apple Settings pattern.
            className="bg-[rgb(237,244,238)] border border-[rgb(224,237,227)] transition-colors hover:bg-[rgb(224,237,227)] focus-visible:bg-[rgb(224,237,227)] focus-visible:outline-none"
            aria-expanded={fundMenuOpen}
            aria-haspopup="listbox"
            data-testid="sidebar-fund-switcher"
          >
            <div
              style={{
                width: 34, height: 34, borderRadius: 9999,
                background: isFundsOverview
                  ? "hsl(var(--kiddo-evergreen) / 0.10)"
                  : "rgb(26,61,43)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {isFundsOverview ? (
                // Household register marker — same 🌱 glyph the
                // dropdown's "Your funds" entry uses, kept consistent
                // so the same metaphor reads top-to-bottom.
                <span style={{ fontSize: 16 }}>🌱</span>
              ) : activeFund.childPhotoUrl ? (
                <img
                  src={activeFund.childPhotoUrl}
                  alt=""
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span className="text-white text-[14px] font-extrabold">{(activeFund.recipientFirstName || activeFund.name || "S").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-foreground" style={{ lineHeight: 1.2 }}>
                {isFundsOverview
                  ? "Your funds"
                  : isOwnerMode
                    ? "Your Fund"
                    : activeFund.recipientFirstName
                      ? `${capFirst(activeFund.recipientFirstName)}'s Fund`
                      : activeFund.name || "Fund"}
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-px tabular-nums">
                {isFundsOverview
                  ? `${funds.length} fund${funds.length === 1 ? "" : "s"}`
                  : formatMoney(Number.isFinite(fundValue) ? fundValue : 0)}
              </div>
            </div>
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${fundMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {fundMenuOpen && (
            <div
              className="absolute left-3 right-3 top-[calc(100%+4px)] z-50 overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-border))] bg-white shadow-[0_22px_60px_rgba(26,23,16,0.16)]"
              role="listbox"
              data-testid="sidebar-fund-dropdown"
            >
              {/* Family-plan overview entry. Same rule as the AppHeader
                  switcher: only appears when funds.length > 1 — a
                  single-fund parent doesn't need an overview surface
                  (their Dashboard IS the overview at that scale).
                  Routes to /funds. See project_funds_overview_rules.md
                  for what that surface is and isn't allowed to show. */}
              {funds.length > 1 && (
                <button
                  type="button"
                  onClick={() => { setFundMenuOpen(false); haptic("selection"); setLocation("/funds"); }}
                  className={`flex w-full items-center gap-3 border-b border-[hsl(var(--kiddo-border))] px-3 py-3 text-left transition-colors ${
                    isFundsOverview
                      ? "bg-[hsl(var(--kiddo-evergreen)/0.08)]"
                      : "hover:bg-[hsl(var(--kiddo-cream))]"
                  }`}
                  data-testid="sidebar-funds-overview-entry"
                  role="option"
                  aria-selected={isFundsOverview}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] text-sm">
                    🌱
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">Your funds</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">All {funds.length} together</p>
                  </div>
                  {isFundsOverview && <Check className="h-4 w-4 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />}
                </button>
              )}
              {funds.map((fund) => {
                // Per-fund rows show no check when the user is on the
                // household-glance surface — the "Your funds" entry up
                // top owns the selected state in that mode.
                const selected = !isFundsOverview && fund.id === activeFund.id;
                const value = getFundValue(fund);
                return (
                  <button
                    key={fund.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectFund(fund)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                      selected ? "bg-[hsl(var(--kiddo-evergreen)/0.08)]" : "hover:bg-[hsl(var(--kiddo-cream))]"
                    }`}
                    data-testid={`sidebar-fund-option-${fund.id}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen))] text-sm font-bold text-white shadow-[inset_0_-7px_14px_rgba(0,0,0,0.14)] overflow-hidden">
                      {fund.childPhotoUrl
                        ? <img src={fund.childPhotoUrl} alt="" loading="eager" decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
                        : (fund.recipientFirstName || fund.name || "F").slice(0, 1).toUpperCase()
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {fund.recipientFirstName ? `${capFirst(fund.recipientFirstName)}'s Fund` : fund.name || "Fund"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {formatMoney(Number.isFinite(value) ? value : 0)}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleAddFund}
                className="flex w-full items-center gap-3 border-t border-[hsl(var(--kiddo-border))] px-3 py-3 text-left text-[13px] font-semibold text-[hsl(var(--kiddo-evergreen))] transition-colors hover:bg-[hsl(var(--kiddo-cream))]"
                data-testid="sidebar-add-fund"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.08)]">
                  <Plus className="h-4 w-4" />
                </span>
                Add child fund
              </button>
            </div>
          )}
        </div>
      )}

      {/* Back single affordance on /account. Context-aware target +
          label: returns the user to whatever non-/account page they
          came from (Memory Book → Account → Back lands on Memory
          Book). Falls back to active fund's home on cold deep-link
          entry. See client/src/lib/last-location.ts.
          Scoped to /account specifically (isUserScoped). /funds also
          has hideNav = true but is a launching pad, not a settled
          editing surface — "Back to [last page]" is vestigial there
          and was misreading as "Back to Settings" when the parent
          drilled in from /settings. The sidebar fund-picker
          re-introduced above is the right affordance for /funds. */}
      {isUserScoped && (
        <nav className="px-2.5 pt-3 pb-2">
          <Link href={backHref}>
            <button
              type="button"
              onClick={() => haptic("selection")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
              // Base + hover both via className so Tailwind can drive the
              // pseudo-class. Same audit as the rest of the sidebar:
              // inline `background` killed the hover affordance.
              className="bg-[rgb(237,244,238)] text-[rgb(26,61,43)] border border-[rgb(224,237,227)] transition-colors hover:bg-[rgb(224,237,227)] focus-visible:bg-[rgb(224,237,227)] focus-visible:outline-none"
              data-testid="sidebar-back-to-home"
            >
              <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} strokeWidth={2} />
              {backLabel}
            </button>
          </Link>
        </nav>
      )}

      {/* Main nav */}
      {!hideNav && (
      <nav className="px-2.5 pt-1 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Same unread-dot logic as the mobile bottom-nav: Activity
          // and Memory each get a small gold dot when there's
          // something new since the last visit, hidden when the tab
          // is already active. Dashboard intentionally has no dot
          // (it's a command center, not a feed — see MobileNav for
          // the rationale comment). Counts ride along on the right
          // edge of the row when > 0, in the same evergreen pill
          // shape the bell badge in AppHeader uses.
          const isActivityNav = item.href === "/activity";
          const isMemoryNav = item.href.startsWith("/memory");
          const unreadCount = isActivityNav
            ? sidebarActivityUnread
            : isMemoryNav
              ? sidebarMemoryUnread
              : 0;
          const showDot = unreadCount > 0 && !item.isActive;
          return (
            <Link key={item.href} href={item.href}>
              <button
                type="button"
                onClick={(e) => {
                  // If user is already on this page, treat the click as
                  // "scroll to top + clear deep-link params" instead of a
                  // re-navigation. Standard iOS/Twitter pattern that gives
                  // a "fresh landing" feel without an actual page reload.
                  if (item.isActive) {
                    e.preventDefault();
                    haptic("selection");
                    tapActiveNavScrollToTop(true, item.href, setLocation);
                    return;
                  }
                  haptic("selection");
                }}
                onMouseEnter={() => !item.isActive && handleNavHover(item.href, activeFund?.id)}
                onFocus={() => !item.isActive && handleNavHover(item.href, activeFund?.id)}
                // Hover + focus-visible affordance lives on the className so
                // Tailwind's :hover / :focus-visible pseudo-classes can apply.
                // Apple Settings macOS parity: muted-foreground rows tint to
                // cream on hover; the active row keeps the evergreen fill.
                // Both states get the same shift on keyboard focus.
                //
                // The 3px evergreen left-rail indicator that previously
                // marked the active tab was removed 2026-05-20. It was a
                // productivity-app pattern (Slack, VS Code, Discord) that
                // drifted into the codebase outside the locked register.
                // Apple Settings does not use left-rail indicators; it
                // uses bg fill plus text color, period. The codebase's
                // repeated lock to calm-Apple-Settings register argued
                // against the rail. Removing it also dropped one of five
                // stacked active-state cues (bg fill + text color + font
                // weight + icon stroke were already plenty); the fifth
                // cue was redundant. The "curved bracket" visual effect
                // some users noticed was a side effect of rounded-xl
                // plus border-l-3px, not an intentional design. See
                // feedback_sidebar_left_rail_removed.md.
                className={`flex w-full items-center gap-2.5 px-3 py-[9px] mb-0.5 rounded-xl text-sm transition-colors outline-none cursor-pointer ${
                  item.isActive
                    ? "bg-[rgb(237,244,238)] text-[rgb(26,61,43)] font-bold"
                    : "bg-transparent text-[rgb(111,104,96)] font-medium hover:bg-[hsl(var(--kiddo-cream))] hover:text-foreground focus-visible:bg-[hsl(var(--kiddo-cream))] focus-visible:text-foreground"
                }`}
                data-testid={`sidebar-nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                <Icon size={17} strokeWidth={item.isActive ? 2.2 : 1.8} />
                <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                {showDot && (
                  <span
                    aria-label={`${unreadCount} unread`}
                    data-testid={`sidebar-unread-${item.label.toLowerCase().replace(" ", "-")}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      padding: "0 6px",
                      fontSize: 10,
                      fontWeight: 800,
                      background: "hsl(var(--kora-gold))",
                      color: "white",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>
          );
        })}
      </nav>
      )}

      {/* Quick links */}
      {quickLinks.length > 0 && (
        <div className="px-2.5 pb-3">
          <div style={{ height: 1, background: "rgba(26,23,16,0.06)", marginBottom: 12 }} />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgb(155,144,136)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
              paddingLeft: 12,
            }}
          >
            Quick links
          </div>
          {quickLinks.map((link) => {
            // Plain text rows (no `→` glyph prefix). The arrow read as a
            // placeholder bullet AND conflicted with the same character used
            // as a CTA arrow elsewhere in the app ("View →"). Apple-Settings
            // register: clean labels, hover state carries the affordance.
            // Link semantic is already in the words ("Share", "View gifter
            // page") — no icon needed at this density.
            //
            // Hover/focus affordance moved out of inline style: the previous
            // inline `background: "none"` and `color: "rgb(111,104,96)"`
            // had higher CSS specificity than the Tailwind `hover:bg-...`
            // utility on the className, so the hover was silently dead.
            // The user surfaced this audit. Base color + background now
            // live on the className alongside the hover/focus states so
            // CSS can fully drive transitions. Layout (padding, radius)
            // stays inline because there's no visual-state fork on it.
            const content = (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  haptic("selection");
                  if (link.onClick) {
                    link.onClick();
                  } else if (link.href && link.external) {
                    window.open(link.href, "_blank", "noopener");
                  } else if (link.href) {
                    setLocation(link.href);
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12.5,
                  padding: "6px 12px",
                  borderRadius: 8,
                }}
                className="bg-transparent text-[rgb(111,104,96)] transition-colors hover:bg-[hsl(var(--kiddo-cream))] hover:text-foreground focus-visible:bg-[hsl(var(--kiddo-cream))] focus-visible:text-foreground focus-visible:outline-none"
                data-testid={`sidebar-quick-${link.id}`}
              >
                {link.label}
              </button>
            );
            return content;
          })}
        </div>
      )}

      {/* Flex spacer */}
      <div className="flex-1" />

      {/* Mascot/tagline/regulatory widget removed 2026-05-12. Three locked
          rules said each piece was wrong-shape:
          - Mascot image: Mario-star failure (decorative on every screen)
          - "Growing for the future.": AI-slop tagline per
            feedback_no_marketing_teaser_quotes.md (same shape as the
            "Gifts that last." line deleted from the sidebar header
            earlier this session)
          - "Member FINRA/SIPC · DriveWealth, LLC": buried in 0.5-opacity
            text, contradicting project_brokerage_as_trust_feature.md
            ("celebrated in the hero, not buried"). The legitimate
            regulatory disclosure lives in Footer.tsx + TrustMicroStrip
            (ux-foundations.tsx) + GiftCheckout/GiftSuccess/TaxDocuments
            in-context surfaces. Sidebar version was redundant +
            counter-productive. */}

      {/* Profile footer */}
      <div style={{ borderTop: "1px solid rgba(26,23,16,0.10)", padding: "12px 14px 14px" }}>
        {user && (
          <Link href="/account">
            <button
              type="button"
              onClick={() => haptic("selection")}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[hsl(var(--kiddo-cream))]"
              style={{ marginBottom: 9 }}
              data-testid="sidebar-user-profile"
            >
              <div
                style={{
                  width: 34, height: 34, borderRadius: 9999, flexShrink: 0,
                  background: "rgb(238,231,220)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  border: "1.5px solid rgba(26,23,16,0.10)",
                }}
              >
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgb(44,39,32)" }}>
                    {user.firstName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-foreground truncate" style={{ lineHeight: 1.2 }}>
                  {user.firstName || user.email?.split("@")[0] || "Account"}
                  {(user as any).preferredName ? <span className="font-normal text-muted-foreground"> ({(user as any).preferredName})</span> : null}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
              </div>
              <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
            </button>
          </Link>
        )}
        {user?.isAdmin && (
          <Link href="/admin">
            <div
              onClick={() => haptic("selection")}
              className={`mt-1.5 flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer ${
                location.startsWith("/admin")
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              data-testid="sidebar-admin-utility"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin tools</span>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}
