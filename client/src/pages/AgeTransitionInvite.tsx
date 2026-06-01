import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
// Lightbulb replaces Sparkles 2026-05-12 — Sparkles banned per
// feedback_no_ai_slop.md. The "What happens next" header is the
// gentle-nudge pattern per feedback_gentle_nudge_pattern.md.
import { ArrowRight, CheckCircle2, Heart, Lock, Mail, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { capFirst } from "@/lib/format-name";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatAgeTransitionDate, getAge18Transition } from "@/lib/age-transition";
import { getEmbedVideoUrl } from "@/lib/media";
import { useCountUp } from "@/hooks/use-count-up";

type TransitionPayload = {
  policy?: {
    preview?: { entryLimit: number; mode: string; message: string };
    delivery?: { mode: string; message: string };
  };
  tokenType: "preview" | "invite";
  mode: "preview" | "invite" | "handoff";
  supportEmail: string;
  fund: {
    id: string;
    name: string;
    recipientFirstName: string | null;
    recipientBirthdate: string | null;
    balance: string;
    giftCount: number;
    contributorCount: number;
  };
  parent: { firstName: string | null; message: string | null };
  child: { email: string | null; claimedAt: string | null; claimedByEmail: string | null };
  timeline: { handoffRequestedAt: string | null; ownershipTransferredAt: string | null };
  // Sealed letter — the parent's at-18 reveal artifact. Null when no
  // letter exists or the kid is in preview mode (server-side gates this
  // via the entry-level kid_at_18 visibility filter). isSealedLetter
  // distinguishes the deliberately-saved-for-today variant (wax-seal
  // styling) from a legacy always-readable parent letter.
  sealedLetter: {
    id: string;
    content: string | null;
    authorName: string | null;
    createdAt: string;
    isSealedLetter: boolean;
  } | null;
  // Gifters list — populated only post-transfer (server gates on
  // ownershipTransferredAt). The "Thank your gifters" section on the claim
  // page renders from this; each gifter gets a mailto: thank-you button.
  gifters: Array<{
    email: string;
    name: string;
    totalGifted: string;
    lastMessage: string | null;
    lastGiftAt: string | null;
  }>;
  memories: Array<{
    id: string;
    content: string | null;
    authorName: string | null;
    photoUrl: string | null;
    videoUrl: string | null;
    createdAt: string;
    gift?: { senderName: string; message: string | null } | null;
  }>;
};

