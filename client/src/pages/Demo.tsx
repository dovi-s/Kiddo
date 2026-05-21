// Public landing page for the Dunphy family demo. Lists the seven
// shareable accounts with one-click login buttons that auto-submit
// the /api/auth/login endpoint with the appropriate email +
// universal password.
//
// Route: /demo. Per DUNPHY_DEMO_SPEC.md.
//
// Disclaimer footer satisfies the character-name IP risk noted in
// the spec (small-risk-rising-with-scale per the spec's Open Questions
// section). Says "not affiliated with or endorsed by 20th Century
// Studios or Disney" explicitly. Buys runway if a C&D ever lands.

import { useState } from "react";
import { useLocation } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { GradientText } from "@/components/ui/gemini";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { setActiveFundId } from "@/hooks/use-active-fund";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Users, Gift, ShieldCheck, Sparkles } from "lucide-react";
import { LockedRefusalsPanel } from "@/components/LockedRefusalsPanel";

const DEMO_PASSWORD = "dunphyfamily";

type DemoAccount = {
  email: string;
  display: string;
  role: "parent" | "co-parent" | "gifter";
  oneLiner: string;
};

const ACCOUNTS: DemoAccount[] = [
  {
    email: "phil@dunphyfamily.com",
    display: "Phil Dunphy",
    role: "parent",
    oneLiner: "Parent dashboard, three kids' funds, Family-tier features unlocked. Start here.",
  },
  {
    email: "claire@dunphyfamily.com",
    display: "Claire Dunphy",
    role: "co-parent",
    oneLiner: "Co-parent view of the same three funds. Demonstrates the partner-access flow.",
  },
  {
    email: "jay@dunphyfamily.com",
    display: "Jay Pritchett",
    role: "gifter",
    oneLiner: "Grandfather. Large birthday gifts in Google stock. The cool-grandpa pattern.",
  },
  {
    email: "gloria@dunphyfamily.com",
    display: "Gloria Pritchett",
    role: "gifter",
    oneLiner: "Grandmother. Disney gifts with Spanish-language notes. The Memory Book emotional layer.",
  },
  {
    email: "mitchell@dunphyfamily.com",
    display: "Mitchell Pritchett",
    role: "gifter",
    oneLiner: "Uncle. Recurring annual birthday gift in Apple. Set-it-and-forget-it gifter.",
  },
  {
    email: "cameron@dunphyfamily.com",
    display: "Cameron Tucker",
    role: "gifter",
    oneLiner: "Uncle. Gifts Disney stock to all three kids. \"Because magic is always a good investment.\"",
  },
  {
    email: "manny@dunphyfamily.com",
    display: "Manny Delgado",
    role: "gifter",
    oneLiner: "Cousin. Small gift in Roblox stock. The young-gifter angle.",
  },
];

