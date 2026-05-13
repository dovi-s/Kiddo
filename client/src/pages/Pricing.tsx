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

// Plans locked per MEMORY (2026-05-08, 2026-05-12 audit):
//   Free:   $0 / month, 1 fund, basic features, Kid View (full experience for one fund),
//           basic text Memory Book.
//           Approved phrasings: "$0 per month", "$0 / per month", "Free to start", "No monthly fee".
//           Never "$0 forever" or "Always free" — Acorns-scrutiny risk with the 0.10% AUM line.
//   Plus:   $4.99/mo or $39/yr (annual is 35% off monthly — aggressive).
//   Family: $7.99/mo or $69/yr (annual is 28% off monthly — standard).
//   Legacy: PULLED from public pricing 2026-05-12. Existing subscribers keep their plan;
//           no new signups via the marketing site. NAME preserved for future tier.
// Fee model locked per MEMORY (2026-05-08):
//   0.10% AUM annual fee on invested assets across ALL plans (Free included).
//   NOT charged on cash or pending gifts. NO platform fee on gifts. "Gift amount stays whole."
//   The old $2/gift platform fee is RETIRED — was Free-tier monetization, replaced by AUM model.
// Recurring investments naming locked: never "auto-invest" in user-facing copy.
// "Contribute" banned in UI copy: use "Add to" or "Invest in"; "gift" for the money/transaction.
// Occasions: "1 active occasion at a time" (locked 2026-05-13, was "event"
// previously). User-facing copy uses "occasion" to match the "Kiddo Occasions"
// premium upgrade product name and to read warmer than calendar-app "event".
// Internal code (EventCreate, useEvents, eventId, schema.events table, etc.)
// is unchanged — the rename is display-only.
const plans = [
  {
    id: "free",
    name: "FREE",
    eyebrow: "For parents just getting started.",
    price: "$0",
    pricePeriod: "/ per month",
    cta: "Start for free",
    featured: false,
    body: [
      "1 child fund (one child's permanent investment account)",
      "1 active occasion at a time",
      "Shareable gift link, QR code, and gift code",
      "Text Memory Book entries (gifters can always attach photos, videos, and voice)",
      "Kid View. Your child sees what they own and how their fund grows",
      "SIPC-insured investments via DriveWealth",
      "0.10% annual fee on invested assets only",
    ],
    note: "No credit card. No commitment.",
  },
  {
    id: "kiddo-plus",
    name: "KIDDO+",
    eyebrow: "For the parent who shows up every month.",
    price: "$39",
    pricePeriod: "/ per year",
    annual: "or $4.99 / month",
    cta: "Start with Kiddo+",
    featured: true,
    note: "Annual is 35% off monthly.",
    body: [
      "Everything in Free",
      "Recurring investments. Set a monthly amount that fires automatically",
      "Add your own photos, videos, and voice memos to Memory Book entries",
      "Custom fund mix. Pick your own stocks and weights",
      "Co-parent access. Invite a partner or guardian",
      "3 active occasions at a time (Free is 1)",
      "Priority support",
      "0.10% annual fee on invested assets only",
    ],
  },
  {
    id: "kiddo-family",
    name: "KIDDO FAMILY",
    eyebrow: "For families with two or more children.",
    price: "$69",
    pricePeriod: "/ per year",
    annual: "or $7.99 / month",
    cta: "Cover all your children",
    featured: false,
    note: "Annual is 28% off monthly. Best value from your second child onwards.",
    body: [
      "Everything in Kiddo+",
      "Unlimited children",
      "Full Memory Book authoring for every child",
      "Kid View for every child",
      "One view for every fund in your household",
      "Unlimited occasions with premium features included",
      "0.10% annual fee on invested assets only",
    ],
  },
] as const;

