import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// Eye (preview) + CheckCircle2 (final transfer = completion moment) replace
// the earlier Sparkles + Wand2 picks (2026-05-12) — magic/celebration
// iconography is banned per feedback_no_ai_slop.md. Same family as
// sparkle-particles refused on Activate-investing earlier this session.
import { ArrowLeft, CheckCircle2, Copy, Mail, ShieldCheck, Eye, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { formatAgeTransitionDate, getAge18Transition } from "@/lib/age-transition";

type FundSummary = {
  id: string;
  name: string;
  recipientFirstName: string | null;
  recipientBirthdate: string | null;
};

type TransitionState = {
  policy?: {
    preview?: { entryLimit: number; mode: string; message: string };
    delivery?: { mode: string; message: string };
  };
  childEmail: string | null;
  parentMessage: string | null;
  previewLink: string | null;
  inviteLink: string | null;
  previewPreparedAt: string | null;
  invitedAt: string | null;
  childClaimedAt: string | null;
  claimedByEmail: string | null;
  handoffRequestedAt: string | null;
  ownershipTransferredAt: string | null;
  // Verification state for the child's email. Parent triggers verification
  // pre-18; kid clicks the link in their inbox to confirm. The age18
  // worker won't auto-send the at-18 invite unless verifiedAt is set.
  childEmailVerificationSentAt?: string | null;
  childEmailVerifiedAt?: string | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AgeTransitionManager() {
  const { fundId } = useParams<{ fundId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [childEmail, setChildEmail] = useState("");
  const [parentMessage, setParentMessage] = useState("");

  const { data: fund } = useQuery<FundSummary>({
    queryKey: ["fund", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load fund");
      return res.json();
    },
    enabled: !!fundId,
  });

  const { data: transition } = useQuery<TransitionState>({
    queryKey: ["age-transition", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/age-transition`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load handoff plan");
      return res.json();
    },
    enabled: !!fundId,
  });

  useEffect(() => {
    setChildEmail(transition?.childEmail || "");
    setParentMessage(transition?.parentMessage || "");
  }, [transition?.childEmail, transition?.parentMessage]);

  // State-specific UTMA majority age. Every "18" in this page's copy must
  // derive from this variable per project_state_majority_age_sweep.md —
  // this is the page that LITERALLY handles the state-transition flow, so
  // hardcoding "18" here is the deepest version of the violation.
  const majorityAge = Number((fund as any)?.majorityAge) || 18;
  const majorityOrdinal = (() => {
    const n = majorityAge;
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
    const lastOne = n % 10;
    if (lastOne === 1) return `${n}st`;
    if (lastOne === 2) return `${n}nd`;
    if (lastOne === 3) return `${n}rd`;
    return `${n}th`;
  })();
  const ageTransition = useMemo(
    () => getAge18Transition(fund?.recipientBirthdate, majorityAge),
    [fund?.recipientBirthdate, majorityAge],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["age-transition", fundId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/age-transition`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childEmail, parentMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save handoff details");
      return data;
    },
    onSuccess: async () => {
      await invalidate();
      haptic("success");
      toast({ title: "Saved", description: "The handoff plan is up to date." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/age-transition/verify-email-link`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not send verification email");
      return data;
    },
    onSuccess: async (data: any) => {
      await invalidate();
      haptic("success");
      toast({
        title: data?.alreadyVerified ? "Already verified" : "Verification email sent",
        description: data?.alreadyVerified
          ? "The child has already confirmed this email."
          : "They'll get a confirmation link to click.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: async (kind: "preview" | "invite") => {
      const res = await fetch(`/api/funds/${fundId}/age-transition/${kind}-link`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Could not create ${kind} link`);
      return { kind, data };
    },
    onSuccess: async ({ kind, data }) => {
      await invalidate();
      const link = kind === "preview" ? data?.previewLink : data?.inviteLink;
      if (link) await navigator.clipboard.writeText(link);
      haptic("success");
      toast({
        title: `${kind === "preview" ? "Preview" : "Invite"} link copied`,
        description: `The ${kind} link is ready to send.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not create link", description: error.message, variant: "destructive" });
    },
  });

  const canCreatePreview = Boolean(ageTransition?.previewEligible);
  const canCreateInvite = Boolean(ageTransition?.inviteEligible) && Boolean(childEmail.trim());

  return (
    <div className="min-h-screen bg-background pb-24 gemini-warm-section md:ml-[264px] md:pb-8">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <button
            onClick={() => setLocation("/dashboard")}
            className="-ml-2 rounded-xl p-2 transition-colors hover:bg-muted"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{fund?.name || "Fund"}</p>
            <h1 className="text-base font-semibold text-foreground">Age-{majorityAge} handoff plan</h1>
          </div>
          <Logo size="sm" className="text-foreground" linkTo={null} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
          <p className="text-sm font-medium text-primary">Timeline</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground">
            {fund?.recipientFirstName || "Your child"}'s transition window
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            This is more than a legal milestone. It is the moment when the child you started this for becomes the person who reads the story, sees the balance, and takes over the account.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs text-muted-foreground">17th birthday</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {ageTransition ? formatAgeTransitionDate(ageTransition.seventeenthBirthday) : "Add a birthdate first"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs text-muted-foreground">{majorityOrdinal} birthday</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {ageTransition ? formatAgeTransitionDate(ageTransition.eighteenthBirthday) : "Add a birthdate first"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs text-muted-foreground">Current stage</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {ageTransition?.countdownLabel || "Planning phase"}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
          <h2 className="font-heading text-xl font-semibold text-foreground">Write the handoff clearly</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Child email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  placeholder="future-owner@example.com"
                  className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm"
                  data-testid="input-transition-child-email"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4 text-sm text-muted-foreground">
              Nothing is sold automatically at {majorityAge}. The investments stay where they are unless the new owner
              later decides to sell, withdraw, or transfer them. What changes here is ownership, context, and responsibility.
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Final message</label>
            <p className="text-xs text-muted-foreground">Think of this like the note they will wish you left with the account, not a compliance field.</p>
            <textarea
              value={parentMessage}
              onChange={(e) => setParentMessage(e.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              placeholder="We started this when you were little. Every gift came from someone who loves you. We hope it helps you build the life you want."
              data-testid="textarea-transition-parent-message"
            />
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-transition-details"
          >
            {saveMutation.isPending ? "Saving..." : "Save handoff details"}
          </Button>
        </section>

        {/* Pre-18 prep section — two things the parent can do RIGHT NOW
            so the at-18 moment isn't a cold start: confirm the kid's
            email is correct (verification gate prevents the auto-send
            from going to a typo'd address), and share Kid View so the
            kid is familiar with the fund before they own it. Both are
            optional but recommended; both close real failure modes the
            architecture has otherwise. */}
        <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
          <h2 className="font-heading text-xl font-semibold text-foreground">Pre-{majorityAge} prep</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Two small things now make the at-{majorityAge} day land cleanly.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Email verification card */}
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheck size={16} className="text-primary" />
                <p className="text-sm font-semibold">Confirm their email</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {transition?.childEmail
                  ? `We send ${fund?.recipientFirstName || "them"} a one-click confirmation link. Until they click it, the at-${majorityAge} invite won't auto-send (in case the address has a typo).`
                  : "Add their email above first, then we can confirm it's reaching them."}
              </p>
              {transition?.childEmailVerifiedAt ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <CheckCircle2 size={12} />
                  Verified
                </div>
              ) : transition?.childEmailVerificationSentAt ? (
                <div className="space-y-2">
                  <p className="text-[11px] italic text-muted-foreground">
                    Verification email sent — waiting on them to click the link.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!transition?.childEmail || verifyEmailMutation.isPending}
                    onClick={() => verifyEmailMutation.mutate()}
                    data-testid="button-resend-email-verification"
                  >
                    {verifyEmailMutation.isPending ? "Sending..." : "Re-send verification"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!transition?.childEmail || verifyEmailMutation.isPending}
                  onClick={() => verifyEmailMutation.mutate()}
                  data-testid="button-send-email-verification"
                >
                  {verifyEmailMutation.isPending ? "Sending..." : "Send verification email"}
                </Button>
              )}
            </div>

            {/* Kid View share card — the at-18 moment lands cleaner if
                the kid has been in Kid View before (knows their fund,
                seen the holdings, read the gifter notes). Most kids
                whose parents never share Kid View arrive at 18 cold.
                Pointing them to the dashboard is correct because the
                share-with-PIN flow lives there; we don't reproduce it
                here. */}
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <UserRound size={16} className="text-primary" />
                <p className="text-sm font-semibold">Share Kid View</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Kid View is the kid-friendly view of the fund — their gifts, holdings, stock explainers. Shared via private link and PIN. Sharing it pre-{majorityAge} means {fund?.recipientFirstName || "they"} won't arrive at {majorityAge} cold.
              </p>
              <a
                href={`/dashboard?fund=${encodeURIComponent(fundId || "")}`}
                className="block"
              >
                <Button variant="outline" size="sm" className="w-full" data-testid="button-open-kid-view-share">
                  Open dashboard to share
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
          <h2 className="font-heading text-xl font-semibold text-foreground">How Kiddo handles the handoff</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <Eye size={16} className="text-primary" />
                <p className="text-sm font-semibold">Age-17 preview</p>
              </div>
              <p className="text-xs text-muted-foreground">Let them see the story before the responsibility becomes real.</p>
              <Button
                variant="outline"
                className="w-full"
                disabled={!canCreatePreview || createLinkMutation.isPending}
                onClick={() => createLinkMutation.mutate("preview")}
                data-testid="button-create-preview-link"
              >
                {createLinkMutation.isPending ? "Preparing..." : "Create preview link"}
              </Button>
              {transition?.previewLink ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => navigator.clipboard.writeText(transition.previewLink!)}
                  data-testid="button-copy-preview-link"
                >
                  <Copy size={12} />
                  Copy current link
                </button>
              ) : null}
            </div>
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <UserRound size={16} className="text-primary" />
                <p className="text-sm font-semibold">Age-{majorityAge} invite</p>
              </div>
              <p className="text-xs text-muted-foreground">This is the private link that brings them into the transfer flow.</p>
              <Button
                variant="outline"
                className="w-full"
                disabled={!canCreateInvite || createLinkMutation.isPending}
                onClick={() => createLinkMutation.mutate("invite")}
                data-testid="button-create-invite-link"
              >
                {createLinkMutation.isPending ? "Preparing..." : "Create invite link"}
              </Button>
              {transition?.inviteLink ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => navigator.clipboard.writeText(transition.inviteLink!)}
                  data-testid="button-copy-invite-link"
                >
                  <Copy size={12} />
                  Copy current invite
                </button>
              ) : null}
            </div>
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 size={16} className="text-primary" />
                <p className="text-sm font-semibold">Final transfer</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card p-3 text-sm text-muted-foreground">
                {transition?.ownershipTransferredAt
                  ? "Completed. The fund now lives in the child's own Kiddo account."
                  : transition?.childClaimedAt
                    ? "They accepted the invite. The last step is turning this from a parent-managed account into their own."
                    : "This last step unlocks after they accept the invite from their own account."}
              </div>
              {transition?.inviteLink && !transition?.ownershipTransferredAt ? (
                <a href={transition.inviteLink} className="block">
                  <Button variant="outline" className="w-full" data-testid="button-open-child-transfer-link">
                    Open current child link
                  </Button>
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
          <h2 className="font-heading text-xl font-semibold text-foreground">Preview and delivery policy</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Age-17 preview</p>
              <p className="mt-2 text-sm text-foreground">Read-only preview of up to {transition?.policy?.preview?.entryLimit || 6} Memory Book highlights.</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{transition?.policy?.preview?.message || "The preview is a private read-only link so the story arrives before the legal transfer does."}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Final delivery at {majorityAge}</p>
              <p className="mt-2 text-sm text-foreground">Private invite link plus Kiddo account claim.</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{transition?.policy?.delivery?.message || "Kiddo completes the handoff through a private invite and account claim instead of a public page or automatic PDF attachment."}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm">
          <h2 className="font-heading text-xl font-semibold text-foreground">Progress</h2>
          <div className="mt-4 space-y-4">
            {[
              { label: "Preview prepared", date: transition?.previewPreparedAt },
              { label: "Invite prepared", date: transition?.invitedAt },
              { label: "Child accepted the invite", date: transition?.childClaimedAt, meta: transition?.claimedByEmail || null },
              { label: "Kiddo transfer completed", date: transition?.ownershipTransferredAt },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
                    item.date ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 size={14} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.date ? `${formatDateTime(item.date)}${item.meta ? ` · ${item.meta}` : ""}` : "Not completed yet"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 text-sm text-muted-foreground">
            Questions?{" "}
            <a href="mailto:support@kiddofund.com" className="text-primary hover:underline">
              support@kiddofund.com
            </a>
          </div>
          <div className="mt-3">
            <Link href="/faq" className="text-sm text-primary hover:underline">
              Read the age-{majorityAge} FAQ →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}



