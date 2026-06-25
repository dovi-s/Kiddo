// Demo banner. Sticky top notification rendered on the app surfaces
// (Dashboard, Memory Book, Activity, gift flow, /my-gifts, etc.) when
// the current user has isDemoAccount=true. Calm pill register (per
// feedback_toast_pattern_locked.md), not a flashing marketing banner.
// Dismissible per session — re-appears on next login so the user
// always knows they're in the demo context.
//
// Shown ONLY on authenticated app surfaces (allowlist via
// isDemoAppSurface() in lib/routes.ts). NOT on any public / front-door
// page — marketing pages, Home, /login, /get-started, the /demo landing
// page, claim + gift-checkout flows — even when the visitor is a
// logged-in demo account who navigated back out there. On those pages
// the "amounts reset periodically" message is contextually wrong and
// would just stack on the page's own chrome.
//
// Reads `isDemoAccount` from useAuth(). Renders null for non-demo users
// (zero cost on real-user surfaces). Per DUNPHY_DEMO_SPEC.md.

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { X, LogOut } from "lucide-react";
import { isDemoAppSurface } from "@/lib/routes";

const SESSION_DISMISS_KEY = "kora:demo-banner-dismissed";

// Entrance choreography (founder catch 2026-06-05): during the page's
// skeleton phase this sticky banner used to arrive FULLY FORMED — the one
// loud, finished element above a calm field of placeholders, which read as
// broken. It now glides in (fade + slide) after a beat, once the page has
// started settling. Module-level flag: the glide plays once per app load —
// tab-to-tab navigation remounts the banner without replaying the entrance
// (it would read as the banner "reloading"). App-level MotionConfig
// (reducedMotion="user") strips the slide for reduced-motion users.
let hasPlayedEntrance = false;

// `sidebarOffset` mirrors the App shell's `!hideGlobalNav`: on desktop the
// 264px DesktopSidebar is `fixed left-0 z-50`, and this banner is `sticky
// top-0 z-50` rendered LATER in the DOM — so at equal z-index the banner
// painted over the sidebar's logo (top-left). Offsetting the banner by the
// sidebar width on surfaces that show the sidebar puts it in the content
// column instead. Full-width (no offset) on mobile and on sidebar-less app
// surfaces (/admin, /gifter, /my-gifts, /kid/*).
export function DemoBanner({ sidebarOffset = false }: { sidebarOffset?: boolean }) {
  const { user, logout, isLoggingOut } = useAuth();
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Read session-dismissed state on mount. sessionStorage (not local)
  // so the banner returns on next login — the demo context is too
  // important to permanently dismiss.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // sessionStorage unavailable (incognito private modes etc.) — banner just shows
    }
  }, []);

  const isDemoUser = Boolean((user as any)?.isDemoAccount);
  // Show ONLY on authenticated app surfaces — where the demo user is
  // actually looking at the seeded Rivera data (Dashboard, Memory Book,
  // Activity, Settings, /my-gifts, Kid View, etc.). Everything else is
  // a public / front-door page (marketing, Home, /login, /get-started,
  // claim + gift-checkout flows, ...) where the "amounts reset
  // periodically / create your own fund" message is contextually wrong
  // and just stacks on top of that page's own chrome. Allowlist, not
  // blocklist — see isDemoAppSurface. A logged-in demo account browsing
  // back out to Home or Login should NOT carry the banner with them.
  if (!isDemoUser || dismissed || !isDemoAppSurface(location)) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      // ignore — dismissal is just for this render in incognito
    }
  };

  const playEntrance = !hasPlayedEntrance;
  if (playEntrance) hasPlayedEntrance = true;

  return (
    <motion.div
      initial={playEntrance ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed z-50 left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] md:bottom-5${sidebarOffset ? " md:left-[calc(50%+132px)]" : ""}`}
      data-testid="demo-banner"
      role="status"
      aria-live="polite"
    >
      {/* FLOATING variant: a compact pill that floats bottom-center (above the
          mobile nav) instead of a top strip — maximally out of the content's way.
          Keeps the demo dot + label for context and the Create CTA visible so the
          conversion path isn't buried; Exit + dismiss are quiet icons. */}
      <div className="flex items-center gap-2.5 rounded-full border border-[hsl(var(--kiddo-evergreen)/0.22)] bg-[hsl(var(--background)/0.95)] px-3.5 py-2 text-xs shadow-[0_6px_24px_rgba(27,58,45,0.16)] backdrop-blur-md sm:text-sm">
        <span className="flex items-center gap-2 text-[hsl(var(--kiddo-evergreen))]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--kiddo-evergreen))]" aria-hidden />
          <span className="whitespace-nowrap font-semibold">Rivera demo</span>
        </span>
        <span className="h-3.5 w-px shrink-0 bg-[hsl(var(--kiddo-evergreen)/0.2)]" aria-hidden />
        <Link
          href="/get-started"
          className="whitespace-nowrap font-semibold text-[hsl(var(--kiddo-evergreen))] underline underline-offset-2 hover:opacity-80"
          data-testid="demo-banner-create-cta"
        >
          Create yours →
        </Link>
        {/* logout() clears the illustrative session and full-page-navigates to "/"
            as a fresh, logged-out visitor. Quiet door icon. */}
        <button
          type="button"
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="flex shrink-0 items-center rounded-full p-1 text-[hsl(var(--kiddo-evergreen))] opacity-80 transition-opacity hover:opacity-100 disabled:opacity-50"
          data-testid="demo-banner-exit"
          aria-label="Exit demo"
          title="Exit demo"
        >
          <LogOut size={15} />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex shrink-0 items-center rounded-full p-1 text-[hsl(var(--kiddo-evergreen))] opacity-55 transition-opacity hover:opacity-100"
          aria-label="Dismiss demo banner"
          data-testid="demo-banner-dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}
