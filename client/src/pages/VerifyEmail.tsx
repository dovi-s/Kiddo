// VerifyEmail — destination for the post-signup verification email.
// Reads ?token=... from the URL, POSTs it to /api/auth/verify-email,
// shows a calm success/failure state.
//
// On success, sends the user back to /dashboard after a brief moment
// (the toast renders, the page confirms, the user knows it worked).
// On failure, surfaces a "this link doesn't look right" state with
// a "resend verification email" affordance for signed-in users.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

type VerifyState = "checking" | "success" | "failure";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return (params.get("token") || "").trim();
  }, []);

  const [state, setState] = useState<VerifyState>("checking");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token || token.length < 32 || token.length > 256) {
      setState("failure");
      setErrorMessage("This verification link is missing its token. Open the link from your email again.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState("failure");
          setErrorMessage(body?.message || "Invalid or expired verification link.");
          haptic("error");
          return;
        }
        const body = await res.json();
        setVerifiedEmail(body?.email || null);
        setState("success");
        haptic("success");
        toast({ title: "Email verified", description: "You're all set." });
        // Brief delay so the toast renders before nav.
        setTimeout(() => {
          if (!cancelled) setLocation("/dashboard");
        }, 1200);
      } catch (err: any) {
        if (cancelled) return;
        setState("failure");
        setErrorMessage(err?.message || "Could not verify. Try again.");
        haptic("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setLocation]);

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
                <h1 className="text-3xl font-semibold text-foreground">Verifying your email…</h1>
                <p className="text-base text-muted-foreground">One moment.</p>
              </>
            )}
            {state === "success" && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check size={28} strokeWidth={2.4} />
                </div>
                <h1 className="text-3xl font-semibold text-foreground">Email verified</h1>
                <p className="text-base text-muted-foreground">
                  {verifiedEmail
                    ? `${verifiedEmail} is confirmed. Taking you to Dashboard.`
                    : "You're all set. Taking you to Dashboard."}
                </p>
              </>
            )}
            {state === "failure" && (
              <>
                <h1 className="text-3xl font-semibold text-foreground">This link didn't work</h1>
                <p className="text-base text-muted-foreground">
                  {errorMessage || "Invalid or expired verification link."}
                </p>
                <div className="rounded-2xl border border-border bg-card p-5 text-left text-sm leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">What to try</p>
                  <ul className="mt-2 space-y-1.5">
                    <li>· Open the most recent email titled <span className="text-foreground font-medium">Confirm your Kiddo email</span>.</li>
                    <li>· If the link is older than 7 days, request a new one from your account settings.</li>
                    <li>· Make sure you're signed into the right account before tapping the link.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]"
                  data-testid="button-verify-back-to-login"
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
                Verified accounts unlock the full Kiddo experience: gift links, recurring investments, Memory Book uploads.
              </span>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
