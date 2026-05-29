// Trump Account vs UTMA satellite comparison. Pre-signup SEO destination.
//
// Strategic context: per project_trump_accounts_strategy.md. The federal
// "Trump Accounts" (created by the 2025 One Big Beautiful Bill Act) open for contributions
// July 4, 2026. Parents of 2025–2028 newborns get a $1,000 federal seed and
// are about to Google "Trump Account vs UTMA / what can it invest in / can
// grandparents add money." This page catches that intent with a no-signup,
// honest side-by-side and routes to /get-started.
//
// THE HONESTY RULE (load-bearing): this page does NOT pitch "UTMA makes more
// money." A Trump Account is tax-deferred and seeded with $1,000 — on pure
// accumulation it can come out AHEAD of a taxable UTMA, and under the $5k cap
// it usually does here. We CONCEDE that openly. Kiddo wins on JOB, not
// returns: ownable-at-18 vs locked-to-59½, real companies vs index-only,
// uncapped family gifting vs $5k cap, the Memory Book gift loop vs nothing.
// Faking a dollar-delta would violate feedback_no_greenwashing_losses.
//
// Term-vs-brand discipline (project_trump_accounts_strategy.md): "Trump
// Account" appears in the URL / H1 / FAQ ONLY because it's the literal search
// term. The Kiddo pitch never leans on it politically — product voice says
// "the federal account."
//
// Math: canonical projectFundValue (7% net of the 0.10% AUM fee), so numbers
// match Age18Plan / RobuxVsUtma / the at-18 calculator. The federal column
// starts with the $1,000 seed and caps annual contributions at $5,000.

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Minus, Lock, Sprout, TrendingUp } from "lucide-react";
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

// Same "what this could pay for" anchors as RobuxVsUtma — kept consistent so
// the at-18 framing reads identically across satellite pages.
function whatThisCouldBecome(value: number): string {
  if (value < 5_000) return "a semester of in-state college tuition";
  if (value < 15_000) return "a year of in-state college, or a reliable used car";
  if (value < 35_000) return "two years of community college, or a starter car outright";
  if (value < 75_000) return "half of an in-state bachelor's degree";
  if (value < 150_000) return "a full bachelor's at a state school, or a 20% down payment on a $500k home";
  return "graduate school, or a 20% down payment on a $750k starter home";
}

// Job-based comparison, not return-based. Every row is a verified structural
// fact (project_trump_accounts_strategy.md). The two `winner: "trump"` rows
// are deliberate and stay in — conceding real points is what makes the rest
// credible (feedback_no_greenwashing_losses).
type Side = "trump" | "kiddo";
interface CompareRow {
  dimension: string;
  trump: string;
  kiddo: string;
  winner: Side;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    dimension: "What it can hold",
    trump: "Index funds only (S&P 500–type)",
    kiddo: "Real companies your kid knows: Disney, Roblox, Apple",
    winner: "kiddo",
  },
  {
    dimension: "Annual contribution cap",
    trump: "$5,000/yr (everyone combined)",
    kiddo: "No cap, so the whole family can give",
    winner: "kiddo",
  },
  {
    dimension: "What happens at 18",
    trump: "Becomes a retirement IRA, with a 10% penalty on withdrawals before 59½",
    kiddo: "Fully theirs: liquid, no restrictions",
    winner: "kiddo",
  },
  {
    dimension: "Tax treatment",
    trump: "Tax-deferred; taxed as ordinary income on withdrawal",
    kiddo: "Taxable, but capital-gains rates + kiddie-tax rules",
    winner: "trump",
  },
  {
    dimension: "Federal $1,000 seed",
    trump: "Yes, for kids born 2025–2028",
    kiddo: "No, but no cap to offset it",
    winner: "trump",
  },
  {
    dimension: "Gifts from family",
    trump: "Cash only, shares the $5k cap",
    kiddo: "Voice notes, photos, letters attached to every gift",
    winner: "kiddo",
  },
];

