// FeatureWallModal — the reusable contextual upgrade pattern.
//
// Per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md: when a parent on Free
// hits a feature gated by Plus or Family, this modal fires.
// Specific to the feature they just tried. Single primary CTA.
// Calm Apple-Settings register. Respectful of the moment.
//
// Variant logic:
//   - First-time encounter: full explainer (title + body + price + CTAs).
//   - After they've dismissed once: softer copy (title + price + CTAs;
//     skips the body explainer since they've already read it once).
//
// State source: `users.dismissedFeatureWalls` JSONB column
// (migration 0018), read via the /api/auth/user query, written via
// POST /api/user/feature-walls/:featureId/dismiss.
//
// Per the locked WHO/HOW IA (feedback_ia_who_vs_how_principle.md):
// the primary CTA routes to /account?tab=plan (not /settings or
// /pricing) where the upgrade auto-trigger handler fires Stripe
// checkout in-place. The secondary "See all" link routes to
// /pricing for the rare comparison-shopper.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

export type FeatureWallProps = {
  open: boolean;
  onClose: () => void;
  // Stable identifier for analytics + dismissal tracking. Lowercase
  // a-z0-9_ only (enforced server-side too). Example values:
  // "recurring_investments", "memory_media", "custom_fund_mix",
  // "co_parent_access", "second_fund", "active_occasions".
  featureId: string;
  // Tier required to unlock the gated feature. Drives the price
  // line and the upgradePath default.
  requiredTier: "plus" | "family";
  // Headline. Specific to the feature the parent just tried.
  // e.g. "Recurring investments is a Kiddo+ feature."
  title: string;
  // 1-2 sentence value prop. Skipped on repeat encounters (the
  // parent already read it; don't bore them).
  // e.g. "Set a monthly amount and Emma's fund grows on autopilot.
  // Forever. Never miss a month."
  body: string;
  // Where the primary CTA goes. Per Phase 1c-B 2026-05-14, the
  // canonical home for plan upgrades is /account?tab=plan with
  // the upgrade auto-trigger query params. The caller passes the
  // fund-scoped URL when the gated feature is per-fund (Plus is
  // single-fund and needs fundId).
  upgradePath: string;
  // Optional secondary text link. Defaults to /pricing for the
  // "see all features" comparison-shopper case. Passing an empty
  // string suppresses the link entirely (rare).
  secondaryLink?: string;
};

type UserShape = {
  dismissedFeatureWalls?: Record<string, string> | null;
};

export function FeatureWallModal({
  open,
  onClose,
  featureId,
  requiredTier,
  title,
  body,
  upgradePath,
  secondaryLink = "/pricing",
}: FeatureWallProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Read user's dismissal record. Falls through to "never dismissed"
  // when the API isn't loaded yet or the user is unauthenticated
  // (in which case this modal shouldn't be rendered anyway).
  const { data: currentUser } = useQuery<UserShape | null>({
    queryKey: ["/api/auth/user"],
    staleTime: 30_000,
  });
  const previouslyDismissed = Boolean(
    currentUser?.dismissedFeatureWalls && currentUser.dismissedFeatureWalls[featureId],
  );

  // Dismissal recorder. Fires on close (whether via "Not now" or
  // the backdrop / X). Background-only — the UI closes immediately
  // and doesn't wait for the API.
  const dismissMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/user/feature-walls/${encodeURIComponent(featureId)}/dismiss`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate the user query so the next modal mount picks up
      // the repeat-copy variant rather than the first-time one.
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    // Best-effort fire-and-forget. If the network is flaky, the
    // dismissal is lost — the user sees the first-time copy again
    // next time. Acceptable degradation; nothing legal or financial
    // depends on this.
    onError: () => {},
  });

  const handleDismiss = () => {
    haptic("light");
    dismissMutation.mutate();
    onClose();
  };

  const handleUpgrade = () => {
    haptic("medium");
    // Don't record dismissal on upgrade — the parent is acting,
    // not declining. Only "Not now" and backdrop-close count as
    // dismissals.
    onClose();
    setLocation(upgradePath);
  };

  const handleSecondary = () => {
    haptic("light");
    onClose();
    setLocation(secondaryLink);
  };

  const tierLabel = requiredTier === "plus" ? "Kiddo+" : "Kiddo Family";
  const priceLine = requiredTier === "plus"
    ? "$3.99/month or $29/year. Cancel any time."
    : "$6.99/month or $59/year. Cancel any time.";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">
              {tierLabel}
            </p>
            <h2 className="font-heading text-xl font-semibold text-foreground leading-snug">
              {title}
            </h2>
          </div>

          {/* Body explainer renders ONLY on first encounter. On
              repeat dismissals the parent has already read this
              once; skipping it respects their time and creates a
              calmer second-touch. Locked per the spec's "After
              they've already dismissed once" example. */}
          {!previouslyDismissed && (
            <p className="text-sm text-foreground/85 leading-relaxed">
              {body}
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground">{tierLabel}</p>
              <p className="text-[11px] text-muted-foreground">{priceLine}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={handleDismiss}
              data-testid={`feature-wall-${featureId}-dismiss`}
            >
              {previouslyDismissed ? "Maybe later" : "Not now"}
            </Button>
            <Button
              className="flex-1 rounded-full bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white"
              onClick={handleUpgrade}
              data-testid={`feature-wall-${featureId}-upgrade`}
            >
              Upgrade to {tierLabel.replace("Kiddo ", "")}
            </Button>
          </div>

          {secondaryLink && !previouslyDismissed && (
            <div className="-mt-2 text-center">
              <button
                type="button"
                onClick={handleSecondary}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                data-testid={`feature-wall-${featureId}-secondary`}
              >
                See all {tierLabel.replace("Kiddo ", "")} features
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
