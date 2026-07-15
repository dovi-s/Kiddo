import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Gift, QrCode, Shield, Sprout, TrendingUp, UserRoundPlus } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { EmbeddedDemo } from "@/components/marketing/EmbeddedDemo";

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

const parentFlow = [
  {
    icon: UserRoundPlus,
    title: "Open the fund",
    body: "Create the account, add your child, and establish the custodial structure that will eventually become theirs.",
  },
  {
    icon: TrendingUp,
    title: "Choose the default path",
    body: "Decide how new gifts should land: a managed mix, a default stock, or cash until you invest later.",
  },
  {
    icon: QrCode,
    title: "Share one private link",
    body: "Kiddo gives you a private gift link, QR code, and fund code you can send anywhere you would share an invitation or registry.",
  },
] as const;

const gifterFlow = [
  {
    icon: Gift,
    title: "Open the gift page",
    body: "The gifter taps the link, scans the QR code, or enters the fund code. No account required.",
  },
  {
    icon: Sprout,
    title: "Choose an amount",
    body: "They choose an amount, optionally leave a note or voice message, and complete checkout in a few taps.",
  },
  {
    icon: BookOpen,
    title: "Join the child's story",
    body: "The gift becomes part of the fund and the Memory Book, so the child can one day see who helped build it.",
  },
] as const;

const kidViewStages = [
  "Ages 5 to 8: simple ownership language, familiar brands, and the idea that money can grow.",
  "Ages 9 to 13: fractional shares, why companies move, and how gifts are meant to grow over time.",
  "Ages 14 to 17: portfolio understanding, stock suggestions, and real family conversations before adulthood.",
] as const;

