import { useState, useMemo, useEffect } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { haptic } from "@/lib/haptics";

// Dedicated landing for the at-18 claim flow. The kid arrives here from the
// "Claim your account" CTA on KidView with the share token in the URL and
// the access token (proving they've already entered the PIN) in a query
// param. The page does ONE thing: collect email + password, atomically
// transfer the fund to a new user account, log them in, redirect to /dashboard.
//
// We deliberately don't reuse GetStarted's onboarding wizard — that flow
// is built around CREATING a new fund, not claiming an existing one. Forcing
// the kid through "set the recipient's birthdate / pick an investment / etc."
// when none of that applies (the fund already exists, the investments are
// already chosen) would be confusing and slow the moment.

export default function ClaimFund() {
  const [, params] = useRoute("/take-over/:token");
  const search = useSearch();
  const [, setLocation] = useLocation();
  const token = params?.token || "";
  const accessToken = useMemo(() => {
    try { return new URLSearchParams(search).get("accessToken") || ""; } catch { return ""; }
  }, [search]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two-phase state: form-phase → success-phase. After a successful
  // claim the page used to redirect to /dashboard silently, which
  // missed the locked principle "the at-18 handoff is the only
  // product-transition window the company has." The celebration
  // state surfaces the load-bearing facts (subscription retires,
  // AUM-only pricing, kid-2.0 Roth signpost) at the exact moment
  // the kid takes legal ownership. Per project_kid_2.0_handoff_funnel.md
  // and the team motion-audit recommendation 2026-05-25.
  const [claimedName, setClaimedName] = useState<string | null>(null);
  const [rothOptedIn, setRothOptedIn] = useState(false);
  const [rothSubmitting, setRothSubmitting] = useState(false);
  const [rothError, setRothError] = useState<string | null>(null);
  // Respect OS-level prefers-reduced-motion. The staged-reveal card on
  // this page is the highest-stakes moment in the product, but a kid
  // with vestibular sensitivity should not be forced to ride through
  // the cascade. When this is true, the motion.div initial states
  // become `false` (framer-motion shorthand for "start at the animate
  // state — no entrance animation"). Audit 2026-05-25 caught.
  const prefersReducedMotion = useReducedMotion();

  // Personalize the tab title — same pattern as KidView. "Claim your fund | Kiddo".
  useEffect(() => {
    if (typeof document !== "undefined") document.title = "Claim your fund | Kiddo";
  }, []);

  const canSubmit = !!token && !!accessToken && email.includes("@") && password.length >= 8 && !submitting;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    haptic("medium");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/kid-view/${encodeURIComponent(token)}/claim-account`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || data?.error || "Could not claim the fund. Try again.");
        setSubmitting(false);
        return;
      }
      haptic("success");
      // Flip to celebration state instead of silent redirect. The kid is
      // logged in (server established the session) but stays on this page
      // for the success moment. The "Go to my dashboard" CTA below
      // navigates manually when the kid taps it.
      const claimedFirstName = (firstName.trim() || data?.firstName || "you").trim();
      setClaimedName(claimedFirstName);
      setSubmitting(false);
    } catch (err: any) {
      setError(err?.message || "Network error. Try again.");
      setSubmitting(false);
    }
  };

  // Kid-self Roth IRA waitlist opt-in. Kid is now the authenticated user;
  // POSTs to the same /api/users/me/roth-interest endpoint the parent
  // signup uses, but the copy framing is first-person ("let me know").
  // Optimistic flip with revert-on-failure, same pattern as the parent
  // RothInterestOptIn component but inlined here to avoid prop-bloat
  // on the shared component (which assumes parent context).
  const handleRothToggle = async () => {
    if (rothSubmitting) return;
    const next = !rothOptedIn;
    setRothOptedIn(next);
    setRothSubmitting(true);
    setRothError(null);
    haptic(next ? "success" : "light");
    try {
      const res = await fetch("/api/users/me/roth-interest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interested: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch (e) {
      setRothOptedIn(!next);
      setRothError("Couldn't save right now. Tap to try again.");
    } finally {
      setRothSubmitting(false);
    }
  };

  if (!token || !accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--kiddo-cream))] via-white to-[hsl(var(--kiddo-gold)/0.10)] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-border/60 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-2">Open this from your Kid View.</p>
          <p className="text-xs text-muted-foreground">The claim link needs to come from inside your unlocked Kid View page so we know it's actually you.</p>
        </div>
      </div>
    );
  }

  // Celebration / success state — renders after a successful claim
  // instead of silently redirecting to /dashboard. The locked
  // principle (project_kid_2.0_handoff_funnel.md) requires the
  // at-18 handoff to route TOWARD a next Kiddo product, NOT OUT.
  // This surface delivers on that: animated checkmark + personalized
  // "It's yours" + three load-bearing facts (subscription retires,
  // AUM-only pricing, investments stay) + Roth IRA waitlist opt-in
  // (kid-2.0 Phase 1) + clear next-step CTAs to dashboard + Memory
  // Book. The kid is logged in (server established session before
  // we got here); they just stay on the page to absorb the moment.
  if (claimedName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--kiddo-cream))] via-white to-[hsl(var(--kiddo-gold)/0.10)]">
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <Logo />
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-[hsl(var(--kiddo-gold)/0.40)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.22)_0%,#fff_55%,hsl(var(--kiddo-cream))_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
            role="status"
            aria-live="polite"
          >
            {/* Animated checkmark badge — spring scale on entry. The
                single most ceremonial element on the page. Skipped
                for reduced-motion users (instant render at final
                state). */}
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.05 }}
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--kiddo-gold-ink))] shadow-[0_8px_24px_-8px_hsl(var(--kiddo-gold-ink)/0.5)]"
              aria-hidden="true"
            >
              <Check size={32} className="text-white" strokeWidth={2.5} />
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.18 }}
              className="text-center mb-5"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-gold-ink))]/85 mb-2">Welcome, owner</p>
              <h1 className="font-heading text-3xl font-bold text-foreground leading-tight">
                It's yours now, {claimedName}.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Legal ownership transferred. Your fund, your call from here.
              </p>
            </motion.div>

            {/* Three load-bearing facts. Each one is a locked-memory
                fact (subscription_retires_at_majority + Fee Architecture
                + Investments-stay-as-is) made concrete at the moment
                of ownership transfer. */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.30 }}
              className="mb-5 space-y-2.5 rounded-2xl bg-white/65 border border-[hsl(var(--kiddo-border)/0.5)] px-4 py-4"
            >
              <div className="flex items-start gap-2.5">
                <Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" strokeWidth={2.5} aria-hidden="true" />
                <p className="text-sm text-foreground/85 leading-relaxed">
                  <span className="font-semibold text-foreground">Every investment stays exactly where it is.</span> Nothing was sold. Holdings, dividends, basis: all transferred to you.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" strokeWidth={2.5} aria-hidden="true" />
                <p className="text-sm text-foreground/85 leading-relaxed">
                  <span className="font-semibold text-foreground">Your parents' Plus subscription for this fund ends today.</span> You don't pay it. Kiddo+ exists for parents managing custody.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" strokeWidth={2.5} aria-hidden="true" />
                <p className="text-sm text-foreground/85 leading-relaxed">
                  <span className="font-semibold text-foreground">The only ongoing charge: 10 cents per $100 invested per year, or $1 a year per $1,000.</span> That's it. No subscription. No platform fee.
                </p>
              </div>
            </motion.div>

            {/* Kid-2.0 funnel signpost — Roth IRA waitlist opt-in.
                Per project_kid_2.0_handoff_funnel.md Phase 3 (Roth IRA
                on DriveWealth, Year 2-3). Waitlist already live at
                parent signup; this is the kid-side equivalent for
                the just-claimed kid. */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.42 }}
              className="mb-5"
            >
              <button
                type="button"
                onClick={() => void handleRothToggle()}
                disabled={rothSubmitting}
                aria-pressed={rothOptedIn}
                className={`w-full rounded-2xl border p-4 text-left transition-colors disabled:opacity-60 ${
                  rothOptedIn
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-white/70 hover:border-primary/30"
                }`}
                data-testid="claim-roth-opt-in"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    rothOptedIn ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}>
                    {rothOptedIn ? <Check size={16} strokeWidth={2.5} /> : <Sparkles size={16} strokeWidth={1.8} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {rothOptedIn ? "We'll let you know when Roth IRA opens." : "Want a heads-up when Roth IRA opens?"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Once you have earned income from a job, a Roth IRA lets the money keep compounding tax-free for life. Kiddo is building this path. {rothOptedIn ? "Tap to opt out." : "Tap to join the waitlist."}
                    </p>
                    {rothError && (
                      <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">{rothError}</p>
                    )}
                  </div>
                </div>
              </button>
            </motion.div>

            {/* Next-step CTAs — primary navigates to dashboard, secondary
                opens the Memory Book (the gifts/notes/photos from the
                kid's life that just became theirs forever). */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.55 }}
              className="space-y-2.5"
            >
              <Button
                type="button"
                onClick={() => { haptic("selection"); setLocation("/dashboard"); }}
                className="w-full rounded-full h-12 font-semibold bg-[hsl(var(--kiddo-gold-ink))] hover:opacity-90 text-base"
                data-testid="claim-success-dashboard"
              >
                Go to my dashboard
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { haptic("selection"); setLocation("/memory"); }}
                className="w-full rounded-full h-12 font-medium"
                data-testid="claim-success-memory"
              >
                <BookOpen size={16} className="mr-2" />
                Open my Memory Book
              </Button>
            </motion.div>
          </motion.div>

          <div className="mt-6">
            <TrustMicroStrip />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--kiddo-cream))] via-white to-[hsl(var(--kiddo-gold)/0.10)]">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Logo />
        </div>

        {/* Staged reveal — same out-expo curve as KidView and the
            Dashboard hero. This is the kid's own moment of taking
            ownership of the fund, so the card arrives with weight
            (8px translate + opacity, 0.55s). The key icon, headline,
            form, and trailing reassurance bullets stagger so the eye
            tracks top-to-bottom rather than seeing everything at once. */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-[hsl(var(--kiddo-gold)/0.40)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.18)_0%,#fff_55%,hsl(var(--kiddo-cream))_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
            className="flex items-start gap-3 mb-4"
          >
            <span className="text-3xl shrink-0" aria-hidden="true">🔑</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-gold-ink))]/85 mb-1">Claim your fund</p>
              <h1 className="font-heading text-2xl font-bold text-foreground leading-tight">It's yours now.</h1>
            </div>
          </motion.div>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="text-sm text-muted-foreground leading-relaxed mb-5"
          >
            Set up your own login. The fund moves from your custodian to you. Nothing gets sold. The investments stay where they are. You decide what happens next.
          </motion.p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="claim-input-first-name" className="text-xs font-semibold text-foreground mb-1 block">Your name</label>
              <input
                id="claim-input-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                data-testid="claim-input-first-name"
              />
            </div>
            <div>
              <label htmlFor="claim-input-email" className="text-xs font-semibold text-foreground mb-1 block">Email</label>
              <input
                id="claim-input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                inputMode="email"
                autoComplete="email"
                required
                data-testid="claim-input-email"
              />
            </div>
            <div>
              <label htmlFor="claim-input-password" className="text-xs font-semibold text-foreground mb-1 block">Password</label>
              <input
                id="claim-input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                autoComplete="new-password"
                required
                minLength={8}
                data-testid="claim-input-password"
              />
              <p className="text-[10px] text-muted-foreground mt-1">If you already have a Kiddo account with this email, enter that password to claim into it.</p>
            </div>

            {/* role="alert" + aria-live makes screen readers announce
                claim failures (invalid token, expired, already-claimed,
                wrong password on existing account) without the kid
                needing to know where to look. Audit 2026-05-25. */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="claim-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-full h-11 font-semibold bg-[hsl(var(--kiddo-gold-ink))] hover:opacity-90 disabled:opacity-50"
              data-testid="claim-submit"
            >
              {submitting ? "Claiming…" : "Claim my fund"}
            </Button>
          </form>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.42 }}
            className="mt-5 pt-4 border-t border-[hsl(var(--kiddo-border)/0.6)] text-xs text-muted-foreground space-y-1.5 leading-relaxed"
          >
            <p>What happens when you click claim:</p>
            <ul className="space-y-1 ml-1">
              <li>• Your custodian's name comes off. Yours goes on.</li>
              <li>• Every investment, every dollar, stays exactly where it is.</li>
              <li>• You log in as yourself starting today.</li>
              <li>• Your Memory Book (every gift, every note) becomes yours forever.</li>
            </ul>
          </motion.div>
        </motion.div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Already have a login? <a href="/login" className="underline hover:text-foreground">Sign in</a> instead.
        </p>

        <div className="mt-6">
          <TrustMicroStrip />
        </div>
      </div>
    </div>
  );
}
