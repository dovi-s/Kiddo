// Public landing page for the Rivera family demo. Lists the shareable
// accounts with one-click login buttons that auto-submit the auth flow.
//
// Route: /demo. Per DUNPHY_DEMO_SPEC.md.

import { useState } from "react";
import { useLocation } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { useToast } from "@/hooks/use-toast";
import { writeLocalCache } from "@/lib/local-cache";
import { haptic } from "@/lib/haptics";
import { setActiveFundId } from "@/hooks/use-active-fund";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Gift, GraduationCap, ShieldCheck, Star, Users } from "lucide-react";
import { LockedRefusalsPanel } from "@/components/LockedRefusalsPanel";
import { usePageSeo } from "@/lib/seo";

const DEMO_PASSWORD = "riverafamily";

type DemoAccount = {
  email: string;
  display: string;
  role: "parent" | "co-parent" | "gifter" | "graduate";
  oneLiner: string;
};

const ACCOUNTS: DemoAccount[] = [
  {
    email: "marcus@riverafamily.com",
    display: "Marcus Rivera",
    role: "co-parent",
    oneLiner: "Dad, the co-parent. The same three funds from his own login.",
  },
  {
    email: "elena@riverafamily.com",
    display: "Elena Rivera",
    role: "parent",
    oneLiner: "Mom. The parent dashboard on the Family plan, with all three kids' funds in one place.",
  },
  {
    email: "robert@riverafamily.com",
    display: "Robert Rivera",
    role: "gifter",
    oneLiner: "Grandfather. Big birthday gifts in Google stock.",
  },
  {
    email: "sofia@riverafamily.com",
    display: "Sofia Rivera",
    role: "gifter",
    oneLiner: "Step-grandmother, married to Robert. Disney gifts with notes in Spanish.",
  },
  {
    email: "david@riverafamily.com",
    display: "David Rivera",
    role: "gifter",
    oneLiner: "Uncle. A recurring Apple gift every birthday, on autopilot.",
  },
  {
    email: "chris@riverafamily.com",
    display: "Chris Bennett",
    role: "gifter",
    oneLiner: "Uncle. Disney stock for all three kids. \"Because magic is always a good investment.\"",
  },
  {
    email: "leo@riverafamily.com",
    display: "Leo Rivera",
    role: "gifter",
    oneLiner: "Step-uncle, closest to the kids' age. A small Roblox gift.",
  },
  {
    email: "mia@riverafamily.com",
    display: "Mia Rivera",
    role: "graduate",
    oneLiner: "Her own account now, one year after the handoff.",
  },
];

const PERSONA_PHOTOS: Record<string, string> = {};

function PersonaAvatar({ email, name, size }: { email: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = PERSONA_PHOTOS[email];
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (!src || failed) {
    return (
      <div
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
        className="flex shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] font-bold text-[hsl(var(--kiddo-evergreen))]"
        aria-hidden
      >
        {initials}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size }} className="shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-black/5">
      <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
    </div>
  );
}

