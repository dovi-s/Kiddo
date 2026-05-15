// Landing page for the confirm-email-change link sent to the NEW
// address. Reads ?token=... from the URL, POSTs to
// /api/auth/confirm-email-change. Same three-state pattern as
// VerifyEmail (checking / success / failure).

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

type State = "checking" | "success" | "failure";

export default function ConfirmEmailChange() {
  const [, setLocation] = useLocation();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (new URLSearchParams(window.location.search).get("token") || "").trim();
  }, []);
  const [state, setState] = useState<State>("checking");
  const [newEmail, setNewEmail] = useState<string | null>(null);
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
        const res = await fetch("/api/auth/confirm-email-change", {
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
        const body = await res.json();
        setNewEmail(body?.newEmail || null);
        setState("success");
        haptic("success");
        toast({ title: "Email updated", description: "Signed in with your new address." });
        setTimeout(() => { if (!cancelled) setLocation("/dashboard"); }, 1200);
      } catch (err: any) {
        if (cancelled) return;
        setState("failure");
        setError(err?.message || "Something went wrong.");
        haptic("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token, setLocation]);

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
                <h1 className="text-3xl font-semibold text-foreground">Confirming…</h1>
                <p className="text-base text-muted-foreground">One moment.</p>
              </>
            )}
            {state === "success" && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check size={28} strokeWidth={2.4} />
                </div>
                <h1 className="text-3xl font-semibold text-foreground">Email updated</h1>
                <p className="text-base text-muted-foreground">
                  {newEmail ? `Your account now signs in as ${newEmail}.` : "Your account email has been updated."}
                </p>
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
