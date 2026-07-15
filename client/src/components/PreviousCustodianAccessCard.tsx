// PreviousCustodianAccessCard — the post-handoff owner's "who can see this
// fund" control (2026-06-07, founder-approved; pairs with migration 0042 +
// POST /api/funds/:fundId/revoke-previous-owner-access).
//
// After the at-18 handoff, the former custodian keeps a view-only window. As of
// the keepsake change (2026-06-09) that window shows a FROZEN keepsake by
// default — the fund as it was handed over, not the now-adult's live balance.
// This card gives the ADULT OWNER two controls:
//   1. "Let them watch it grow live" — opt them back into the live fund. A
//      reversible visibility preference (POST .../previous-owner-live-access).
//   2. "Remove their access" — cut the window entirely. One-way + SILENT (the
//      same coercive-control escape hatch as before; re-granting is a support
//      flow on purpose, and the former custodian is not notified).
//
// Renders only for the owner of a transferred fund while the window is still
// open; disappears once revoked.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

export function PreviousCustodianAccessCard({ fund }: { fund: any }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveOn, setLiveOn] = useState(Boolean(fund?.previousOwnerLiveAccessGrantedAt));

  if (!fund?.id || !fund?.previousOwnerId || fund?.previousOwnerAccessRevokedAt || done) {
    return null;
  }

  const setLive = async (grant: boolean) => {
    setLiveBusy(true);
    const prev = liveOn;
    setLiveOn(grant); // optimistic
    try {
      const res = await fetch(`/api/funds/${fund.id}/previous-owner-live-access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant }),
      });
      if (res.ok) {
        haptic("success");
        toast({
          title: grant ? "Sharing live" : "Back to keepsake",
          description: grant
            ? "They'll see this fund update live again."
            : "They'll see the fund as you handed it over, frozen at the handoff.",
        });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      } else {
        setLiveOn(prev); // revert
        const payload = await res.json().catch(() => ({}));
        toast({ title: "Couldn't update", description: payload?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      setLiveOn(prev);
      toast({ title: "Couldn't update", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setLiveBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/funds/${fund.id}/revoke-previous-owner-access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        haptic("success");
        setDone(true);
        toast({
          title: "Access removed",
          description: "They can no longer see this fund. They won't be notified.",
        });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      } else {
        toast({
          title: "Couldn't update access",
          description: payload?.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Couldn't update access", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card" data-testid="previous-custodian-access-card">
      <div className="p-5">
        <h2 className="text-base font-bold text-foreground">Who can see this fund</h2>
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">The parent who set this up</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              When the fund became yours, their view froze to a keepsake: the fund as you handed it
              over, on the handoff date. They see who gave and the Memory Book they helped fill, but
              not your live balance, and they can&apos;t change anything or move money.
            </p>
          </div>
        </div>

        {/* Phase 2: opt them back into the LIVE fund. Reversible anytime. */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--kiddo-border))] p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Let them watch it grow live</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Share your current balance and growth, updating as it does. You can turn this off anytime.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={liveOn}
            aria-label="Let the previous owner see this fund update live"
            disabled={liveBusy}
            onClick={() => { haptic("light"); void setLive(!liveOn); }}
            data-testid="toggle-previous-owner-live"
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${liveOn ? "bg-[hsl(var(--kiddo-evergreen))]" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${liveOn ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        {!confirming ? (
          <button
            type="button"
            className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => { haptic("light"); setConfirming(true); }}
            data-testid="button-revoke-previous-owner-open"
          >
            Remove their access
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50/60 p-4" data-testid="revoke-previous-owner-confirm">
            <p className="text-xs leading-relaxed text-foreground">
              This removes their view of this fund entirely. They won&apos;t be notified, and this
              can&apos;t be undone in the app (you&apos;d need to contact support). Your Memory Book and
              everything in the fund stays exactly as it is.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => { haptic("medium"); void revoke(); }}
                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                data-testid="button-revoke-previous-owner-confirm"
              >
                {busy ? "Removing..." : "Remove access"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { haptic("light"); setConfirming(false); }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Keep access
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
