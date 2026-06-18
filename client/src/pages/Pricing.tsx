import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { LockedRefusalsPanel } from "@/components/LockedRefusalsPanel";
import { GeminiHeroGradient } from "@/components/ui/gemini";
import { PersonalFundWaitlistModal } from "@/components/PersonalFundWaitlistModal";

function FadeIn({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type PlanPrice =
  | { kind: "flat"; price: string; period: string }
  | {
      kind: "billed";
      yearly: { price: string; period: string; equivalent: string; dailyFraming?: string };
      monthly: { price: string; period: string; equivalent: string; dailyFraming?: string };
    };

type Plan = {
  id: string;
  name: string;
  eyebrow: string;
  cta: string;
  featured: boolean;
  pricing: PlanPrice;
  body: readonly string[];
  note?: string;
};

const plans: readonly Plan[] = [
  {
    id: "free",
    name: "FREE",
    eyebrow: "For parents just getting started.",
    pricing: { kind: "flat", price: "$0", period: "/month" },
    cta: "Start for free",
    featured: false,
    body: [
      "1 child fund",
      "1 active occasion at a time",
      "Shareable gift link, QR code, and gift code",
      "Gifter reminder system",
      "Memory Book viewing for every gift, note, photo, video, and voice memo from gifters",
      "Kid View included",
      "Annual contribution summary for tax records",
      "SIPC protection via our broker-dealer partner when investing is live",
    ],
    note: "No credit card. No commitment.",
  },
  {
    id: "kiddo-plus",
    name: "KIDDO+",
    eyebrow: "For the parent who shows up every month.",
    pricing: {
      kind: "billed",
      yearly: { price: "$29", period: "/year", equivalent: "or $3.99/month", dailyFraming: "About 8¢ a day" },
      monthly: { price: "$3.99", period: "/month", equivalent: "or $29/year", dailyFraming: "About 13¢ a day" },
    },
    cta: "Start with Kiddo+",
    featured: true,
    note: "Plus is for one child. Move to Family when you add a second.",
    body: [
      "One child fund",
      "Everything in Free",
      "Recurring contributions for you and any gifter to the fund",
      "Custom fund mix",
      "Strategy switching with rebalancing",
      "Add your own photos, videos, and voice memos to Memory Book entries",
      "Co-parent access",
      "Unlimited occasions",
      "Priority support",
    ],
  },
  {
    id: "kiddo-family",
    name: "KIDDO FAMILY",
    eyebrow: "For families with two or more children.",
    pricing: {
      kind: "billed",
      yearly: { price: "$59", period: "/year", equivalent: "or $6.99/month", dailyFraming: "About 16¢ a day" },
      monthly: { price: "$6.99", period: "/month", equivalent: "or $59/year", dailyFraming: "About 23¢ a day" },
    },
    cta: "Cover all your children",
    featured: false,
    note: "Family covers two or more children, no per-kid charge.",
    body: [
      "Everything in Kiddo+",
      "Unlimited children",
      "Memory Book for every child",
      "Kid View for every child",
      "One view for every fund in your household",
      "Unlimited occasions",
    ],
  },
];

const fitRows = [
  { situation: "One child, just getting started", bestPlan: "Free" },
  { situation: "One child, want the full experience", bestPlan: "Kiddo+" },
  { situation: "Two or more children", bestPlan: "Kiddo Family" },
  { situation: "Not sure yet", bestPlan: "Start free. Upgrade any time." },
] as const;

const aumExamples = [
  { invested: "$1,000 invested", annualFee: "$1.00 / year" },
  { invested: "$10,000 invested", annualFee: "$10.00 / year" },
  { invested: "$50,000 invested", annualFee: "$50.00 / year" },
] as const;

const pricingFaqs = [
  {
    question: "Can I cancel any time?",
    answer: "Yes. No contracts. No cancellation fees. If you cancel, your plan downgrades at the end of your billing period. Your fund and investments are not affected.",
  },
  {
    question: "What happens to my fund if I downgrade?",
    answer: "Your fund stays active and your investments stay invested. Paid features pause, but the fund and everything already in it remain intact.",
  },
  {
    question: "Is there a platform fee on gifts?",
    answer: "No. The gift amount stays whole. The gifter only pays standard payment processing shown before checkout.",
  },
  {
    question: "What's the annual fee on invested assets?",
    answer: "$1 per year for every $1,000 invested. It applies only to invested assets once investing is live, not cash or pending gifts.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes. New accounts get 14 days of Plus automatically, with no credit card required.",
  },
  {
    question: "Why pay anything when a plain custodial account can be free?",
    answer: "Kiddo adds the shared gift link, Memory Book, family gifting flows, Kid View, and a more intentional age-18 handoff. If you only want a bare brokerage account, a plain custodial account may be enough.",
  },
] as const;

export default function Pricing() {
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"yearly" | "monthly">("yearly");

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="overflow-x-hidden">
        <section className="relative overflow-hidden pb-16 pt-20 md:pb-24 md:pt-32 gemini-warm-section">
          <GeminiHeroGradient />
          <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Pricing</p>
              <h1 className="mb-4 font-heading text-4xl font-bold tracking-[-0.03em] text-foreground md:text-6xl" data-testid="text-pricing-headline">
Pricing you can see clearly.
              </h1>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Gifts stay whole. The only fee is $1 a year per $1,000 invested, once investing is live.
              </p>
              <div className="mx-auto mt-6 max-w-3xl rounded-[1.5rem] border border-border bg-card/80 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">No platform fee on gifts.</span> Kiddo earns from optional subscriptions and an annual fee of
                {" "} $1 per $1,000 invested, charged only on invested assets once investing is live.
              </div>
              <div className="mx-auto mt-4 max-w-3xl rounded-[1.5rem] border border-border bg-card px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Every new account gets 14 days of Plus, free.</span> Try the premium features before deciding. No
                credit card required.
              </div>
              <div className="mx-auto mt-4 max-w-4xl rounded-[1.5rem] border border-primary/30 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-foreground">
                <span className="font-semibold">Pre-launch: Founding Members get $19/year Plus, locked in for life.</span> First 1,000 families.{" "}
                <Link href="/founding-members" className="font-medium text-primary underline underline-offset-2">
                  Reserve your spot
                </Link>
                .
              </div>
            </motion.div>
          </div>
        </section>

        <section className="pb-8">
          <div className="mx-auto max-w-6xl px-4">
            <TrustMicroStrip />
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <FadeIn className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Choose a plan</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                Start free. Pay only when you want more.
              </h2>
            </FadeIn>

            <div className="mt-10 flex justify-center">
              <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-premium-sm" role="radiogroup" aria-label="Billing period" data-testid="pricing-billing-toggle">
                <button
                  type="button"
                  role="radio"
                  aria-checked={billingPeriod === "yearly"}
                  onClick={() => setBillingPeriod("yearly")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    billingPeriod === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="pricing-toggle-yearly"
                >
                  Annual
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={billingPeriod === "monthly"}
                  onClick={() => setBillingPeriod("monthly")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    billingPeriod === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="pricing-toggle-monthly"
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {plans.map((plan, index) => {
                const priceDisplay =
                  plan.pricing.kind === "flat"
                    ? { price: plan.pricing.price, period: plan.pricing.period, equivalent: null as string | null, dailyFraming: null as string | null }
                    : billingPeriod === "yearly"
                      ? { ...plan.pricing.yearly, equivalent: plan.pricing.yearly.equivalent, dailyFraming: plan.pricing.yearly.dailyFraming ?? null }
                      : { ...plan.pricing.monthly, equivalent: plan.pricing.monthly.equivalent, dailyFraming: plan.pricing.monthly.dailyFraming ?? null };

                return (
                  <FadeIn key={plan.id} delay={index * 0.08}>
                    <div className={`relative flex h-full flex-col rounded-[1.75rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm ${plan.featured ? "ring-2 ring-primary" : ""}`}>
                      <div className="mb-6 text-center">
                        <h3 className="mb-2 font-heading text-xl font-semibold text-foreground">{plan.name}</h3>
                        <p className="text-sm font-medium text-foreground">{plan.eyebrow}</p>
                        <div className="mt-5 flex items-baseline justify-center gap-1">
                          <span className="font-heading text-4xl font-bold text-foreground">{priceDisplay.price}</span>
                          <span className="text-sm font-medium text-muted-foreground">{priceDisplay.period}</span>
                        </div>
                        {priceDisplay.equivalent ? <p className="mt-2 text-sm text-muted-foreground">{priceDisplay.equivalent}</p> : null}
                        {priceDisplay.dailyFraming ? <p className="mt-1 text-xs text-muted-foreground/75">{priceDisplay.dailyFraming}</p> : null}
                      </div>

                      <ul className="mb-8 flex-1 space-y-3">
                        {plan.body.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <p className="-mt-4 mb-8 text-xs leading-relaxed text-muted-foreground/70">
                        Annual fee: $1/year per $1,000 invested, charged only on invested assets.
                      </p>

                      <Link href="/get-started">
                        <Button variant={plan.featured ? "default" : "outline"} className="w-full" data-testid={`button-pricing-${plan.id}`}>
                          {plan.cta}
                        </Button>
                      </Link>

                      {plan.note ? <p className="mt-4 text-center text-sm italic text-muted-foreground">{plan.note}</p> : null}
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 lg:grid-cols-[0.94fr_1.06fr]">
              <FadeIn>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">How the investment fee works</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    Small, transparent, and the same on every plan.
                  </h2>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    The annual fee is $1 per $1,000 invested, charged only on invested assets once investing is live. Cash and pending gifts are not charged.
                  </p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    It applies on every plan because it is the fee on the investment itself. A subscription, if you choose one, is separate and pays for product features.
                  </p>
                  <p className="mt-4 font-medium leading-relaxed text-foreground">
                    When your child's fund grows, we earn a little more. We are on the same side of the table.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={0.08}>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/40 text-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Invested balance</th>
                          <th className="px-4 py-3 font-medium">Annual fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aumExamples.map((row) => (
                          <tr key={row.invested} className="border-t border-border">
                            <td className="px-4 py-3 font-medium text-foreground">{row.invested}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.annualFee}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    For context, that is less than a dollar a month per $10,000 invested.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Kiddo earns from Plus and Family subscriptions and the annual investment fee. We do not take a cut of gifts. We do not sell your data.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
              <FadeIn>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Which plan fits</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    Most families know which plan fits at a glance.
                  </h2>
                  <div className="mt-8 overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/40 text-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Your situation</th>
                          <th className="px-4 py-3 font-medium">Best plan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fitRows.map((row) => (
                          <tr key={row.situation} className="border-t border-border">
                            <td className="px-4 py-3 text-muted-foreground">{row.situation}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{row.bestPlan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.08}>
                <LockedRefusalsPanel variant="marketing" />
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <FadeIn className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Fee transparency</p>
                  <h2 className="mt-2 font-heading text-2xl font-bold text-foreground md:text-3xl">
                    Standard payment processing, shown before checkout.
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Kiddo does not mark up payment processing. The gifter sees the fee clearly before paying.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                  onClick={() => setShowFeeDetails((value) => !value)}
                  data-testid="button-toggle-pricing-fees"
                  aria-expanded={showFeeDetails}
                  aria-controls="pricing-fee-details"
                >
                  How do fees work?
                  <motion.div animate={{ rotate: showFeeDetails ? 180 : 0 }} aria-hidden="true">
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showFeeDetails ? (
                  <motion.div
                    id="pricing-fee-details"
                    role="region"
                    aria-label="How fees work"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 space-y-4 text-sm text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Gifts.</span> No platform fee on gifts. The gift amount stays whole. The gifter only pays standard payment processing.</p>
                      <ul className="space-y-2 pl-5">
                        <li className="list-disc">Card or Apple Pay: 2.9% + $0.30</li>
                        <li className="list-disc">ACH bank transfer: 0.8%, capped at $5.00</li>
                        <li className="list-disc">PayPal: 3.49% + $0.49</li>
                      </ul>
                      <p><span className="font-semibold text-foreground">Invested assets.</span> $1 per year per $1,000 invested, charged only on invested assets once investing is live.</p>
                      <p>Hosts can choose to absorb processing fees on behalf of their gifters in fund settings. All fees are shown in full before checkout.</p>
                      <p className="text-xs">Investments are not FDIC insured, not bank guaranteed, and may lose value.</p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </FadeIn>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <FadeIn className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Pricing FAQ</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                The questions that actually matter.
              </h2>
              <div className="mt-8 space-y-6">
                {pricingFaqs.map((item) => (
                  <div key={item.question}>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{item.question}</h3>
                    <p className="leading-relaxed text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <FadeIn className="rounded-[2rem] border border-border/60 bg-card/90 p-8 text-center shadow-premium-sm md:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Start here</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                Start free. Upgrade when the product has earned it.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
Most families do not need to decide everything upfront. The free plan is real, and most families start there and stay a while.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/get-started">
                  <Button size="lg" className="h-14 px-10 text-base" data-testid="button-pricing-cta-primary">
                    Start your child's fund
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/compare">
                  <Button variant="outline" size="lg" className="h-14 px-10 text-base" data-testid="button-pricing-cta-secondary">
                    See comparisons
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                More questions are covered in the <Link href="/faq" className="text-primary hover:underline">full FAQ</Link>.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Looking for a personal investment fund?{" "}
                <button
                  type="button"
                  onClick={() => setWaitlistOpen(true)}
                  className="text-primary hover:underline"
                  data-testid="button-pricing-personal-waitlist"
                >
                  Join the waitlist
                </button>
              </p>
            </FadeIn>
          </div>
        </section>

        <PersonalFundWaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} sourceSurface="pricing_footer" />
        <Footer />
      </main>
    </div>
  );
}
