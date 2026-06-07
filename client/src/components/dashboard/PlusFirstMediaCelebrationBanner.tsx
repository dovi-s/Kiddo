// Plus first-media unlock celebration banner. Fires the FIRST time a
// Kiddo+ parent attaches photo/video/voice to a parent-authored Memory
// Book entry — surfaces the moment that the Plus upgrade actually
// delivered something the parent felt. Without this banner the upgrade
// lands silently: a free parent hits the Plus wall, upgrades, attaches
// their photo, and gets the entry but never a marker that the upgrade
// "worked." This is the closing beat on the upgrade funnel.
//
// Why a banner not a notification: same logic as CoparentAcceptedBanner.
// One-time emotional beat ("the moment Plus paid off") that earns a
// hero-adjacent visual treatment, not a notification-panel row.
//
// Per-user dismissal (NOT per-fund). The first-media event is tied to
// the parent identity — even if they have multiple kids, this celebration
// fires once across all of them. Storage key is in PER_USER_KEYS_TO_CLEAR
// in use-auth.ts so it correctly wipes on logout (per the 2026-05-23
// localStorage dedupe audit).
//
// Ships Tier-2 deferred item #2 (locked 2026-05-23).

import { useState } from "react";
import { safeLocalSet } from "@/lib/local-cache";
import { Camera } from "lucide-react";
import { CollapseDismissSection } from "@/components/dashboard/CollapseDismissSection";

const DISMISS_KEY = "kora:dismissed:plus-first-media-celebration";

export type PlusFirstMediaCelebrationBannerProps = {
  plusFirstMediaAt: string | null | undefined;
  fundId: string | null;
};

export function PlusFirstMediaCelebrationBanner({
  plusFirstMediaAt,
  fundId,
}: PlusFirstMediaCelebrationBannerProps) {
  const [open, setOpen] = useState(true);

  if (!plusFirstMediaAt) return null;

  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return null;
    } catch {
      // localStorage unavailable — render. Better to celebrate twice
      // than to swallow the moment. Same posture as the co-parent banner.
    }
  }

  // Persisted AFTER the collapse exit completes — so the banner always
  // animates out smoothly and never reappears. (fundId is unused now; the
  // old active-fund event nudge is no longer needed — internal state drives it.)
  void fundId;
  const persistDismiss = () => {
    try {
      safeLocalSet(DISMISS_KEY, new Date().toISOString());
    } catch {
      // best-effort
    }
  };

  return (
    <CollapseDismissSection
      open={open}
      onExitComplete={persistDismiss}
      onRequestDismiss={() => setOpen(false)}
      className="mb-4 rounded-3xl border p-6 shadow-premium-sm md:p-7"
      style={{
        // Warm gold treatment — distinct from co-parent banner (evergreen)
        // and at-18 welcome banner (also gold but ceremonial). This one
        // is "the upgrade paid off" — gold-leaning warm beats analytical
        // greens here.
        borderColor: "hsl(var(--kiddo-gold) / 0.36)",
        background:
          "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 55%, hsl(var(--kiddo-gold) / 0.10) 100%)",
      }}
      data-testid="plus-first-media-celebration-banner"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Camera size={14} className="text-[hsl(var(--kiddo-gold))]" />
            <p
              className="text-[10px] font-bold uppercase"
              style={{
                color: "hsl(var(--kiddo-gold))",
                letterSpacing: "0.14em",
              }}
            >
              First photo unlocked
            </p>
          </div>
          <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground leading-snug">
            Your first photo is on the timeline.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every photo, voice memo, and video you add lives here for the long run. The kid who eventually opens this Memory Book sees what you saw, in the moment you saw it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="plus-first-media-celebration-dismiss"
          aria-label="Dismiss first-photo celebration banner"
        >
          Dismiss
        </button>
      </div>
    </CollapseDismissSection>
  );
}
