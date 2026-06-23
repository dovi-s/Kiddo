import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Plus, Share2, User } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { getActiveFundId, setActiveFundId, ACTIVE_FUND_CHANGE_EVENT, ADD_FUND_EVENT } from "@/hooks/use-active-fund";
import { isHouseholdScopedPath, isUserScopedPath, shouldSuppressFundChrome, shouldHidePrimaryNav, isFundSubPage } from "@/lib/page-scope";
import { rememberAppLocation, readLastAppLocation, formatBackLabel, backTargetHref } from "@/lib/last-location";
import { capFirst } from "@/lib/format-name";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { ShareModal, type SharePage } from "@/components/ui/share-modal";
import { readFundLiveValue } from "@/lib/fund-live-value";
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
  if (location.startsWith("/events")) return "Occasions";
  if (location.startsWith("/dashboard")) return "Home";
  // /design-lab is the dashboard redesign sandbox — same AppHeader, same
  // "Home" title, so the lab's chrome matches the real dashboard while it's
  // being evaluated (2026-06-07, founder noticed the blank title). Harmless
  // after the port: the route becomes /dashboard, which already maps above.
  if (location.startsWith("/design-lab")) return "Home";
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
  // Notifications bell REMOVED 2026-06-13 (founder call). Its content was
  // redundant or re-homed: the recent-activity peek duplicated the Activity
  // ledger, and action items already render in-page (Dashboard + Activity, the
  // latter now uncapped). The only thing unique to the bell was a global unread
  // dot — the exact pull-to-check compulsion the brand rejects (the dashboard is
  // deliberately dot-free). So: Activity = the history, in-page action cards =
  // "needs you", the Activity/Memory tab dots = the gentle "new here" signal. A
  // real message center (company→user inbox) gets built when we actually send
  // statements/announcements — not before.
  const [fundPickerOpen, setFundPickerOpen] = useState(false);
  // Local share modal — opens for non-Dashboard pages where the in-page
  // (richer) Dashboard modal isn't mounted to listen for the event. Without
  // this, clicking the header Share on Memory Book / Activity / Settings
  // fires the event into the void and nothing happens.
  const [headerShareOpen, setHeaderShareOpen] = useState(false);
  const fundPickerRef = useRef<HTMLDivElement>(null);
  // queryClient drives the live fund-value read below (and previously a manual
  // header refresh button, removed 2026-06-07). Freshness is handled without a
  // manual control — SSE + 30s polling + window-focus refetch — and a manual
  // "refresh to see if it changed" button cut against the long-horizon, no-
  // daily-checking design lens (the same reason the balance was pulled from the
  // header). Mobile browsers keep native pull-to-refresh as a warm-reload escape
  // hatch; the branded version belongs in the native app's RefreshControl.
  const queryClient = useQueryClient();
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
  // The dashboard (live /dashboard + the /staging rebuild) carries its OWN hero
  // "Share … link" button, so the header Share is a redundant 2nd copy there. Hide
  // it on the dashboard, keep it on the other fund pages (Memory Book, Activity,
  // Settings) where there is no hero Share. See DASHBOARD_CHROME_PORT_SPEC.md.
  const isOnDashboard = location.startsWith("/dashboard") || location.startsWith("/staging");

  // Chameleon header: evergreen while the bar sits over the hero, cream once the
  // hero scrolls past (matches the section beneath it). Driven by an
  // IntersectionObserver on the hero element — robust against ANY scroll
  // container (the dashboard scrolls inside a div, not the window) and fires only
  // on threshold crossings, so no per-frame jitter. Defaults to evergreen until
  // the observer attaches (the hero mounts after the cold-load).
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  useEffect(() => {
    if (!isOnDashboard) { setScrolledPastHero(false); return; }
    let io: IntersectionObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attach = () => {
      const hero = document.querySelector('[data-testid="hero-card"]');
      if (!hero) { timer = setTimeout(attach, 200); return; }
      io = new IntersectionObserver(
        ([entry]) => setScrolledPastHero(!entry.isIntersecting),
        // -58px top inset = the sticky header's height: the hero stops
        // "intersecting" exactly when its bottom slides under the bar.
        { rootMargin: "-58px 0px 0px 0px", threshold: 0 },
      );
      io.observe(hero);
    };
    attach();
    return () => { if (io) io.disconnect(); if (timer) clearTimeout(timer); };
  }, [isOnDashboard, location]);
  // Evergreen hero chrome only while at the top over the hero; cream into content.
  const heroChrome = isOnDashboard && !scrolledPastHero;

  // STAGING seam fix (2026-06-23). The staging hero is a FULL-BLEED vertical
  // gradient (light bottle-green at the top -> evergreen-deep at the floor). The
  // chameleon header is a single FLAT green = the hero's TOP tone, so at rest the
  // bar reads as one surface with the hero. But as the hero scrolls UP under the
  // bar, the hero just below the 58px seam keeps darkening while the flat header
  // stays light -> a visible lighter band opens up right before the cream flip
  // (a flat color can't blend with a moving gradient). Fix: while over the
  // staging hero, drive the header background to the hero's OWN gradient color at
  // the seam line, so the bar darkens in lock-step and the seam never appears.
  // Scoped to /staging only — the live dashboard hero is a different (diagonal,
  // carded) gradient and keeps the existing flat treatment untouched.
  const isStagingHero = location.startsWith("/staging");
  const [heroSeamBg, setHeroSeamBg] = useState("hsl(158 45% 19%)");
  useEffect(() => {
    if (!isStagingHero) return;
    // Staging hero gradient stops: [pct, H, S, L]. Keep in sync with the
    // hero-card background in DashboardStaging.tsx.
    const STOPS: number[][] = [
      [0, 158, 45, 19],
      [46, 158, 49, 15],
      [100, 157, 49, 8],
    ];
    const colorAt = (frac: number) => {
      const p = Math.min(100, Math.max(0, frac * 100));
      let a = STOPS[0];
      let b = STOPS[STOPS.length - 1];
      for (let i = 0; i < STOPS.length - 1; i++) {
        if (p >= STOPS[i][0] && p <= STOPS[i + 1][0]) { a = STOPS[i]; b = STOPS[i + 1]; break; }
      }
      const t = b[0] === a[0] ? 0 : (p - a[0]) / (b[0] - a[0]);
      const h = a[1] + (b[1] - a[1]) * t;
      const s = a[2] + (b[2] - a[2]) * t;
      const l = a[3] + (b[3] - a[3]) * t;
      return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
    };
    let raf = 0;
    const update = () => {
      raf = 0;
      const hero = document.querySelector('[data-testid="hero-card"]');
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      if (r.height <= 0) return;
      // Fraction of the hero gradient sitting at the header's bottom edge (58px).
      setHeroSeamBg(colorAt((58 - r.top) / r.height));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    // Capture phase catches scrolls from the dashboard's inner scroll container
    // (it scrolls inside a div, not the window — same reason the chameleon above
    // uses an IntersectionObserver rather than a window scroll position).
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isStagingHero, location]);

  // Smooth the green<->cream FLIP in BOTH directions. The tracking above runs
  // with NO bg transition so it follows scroll EXACTLY (a 0.2s ease would lag a
  // fast flick and re-open the seam) — but that alone would make the cream->green
  // RE-ENTRY (scrolling back up into the hero) snap hard. So for one beat after
  // the chameleon flips, re-enable the 0.2s bg ease, then drop back to instant
  // tracking. Net: seam-free instant tracking over the hero + a soft fade on both
  // the exit-to-cream and the return-to-green.
  const [bgFlipping, setBgFlipping] = useState(false);
  useEffect(() => {
    if (!isStagingHero) return;
    setBgFlipping(true);
    const t = window.setTimeout(() => setBgFlipping(false), 240);
    return () => window.clearTimeout(t);
  }, [heroChrome, isStagingHero]);

  // Extend the green to the EDGES of the device when over the hero (founder:
  // "if you pull from the hero it should extend green, not white"). Two surfaces
  // the chameleon header alone didn't cover:
  //   • the iOS status-bar tint (`theme-color`) — matched to the header so the
  //     notch area is green over the hero, cream once scrolled into content;
  //   • the document (html) background — what the native rubber-band reveals when
  //     you overscroll at the top. Setting it to the hero's top tone means a pull
  //     from the dashboard STRETCHES green, seamless with the green header + hero,
  //     instead of a cream/white gap. It only ever shows on a top-overscroll (the
  //     cream body covers the rest), so normal scrolling is untouched, and every
  //     non-dashboard page keeps the cream top. (Standalone PWA locks overscroll,
  //     so there's no stretch there — the JS pull spinner handles refresh.)
  useEffect(() => {
    const HERO_TOP = "#1b4636"; // === hsl(158 45% 19%), the Gilt-Ledger bottle-green header/hero top tone
    const CREAM = "#f9f7f3";    // === the default theme-color in index.html
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", heroChrome ? HERO_TOP : CREAM);
    document.documentElement.style.backgroundColor = isOnDashboard ? HERO_TOP : "";
    // Native (Capacitor) shell: also drive the REAL OS status bar (clock / wifi /
    // battery glyphs) so they flip light over the green hero and dark on cream —
    // the per-route control a pure Safari PWA can't do, but the wrapped store app
    // can. We read the runtime-injected `window.Capacitor` global + call the
    // StatusBar plugin through its bridge — NO `@capacitor/*` import, so nothing
    // Capacitor ever enters the web bundle (an eager `import @capacitor/core`
    // white-screened the web app). In a browser/PWA `window.Capacitor` is
    // undefined → this whole block is a no-op. ("DARK" = light glyphs for the
    // dark green; "LIGHT" = dark glyphs for cream — Capacitor's Style enum values.)
    const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
    if (cap?.isNativePlatform?.()) {
      const sb = cap.Plugins?.StatusBar;
      if (sb) {
        try {
          sb.setStyle?.({ style: heroChrome ? "DARK" : "LIGHT" });
          if (cap.getPlatform?.() === "android") {
            sb.setBackgroundColor?.({ color: heroChrome ? HERO_TOP : CREAM });
          }
        } catch { /* native bridge unavailable — ignore */ }
      }
    }
    return () => {
      meta?.setAttribute("content", CREAM);
      document.documentElement.style.backgroundColor = "";
    };
  }, [heroChrome, isOnDashboard]);

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

  // On mobile the bottom nav already labels AND highlights the four primary
  // destinations (Home / Memory / Activity / Settings), so repeating the title
  // in the header is pure duplication — and it crowds the cramped mobile header,
  // squeezing the genuinely useful fund switcher. Hide it VISUALLY on mobile
  // (kept for screen readers via sr-only, so the page still has its h1) but only
  // when the fund switcher will fill the left in its place — never leave the left
  // empty. Sub-pages (Occasions, Potential, Tax Docs, New Event, the age-18 flow)
  // are NOT bottom-nav tabs, so their title stays: it's the only "where am I"
  // there, and they carry a Back arrow. Desktop always shows the title — the
  // sidebar is the nav there, and the header title orients.
  const isPrimaryTabRoot =
    location.startsWith("/dashboard") ||
    location.startsWith("/design-lab") ||
    location.startsWith("/memory") ||
    location.startsWith("/activity") ||
    location.startsWith("/settings");
  const hideTitleOnMobile = isPrimaryTabRoot && !!withFund && !isUserScoped;

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
  // Tax Documents launches from Settings → Money/Account (+ the LegalDocuments
  // card), never from a primary tab. But /settings is skip-saved from the journey
  // anchor (so /account's Back doesn't read "Back to Settings"), which makes the
  // generic last-location Back overshoot to the prior anchor — e.g. Activity, which
  // has nothing to do with taxes. Point Tax Documents' Back at Settings, its real
  // parent. (Other fund sub-pages — Projection, Age-18 Plan — launch from Dashboard,
  // which IS a saved anchor, so they keep the context-aware last-location target.)
  const isTaxDocsPage = location.startsWith("/tax-documents");
  const backHref = isTaxDocsPage ? "/settings" : backTargetHref(lastLocation, activeFund?.id ?? null);
  const backLabel = isTaxDocsPage ? "Back to Settings" : formatBackLabel(lastLocation, capFirst(activeFund?.recipientFirstName) || null);
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
  // Account-type/status badge ("UTMA · Active") also suppressed on the dashboard: the
  // hero owns status there (and the staging hero deliberately drops the account type for
  // active funds), so the header badge was a chrome echo. Kept on the other fund pages
  // (Memory Book / Activity / Settings) where there's no hero. See DASHBOARD_CHROME_PORT_SPEC.md.
  const badgeText = suppressFundChrome || isOnDashboard
    ? ""
    : displayAccountType && statusLabel
      ? `${displayAccountType} · ${statusLabel}`
      : statusLabel;

  return (
    <>
      <motion.header
        className="sticky top-0 z-50"
        style={{
          // Chameleon: evergreen + no border while over the hero (matches the
          // hero's top gradient tone EXACTLY, no blur so it reads identical),
          // cream + blur + hairline once scrolled into the content. Transitions
          // smoothly between the two as you scroll. Other pages: always cream.
          // backgroundColor (not the `background` shorthand) so the green↔cream
          // change actually ANIMATES — browsers snap shorthand transitions but
          // smoothly interpolate background-color.
          backgroundColor: heroChrome
            ? (isStagingHero ? heroSeamBg : "hsl(158 45% 19%)")
            : "hsl(var(--kiddo-cream) / 0.94)",
          backdropFilter: heroChrome ? "none" : "blur(20px)",
          WebkitBackdropFilter: heroChrome ? "none" : "blur(20px)",
          borderBottom: heroChrome ? "1px solid transparent" : "1px solid hsl(var(--kiddo-ink) / 0.10)",
          // While tracking the staging hero gradient, the bg must follow scroll
          // INSTANTLY (a 0.2s ease would lag the scroll and re-open the seam on a
          // fast flick). The cream flip + every other page still animate over 0.2s.
          transition: (isStagingHero && heroChrome && !bgFlipping)
            ? "border-color 0.2s ease-out"
            : "background-color 0.2s ease-out, border-color 0.2s ease-out",
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
              <ArrowLeft size={17} strokeWidth={2} />
            </button>
          )}
          <h1
            className={`font-heading shrink-0 text-[15px] font-bold transition-colors ${heroChrome ? "text-[hsl(var(--kiddo-cream))]" : "text-foreground"}${hideTitleOnMobile ? " sr-only md:not-sr-only" : ""}`}
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
                <span className={`shrink-0 text-[18px] leading-none transition-colors ${heroChrome ? "text-[hsl(var(--kiddo-cream)/0.3)]" : "text-foreground/15"}${hideTitleOnMobile ? " hidden md:inline" : ""}`}>·</span>
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
                className={`flex min-w-0 items-center gap-1 truncate text-[13px] cursor-pointer transition-colors ${heroChrome ? "text-[hsl(var(--kiddo-cream)/0.85)] hover:text-[hsl(var(--kiddo-cream))]" : "text-muted-foreground hover:text-foreground"}`}
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
                {/* Color keys off heroChrome (NOT isOnDashboard): the bar flips
                    to cream once scrolled past the hero, so a fixed cream chevron
                    went cream-on-cream and vanished. Now it matches the fund-name
                    text beside it — cream over the green hero, muted-ink over cream
                    — and eases instead of snapping (transition-[color,transform]). */}
                <ChevronDown size={12} className={`shrink-0 transition-[color,transform] duration-200 ease-out ${heroChrome ? "text-[hsl(var(--kiddo-cream)/0.7)]" : "text-muted-foreground"} ${fundPickerOpen ? "rotate-180" : ""}`} />
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
              className="absolute left-0 top-[calc(100%+10px)] z-50 min-w-[220px] overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-border))] bg-white shadow-[0_22px_60px_hsl(var(--kiddo-ink) / 0.18)]"
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
                // Quote the Dashboard hero's published live total when this
                // fund's dashboard has computed one (fund.balance is
                // settlement-synced, not price-synced — see
                // lib/fund-live-value.ts); else the funds-list math.
                const val = readFundLiveValue(queryClient, fund.id) ?? (
                  parseFloat(String(fund.balance || "0")) +
                  parseFloat(String((fund as any).pendingBalance || "0")) +
                  parseFloat(String((fund as any).cashBalance || "0")));
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
          {/* Bell removed 2026-06-13 — see the note at the top of the component.
              The right cluster is now just the profile entry (and Share lives in
              the page chrome / bottom nav). */}

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
                // VARIANT 3 (2026-06-23): no frame at all — bare glyph, no ring,
                // no fill. The person glyph sits directly in the hero. A profile
                // PHOTO still renders circular (the <img> below is rounded-full on
                // its own), just without a ring around it — a standard bare-avatar
                // look, not a broken one. Faint hover fill kept for tap feedback.
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors md:hidden overflow-hidden p-0 focus-visible:outline-none ${heroChrome ? "hover:bg-[hsl(var(--kiddo-cream)/0.14)]" : "hover:bg-[rgb(237,244,238)] focus-visible:bg-[rgb(237,244,238)]"}`}
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
                    color: heroChrome ? "hsl(var(--kiddo-cream))" : "rgb(26,61,43)",
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
          {withFund && !suppressFundChrome && !isOnDashboard && (
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
