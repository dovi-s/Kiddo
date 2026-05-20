// InvitationsToYouCard — incoming co-parent / viewer invitations
// FROM other parents TO the current user. Inverse of the outgoing
// collaborators list (which lives in the Co-parent access card).
//
// Extracted from Settings.tsx on 2026-05-14 as Phase 2 sheet-
// extraction chunk 4. Owns its own /api/me/invitations query
// (was the only consumer in Settings, so the query moved with
// the surface). Renders nothing when there are zero pending
// invitations — the entire card disappears, no empty state.
//
// The Open-invitation CTA routes to /invitations/:token, which
// is the same accept-or-decline page a fresh email recipient
// would land on. Uniform experience whether they followed the
// email link or discovered the invitation here.

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { readLocalCache, writeLocalCache } from "@/lib/local-cache";

// Per-user pending-invitations cache. Same readLocalCache /
// writeLocalCache pattern as funds / activities / events / co-
// parent collaborators queries. Added 2026-05-20 as part of the
// CoParentAccessCard pattern sweep (commit f347fe2 fixed the
// same anti-pattern there): no staleTime + no initialData meant
// every Settings/Account mount fired a fresh network request and
// the card briefly hid before re-rendering with data. The empty-
// state case is the "return null" early-exit here so there is no
// flashing explainer, but the perf gap was real on slow networks.
const INVITATIONS_CACHE_KEY = "kiddo.me-invitations.v1";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

type PendingInvitation = {
  token: string;
  childFirstName?: string | null;
  inviterFirstName?: string | null;
  role?: string | null;
};

export function InvitationsToYouCard() {
  const [, navigate] = useLocation();
  // initialData reads from localStorage so the card renders
  // instantly on returning sessions. staleTime of 5 minutes
  // prevents re-fetch on every Settings/Account mount; the cache
  // is invalidated when the user accepts or declines via the
  // /invitations/:token flow (which also writes the inverse
  // change). For a per-user list this short, 5 minutes is fine.
  const { data: pendingInvitations = [] } = useQuery<PendingInvitation[]>({
    queryKey: ["/api/me/invitations"],
    queryFn: async () => {
      const res = await fetch(`/api/me/invitations`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      writeLocalCache(INVITATIONS_CACHE_KEY, data);
      return data;
    },
    initialData: () => readLocalCache<PendingInvitation[]>(INVITATIONS_CACHE_KEY),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  if (pendingInvitations.length === 0) return null;

  return (
    <SectionCard>
      <div className="p-5">
        <h2 className="text-base font-bold text-foreground mb-1">Invitations to you</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You've been invited to {pendingInvitations.length === 1 ? "a fund" : `${pendingInvitations.length} funds`} by other parents.
        </p>
        <div className="space-y-3">
          {pendingInvitations.map((inv) => {
            const childName = inv.childFirstName || "their child";
            const inviter = inv.inviterFirstName || "A parent";
            const roleLabel = inv.role === "co-admin" ? "Co-parent" : "Viewer";
            return (
              <div
                key={inv.token}
                className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4"
                data-testid={`row-pending-invitation-${inv.token}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">
                      {inviter} invited you to {childName}'s fund
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {roleLabel} role · Pending
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 rounded-xl"
                    onClick={() => { navigate(`/invitations/${inv.token}`); haptic("selection"); }}
                    data-testid={`button-open-invitation-${inv.token}`}
                  >
                    Open invitation
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
