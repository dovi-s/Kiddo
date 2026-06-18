import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, Check, Gift, Shield, Sprout, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { JsonLd } from "@/components/JsonLd";
import { LockedRefusalsPanel } from "@/components/LockedRefusalsPanel";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { EmbeddedDemo } from "@/components/marketing/EmbeddedDemo";
import { haptic } from "@/lib/haptics";

const SECTION_MAX = "mx-auto max-w-6xl px-4";

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

const proofPillars = [
  {
    icon: Gift,
    title: "A better gift",
    body: "Family and friends can send something meaningful in seconds, without opening a brokerage account or learning how any of this works.",
  },
  {
    icon: TrendingUp,
    title: "A real fund",
    body: "The money is meant to grow, not sit flat. Parents open a custodial fund in the child's name and choose what it invests in over time.",
  },
  {
    icon: BookOpen,
    title: "A permanent record",
    body: "Every gift can carry a note, photo, or voice message, so the child inherits the money and a record of who showed up.",
  },
] as const;

const steps = [
  {
    icon: Users,
    title: "Start the fund",
    body: "Create a custodial fund for your child, choose the investing path, and get a private link to share.",
  },
  {
    icon: Gift,
    title: "Let people gift",
    body: "Send the link by text, email, or invitation. Gifters can check out in a few taps with no account required.",
  },
  {
    icon: Sprout,
    title: "Let it become a story",
    body: "The fund grows over time, the Memory Book fills up, and the child gradually sees what was built for them.",
  },
] as const;

const trustBullets = [
  "Each fund is a custodial UTMA account opened in the child's name.",
  "When investing is live, eligible securities are held with our broker-dealer partner, Member FINRA/SIPC, which protects against broker-dealer failure, not market losses.",
  "Free to start. 10¢ per $100 invested per year, or $1 a year per $1,000. No platform fee on gifts.",
  "Private fund links are not public or searchable.",
  "Fees are shown before checkout, not discovered later.",
  "Available to US families today.",
] as const;

const promiseBullets = [
  "Free to start",
  "No account needed for gifting",
  "Built for families, not traders",
] as const;