const fitRows = [
  {
    situation: "One child, just getting started",
    bestPlan: "Free",
  },
  {
    situation: "One child, want the full experience",
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

// Real-dollar AUM examples. The point is to show how small 0.10% is in
// practice — kids' funds compound for 18 years, and even a $10k balance
// only carries a $10/year fee. Same shape as a $0.83/month subscription
// for a real investment account, but framed as an annual line so the
// math reads honestly. Cash and pending gifts are excluded from the
// invested-assets denominator per the locked fee architecture.
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
    answer: "Your fund stays active. Your investments stay invested. Premium features (full Memory Book, recurring investments, co-parent access, projections) become read-only or revert to the Free experience. Your kid's money never leaves the fund.",
  },
  {
    question: "Is there a platform fee on gifts?",
    answer: "No. The gift amount stays whole. $50 from grandma is $50 to the fund. The gifter pays standard payment processing through Stripe (shown in full before checkout). Kiddo's revenue comes from the optional Plus and Family plans, plus a small 0.10% annual fee on invested assets across every tier.",
  },
  {
    question: "What is the 0.10% annual fee?",
    answer: "Kiddo charges 0.10% per year on invested assets only. Cash sitting in the fund and pending gifts are not charged. The fee is prorated daily and deducted from invested balance. Small enough that even a $10,000 invested fund costs $10 per year. The same rate applies on Free, Kiddo+, and Kiddo Family.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes. New accounts get a 14-day reverse trial of Plus features automatically. Every premium feature unlocks for two weeks so you can decide before upgrading. No credit card required. After 14 days, your fund reverts to the Free plan unless you choose to upgrade.",
  },
  {
    question: "What is the difference between a fund and an occasion?",
    answer: "A fund is your child's permanent investment account. An occasion is a gifting moment tied to that fund: a birthday page, a holiday page, a baby shower page. All gifts from all occasions flow into the same fund. The fund is permanent. Occasions are temporary.",
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
              <span className="font-medium text-foreground">No platform fee on gifts.</span>{" "}
              The gift amount always stays whole. Kiddo charges 0.10% per year on invested assets only, the same rate on every plan.
            </p>
            <p className="mx-auto mt-4 max-w-3xl rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Annual pricing is shown first on paid plans.</span>{" "}
              Most families choose the yearly option because it lowers the re-evaluation moment to once a year and shows the clearest savings.
            </p>
          </motion.div>
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
                    <div className="mt-5 flex items-baseline justify-center gap-1">
                      <span className="font-heading text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-sm font-medium text-muted-foreground">{plan.pricePeriod}</span>
                    </div>
                    {"annual" in plan && plan.annual ? <p className="mt-2 text-sm font-medium text-green-700">{plan.annual}</p> : null}
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

                  {"note" in plan && plan.note ? <p className="mt-4 text-center text-sm italic text-muted-foreground">{plan.note}</p> : null}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-10 md:pb-14">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">How the 0.10% fee works</p>
              <h2 className="mt-3 font-heading text-2xl font-bold text-foreground md:text-3xl">
                Small. Transparent. Same on every plan.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                The 0.10% annual fee is charged only on invested assets. Cash sitting in the fund and pending gifts are not charged. It is prorated daily and deducted from invested balance.
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-border">
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
            <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
              For context, that is roughly the cost of a single coffee per year per $10,000 invested.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="pb-12">
        <div className="mx-auto max-w-4xl px-4">
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
                  Kiddo does not mark up payment processing. Standard Stripe rates apply on every gift.
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
                    <p>
                      <span className="font-semibold text-foreground">Gifts.</span> No platform fee on gifts. The gift amount always stays whole. The gifter pays standard payment processing handled by Stripe.
                    </p>
                    <ul className="space-y-2 pl-5">
                      <li className="list-disc">Card or Apple Pay: 2.9% + $0.30</li>
                      <li className="list-disc">ACH bank transfer: 0.8%, capped at $5.00 (cheapest rail)</li>
                      <li className="list-disc">PayPal: 3.49% + $0.49</li>
                    </ul>
                    <p>
                      <span className="font-semibold text-foreground">Invested assets.</span> 0.10% per year on invested balance only. Cash and pending gifts are not charged. Prorated daily.
                    </p>
                    <p>
                      Hosts can choose to absorb processing fees on behalf of their gifters in fund settings. All fees are shown in full before checkout. No surprises.
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
              &quot;I upgraded to Kiddo+ after the first month. The Memory Book with photos and voice memos was what sold me. My daughter is going to read this stuff at 18.&quot;
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
              Most parents upgrade after their first gift comes in.
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

      <PersonalFundWaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        sourceSurface="pricing_footer"
      />

      <Footer />
    </div>
  );
}
