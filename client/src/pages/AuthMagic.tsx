// AuthMagic — destination for the magic-link sign-in email.
//
// Per project_recurring_gifting_without_password_spec.md (locked 2026-05-25).
// Reads ?token=... from the URL, calls GET /api/auth/magic-link/verify,
// and lands the gifter on /gifter (welcome intent) or /gifter (relogin
// intent). The session is established by the server before the response
// returns; this page just renders a friendly "signing you in…" state.
//
// Mirrors the calm shape of VerifyEmail.tsx — same Logo + motion entry,
// same checking/success/failure state machine, same failure tips.
//
// Failure copy is anti-enumeration: never reveals which mode failed
// (expired vs used vs never-existed). Always offers "request a fresh
// link" as the recovery path.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

type VerifyState = "checking" | "success" | "failure";

export default function AuthMagic() {
  const [, setLocation] = useLocation();

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return (params.get("token") || "").trim();
  }, []);

  const [state, setState] = useState<VerifyState>("checking");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token || token.length < 32 || token.length > 256) {
      setState("failure");
      setErrorMessage("This sign-in link is missing its token. Open the link from your email again.");
      return;
    }
    (async () => {
      try {
        // GET, not POST — the email link is a direct click. The token
        // is in the query string; the server consumes it and sets the
        // session cookie before responding.
        const res = await fetch(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`, {
          method: "GET",
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState("failure");
          setErrorMessage(body?.message || "Invalid or expired sign-in link.");
          haptic("error");
          return;
        }
        const body = await res.json();
        setSignedInEmail(body?.email || null);
        setIntent(body?.intent || null);
        setState("success");
        haptic("success");
        toast({ title: "Signed in", description: "Taking you to your dashboard." });
        // Brief delay so the toast renders before nav. Intent maps:
        //   gifter_welcome → /my-gifts (post-recurring landing).
        //   gifter_relogin → /my-gifts (same landing; the welcome banner
        //                     specifically only renders for new-account
        //                     intent, so it's a no-op on re-login).
        setTimeout(() => {
          // Prefer the brandable /my-gifts URL over the internal /gifter
          // route name. Both resolve to the same component; /my-gifts is
          // what the gifter's address bar should display after sign-in.
          if (!cancelled) setLocation("/my-gifts");
        }, 1200);
      } catch (err: any) {
        if (cancelled) return;
        setState("failure");
        setErrorMessage(err?.message || "Could not sign in. Try again.");
        haptic("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setLocation]);

  // Request a fresh link inline from the failure state so the gifter
  // doesn't have to navigate elsewhere. Hits the standard endpoint;
  // response is always 200 (anti-enumeration).
  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Enter a valid email", description: "We'll send a fresh sign-in link." });
      return;
    }
    setResending(true);
    try {
      await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
      haptic("success");
      toast({ title: "Check your email", description: "If that email is on file, a fresh link is on its way." });
    } catch {
      toast({ title: "Could not send", description: "Try again in a moment." });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-lg md:max-w-xl mx-auto px-4 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <Logo size="lg" showWordmark={true} linkTo={null} />
            </div>
            {state === "checking" && (
              <>
                <h1 className="text-3xl font-semibold text-foreground">Signing you in…</h1>
                <p className="text-base text-muted-foreground">One moment.</p>
              </>
            )}
            {state === "success" && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check size={28} strokeWidth={2.4} />
                </div>
                <h1 className="text-3xl font-semibold text-foreground">
                  {intent === "gifter_welcome" ? "Welcome to Kiddo" : "Signed in"}
                </h1>
                <p className="text-base text-muted-foreground">
                  {signedInEmail
                    ? `${signedInEmail}. Taking you to your dashboard.`
                    : "Taking you to your dashboard."}
                </p>
              </>
            )}
            {state === "failure" && (
              <>
                <h1 className="text-3xl font-semibold text-foreground">This link didn't work</h1>
                <p className="text-base text-muted-foreground">
                  {errorMessage || "Sign-in link expired or already used."}
                </p>
                <div className="rounded-2xl border border-border bg-card p-5 text-left text-sm leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">Request a fresh link</p>
                  <p className="mt-2">
                    Sign-in links are good for 15 minutes and work once. We'll email you a new one right now.
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
                        data-testid="input-magic-resend-email"
                      />
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        data-testid="button-magic-resend"
                      >
                        <Mail size={14} /> Send link
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-[hsl(var(--kiddo-evergreen))] font-semibold">
                      If that email is on file, a fresh link is on its way.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]"
                  data-testid="button-magic-back-to-login"
                >
                  Back to sign in <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
          {state === "success" && (
            <div className="mx-auto flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
              <span>
                We don't ask for passwords on gifter accounts. Every sign-in is a fresh email link like the one you just used.
              </span>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
