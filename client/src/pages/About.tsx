import { Link } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Mascot } from "@/components/ui/mascot";
import { GeminiHeroGradient, GradientText } from "@/components/ui/gemini";
import { Button } from "@/components/ui/button";
import { Heart, TrendingUp, Shield, Users, ArrowRight, Sprout, Sparkles } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
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

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden gemini-warm-section">
        <GeminiHeroGradient />
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            <Mascot size="xl" className="mx-auto" context="about-hero" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="font-heading text-4xl md:text-6xl font-bold text-foreground tracking-tight mb-6"
            data-testid="text-about-headline"
          >
            Every gift is a <GradientText>seed</GradientText>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
            data-testid="text-about-subheading"
          >
            We started Kora because we believe the most meaningful gifts are the ones that keep growing long after the wrapping paper is gone.
          </motion.p>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <div className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4" data-testid="text-why-heading">
                    Why we built Kora
                  </h2>
                </div>
              </div>
              <div className="space-y-5 text-muted-foreground leading-relaxed">
                <p>
                  Think about the last birthday gift you gave a child. Maybe it was a toy, maybe it was cash in a card. Within a week, that toy is forgotten in a closet. That cash? Spent on something nobody remembers.
                </p>
                <p>
                  Now imagine if that same $50 was planted like a seed. Over 18 years, at the stock market's historical average, it could grow into nearly $200. A gift that literally grows with them.
                </p>
                <p>
                  That's the idea behind Kora. We make it ridiculously easy to give stock investments as gifts. No brokerage account needed for the giver. No confusing forms. Just tap a link, pick an amount, and you've given a gift that compounds over time.
                </p>
                <p>
                  We built Kora for parents who want something better than another toy. For grandparents who want their love to compound. For friends at baby showers who want to give something truly lasting.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28 gemini-warm-section">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn className="text-center mb-16">
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight" data-testid="text-values-heading">
              What we <GradientText>believe</GradientText>
            </h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Sprout,
                title: "Small gifts matter",
                desc: "A $25 gift is meaningful. We celebrate every contribution because time is the real multiplier, not the dollar amount.",
              },
              {
                icon: Users,
                title: "Gifting should be effortless",
                desc: "Gift-givers should never need to create an account, download an app, or fill out paperwork. Tap a link, pick an amount, done.",
              },
              {
                icon: Sparkles,
                title: "Money talk shouldn't be scary",
                desc: "We use plain language, not Wall Street jargon. A UTMA is 'an account you manage for your child.' Auto-invest means 'we handle it for you.'",
              },
              {
                icon: Shield,
                title: "Trust is earned, not assumed",
                desc: "Real regulated accounts. SIPC protection up to $500,000. Transparent fees shown before every transaction. Your money is held at a clearing firm, never by us.",
              },
              {
                icon: Heart,
                title: "Gifts carry emotions",
                desc: "Every gift comes with a message that's saved in the Memory Book forever. Years from now, your child can read what Grandma wrote on their first birthday.",
              },
              {
                icon: TrendingUp,
                title: "Time is the secret ingredient",
                desc: "Compound growth turns small gifts into something remarkable. We help families think in decades, not days.",
              },
            ].map((value, i) => (
              <FadeIn key={value.title} delay={i * 0.08}>
                <div className="bg-card rounded-2xl shadow-premium-sm p-6 h-full" data-testid={`card-value-${i}`}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <value.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{value.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <div className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6 text-center" data-testid="text-how-safe-heading">
                How we keep your money <GradientText>safe</GradientText>
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--kora-evergreen))]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">We never hold your money</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">Your investments are held at a FINRA-registered clearing firm, completely separate from Kora. Even if something happened to us, your assets are safe.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--kora-evergreen))]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">SIPC protection up to $500,000</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">The Securities Investor Protection Corporation covers your account. It's like FDIC for investments.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--kora-evergreen))]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Bank-level encryption</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">256-bit SSL encryption on every transaction. The same security standard used by major banks worldwide.</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 md:py-28 gemini-warm-section">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FadeIn>
            <Mascot size="lg" className="mx-auto mb-6" context="about-cta" />
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight mb-4" data-testid="text-cta-heading">
              Ready to give something that <GradientText>grows</GradientText>?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Set up a fund in under 2 minutes. No credit card required.
            </p>
            <Link href="/get-started">
              <Button size="lg" className="h-14 px-10 text-base" data-testid="button-about-cta">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
