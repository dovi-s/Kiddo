import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThinkingOrb } from "@/components/ui/gemini";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchDashboard } from "@/lib/prefetch";
import { PasskeySignInButton } from "@/components/PasskeySignInButton";
import { getActiveFundId } from "@/hooks/use-active-fund";
import brandMark from "@/assets/kiddo-logo-cropped.png";

function getSafeRedirectTarget(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login")) return "/dashboard";
  return value;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  // Magic-link re-login state. Mirrors the forgot-password dialog
  // shape — same anti-enumeration discipline, same "always 200" copy.
  // Per project_recurring_gifting_without_password_spec.md (locked
  // 2026-05-25). Gifters who signed up via magic-link have no
  // password to "forget"; this gives them a parallel re-entry path.
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState({ google: false, apple: false, biometricReady: false });
  const { login, isLoggingIn, loginError } = useAuth();
  const queryClient = useQueryClient();
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const oauthErrorParam = url?.searchParams.get("error");
  const oauthProviderParam = url?.searchParams.get("oauth");
  const redirectTarget = getSafeRedirectTarget(url?.searchParams.get("redirect"));
  const friendlyLoginError =
    loginError === "Invalid email or password"
      ? "That email and password do not match. Check them and try again."
      : loginError;
  const oauthError =
    oauthErrorParam && oauthProviderParam
      ? `${oauthProviderParam[0].toUpperCase()}${oauthProviderParam.slice(1)} sign in is not ready yet. Finish the provider setup and try again.`
      : null;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/providers", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((payload) => {
        if (!cancelled && payload) {
          setOauthProviders({
            google: Boolean(payload.google),
            apple: Boolean(payload.apple),
            biometricReady: Boolean(payload.biometricReady),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptic('medium');
    try {
      await login({ email, password });
      haptic('success');
      // Pre-warm the dashboard the user is about to land on. Fires in
      // parallel with setLocation — by the time React renders the new route,
      // /api/funds is in flight (or already settled). Saves the post-login
      // "blank dashboard with spinner" moment that defines first impressions.
      // Uses stored active fund id from a previous session if present;
      // otherwise the funds list alone primes the AppHeader.
      if (redirectTarget === "/dashboard" || redirectTarget.startsWith("/dashboard")) {
        prefetchDashboard(queryClient, getActiveFundId());
      }
      setLocation(redirectTarget);
    } catch {
      haptic('error');
    }
  };
  
  const handleFocus = () => {
    haptic('light');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    haptic('medium');
    setResetLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
    } catch {
      // silently ignore network errors - always show success to avoid email enumeration
    } finally {
      setResetLoading(false);
      setResetSent(true);
      haptic('success');
    }
  };

  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    haptic('medium');
    setMagicLoading(true);
    try {
      await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail.trim().toLowerCase() }),
      });
    } catch {
      // silently ignore network errors - always show success to avoid email enumeration
    } finally {
      setMagicLoading(false);
      setMagicSent(true);
      haptic('success');
    }
  };

  return (
    <div className="kiddo-app-page relative overflow-hidden">
      <main className="max-w-lg md:max-w-xl mx-auto px-4 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center space-y-4">
            {/* Decorative brand mark above the Logo wordmark below.
                The <Logo showWordmark={true}> just below renders the
                actual labeled brand for screen readers; this hero
                image is illustrative only. Empty alt + aria-hidden
                prevents the "Kiddo Kiddo Kiddo" triple-read flagged
                in the Login chrome (1 large image + 1 Logo icon +
                1 wordmark text). Fixed 2026-05-15. */}
            <motion.img
              src={brandMark}
              alt=""
              aria-hidden="true"
              data-testid="img-brand-mark-login"
              className="w-36 h-auto mx-auto drop-shadow-sm"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                <Logo size="lg" showWordmark={true} linkTo={null} />
              </div>
              <h1 className="text-3xl font-semibold text-foreground">Welcome back</h1>
              <p className="text-base text-muted-foreground">Your child's future is growing.</p>
            </div>
          </div>

          {friendlyLoginError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive text-center"
              data-testid="text-login-error"
            >
              {friendlyLoginError}
            </motion.div>
          )}

          {oauthError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive text-center"
              data-testid="text-oauth-error"
            >
              {oauthError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-6 space-y-5 gemini-soft-container">
              {(oauthProviders.google || oauthProviders.apple) && (
                <div className="space-y-3">
                  {oauthProviders.google && (
                    <button
                      type="button"
                      onClick={() => {
                        haptic("medium");
                        window.location.assign("/api/auth/oauth/google");
                      }}
                      className="w-full h-12 rounded-xl border-2 border-border/60 bg-background text-foreground font-medium hover:border-primary/40 hover:bg-muted/30 transition-all duration-150"
                      data-testid="button-login-google"
                    >
                      Continue with Google
                    </button>
                  )}
                  {oauthProviders.apple && (
                    <button
                      type="button"
                      onClick={() => {
                        haptic("medium");
                        window.location.assign("/api/auth/oauth/apple");
                      }}
                      className="w-full h-12 rounded-xl border-2 border-border/60 bg-background text-foreground font-medium hover:border-primary/40 hover:bg-muted/30 transition-all duration-150"
                      data-testid="button-login-apple"
                    >
                      Continue with Apple
                    </button>
                  )}
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    <div className="h-px flex-1 bg-border/70" />
                    <span>Or use email</span>
                    <div className="h-px flex-1 bg-border/70" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-sm font-medium text-foreground">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={handleFocus}
                    placeholder="you@example.com"
                    data-testid="input-login-email"
                    className="w-full h-12 pl-10 pr-4 border-2 border-border/50 rounded-xl text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-premium-sm transition-all duration-150"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={handleFocus}
                    placeholder="Your password"
                    data-testid="input-login-password"
                    className="w-full h-12 pl-10 pr-12 border-2 border-border/50 rounded-xl text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-premium-sm transition-all duration-150"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword(!showPassword);
                      haptic("light");
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-password"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                  onClick={() => { haptic('light'); setMagicEmail(email); setShowMagicLink(true); setMagicSent(false); }}
                  data-testid="button-magic-link-signin"
                >
                  Email me a sign-in link
                </button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                  onClick={() => { haptic('light'); setResetEmail(email); setShowForgotPassword(true); setResetSent(false); }}
                  data-testid="button-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={!email || !password || isLoggingIn}
              data-testid="button-login"
              whileTap={{ scale: 0.97 }}
              className="kiddo-gold-button w-full h-14 text-base font-semibold rounded-2xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.97]"
            >
              {isLoggingIn ? (
                <motion.div className="flex items-center gap-3">
                  <ThinkingOrb size={20} variant="processing" />
                  <motion.span
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Signing in...
                  </motion.span>
                </motion.div>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>

          {/* Passkey sign-in. Per FACE_ID_SPEC.md WebAuthn item.
              The browser ceremony fires from PasskeySignInButton; on
              success it calls /api/auth/passkey/authenticate/verify
              which establishes the same session shape the password
              flow does. Falls through silently when no passkey is
              registered or the browser doesn't support WebAuthn. */}
          <PasskeySignInButton
            onSuccess={() => {
              haptic('success');
              if (redirectTarget === "/dashboard" || redirectTarget.startsWith("/dashboard")) {
                prefetchDashboard(queryClient, getActiveFundId());
              }
              setLocation(redirectTarget);
            }}
          />

          <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-5 text-center space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Don't have an account yet?</p>
              <Link href="/get-started">
                <span className="text-foreground font-medium hover:underline cursor-pointer" data-testid="link-start-child-fund">
                  Start your child's fund &rarr;
                </span>
              </Link>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                <ShieldCheck size={16} className="text-primary" />
                <span className="font-medium">256-bit SSL encryption</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                When investing is live, brokerage services are provided by DriveWealth, member FINRA and SIPC.
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Forgot-password modal — Radix Dialog primitive instead of the
          previous custom <div className="fixed inset-0"> implementation.
          Radix provides role="dialog" + aria-modal="true" + focus trap
          + Escape-to-close + return-focus-to-opener semantics out of
          the box, all of which the custom impl was missing (WCAG 4.1.2
          failure caught by the 2026-05-25 team a11y audit). The
          Dialog primitive used here is the same one Home.tsx ProductBento
          modal uses — established codebase pattern. */}
      {/* Magic-link sign-in modal. Mirrors the forgot-password modal
          shape per Login.tsx convention. Gifters who signed up via the
          passwordless flow have no password to reset; this gives them
          a parallel path. Anti-enumeration: same generic "if account
          exists" success copy. Per
          project_recurring_gifting_without_password_spec.md. */}
      <Dialog open={showMagicLink} onOpenChange={setShowMagicLink}>
        <DialogContent className="max-w-sm">
          {magicSent ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <ShieldCheck size={22} className="text-primary" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-center">Check your inbox</DialogTitle>
                <DialogDescription className="text-center">
                  If an account exists for <span className="font-medium text-foreground">{magicEmail}</span>, we've sent a one-tap sign-in link. The link is good for 15 minutes.
                </DialogDescription>
              </DialogHeader>
              <button
                onClick={() => setShowMagicLink(false)}
                className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Sign in with email link</DialogTitle>
                <DialogDescription>Enter your email and we'll send you a one-tap sign-in link. No password needed.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleMagicLinkRequest} className="space-y-3">
                <label htmlFor="magic-email" className="sr-only">Email address</label>
                <input
                  id="magic-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full h-12 px-4 border-2 border-border/50 rounded-xl text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  data-testid="input-magic-email"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!magicEmail.trim() || magicLoading}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="button-magic-submit"
                >
                  {magicLoading ? "Sending..." : "Send sign-in link"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMagicLink(false)}
                  className="w-full h-11 rounded-xl font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="max-w-sm">
          {resetSent ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <ShieldCheck size={22} className="text-primary" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-center">Check your inbox</DialogTitle>
                <DialogDescription className="text-center">
                  If an account exists for <span className="font-medium text-foreground">{resetEmail}</span>, we've sent a password reset link.
                </DialogDescription>
              </DialogHeader>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Reset your password</DialogTitle>
                <DialogDescription>Enter your email and we'll send you a reset link.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <label htmlFor="reset-email" className="sr-only">Email address</label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full h-12 px-4 border-2 border-border/50 rounded-xl text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  data-testid="input-reset-email"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!resetEmail.trim() || resetLoading}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="button-reset-submit"
                >
                  {resetLoading ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full h-11 rounded-xl font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
