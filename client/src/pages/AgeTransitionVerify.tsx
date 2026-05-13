// Email verification landing page — the kid clicks the link in the
// "confirm your email" email at age 17 and lands here. The token is
// single-use and the only thing this page does is POST it to the verify
// endpoint, then show a confirmation. No login required, no Kiddo account
// needed yet (those come at the actual at-18 claim flow).
//
// Three states:
//   loading    → in-flight request, brief spinner
//   verified   → success, calm Kiddo-cream confirmation
//   alreadyDone → token had been used; show calm "already confirmed" state
//                 instead of a hard error (the kid clicking twice is fine)
//   error      → token invalid/expired; show what to do (ask parent to re-send)

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Logo } from "@/components/ui/logo";

type VerifyState =
  | { kind: "loading" }
  | { kind: "verified"; verifiedAt: string }
  | { kind: "alreadyDone"; verifiedAt: string }
  | { kind: "error"; message: string };

export default function AgeTransitionVerify() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<VerifyState>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Verification link is missing the token." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/age-transition-verify/${encodeURIComponent(token)}`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({
            kind: "error",
            message: data?.error || "Verification link is no longer valid.",
          });
          return;
        }
        if (data?.alreadyVerified) {
          setState({ kind: "alreadyDone", verifiedAt: data?.verifiedAt || "" });
        } else {
          setState({ kind: "verified", verifiedAt: data?.verifiedAt || new Date().toISOString() });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Could not reach the server.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background gemini-warm-section">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo size="md" className="text-foreground" />
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
        {state.kind === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <p className="text-sm text-muted-foreground">Confirming…</p>
          </motion.div>
        )}

        {(state.kind === "verified" || state.kind === "alreadyDone") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "hsl(var(--kiddo-evergreen) / 0.10)" }}
            >
              <CheckCircle2 size={32} className="text-[hsl(var(--kiddo-evergreen))]" />
            </div>
            <h1 className="font-heading text-3xl font-semibold text-foreground">
              {state.kind === "alreadyDone" ? "Already confirmed." : "Email confirmed."}
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              {state.kind === "alreadyDone"
                ? "You'd already confirmed this address. Nothing more to do — the claim link will reach you on your 18th birthday."
                : "Thanks for confirming. The claim link for your Kiddo fund will reach you here automatically on your 18th birthday."}
            </p>
            <p className="mx-auto max-w-md font-serif italic text-foreground/85">
              That's the whole point. 🌱
            </p>
          </motion.div>
        )}

        {state.kind === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "hsl(0 70% 92%)" }}
            >
              <AlertCircle size={32} className="text-destructive" />
            </div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              This link isn't valid anymore.
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              {state.message} Ask the parent who manages your fund to send a new verification link.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