export default function Demo() {
  const [, setLocation] = useLocation();
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const { toast } = useToast();
  // Use useAuth's login mutation rather than raw fetch — it clears
  // the per-user localStorage caches (funds list, active fund ID,
  // per-fund snapshots) on success. Going through fetch directly
  // (the old Demo.tsx pattern) left the previous user's cached funds
  // in localStorage, which caused Demo logins to render the previous
  // account's funds instead of the Dunphy seed.
  const { login } = useAuth();

  // Generic demo login. After successful auth, parents go to
  // /dashboard and gifters go to /gifter. The "Skip to Haley"
  // featured CTA below uses a specialized version that auto-selects
  // Haley's fund and lands on /age18-plan.
  const handleLogin = async (email: string) => {
    setLoadingEmail(email);
    haptic("selection");
    try {
      await login({ email, password: DEMO_PASSWORD });
      haptic("success");
      const account = ACCOUNTS.find((a) => a.email === email);
      const dest = account?.role === "gifter" ? "/gifter" : "/dashboard";
      setLocation(dest);
    } catch (err) {
      haptic("error");
      toast({
        title: "Demo login failed",
        description: err instanceof Error ? err.message : "Try again, or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoadingEmail(null);
    }
  };

  // Featured-walkthrough shortcut: log in as Phil, auto-select
  // Haley's fund as the active fund, land on /age18-plan.
  const HALEY_FEATURED_EMAIL = "phil@dunphyfamily.com";
  const HALEY_SLUG = "haley-dunphy";
  const handleHaleyShortcut = async () => {
    setLoadingEmail(HALEY_FEATURED_EMAIL);
    haptic("selection");
    try {
      await login({ email: HALEY_FEATURED_EMAIL, password: DEMO_PASSWORD });
      // After login (which cleared the previous user's caches), fetch
      // Phil's funds fresh from server and locate Haley by slug.
      const fundsRes = await fetch("/api/funds", { credentials: "include" });
      if (!fundsRes.ok) {
        haptic("success");
        setLocation("/dashboard");
        return;
      }
      const funds = await fundsRes.json().catch(() => []) as Array<{ id: string; slug?: string | null }>;
      const haley = funds.find((f) => String(f.slug || "").toLowerCase() === HALEY_SLUG);
      if (haley?.id) {
        setActiveFundId(haley.id);
        haptic("success");
        setLocation(`/age18-plan?fund=${haley.id}`);
      } else {
        haptic("success");
        setLocation("/dashboard");
      }
    } catch (err) {
      haptic("error");
      toast({
        title: "Demo walkthrough failed",
        description: err instanceof Error ? err.message : "Try again, or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoadingEmail(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="demo" />
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              See Kiddo through the <GradientText>Dunphys</GradientText>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A paper-trading-style demo. Real screens, illustrative dollars. Pick any account below to log in. No card needed.
            </p>
          </div>

          {/* Featured walkthrough — drops the visitor straight on
              Haley's Age 18 Plan (the centerpiece slider + Phil's
              sealed letter + the at-21 handoff countdown). Saves 3
              navigation clicks vs the standard "log in as Phil →
              dashboard → age18-plan → switch funds" path. Sits above
              the per-account login grid so the first-time visitor
              sees the highest-leverage demo surface as the default
              call to action; the per-account grid stays for visitors
              who want to explore the gifter / co-parent angles. */}
          <section className="mx-auto mt-12 max-w-4xl rounded-3xl border-2 border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.05)] p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
                  <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] uppercase tracking-widest">
                    Featured walkthrough
                  </p>
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                  Haley's a month from 21.
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  The full handoff page: the centerpiece projection slider, Phil's sealed letter, 17 voice memos from Gloria, 16 years of gifts. Land here first to see what Kiddo is for.
                </p>
              </div>
              <button
                type="button"
                onClick={handleHaleyShortcut}
                disabled={loadingEmail === HALEY_FEATURED_EMAIL}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                data-testid="demo-haley-shortcut"
              >
                {loadingEmail === HALEY_FEATURED_EMAIL ? "Opening…" : "Open Haley's plan"}
                <ArrowRight size={14} />
              </button>
            </div>
          </section>

          <section className="mx-auto mt-10 grid max-w-4xl gap-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">Or start with Phil</h2>
            <p className="text-sm text-muted-foreground">
              Three kids, three funds, Family-tier plan. The parent-side experience top to bottom.
            </p>
            {ACCOUNTS.filter((a) => a.role === "parent").map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleLogin(account.email)}
                disabled={loadingEmail === account.email}
                className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 px-5 py-4 text-left transition-all hover:border-primary/60 hover:bg-primary/10 disabled:opacity-60"
                data-testid={`demo-login-${account.email.split("@")[0]}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{account.display}</p>
                    <p className="text-xs text-muted-foreground">{account.oneLiner}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </section>

          <section className="mx-auto mt-10 grid max-w-4xl gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">Or log in as a gifter</h2>
            <p className="text-sm text-muted-foreground">
              See the gifter side of the loop. Each account demonstrates a different gifter pattern.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {ACCOUNTS.filter((a) => a.role !== "parent").map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleLogin(account.email)}
                  disabled={loadingEmail === account.email}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-all hover:border-foreground/30 hover:bg-card/80 disabled:opacity-60"
                  data-testid={`demo-login-${account.email.split("@")[0]}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {account.role === "co-parent" ? <Users size={14} /> : <Gift size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{account.display}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{account.oneLiner}</p>
                  </div>
                  <ArrowRight size={14} className="shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </section>

          {/* Locked refusals panel — extracted to a shared component
              2026-05-21 so the same trust frame can render on both
              /demo and the public marketing site (Home.tsx). Single
              source of truth for the copy; edits in
              LockedRefusalsPanel.tsx propagate to both surfaces. */}
          <div className="mt-12">
            <LockedRefusalsPanel variant="demo" />
          </div>

          <section className="mx-auto mt-8 max-w-3xl rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2 font-semibold text-foreground">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
              How the demo works
            </p>
            <ul className="mt-3 space-y-2 pl-6">
              <li className="list-disc">
                Everything you see is illustrative. Dollar amounts, gifts, and holdings are seeded; no real money moved.
              </li>
              <li className="list-disc">
                Try the full flow. Sending a gift, setting up recurring investments, exploring the Memory Book all work, but no card is charged and no DriveWealth order fires.
              </li>
              <li className="list-disc">
                Demo state resets periodically. If something looks different from what you expected, that's why.
              </li>
              <li className="list-disc">
                Want your own? <a href="/get-started" className="text-primary underline-offset-2 hover:underline">Create a real fund</a> with your own child, your own gift link, and the same product behavior on real money.
              </li>
            </ul>
          </section>

          <p className="mx-auto mt-10 max-w-3xl text-center text-[11px] leading-relaxed text-muted-foreground">
            The Dunphy family is a cultural reference used for demonstration purposes. Kiddo is not affiliated with or endorsed by 20th Century Studios, The Walt Disney Company, or the creators of Modern Family.
          </p>

          <div className="mt-12 text-center">
            <a
              href="/get-started"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              data-testid="demo-create-real-fund"
            >
              Create a real fund
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
