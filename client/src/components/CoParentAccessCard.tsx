// CoParentAccessCard — invite a partner or guardian to a fund.
//
// Extracted from Settings.tsx on 2026-05-14 as Phase 2 sheet-
// extraction chunk 7. Largest single extraction in the series:
// the full Co-parent access section including the collaborators
// query, the access list rendering, the "How it works" explainer
// (shown when zero collaborators), the "Your access" identity
// row, the Plus-gate explainer card, and the FeatureWallModal
// instance that fires when a free user taps Invite.
//
// Owns:
//   • useQuery on /api/funds/:id/collaborators
//   • handleDeleteCollaborator handler
//   • coParentWallOpen state + the FeatureWallModal instance
//
// Takes (as props):
//   • fund (the active per-fund context)
//   • user (current auth user — drives the "Your access" row's
//     name + avatar + initials)
//   • userPlan (current plan tier — gates the Invite path between
//     direct-modal vs upgrade-wall)
//   • onOpenInviteModal (callback to open the
//     CollaboratorInviteModal which lives in Settings because
//     the modal is a wider surface that other Settings flows
//     also touch)
//
// Plan tier policy (per memory): Plus, Family, and Legacy all
// unlock co-parent invites. Pricing rationale: Plus is feature-
// gated per fund, Family is Plus across multiple funds. Co-
// parent access is a per-fund feature, so Plus is the natural
// floor. The "Grandparent / family access controls" Legacy line
// was retired in the 2026-05-12 sweep — no separate feature
// existed in code; same code path as Plus.
//
// When a free user taps Invite, the FeatureWallModal fires
// (locked dismissedFeatureWalls pattern — softer second-touch
// copy on repeat encounters). The Plus-gate explainer card at
// the bottom of the section is intentionally KEPT — it teaches
// what co-parent access actually does on every visit, which
// the previous "Upgrade to share fund access" copy glossed
// over. The wall fires only on deliberate tap so passive
// readers aren't modal-spammed.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { UserPlus, KeyRound, Eye, Ban, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { demoBlocked } from "@/lib/demo-block";
import { capFirst } from "@/lib/format-name";
import { readLocalCache, writeLocalCache } from "@/lib/local-cache";

// Per-fund collaborators cache. Same readLocalCache / writeLocalCache
// pattern as funds / activities / events queries (see use-funds,
// use-activities, etc.). Cache key includes the fund id so a multi-
// kid parent's funds don't cross-contaminate. Was added 2026-05-20
// after user-reported "this keeps holding and popping up and waiting
// to load on refresh, it should go faster" — the query had no
// staleTime AND no initialData, so every mount fired a fresh network
// request and the "How it works" empty explainer flashed during the
// load before the actual collaborator list resolved.
const COLLABORATORS_CACHE_PREFIX = "kiddo.collaborators.v1";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

type FundShape = {
  id?: string;
  recipientFirstName?: string | null;
};

type UserShape = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
};

type Collaborator = {
  id: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  invitedAt?: string | null;
};

const VIEWER_PERMS = ["View balance", "View activity", "See Memory Book"];
const ADMIN_PERMS = ["View balance", "View activity", "See Memory Book", "Create events", "Edit settings"];
const DENIED_VIEWER = ["Create events", "Edit settings"];

