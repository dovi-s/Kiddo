import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
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
//           Approved phrasings: "$0 per month", "$0/month", "Free to start", "No monthly fee".
//           "/ per month" form retired 2026-05-15 (doubled prepositions read awkwardly).
//           Never "$0 forever" or "Always free" — Acorns-scrutiny risk with the 0.10% AUM line.
//   Plus:   $3.99/mo or $29/yr (annual is 39% off monthly — aggressive; updated 2026-05-23 pricing-v3).
//   Family: $6.99/mo or $59/yr (annual is 30% off monthly — standard; updated 2026-05-23 pricing-v3).
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
// Plan data shape: each paid plan has explicit yearly + monthly
// price blocks so the annual/monthly toggle in the JSX can swap
// between them cleanly. Free has only `flat` since it doesn't
// have a billing-period split. Per the 2026-05-14 strategic
// pricing review.
type PlanPrice =
  | { kind: "flat"; price: string; period: string }
  | {
      kind: "billed";
      // Daily-framing line per the locked behavioral-framing discipline
      // (project_behavioral_framing_discipline.md): "Daily-framing beats
      // monthly-framing on recurring conversion — Acorns saw 4× enrollment
      // lift from '$5/day' vs '$150/month' same money." Applies to
      // recurring-conversion surfaces including the Pricing tier cards.
      // The phrasing matches the established "$3.99/month — about 13¢
      // a day" pattern from PlusUpgradePromptCard + MemoryMediaPicker.
      // Optional field — Free / Founding cards skip it (no monthly billing).
      dailyFraming?: string;
      yearly: { price: string; period: string; equivalent: string };
      monthly: { price: string; period: string; equivalent: string };
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
      "Gifter reminder system (birthday and repeat-gift reminders)",
      "Text Memory Book entries (gifters can always attach photos, videos, and voice)",
      "Kid View. Your child sees what they own and how their fund grows",
      "SIPC-insured investments via DriveWealth",
      "$1/year per $1,000 invested (only on invested assets)",
    ],
    note: "No credit card. No commitment.",
  },
  {
    id: "kiddo-plus",
    name: "KIDDO+",
    eyebrow: "For the parent who shows up every month.",
    pricing: {
      kind: "billed",
      dailyFraming: "About 13¢ a day",
      yearly: { price: "$29", period: "/year", equivalent: "or $3.99/month" },
      monthly: { price: "$3.99", period: "/month", equivalent: "or $29/year" },
    },
    cta: "Start with Kiddo+",
    featured: true,
    note: "Plus is for one child. Move to Family when you add a second.",
    body: [
      // Single-fund constraint surfaced as the leading bullet so a
      // multi-kid parent reads the limit before scrolling the
      // feature list. Per the 2026-05-14 strategic review: the
      // constraint should be obvious before the parent commits,
      // not surface-as-friction when they try to add a second kid.
      "One child fund. Move to Family if you add a second.",
      "Everything in Free",
      // Recurring is BACK in Plus's headline gate under pricing-v3
      // (locked 2026-05-23, see project_pricing_v3_recurring_at_plus.md).
      // The Plus tier on a fund unlocks recurring contributions for
      // both the parent AND any gifter to that fund — gifters never
      // pay; they inherit the fund's tier. Free funds get a real
      // reminder system instead. This supersedes the 2026-05-21
      // reframe that briefly moved recurring out of Plus's gate.
      "Recurring contributions. For you and for any gifter to the fund",
      "Custom fund mix. Pick your own ETFs and weights",
      "Strategy switching with rebalancing. Move between conservative, balanced, and growth",
      "Add your own photos, videos, and voice memos to Memory Book entries",
      "Co-parent access. Invite a partner or guardian",
      "3 active occasions at a time (Free is 1)",
      "Annual contribution summary for tax records",
      "Priority support",
      "$1/year per $1,000 invested (only on invested assets)",
    ],
  },
  {
    id: "kiddo-family",
    name: "KIDDO FAMILY",
    eyebrow: "For families with two or more children.",
    pricing: {
      kind: "billed",
      dailyFraming: "About 23¢ a day",
      yearly: { price: "$59", period: "/year", equivalent: "or $6.99/month" },
      monthly: { price: "$6.99", period: "/month", equivalent: "or $59/year" },
    },
    cta: "Cover all your children",
    featured: false,
    note: "Family covers two or more children, no per-kid charge.",
    body: [
      "Everything in Kiddo+",
      "Unlimited children",
      // Bullet retoned 2026-05-20 per the cross-plan clarity audit.
      // Was: "Memory Book authoring for every child (photos, videos,
      // voice)". The parenthetical accidentally suggested Family
      // unlocks NEW media authoring features (when actually Plus
      // already has photo/video/voice authoring — Family just
      // extends that authoring across multiple children). The
      // differential is SCOPE, not features. Now matches the
      // locked-memory language: "Memory Book for every child" —
      // scope-only, no feature confusion.
      "Memory Book for every child",
      "Kid View for every child",
      "One view for every fund in your household",
      // "with premium features included" suffix REMOVED 2026-05-20
      // per the same cross-plan audit. Premium occasion features
      // (themes, group goal progress) gate behind subscription —
      // meaning BOTH Plus AND Family get them. Listing it only on
      // the Family bullet created the false impression that Family
      // adds occasion features Plus doesn't have. Plus already has
      // the premium features; Family just lifts the count cap. The
      // scope differential ("Unlimited" vs Plus's "3 active") is
      // the only difference. Clean bullet, no false suggestion.
      "Unlimited occasions",
      "$1/year per $1,000 invested (only on invested assets)",
    ],
  },
];

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
    answer: "Your fund stays active and your investments stay invested. Plus features pause: custom fund mix, strategy switching, adding new photos and videos to Memory Book entries, co-parent invites, and the ability to create new recurring contributions on the fund. Existing recurring contributions you have already set up continue running. Existing gifter recurring relationships continue too. We never cancel an existing recurring relationship on plan downgrade. Everything you have already added stays. Your kid's money never leaves the fund.",
  },
  {
    question: "Is there a platform fee on gifts?",
    answer: "No. The gift amount stays whole. $50 from grandma is $50 to the fund. The gifter pays standard payment processing through Stripe (shown in full before checkout). Kiddo's revenue comes from the optional Plus and Family plans and an annual fee of $1 per $1,000 invested (about $10/year on a $10,000 fund) that applies to every plan.",
  },
  {
    question: "What's the annual fee on invested assets?",
    answer: "$1 per year for every $1,000 invested. About $10/year on a $10,000 fund, $100/year on a $100,000 fund. Charged only on invested assets; cash sitting in the fund and pending gifts are not charged. Prorated daily and deducted from invested balance. Same rate on Free, Kiddo+, and Kiddo Family.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes. New accounts get 14 days of Plus features automatically. Every premium feature unlocks so you can decide before upgrading. No credit card required. After 14 days, your account reverts to Free unless you choose to upgrade.",
  },
  {
    question: "What is the difference between a fund and an occasion?",
    answer: "A fund is your child's permanent investment account. An occasion is a gifting moment tied to that fund: a birthday page, a holiday page, a baby shower page. All gifts from all occasions flow into the same fund. The fund is permanent. Occasions are temporary.",
  },
];

