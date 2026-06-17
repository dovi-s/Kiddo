import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Shield, BookOpen, Eye, Gift } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { GeminiHeroGradient, GradientText } from "@/components/ui/gemini";
import { Button } from "@/components/ui/button";
import { FounderMedia } from "@/components/ui/founder-media";

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

      {/* Hero */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden gemini-warm-section">
        <GeminiHeroGradient />
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-heading text-4xl md:text-6xl font-bold text-foreground tracking-tight leading-tight" data-testid="text-about-headline">
              Most birthday gifts are forgotten by <GradientText>Tuesday</GradientText>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              The check gets lost, the savings bond sits in a drawer for a decade, and the toy breaks in a week.
            </p>
            <p className="mt-4 text-lg md:text-xl font-semibold text-foreground">
              A gift through Kiddo is built to last and grow with them.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What Kiddo does */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12 space-y-5">
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Family and friends gift money in a few seconds. No account needed, no app to download. Just a link, a stock pick, and a note.
            </p>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              That gift goes into your child's UTMA fund and, once investing is live, is invested in real stocks.{" "}
              <span className="font-semibold text-foreground">Disney. Apple. Nike.</span>{" "}
              Whatever feels meaningful to them.
            </p>
            <p className="text-base md:text-lg font-semibold text-foreground">And it keeps growing.</p>
          </FadeIn>
          <BrowserFrame
            src="/product/dashboard-desktop.webp"
            alt="The Kiddo dashboard: the fund, the gifts, who built it, and what it's on track to be worth, on any device."
            caption="The real thing, on phone or web."
            href="/demo"
            liveLabel="See it live"
            className="mt-12"
          />
        </div>
      </section>

      {/* Memory Book */}
      <section className="py-20 md:py-28 gemini-warm-section">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Memory Book</p>
                <h2 className="mt-2 font-heading text-2xl md:text-3xl font-bold text-foreground leading-tight">
                  A record of every gift, note, and person who showed up.
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>Every gift, every note, every person who showed up for your kid gets captured in the Memory Book.</p>
              <p>A living record of everyone who believed in them before they even knew what a stock was.</p>
              <p className="font-medium text-foreground">
                It is the most differentiated feature in Kiddo. Every gift and note is kept with the account, as a story they can read.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Kid View */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Kid View</p>
                <h2 className="mt-2 font-heading text-2xl md:text-3xl font-bold text-foreground leading-tight">
                  They watch it grow, in shares they actually own.
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                The Kid View lets them see their fund: the companies it follows and the gifts that built it. Once investing is live, they learn how money grows by watching their own fund grow.
              </p>
              <p>
                A 10-year-old opens the app and sees the Disney stock their family picked for them. Once investing is live, they own a real piece of it. Someone in their family put it there.
              </p>
              <p className="font-medium text-foreground">That moment changes how they think about money for good.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Age-18 handoff */}
      <section className="py-20 md:py-28 gemini-warm-section">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">The moment it all comes together</p>
                <h2 className="mt-2 font-heading text-2xl md:text-3xl font-bold text-foreground leading-tight">
                  When the fund becomes theirs, they get the money and the whole story behind it.
                </h2>
              </div>
            </div>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Every gift, note, stock pick, and person who believed in them, delivered at the moment it matters most.
              </p>
              <p>
                They inherit a record of everyone who showed up for them, starting from before they could even say thank you, alongside the balance itself.
              </p>
              <p className="font-heading text-xl font-semibold text-foreground">That is what Kiddo hands them.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Trust / Security */}
      <section className="py-20 md:py-28" id="trust">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">Your child's money is not sitting with us.</h2>
            <div className="space-y-6">
              {[
                "When investing is live, investments are held through our broker-dealer partner (Member FINRA/SIPC), not by Kiddo.",
                "Once your account is open, eligible securities carry SIPC protection up to $500,000 (broker-dealer failure, not market loss).",
                "If Kiddo disappeared tomorrow, the underlying assets would not disappear with it.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 md:py-28 gemini-warm-section">
        <div className="max-w-5xl mx-auto px-4">
          <FadeIn className="text-center mb-14">
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight">The people behind Kiddo</h2>
          </FadeIn>
          <FadeIn>
            <FounderMedia />
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FadeIn>
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
              Start your child's fund today.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              Free to start. Takes about 2 minutes. Your family and friends can begin gifting right away.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base" data-testid="button-about-cta">
                  Start your child's fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/faq">
                <Button variant="outline" size="lg" className="h-14 px-10 text-base" data-testid="button-about-faq">
                  Read the FAQ
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
