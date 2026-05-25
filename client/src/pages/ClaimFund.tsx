import { useState, useMemo, useEffect } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
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
      // Server has already established the session as the new owner. Send
      // them straight to the dashboard — they're now logged in as themselves,
      // and the just-claimed fund is the only one they own.
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Network error. Try again.");
      setSubmitting(false);
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