export default function Pricing() {
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  // Annual / monthly toggle. Locked default = annual per
  // 2026-05-14 strategic pricing review and the hero reassurance
  // line ("Annual pricing is shown first on paid plans"). Industry-
  // standard SaaS pattern; massive readability win over the
  // previous "stacked prices in every card" treatment.
  const [billingPeriod, setBillingPeriod] = useState<"yearly" | "monthly">("yearly");

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
              The gift amount always stays whole. Kiddo's annual fee is $1 per $1,000 invested. Only on invested assets. Same rate on every plan.
            </p>
            {/* Meta-explanation about why annual is shown first
                retired 2026-05-15. The savings are visible in the
                cards themselves; explaining the UI is how-it-works,
                not pricing info. Tell, don't justify. */}
            {/* 14-day Plus trial fires
                automatically on every new account. Previously this
                lived only in the FAQ ("Is there a free trial?"
                question), buried where most visitors never scroll.
                Surfaced 2026-05-14 per the strategic pricing review:
                the trial mechanic is the single highest-leverage
                conversion lever in the model and was reading as a
                footnote. Calm reassurance card, not hero-sized
                (locked principle: marketing-feel chrome stays
                Apple-Settings register). */}
            <p className="mx-auto mt-4 max-w-3xl rounded-2xl border border-border bg-card px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Every new account gets 14 days of Plus, free.</span>{" "}
              Every premium feature unlocks so you can try before deciding. No credit card. Your fund stays either way.
            </p>
            {/* Founding Members pointer (pricing-v3 launch). Surfaces the
                $19/yr lifetime price-lock deal on the canonical pricing
                page for pre-launch visitors who care about pricing
                enough to land here. Capped at 1,000; deal expires when
                the cap fills. Per project_pricing_v3_pricing_levels.md
                + project_pre_launch_strategic_frame.md. */}
            <p className="mx-auto mt-4 max-w-3xl rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-foreground">
              <span className="font-semibold">Pre-launch: Founding Members get $19/year Plus, locked in for life.</span>{" "}
              First 1,000 families. Plus a Founding Member badge, $25 starter credit, and early access to every future Kiddo product.{" "}
              <Link href="/founding-members" className="font-medium text-primary underline underline-offset-2">
                Reserve your spot →
              </Link>
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          {/* Annual / monthly toggle. Pill-shaped, calm, default
              to annual (per locked principle "annual pricing is
              shown first on paid plans"). Affects only the price
              block on each card; feature lists are billing-period-
              independent. Free card price is unchanged regardless
              of toggle state. */}
          <div className="mb-10 flex justify-center">
            <div
              className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-premium-sm"
              role="radiogroup"
              aria-label="Billing period"
              data-testid="pricing-billing-toggle"
            >
              <button
                type="button"
                role="radio"
                aria-checked={billingPeriod === "yearly"}
                onClick={() => setBillingPeriod("yearly")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  billingPeriod === "yearly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="pricing-toggle-yearly"
              >
                Annual
                {/* "Save up to 35%" badge REMOVED 2026-05-20 per the
                    Anthropic-15-min sales-call audit. Performance badge
                    embedded in a navigation control. The actual annual
                    prices visible on the cards below already show the
                    savings; an upsell badge on the toggle was double-
                    selling the same idea. Toggle is now a clean
                    Annual/Monthly switch. */}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={billingPeriod === "monthly"}
                onClick={() => setBillingPeriod("monthly")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  billingPeriod === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="pricing-toggle-monthly"
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan, index) => {
              // Resolve the price block based on the current toggle
              // state. Flat-priced plans (Free) ignore the toggle.
              const priceDisplay = plan.pricing.kind === "flat"
                ? { price: plan.pricing.price, period: plan.pricing.period, equivalent: null as string | null, dailyFraming: null as string | null }
                : billingPeriod === "yearly"
                  ? { ...plan.pricing.yearly, equivalent: plan.pricing.yearly.equivalent, dailyFraming: plan.pricing.dailyFraming ?? null }
                  : { ...plan.pricing.monthly, equivalent: plan.pricing.monthly.equivalent, dailyFraming: plan.pricing.dailyFraming ?? null };
              return (
              <FadeIn key={plan.id} delay={index * 0.08}>
                <div className={`relative flex h-full flex-col rounded-2xl bg-card p-8 shadow-premium-sm ${plan.featured ? "ring-2 ring-primary" : ""}`}>
                  {/* "Most popular" pill REMOVED 2026-05-20 per the
                      Anthropic-15-min sales-call audit. Classic SaaS
                      theater badge. The ring-2 visual emphasis on the
                      featured plan still draws the eye; the eyebrow
                      ("For the parent who shows up every month")
                      already explains what Plus is for. Telling the
                      reader which one is "popular" is performance,
                      not information — the prospect doesn't need a
                      sticker to make a choice they can already make
                      from the prices + feature lists in front of them. */}
                  <div className="mb-6 text-center">
                    <h2 className="mb-2 font-heading text-xl font-semibold text-foreground">{plan.name}</h2>
                    <p className="text-sm font-medium text-foreground">{plan.eyebrow}</p>
                    <div className="mt-5 flex items-baseline justify-center gap-1">
                      <span className="font-heading text-4xl font-bold text-foreground">{priceDisplay.price}</span>
                      <span className="text-sm font-medium text-muted-foreground">{priceDisplay.period}</span>
                    </div>
                    {/* Equivalent line color: muted (was text-green-700).
                        Now that the line reads "or $29/year" symmetrically
                        with the yearly card's "or $3.99/month" — not a
                        savings badge — green coloring (which signals
                        positive/saving) would over-emphasize a neutral
                        conversion. Muted gray matches the period label
                        treatment one line above. Locked 2026-05-20. */}
                    {priceDisplay.equivalent ? <p className="mt-2 text-sm text-muted-foreground">{priceDisplay.equivalent}</p> : null}
                    {/* Daily-framing line — added 2026-05-25 per the
                        locked behavioral-framing discipline. Acorns saw
                        a 4× recurring-conversion lift framing "$5/day"
                        vs "$150/month" — same dollars, different cognitive
                        size. The Pricing tier cards are recurring-
                        conversion surfaces, so they deserve the daily
                        framing. Matches the established phrasing in
                        PlusUpgradePromptCard + MemoryMediaPicker. */}
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

                  <Link href="/get-started">
                    <Button variant={plan.featured ? "default" : "outline"} className="w-full" data-testid={`button-pricing-${plan.id}`}>
                      {plan.cta}
                    </Button>
                  </Link>

                  {"note" in plan && plan.note ? <p className="mt-4 text-center text-sm italic text-muted-foreground">{plan.note}</p> : null}
                </div>
              </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-10 md:pb-14">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">How the annual fee works</p>
              <h2 className="mt-3 font-heading text-2xl font-bold text-foreground md:text-3xl">
                Small. Transparent. Same on every plan.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                The annual fee is $1 per $1,000 invested, charged only on invested assets. Cash sitting in the fund and pending gifts are not charged. It is prorated daily and deducted from invested balance.
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
            {/* Explicit revenue-source transparency. Before the
                alignment closing beat, name exactly what Kiddo earns
                from and what it doesn't. Pulled from the scattered
                statements across the page (no platform fee on gifts,
                AUM on invested assets, etc.) into one consolidated
                line so a parent skimming the fee section can see the
                full money model in one breath. Added 2026-05-15 per
                the post-pricing-page audit. */}
            <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
              Kiddo earns from Plus and Family subscriptions and an annual fee of $1 per $1,000 invested. We don't take a cut of gifts. We don't sell your data.
            </p>
            {/* Alignment frame. The AUM fee is small but the deeper
                story is WHY the model is structured this way: Kiddo
                only earns more if the kid's fund grows. That puts
                the platform on the same side of the table as the
                family. Single sentence makes the trust frame
                explicit; without it the fee reads as just-another-
                line-item. Surfaced 2026-05-14 per the strategic
                pricing review. */}
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm font-medium leading-relaxed text-foreground">
              When your child's fund grows, we earn a little more. We are on the same side of the table.
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
                  Kiddo does not mark up payment processing. Standard Stripe rates apply (about 2.9% + $0.30 on cards, shown in full before checkout).
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
                      <span className="font-semibold text-foreground">Invested assets.</span> $1 per year per $1,000 of invested balance only. Cash and pending gifts are not charged. Prorated daily.
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

      {/* Locked refusals trust panel. Added 2026-05-20 per the
          wow-factor analysis: the list of things Kiddo refuses to
          charge for is itself a trust signal that competitors
          cannot easily match without giving up their bundle
          economics. Surfacing it on the public Pricing page makes
          the discipline visible to prospective customers.

          Content sourced from the locked pricing decisions in
          memory/project_subscription_retires_at_majority.md and the
          MEMORY.md fee architecture section. When new locked-refusal
          decisions are added (e.g., never sell data, never charge
          for X), this list should grow. Order: gift fee first
          (highest-frequency moment), then access surfaces, then
          the kid-at-18 promise (the deepest locked decision). */}
      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
            <h2 className="mb-2 font-heading text-2xl font-bold text-foreground md:text-3xl">
              What Kiddo refuses to charge for
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground md:text-base">
              Pricing decisions we have made and will not unmake. Each one is locked, with reasoning written down.
            </p>
            <div className="space-y-5">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground md:text-lg">
                  No fee on gifts.
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  A $50 gift from grandma is $50 in the fund. The platform takes nothing. Gifter pays Stripe processing only.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground md:text-lg">
                  Memory Book viewing is free, every plan.
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Every gift, every voice memo, every photo from every gifter, visible to free parents too. The Plus differential is parent-authored media, not what you can see.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground md:text-lg">
                  Kid View is free, every plan.
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  The full kid experience (holdings, age-aware copy, projected value at 18, Memory Book visibility) is identical regardless of the parent's tier. The kid did not choose the plan; their experience should not be class-divided by it.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground md:text-lg">
                  The kid never pays a subscription on the fund they inherit.
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  At majority, when the fund legally becomes the kid's, the parent's Kiddo+ subscription retires for that fund. The kid pays nothing to keep using their own brokerage account.
                </p>
              </div>
            </div>
            <div className="mt-8 border-t border-border/40 pt-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                $1 per year per $1,000 invested is the only ongoing fee. Across every plan. No hidden charges. No data sales.
              </p>
            </div>
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
