import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, BookOpen, Settings as SettingsIcon, Share2, History } from "lucide-react";
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
    else if (href === "/activity") prefetchActivity(queryClient, fundId);
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

  // ── Swipe between the main tabs (founder 2026-06-25: "swipe through the pages
  //    Theo/Memory/Activity/Settings, smooth, not a refresh"). A clear horizontal
  //    swipe on a tab surface navigates to the adjacent tab; NavTransition slides
  //    the page in. Guarded so it never fights vertical scroll, the chip-row
  //    horizontal scrollers, an open sheet, or the left-edge back gesture.
  useEffect(() => {
    const onTabSurface =
      isAuthenticated && !shouldHide && !isPublicPage && !shouldHidePrimaryNav(location);
    if (!onTabSurface || typeof window === "undefined") return;
    if (isFundSubPage(location)) return; // sub-pages aren't swipe stops

    const indexFor = (p: string) => {
      if (p.startsWith("/dashboard") || p.startsWith("/staging")) return 0;
      if (p.startsWith("/memory")) return 1;
      if (p.startsWith("/activity") || p.startsWith("/event/")) return 2;
      if (p.startsWith("/settings")) return 3;
      return -1;
    };
    const curIdx = indexFor(location);
    if (curIdx < 0) return;

    const fundId =
      (storedFundId && funds.find((f) => f.id === storedFundId)?.id) || funds[0]?.id || null;
    const tabs = ["/dashboard", fundId ? `/memory/${fundId}` : "/memory", "/activity", "/settings"];

    const inHorizontalScroller = (start: Element | null) => {
      let n: Element | null = start;
      while (n && n !== document.body) {
        if (n instanceof HTMLElement && n.scrollWidth > n.clientWidth + 4) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === "auto" || ox === "scroll") return true;
        }
        n = n.parentElement;
      }
      return false;
    };

    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { tracking = false; return; }
      const t = e.touches[0];
      // An open sheet/dialog owns gestures; the left 28px is the edge-back zone;
      // a horizontal scroller under the finger should scroll, not switch tabs;
      // a swipe-dismissable banner (the "while you were away" digest et al.) owns
      // its own sideways fling — without this, dismissing one ALSO switches tabs.
      if (
        document.querySelector('[role="dialog"]') ||
        t.clientX <= 28 ||
        inHorizontalScroller(e.target as Element) ||
        !!(e.target as Element | null)?.closest?.("[data-swipe-dismiss]")
      ) {
        tracking = false;
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return; // not a clear horizontal swipe
      const nextIdx = curIdx + (dx < 0 ? 1 : -1); // swipe left → next tab, right → prev
      if (nextIdx < 0 || nextIdx >= tabs.length) return;
      handleNavTouch(tabs[nextIdx], fundId ?? undefined);
      haptic("selection");
      setLocation(tabs[nextIdx]);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [location, funds, storedFundId, isAuthenticated, shouldHide, isPublicPage, setLocation]);

  if (shouldHide || isPublicPage || isLoading || !isAuthenticated) return null;
  // /account hides the bottom-nav entirely — all four tabs (Home /
  // Memory / Activity / Settings) are fund-scoped destinations and
  // showing them on a user-orthogonal page reads as a scope-
  // mismatched stealth-context-switch. The AppHeader's Back arrow
  // (added in this round) is the escape route on mobile. See
  // project_chrome_scope_tiers.md.
  if (shouldHidePrimaryNav(location)) return null;

  const activeFund = (storedFundId && funds.find((f) => f.id === storedFundId)) || funds[0] || null;
  // Post-handoff adult owner: the Home tab shows the generic "Home", not their own first
  // name (the tight 5-tab rail has no room for "Your Fund" without wrapping).
  const isOwnerMode = Boolean((activeFund as any)?.transferredAt && (activeFund as any)?.accessRole === "owner");
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
      label: suppressFundChrome || isOwnerMode ? "Home" : (capFirst(activeFund?.recipientFirstName) || "Home"),
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
    { href: "/activity", icon: History, label: "Activity" },
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
      className="mobile-nav-shell fixed inset-x-0 bottom-0 z-50 md:hidden"
      // Flush, edge-to-edge bottom bar (native tab-bar posture, 2026-07 — was a
      // floating pill: inset-x-3 + a bottom offset). The iOS home-indicator
      // safe-area now rides INSIDE the shell as padding-bottom (index.css) so the
      // glass background extends behind the indicator instead of leaving a gap.
      // The slide-up intro (y:100 -> 0) and the gold active-pill are unaffected.
    >
      <div
        /* py-1 (2026-06-07): the grid AND each tab both carried vertical
           padding (originally grid py-2.5 + item py-2 = ~18px each side),
           doubling into too much dead space above the icons / below the labels.
           Trimmed the grid to py-1 here AND each tab to py-1 (below); the
           `touch-target` class keeps every tab ≥44px tappable regardless, so
           the rail hugs the icons+labels without shrinking the hit area. The
           content-to-nav gap was never the issue (page pb-24 ≈ an 8px gap). */
        className="grid items-center gap-1 px-2 py-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isShare = item.href === "__share__";
          const isActive =
            (item.href === "/dashboard" && (location === "/dashboard" || location.startsWith("/dashboard") || location.startsWith("/staging") || isFundSubPage(location))) ||
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
                className="relative flex min-w-0 flex-col items-center justify-center rounded-2xl px-1.5 py-1 touch-target"
                style={isShare ? {
                  // Elevate the Share cell above the rail line + give the gold
                  // pill a softly stronger drop-shadow so it reads as
                  // "physically floating above the other tabs." Same
                  // visual-hierarchy lever Cash App's $ button uses, just dialed
                  // restrained — no extra size, no scale tricks, just lift. The
                  // other tabs stay flat on the rail; Share is the one thing
                  // that protrudes. Lift -3 → -6 → -8px (2026-06-07, founder:
                  // "a drop more even"): the shell has NO overflow:hidden, so at
                  // -8px the gold pill cleanly pokes ~4px ABOVE the rail's top
                  // edge — the FAB-breaking-the-bar look — without clipping.
                  // Lift via `top`, NOT `transform` (founder: "the button keeps
                  // lowering back down"): the cell is position:relative, and
                  // whileTap={{ scale }} owns the transform — an inline
                  // translateY would get clobbered by the tap animation and the
                  // pill would sink back to the rail. `top` is untouched by the
                  // scale, so the lift holds. touch-target keeps the 44px area.
                  top: -8,
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
                      // Deeper shadow to match the higher -8px lift — a thing
                      // floating higher casts a larger, softer shadow.
                      boxShadow: "0 8px 18px -3px rgba(184,121,26,0.42), 0 3px 6px rgba(184,121,26,0.20)",
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
                  {/* App icon stroke scale: 2.0 resting / 2.5 active — matches the
                      LabCollapse section icons so the nav reads as the same hand
                      (resting was a thinner 1.8, which is what made nav icons feel
                      "different" from the crisp section icons). Color stays role-based
                      (muted inactive / primary active / ink-gold Share). */}
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors duration-150 ${
                      isShare ? "text-[hsl(var(--kora-ink))]" : isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                    strokeWidth={isActive || isShare ? 2.5 : 2.0}
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
                  className={`relative mt-1 max-w-full truncate text-2xs transition-colors duration-150 ${
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
