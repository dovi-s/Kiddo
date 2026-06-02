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
// Ships Tier-2 deferred item #1 (locked 2026-05-23).

import { motion } from "framer-motion";
import { safeLocalSet } from "@/lib/local-cache";
import { ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { Users } from "lucide-react";

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

  const dismissBanner = () => {
    try {
      safeLocalSet(dismissKey, new Date().toISOString());
    } catch {
      // best-effort
    }
    window.dispatchEvent(
      new CustomEvent(ACTIVE_FUND_CHANGE_EVENT, { detail: { id: fundId } }),
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-4 rounded-3xl border p-6 shadow-premium-sm md:p-7"
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
          <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground leading-snug">
            {childFirst
              ? `${coparentFirst} accepted your invite to ${childFirst}'s fund.`
              : `${coparentFirst} accepted your co-parent invite.`}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {coparentFirst} can now see {childFirst ? `${childFirst}'s` : "the"} fund alongside you. Same data, same dashboard, shared view of the gifts that come in.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissBanner}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="coparent-accepted-dismiss"
          aria-label="Dismiss co-parent acceptance banner"
        >
          Dismiss
        </button>
      </div>
    </motion.section>
  );
}
