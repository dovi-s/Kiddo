// Robux vs UTMA satellite calculator. Pre-signup SEO destination.
//
// Strategic context: per project_satellite_apps.md, satellite calculators
// are standalone tools that show up in Google for "is Robux a waste" /
// "how much money do kids spend on Roblox" / "Roblox alternatives for
// parents" queries. They establish Kiddo's voice on the topic without
// requiring the visitor to sign up first. The conversion path is the
// surprise of seeing the math: "Your monthly Robux spend is the same
// dollars that could be a college fund."
//
// Math: real S&P 500 long-term average minus the 0.10% AUM fee = 6.9%
// annualized. Routes through the canonical projectFundValue helper so
// the number matches every other projection surface in the app
// (Age18Plan slider, ActivityDetail micro-projection, Pricing math).
//
// Tone: not preachy. Roblox isn't presented as evil; it's presented as
// a benchmark for what the same money could become if redirected. Parents
// reading this aren't shamed for spending on Robux — they're shown the
// math and invited to redirect SOME of it. The CTA is "start a fund in
// 2 minutes," not "stop spending on Roblox."
//
// Ships Tier-3 deferred satellite-app item, locked 2026-05-23.

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, TrendingUp, Gamepad2, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Mascot } from "@/components/ui/mascot";
import { GradientText } from "@/components/ui/gemini";
import { projectFundValue } from "@shared/projection";

function formatMoney(value: number, opts: { decimals?: number } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(value);
}

// "What this could pay for" anchors — same mechanic as the centerpiece
// slider on Age18Plan, dialed for this surface's at-18 framing.
function whatThisCouldBecome(value: number): string {
  if (value < 5_000) return "a semester of in-state college tuition";
  if (value < 15_000) return "a year of in-state college, or a reliable used car";
  if (value < 35_000) return "two years of community college, or a starter car outright";
  if (value < 75_000) return "half of an in-state bachelor's degree";
  if (value < 150_000) return "a full bachelor's at a state school, or a 20% down payment on a $500k home";
  return "graduate school, or a 20% down payment on a $750k starter home";
}