export default function Demo() {
  usePageSeo({
    title: "See Kiddo live | Explore a real family's funds",
    description: "Step into a live Kiddo demo. Explore the parent, co-parent, gifter, and grown-up views of a family's investment funds, with no signup.",
    robots: "noindex,nofollow",
    ogType: "website",
  });

  const [, setLocation] = useLocation();
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const { toast } = useToast();
  const { login } = useAuth();

  const preSeedDemoRoll = async () => {
    try {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return;
      const funds = await res.json().catch(() => []) as Array<{ id: string; balance?: string; pendingBalance?: string; cashBalance?: string }>;
      for (const f of funds) {
        const total = (parseFloat(String(f.balance || "0")) || 0)
          + (parseFloat(String(f.pendingBalance || "0")) || 0)
          + (parseFloat(String(f.cashBalance || "0")) || 0);
        if (total > 0 && f.id) {
          writeLocalCache(`kiddo.fund.balance.v1:${f.id}`, total * 0.994);
        }
      }
    } catch {
      // Set dressing only; never block the login.
    }
  };

  const handleLogin = async (email: string) => {
    setLoadingEmail(email);
    haptic("selection");
    try {
      await login({ email, password: DEMO_PASSWORD });
      const account = ACCOUNTS.find((a) => a.email === email);
      if (account?.role !== "gifter") await preSeedDemoRoll();
      haptic("success");
      setLocation(account?.role === "gifter" ? "/my-gifts" : "/dashboard");
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

  const FEATURED_EMAIL = "elena@riverafamily.com";
  const FEATURED_SLUG = "nora-rivera";

  const handleFeaturedShortcut = async () => {
    setLoadingEmail(FEATURED_EMAIL);
    haptic("selection");
    try {
      await login({ email: FEATURED_EMAIL, password: DEMO_PASSWORD });
      await preSeedDemoRoll();
      const fundsRes = await fetch("/api/funds", { credentials: "include" });
      if (!fundsRes.ok) {
        haptic("success");
        setLocation("/dashboard");
        return;
      }
      const funds = await fundsRes.json().catch(() => []) as Array<{ id: string; slug?: string | null }>;
      const featured = funds.find((f) => String(f.slug || "").toLowerCase() === FEATURED_SLUG);
      if (featured?.id) {
        setActiveFundId(featured.id);
        haptic("success");
        setLocation(`/age-18-plan?fund=${featured.id}`);
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

  const parentAccounts = ACCOUNTS.filter((a) => a.role === "parent");
  const graduateAccounts = ACCOUNTS.filter((a) => a.role === "graduate");
  const gifterAccounts = ACCOUNTS.filter((a) => a.role !== "parent" && a.role !== "graduate");

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="overflow-x-hidden px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="demo" />
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Live demo</p>
            <h1 className="font-heading text-4xl font-bold tracking-[-0.03em] text-foreground md:text-6xl">
              Step into one family's full Kiddo story.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              This is the live Rivera-family demo: parent, gifter, and post-handoff views, all connected to the same funds. Real product behavior. Illustrative dollars.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              {["Real screens", "No signup required", "No card needed"].map((item) => (
                <span key={item} className="inline-flex items-center rounded-full bg-card px-3.5 py-2 shadow-premium-sm ring-1 ring-black/5">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <section className="mx-auto mt-12 max-w-5xl rounded-[2rem] border border-[hsl(var(--kiddo-evergreen)/0.24)] bg-[linear-gradient(135deg,hsl(var(--kiddo-evergreen)/0.08),hsl(var(--kiddo-cream))_72%)] p-6 shadow-premium-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Star size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--kiddo-evergreen))]">
                    Featured walkthrough
                  </p>
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                  Start with the handoff.
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Nora is weeks from taking ownership. This route drops you into the most emotionally important surface in the demo: the handoff plan, the projection, the sealed letter, and the accumulated record of who showed up for her.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFeaturedShortcut}
                disabled={loadingEmail === FEATURED_EMAIL}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                data-testid="demo-featured-shortcut"
              >
                {loadingEmail === FEATURED_EMAIL ? "Opening..." : "Open Nora's plan"}
                <ArrowRight size={14} />
              </button>
            </div>
          </section>

          <section className="mx-auto mt-12 max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Choose an angle</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                The same family, seen from three different lives.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Start with the parent, the grown-up child, or one of the people who gives. Each login reveals a different truth about the same product.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-premium-sm">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <Users size={18} className="text-primary" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-foreground">Parent view</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Elena sees the full family arc: one child still receiving gifts, one nearing handoff, and one already transferred.
                </p>
                <div className="mt-5">
                  {parentAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => handleLogin(account.email)}
                      disabled={loadingEmail === account.email}
                      className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-left transition-all hover:border-primary/40 hover:bg-primary/10 disabled:opacity-60"
                      data-testid={`demo-login-${account.email.split("@")[0]}`}
                    >
                      <div className="flex items-center gap-4">
                        <PersonaAvatar email={account.email} name={account.display} size={40} />
                        <div>
                          <p className="font-semibold text-foreground">{account.display}</p>
                          <p className="text-xs text-muted-foreground">{account.oneLiner}</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-premium-sm">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.08)]">
                  <GraduationCap size={18} className="text-[hsl(var(--kiddo-evergreen))]" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-foreground">Personal account</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Mia's fund transferred a year ago. This shows what the product feels like once the account is fully hers.
                </p>
                <div className="mt-5">
                  {graduateAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => handleLogin(account.email)}
                      disabled={loadingEmail === account.email}
                      className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.24)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-4 py-4 text-left transition-all hover:border-[hsl(var(--kiddo-evergreen)/0.42)] hover:bg-[hsl(var(--kiddo-evergreen)/0.10)] disabled:opacity-60"
                      data-testid={`demo-login-${account.email.split("@")[0]}`}
                    >
                      <div className="flex items-center gap-4">
                        <PersonaAvatar email={account.email} name={account.display} size={40} />
                        <div>
                          <p className="font-semibold text-foreground">{account.display}</p>
                          <p className="text-xs text-muted-foreground">{account.oneLiner}</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-[hsl(var(--kiddo-evergreen))] transition-transform group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-premium-sm">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-gold)/0.18)]">
                  <Gift size={18} className="text-[hsl(var(--kiddo-gold-ink))]" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-foreground">Gifter side</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Grandparents, uncles, and family friends all show up differently. These logins show their side of the story.
                </p>
                <div className="mt-5 grid gap-2">
                  {gifterAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => handleLogin(account.email)}
                      disabled={loadingEmail === account.email}
                      className="group flex items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left transition-all hover:border-foreground/20 hover:bg-card/80 disabled:opacity-60"
                      data-testid={`demo-login-${account.email.split("@")[0]}`}
                    >
                      <PersonaAvatar email={account.email} name={account.display} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{account.display}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{account.oneLiner}</p>
                      </div>
                      <ArrowRight size={14} className="shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-12">
            <LockedRefusalsPanel variant="demo" />
          </div>

          <section className="mx-auto mt-8 max-w-3xl rounded-[1.75rem] border border-border/60 bg-card/90 p-6 text-sm leading-relaxed text-muted-foreground shadow-premium-sm">
            <p className="flex items-start gap-2 font-semibold text-foreground">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
              How the demo works
            </p>
            <ul className="mt-3 space-y-2 pl-6">
              <li className="list-disc">Everything you see is illustrative. Dollar amounts, gifts, and holdings are seeded; no real money moved.</li>
              <li className="list-disc">You can explore the real product flow, including gifting, recurring, Memory Book, and account transitions.</li>
              <li className="list-disc">Demo state resets periodically. If something looks different from what you expected, that is why.</li>
              <li className="list-disc">Want your own? <a href="/get-started" className="text-primary underline-offset-2 hover:underline">Create a real fund</a> with the same product behavior on real money.</li>
            </ul>
          </section>

          <p className="mx-auto mt-10 max-w-3xl text-center text-[11px] leading-relaxed text-muted-foreground">
            The Rivera family is fictional, created to demonstrate how Kiddo works. Names, gifts, notes, and dollar amounts are illustrative; any resemblance to real people is coincidental.
          </p>

          <div className="mt-12 text-center">
            <Button asChild size="lg" className="h-14 px-8 text-base" data-testid="demo-create-real-fund">
              <a href="/get-started">
                Create a real fund
                <ArrowRight size={14} />
              </a>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
