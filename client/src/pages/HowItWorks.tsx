import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Gift, MousePointerClick, QrCode, TrendingUp, UserRoundPlus } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";

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

const parentSteps = [
  {
    icon: UserRoundPlus,
    title: "Step 1: Create your account.",
    body: "Sign up with your email. Takes 30 seconds. No credit card required.",
  },
  {
    icon: TrendingUp,
    title: "Step 2: Set up your child's fund.",
    body: "Enter your child's name and date of birth. Pick one default path for new gifts: a diversified managed mix, a specific default stock, or cash until you invest later. You can change it any time.",
  },
  {
    icon: QrCode,
    title: "Step 3: Get your gift link.",
    body: "Kiddo generates a private, shareable link, QR code, and fund code for your child's fund. This is what you share with family and friends. It is not public. It is not searchable. Only people you share it with can access it.",
  },
  {
    icon: MousePointerClick,
    title: "Step 4: Share it.",
    body: "Send the link in a text, an email, a group chat, or a family WhatsApp. Put the QR code on a birthday invitation. Or share the fund code verbally. Post it in a baby shower event. Share it anywhere you would normally share a gift registry.",
  },
  {
    icon: Gift,
    title: "Step 5: Watch gifts arrive.",
    body: "Every time someone gifts through your link, the money follows your fund's default investing path. You get a notification. The gifter gets a confirmation. The Memory Book captures the moment.",
  },
];

const giverSteps = [
  {
    icon: MousePointerClick,
    title: "Step 1: Access the fund.",
    body: "Three ways: tap the link the parent shared, scan the QR code at a party, or go to /gift and enter the gift code.",
  },
  {
    icon: Gift,
    title: "Step 2: Choose your amount.",
    body: "Pick from suggested amounts or enter your own. The minimum is shown before checkout, and every gift is transparent before anyone pays.",
  },
  {
    icon: TrendingUp,
    title: "Step 3: See where your gift goes.",
    body: "Before you pay, Kiddo shows you the family's default. Most gifts simply follow that default. If the parent allows it, you can choose a different stock or send the gift to cash instead.",
  },
  {
    icon: QrCode,
    title: "Step 4: Pay.",
    body: "Apple Pay. Google Pay. Card. One tap if you have Apple Pay or Google Pay set up. Done.",
  },
  {
    icon: Gift,
    title: "Step 5: Your gift is invested.",
    body: "The parent is notified. You get a confirmation. The gift becomes part of the child's fund and Memory Book.",
  },
];

const occasions = [
  {
    title: "Baby showers",
    body: "Set up your fund before the shower. Share the link on the invitation. Guests gift instead of buying something that will be outgrown in three months.",
  },
  {
    title: "Birthdays",
    body: "Create a birthday event page. Share the link in the family group chat. Every gift goes straight to the fund.",
  },
  {
    title: "Holidays",
    body: "Share your fund link at Thanksgiving. By Christmas, the family knows exactly what to give.",
  },
  {
    title: "Graduations",
    body: "A graduation fund is a gift that actually matches the milestone.",
  },
  {
    title: "Any occasion",
    body: "There is no wrong time to invest in a child's future.",
  },
];

