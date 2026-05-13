import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Star } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { GeminiHeroGradient } from "@/components/ui/gemini";
import { PersonalFundWaitlistModal } from "@/components/PersonalFundWaitlistModal";

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

const plans = [
  {
    id: "free",
    name: "FREE",
    eyebrow: "For parents just getting started.",
    price: "$0/mo",
    cta: "Start for free",
    featured: false,
    body: [
      "1 fund (one child's permanent investment account)",
      "1 event page (one active gifting occasion at a time)",
      "Shareable gift link, QR code, and gift code",
      "Basic Memory Book",
      "Child View for younger kids",
      "SIPC-insured investments via DriveWealth",
      "$2 platform fee on gifts up to $200 (minimum gift: $10)",
      "1% platform fee on gifts above $200",
    ],
    note: "No credit card. No commitment.",
  },
  {
    id: "kiddo-plus",
    name: "KIDDO+",
    eyebrow: "For the single-child parent who wants the full experience fee-free.",
    price: "$44.99/year",
    annual: "or $4.99/month",
    cta: "Start with Kiddo+",
    featured: true,
    note: "Pays for itself after 3 contributions of $10 or more.",
    body: [
      "Everything in Free",
      "No platform fee on contributions",
      "Full Memory Book",
      "Covers one child fund at a time",
      "Custom event page design (colors, banner, welcome message)",
      "3 simultaneous event pages",
      "Full Child View and financial education features",
      "Gifter milestone notifications",
    ],
  },
  {
    id: "kiddo-family",
    name: "KIDDO FAMILY",
    eyebrow: "For families with two or more children.",
    price: "$89.99/year",
    annual: "or $9.99/month",
    cta: "Cover all your children",
    featured: false,
    note: "Best value from your second child onwards.",
    body: [
      "Everything in Kiddo+",
      "Unlimited funds covered",
      "No platform fee on contributions",
      "Unlimited simultaneous event pages",
      "Custom event URLs",
      "Full contribution analytics dashboard",
      "Household dashboard",
      "Full Child View and financial education features",
      "Priority support (under 4-hour response)",
    ],
  },
];

const fitRows = [
  {
    situation: "One child, just getting started",
    bestPlan: "Free",
  },
  {
    situation: "One child, want full-value gifting",
    bestPlan: "Kiddo+",
  },
  {
    situation: "Two or more children",
    bestPlan: "Kiddo Family",
  },
  {
    situation: "Not sure yet",
    bestPlan: "Start free. Upgrade any time.",
  },
];

const platformFeeExamples = [
  { gift: "$50 gift", freePlan: "$2 platform fee", paidPlan: "$0 platform fee" },
  { gift: "$150 gift", freePlan: "$2 platform fee", paidPlan: "$0 platform fee" },
  { gift: "$250 gift", freePlan: "$2.50 platform fee", paidPlan: "$0 platform fee" },
] as const;

const pricingFaqs = [
  {
    question: "Can I cancel any time?",
    answer: "Yes. No contracts. No cancellation fees. If you cancel, your plan downgrades at the end of your billing period. Your fund and investments are not affected.",
  },
  {
    question: "What happens to my fund if I downgrade?",
    answer: "Your fund stays active. Your investments stay invested. Future gifts follow the Free plan fee rules again: $2 up to $200, then 1% above $200. Nothing is lost.",
  },
  {
    question: "What does covered mean?",
    answer: "Covered means that fund is on a paid plan. Standard gifts to that fund skip the normal Free-plan platform fee, and premium features like the full Memory Book and enhanced gifting controls unlock for that fund. Kiddo+ covers one fund at a time. Kiddo Family covers every fund in your household.",
  },
  {
    question: "Is there a free trial?",
    answer: "New accounts receive 30 days with no platform fee on their first fund. No credit card required. After 30 days, the Free plan applies unless you upgrade.",
  },
  {
    question: "What is the difference between a fund and an event?",
    answer: "A fund is your child's permanent investment account. An event is a gifting occasion tied to that fund: a birthday page, a holiday page, a baby shower page. All gifts from all events flow into the same fund. The fund is permanent. Events are temporary.",
  },
  {
    question: "What is the difference between the platform fee and the processing fee?",
    answer: "The platform fee is Kiddo's fee for operating the platform. On Free, it is $2 on gifts up to $200 and 1% above $200. Kiddo+ and Kiddo Family remove that standard platform fee from normal gifts. The processing fee is Stripe's fee for handling the payment. Contributions of $10,000 or more also include a separate 0.1% large-gift processing fee on every plan.",
  },
];

