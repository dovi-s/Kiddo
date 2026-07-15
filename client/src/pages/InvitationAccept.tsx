// Co-parent / family-member invitation acceptance page.
//
// Public route — anyone holding the link can land here. The token is
// the only proof we need to render the preview (no auth required);
// claiming the invitation does require sign-in so we can attach the
// row to a userId.
//
// Three render states:
//   1. Invitation not found / declined / expired — final message, no CTAs
//   2. Signed-out + pending — preview + Sign in / Create account CTA that
//      returns here after auth
//   3. Signed-in + pending — preview + Accept / Decline buttons
//
// Design lens: this is many invitees' FIRST exposure to Kora. The
// kid-at-18 lens applies even though the kid never sees this page —
// because how a co-parent or grandparent describes Kiddo to others
// is shaped here. So the copy is honest about custodial scope
// ("you are not on the legal UTMA account"), explicit about role
// limits, and absolutely zero confetti / sparkles / persuasion
// theatre. Apple-Settings register.

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type InvitationPreview = {
  token: string;
  status: "pending" | "accepted" | "declined";
  role: "viewer" | "co-admin";
  email: string;
  childFirstName: string | null;
  fundNickname: string | null;
  inviterFirstName: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
};

async function fetchInvitation(token: string): Promise<InvitationPreview> {
  const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, { credentials: "include" });
  if (res.status === 404) throw new Error("Invitation not found.");
  if (!res.ok) throw new Error("Could not load invitation.");
  return res.json();
}

export default function InvitationAccept() {
  const params = useParams() as { token?: string };
  const token = String(params.token || "");
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: invitation, isLoading, error } = useQuery<InvitationPreview>({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvitation(token),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not accept the invitation.");
      }
      return res.json();
    },
    onSuccess: () => {
      // Drop the cached /api/funds list so the dashboard picks up the
      // newly-shared fund on the next render rather than waiting for
      // the polling tick.
      void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/me/invitations"] });
      setLocation("/dashboard");
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/decline`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not decline the invitation.");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invitation", token] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  // After auth completes, /login uses its existing ?redirect= param to
  // bounce the user back here. See getSafeRedirectTarget in Login.tsx.
  const handleSignInRedirect = () => {
    setLocation(`/login?redirect=${encodeURIComponent(`/invitations/${token}`)}`);
  };

  if (isLoading || authLoading) {
    return (
      <PageShell>
        <p style={{ color: "rgba(0,0,0,0.5)", textAlign: "center", padding: "60px 20px" }}>Loading invitation...</p>
      </PageShell>
    );
  }

  if (error || !invitation) {
    return (
      <PageShell>
        <Card>
          <CardContent style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Invitation not found</h1>
            <p style={{ fontSize: 14, color: "rgba(0,0,0,0.6)", lineHeight: 1.5 }}>
              This invitation link is no longer valid. If you think that's wrong, ask the parent who invited you to resend it.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const childName = invitation.childFirstName || "their child";
  const inviter = invitation.inviterFirstName || "A parent on Kiddo";
  const roleLabel = invitation.role === "co-admin" ? "Co-parent (can edit)" : "Viewer (read-only)";

  // Already accepted — let them straight through to dashboard.
  if (invitation.status === "accepted") {
    return (
      <PageShell>
        <Card>
          <CardContent style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>You're already on this fund</h1>
            <p style={{ fontSize: 14, color: "rgba(0,0,0,0.6)", marginBottom: 20, lineHeight: 1.5 }}>
              You accepted this invitation already. {childName}'s fund is in your dashboard.
            </p>
            <Button onClick={() => setLocation("/dashboard")}>Go to dashboard</Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // Declined — explain and stop.
  if (invitation.status === "declined") {
    return (
      <PageShell>
        <Card>
          <CardContent style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Invitation declined</h1>
            <p style={{ fontSize: 14, color: "rgba(0,0,0,0.6)", lineHeight: 1.5 }}>
              You previously declined this invitation. If you'd like access now, ask {inviter} to send a new invite.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // Pending — render the preview.
  return (
    <PageShell>
      <Card>
        <CardContent style={{ padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🌱</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: "center", lineHeight: 1.3 }}>
            {inviter} invited you to {invitation.role === "co-admin" ? "co-manage" : "follow"} {childName}'s Kiddo fund
          </h1>
          <p style={{ fontSize: 13.5, color: "rgba(0,0,0,0.6)", marginBottom: 24, textAlign: "center", lineHeight: 1.5 }}>
            Kiddo is a custodial investment account for kids. {inviter} is asking you to {invitation.role === "co-admin" ? "help manage" : "follow along with"} {childName}'s account.
          </p>

          <div style={{
            background: "hsl(var(--cream))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(0,0,0,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {roleLabel}
            </p>
            <p style={{ fontSize: 13, color: "rgba(0,0,0,0.72)", lineHeight: 1.5, marginBottom: 12 }}>
              {invitation.role === "co-admin"
                ? `You'll be able to view ${childName}'s fund, create occasions, add Memory Book entries, and send thank-yous. Money and account settings stay with ${inviter}.`
                : `You'll be able to view ${childName}'s balance, gifts, and Memory Book entries. You will not be able to make changes.`}
            </p>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.55 }}>
              <div style={{ marginBottom: 4 }}>· You are not added to the legal UTMA account itself; that stays with {inviter}.</div>
              <div style={{ marginBottom: 4 }}>· Access can be revoked any time.</div>
              {/* No hardcoded 18 — majority is 21 in most states, 19 in AL/NE.
                  The invite payload doesn't carry the fund's majorityAge, so
                  say the rule, not a number. */}
              <div>· Access ends automatically when {childName} reaches their state's age of majority and takes ownership of their fund.</div>
            </div>
          </div>

          {actionError && (
            <div style={{
              background: "hsl(0 80% 96%)",
              border: "1px solid hsl(0 70% 80%)",
              color: "hsl(0 60% 35%)",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}>
              {actionError}
            </div>
          )}

          {!user ? (
            <div>
              <p style={{ fontSize: 13, color: "rgba(0,0,0,0.6)", marginBottom: 16, textAlign: "center" }}>
                Sign in or create your Kiddo account to accept.
              </p>
              <Button onClick={handleSignInRedirect} style={{ width: "100%" }}>
                Sign in to continue
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                style={{ flex: 1 }}
                data-testid="button-accept-invitation"
              >
                {acceptMutation.isPending ? "Accepting..." : `Accept ${invitation.role === "co-admin" ? "co-parent" : "viewer"} access`}
              </Button>
              <Button
                variant="outline"
                onClick={() => declineMutation.mutate()}
                disabled={declineMutation.isPending}
                style={{ flex: 1 }}
                data-testid="button-decline-invitation"
              >
                {declineMutation.isPending ? "Declining..." : "Decline"}
              </Button>
            </div>
          )}

          <p style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
            Powered by Kiddo · gifts that actually last 🌱
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "hsl(var(--cream))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>{children}</div>
    </div>
  );
}

// Ensure the unused `useEffect` import doesn't trip linters if this file
// is later trimmed. Kept available for future analytics ping on view.
void useEffect;