export default function TrumpAccountVsUtma() {
  // Defaults skew young — the $1,000 federal seed cohort is kids born
  // 2025–2028, so a 1–2 year old is the median visitor. $200/mo ($2,400/yr)
  // sits comfortably under the $5k cap, so the default view shows the
  // job/freedom divergence rather than a (dishonest) dollar gap.
  const [annualContribution, setAnnualContribution] = useState<number>(2400);
  const [kidAge, setKidAge] = useState<number>(2);

  const yearsUntil18 = Math.max(0, 18 - kidAge);

  // Federal account: starts with the $1,000 seed, annual contributions capped
  // at $5,000 (everyone combined). Same 7%-net-of-fee math as everywhere else.
  const trumpAnnual = Math.min(annualContribution, 5000);
  const trumpAt18 = useMemo(() => {
    if (yearsUntil18 <= 0) return 1000;
    return projectFundValue({
      startingValue: 1000,
      monthlyContribution: trumpAnnual / 12,
      yearsAhead: yearsUntil18,
      contributionYears: yearsUntil18,
    });
  }, [trumpAnnual, yearsUntil18]);

  // Kiddo UTMA: no seed, NO cap.
  const kiddoAt18 = useMemo(() => {
    if (yearsUntil18 <= 0) return 0;
    return projectFundValue({
      startingValue: 0,
      monthlyContribution: annualContribution / 12,
      yearsAhead: yearsUntil18,
      contributionYears: yearsUntil18,
    });
  }, [annualContribution, yearsUntil18]);

  const overCap = annualContribution > 5000;
  const capDelta = kiddoAt18 - trumpAt18;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-3xl">
          {/* Hero */}
          <div className="text-center">
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="calculator" />
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Trump Account or UTMA for your kid? You can have <GradientText>both</GradientText>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              The new federal accounts are a solid retirement head-start. Take the free $1,000. But they can only hold index funds, they cap what your family can give, and your kid can't touch the money without a penalty until they're nearly 60. Here's what each one is actually for.
            </p>
          </div>

          {/* Calculator */}
          <section className="mx-auto mt-10 max-w-2xl rounded-3xl border-2 border-[hsl(var(--kiddo-evergreen)/0.25)] bg-card p-6 sm:p-8">
            <div className="space-y-6">
              {/* Annual contribution */}
              <div>
                <label
                  htmlFor="annual-contribution"
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <TrendingUp size={16} className="text-muted-foreground" />
                  What your family puts in per year
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">$</span>
                  <input
                    id="annual-contribution"
                    type="range"
                    min={500}
                    max={15000}
                    step={500}
                    value={annualContribution}
                    onChange={(e) => setAnnualContribution(Number(e.target.value))}
                    className="flex-1"
                    data-testid="slider-annual-contribution"
                  />
                  <span className="w-20 text-right font-heading text-xl font-bold tabular-nums text-foreground">
                    {annualContribution.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {overCap
                    ? `Past $5,000/yr, only the UTMA can hold it. The federal account caps everyone's combined gifts at $5,000.`
                    : `A federal account caps everyone's combined gifts at $5,000/yr. A UTMA has no ceiling.`}
                </p>
              </div>

              {/* Kid age */}
              <div>
                <label htmlFor="kid-age" className="text-sm font-semibold text-foreground">
                  Your kid's age today
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="kid-age"
                    type="range"
                    min={0}
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
            {/* Federal account */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock size={14} />
                <p className="text-xs font-semibold uppercase tracking-wide">In a federal account</p>
              </div>
              <p className="mt-3 font-heading text-3xl font-bold leading-none tabular-nums text-foreground">
                {formatMoney(trumpAt18)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Includes the free $1,000 seed, capped at $5,000/yr, index funds only. But at 18 it's locked retirement money, and your kid can't touch it without penalty until 59½.
              </p>
            </div>

            {/* Kiddo UTMA */}
            <div className="rounded-2xl border-2 border-[hsl(var(--kiddo-evergreen)/0.30)] bg-[hsl(var(--kiddo-evergreen)/0.06)] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--kiddo-evergreen))]">
                <Sprout size={14} />
                <p className="text-xs font-semibold uppercase tracking-wide">In a Kiddo UTMA</p>
              </div>
              <p className="mt-3 font-heading text-3xl font-bold leading-none tabular-nums text-foreground">
                {formatMoney(kiddoAt18)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Same dollars, in real companies your kid recognizes. Theirs the day they turn 18, enough for {whatThisCouldBecome(kiddoAt18)}.
              </p>
            </div>
          </section>

          {/* Divergence callout — honest in BOTH directions. Over the cap, the
              UTMA genuinely pulls ahead on dollars. Under the cap, the federal
              seed usually wins on paper and we say so, then pivot to the job. */}
          {yearsUntil18 > 0 && (
            <section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.10)] p-5 text-center">
              <div className="flex items-center justify-center gap-2 text-[hsl(var(--kiddo-gold-ink))]">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold uppercase tracking-widest">The real difference</p>
              </div>
              {overCap && capDelta > 0 ? (
                <>
                  <p className="mt-2 font-heading text-2xl font-bold text-foreground tabular-nums">
                    +{formatMoney(capDelta)}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Past the $5,000 cap, only the UTMA keeps growing with your family's gifts. That's the gap, and it's still theirs at 18, in companies they chose.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  On paper the federal account may even edge ahead here: it starts with a free $1,000. But that money carries an early-withdrawal penalty before 59½ and can only hold index funds. The UTMA's {formatMoney(kiddoAt18)} is <span className="font-semibold text-foreground">liquid at 18</span> and can hold the companies your kid actually loves. Different jobs.
                </p>
              )}
            </section>
          )}

          {/* Comparison table — the centerpiece. Job-based. Neutral check on
              the favorable side per row; no gamified scorecard, no sparkles. */}
          <section className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-3xl border border-border bg-card">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-border bg-[hsl(var(--kiddo-cream))] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="p-4" />
              <div className="p-4 text-center">Federal account</div>
              <div className="flex items-center justify-center gap-1.5 p-4 text-center text-[hsl(var(--kiddo-evergreen))]">
                <Sprout size={13} /> Kiddo UTMA
              </div>
            </div>
            {COMPARE_ROWS.map((row) => (
              <div
                key={row.dimension}
                className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-border last:border-b-0 text-sm"
                data-testid={`compare-row-${row.dimension.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <div className="p-4 font-semibold text-foreground">{row.dimension}</div>
                <div className="flex items-start gap-1.5 p-4 text-muted-foreground">
                  {row.winner === "trump" ? (
                    <Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-gold-ink))]" />
                  ) : (
                    <Minus size={14} className="mt-0.5 shrink-0 text-muted-foreground/40" />
                  )}
                  <span>{row.trump}</span>
                </div>
                <div className="flex items-start gap-1.5 bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4 text-foreground">
                  {row.winner === "kiddo" ? (
                    <Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  ) : (
                    <Minus size={14} className="mt-0.5 shrink-0 text-muted-foreground/40" />
                  )}
                  <span>{row.kiddo}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Honest framing — complement, not compete */}
          <section className="mx-auto mt-10 max-w-2xl space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">This isn't a knock on the federal account.</span> For a tax-deferred retirement floor it's genuinely good, and the free $1,000 is free money. Take it.
            </p>
            <p>
              But it's <span className="text-foreground">retirement plumbing</span>: index-only, capped at $5,000/yr, and penalized if withdrawn before 59½. A Kiddo fund does the other job: the companies your kid actually recognizes, gifts from everyone who loves them with no ceiling, and money that's <span className="font-semibold text-foreground">truly theirs at 18</span>. Most families will want both.
            </p>
            <p>
              <span className="font-semibold text-foreground">A UTMA isn't a gimmick.</span> It's a custodial brokerage account in your kid's name, held by a real broker-dealer partner (Member FINRA/SIPC). At majority age (18 in most states, 21 in a few), the kid gets full ownership.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Projections assume 7% average annual return net of Kiddo's annual fee ($1/yr per $1,000 invested), compounded monthly; the federal column includes the $1,000 seed and the $5,000/yr cap. Federal account rules per the 2025 One Big Beautiful Bill Act, current as of May 2026 and subject to change. Verify before relying. Illustrative, not a guarantee. Markets are unpredictable.
            </p>
          </section>

          {/* CTA */}
          <section className="mx-auto mt-12 max-w-2xl text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Start the fund that's actually theirs at 18.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Free to start. Anyone in your family can send lasting gifts in under a minute. No cap, no card required.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/get-started">
                <Button size="lg" className="h-12 w-full px-8 text-base sm:w-auto" data-testid="button-trump-cta-start">
                  Start your child's fund
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link href="/tools/at-18-calculator">
                <Button variant="outline" size="lg" className="h-12 w-full px-8 text-base sm:w-auto" data-testid="button-trump-cta-other-calc">
                  Try the full at-18 calculator
                </Button>
              </Link>
            </div>
          </section>

          {/* SEO tail. Catches "trump account vs utma", "what can a trump
              account invest in", "can grandparents add to a trump account",
              "trump account for my kid" intent. */}
          <section className="mx-auto mt-14 max-w-2xl space-y-5 text-sm text-muted-foreground">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Common parent questions
            </h3>
            <div>
              <p className="font-semibold text-foreground">Can I have both a Trump Account and a UTMA?</p>
              <p className="mt-1">Yes, and most families should. They do different jobs: the federal account is a tax-deferred retirement head-start your kid can't touch without a penalty until 59½, and a UTMA is money that becomes fully theirs at 18, in companies they recognize. One is a floor; the other is a head start they'll actually feel.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Can grandparents add money to a Trump Account?</p>
              <p className="mt-1">Yes, starting July 4, 2026, but everyone's contributions share one $5,000/yr cap per child, including the parents. A Kiddo UTMA has no cap, so the whole family can give freely, and each gift can carry a photo, voice note, or letter the kid keeps.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Can my kid pick their own stocks in a Trump Account?</p>
              <p className="mt-1">No. Federal accounts can only hold low-cost index funds that track the S&P 500 or a broad US-equity index. If you want your kid to own the company they actually love (Disney, Roblox, Apple), that's a UTMA. Watching a company you recognize grow is most of what makes a kid care about investing at all.</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