const payoffBullets = [
  "The investments do not automatically get sold at the age-of-majority handoff.",
  "At the handoff the legal control passes to the child while the fund itself carries on.",
  "The Memory Book gives the transfer emotional context instead of making it feel abrupt.",
] as const;

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="kiddo-app-page">
      <Nav />
      <main className="overflow-x-hidden">
        <section className="relative overflow-hidden pb-16 pt-20 md:pb-24 md:pt-28">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,hsl(var(--kiddo-gold)/0.16),transparent_58%)]" />
          <div className="relative z-10 mx-auto max-w-6xl px-4">
            <div className="grid items-center gap-14 lg:grid-cols-[0.96fr_1.04fr]">
              <motion.div
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 22 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <Mascot size="md" variant="planting" className="mb-5 drop-shadow-sm" context="how-it-works" />
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">How it works</p>
                <h1 className="font-heading text-4xl font-bold tracking-[-0.03em] text-foreground md:text-6xl" data-testid="text-how-headline">
                  How Kiddo works, from the first gift to the handoff.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                  Kiddo is designed so a parent can set up the structure once, a family member can gift without friction, and the child can grow up
                  understanding what was built for them.
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Link href="/get-started">
                    <Button size="lg" className="h-14 px-8 text-base" data-testid="button-how-hero-primary">
                      Start your child's fund
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/demo">
                    <Button variant="outline" size="lg" className="h-14 px-8 text-base">
                      See a real fund
                    </Button>
                  </Link>
                </div>
              </motion.div>

              <FadeIn delay={0.12}>
                <BrowserFrame
                  src="/product/dashboard-desktop.webp"
                  alt="The Kiddo dashboard showing the fund balance, gifts, and family story."
                  caption="One home for the money, the milestones, and the people behind them."
                  href="/demo"
                  liveLabel="See a real fund"
                />
              </FadeIn>
            </div>
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
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">The parent flow</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                The parent makes a few key decisions.
              </h2>
            </FadeIn>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {parentFlow.map((step, index) => (
                <FadeIn key={step.title} delay={index * 0.08}>
                  <div className="h-full rounded-[1.75rem] border border-border/60 bg-card/90 p-7 shadow-premium-sm">
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.08)]">
                      <step.icon className="h-5 w-5 text-[hsl(var(--kiddo-evergreen))]" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
              <FadeIn>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">The gifter flow</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    Giving feels like sending a gift.
                  </h2>
                  <div className="mt-8 space-y-6">
                    {gifterFlow.map((step) => (
                      <div key={step.title} className="flex gap-4">
                        <div className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.08)]">
                          <step.icon className="h-4 w-4 text-[hsl(var(--kiddo-evergreen))]" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                          <p className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.08}>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm">
                  <EmbeddedDemo
                    src="/theo-rivera"
                    poster="/product/giftflow.webp"
                    alt="The live Kiddo gift page, where a gifter picks an amount and leaves a message."
                    caption="The real gifting surface."
                    tilt="right"
                  />
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <section id="mix" className="scroll-mt-24 py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <FadeIn className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
              <div className="grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">What happens to the money</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    Each new gift follows the family's chosen path.
                  </h2>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    For most families that means a diversified managed mix. Some choose a default stock. Others hold gifts in cash until they decide how to
                    invest later.
                  </p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    If the gift is smaller than the cost of a full share, Kiddo can still buy a fractional share when that gift is invested into a stock or ETF.
                    Small gifts can still become real ownership.
                  </p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    The legal structure underneath is typically UTMA, which means the parent manages the fund until the child reaches the age of majority in
                    their state.
                  </p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    Gifts land in a real account and are invested when investing is live.
                  </p>
                </div>
                <ProductFrame
                  src="/product/dashboard-full.webp"
                  alt="The parent's dashboard showing gifts, holdings, and the projection for the child's fund."
                  caption="The real gifting and fund experience."
                  mode="scroll"
                  imgHeight={3154}
                  tilt="right"
                />
              </div>
            </FadeIn>
          </div>
        </section>

        <section id="kid-view" className="scroll-mt-24 py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
              <FadeIn>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Kid View</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    The child grows into the product over time.
                  </h2>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    Kiddo helps a child get comfortable with ownership long before adulthood arrives.
                  </p>
                  <div className="mt-8 space-y-4 rounded-[1.5rem] border border-border/60 bg-[hsl(var(--kiddo-cream))] p-6">
                    {kidViewStages.map((stage) => (
                      <div key={stage} className="flex gap-3">
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                        <p className="leading-relaxed text-muted-foreground">{stage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.08}>
                <ProductFrame
                  src="/product/kidview.webp"
                  alt="The child's view of their Kiddo fund with familiar brands and family gifts."
                  caption="The child's own view of their fund, grown into over the years."
                  tilt="left"
                />
              </FadeIn>
            </div>
          </div>
        </section>

        <section id="memory" className="scroll-mt-24 py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr]">
              <FadeIn>
                <ProductFrame
                  src="/product/memory-full.webp"
                  alt="The Kiddo Memory Book with gifts, notes, and milestones."
                  caption="The record of what they received, and from whom."
                  mode="scroll"
                  imgHeight={3762}
                  tilt="right"
                />
              </FadeIn>

              <FadeIn delay={0.08}>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Memory Book</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    Every gift can stay attached to the moment it came from.
                  </h2>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    The amount, the occasion, the note, the photo, the voice memo, and what the gift eventually became all live together. The child inherits a
                    real family record they can read through.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <FadeIn className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">The age-18 handoff</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    The transfer should feel like something the family saw coming.
                  </h2>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    At the age of majority, the fund legally becomes the child's. Kiddo's job is to make that moment understandable and emotionally grounded.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/60 bg-[hsl(var(--kiddo-cream))] p-6">
                  <div className="space-y-4">
                    {payoffBullets.map((item) => (
                      <div key={item} className="flex gap-3">
                        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                        <p className="leading-relaxed text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <FadeIn>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Start here</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                Set it up once, and it keeps building as the years go by.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Free to start. Takes a couple of minutes. The family can start adding to the fund right away.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/get-started">
                  <Button size="lg" className="h-14 px-10 text-base" data-testid="button-how-cta-primary">
                    Start your child's fund
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/faq">
                  <Button variant="outline" size="lg" className="h-14 px-10 text-base">
                    Read the FAQ
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
