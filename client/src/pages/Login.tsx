import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setLocation("/dashboard?type=child&name=Mila");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-stone-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <Logo size="md" className="text-stone-900" />
          </Link>
          <div className="flex items-center gap-1 text-xs text-stone-400">
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
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-stone-900">Welcome back</h1>
            <p className="text-stone-500">Sign in to manage your funds</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="input-login-email"
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  data-testid="input-login-password"
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!email || !password || isLoading}
              data-testid="button-login"
              className="w-full py-4 bg-stone-900 text-white text-base font-medium rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="text-center space-y-4">
            <button className="text-sm text-stone-500 hover:text-stone-700">
              Forgot password?
            </button>
            <div className="text-sm text-stone-500">
              Don't have an account?{" "}
              <Link href="/get-started">
                <span className="text-stone-900 font-medium hover:underline cursor-pointer">
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