export default function HowItWorks() {
  return (
    <div className="kiddo-app-page">
      <Nav />

      <section className="relative overflow-hidden pb-16 pt-20 md:pb-24 md:pt-32">
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Mascot size="md" variant="planting" className="mx-auto mb-5 drop-shadow-sm" context="how-it-works" />
            <h1 className="mb-4 font-heading text-4xl font-bold tracking-normal text-foreground md:text-6xl" data-testid="text-how-headline">
              Here is exactly how it works.
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              For parents. For gifters. For grandparents who have never bought a stock in their life.
            </p>
            <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card/80 p-4 text-left shadow-premium-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">1. Create</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Set up the fund and choose the investing approach.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/80 p-4 text-left shadow-premium-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">2. Share</p>
                <p className="mt-2 text-sm font-semibold text-foreground">One link, one QR code, one fund code.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/80 p-4 text-left shadow-premium-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">3. Invest</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Gifts land in a real account and get invested.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <FadeIn className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-normal text-foreground md:text-5xl">
              Setting up your child&apos;s fund.
            </h2>
          </FadeIn>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {parentSteps.map((step, index) => (
              <FadeIn key={step.title} delay={index * 0.06}>
                <div className="h-full rounded-2xl bg-card p-7 shadow-premium-sm">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn className="mt-10 text-center">
            {/* Not "nothing to manage" — the parent picks the mix, completes
                KYC, decides on cash. The thing that's genuinely hands-off is
                gift arrival. Say that. 2026-06-03. */}
            <p className="mx-auto max-w-2xl text-muted-foreground">
              That is it. Gifts arrive and land on their own from there.
            </p>
            <div className="mt-6">
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base" data-testid="button-how-parent-cta">
                  Start your child&apos;s fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Free. Takes 2 minutes.</p>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <FadeIn className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-normal text-foreground md:text-5xl">
              Giving is even simpler.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-muted-foreground">
              You do not need a Kiddo account. You do not need to download an app. You do not need to know anything about investing.
            </p>
          </FadeIn>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {giverSteps.map((step, index) => (
              <FadeIn key={step.title} delay={index * 0.06}>
                <div className="h-full rounded-2xl bg-card p-7 shadow-premium-sm">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn className="mt-10 text-center">
            <p className="text-muted-foreground">No account to open, nothing to download. Just a gift that actually grows.</p>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <h2 className="mb-4 font-heading text-3xl font-bold tracking-normal text-foreground md:text-4xl">
                  What actually happens to the money.
                </h2>
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  When a gift is received, Kiddo follows the family's chosen default. For most funds that means a diversified managed mix. Some families set one default stock. Others keep gifts in cash until they invest later.
                </p>
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  If a gift amount is smaller than the price of one full share, Kiddo purchases a fractional share when the gift is invested into a stock or ETF. A $25 gift can still buy a fraction of one share. Over time, those fractions add up.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  Every investment is held in your child&apos;s fund. Most child funds use a UTMA legal structure underneath, which means you manage it until your child reaches adulthood, typically 18 or 21 depending on your state. Then it becomes fully theirs.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-6">
                <p className="mb-2 text-sm font-medium text-foreground">Gift flow</p>
                <p className="text-sm leading-relaxed text-muted-foreground">Gift amount received</p>
                <p className="text-sm leading-relaxed text-muted-foreground">Family default applied</p>
                <p className="text-sm leading-relaxed text-muted-foreground">Stock, managed mix, or cash path used</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Simple for families. Real brokerage rails when investing is live.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <BookOpen className="h-3.5 w-3.5" />
                  For children
                </div>
                <h2 className="mb-4 font-heading text-3xl font-bold tracking-normal text-foreground md:text-4xl">
                  The part that changes everything.
                </h2>
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  When a child is old enough, Kiddo gives them an age-appropriate view of their fund. They see the brands they own, the people who gifted them, and the story being built in their name.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  The education does not live in a separate classroom tab. It happens inside the fund itself, through the companies they already know and the gifts their family already gave.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-6">
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p><span className="font-medium text-foreground">Ages 5 to 8:</span> brand logos, simple ownership language, and the idea that money can grow.</p>
                  <p><span className="font-medium text-foreground">Ages 9 to 13:</span> why companies move, what fractional shares mean, and what a gift could grow into.</p>
                  <p><span className="font-medium text-foreground">Ages 14 to 17:</span> portfolio understanding, stock suggestions, and real money conversations before adulthood.</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
            <h2 className="mb-4 font-heading text-3xl font-bold tracking-normal text-foreground md:text-4xl">
              The part nobody expects.
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Every gift that comes into your child&apos;s fund gets captured in the Memory Book. The amount. The stock it was invested in. The note the gifter left. The occasion.
            </p>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              When your child is old enough to understand it, you can show them: here is every person who believed in your future. Here is what they gave. Here is what it grew into.
            </p>
            <p className="font-medium text-foreground">It is not a ledger. It is a story.</p>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <h2 className="mb-4 font-heading text-3xl font-bold tracking-normal text-foreground md:text-4xl">
                  The age-18 moment.
                </h2>
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  When your child reaches the age of majority for your state, the fund legally becomes
                  theirs. In most states that is age 18 or 21. The investments do not automatically get
                  sold just because that birthday arrives.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  What changes is control. Kiddo helps prepare that handoff so your child can inherit the
                  account and the full story behind it, not just a balance.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-6">
                <p className="mb-2 text-sm font-medium text-foreground">What carries forward</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>The investments stay where they are.</p>
                  <p>The parent stops acting as custodian.</p>
                  <p>The child gains full legal control at the required age.</p>
                  <p>The Memory Book becomes part of that transition story.</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <FadeIn className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-normal text-foreground md:text-5xl">
              Kiddo works for every occasion.
            </h2>
          </FadeIn>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
            {occasions.map((occasion, index) => (
              <FadeIn key={occasion.title} delay={index * 0.05}>
                <div className="h-full rounded-2xl bg-card p-6 shadow-premium-sm">
                  <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">{occasion.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{occasion.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <FadeIn>
            <h2 className="mb-4 font-heading text-3xl font-bold tracking-normal text-foreground md:text-5xl">
              Ready to start?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
              Your child&apos;s fund takes 2 minutes to set up. Free to start. Your family and friends can begin gifting today.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base" data-testid="button-how-cta-primary">
                  Start your child&apos;s fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Questions? <Link href="/faq" className="text-primary hover:underline">Read our FAQ</Link>
            </p>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
