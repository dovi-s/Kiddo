// FounderClaim — destination for the founding-member claim link.
//
// Per project_founding_member_claim_flow_spec.md (Days 2-3; decisions locked
// 2026-05-26: passwordless, magic-link-style claim). Reads :token from the PATH
// (/founder-claim/:token), POSTs /api/auth/founder-claim/verify to render
// "Welcome, founder #N" + benefits, then on confirm POSTs
// /api/auth/founder-claim/complete (which create-or-links the user, stamps the
// $19/yr founder tier, and establishes the session) and lands them in the
// fund-creation onboarding.
//
// Two-step (verify -> confirm) rather than auto-consume, because the founder
// should SEE their slot + benefits before we create the account. Mirrors
// AuthMagic.tsx's calm shape. Failure copy is anti-enumeration: one generic
// message for expired / already-claimed / unknown, with a re-request path.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Check, Crown, Gift, Lock, Mail, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

type ClaimState = "checking" | "ready" | "claiming" | "done" | "failure";

export default function FounderClaim() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Token is in the PATH (/founder-claim/:token), not the query string.
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const m = window.location.pathname.match(/\/founder-claim\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]).trim() : "";
  }, []);

  const [state, setState] = useState<ClaimState>("checking");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Step 1: validate the token (read-only) and render the welcome.
  useEffect(() => {
    let cancelled = false;
    if (!token || token.length < 32 || token.length > 256) {
      setState("failure");
      setErrorMessage("This claim link is missing its token. Open the link from your email again.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/founder-claim/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState("failure");
          setErrorMessage(body?.message || "This founder link has expired or was already claimed.");
          haptic("error");
          return;
        }
        const body = await res.json();
        setFirstName(body?.firstName || null);
        setPosition(typeof body?.position === "number" ? body.position : null);
        setState("ready");
      } catch (err: any) {
        if (cancelled) return;
        setState("failure");
        setErrorMessage(err?.message || "Could not verify this link. Try again.");
        haptic("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Step 2: consume the token, create/link the account, sign in, onboard.
  const handleClaim = async () => {
    setState("claiming");
    try {
      const res = await fetch("/api/auth/founder-claim/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState("failure");
        setErrorMessage(body?.message || "This founder slot was just claimed.");
        haptic("error");
        return;
      }
      setState("done");
      haptic("success");
      toast({ title: "You're a Kiddo founder", description: "Let's set up your first fund." });
      // Refresh the auth context so ProtectedRoute sees the new session before
      // we land on the (protected) onboarding flow — avoids a bounce to /login.
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setTimeout(() => {
        if (!document.hidden) setLocation("/get-started?founder=1");
      }, 1100);
    } catch (err: any) {
      setState("failure");
      setErrorMessage(err?.message || "Could not finish claiming. Try again.");
      haptic("error");
    }
  };

  // Re-request a fresh link inline (Path B). Always 200 server-side
  // (anti-enumeration), so the UI just confirms generically.
  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Enter a valid email", description: "We'll send a fresh claim link." });
      return;
    }
    setResending(true);
    try {
      await fetch("/api/auth/founder-claim/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
      haptic("success");
      toast({ title: "Check your email", description: "If you're a founding member, a fresh link is on its way." });
    } catch {
      toast({ title: "Could not send", description: "Try again in a moment." });
    } finally {
      setResending(false);
    }
  };

  const benefits = [
    { icon: Lock, label: "$19/year, locked in for life" },
    { icon: Gift, label: "$25 starter gift for your first fund" },
    { icon: Crown, label: "Founding Member badge" },
    { icon: Sparkles, label: "Early access to everything we build next" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-lg md:max-w-xl mx-auto px-4 py-16 md:py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <Logo size="lg" showWordmark={true} linkTo={null} />
            </div>

            {state === "checking" && (
              <>
                <h1 className="text-3xl font-semibold text-foreground">Checking your founder link…</h1>
                <p className="text-base text-muted-foreground">One moment.</p>
              </>
            )}

            {(state === "ready" || state === "claiming") && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]">
                  <Crown size={28} strokeWidth={2.2} />
                </div>
                <h1 className="text-3xl font-semibold text-foreground">
                  {firstName ? `Welcome, ${firstName}` : "Welcome, founder"}
                </h1>
                <p className="text-base text-muted-foreground">
                  {position ? `You're founding member #${position}.` : "You're a Kiddo founding member."}{" "}
                  Claim your account to lock in your benefits. No password needed.
                </p>
                <ul className="mx-auto mt-2 max-w-sm space-y-2 text-left">
                  {benefits.map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
                    >
                      <Icon size={16} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={state === "claiming"}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-6 py-3 text-base font-semibold text-white disabled:opacity-60"
                  data-testid="button-founder-claim"
                >
                  {state === "claiming" ? "Claiming…" : "Claim my Founder account"}
                  {state !== "claiming" && <ArrowRight size={16} />}
                </button>
              </>
            )}

            {state === "done" && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check size={28} strokeWidth={2.4} />
                </div>
                <h1 className="text-3xl font-semibold text-foreground">You're a Kiddo founder</h1>
                <p className="text-base text-muted-foreground">Setting up your first fund…</p>
              </>
            )}

            {state === "failure" && (
              <>
                <h1 className="text-3xl font-semibold text-foreground">This link didn't work</h1>
                <p className="text-base text-muted-foreground">
                  {errorMessage || "This founder link has expired or was already claimed."}
                </p>
                <div className="rounded-2xl border border-border bg-card p-5 text-left text-sm leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">Request a fresh link</p>
                  <p className="mt-2">
                    Founder claim links are good for 30 days and work once. We'll email you a new one.
                  </p>
                  {!resent ? (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="you@email.com"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        data-testid="input-founder-resend-email"
                      />
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        data-testid="button-founder-resend"
                      >
                        <Mail size={14} /> Send link
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-[hsl(var(--kiddo-evergreen))] font-semibold">
                      If you're a founding member, a fresh link is on its way.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]"
                  data-testid="button-founder-back-to-login"
                >
                  Back to sign in <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
