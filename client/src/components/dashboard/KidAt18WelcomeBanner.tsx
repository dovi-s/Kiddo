// At-18 welcome banner — the first thing a kid sees on Dashboard after
// claiming their fund as the at-18 recipient. One-time, dismissable,
// per-fund localStorage flag.
//
// Extracted from Dashboard.tsx as the first slice of the Dashboard
// decomposition (see ARCHITECTURE.md §11). Pattern: each Dashboard
// sub-component takes the props it needs explicitly (no shared context),
// returns null when it shouldn't render, owns its own dismiss state.
//
// Renders when:
//   - kidClaimedAt is set (server-gated; only set when viewer is the
//     kid AND claim is within 60 days)
//   - localStorage dismiss flag for this fund is NOT set
//
// The banner sits ABOVE the parent-style hero because the kid is NOT
// a parent — the dashboard's standard "share with gifters / set up
// recurring investment" CTAs assume parent intent that doesn't apply
// on day 1 of fund ownership. This banner sets the right context
// (yours, nothing sold, sealed letter, gifters) before the kid scans
// the rest of the surface.

import { useState } from "react";
import { safeLocalSet } from "@/lib/local-cache";
import { CollapseDismissSection } from "@/components/dashboard/CollapseDismissSection";

const DISMISS_KEY_PREFIX = "kiddo.kid-welcome-dismissed.";

function kidWelcomeDismissKey(fundId: string): string {
  return `${DISMISS_KEY_PREFIX}${fundId}`;
}

// Single source of truth for "has this at-18 welcome been dismissed." The
// Dashboard digest yields to this banner, but only WHILE it's showing — once
// dismissed, the digest returns so a dismissed banner can't suppress the recap
// for the rest of the server's claim window.
export function isKidAt18WelcomeBannerDismissed(fundId: string | null): boolean {
  if (!fundId) return false;
  try {
    return !!window.localStorage.getItem(kidWelcomeDismissKey(fundId));
  } catch {
    return false;
  }
}

export type KidAt18WelcomeBannerProps = {
  kidClaimedAt: string | null | undefined;
  fundId: string | null;
  childFirstName: string | null | undefined;
};

export function KidAt18WelcomeBanner({
  kidClaimedAt,
  fundId,
  childFirstName,
}: KidAt18WelcomeBannerProps) {
  const [open, setOpen] = useState(true);

  if (!kidClaimedAt || !fundId) return null;

  const dismissKey = kidWelcomeDismissKey(fundId);
  if (isKidAt18WelcomeBannerDismissed(fundId)) {
    // Already dismissed — don't show the welcome twice. (localStorage-
    // unavailable falls through to render: the helper returns false, so the
    // welcome moment is never swallowed by a storage error.)
    return null;
  }

  const childFirst = (childFirstName || "").trim();

  // Persisted AFTER the collapse exit (so it always animates out and never
  // reappears). The old version forced a re-render via the active-fund event,
  // which blinked the banner out — now the smooth collapse handles it.
  const persistDismiss = () => {
    try {
      safeLocalSet(dismissKey, new Date().toISOString());
    } catch {
      // Ignore storage failures; the dismiss is best-effort.
    }
  };

  return (
    <CollapseDismissSection
      open={open}
      onExitComplete={persistDismiss}
      onRequestDismiss={() => setOpen(false)}
      className="mb-4 rounded-3xl border p-6 shadow-premium-sm md:p-7"
      style={{
        borderColor: "hsl(var(--kiddo-gold) / 0.42)",
        background:
          "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 55%, hsl(var(--kiddo-gold) / 0.10) 100%)",
      }}
      data-testid="kid-at-18-welcome-banner"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase mb-1.5"
            style={{
              color: "hsl(var(--kiddo-gold-ink) / 0.85)",
              letterSpacing: "0.14em",
            }}
          >
            Welcome
          </p>
          <h2 className="font-heading text-xl font-semibold text-foreground leading-snug">
            {childFirst ? <>This is your fund now, {childFirst}.</> : <>This is your fund now.</>}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="kid-welcome-dismiss"
          aria-label="Dismiss welcome banner"
        >
          Dismiss
        </button>
      </div>
      {/* Bold-lead points, no bullet markers. The earlier version used a
          literal "·" character as the marker, which read as unfinished /
          placeholder. The bold lead-in is the scannable anchor; spacing
          carries the separation. */}
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
        <li>
          <span className="font-semibold text-foreground">Nothing was sold.</span> Hold, sell, or reinvest. Your call now.
        </li>
        <li>
          <span className="font-semibold text-foreground">The Memory Book is yours.</span> Every note, photo, and the letter from your parent.
        </li>
        <li>
          <span className="font-semibold text-foreground">It's a custodial brokerage account.</span> Tax may apply the year you take over, so ask a CPA before big moves.
        </li>
        <li>
          <span className="font-semibold text-foreground">This was your parent's view.</span> Same fund, fully yours now.
        </li>
      </ul>
      {/* Link to the year-by-year retrospective. The kid's first
          emotional anchor surface — every gift, every note, grouped
          by year of life. */}
      <a
        href={`/your-story/${encodeURIComponent(fundId)}`}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--kiddo-gold-ink))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        data-testid="kid-welcome-your-story"
      >
        See your full story →
      </a>
    </CollapseDismissSection>
  );
}
