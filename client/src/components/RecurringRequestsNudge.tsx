// Aggregated recurring-requests nudge for the parent's Dashboard.
//
// Per project_pricing_v3_recurring_at_plus.md (locked 2026-05-23):
// when a gifter on a Free fund uses the "ask the family to enable
// monthly contributions" CTA in GiftCheckout, the server creates a
// `recurring_request` activity row. This component aggregates those
// rows into a single high-visibility conversion moment on the
// parent's Dashboard — the activity feed shows the chronological
// rows, but THIS card is the actionable surface.
//
// Conversion thesis: this is the highest-intent Plus upgrade moment
// the product has. Someone has actively raised their hand to send
// monthly contributions. The parent's emotional context is "people
// who love my kid want to give more" — that frame justifies $3.99/mo
// more powerfully than any abstract feature pitch.
//
// Design constraints per the locked pricing-v3 design:
//   - Diplomatic framing: "X gifters want to give monthly" — names
//     the gifters as the beneficiaries of upgrading, NOT "you have
//     X unconverted leads waiting"
//   - Suppresses on Plus/Family funds (already enabled — no nudge
//     needed)
//   - Dismissable (per-user, per-fund) so a parent who declines
//     doesn't see the same card on every dashboard load
//   - Uses FeatureWallModal for the Plus pitch (consistent with
//     the other 4 proactive Plus prompts shipped 2026-05-23)

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { haptic } from "@/lib/haptics";

const DISMISS_KEY_PREFIX = "kora:dismissed:recurring-requests-nudge:";

type ActivityRow = {
  id: string;
  type: string;
  title?: string;
  description?: string;
  metadata?: string | null;
  fundId?: string | null;
  createdAt?: string | null;
};

export type RecurringRequestsNudgeProps = {
  fundId: string;
  childName?: string | null;
  effectivePlan: string | null | undefined;
  className?: string;
};

export function RecurringRequestsNudge({
  fundId,
  childName,
  effectivePlan,
  className,
}: RecurringRequestsNudgeProps) {
  const dismissKey = `${DISMISS_KEY_PREFIX}${fundId}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return !!window.localStorage.getItem(dismissKey);
    } catch {
      return false;
    }
  });
  const [wallOpen, setWallOpen] = useState(false);

  // Suppress on paid plans — recurring is already enabled on the fund
  // so there's nothing to convert toward. Suppress on trial too: the
  // gifters can already set up recurring during the trial; the card
  // would create false-positive nudge pressure when the parent is
  // already getting the benefit.
  const plan = String(effectivePlan || "").toLowerCase();
  const isPaid = plan === "starter" || plan === "family" || plan === "trial" || plan === "legacy";

  const { data: activities = [] } = useQuery<ActivityRow[]>({
    queryKey: ["/api/activities", { fundId }],
    queryFn: async () => {
      const res = await fetch(`/api/activities?fundId=${encodeURIComponent(fundId)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fundId && !isPaid && !dismissed,
    staleTime: 60_000,
  });

  // Dedup by gifter email — the same gifter making the request twice
  // counts as one signal, not two. Cooldown on the server prevents
  // spam but doesn't enforce uniqueness across the fund's lifetime.
  const uniqueGifters = useMemo(() => {
    if (!Array.isArray(activities)) return [] as Array<{ email: string; name: string }>;
    const byEmail = new Map<string, { email: string; name: string }>();
    for (const a of activities) {
      if (a?.type !== "recurring_request") continue;
      if (!a?.metadata) continue;
      try {
        const meta = JSON.parse(a.metadata as string);
        const email = String(meta?.gifterEmail || "").trim().toLowerCase();
        const name = String(meta?.gifterName || "").trim() || "Someone";
        if (!email || byEmail.has(email)) continue;
        byEmail.set(email, { email, name });
      } catch {
        // malformed metadata - skip
      }
    }
    return Array.from(byEmail.values());
  }, [activities]);

  if (dismissed || isPaid) return null;
  if (uniqueGifters.length === 0) return null;

  const displayChild = (childName || "your kid").trim() || "your kid";
  const count = uniqueGifters.length;
  const firstName = uniqueGifters[0]?.name || "Someone";
  const secondName = uniqueGifters[1]?.name || "";
  const headline = count === 1
    ? `${firstName} wants to give monthly to ${displayChild}.`
    : count === 2
      ? `${firstName} and ${secondName} want to give monthly to ${displayChild}.`
      : `${firstName} and ${count - 1} other${count - 1 === 1 ? "" : "s"} want to give monthly to ${displayChild}.`;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(dismissKey, new Date().toISOString());
    } catch {
      // best-effort
    }
    setDismissed(true);
  };

  return (
    <div className={className}>
      <div
        className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
        data-testid={`recurring-requests-nudge-${fundId}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BellRing size={16} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground" data-testid="recurring-requests-headline">
              {headline}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {count === 1
                ? `Enabling Kiddo+ on ${displayChild}'s fund lets ${firstName} set up monthly contributions. The fund's existing one-time gifts and Memory Book stay either way.`
                : `Enabling Kiddo+ on ${displayChild}'s fund lets all of them set up monthly contributions. The fund's existing one-time gifts and Memory Book stay either way.`}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground/85">
              <span className="font-semibold text-foreground">$3.99/month</span>
              <span className="text-muted-foreground/70">, about 13¢ a day.</span>
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => { haptic("selection"); setWallOpen(true); }}
                data-testid={`recurring-requests-cta-${fundId}`}
              >
                Enable monthly contributions
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl text-muted-foreground"
                onClick={() => { haptic("light"); handleDismiss(); }}
                data-testid={`recurring-requests-dismiss-${fundId}`}
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
      <FeatureWallModal
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        featureId="recurring_requests_aggregated"
        requiredTier="plus"
        title={`Enable monthly contributions on ${displayChild}'s fund.`}
        body={`${count === 1 ? firstName : `${count} gifters`} ${count === 1 ? "has" : "have"} asked to set up monthly contributions to ${displayChild}'s fund. Kiddo+ on the fund unlocks recurring for them (and for any future gifter), plus your own monthly contributions, custom fund mix, parent-authored photo and voice memos in the Memory Book, co-parent access, and an annual tax summary. The fund's existing gifts and Memory Book entries stay either way.`}
        upgradePath={`/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fundId)}`}
      />
    </div>
  );
}
