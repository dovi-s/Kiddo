import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Info } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Mascot } from "@/components/ui/mascot";
import { projectFundValue } from "@shared/projection";
import { US_STATES, getMajorityAgeForState, UTMA_DEFAULT_MAJORITY_AGE } from "@shared/utma";
import { useCountUp } from "@/hooks/use-count-up";

// Two-phase compounding projection routed through shared/projection.ts
// (the canonical fund-projection helper). Nets the 0.10% AUM fee out so
// the headline number reflects what the kid keeps. The local wrapper
// keeps this file's call shape unchanged for the rest of the page.
function projectFund(
  startingBalance: number,
  monthlyContribution: number,
  annualReturnRate: number,
  yearsToMajority: number,
): number {
  return projectFundValue({
    startingValue: startingBalance,
    monthlyContribution,
    yearsAhead: yearsToMajority,
    annualReturnRate,
  });
}

// Same money in a high-yield savings account. We use 4% APY as a generous
// stand-in for current US HYSA rates so the comparison doesn't stack the
// deck against the savings option. The point of the comparison isn't "look
// how much better investing is" — it's "here are the two honest paths."
function projectSavings(
  startingBalance: number,
  monthlyContribution: number,
  apy: number,
  years: number,
): number {
  if (years <= 0) return Math.max(0, Math.round(startingBalance));
  const monthlyRate = Math.pow(1 + apy, 1 / 12) - 1;
  const months = Math.round(years * 12);
  const lumpEnd = startingBalance * Math.pow(1 + monthlyRate, months);
  const annuityEnd =
    monthlyContribution > 0 && monthlyRate > 0
      ? monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : monthlyContribution * months;
  return Math.max(0, Math.round(lumpEnd + annuityEnd));
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function FadeIn({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function CalculatorAt18() {
  const [childAge, setChildAge] = useState<number>(2);
  const [monthly, setMonthly] = useState<number>(50);
  const [startingGift, setStartingGift] = useState<number>(0);
  // State-aware majority age. Empty string = federal default (18) which
  // is correct for ~40 states. Picking a state that uses 19/20/21 (CA,
  // MS, etc.) extends the contribution window proportionally — the
  // projection number reflects the actual time-horizon for that
  // family's UTMA, not a federal-default approximation.
  //
  // Pre-2026-05-15 this was hardcoded `useState(18)` with a disclaimer
  // that pointed users to a separate /tools/utma-by-state lookup page.
  // Pulling the picker inline means the headline number is right by
  // default, not just disclosed.
  const [selectedState, setSelectedState] = useState<string>("");
  const majorityAge = selectedState ? getMajorityAgeForState(selectedState) : UTMA_DEFAULT_MAJORITY_AGE;

  const yearsToMajority = Math.max(0, majorityAge - childAge);

  // Three rate scenarios produce a range, not a fake-precise single number.
  // 5% conservative, 7% historical-average, 9% optimistic.
  const projectionLow = useMemo(
    () => projectFund(startingGift, monthly, 0.05, yearsToMajority),
    [startingGift, monthly, yearsToMajority],
  );
  const projectionMid = useMemo(
    () => projectFund(startingGift, monthly, 0.07, yearsToMajority),
    [startingGift, monthly, yearsToMajority],
  );
  const projectionHigh = useMemo(
    () => projectFund(startingGift, monthly, 0.09, yearsToMajority),
    [startingGift, monthly, yearsToMajority],
  );

  const hysa = useMemo(
    () => projectSavings(startingGift, monthly, 0.04, yearsToMajority),
    [startingGift, monthly, yearsToMajority],
  );

  const totalAdded = startingGift + monthly * yearsToMajority * 12;

  // Count-up on the calculator outputs. This is the headline
  // surface — sliders move, number reacts. The count-up smooths
  // every slider change into a settling motion instead of jumpy
  // number swaps. useCountUp re-anchors on each `to` change so a
  // drag from $25 to $50 monthly will animate from the previous
  // projectionMid to the new one (NOT from 0.95×new — useCountUp's
  // `from` only applies on first mount; subsequent changes pick
  // up from valueRef.current automatically per the hook).
  const { value: animatedProjectionMid, isAnimating: projectionMidAnimating } = useCountUp({
    to: projectionMid,
    duration: 600,
    enabled: projectionMid > 0,
  });
  const { value: animatedProjectionLow, isAnimating: projectionLowAnimating } = useCountUp({
    to: projectionLow,
    duration: 600,
    enabled: projectionLow > 0,
  });
  const { value: animatedProjectionHigh, isAnimating: projectionHighAnimating } = useCountUp({
    to: projectionHigh,
    duration: 600,
    enabled: projectionHigh > 0,
  });
  const { value: animatedTotalAdded, isAnimating: totalAddedAnimating } = useCountUp({
    to: totalAdded,
    duration: 600,
    enabled: totalAdded > 0,
  });
  const { value: animatedHysa, isAnimating: hysaAnimating } = useCountUp({
    to: hysa,
    duration: 600,
    enabled: hysa > 0,
  });

  const dynamicHeadline =
    monthly > 0
      ? `What does ${fmtMoney(monthly)} a month become for a kid by ${majorityAge}?`
      : `What does investing for a kid become by ${majorityAge}?`;

  return (
    <div className="kiddo-app-page">
      <Nav />

      <section className="relative pb-12 pt-20 md:pb-16 md:pt-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Mascot size="md" variant="planting" className="mx-auto mb-5 drop-shadow-sm" context="calculator-at-18" />
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">
              UTMA calculator
            </p>
            <h1 className="mb-4 font-heading text-4xl font-bold tracking-normal text-foreground md:text-5xl">
              {dynamicHeadline}
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Honest math for parents, grandparents, and family who want to gift to a child's investment fund. Kiddo's 0.10% annual fee on invested assets is already netted out of the projection.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-12 md:pb-20">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-premium-sm md:p-10">
              <div className="space-y-7">
                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <label className="text-sm font-semibold text-foreground">Child's age now</label>
                    <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
                      {childAge === 0 ? "newborn" : `${childAge} ${childAge === 1 ? "year" : "years"}`}
                    </p>
                  </div>
                  <Slider
                    min={0}
                    max={17}
                    step={1}
                    value={[childAge]}
                    onValueChange={([v]) => setChildAge(v)}
                    className="w-full"
                    data-testid="slider-child-age"
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>Newborn</span>
                    <span>17</span>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <label className="text-sm font-semibold text-foreground">Monthly amount</label>
                    <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
                      {fmtMoney(monthly)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                  </div>
                  <Slider
                    min={0}
                    max={500}
                    step={5}
                    value={[monthly]}
                    onValueChange={([v]) => setMonthly(v)}
                    className="w-full"
                    data-testid="slider-monthly"
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>$0</span>
                    <span>$500/mo</span>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <label className="text-sm font-semibold text-foreground">One-time starting gift (optional)</label>
                    <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
                      {fmtMoney(startingGift)}
                    </p>
                  </div>
                  <Slider
                    min={0}
                    max={5000}
                    step={50}
                    value={[startingGift]}
                    onValueChange={([v]) => setStartingGift(v)}
                    className="w-full"
                    data-testid="slider-starting-gift"
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>$0</span>
                    <span>$5,000</span>
                  </div>
                </div>

                {/* State picker — UTMA majority age is 18 by federal
                    default but varies by state (19/20/21 in several).
                    Pulling this inline means the headline projection
                    number reflects the actual contribution window for
                    THAT family's fund, not a default approximation.
                    Default option "—" keeps the calc at 18 for users
                    who don't know or don't care; picking a state
                    updates the math + the result label. Added
                    2026-05-15 as part of the projection-math audit
                    follow-up. */}
                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <label htmlFor="calc-state-picker" className="text-sm font-semibold text-foreground">
                      State (for UTMA majority age)
                    </label>
                    <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
                      Age {majorityAge}
                    </p>
                  </div>
                  <select
                    id="calc-state-picker"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
                    data-testid="select-state-majority"
                  >
                    <option value="">— Federal default (18) —</option>
                    {US_STATES.map((s) => {
                      const age = getMajorityAgeForState(s.code);
                      return (
                        <option key={s.code} value={s.code}>
                          {s.name}
                          {age !== UTMA_DEFAULT_MAJORITY_AGE ? ` · age ${age}` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {selectedState
                      ? `In ${US_STATES.find((s) => s.code === selectedState)?.name || "this state"}, the UTMA custodian's control transfers at age ${majorityAge}.`
                      : "Most states use 18. A few extend custodianship to 19, 20, or 21 — pick yours for accurate math."}
                  </p>
                </div>
              </div>

              {/* Result — cream-on-evergreen card matches the locked palette
                  and the projection-card pattern from Projection.tsx. */}
              <div className="mt-10 rounded-2xl border-2 border-[hsl(var(--kiddo-evergreen)/0.30)] bg-[hsl(var(--kiddo-cream))] p-6 md:p-8">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">
                  Projected balance at age {majorityAge}
                </p>
                <p
                  className="font-heading text-5xl font-bold tabular-nums text-foreground md:text-6xl"
                  style={{ letterSpacing: "-0.02em" }}
                  data-testid="text-projection-mid"
                  aria-live={projectionMidAnimating ? "off" : "polite"}
                  aria-label={fmtMoney(projectionMid)}
                >
                  {fmtMoney(animatedProjectionMid)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Range: <span
                    className="font-semibold text-foreground tabular-nums"
                    aria-live={projectionLowAnimating ? "off" : "polite"}
                    aria-label={fmtMoney(projectionLow)}
                  >{fmtMoney(animatedProjectionLow)}</span> at 5% to{" "}
                  <span
                    className="font-semibold text-foreground tabular-nums"
                    aria-live={projectionHighAnimating ? "off" : "polite"}
                    aria-label={fmtMoney(projectionHigh)}
                  >{fmtMoney(animatedProjectionHigh)}</span> at 9%, depending on market conditions over the {yearsToMajority}-year horizon.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-card p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total added</p>
                    <p
                      className="mt-1 font-heading text-lg font-bold tabular-nums text-foreground"
                      aria-live={totalAddedAnimating ? "off" : "polite"}
                      aria-label={fmtMoney(totalAdded)}
                    >
                      {fmtMoney(animatedTotalAdded)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Same money at 4% savings APY
                    </p>
                    <p
                      className="mt-1 font-heading text-lg font-bold tabular-nums text-foreground"
                      aria-live={hysaAnimating ? "off" : "polite"}
                      aria-label={fmtMoney(hysa)}
                    >
                      {fmtMoney(animatedHysa)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-muted/30 px-4 py-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <p>
                  Projections assume 5%, 7%, and 9% average annual market returns over the time horizon. Actual returns vary year to year and can be negative in any given year. Kiddo's 0.10% annual fee on invested assets is already netted out. The 4% savings APY is approximate (current US high-yield savings rates as of 2026; subject to change). Past performance does not guarantee future returns. This is illustrative math, not a guarantee. The state picker above sets the UTMA majority age (federal default 18; some states extend to 19, 20, or 21). For the full state-by-state table, see the{" "}
                  <Link href="/tools/utma-by-state" className="text-primary hover:underline">
                    UTMA by state
                  </Link>{" "}
                  lookup. Talk to a tax or financial advisor for case-specific planning.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn>
            <div className="rounded-2xl bg-card p-7 shadow-premium-sm md:p-10">
              <h2 className="mb-4 font-heading text-2xl font-bold text-foreground md:text-3xl">
                Why a UTMA, and why the math works.
              </h2>
              <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>
                  A UTMA fund is a custodial investment account a parent or guardian opens for a child. The child legally owns the assets; the custodian manages them until the kid reaches the age of majority (18 in most states, 21 in some). At that point, control transfers and the kid decides what to do.
                </p>
                <p>
                  The math above shows what consistent investing produces over a long time horizon. The reason early matters more than amount: the same dollar invested for a baby compounds for 18 years; the same dollar invested for a 14-year-old compounds for 4. Time does the heavy lifting, not the dollar amount.
                </p>
                <p>
                  Kiddo's UTMA isn't only for college. It stays flexible at 18: first car, gap year, business, down payment, whatever the kid decides. That flexibility is the whole point. (See our FAQ on UTMA versus 529 for the financial-aid tradeoff.)
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn>
            <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.10)] p-3">
                  <ShieldCheck className="h-6 w-6 text-[hsl(var(--kiddo-evergreen))]" />
                </div>
                <div>
                  <p className="font-heading text-lg font-bold text-foreground">Real brokerage. Real protection.</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Kiddo funds are held at DriveWealth, LLC, a FINRA-registered broker-dealer. Eligible accounts are SIPC-protected up to $500,000. Investments may lose value. Not FDIC insured.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <FadeIn>
            <h2 className="mb-4 font-heading text-3xl font-bold text-foreground md:text-4xl">
              Ready to start a fund?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              Takes 2 minutes. Free to start. Family and friends can begin gifting today.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base" data-testid="button-calc-cta-start">
                  Start a child's fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/gift">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-10 text-base"
                  data-testid="button-calc-cta-gift"
                >
                  Or send a gift to an existing fund
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Questions?{" "}
              <Link href="/faq" className="text-primary hover:underline">
                Read our FAQ
              </Link>
            </p>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
