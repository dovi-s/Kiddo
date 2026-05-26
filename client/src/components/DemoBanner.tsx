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
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { X } from "lucide-react";
import { isDemoAppSurface } from "@/lib/routes";

const SESSION_DISMISS_KEY = "kora:demo-banner-dismissed";

export function DemoBanner() {
  const { user } = useAuth();
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
  // actually looking at the seeded Dunphy data (Dashboard, Memory Book,
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

  return (
    <div
      className="sticky top-0 z-50 border-b border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.06)] backdrop-blur-sm"
      data-testid="demo-banner"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm">
        <p className="leading-snug text-[hsl(var(--kiddo-evergreen))]">
          <span className="font-semibold">You're in the Dunphy demo.</span>{" "}
          <span className="text-[hsl(var(--kiddo-evergreen))/0.85]">
            Everything is illustrative. Real funds work the same way; dollar amounts here reset periodically.
          </span>{" "}
          <Link
            href="/get-started"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
            data-testid="demo-banner-create-cta"
          >
            Create your own fund →
          </Link>
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1 text-[hsl(var(--kiddo-evergreen))] opacity-70 transition-opacity hover:opacity-100"
          aria-label="Dismiss demo banner"
          data-testid="demo-banner-dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
