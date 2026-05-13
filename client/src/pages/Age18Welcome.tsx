// Age-18 handoff welcome walkthrough. Per AGE_18_HANDOFF_SPEC.md
// bucket 1. Five-screen calm tour fired right after the kid completes
// the ownership transfer at /transition/:token.
//
// Why this exists: the age-18 moment is currently handled emotionally
// (parent letter, Memory Book unlock) and legally (fund.userId flip
// in /api/age-transition/:token/complete). What's missing is the
// 60 minutes of orientation where the kid actually learns what they
// own, how taxes work, and what their options are. Without this, the
// most likely failure mode is selling everything to buy a car —
// same outcome cash gifts would have produced. The whole product
// premise depends on this moment landing well.
//
// Layout: single full-screen route. Internal `screen` state drives
// which of the five panels renders. The first three screens are
// load-bearing (no skip); 4 and 5 are skippable. On completion the
// server stamps fund.kidWelcomeCompletedAt and the kid lands on
// /dashboard.

import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Briefcase, Coins, Receipt, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useToast } from "@/hooks/use-toast";

type HandoffState = {
  shouldShowWelcome: boolean;
  isKidOwner: boolean;
  welcomeCompleted: boolean;
  fund: {
    id: string;
    name: string;
    recipientFirstName: string | null;
    balance: string;
    totalGain: string | null;
    gainPercent: string | null;
    majorityAge: number;
  };
};

function formatMoney(value: string | number | null | undefined, opts: { decimals?: number } = {}) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(numeric);
}

// Simple compounding projection: principal × (1 + r)^years.
// 7% is the locked rate used across Kiddo's projection surfaces —
// long-term real-return-on-equities heuristic, NOT a guarantee, copy
// elsewhere already disclaims this. Keep the rate here matching the
// Projection.tsx default so the screen 2 number doesn't disagree with
// other surfaces the kid might check later.
function projectAt(principal: number, years: number, rate = 0.07): number {
  if (!Number.isFinite(principal) || principal <= 0 || years <= 0) return principal || 0;
  return principal * Math.pow(1 + rate, years);
}

