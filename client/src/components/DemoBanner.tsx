// Demo banner. Sticky top notification rendered on every authenticated
// page when the current user has isDemoAccount=true. Calm pill register
// (per feedback_toast_pattern_locked.md), not a flashing marketing
// banner. Dismissible per session — re-appears on next login so the
// user always knows they're in the demo context.
//
// Reads `isDemoAccount` from useAuth(). Renders null for non-demo users
// (zero cost on real-user surfaces). Per DUNPHY_DEMO_SPEC.md.

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { X } from "lucide-react";

const SESSION_DISMISS_KEY = "kora:demo-banner-dismissed";

export function DemoBanner() {
  const { user } = useAuth();
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
  if (!isDemoUser || dismissed) return null;

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
