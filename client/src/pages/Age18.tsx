import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, CalendarClock, Gift, GraduationCap, TrendingUp } from "lucide-react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { usePageSeo } from "@/lib/seo";
import { formatCurrencyWhole, projectContributionSeries } from "@kora/utils";

const horizonOptions = [18, 30, 40, 65] as const;
const giftOptions = [250, 500, 1000, 2000] as const;
const rateOptions = [
  { label: "Conservative 5%", value: 0.05 },
  { label: "Base 7%", value: 0.07 },
  { label: "Higher 9%", value: 0.09 },
] as const;

const projectionPulse = {
  initial: { opacity: 0.72, y: 10, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: "easeOut" },
  },
} as const;

function AnimatedCurrencyValue({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      previousValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    const controls = animate(previousValueRef.current, value, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue(latest);
      },
    });

    previousValueRef.current = value;
    return () => controls.stop();
  }, [reduceMotion, value]);

  return <>{formatCurrencyWhole(Math.round(displayValue))}</>;
}

export default function Age18() {
  const [annualGift, setAnnualGift] = useState<(typeof giftOptions)[number]>(500);
  const [selectedRate, setSelectedRate] = useState<(typeof rateOptions)[number]>(rateOptions[1]);
  const [selectedHorizon, setSelectedHorizon] = useState<(typeof horizonOptions)[number]>(40);
  const [isCompactChart, setIsCompactChart] = useState(false);

  useEffect(() => {
    const updateCompactChart = () => {
      setIsCompactChart(window.innerWidth < 430);
    };

    updateCompactChart();
    window.addEventListener("resize", updateCompactChart);
    return () => window.removeEventListener("resize", updateCompactChart);
  }, []);

  usePageSeo({
    title: "What happens when your child turns 18 | Kiddo",
    description:
      "At 18, the fund becomes theirs. Exactly what happens legally, what your child receives, and how Kiddo makes the handoff matter.",
    ogType: "article",
  });

  const series = useMemo(
    // 0.001 = Kiddo's 0.10% AUM annual fee, netted out of the assumed
    // return so the chart matches what the parent actually keeps.
    // Added 2026-05-15 as part of the projection-math audit; before
    // this, the chart over-stated the projection by 0.10% per year
    // (compounded) compared to Projection.tsx / KidView / CalculatorAt18
    // which all correctly netted the fee.
    () => projectContributionSeries(annualGift, selectedHorizon, selectedRate.value, 18, 0.001),
    [annualGift, selectedHorizon, selectedRate],
  );
  const finalPoint = series[series.length - 1] ?? { totalGifted: 0, projectedValue: 0 };
  const milestoneAges = horizonOptions.filter((age) => age <= selectedHorizon);
  const milestoneValues = milestoneAges.map((age) => {
    const point = series.find((entry) => entry.age === age) ?? series[series.length - 1];
    return {
      age,
      totalGifted: point?.totalGifted ?? 0,
      projectedValue: point?.projectedValue ?? 0,
    };
  });
  const compactXAxisAges = new Set([1, 18, 30, 40, selectedHorizon]);
  const yAxisTicks = isCompactChart
    ? [0, Math.round(finalPoint.projectedValue / 2), finalPoint.projectedValue]
    : undefined;
  const projectionMotionKey = `${annualGift}-${selectedRate.value}-${selectedHorizon}`;

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-14 md:pt-32 md:pb-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Age-18 transition</p>
          {/* "theirs", not "hers" (2026-06-04): the hero + meta are the
              impression-setters on a public page about EVERY family's kid;
              a generic-she H1 reads as not-for-you to half the audience.
              Named-example sections below keep their pronouns. The early
              "(some states say 19 or 21)" hedge keeps the 18 shorthand
              honest before nine more instances of it land; the full state
              note stays at the bottom. */}
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            At 18, the fund becomes theirs.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Everything their family built (every gift, every note, every investment) becomes theirs. Exactly what happens, and how Kiddo makes it matter. (The exact age is 18 to 21 depending on your state; the handoff works the same way.)
          </p>
          <div className="mx-auto mt-8 max-w-3xl rounded-[28px] border border-border bg-card px-6 py-6 text-left shadow-premium-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Most platforms do nothing at 18</p>
            <h2 className="mt-3 font-heading text-2xl font-semibold text-foreground">
              The account transfers. The child gets a letter from a brokerage. They have no idea what it is.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
              They transfer everything to Robinhood because that is what their friends use.
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
              18 years of gifts. Gone in 48 hours.
            </p>
            <p className="mt-4 text-sm font-medium leading-7 text-foreground md:text-base md:leading-8">
              Kiddo does something different.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-14 md:pb-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-[32px] border border-border bg-card p-8 shadow-premium-sm md:p-12">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              How it actually works.
            </h2>
            <div className="mt-8 space-y-8">
              <div>
                <div className="flex items-center gap-3 text-primary">
                  <CalendarClock className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">Two years before</p>
                </div>
                <p className="mt-3 text-base font-medium leading-8 text-foreground">Emma is 16. You get a notification.</p>
                <div className="mt-4 rounded-3xl border border-border bg-primary/5 px-5 py-4">
                  <p className="text-base leading-8 text-foreground">
                    Emma turns 18 in 2 years. Now is a good time to start talking to her about what is in her fund and what it means.
                  </p>
                </div>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  A conversation guide arrives. Real things to say. Not a financial lecture. A parent-to-child conversation about what has been built and why.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-3 text-primary">
                  <Gift className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">One year before</p>
                </div>
                <p className="mt-3 text-base font-medium leading-8 text-foreground">Emma is 17. She gets her first look.</p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  If you choose to share it, Emma receives a preview of her Memory Book. Every gift. Every note. Every occasion. From birth to now.
                </p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  She sees what her family built for her before she owns it.
                </p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  You get a prompt to write her a final message. Something she will see the moment the fund becomes hers.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-3 text-primary">
                  <GraduationCap className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">The day</p>
                </div>
                <p className="mt-3 text-base font-medium leading-8 text-foreground">Emma turns 18.</p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  She receives a personal invitation to create her own Kiddo account. She logs in. The first thing she sees is not a brokerage dashboard.
                </p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  It is her Memory Book.
                </p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  Every gift. Every note from every person who loved her. Your final message. 18 years of love expressed as investment.
                </p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  Then she sees what it is worth.
                </p>
              </div>
            </div>

            <ProductFrame
              src="/product/age18.webp"
              alt="The age-of-majority handoff page: the time remaining, the projected value, what transfers to them, and the family record of who showed up."
              caption="The handoff page itself."
              href="/demo"
              liveLabel="See it live"
              className="mt-12"
            />

            <div className="mt-10 overflow-hidden rounded-3xl bg-primary/5 p-4 sm:p-5 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <h3 className="font-heading text-2xl font-semibold leading-tight text-foreground md:text-3xl">
                    Start building today.
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                    The earlier you start, the more time every gift has to grow. And the more pages the Memory Book has when Emma opens it at 18.
                  </p>
                </div>
                <motion.div
                  key={`summary-${projectionMotionKey}`}
                  variants={projectionPulse}
                  initial="initial"
                  animate="animate"
                  className="w-full rounded-2xl bg-card px-4 py-4 shadow-premium-sm md:w-auto md:min-w-[240px]"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Projected by age {selectedHorizon}</p>
                  <p className="mt-2 font-heading text-3xl font-bold leading-none text-foreground md:text-4xl">
                    <AnimatedCurrencyValue value={finalPoint.projectedValue} />
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">from {formatCurrencyWhole(finalPoint.totalGifted)} in gifts</p>
                </motion.div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:gap-6">
                <div className="rounded-3xl border border-border/60 bg-background/90 p-4 md:p-5">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Annual gifts</p>
                    <div className="grid grid-cols-1 gap-1 rounded-[20px] bg-card/80 p-1 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-1.5">
                    {giftOptions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setAnnualGift(amount)}
                        className={
                          annualGift === amount
                            ? "w-full rounded-[16px] bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm"
                            : "w-full rounded-[16px] bg-transparent px-3 py-2.5 text-sm font-medium text-foreground"
                        }
                      >
                        {formatCurrencyWhole(amount)}/yr
                      </button>
                    ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Growth rate</p>
                    <div className="grid grid-cols-1 gap-1 rounded-[20px] bg-card/80 p-1 sm:flex sm:flex-wrap sm:gap-1.5">
                    {rateOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedRate(option)}
                        className={
                          selectedRate.value === option.value
                            ? "w-full rounded-[16px] bg-emerald-700 px-3 py-2.5 text-sm font-medium text-white shadow-sm"
                            : "w-full rounded-[16px] bg-transparent px-3 py-2.5 text-sm font-medium text-foreground"
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Show value by age</p>
                    <div className="grid grid-cols-1 gap-1 rounded-[20px] bg-card/80 p-1 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-1.5">
                    {horizonOptions.map((age) => (
                      <button
                        key={age}
                        type="button"
                        onClick={() => setSelectedHorizon(age)}
                        className={
                          selectedHorizon === age
                            ? "w-full rounded-[16px] bg-amber-500 px-3 py-2.5 text-sm font-medium text-amber-950 shadow-sm"
                            : "w-full rounded-[16px] bg-transparent px-3 py-2.5 text-sm font-medium text-foreground"
                        }
                      >
                        Show to {age}
                      </button>
                    ))}
                    </div>
                  </div>

                  <motion.div
                    key={`chart-${projectionMotionKey}`}
                    variants={projectionPulse}
                    initial="initial"
                    animate="animate"
                    className="mt-5 h-[170px] w-full min-[420px]:h-[190px] md:h-[280px]"
                  >
                    <ChartContainer
                      className="h-full w-full"
                      config={{
                        totalGifted: { label: "Total gifted", color: "hsl(var(--chart-3))" },
                        projectedValue: { label: "Projected value", color: "hsl(var(--chart-1))" },
                      }}
                    >
                      <LineChart data={series} margin={{ top: 8, right: 4, left: isCompactChart ? -24 : -12, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.45)" />
                        <XAxis
                          dataKey="age"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={isCompactChart ? 28 : 18}
                          tick={{ fontSize: isCompactChart ? 10 : 11 }}
                          tickFormatter={(value) => {
                            const age = Number(value);
                            if (!isCompactChart) return String(age);
                            return compactXAxisAges.has(age) ? String(age) : "";
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => {
                            const amount = Number(value);
                            if (amount <= 0) return "$0";
                            return `$${Math.round(amount / 1000)}k`;
                          }}
                          width={isCompactChart ? 24 : 38}
                          tick={{ fontSize: isCompactChart ? 10 : 11 }}
                          ticks={yAxisTicks}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name) => (
                                <div className="flex w-full items-center justify-between gap-4">
                                  <span className="text-muted-foreground">{name === "projectedValue" ? "Projected value" : "Total gifted"}</span>
                                  <span className="font-mono font-medium text-foreground">{formatCurrencyWhole(Number(value || 0))}</span>
                                </div>
                              )}
                              labelFormatter={(label) => `Age ${label}`}
                            />
                          }
                        />
                        <Line type="monotone" dataKey="totalGifted" stroke="var(--color-totalGifted)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="projectedValue" stroke="var(--color-projectedValue)" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ChartContainer>
                  </motion.div>
                </div>

                <div className="space-y-3 lg:space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:hidden">Milestones</p>
                  <div className="grid gap-3 lg:block lg:overflow-visible lg:pb-0">
                  {milestoneValues.map((milestone, index) => (
                    <motion.div
                      key={`${projectionMotionKey}-${milestone.age}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: { delay: index * 0.04, duration: 0.28, ease: "easeOut" },
                      }}
                      className="rounded-3xl border border-border/60 bg-background/90 p-4 lg:mb-3"
                    >
                      <div className="flex items-center gap-2 text-primary">
                        <TrendingUp className="h-4 w-4" />
                        <p className="text-sm font-semibold uppercase tracking-[0.18em]">At age {milestone.age}</p>
                      </div>
                      <p className="mt-3 text-2xl font-heading font-bold text-foreground">{formatCurrencyWhole(milestone.projectedValue)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">from {formatCurrencyWhole(milestone.totalGifted)} in gifts</p>
                    </motion.div>
                  ))}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs leading-6 text-muted-foreground md:text-sm md:leading-7">
                Illustrative only. Based on {formatCurrencyWhole(annualGift)} per year in gifts from birth through age 18 and a hypothetical {Math.round(selectedRate.value * 100)}% annual growth rate. Investing involves risk. Past performance does not guarantee future results. Kiddo does not provide investment advice.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-premium-sm">
                <h3 className="font-heading text-2xl font-semibold text-foreground">What happens legally. Plain language.</h3>
                <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                  <p>
                    When Emma reaches the age of majority, her UTMA account legally and automatically becomes hers.
                  </p>
                  <p className="font-medium text-foreground">Not yours. Hers.</p>
                  <p>
                    The custodianship ends. Emma gains full, legal, unrestricted control.
                  </p>
                  <p>
                    This is not a Kiddo policy. It is federal and state law. It cannot be changed or delayed.
                  </p>
                  <div className="rounded-2xl bg-muted/30 p-4">
                    <p className="font-medium text-foreground">What Emma can do:</p>
                    <p className="mt-2">Keep investing. Add to it. Change it. Manage it herself.</p>
                    <p className="mt-2">Withdraw some or all. For college. A business. A house. Anything. No restrictions. No penalties.</p>
                    <p className="mt-2">Transfer to another brokerage. She can. We hope she stays.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-6 shadow-premium-sm">
                <h3 className="font-heading text-2xl font-semibold text-foreground">Something most people do not know.</h3>
                <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                  <p>
                    Over time, the account becomes more tax-efficient, not less.
                  </p>
                  <p>
                    When Emma takes ownership, future gains are taxed to her, not you. The kiddie tax can still apply while she's under 19 (or a full-time student under 24), taxing larger gains at your rate; once it no longer does, a low-income young adult's long-term capital gains can be taxed as low as 0%.
                  </p>
                  <p className="font-medium text-foreground">
                    From $9,000 in gifts to potentially $424,891 by retirement — and if her income stays modest, much of that gain can be taxed at 0%.
                  </p>
                  <p className="text-sm">
                    Consult a tax professional about your specific situation. Kiddo does not provide tax advice.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-premium-sm">
              <h3 className="font-heading text-2xl font-semibold text-foreground">"What if she just spends it all?"</h3>
              <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                <p>
                  It is the fear every parent has, and we will not pretend it away. By law, the account is hers, and she can do anything with it.
                </p>
                <p>
                  What we can do is the years before it. Emma watches the fund grow, sees who showed up for her, learns how investing works from her own money, and reads the notes the people who love her left along the way.
                </p>
                <p className="font-medium text-foreground">
                  So when it becomes hers, it's something she has understood, and felt loved through, for as long as she can remember.
                </p>
                <p>
                  We cannot promise what she will do. We can promise we spent those years preparing her to do it well. That is the whole reason Kiddo exists.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-premium-sm">
              <h3 className="font-heading text-2xl font-semibold text-foreground">Age of majority varies by state.</h3>
              <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                <p>Most states: 18.</p>
                <p>Some states: 21.</p>
                <p>A few: 25 in specific circumstances.</p>
                <p>Kiddo tracks your state and applies the correct age of majority automatically. You will always know exactly when the transfer happens.</p>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/get-started">
                <Button data-testid="button-age18-primary">
                  Start Emma&apos;s fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/faq">
                <Button variant="outline" data-testid="button-age18-secondary">Read our FAQ</Button>
              </Link>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Questions about the age-18 transition? Email{" "}
              <a href="mailto:support@kiddofund.com" className="font-medium text-foreground underline underline-offset-4">
                support@kiddofund.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