export default function Age18Welcome() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const search = useSearch();
  const fundId = useMemo(() => new URLSearchParams(search).get("fundId") || "", [search]);

  const { data, isLoading } = useQuery<HandoffState>({
    queryKey: ["/api/funds", fundId, "handoff-state"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/handoff-state`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!fundId,
  });

  const [screen, setScreen] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [hasJob, setHasJob] = useState<boolean | null>(null);
  const [bracket, setBracket] = useState<"0_45" | "45_100" | "100_plus" | null>(null);

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Save the income bracket only if the kid answered. Skipping
      // screen 4 leaves these null on the server — fine, the first-
      // sell tax explainer will ask again when it ships.
      if (hasJob !== null) {
        await fetch(`/api/users/me/earned-income`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            hasEarnedIncome: hasJob,
            estimatedIncomeBracket: bracket,
          }),
        });
      }
      const res = await fetch(`/api/funds/${fundId}/welcome-complete`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not complete");
      return res.json();
    },
    onSuccess: () => {
      setLocation("/dashboard");
    },
    onError: (err) => {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : "Try again." });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Guard: if the user isn't the kid-owner or already completed the
  // walkthrough, bounce to dashboard. Server returns these flags from
  // /handoff-state; we trust them as the single source of truth.
  if (!data.shouldShowWelcome) {
    setLocation("/dashboard");
    return null;
  }

  const fund = data.fund;
  const balance = parseFloat(String(fund.balance || "0"));
  const totalGain = parseFloat(String(fund.totalGain || "0"));
  const at65Years = 65 - fund.majorityAge;
  const projectedAt65 = projectAt(balance, at65Years);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-6 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-1 w-6 rounded-full transition-colors ${
                n <= screen ? "bg-foreground" : "bg-foreground/15"
              }`}
              aria-hidden
            />
          ))}
        </div>
      </header>

      <main className="px-6 py-12 max-w-2xl mx-auto">
        {screen === 1 && (
          <ScreenShell key="s1">
            <Eyebrow icon={<Sparkles size={14} />}>This is yours now.</Eyebrow>
            <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
              {fund.recipientFirstName ? `Hi, ${fund.recipientFirstName}.` : "Welcome."}
              <br />
              <span className="text-primary">{formatMoney(balance)}</span>{" "}
              <span className="text-2xl md:text-3xl font-semibold text-muted-foreground">is yours.</span>
            </h1>
            <p className="text-base text-foreground/80 leading-relaxed">
              What you see here is yours legally as of today. Nothing was sold. Nothing was moved.
              Just the name on the paperwork. Your fund kept growing the whole time you were growing up.
            </p>
            {totalGain > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total gain so far</p>
                <p className="font-heading text-2xl font-bold text-emerald-700">
                  +{formatMoney(totalGain)}
                </p>
                <p className="text-xs text-muted-foreground">
                  The cash gifts cousins gave you would be long gone. This isn't.
                </p>
              </div>
            )}
            <Continue onClick={() => setScreen(2)}>What can I do with this?</Continue>
          </ScreenShell>
        )}

        {screen === 2 && (
          <ScreenShell key="s2">
            <Eyebrow icon={<TrendingUp size={14} />}>Three buttons, three different futures.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              You have real choices now.
            </h1>
            <div className="space-y-3">
              <ChoiceCard
                title="Keep growing it"
                math={
                  balance > 0
                    ? `${formatMoney(balance)} today becomes about ${formatMoney(projectedAt65, { decimals: 0 })} by 65 if you don't touch it. Markets average ~7% a year long-term.`
                    : "Markets average ~7% a year long-term. Compounding works while you sleep."
                }
                tone="grow"
              />
              <ChoiceCard
                title="Withdraw some cash"
                math="Move money from your fund to a bank account. You pay no tax on withdrawing. Tax is on selling, not on moving cash you already own."
                tone="cash"
              />
              <ChoiceCard
                title="Sell some shares"
                math="Selling turns shares into cash. The gain (sale price minus what was paid) is what's taxed. The next screen explains how that works."
                tone="sell"
              />
            </div>
            <p className="text-sm text-muted-foreground italic">
              You don't have to decide anything right now. Most people don't.
            </p>
            <Continue onClick={() => setScreen(3)}>How do taxes work?</Continue>
          </ScreenShell>
        )}

        {screen === 3 && (
          <ScreenShell key="s3">
            <Eyebrow icon={<Receipt size={14} />}>Taxes, in 60 seconds.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              Three things that matter.
            </h1>
            <div className="space-y-4">
              <TaxConcept
                title="Long-term gains are taxed gently."
                body="Anything you've held over a year gets long-term capital gains rates: 0%, 15%, or 20% depending on your total income. Most college students hit 0%."
              />
              <TaxConcept
                title="The kiddie tax is over."
                body="That special rate that applied while you were a kid no longer applies. You file your own taxes now. We send you a 1099 every January telling you exactly what to put down."
              />
              <TaxConcept
                title="Low-income years are sell-friendly years."
                body="Sell while you're a student earning $0–$10k → likely 0% federal tax on gains. Sell at 30 earning $80k → 15%. The same sale, very different bill. Timing matters."
              />
            </div>
            <Continue onClick={() => setScreen(4)}>Got it.</Continue>
          </ScreenShell>
        )}

        {screen === 4 && (
          <ScreenShell key="s4">
            <Eyebrow icon={<Briefcase size={14} />}>One more thing, if you have a job.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              Earned income makes Roth IRA dollars.
            </h1>
            <p className="text-base text-foreground/80 leading-relaxed">
              Every dollar you earn at a job, you can put up to that much into a Roth IRA (up to $7,000/yr).
              You pay tax on it going in. Every dollar of growth comes out <strong>tax-free</strong> at 59½.
            </p>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <p className="text-sm font-semibold">The math</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                $6,000 into a Roth at 18. Never add another dollar. At 65 it's worth about{" "}
                <span className="font-semibold text-emerald-700">$130,000</span>. Tax-free.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold">Do you have a job right now?</p>
              <div className="grid grid-cols-2 gap-2">
                <ToggleBtn active={hasJob === true} onClick={() => setHasJob(true)}>
                  Yes
                </ToggleBtn>
                <ToggleBtn active={hasJob === false} onClick={() => setHasJob(false)}>
                  Not yet
                </ToggleBtn>
              </div>
              {hasJob === true && (
                <>
                  <p className="text-xs text-muted-foreground pt-2">
                    Roughly what's your yearly income? We use this to estimate taxes when you sell.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <ToggleBtn active={bracket === "0_45"} onClick={() => setBracket("0_45")} small>
                      Under $45k
                    </ToggleBtn>
                    <ToggleBtn active={bracket === "45_100"} onClick={() => setBracket("45_100")} small>
                      $45k–$100k
                    </ToggleBtn>
                    <ToggleBtn active={bracket === "100_plus"} onClick={() => setBracket("100_plus")} small>
                      Over $100k
                    </ToggleBtn>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setScreen(5)}
              >
                Skip
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => setScreen(5)}
              >
                Next
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </ScreenShell>
        )}

        {screen === 5 && (
          <ScreenShell key="s5">
            <Eyebrow icon={<BookOpen size={14} />}>One last thing.</Eyebrow>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              The Memory Book is open.
            </h1>
            <p className="text-base text-foreground/80 leading-relaxed">
              Everyone who put money into this fund left notes, photos, and voice memos along the way.
              Some of it was reserved for today. It's all yours to read now.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  completeMutation.mutate(undefined, {
                    onSuccess: () => setLocation("/memory"),
                  });
                }}
                disabled={completeMutation.isPending}
              >
                Open the Memory Book
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? "Saving..." : "Go to your fund"}
              </Button>
            </div>
          </ScreenShell>
        )}
      </main>
    </div>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
      <span className="text-primary">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Continue({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" className="w-full" onClick={onClick}>
      {children}
      <ArrowRight size={14} className="ml-1" />
    </Button>
  );
}

function ChoiceCard({
  title,
  math,
  tone,
}: {
  title: string;
  math: string;
  tone: "grow" | "cash" | "sell";
}) {
  const Icon = tone === "grow" ? TrendingUp : tone === "cash" ? Coins : Receipt;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex gap-3">
      <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Icon size={16} />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-foreground/70 leading-relaxed">{math}</p>
      </div>
    </div>
  );
}

function TaxConcept({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-1.5">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-foreground/70 leading-relaxed">{body}</p>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 transition-colors ${
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border bg-card text-foreground/70 hover:border-foreground/30"
      } ${small ? "py-2 px-2 text-xs" : "py-3 px-4 text-sm"} font-medium`}
    >
      {children}
    </button>
  );
}
