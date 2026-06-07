// Co-parent acceptance celebration banner. Mirrors KidAt18WelcomeBanner's
// pattern: one-time, dismissable, per-fund-per-collaborator-id localStorage
// flag. Renders on the inviter's Dashboard when a co-parent collaborator
// accepted their invite within the last 30 days.
//
// Why a banner not a notification: this is a one-time emotional beat ("your
// co-parent showed up"), not a recurring nudge. The notification panel is
// for actionable items; this is a celebration moment that earns its own
// visual treatment on the Dashboard above the fold for the brief window
// where it's relevant.
//
// Dismiss animation (2026-06-05): a smooth COLLAPSE, not an instant unmount.
// Previously dismiss set the flag + forced a re-render, so the banner blinked
// out and the layout below snapped up — jittery. Now an internal `open` flag
// drives an AnimatePresence exit that fades + collapses height/padding/margin
// to 0, so the page glides up seamlessly; the localStorage flag is persisted
// AFTER the exit completes (onExitComplete) so it never reappears. `overflow:
// hidden` clips the content as it collapses but NOT the section's own
// box-shadow (an element's overflow never clips its own shadow), so the card
// stays beautiful the whole way down.
//
// Ships Tier-2 deferred item #1 (locked 2026-05-23).

import { useState } from "react";
import { safeLocalSet } from "@/lib/local-cache";
import { Users, X } from "lucide-react";
import { CollapseDismissSection } from "@/components/dashboard/CollapseDismissSection";

const DISMISS_KEY_PREFIX = "kiddo.coparent-accepted-dismissed.";

export type CoparentAcceptedBannerProps = {
  acceptance: {
    collaboratorId: string;
    name: string;
    acceptedAt: string;
  } | null | undefined;
  fundId: string | null;
  childFirstName: string | null | undefined;
};

export function CoparentAcceptedBanner({
  acceptance,
  fundId,
  childFirstName,
}: CoparentAcceptedBannerProps) {
  // Hook FIRST (rules of hooks) — before any early return.
  const [open, setOpen] = useState(true);

  if (!acceptance || !fundId) return null;

  // Per-collaborator-id dismiss key so future co-parent acceptances on the
  // same fund (e.g., a guardian added later) trigger their own celebration.
  const dismissKey = `${DISMISS_KEY_PREFIX}${fundId}.${acceptance.collaboratorId}`;
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(dismissKey)) return null;
    } catch {
      // localStorage unavailable — render the banner. Better to celebrate
      // twice than to swallow the moment.
    }
  }

  const childFirst = (childFirstName || "").trim();
  const coparentFirst = (acceptance.name || "").split(/\s+/)[0] || acceptance.name;

  // Persist the dismiss flag only AFTER the collapse finishes, so the exit
  // animation always gets to play (and it never reappears on the next render).
  const persistDismiss = () => {
    try {
      safeLocalSet(dismissKey, new Date().toISOString());
    } catch {
      // best-effort
    }
  };

  return (
    <CollapseDismissSection
      open={open}
      onExitComplete={persistDismiss}
      onRequestDismiss={() => setOpen(false)}
      className="mb-4 rounded-3xl border p-5 shadow-premium-sm sm:p-6"
      style={{
        borderColor: "hsl(var(--kiddo-evergreen) / 0.32)",
        background:
          "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 55%, hsl(var(--kiddo-evergreen) / 0.08) 100%)",
      }}
      data-testid="coparent-accepted-banner"
    >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Users size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
                <p
                  className="text-[10px] font-bold uppercase"
                  style={{
                    color: "hsl(var(--kiddo-evergreen))",
                    letterSpacing: "0.14em",
                  }}
                >
                  Co-parent joined
                </p>
              </div>
              {/* Copy tightened for mobile (2026-06-07, founder: "this is
                  ~5 lines and weird"). Dropped the redundant "to {child}'s
                  fund" (you're already on that fund) and the long "with every
                  gift and note as it arrives" tail — the shared-view meaning is
                  carried by "alongside you." Headline + sub now land in ~3-4
                  lines instead of ~6. */}
              <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground leading-snug">
                {`${coparentFirst} accepted your invite.`}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {coparentFirst} can see {childFirst ? `${childFirst}'s` : "the"} fund alongside you now.
              </p>
            </div>
            {/* X icon, not a "Dismiss" text button (2026-06-07): the text stole
                ~50px from the headline column on mobile, forcing it to wrap an
                extra line, and an X is the standard affordance for a
                dismissible card. Swipe-to-dismiss also works (CollapseDismiss-
                Section onRequestDismiss). */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 -mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-black/5 transition-colors"
              data-testid="coparent-accepted-dismiss"
              aria-label="Dismiss co-parent acceptance banner"
            >
              <X size={16} />
            </button>
          </div>
    </CollapseDismissSection>
  );
}
