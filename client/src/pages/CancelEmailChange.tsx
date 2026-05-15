// Landing page for the cancel-email-change link sent to the OLD
// address. Reads ?token=... from the URL, POSTs to
// /api/auth/cancel-email-change. The page also surfaces a 'this
// wasn't me, lock my account' soft prompt directing to password
// reset.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";

type State = "checking" | "success" | "failure";

export default function CancelEmailChange() {
  const [, setLocation] = useLocation();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (new URLSearchParams(window.location.search).get("token") || "").trim();
  }, []);
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token || token.length < 32) {
      setState("failure");
      setError("This link is missing its token.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/cancel-email-change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState("failure");
          setError(body?.message || "Invalid or expired link.");
          haptic("error");
          return;
        }
        setState("success");
        haptic("success");
      } catch (err: any) {
        if (cancelled) return;
        setState("failure");
        setError(err?.message || "Something went wrong.");
        haptic("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

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
                <h1 className="text-3xl font-semibold text-foreground">Cancelling…</h1>
                <p className="text-base text-muted-foreground">One moment.</p>
              </>
            )}
            {state === "success" && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <X size={28} strokeWidth={2.4} />
                </div>
                <h1 className="text-3xl font-semibold text-foreground">Email change cancelled</h1>
                <p className="text-base text-muted-foreground">
                  Your account email stays as it is. If you didn't request this change yourself, change your password now to lock the account.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setLocation("/login?forgot=1")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    Reset password <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation("/login")}
                    className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Just sign in
                  </button>
                </div>
                <div className="mx-auto flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <span>If you keep getting alerts about email-change requests you didn't make, write to support and we'll lock the account down.</span>
                </div>
              </>
            )}
            {state === "failure" && (
              <>
                <h1 className="text-3xl font-semibold text-foreground">This link didn't work</h1>
                <p className="text-base text-muted-foreground">{error || "Invalid or expired link."}</p>
                <button type="button" onClick={() => setLocation("/login")} className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">
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
