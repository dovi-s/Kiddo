// ResetPassword — the destination for the link sent by
// /api/auth/forgot-password. Reads the token from the URL,
// posts it + the new password to /api/auth/reset-password.
// On success, sends the user to /login with a confirmation
// toast. Doesn't auto-sign-in (matches Settings password
// change flow + audited recovery patterns — the user
// enters the new password to verify it).
//
// Created 2026-05-15 to close the forgot-password TODO. The
// route is registered in client/src/App.tsx as "/reset-password".

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, setLocation] = useLocation();

  // Parse token from the URL once on mount. Wouter's useSearch isn't
  // imported here because Reset is a flat route with no nested params;
  // using window.location.search directly is simplest.
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return (params.get("token") || "").trim();
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Empty/missing token: show a quiet "this link doesn't look right"
  // message rather than letting the user fill the form and get a
  // server-side 400. Same anti-enumeration shape but better UX.
  const tokenLooksValid = token.length >= 32 && token.length <= 256;

  useEffect(() => {
    if (!tokenLooksValid) {
      setError("This reset link is missing its token. Open the link from your email again.");
    }
  }, [tokenLooksValid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tokenLooksValid) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || "Invalid or expired reset link.");
        haptic("error");
        return;
      }
      haptic("success");
      toast({ title: "Password updated", description: "Sign in with your new password." });
      // Brief delay so the toast renders before navigation.
      setTimeout(() => setLocation("/login"), 350);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
      haptic("error");
    } finally {
      setSubmitting(false);
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
            <h1 className="text-3xl font-semibold text-foreground">Reset your password</h1>
            <p className="text-base text-muted-foreground">
              Choose a new password to sign back in.
            </p>
          </div>

          {!tokenLooksValid ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
              <p className="font-semibold">This reset link looks incomplete.</p>
              <p className="mt-1.5 text-amber-800">
                Open the link from your email again. If it keeps failing, request a new reset from the sign-in page.
              </p>
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]"
              >
                Back to sign in <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-reset-password">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="new-password"
                    name="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-12 w-full rounded-2xl border border-border bg-card pl-9 pr-10 text-base focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="input-new-password"
                    required
                    minLength={8}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Type it again"
                    className="h-12 w-full rounded-2xl border border-border bg-card pl-9 pr-3 text-base focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="input-confirm-password"
                    required
                    minLength={8}
                    maxLength={128}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-700" data-testid="text-reset-error">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || password.length < 8 || password !== confirm}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                data-testid="button-submit-reset"
              >
                {submitting ? "Saving…" : "Set new password"}
              </button>

              <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                <span>
                  After saving, you will be signed out of all sessions and need to sign in again with the new password.
                </span>
              </div>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  );
}
