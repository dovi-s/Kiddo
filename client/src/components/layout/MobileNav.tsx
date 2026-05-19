import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, BookOpen, Settings as SettingsIcon, Share2, CalendarDays } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { prefetchDashboard, prefetchMemoryBook, prefetchActivity } from "@/lib/prefetch";
import { tapActiveNavScrollToTop } from "@/lib/scroll-to-element";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { ACTIVE_FUND_CHANGE_EVENT, getActiveFundId } from "@/hooks/use-active-fund";
import { isHouseholdScopedPath, isUserScopedPath, shouldSuppressFundChrome, shouldHidePrimaryNav, isFundSubPage } from "@/lib/page-scope";
import type { Fund } from "@shared/schema";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { useNotificationUnreadCount } from "@/components/NotificationsPanel";
import { useMemoryUnreadCount } from "@/pages/MemoryBook";

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Touchstart-prefetch: mobile has no hover, so prefetch on touchstart
  // (fires before click → release → navigation, ~50-150ms head start). Same
  // surface coverage as DesktopSidebar's hover-prefetch.
  const handleNavTouch = (href: string, fundId?: string) => {
    if (href === "/dashboard") prefetchDashboard(queryClient, fundId);
    else if (href.startsWith("/memory") && fundId) prefetchMemoryBook(queryClient, fundId);
    else if (href === "/activity") prefetchActivity(queryClient, 50);
    // /settings has no dedicated prefetcher — page is small + uses session
    // data already in cache from auth.
  };

  const hiddenPaths = ["/checkout", "/get-started", "/onboard", "/activate", "/login", "/claim", "/give", "/fund/"];
  const shouldHide = hiddenPaths.some(path => location.startsWith(path));
  const isPublicPage =
    location === "/" ||
    location.startsWith("/faq") ||
    location.startsWith("/about") ||
    location.startsWith("/legal") ||
    location.startsWith("/how-it-works") ||
    location.startsWith("/pricing") ||
    location.startsWith("/blog") ||
    location.startsWith("/stories") ||
    location.startsWith("/security") ||
    location.startsWith("/kid/");

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
    enabled: isAuthenticated && !shouldHide && !isPublicPage,
    staleTime: 30000,
    refetchOnMount: "always",
  });

  // Unread count for the Activity tab badge — same source the bell uses, so
  // both stay in sync (mark-all-read in NotificationsPanel clears both). Hook
  // is called BEFORE the early return below so hook order stays stable
  // across renders.
  const activityUnreadCount = useNotificationUnreadCount();
  // Active fund id is held in state + kept in sync with the global
  // ACTIVE_FUND_CHANGE_EVENT. Without this listener, switching funds via
  // AppHeader on a page that doesn't change the URL (e.g. /activity,
  // /settings) leaves MobileNav's Memory link, Share URL, and unread
  // dot scoped to the previous fund.
  const [storedFundId, setStoredFundId] = useState<string>(() => getActiveFundId());
  useEffect(() => {
    const handler = (e: Event) => {
      const newId = (e as CustomEvent<{ id: string }>).detail?.id;
      if (typeof newId === "string") setStoredFundId(newId);
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  // Unread count for the Memory tab — narrowly scoped to new gifts +
  // milestones since the parent last opened the Memory Book for the
  // active fund. Voice notes from grandma, fresh community gifts, the
  // emotionally-load-bearing entries that justify pulling the parent
  // in. Parent-authored notes / photos don't count (they wrote them,
  // they know). Dashboard intentionally NOT given this dot — see the
  // discussion in the design comment at the dot render below.
  const memoryUnreadCount = useMemoryUnreadCount(storedFundId);

  if (shouldHide || isPublicPage || isLoading || !isAuthenticated) return null;
  // /account hides the bottom-nav entirely — all four tabs (Home /
  // Memory / Activity / Settings) are fund-scoped destinations and
  // showing them on a user-orthogonal page reads as a scope-
  // mismatched stealth-context-switch. The AppHeader's Back arrow
  // (added in this round) is the escape route on mobile. See
  // project_chrome_scope_tiers.md.
  if (shouldHidePrimaryNav(location)) return null;

  const activeFund = (storedFundId && funds.find((f) => f.id === storedFundId)) || funds[0] || null;
  const shareUrl = activeFund ? `${window.location.origin}/${activeFund.slug}` : "";
  const memoryHref = activeFund ? `/memory/${activeFund.id}` : "/memory";
  // Scope detection — same module as AppHeader / DesktopSidebar so
  // all three chrome surfaces agree on which tier the current page
  // belongs to. household (/funds) AND user-scoped (/account) both
  // suppress the Share tab and use a generic "Home" label.
  const isFundsOverview = isHouseholdScopedPath(location);
  const isUserScoped = isUserScopedPath(location);
  const suppressFundChrome = shouldSuppressFundChrome(location);
  // Order: [Home, Memory, Share, Activity, Settings]. Share lives in the
  // center (slot 3 of 5) — the iOS / Robinhood / Twitter / Instagram
  // action-bar pattern. The whole product is "share the link, get gifts,"
  // so the only transactional item belongs dead-center; the four browse
  // surfaces flank it. Centering the gold pill also balances the nav
  // visually instead of weighting it right.
  // Rightmost slot was historically "Account" (UserCircle, /account)
  // but the destination /settings is the canonical control-panel surface
  // (fund / billing / privacy / account all live there). The label +
  // icon match the actual destination so a tap on the gear leads to the
  // gear screen, not a separate "Account" page that would be a redirect.
  const navItems = [
    {
      href: "/dashboard",
      icon: Home,
      // Generic "Home" on any non-fund-scoped page (household /funds
      // or user-scoped /account). The kid's first name in this slot
      // is misleading anywhere the user isn't actually inside that
      // kid's surface — fund context shouldn't reach into the nav
      // labels on user-scoped pages.
      label: suppressFundChrome ? "Home" : (capFirst(activeFund?.recipientFirstName) || "Home"),
    },
    { href: memoryHref, icon: BookOpen, label: "Memory" },
    // MobileNav stays tight "Share" — five tabs across the rail can't
    // fit "Share Emma's link" or "Share gift link" without overflow.
    // The bottom-nav icon-above-label pattern is too space-constrained
    // for the compound. Desktop chrome (AppHeader pill + Sidebar Quick
    // Link) uses the compound; this surface keeps the standalone
    // verb. See feedback_share_vs_gift_distinction.md "approved
    // adjustment" note for the verb/object rationale.
    { href: "__share__", icon: Share2, label: "Share" },
    { href: "/activity", icon: CalendarDays, label: "Activity" },
    { href: "/settings", icon: SettingsIcon, label: "Settings" },
  ];
  // Drop the Share tab on any non-fund-scoped surface — there is no
  // implicit "active kid" to share from on /funds (household-glance)
  // or /account (user-scoped). On both surfaces, an active Share
  // tap would silently fire the last-active fund's link — exactly
  // the stealth-context-switch foot-gun the AppHeader Share button
  // already addresses by hiding. Bottom-nav grid spaces evenly
  // across the remaining 4 items.
  const items = suppressFundChrome
    ? navItems.filter((item) => item.href !== "__share__")
    : navItems;

  // Fires the GlobalShareModal — same pop-up the desktop sidebar uses, and
  // the same modal that has the rich pre-written messages, QR, story card,
  // print flyer, and per-event share pages. Was previously a thin
  // navigator.share / clipboard fallback that gave mobile users a way worse
  // experience than desktop. The modal is mounted in App.tsx and self-fetches
  // the active fund's data on open.
  const handleShareAction = () => {
    haptic("selection");
    if (!shareUrl) {
      toast({ title: "Create a fund first", description: "Your gift link appears as soon as a fund is ready." });
      return;
    }
    window.dispatchEvent(new CustomEvent("kiddo:open-share-modal"));
  };

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mobile-nav-shell fixed inset-x-3 bottom-3 z-50 md:hidden"
    >
      <div
        className="grid items-center gap-1 px-2 py-2.5"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isShare = item.href === "__share__";
          const isActive =
            (item.href === "/dashboard" && (location === "/dashboard" || location.startsWith("/dashboard") || isFundSubPage(location))) ||
            (item.href === "/activity" && (location.startsWith("/activity") || location.startsWith("/event/"))) ||
            (item.href.startsWith("/memory") && location.startsWith("/memory")) ||
            (item.href === "/settings" && location.startsWith("/settings"));
          const Icon = item.icon;

          // Activity + Memory tabs get the unread dot when there's anything
          // new since the user last opened the respective surface. Hidden
          // when the tab is already active (tapping it clears the unread
          // state next render anyway). Same gold dot, same shape, same
          // border treatment so the two tabs read as one consistent
          // pattern. Dashboard ("Home") is deliberately excluded — it's
          // a command-center surface, not a feed; everything live there
          // is already on-screen, so an unread dot would either be noise
          // (firing on every backend change) or annoying (just "you
          // haven't visited"). Pending-attention items there surface
          // as in-page hero cards, not tab dots.
          const showActivityDot = item.href === "/activity" && activityUnreadCount > 0 && !isActive;
          const showMemoryDot = item.href.startsWith("/memory") && memoryUnreadCount > 0 && !isActive;
          const showUnreadDot = showActivityDot || showMemoryDot;
          const unreadCount = showActivityDot ? activityUnreadCount : showMemoryDot ? memoryUnreadCount : 0;

          const content = (
              <motion.div
                whileTap={{ scale: 0.9 }}
                // Spring physics on the tap — gives the press a tactile
                // bounce-back instead of the previous linear easing.
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={(e) => {
                  if (isShare) return;
                  // Tap-active-nav-to-top — same iOS pattern as the desktop
                  // sidebar. preventDefault stops Wouter's Link wrapper from
                  // re-navigating to the same path.
                  if (isActive) {
                    e.preventDefault();
                    haptic("selection");
                    // Pop-to-root: if the Home tab is logically active but
                    // the user is on a fund sub-page (Age18Plan, Projection,
                    // Tax Documents), tap navigates to /dashboard instead
                    // of just scrolling. Matches the iOS pattern where
                    // tapping the active tab pops the navigation stack to
                    // its root, not just scroll-to-top. Locked 2026-05-18.
                    if (item.href === "/dashboard" && isFundSubPage(location)) {
                      setLocation("/dashboard");
                      return;
                    }
                    tapActiveNavScrollToTop(true, item.href, setLocation);
                    return;
                  }
                  haptic("selection");
                }}
                onTouchStart={() => {
                  if (!isShare && !isActive) {
                    handleNavTouch(item.href, activeFund?.id);
                  }
                }}
                onMouseEnter={() => {
                  if (!isShare && !isActive) {
                    handleNavTouch(item.href, activeFund?.id);
                  }
                }}
                className="relative flex min-w-0 flex-col items-center justify-center rounded-2xl px-1.5 py-2 touch-target"
                style={isShare ? {
                  // Elevate the Share cell ~3px above the rail line +
                  // give the gold pill a softly stronger drop-shadow so
                  // it reads as "physically floating above the other
                  // tabs." Same visual-hierarchy lever Cash App's $
                  // button uses, just dialed restrained — no extra size,
                  // no scale tricks, just lift. The other tabs stay flat
                  // on the rail; Share is the one thing that protrudes.
                  // Touch target follows the lift; still 44px+ tappable
                  // area, just centered slightly higher.
                  transform: "translateY(-3px)",
                } : undefined}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                {/* Share gets a permanent gold pill — it's a CTA, not a
                    nav-state indicator, so it doesn't participate in the
                    sliding animation. The shadow is a touch deeper than
                    the rail's nav-shell shadow so the pill reads as
                    "lifted above the rail" instead of "inset into it." */}
                {isShare && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl bg-[hsl(var(--kora-gold))]"
                    style={{
                      boxShadow: "0 4px 12px -2px rgba(184,121,26,0.35), 0 2px 4px rgba(184,121,26,0.18)",
                    }}
                  />
                )}
                {/* Sliding active pill via shared layoutId. When the active
                    tab changes, Framer Motion automatically animates this
                    one element from its old position to the new — feels
                    like Apple Music / iOS native tab bars. Skipped on
                    Share since Share has its own pill above. */}
                {isActive && !isShare && (
                  <motion.span
                    layoutId="mobile-nav-active-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-2xl bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.10)]"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative">
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors duration-150 ${
                      isShare ? "text-[hsl(var(--kora-ink))]" : isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                    strokeWidth={isActive || isShare ? 2.5 : 1.8}
                  />
                  {showUnreadDot && (
                    <span
                      aria-label={`${unreadCount} unread`}
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--kiddo-cream))]"
                      style={{ background: "hsl(var(--kora-gold))" }}
                    />
                  )}
                </div>
                <span
                  className={`relative mt-1 max-w-full truncate text-[11px] transition-colors duration-150 ${
                    isShare ? "font-semibold text-[hsl(var(--kora-ink))]" : isActive ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </motion.div>
          );

          return isShare ? (
            <button
              key={item.href}
              type="button"
              className="min-w-0"
              aria-label="Open share modal"
              onClick={handleShareAction}
            >
              {content}
            </button>
          ) : (
            <Link key={item.href} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