export default function Home() {
  const reduceMotion = useReducedMotion();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  const [referredVisit, setReferredVisit] = useState(false);

  const orgJsonLd = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: "Kiddo",
          description: "Kiddo turns family gifts into a real investment fund a child opens when they reach adulthood.",
          ...(origin ? { url: origin, logo: `${origin}/icon-512.png` } : {}),
        },
        { "@type": "WebSite", name: "Kiddo", ...(origin ? { url: origin } : {}) },
      ],
    };
  }, []);

  const isDemo = Boolean((user as any)?.isDemoAccount);

  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref") || "";
      if (!ref.startsWith("pf-")) return;
      setReferredVisit(true);
      window.localStorage.setItem("kiddo.parentRef", ref);
      const sentKey = `kiddo.parentRefVisitSent:${ref}`;
      if (!window.sessionStorage.getItem(sentKey)) {
        window.sessionStorage.setItem(sentKey, "1");
        void fetch("/api/referral-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refCode: ref, action: "parent_referral_visit", channel: "web" }),
        });
      }
    } catch {
      // Warmth and attribution only; never block the page.
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isDemo) {
      if (fundsLoading) return;
      const search = typeof window !== "undefined" ? window.location.search : "";
      const destination = funds.length >= 2 ? "/funds" : "/dashboard";
      setLocation(`${destination}${search || ""}`);
    }
  }, [funds.length, fundsLoading, isAuthenticated, isDemo, isLoading, setLocation]);

  if (isAuthenticated && !isDemo) return null;

  return (
    <div className="kiddo-app-page">
      <JsonLd data={orgJsonLd} id="org-jsonld" />
      <Nav />
      <main className="overflow-x-hidden">
        <section className="relative overflow-hidden pb-14 pt-20 md:pb-20 md:pt-28">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,hsl(var(--kiddo-gold)/0.18),transparent_58%)]" />
          <div aria-hidden className="absolute right-[-8rem] top-28 h-64 w-64 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] blur-3xl" />
          <div aria-hidden className="absolute left-[-6rem] top-12 h-56 w-56 rounded-full bg-[hsl(var(--kiddo-gold)/0.14)] blur-3xl" />
          <div className={`${SECTION_MAX} relative z-10`}>
            <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
              <motion.div
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 22 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                {referredVisit ? (
                  <p className="mb-5 inline-flex rounded-full border border-[hsl(var(--kiddo-evergreen)/0.2)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-4 py-1.5 text-xs font-medium text-[hsl(var(--kiddo-evergreen))]">
                    A parent you know passed this along. You can look around or{" "}
                    <Link href="/demo" className="font-semibold underline underline-offset-2">
                      see a real fund in action
                    </Link>
                    .
                  </p>
                ) : null}

                <Mascot size="lg" variant="planting" className="mb-5 drop-shadow-sm" context="home-hero" />

                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">
                  For the child and the people who love them
                </p>
                <h1 className="max-w-3xl font-heading text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
                  The investment account they inherit at 18, with the story of who built it.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                  Kiddo turns birthday money, holiday gifts, and recurring gifts into a real custodial fund, while saving the notes,
                  photos, and voice messages that came with them.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Link href="/get-started">
                    <Button size="lg" className="h-14 px-8 text-base" data-testid="button-hero-get-started" onClick={() => haptic("medium")}>
                      Start your child's fund
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/demo">
                    <Button variant="outline" size="lg" className="h-14 px-8 text-base" data-testid="button-hero-demo">
                      See a real fund
                    </Button>
                  </Link>
                </div>

                <div className="mt-7 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {promiseBullets.map((item) => (
                    <span key={item} className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3.5 py-2 shadow-premium-sm">
                      <Check className="h-3.5 w-3.5 text-[hsl(var(--kiddo-evergreen))]" />
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>

              <FadeIn delay={0.12}>
                <BrowserFrame
                  src="/product/dashboard-desktop.webp"
                  alt="The Kiddo dashboard on the web: fund balance, gifts, growth, and the family behind it."
                  href="/demo"
                  liveLabel="See a real fund"
                  caption="A family home for the fund, the gifts behind it, and where it is headed."
                />
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="pb-8">
          <div className={SECTION_MAX}>
            <TrustMicroStrip />
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">What Kiddo is</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                It solves the money problem and the meaning problem at the same time.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                It gives the child real money to grow and the story of where it came from.
              </p>
            </FadeIn>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {proofPillars.map((item, index) => (
                <FadeIn key={item.title} delay={index * 0.08}>
                  <div className="h-full rounded-[1.75rem] border border-border/60 bg-card/90 p-7 shadow-premium-sm">
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.08)]">
                      <item.icon className="h-5 w-5 text-[hsl(var(--kiddo-evergreen))]" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Flagship moments</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                Four moments families remember.
              </h2>
            </FadeIn>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              <FadeIn>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm">
                  <div className="mb-8 max-w-xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">1. The gift</p>
                    <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground md:text-3xl">
                      Anyone in the family can send a lasting gift in a few taps.
                    </h3>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                      There is no app to download and no account to open, and you do not need to know anything about investing.
                    </p>
                  </div>
                  <EmbeddedDemo
                    src="/theo-rivera"
                    poster="/product/giftflow.webp"
                    alt="A live Kiddo gift page where a family member picks an amount, leaves a note, and sends a gift."
                    caption="This is the real gifting surface."
                    tilt="right"
                  />
                </div>
              </FadeIn>

              <FadeIn delay={0.08}>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm">
                  <div className="mb-8 max-w-xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">2. The Memory Book</p>
                    <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground md:text-3xl">
                      Every gift can carry a note, photo, or voice memo that stays with the fund.
                    </h3>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                      The money matters, and the child also inherits the messages that came with it, in sequence, over years.
                    </p>
                  </div>
                  <ProductFrame
                    src="/product/memory-full.webp"
                    alt="The Kiddo Memory Book with gifts, notes, and milestones attached to the fund."
                    caption="The financial record and the family record, bound together."
                    mode="scroll"
                    imgHeight={3762}
                    tilt="left"
                  />
                </div>
              </FadeIn>

              <FadeIn delay={0.12}>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm">
                  <div className="mb-8 max-w-xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">3. The Kid View</p>
                    <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground md:text-3xl">
                      The child sees what they own in language that makes sense for their age.
                    </h3>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                      They grow up familiar with what they own, so it makes sense to them long before they turn 18.
                    </p>
                  </div>
                  <ProductFrame
                    src="/product/kidview.webp"
                    alt="The child's view of the fund, showing the companies they own and the people who helped build it."
                    caption="Understanding arrives gradually, not all at once."
                    tilt="right"
                  />
                </div>
              </FadeIn>

              <FadeIn delay={0.16}>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm">
                  <div className="mb-8 max-w-xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">4. The handoff</p>
                    <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground md:text-3xl">
                      At 18, they receive the account and the whole story of who built it.
                    </h3>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                      The transfer should feel like something their family handed down to them, not a cold paperwork event.
                    </p>
                  </div>
                  <ProductFrame
                    src="/product/age18.webp"
                    alt="The age-18 handoff view, showing the projected value, the transfer, and the family story behind it."
                    caption="What was built, what transfers, and who helped."
                    tilt="left"
                  />
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">How it works</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                Short enough to understand in seconds.
              </h2>
            </FadeIn>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((item, index) => (
                <FadeIn key={item.title} delay={index * 0.08}>
                  <div className="h-full rounded-[1.75rem] bg-[linear-gradient(180deg,hsl(var(--kiddo-cream)),white)] p-7 shadow-premium-sm ring-1 ring-black/5">
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-card">
                      <item.icon className="h-5 w-5 text-[hsl(var(--kiddo-evergreen))]" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className={SECTION_MAX}>
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <FadeIn>
                <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Trust architecture</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                    Built so families know exactly how their money is held.
                  </h2>
                  <div className="mt-6 space-y-4">
                    {trustBullets.map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                        <p className="leading-relaxed text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 flex flex-wrap gap-4 text-sm">
                    <Link href="/security" className="font-medium text-primary transition-colors hover:text-foreground">
                      Security details
                    </Link>
                    <Link href="/compare" className="font-medium text-primary transition-colors hover:text-foreground">
                      Compare options
                    </Link>
                    <Link href="/faq" className="font-medium text-primary transition-colors hover:text-foreground">
                      Read the FAQ
                    </Link>
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
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">The real payoff</p>
              <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                By the time they open it, it should feel like something their whole family built together.
              </h2>
              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/get-started">
                  <Button size="lg" className="h-14 px-10 text-base" data-testid="button-final-get-started" onClick={() => haptic("medium")}>
                    Start your child's fund
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button variant="outline" size="lg" className="h-14 px-10 text-base" data-testid="button-final-how-it-works">
                    See how it works
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