function formatMoney(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AgeTransitionInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, login, register, isLoggingIn, isRegistering } = useAuth();
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");

  const { data, isLoading, refetch } = useQuery<TransitionPayload>({
    queryKey: ["age-transition-token", token],
    queryFn: async () => {
      const res = await fetch(`/api/age-transition/${token}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load transition");
      return res.json();
    },
    enabled: !!token,
  });

  const ageTransition = useMemo(
    () => getAge18Transition(data?.fund.recipientBirthdate, Number((data?.fund as any)?.majorityAge) || 18),
    [data?.fund.recipientBirthdate, (data?.fund as any)?.majorityAge],
  );
  const currentUserEmail = user?.email ? String(user.email).trim().toLowerCase() : null;

  // Count-up on the kid's three hero stats. This is the celebratory
  // moment surface — kid lands on it on their 18th, gets the page
  // that introduces the fund their family built. The numbers should
  // settle in like a slow reveal, not flash flat. Per the kid-at-18
  // lens this surface explicitly licenses Mubi-emotional motion.
  const inviteBalance = parseFloat(String(data?.fund.balance ?? 0));
  const inviteGiftCount = Number(data?.fund.giftCount ?? 0);
  const inviteContributorCount = Number(data?.fund.contributorCount ?? 0);
  const { value: animatedInviteBalance, isAnimating: inviteBalanceAnimating } = useCountUp({
    from: inviteBalance * 0.85,
    to: inviteBalance,
    duration: 1400,
    enabled: inviteBalance > 0,
  });
  const { value: animatedInviteGiftCount, isAnimating: inviteGiftCountAnimating } = useCountUp({
    from: 0,
    to: inviteGiftCount,
    duration: 1000,
    enabled: inviteGiftCount > 0,
  });
  const { value: animatedInviteContribCount, isAnimating: inviteContribCountAnimating } = useCountUp({
    from: 0,
    to: inviteContributorCount,
    duration: 1000,
    enabled: inviteContributorCount > 0,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/age-transition/${token}/claim`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Could not accept invite");
      return payload;
    },
    onSuccess: async (payload) => {
      toast({
        title: "Invite accepted",
        description: payload?.nextStep || "The handoff is moving forward.",
      });
      await refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Could not accept invite", description: error.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/age-transition/${token}/complete`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Could not complete transfer");
      return payload;
    },
    onSuccess: async (payload) => {
      toast({
        title: "Transfer complete",
        description: payload?.nextStep || "The fund now appears in your Kiddo account.",
      });
      // Route to the at-handoff walkthrough. Per AGE_18_HANDOFF_SPEC.md
      // bucket 1: the 60 minutes after ownership transfers are where
      // the kid actually learns what they own and what to do with it.
      // The walkthrough self-redirects to /dashboard on completion.
      // fundId is read from the payload OR the existing data.fund.id —
      // belt-and-suspenders for the case where the server response
      // shape evolves.
      const fundId = payload?.fundId || data?.fund.id;
      if (fundId) {
        setLocation(`/welcome-at-18?fundId=${encodeURIComponent(fundId)}`);
      } else {
        // Fallback if no fund id surfaces — refetch the page so the
        // existing "transfer complete" state renders.
        await refetch();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not complete transfer", description: error.message, variant: "destructive" });
    },
  });

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === "register") {
        await register({ email, password, firstName });
      } else {
        const result = await login({ email, password });
        if ((result as any)?.twoFactorRequired) {
          // 2FA-enrolled account: no session yet. Complete sign-in (incl. the
          // code step) on the full login page, then return to this invite.
          window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
      }
      await claimMutation.mutateAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not continue";
      toast({ title: "Could not continue", description: message, variant: "destructive" });
    }
  };

  if (isLoading || !data) return <div className="min-h-screen bg-background" />;

  const alreadyClaimed = Boolean(data.child.claimedAt);
  const transferCompleted = Boolean(data.timeline.ownershipTransferredAt);
  const canCompleteTransfer =
    Boolean(isAuthenticated && alreadyClaimed && !transferCompleted) &&
    currentUserEmail === String(data.child.claimedByEmail || "").trim().toLowerCase();
  const heading =
    data.mode === "preview" ? "A preview of what your family built for you." : "Your Kiddo fund is ready for you.";

  return (
    <div className="min-h-screen bg-background gemini-warm-section">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/">
            <span className="cursor-pointer">
              <Logo size="md" className="text-foreground" />
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock size={12} />
            <span>Private link</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border/50 bg-card p-8 shadow-premium-sm"
        >
          <p className="text-sm font-medium text-primary">
            {data.mode === "preview" ? "Age-17 preview" : data.mode === "handoff" ? "Age-18 handoff" : "Age-18 invite"}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground md:text-5xl">{heading}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
            {data.mode === "preview"
              ? "This is the story-first preview. It shows the gifts, notes, and momentum your family and friends built over time."
              : "Nothing is automatically sold on this birthday. The investments stay where they are. What changes is who controls the Kiddo account around them, and this page handles that part."}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs text-muted-foreground">Invested so far</p>
              <p
                className="mt-1 text-xl font-semibold text-foreground tabular-nums"
                aria-live={inviteBalanceAnimating ? "off" : "polite"}
                aria-label={formatMoney(inviteBalance)}
              >{formatMoney(animatedInviteBalance)}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs text-muted-foreground">Gifts received</p>
              <p
                className="mt-1 text-xl font-semibold text-foreground tabular-nums"
                aria-live={inviteGiftCountAnimating ? "off" : "polite"}
                aria-label={String(inviteGiftCount)}
              >{Math.round(animatedInviteGiftCount)}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs text-muted-foreground">People who gave</p>
              <p
                className="mt-1 text-xl font-semibold text-foreground tabular-nums"
                aria-live={inviteContribCountAnimating ? "off" : "polite"}
                aria-label={String(inviteContributorCount)}
              >{Math.round(animatedInviteContribCount)}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs text-muted-foreground">Planning anchor</p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {ageTransition ? formatAgeTransitionDate(ageTransition.eighteenthBirthday) : "Age 18"}
              </p>
            </div>
          </div>
          {data.parent.message ? (
            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs uppercase tracking-wide text-primary">
                A note from {data.parent.firstName || "your parent"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{data.parent.message}</p>
            </div>
          ) : null}
        </motion.section>

        {/* Sealed letter — the emotional capstone of the claim flow. Lives
            BETWEEN the hero (financial summary) and the Memory Book grid
            (gift highlights). Pulled out as its own full-width section
            because the wax-sealed letter IS the moment, not one of N
            highlights. Two visual variants:
              - isSealedLetter=true  → wax-seal red mark + "Unsealed today"
                kicker. Mirrors the at-18 ceremony rendering in KidView.
              - isSealedLetter=false → softer kiddo-gold styling for the
                legacy always-readable parent letter (parent wrote it in
                the older Age18Plan editor, marked as kid_now visibility).
            Renders only when the API returns a non-null sealedLetter (gated
            server-side by entry-level visibility filter so preview-mode
            requests never expose the kid_at_18 entry). */}
        {data.sealedLetter && (() => {
          const letter = data.sealedLetter;
          const author = (letter.authorName || data.parent.firstName || "your parent").trim();
          if (letter.isSealedLetter) {
            return (
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.45 }}
                className="relative rounded-3xl border p-8 shadow-premium-sm"
                style={{
                  borderColor: "rgba(140,30,30,0.32)",
                  background:
                    "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 60%, rgba(140,30,30,0.04) 100%)",
                }}
                data-testid="age-transition-sealed-letter"
              >
                {/* Wax seal disc, top-right */}
                <div className="absolute -top-5 right-7">
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle at 38% 32%, rgb(196,42,42) 0%, rgb(140,30,30) 55%, rgb(96,18,18) 100%)",
                      boxShadow:
                        "inset -3px -4px 9px rgba(0,0,0,0.32), 0 4px 14px rgba(140,30,30,0.20)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.92)",
                        fontFamily: "Georgia, serif",
                        textShadow: "0 1px 2px rgba(0,0,0,0.32)",
                      }}
                    >
                      {(author[0] || "P").toUpperCase()}
                    </span>
                  </div>
                </div>
                <p
                  className="text-xs font-semibold uppercase mb-2"
                  style={{ color: "rgba(140,30,30,0.85)", letterSpacing: "0.14em" }}
                >
                  Unsealed today
                </p>
                <p className="font-heading text-xl font-bold text-foreground leading-snug mb-5">
                  {author} wrote this knowing you would read it today.
                </p>
                <p className="font-serif text-lg leading-relaxed text-foreground italic">
                  &ldquo;{letter.content}&rdquo;
                </p>
                <p className="mt-6 text-xs text-muted-foreground">With love, {author}</p>
              </motion.section>
            );
          }
          return (
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="rounded-3xl border p-8 shadow-premium-sm"
              style={{
                borderColor: "hsl(var(--kiddo-gold) / 0.30)",
                background:
                  "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 60%, hsl(var(--kiddo-gold) / 0.10) 100%)",
              }}
              data-testid="age-transition-parent-letter"
            >
              <p
                className="text-xs font-semibold uppercase mb-3"
                style={{ color: "hsl(var(--kiddo-gold-ink) / 0.85)", letterSpacing: "0.14em" }}
              >
                A note from {author}
              </p>
              <p className="font-serif text-lg leading-relaxed text-foreground italic">
                &ldquo;{letter.content}&rdquo;
              </p>
              <p className="mt-5 text-xs text-muted-foreground">With love, {author}</p>
            </motion.section>
          );
        })()}

        <section className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-primary" />
              <h2 className="font-heading text-xl font-semibold text-foreground">Memory Book highlights</h2>
            </div>
            <div className="mt-5 space-y-4">
              {data.memories.slice(0, 4).map((memory) => {
                const embed = getEmbedVideoUrl(memory.videoUrl);
                return (
                  <div key={memory.id} className="rounded-2xl border border-border/50 bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {memory.authorName || memory.gift?.senderName || "Someone who loves you"} ·{" "}
                      {formatDate(memory.createdAt)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {memory.content || memory.gift?.message || "A gift that became part of your story."}
                    </p>
                    {memory.photoUrl ? (
                      <img src={memory.photoUrl} alt="Memory" loading="lazy" className="mt-3 max-h-64 w-full rounded-2xl object-cover" />
                    ) : null}
                    {embed ? (
                      <iframe
                        src={embed}
                        title="Memory video"
                        className="mt-3 h-56 w-full rounded-2xl"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-primary" />
                <h2 className="font-heading text-xl font-semibold text-foreground">What happens next</h2>
              </div>
              <div className="mt-4 rounded-2xl border border-border/50 bg-background p-4 text-xs leading-relaxed text-muted-foreground">
                <p><span className="font-medium text-foreground">Preview policy:</span> {data.policy?.preview?.message || "The age-17 preview is read-only and meant to introduce the story before ownership changes."}</p>
                <p className="mt-2"><span className="font-medium text-foreground">Delivery policy:</span> {data.policy?.delivery?.message || "The final handoff happens through a private invite link and Kiddo account claim."}</p>
              </div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                {data.mode === "preview" ? (
                  <>
                    <p>This is the preview year. The story is here now so the handoff later feels familiar, not bureaucratic.</p>
                    <p>When the age-of-majority milestone arrives, the invite step begins and the child can accept it through their own Kiddo account.</p>
                  </>
                ) : transferCompleted ? (
                  <>
                    <p>The Kiddo ownership transfer is complete.</p>
                    <p>The fund now lives in the child's own Kiddo account, and the investments themselves stayed where they were.</p>
                  </>
                ) : alreadyClaimed ? (
                  <>
                    <p>The invite has already been accepted.</p>
                    <p>The final step now is completing the Kiddo ownership transfer so this fund moves into the child's own account.</p>
                  </>
                ) : (
                  <>
                    <p>Create or sign into your Kiddo account, then accept the invite.</p>
                    <p>After that, you can finish the Kiddo-side transfer right here on this page.</p>
                  </>
                )}
              </div>
            </div>

            {data.mode !== "preview" ? (
              <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
                {transferCompleted ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      <CheckCircle2 size={14} />
                      Transfer complete
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Completed on {formatDate(data.timeline.ownershipTransferredAt)}.
                    </p>
                    <Link href="/dashboard">
                      <Button className="w-full" data-testid="button-go-dashboard-transition-complete">
                        Go to your dashboard
                      </Button>
                    </Link>
                  </div>
                ) : alreadyClaimed ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      <CheckCircle2 size={14} />
                      Invite accepted
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Accepted on {formatDate(data.child.claimedAt)}
                      {data.child.claimedByEmail ? ` as ${data.child.claimedByEmail}` : ""}.
                    </p>
                    {canCompleteTransfer ? (
                      <>
                        <Button
                          onClick={() => completeMutation.mutate()}
                          disabled={completeMutation.isPending}
                          className="w-full"
                          data-testid="button-complete-kiddo-transfer"
                        >
                          {completeMutation.isPending ? "Completing transfer..." : "Complete Kiddo transfer"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          This moves the fund into your own Kiddo account and ends the parent-managed view in-app.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        The child account that accepted this invite needs to finish the final transfer step from this page.
                      </p>
                    )}
                  </div>
                ) : isAuthenticated ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Signed in as <span className="font-medium text-foreground">{user?.email}</span>.
                    </p>
                    <Button
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending}
                      className="w-full"
                      data-testid="button-accept-transition-invite"
                    >
                      {claimMutation.isPending ? "Accepting..." : "Accept invite"}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div className="flex gap-2 text-sm">
                      <button
                        type="button"
                        className={authMode === "register" ? "text-foreground" : "text-muted-foreground"}
                        onClick={() => setAuthMode("register")}
                      >
                        Create account
                      </button>
                      <button
                        type="button"
                        className={authMode === "login" ? "text-foreground" : "text-muted-foreground"}
                        onClick={() => setAuthMode("login")}
                      >
                        Sign in
                      </button>
                    </div>
                    {authMode === "register" ? (
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      />
                    ) : null}
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={data.child.email || "you@example.com"}
                        className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm"
                        required
                      />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      required
                    />
                    <Button
                      type="submit"
                      disabled={isLoggingIn || isRegistering || claimMutation.isPending}
                      className="w-full"
                      data-testid="button-transition-auth-submit"
                    >
                      {isLoggingIn || isRegistering || claimMutation.isPending
                        ? "Working..."
                        : authMode === "register"
                          ? "Create account and accept invite"
                          : "Sign in and accept invite"}
                      <ArrowRight size={16} className="ml-2" />
                    </Button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {/* Thank-your-gifters section — appears AFTER the kid completes
            the Kiddo transfer. Lists every person who ever gave to this
            fund (deduped by email, totals summed if they gave multiple
            times) with a one-tap mailto: thank-you. The mailto: opens
            the kid's default mail client pre-populated with subject +
            body — they can edit before sending. We don't proxy through
            the server because:
              - the kid is now the fund owner; their mail flows from
                their own address (more personal than a server-proxied
                noreply)
              - it gives them control over the message wording without
                requiring an app-side editor
              - mailto: works on every device + every mail app without
                deliverability concerns

            The first action a brand-new 18-year-old fund owner takes
            should be a generous one. Showing this section above "Go
            to your dashboard" makes that the obvious next step. */}
        {transferCompleted && data.gifters.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4 }}
            className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm md:p-8"
            data-testid="thank-your-gifters"
          >
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-primary" />
              <h2 className="font-heading text-xl font-semibold text-foreground">Thank the people who gave</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              These are the people who built this fund with you. The first thing you might want to do as the new owner: tell them you got it.
            </p>
            <div className="mt-5 space-y-3">
              {data.gifters.map((gifter) => {
                const childName = capFirst(data.fund.recipientFirstName) || "me";
                const giftCount = parseFloat(gifter.totalGifted) > 0 ? formatMoney(gifter.totalGifted) : "";
                const subject = `Thank you for your gift to ${childName}'s fund`;
                const lines = [
                  `Hi ${gifter.name.split(" ")[0] || "there"},`,
                  "",
                  `I just took ownership of the Kiddo fund my family built for me. ${giftCount ? `Your ${giftCount} gift was part of it.` : "Your gift was part of it."}`,
                  "",
                  "Thank you. I wouldn't have this without you.",
                  "",
                  childName,
                ];
                const mailto = `mailto:${encodeURIComponent(gifter.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
                return (
                  <div
                    key={gifter.email}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-border/50 bg-background p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{gifter.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {giftCount ? `${giftCount} given` : "gave to your fund"}
                        {gifter.lastGiftAt ? ` · last on ${formatDate(gifter.lastGiftAt)}` : ""}
                      </p>
                      {gifter.lastMessage && (
                        <p className="mt-2 font-serif text-sm italic text-foreground/90">&ldquo;{gifter.lastMessage}&rdquo;</p>
                      )}
                    </div>
                    <a
                      href={mailto}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      data-testid={`thank-gifter-${gifter.email}`}
                    >
                      <Mail size={12} />
                      Send thank-you
                    </a>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">
              Tapping opens your mail app with a pre-filled message. You can edit it before sending.
            </p>
          </motion.section>
        )}
      </main>
    </div>
  );
}