export function CoParentAccessCard({
  fund,
  user,
  userPlan,
  onOpenInviteModal,
}: {
  fund: FundShape;
  user: UserShape | null | undefined;
  userPlan: string;
  onOpenInviteModal: () => void;
}) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [wallOpen, setWallOpen] = useState(false);

  // initialData + staleTime + cache-write trio. With initialData a
  // returning user sees their access list instantly from localStorage
  // while the live fetch confirms in the background. With staleTime
  // the query does not re-fetch on every mount; navigating away and
  // back within 5 minutes uses the in-memory cache directly.
  // Mutations (invite, delete) invalidate the query so no genuinely-
  // stale data is ever shown for actionable events.
  //
  // isFetched is what we use below to decide whether to render the
  // "How co-parent access works" empty explainer. Before the query
  // has settled once, data may legitimately default to [] without
  // meaning "this user has no collaborators." Gating the explainer
  // on isFetched avoids the flash where the explainer renders
  // during load and then disappears when the real list comes in.
  const { data: collaborators = [], isFetched } = useQuery<Collaborator[]>({
    queryKey: ["/api/funds", fund?.id, "collaborators"],
    queryFn: async () => {
      if (!fund?.id) return [];
      const res = await fetch(`/api/funds/${fund.id}/collaborators`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      if (fund.id) {
        writeLocalCache(`${COLLABORATORS_CACHE_PREFIX}:${fund.id}`, data);
      }
      return data;
    },
    enabled: !!fund?.id,
    initialData: () => (fund?.id ? readLocalCache<Collaborator[]>(`${COLLABORATORS_CACHE_PREFIX}:${fund.id}`) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  const canInvite = userPlan === "starter" || userPlan === "family" || userPlan === "legacy";
  const childName = capFirst(fund?.recipientFirstName);
  const ownerName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "You";
  const ownerInitial = (user?.firstName || user?.email || "U").slice(0, 1).toUpperCase();

  const handleDelete = async (collabId: string) => {
    if (!fund?.id) return;
    haptic("medium");
    try {
      const res = await fetch(`/api/funds/${fund.id}/collaborators/${collabId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (demoBlocked(data, toast)) return;
        queryClient.invalidateQueries({ queryKey: ["/api/funds", fund.id, "collaborators"] });
        toast({ title: "Collaborator removed" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Could not remove", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not remove", description: "Please try again", variant: "destructive" });
    }
  };

  return (
    <SectionCard>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-foreground">Co-parent access</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Share {childName ? `${childName}'s` : "this"} fund with a partner or guardian.
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 rounded-xl gap-1.5"
            onClick={() => {
              haptic("light");
              // Free users: open the FeatureWallModal so the tap
              // lands on a clear "this is Plus" moment with one-
              // tap upgrade. Was previously a hard `disabled` which
              // left the free user with a dead button and no path
              // forward. Plus/Family/Legacy: open the real invite
              // modal as before.
              if (canInvite) {
                onOpenInviteModal();
              } else {
                setWallOpen(true);
              }
            }}
            data-testid="button-invite-coparent"
          >
            <UserPlus size={13} />
            Invite
          </Button>
        </div>

        {/* How it works — shown only when the query has confirmed
            there are zero collaborators. Gating on isFetched (rather
            than just collaborators.length === 0) prevents the
            explainer from flashing during the initial load when
            data defaults to [] before the network resolves. Returning
            users with cached data see their access list directly via
            initialData and never hit this branch. */}
        {isFetched && collaborators.length === 0 && (
          <div className="mb-5 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-gradient-to-br from-[hsl(var(--kiddo-evergreen)/0.05)] to-[hsl(var(--kiddo-cream-dark)/0.4)] p-4">
            <p className="kiddo-section-label mb-3">How co-parent access works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { Icon: KeyRound, title: "You stay in control", body: "You are the legal custodian. They have no legal claim." },
                { Icon: Eye, title: "Choose their role", body: "Viewer or Co-Admin. You decide what they can see and do." },
                { Icon: Ban, title: "Revoke anytime", body: "Remove access instantly. Their session ends immediately." },
              ] as { Icon: LucideIcon; title: string; body: string }[]).map((item) => (
                <div key={item.title} className="rounded-xl bg-card p-3">
                  <item.Icon className="mb-1.5 text-[hsl(var(--kiddo-evergreen))]" size={20} strokeWidth={2} aria-hidden />
                  <p className="text-[11.5px] font-bold text-foreground mb-0.5">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Skeleton placeholder for the very first mount on a fresh
            session (no cached data, query not yet settled). Matches
            the explainer's footprint so the layout does not jump
            when the real content resolves. Only renders for first-
            mount-cold-session; returning users skip straight to the
            access list via cached initialData. */}
        {!isFetched && collaborators.length === 0 && (
          <div className="mb-5 rounded-2xl border border-[hsl(var(--kiddo-border)/0.5)] bg-muted/30 p-4 animate-pulse">
            <div className="h-3 w-32 bg-muted rounded mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl bg-card p-3">
                  <div className="h-5 w-5 bg-muted rounded mb-1.5" />
                  <div className="h-3 w-full bg-muted rounded mb-1" />
                  <div className="h-2.5 w-3/4 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Access list */}
        {collaborators.length > 0 && (
          <div className="mb-5">
            <p className="kiddo-section-label mb-3">Access list</p>
            <div className="space-y-3">
              {collaborators.map((collab) => {
                const isAdmin = collab.role === "co-admin";
                const granted = isAdmin ? ADMIN_PERMS : VIEWER_PERMS;
                const denied = isAdmin ? [] : DENIED_VIEWER;
                const invitedDate = collab.invitedAt
                  ? new Date(collab.invitedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : null;
                return (
                  <div key={collab.id} className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-cream-dark))] border border-[hsl(var(--kiddo-border))] text-sm font-bold text-foreground">
                        {(collab.email || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-foreground truncate">{collab.email}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${
                            collab.status === "accepted"
                              ? "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]"
                              : "bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold-ink))]"
                          }`}>
                            {collab.status === "accepted" ? "active" : "pending"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {collab.status === "accepted"
                            ? `${isAdmin ? "Co-Admin" : "Viewer"} · Accepted`
                            : invitedDate
                              ? `Invited ${invitedDate} · Awaiting acceptance`
                              : "Awaiting acceptance"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(collab.id)}
                        className="shrink-0 rounded-full border border-[hsl(var(--kiddo-border))] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors"
                        data-testid={`button-revoke-collab-${collab.id}`}
                      >
                        Revoke
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {granted.map((p) => (
                        <span key={p} className="rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[hsl(var(--kiddo-evergreen))]">
                          ✓ {p}
                        </span>
                      ))}
                      {denied.map((p) => (
                        <span key={p} className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground/60">
                          ✗ {p}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Your access */}
        <div className={collaborators.length > 0 ? "" : "mt-1"}>
          <p className="kiddo-section-label mb-3">Your access</p>
          <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">
              {user?.profileImageUrl
                ? <img src={user.profileImageUrl} alt="" loading="lazy" className="h-full w-full rounded-full object-cover" />
                : ownerInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{ownerName}</p>
              {/* "Primary custodian · Full control" already names the role, so
                  the separate "Primary" badge that used to sit here was the word
                  twice over — dropped it. */}
              <p className="text-xs text-muted-foreground">Primary custodian · Full control</p>
            </div>
          </div>
        </div>

        {/* Plan gate. Free users see the feature explainer cards
            above (kept on purpose — it teaches what co-parent
            access actually does, which the previous "Upgrade to
            share fund access" copy glossed over). The CTA was
            also softened from "See plans" to a direct primary
            upgrade button because the explainer above already
            does the education job; the gate's job is just to
            close the loop with one tap. */}
        {!canInvite && (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">Invite a co-parent with Kiddo+</p>
            <p className="mt-1 text-xs text-muted-foreground">
              $3.99/month or $29/year. A partner or guardian sees the fund's growth, the Memory Book, and recent gifts. Their notes show up on the kid's timeline alongside yours.
            </p>
            <Button
              size="sm"
              className="mt-3 rounded-xl"
              onClick={() => {
                haptic("selection");
                // Route to Account "Plan & billing" tab per the
                // WHO/HOW IA Phase 1c. Includes the current fund
                // id so the Plus upgrade auto-trigger fires for
                // THIS fund directly.
                navigate(fund?.id
                  ? `/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fund.id)}`
                  : "/account?tab=plan");
              }}
              data-testid="button-coparent-upgrade"
            >
              Upgrade to Kiddo+
            </Button>
          </div>
        )}
      </div>

      {/* Co-parent invite FeatureWallModal — fires when a free
          user taps Invite. fundId routed through so the Plus
          upgrade fires on the right fund (Plus is per-fund).
          Lives next to the trigger so the wall's state stays
          close to its consumer. */}
      <FeatureWallModal
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        featureId="co_parent_access"
        requiredTier="plus"
        title="Co-parent access is a Kiddo+ feature."
        body={`Invite a partner or guardian to see ${childName ? `${childName}'s` : "your child's"} fund. They get viewer or co-admin access; their notes land in the Memory Book alongside yours; you can revoke anytime. You stay the legal custodian. They have no legal claim.`}
        upgradePath={fund?.id ? `/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fund.id)}` : "/account?tab=plan"}
      />
    </SectionCard>
  );
}
