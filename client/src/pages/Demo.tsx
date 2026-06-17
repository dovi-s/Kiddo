// Public landing page for the Rivera family demo. Lists the seven
// shareable accounts with one-click login buttons that auto-submit
// the /api/auth/login endpoint with the appropriate email +
// universal password.
//
// Route: /demo. Per DUNPHY_DEMO_SPEC.md.
//
// The Rivera family is an original, fictional cast (renamed off the old
// Modern Family personas to remove the IP exposure per IP_STRATEGY.md), so
// the footer is a plain "fictional, for illustration" note — no real-show
// affiliation to disclaim.

import { useState } from "react";
import { useLocation } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { GradientText } from "@/components/ui/gemini";
import { useToast } from "@/hooks/use-toast";
import { writeLocalCache } from "@/lib/local-cache";
import { haptic } from "@/lib/haptics";
import { setActiveFundId } from "@/hooks/use-active-fund";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Users, Gift, ShieldCheck, Star, GraduationCap } from "lucide-react";
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

// Persona portraits for the demo picker. The Rivera family is an original,
// fictional cast (no real likenesses), so each persona renders as a clean
// evergreen initials chip via PersonaAvatar's fallback. Keep this map empty
// until we have owned/illustrated portraits to drop in (keyed by email).
const PERSONA_PHOTOS: Record<string, string> = {};

