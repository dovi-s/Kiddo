import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThinkingOrb, GeminiHeroGradient, GradientText } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import brandMark from "@/assets/kora-brand-mark.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    haptic('medium');
    setIsLoading(true);
    setTimeout(() => {
      haptic('success');
      setLocation("/dashboard?type=child&name=Mila");
    }, 800);
  };
  
  const handleFocus = () => {
    haptic('light');
  };

  return (
    <div className="min-h-screen bg-background gemini-warm-section relative overflow-hidden">
      <GeminiHeroGradient />
      <header className="sticky top-0 z-40 gemini-glass-nav">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="md" className="text-foreground" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock size={12} />
            <span>Secure</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center space-y-4">
            <motion.img
              src={brandMark}
              alt="Kora"
              data-testid="img-brand-mark-login"
              className="w-32 h-auto mx-auto drop-shadow-sm"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-foreground">Welcome <GradientText>back</GradientText></h1>
              <p className="text-muted-foreground">Sign in to manage your funds</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-6 space-y-5 gemini-soft-container">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={handleFocus}
                  placeholder="you@example.com"
                  data-testid="input-login-email"
                  className="w-full h-12 px-4 border-2 border-border/50 rounded-xl text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-premium-sm transition-all duration-150"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={handleFocus}
                  placeholder="Your password"
                  data-testid="input-login-password"
                  className="w-full h-12 px-4 border-2 border-border/50 rounded-xl text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-premium-sm transition-all duration-150"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={!email || !password || isLoading}
              data-testid="button-login"
              whileTap={{ scale: 0.97 }}
              className="gemini-btn-shimmer w-full h-14 bg-primary text-primary-foreground text-base font-semibold rounded-2xl hover:bg-primary/90 shadow-premium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.97]"
            >
              {isLoading ? (
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

          <div className="text-center space-y-4">
            <button 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              onClick={() => haptic('light')}
            >
              Forgot password?
            </button>
            <div className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/get-started">
                <span className="text-foreground font-medium hover:underline cursor-pointer">
                  Get started
                </span>
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