export default function Pricing() {
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="relative overflow-hidden pb-16 pt-20 md:pb-24 md:pt-32 gemini-warm-section">
        <GeminiHeroGradient />
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="mb-4 font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl" data-testid="text-pricing-headline">
              Simple pricing for children&apos;s investment funds.
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              One fund equals one child&apos;s permanent investment account. Start with one. Add more any time.
            </p>
            <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-border bg-card/70 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">One fund = one child&apos;s permanent investment account.</span>{" "}
              Start free. Upgrade when you are ready.
            </p>
            <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-amber-300/60 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950">
              <span className="font-semibold">Important if you are comparing plans:</span> the Free plan charges a{" "}
              <span className="font-semibold">$2 platform fee on gifts up to $200</span>, then{" "}
              <span className="font-semibold">1% above $200</span>. Kiddo+ and Kiddo Family remove that standard platform fee from normal gifts.
            </div>
            <p className="mx-auto mt-4 max-w-3xl rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Annual pricing is shown first on paid plans.</span>{" "}
              Most families choose the yearly option because it lowers the re-evaluation moment to once a year and gives the clearest savings.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-10 md:pb-14">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Fee examples</p>
              <h2 className="mt-3 font-heading text-2xl font-bold text-foreground md:text-3xl">
                The free-plan fee is the main thing paid plans remove.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Stripe processing is separate on every plan. The comparison below is just the Kiddo platform fee on a normal gift.
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Gift</th>
                    <th className="px-4 py-3 font-medium">Free</th>
                    <th className="px-4 py-3 font-medium">Kiddo+ / Family</th>
                  </tr>
                </thead>
                <tbody>
                  {platformFeeExamples.map((row) => (
                    <tr key={row.gift} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">{row.gift}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.freePlan}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.paidPlan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan, index) => (
              <FadeIn key={plan.id} delay={index * 0.08}>
                <div className={`relative flex h-full flex-col rounded-2xl bg-card p-8 shadow-premium-sm ${plan.featured ? "ring-2 ring-primary" : ""}`}>
                  {plan.featured ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                        <Star className="h-3 w-3" />
                        Most popular
                      </span>
                    </div>
                  ) : null}
                  <div className="mb-6 text-center">
                    <h2 className="mb-2 font-heading text-xl font-semibold text-foreground">{plan.name}</h2>
                    <p className="text-sm font-medium text-foreground">{plan.eyebrow}</p>
                    <p className="mt-5 font-heading text-4xl font-bold text-foreground">{plan.price}</p>
                    {"annual" in plan ? <p className="mt-2 text-sm font-medium text-green-700">{plan.annual}</p> : null}
                  </div>

                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.body.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/get-started">
                    <Button variant={plan.featured ? "default" : "outline"} className="w-full" data-testid={`button-pricing-${plan.id}`}>
                      {plan.cta}
                    </Button>
                  </Link>

                  {"note" in plan ? <p className="mt-4 text-center text-sm italic text-muted-foreground">{plan.note}</p> : null}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="mb-8 rounded-2xl bg-card p-8 shadow-premium-sm">
            <div className="mb-5 rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">What “covered” means</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A covered fund skips the normal Free-plan platform fee on standard gifts and unlocks premium features for that fund. Kiddo+ covers one child fund. Kiddo Family covers every fund you manage.
              </p>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground">Large gift processing fee</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Contributions above $10,000 include a separate 0.1% processing fee on every plan. This covers the additional compliance and processing overhead that comes with large transfers.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Gift size</th>
                    <th className="px-4 py-3 font-medium">Large gift fee</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { amount: "$10,000", fee: "$10.00" },
                    { amount: "$50,000", fee: "$50.00" },
                    { amount: "$100,000", fee: "$100.00" },
                  ].map((row) => (
                    <tr key={row.amount} className="border-t border-border">
                      <td className="px-4 py-3 text-muted-foreground">{row.amount}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm">
            <h2 className="mb-5 font-heading text-2xl font-bold text-foreground">Which plan is right for you?</h2>
            <div className="overflow-hidden rounded-xl border border-border">
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
          </FadeIn>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-heading text-2xl font-bold text-foreground">Fee transparency</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Kiddo does not mark up payment processing fees. Standard Stripe rates apply.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                onClick={() => setShowFeeDetails((value) => !value)}
                data-testid="button-toggle-pricing-fees"
              >
                How do fees work?
                <motion.div animate={{ rotate: showFeeDetails ? 180 : 0 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showFeeDetails ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 space-y-4 text-sm text-muted-foreground">
                    <p>Payment processing fees are handled by Stripe and vary by payment method:</p>
                    <ul className="space-y-2 pl-5">
                      <li className="list-disc">Credit or debit card: 2.9% + $0.30</li>
                      <li className="list-disc">ACH bank transfer: 0.8%, capped at $5.00</li>
                    </ul>
                    <p>
                      Free plan gifts use a $2 platform fee up to $200, then 1% above $200 (minimum gift: $10 on Free). Kiddo+ and Kiddo Family remove the platform fee from contributions. Contributions of $10,000 or more include a separate 0.1% large-gift processing fee on every plan.
                    </p>
                    <p>
                      Hosts can choose to absorb processing fees for their gifters in fund settings. Fees are always shown in full before checkout. No surprises.
                    </p>
                    <p className="text-xs">Investments are not FDIC insured, not bank guaranteed, and may lose value.</p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </FadeIn>
        </div>
      </section>

      <section className="pb-12">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 text-center shadow-premium-sm">
            <p className="mx-auto max-w-2xl text-lg italic text-foreground">
              &quot;I upgraded to Kiddo+ after the first contribution came in. The math was obvious. I had already paid $6 in fees. The annual plan made the decision even easier.&quot;
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Rachel D., mother of one, Texas</p>
          </FadeIn>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
            <h2 className="mb-8 font-heading text-2xl font-bold text-foreground md:text-3xl">Pricing FAQ</h2>
            <div className="space-y-6">
              {pricingFaqs.map((item) => (
                <div key={item.question}>
                  <h3 className="mb-2 font-heading text-lg font-semibold text-foreground">{item.question}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 text-center shadow-premium-sm md:p-12">
            <p className="text-muted-foreground">Not sure which plan is right for you?</p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground md:text-4xl">
              Start free. Upgrade when you are ready.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Most parents upgrade after their first contribution.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base" data-testid="button-pricing-cta-primary">
                  Start your child&apos;s fund
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
              Questions are covered in the <Link href="/faq" className="text-primary hover:underline">full FAQ</Link>.
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

      <PersonalFundWaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        sourceSurface="pricing_footer"
      />

      <Footer />
    </div>
  );
}