// Circular persona portrait with a graceful fallback to initials — the photo
// URLs are external (flaky), so a broken image degrades to a clean evergreen
// initials chip rather than a torn-image icon.
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
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export default function Demo() {
  // Now linked from the footer ("See it live"), so it's no longer an orphan URL.
  // Stay noindex,nofollow regardless: this page one-click logs a visitor into a
  // seeded persona's account — not something we want in search results or
  // competing with the real marketing pages. Mirrors /partners. Kept out of the
  // sitemap too (see server/seoMeta.ts).
  usePageSeo({
    title: "See Kiddo live | Explore a real family's funds",
    description:
      "Step into a live Kiddo demo. Explore the parent, co-parent, gifter, and grown-up views of a family's investment funds, with no signup.",
    robots: "noindex,nofollow",
    ogType: "website",
  });
  const [, setLocation] = useLocation();
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const { toast } = useToast();
  // Use useAuth's login mutation rather than raw fetch — it clears
  // the per-user localStorage caches (funds list, active fund ID,
  // per-fund snapshots) on success. Going through fetch directly
  // (the old Demo.tsx pattern) left the previous user's cached funds
  // in localStorage, which caused Demo logins to render the previous
  // account's funds instead of the Rivera seed.
  const { login } = useAuth();

  // Generic demo login. After successful auth, parents go to
  // /dashboard and gifters go to /my-gifts. The "Skip to Mia"
  // featured CTA below uses a specialized version that auto-selects
  // Mia's fund and lands on /age-18-plan.
  // Pre-seed each fund's count-up cache slightly BELOW its live balance so
  // the very first dashboard open plays the cached→roll moment (founder call
  // 2026-06-04). Demo login clears localStorage, so without this a prospect's
  // first paint has no "last visit" number and the product's best micro-beat
  // never fires. The demo's fiction is stepping into Elena's life mid-stream —
  // a synthetic yesterday-number is set dressing: the start is bent ~0.6%,
  // the END is always the true balance. Best-effort; navigation never waits
  // on failure. (The Dashboard's own cache-write keeps re-seeding low for
  // demo accounts, so every later fund-tab open rolls too.)
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
          // Same envelope + key as Dashboard's FUND_BALANCE_CACHE_PREFIX
          // write (writeLocalCache wraps {savedAt, value}).
          writeLocalCache(`kiddo.fund.balance.v1:${f.id}`, total * 0.994);
        }
      }
    } catch { /* set dressing only — never block the login */ }
  };

  const handleLogin = async (email: string) => {
    setLoadingEmail(email);
    haptic("selection");
    try {
      await login({ email, password: DEMO_PASSWORD });
      const account = ACCOUNTS.find((a) => a.email === email);
      if (account?.role !== "gifter") await preSeedDemoRoll();
      haptic("success");
      const dest = account?.role === "gifter" ? "/my-gifts" : "/dashboard";
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

  // Featured-walkthrough shortcut: log in as Elena (Mom, the primary custodian
  // / lead persona), auto-select the approaching-handoff fund (Nora, ~30 days
  // from majority) as the active fund, land on /age-18-plan. (Mia is now PAST
  // majority — her fund is the graduated adult-account demo, reachable from the
  // dashboard/Kid View.)
  const FEATURED_EMAIL = "elena@riverafamily.com";
  const FEATURED_SLUG = "nora-rivera";
  const handleFeaturedShortcut = async () => {
    setLoadingEmail(FEATURED_EMAIL);
    haptic("selection");
    try {
      await login({ email: FEATURED_EMAIL, password: DEMO_PASSWORD });
      // Same first-open roll pre-seed as handleLogin — the featured
      // walkthrough lands on dashboards too.
      await preSeedDemoRoll();
      // After login (which cleared the previous user's caches), fetch
      // Elena's funds fresh from server and locate the featured fund by slug.
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
        // Route is /age-18-plan (with dashes) per App.tsx. Navigating to
        // /age18-plan fell through to the public /:fund catch-all, which
        // tried to resolve a fund slug "age18-plan", 404'd, and rendered
        // the "this gift link is outdated" page. Fixed 2026-05-26.
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

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="demo" />
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              See Kiddo through the <GradientText>Riveras</GradientText>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A full working demo: real screens, illustrative dollars. Pick any account below to log in. No card needed.
            </p>
          </div>

          {/* Featured walkthrough — drops the visitor straight on
              Nora's handoff plan (the /age-18-plan page): the
              centerpiece slider + her dad's sealed letter + the at-21
              handoff countdown. Saves 3 navigation clicks vs the
              standard "log in as Elena → dashboard → age-18-plan →
              switch funds" path. (Mia, the older sister, is already
              PAST majority — her fund is the graduated adult-account
              demo, reachable from the dashboard.) Sits above
              the per-account login grid so the first-time visitor
              sees the highest-leverage demo surface as the default
              call to action; the per-account grid stays for visitors
              who want to explore the gifter / co-parent angles. */}
          <section className="mx-auto mt-12 max-w-4xl rounded-3xl border-2 border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.05)] p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
                  <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] uppercase tracking-widest">
                    Featured walkthrough
                  </p>
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                  Nora is weeks from 21.
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {/* "Sofia's notes in Spanish", not "voice memos": the demo-audio
                      assets don't exist yet (client/public/demo-audio/README.md, IP
                      question pending), so her memos render text-only. Don't promise
                      audio the page can't show; upgrade the word when audio lands. */}
                  In a few weeks, the fund her mom Elena built becomes hers. This is the handoff page Elena sees: the projection slider, a sealed letter from her dad, Sofia's notes in Spanish, a whole childhood of gifts. Start here.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFeaturedShortcut}
                disabled={loadingEmail === FEATURED_EMAIL}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                data-testid="demo-featured-shortcut"
              >
                {loadingEmail === FEATURED_EMAIL ? "Opening…" : "Open Nora's plan"}
                <ArrowRight size={14} />
              </button>
            </div>
          </section>

          <section className="mx-auto mt-10 grid max-w-4xl gap-4">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Users size={18} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
              Or start with Elena
            </h2>
            <p className="text-sm text-muted-foreground">
              Three kids at three stages: Theo still getting gifts, Nora weeks from taking ownership, and Mia's fund already handed off. The whole arc in one family.
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
                  <PersonaAvatar email={account.email} name={account.display} size={44} />
                  <div>
                    <p className="font-semibold text-foreground">{account.display}</p>
                    <p className="text-xs text-muted-foreground">{account.oneLiner}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </section>

          <section className="mx-auto mt-10 grid max-w-4xl gap-4">
            {/* "Personal account", never "adult account", user-facing —
                terminology locked 2026-06-04 (ownership framing, not age). */}
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <GraduationCap size={18} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
              Step into the account she owns now
            </h2>
            <p className="text-sm text-muted-foreground">
              Mia came of age a year ago, and the fund transferred to her. Log in to see her personal account: the same fund, now hers to direct, with the whole Memory Book unlocked. From Elena's dashboard it's a fund she can no longer touch.
            </p>
            {ACCOUNTS.filter((a) => a.role === "graduate").map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleLogin(account.email)}
                disabled={loadingEmail === account.email}
                className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-5 py-4 text-left transition-all hover:border-[hsl(var(--kiddo-evergreen)/0.6)] hover:bg-[hsl(var(--kiddo-evergreen)/0.1)] disabled:opacity-60"
                data-testid={`demo-login-${account.email.split("@")[0]}`}
              >
                <div className="flex items-center gap-4">
                  <PersonaAvatar email={account.email} name={account.display} size={44} />
                  <div>
                    <p className="font-semibold text-foreground">{account.display}</p>
                    <p className="text-xs text-muted-foreground">{account.oneLiner}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="shrink-0 text-[hsl(var(--kiddo-evergreen))] transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </section>

          <section className="mx-auto mt-10 grid max-w-4xl gap-3">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Gift size={18} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
              Log in as a gifter
            </h2>
            <p className="text-sm text-muted-foreground">
              Everyone in the family gives differently. Pick one to see their side.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {ACCOUNTS.filter((a) => a.role !== "parent" && a.role !== "graduate").map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleLogin(account.email)}
                  disabled={loadingEmail === account.email}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-all hover:border-foreground/30 hover:bg-card/80 disabled:opacity-60"
                  data-testid={`demo-login-${account.email.split("@")[0]}`}
                >
                  <PersonaAvatar email={account.email} name={account.display} size={36} />
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
                Try the full flow. Sending a gift, setting up recurring investments, exploring the Memory Book all work, but no card is charged and no real trade is placed.
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
            The Rivera family is fictional, created to demonstrate how Kiddo works. Names, gifts, notes, and dollar amounts are illustrative; any resemblance to real people is coincidental.
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