export default function RobuxVsUtma() {
  // Defaults tuned to typical Roblox household spend: $20/mo is the
  // common cadence; $30/mo for households with two kids; spikes to
  // $50-100/mo around birthdays and event drops. Kid age 8 is the
  // median Roblox player age; 10 years to 18 is a meaningful window.
  const [monthlyRobux, setMonthlyRobux] = useState<number>(20);
  const [kidAge, setKidAge] = useState<number>(8);

  const yearsUntil18 = Math.max(0, 18 - kidAge);

  const totalRobuxOverYears = useMemo(() => {
    return monthlyRobux * 12 * yearsUntil18;
  }, [monthlyRobux, yearsUntil18]);

  // UTMA equivalent: same $X/mo contribution, compounded at the locked
  // 7% annual rate minus the 0.10% AUM fee, until kid hits 18. Uses
  // the canonical projectFundValue so the number matches the rest of
  // the app's projection surfaces.
  const utmaAt18 = useMemo(() => {
    if (yearsUntil18 <= 0) return 0;
    return projectFundValue({
      startingValue: 0,
      monthlyContribution: monthlyRobux,
      yearsAhead: yearsUntil18,
      contributionYears: yearsUntil18,
    });
  }, [monthlyRobux, yearsUntil18]);

  const growthDelta = utmaAt18 - totalRobuxOverYears;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-3xl">
          {/* Hero */}
          <div className="text-center">
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="calculator" />
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              How much could your kid's Robux spend become at <GradientText>18</GradientText>?
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Roblox isn't going anywhere and that's fine. But the same dollars, on the same cadence, in a custodial investment account, become something else by the time your kid turns 18. Here's the math.
            </p>
          </div>

          {/* Calculator */}
          <section className="mx-auto mt-10 max-w-2xl rounded-3xl border-2 border-[hsl(var(--kiddo-evergreen)/0.25)] bg-card p-6 sm:p-8">
            <div className="space-y-6">
              {/* Robux monthly input */}
              <div>
                <label
                  htmlFor="robux-monthly"
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <Gamepad2 size={16} className="text-muted-foreground" />
                  Monthly Robux spend
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">$</span>
                  <input
                    id="robux-monthly"
                    type="range"
                    min={5}
                    max={150}
                    step={5}
                    value={monthlyRobux}
                    onChange={(e) => setMonthlyRobux(Number(e.target.value))}
                    className="flex-1"
                    data-testid="slider-robux-monthly"
                  />
                  <span className="w-16 text-right font-heading text-xl font-bold tabular-nums text-foreground">
                    {monthlyRobux}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Average Roblox household: $20–30/month. Heavy spend: $50–100/month around event drops and birthdays.
                </p>
              </div>

              {/* Kid age input */}
              <div>
                <label
                  htmlFor="kid-age"
                  className="text-sm font-semibold text-foreground"
                >
                  Your kid's age today
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="kid-age"
                    type="range"
                    min={4}
                    max={17}
                    step={1}
                    value={kidAge}
                    onChange={(e) => setKidAge(Number(e.target.value))}
                    className="flex-1"
                    data-testid="slider-kid-age"
                  />
                  <span className="w-16 text-right font-heading text-xl font-bold tabular-nums text-foreground">
                    {kidAge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {yearsUntil18} {yearsUntil18 === 1 ? "year" : "years"} of compounding runway until 18.
                </p>
              </div>
            </div>
          </section>

          {/* Two side-by-side outcomes */}
          <section className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
            {/* Robux total */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gamepad2 size={14} />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  In Robux
                </p>
              </div>
              <p className="mt-3 font-heading text-3xl font-bold leading-none tabular-nums text-foreground">
                {formatMoney(totalRobuxOverYears)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Total ${monthlyRobux} × 12 × {yearsUntil18} years of Robux spend. Gone the moment it's spent. Real fun while it lasts; zero left at 18.
              </p>
            </div>

            {/* UTMA equivalent */}
            <div className="rounded-2xl border-2 border-[hsl(var(--kiddo-evergreen)/0.30)] bg-[hsl(var(--kiddo-evergreen)/0.06)] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--kiddo-evergreen))]">
                <Sprout size={14} />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  In a UTMA at 7%
                </p>
              </div>
              <p className="mt-3 font-heading text-3xl font-bold leading-none tabular-nums text-foreground">
                {formatMoney(utmaAt18)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Same ${monthlyRobux}/month, invested in a custodial brokerage account. Yours to give them at 18. Enough for {whatThisCouldBecome(utmaAt18)}.
              </p>
            </div>
          </section>

          {/* The delta */}
          {growthDelta > 0 && yearsUntil18 > 0 && (
            <section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.10)] p-5 text-center">
              <div className="flex items-center justify-center gap-2 text-[hsl(var(--kiddo-gold-ink))]">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold uppercase tracking-widest">
                  The difference
                </p>
              </div>
              <p className="mt-2 font-heading text-2xl font-bold text-foreground tabular-nums">
                +{formatMoney(growthDelta)}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                That's compounding. The same dollar in a UTMA grows; the same dollar in Robux disappears.
              </p>
            </section>
          )}

          {/* Honest framing — not preachy */}
          <section className="mx-auto mt-10 max-w-2xl space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">This isn't an argument against Roblox.</span> Roblox is real fun and real social. The point isn't to stop; the point is that <span className="text-foreground">a fraction of the same dollars, on the same cadence, in a real investment account</span>, becomes something your kid can actually hold at 18.
            </p>
            <p>
              You don't have to redirect all of it. Even half of your monthly Robux spend in a UTMA still becomes meaningful by 18. The compound math doesn't care about the amount; it cares that the dollars keep coming.
            </p>
            <p>
              <span className="font-semibold text-foreground">A UTMA isn't a gimmick.</span> It's a custodial brokerage account in your kid's name, held by a real broker-dealer (DriveWealth, FINRA/SIPC). At majority age (18 in most states, 21 in CA), the kid gets full ownership.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Math assumes 7% average annual return net of Kiddo's annual fee ($1/yr per $1,000 invested), compounded monthly. Real returns vary; markets are unpredictable. This is illustrative, not a guarantee.
            </p>
          </section>

          {/* CTA */}
          <section className="mx-auto mt-12 max-w-2xl text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Start a real fund in 2 minutes.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Free to start. Anyone in your family can send lasting gifts in under a minute. No card required.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/get-started">
                <Button size="lg" className="h-12 w-full px-8 text-base sm:w-auto" data-testid="button-robux-cta-start">
                  Start your child's fund
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link href="/tools/at-18-calculator">
                <Button variant="outline" size="lg" className="h-12 w-full px-8 text-base sm:w-auto" data-testid="button-robux-cta-other-calc">
                  Try the full at-18 calculator
                </Button>
              </Link>
            </div>
          </section>

          {/* SEO-friendly tail content. Catches "is roblox a waste of
              money for kids", "kid spends too much on robux",
              "alternatives to robux", "roblox parent budget" intent. */}
          <section className="mx-auto mt-14 max-w-2xl space-y-5 text-sm text-muted-foreground">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Common parent questions
            </h3>
            <div>
              <p className="font-semibold text-foreground">Is Robux a waste of money?</p>
              <p className="mt-1">No, but it isn't an investment. A $25 Robux purchase is a $25 entertainment buy. The same $25 in a UTMA gets ~$72 by the time the kid takes ownership at majority (18 in most states, 19 to 21 in a few; about 10 years at 7%). That's not Roblox's fault; it's the difference between consumption and compounding.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Can I do both?</p>
              <p className="mt-1">Most families do. Set a Robux budget you're comfortable with; redirect what you would have over-spent into a fund. Even a $10/month UTMA contribution from age 8 onward becomes meaningful by the time the kid takes ownership at majority.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Why a UTMA and not a 529?</p>
              <p className="mt-1">A 529 is great for education-only use. A UTMA gives the kid the money at majority age with no spending restriction. If you want flexibility (car, first apartment, business start), UTMA. If you want education tax advantages and don't mind the restriction, 529. Many families have both.</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
