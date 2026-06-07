// PreviousCustodianAccessCard — the post-handoff owner's "who can see this
// fund" control (2026-06-07, founder-approved; pairs with migration 0042 +
// POST /api/funds/:fundId/revoke-previous-owner-access).
//
// After the at-18 handoff, the former custodian keeps a view-only window by
// default — warm and right for most families (they built it for 18 years).
// But the default was IRREVOCABLE, which turns a permanent observer on an
// adult's financial account into a coercive-control vector in the
// estranged-parent case. This card gives the ADULT OWNER the escape hatch:
// default stays on; removal is theirs, one-way (re-granting is a support
// flow on purpose), and SILENT — the former custodian is not notified, the
// same posture as social-platform blocking, because notifying a controlling
// parent that they've been cut off invites escalation.
//
// Renders only for the owner of a transferred fund while the window is
// still open; disappears once revoked.

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

  if (!fund?.id || !fund?.previousOwnerId || fund?.previousOwnerAccessRevokedAt || done) {
    return null;
  }

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
              They kept a view-only window when the fund became yours: the balance, the growth,
              and the Memory Book they helped fill. They can't change anything or move money.
            </p>
          </div>
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
              This removes their view of this fund entirely. They won't be notified, and this
              can't be undone in the app (you'd need to contact support). Your Memory Book and
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
