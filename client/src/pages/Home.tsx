import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Gift, TrendingUp, Shield, Lock, Users, ArrowRight, Check, Star, Zap, Calculator, MousePointerClick, Share2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { GeminiHeroGradient, GradientText } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import { ThinkingOrb } from "@/components/ui/gemini";
import { Mascot } from "@/components/ui/mascot";
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

function GrowthCalculator() {
  const presetAmounts = [25, 50, 100, 250];
  const yearOptions = [5, 10, 15, 18];
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [years, setYears] = useState(10);
  const [isCustom, setIsCustom] = useState(false);

  const result = Math.round(amount * Math.pow(1.10, years));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-10 max-w-2xl mx-auto"
    >
      <div className="space-y-8">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-3 block">Gift amount</label>
          <div className="flex flex-wrap gap-2">
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => { setAmount(preset); setIsCustom(false); setCustomAmount(""); haptic('light'); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  amount === preset && !isCustom
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
                data-testid={`button-preset-amount-${preset}`}
              >
                ${preset}
              </button>
            ))}
            <input
              type="number"
              placeholder="Custom"
              value={customAmount}
              onChange={(e) => {
                const val = e.target.value;
                setCustomAmount(val);
                const num = parseInt(val);
                if (num > 0) {
                  setAmount(num);
                  setIsCustom(true);
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-muted text-foreground w-28 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-custom-amount"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-3 block">Years to grow</label>
          <div className="flex flex-wrap gap-2">
            {yearOptions.map((y) => (
              <button
                key={y}
                onClick={() => { setYears(y); haptic('light'); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  years === y
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
                data-testid={`button-years-${y}`}
              >
                {y} years
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-border/50">
          <motion.p
            key={`${amount}-${years}`}
            initial={{ opacity: 0.5, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg md:text-xl text-foreground"
            data-testid="text-growth-result"
          >
            A <span className="font-semibold">${amount.toLocaleString()}</span> gift today could grow to{" "}
            <span className="font-heading font-bold text-2xl md:text-3xl text-primary">${result.toLocaleString()}</span>{" "}
            in {years} years
          </motion.p>
          <p className="text-xs text-muted-foreground mt-3" data-testid="text-growth-disclaimer">
            Based on the S&P 500's historical average of ~10% per year. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <ThinkingOrb size={48} variant="default" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 md:pt-32 md:pb-40 overflow-hidden gemini-warm-section">
        <GeminiHeroGradient />
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6"
            >
              <Mascot size="lg" className="mx-auto drop-shadow-lg" context="home-hero" />
            </motion.div>
            <h1 className="font-heading text-4xl md:text-6xl font-bold leading-tight text-foreground tracking-tight mb-6" data-testid="text-hero-headline">
              Give something that grows with them
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10"
              data-testid="text-hero-subheading"
            >
              Transform birthday money, holiday gifts, and baby shower contributions into real investments that compound over time.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base w-full sm:w-52" data-testid="button-start-fund" onClick={() => haptic('medium')}>
                  Start a fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-10 text-base w-full sm:w-52"
                data-testid="button-how-it-works"
                onClick={() => {
                  haptic('light');
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                How it works
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-12"
            >
              {[
                { icon: Shield, text: "SIPC protected" },
                { icon: Users, text: "No account needed for givers" },
                { icon: Zap, text: "Under 2 minutes to set up" },
              ].map((badge) => (
                <div key={badge.text} className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`badge-${badge.text.toLowerCase().replace(/\s+/g, "-")}`}>
                  <badge.icon className="h-4 w-4 text-primary" />
                  <span>{badge.text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Growth Calculator */}
      <section className="py-20 md:py-32" id="calculator">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight" data-testid="text-calculator-heading">
              See how gifts <GradientText>grow</GradientText>
            </h2>
          </FadeIn>
          <GrowthCalculator />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32 gemini-warm-section" id="how-it-works">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn className="text-center mb-16">
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight" data-testid="text-how-heading">
              How it <GradientText>works</GradientText>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Simple for parents. Even simpler for gift-givers.
            </p>
          </FadeIn>

          <div className="max-w-5xl mx-auto space-y-16">
            <div>
              <FadeIn className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-heading text-xl md:text-2xl font-semibold text-foreground" data-testid="text-parents-heading">For Parents</h3>
              </FadeIn>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { icon: Gift, title: "Create a Fund", desc: "Set up an investment fund for your child in under two minutes. No SSN needed upfront." },
                  { icon: Share2, title: "Share the Link", desc: "Send it to family and friends, or display a QR code at your event." },
                  { icon: TrendingUp, title: "Gifts Invest Automatically", desc: "Every contribution buys real investments. Watch it grow over time." },
                ].map((item, i) => (
                  <FadeIn key={item.title} delay={i * 0.12}>
                    <motion.div
                      className="bg-card rounded-2xl shadow-premium-sm p-7 h-full"
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                      data-testid={`card-parent-step-${i + 1}`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <item.icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold text-primary">Step {i + 1}</span>
                      </div>
                      <h4 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h4>
                      <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
                    </motion.div>
                  </FadeIn>
                ))}
              </div>
            </div>

            <div>
              <FadeIn className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Gift className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-heading text-xl md:text-2xl font-semibold text-foreground" data-testid="text-givers-heading">For Gift-Givers</h3>
              </FadeIn>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { icon: MousePointerClick, title: "Tap the Link", desc: "Open the link you received. No account or app download needed." },
                  { icon: Gift, title: "Pick an Amount", desc: "Choose how much to give. Pay with Apple Pay, Google Pay, card, or bank transfer." },
                  { icon: CheckCircle2, title: "Done in 60 Seconds", desc: "That's it. Your gift is on its way to becoming a real investment." },
                ].map((item, i) => (
                  <FadeIn key={item.title} delay={i * 0.12}>
                    <motion.div
                      className="bg-card rounded-2xl shadow-premium-sm p-7 h-full"
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                      data-testid={`card-giver-step-${i + 1}`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <item.icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold text-primary">Step {i + 1}</span>
                      </div>
                      <h4 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h4>
                      <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
                    </motion.div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 md:py-32" id="trust">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn className="text-center mb-16">
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight" data-testid="text-trust-heading">
              Your money, properly <GradientText>protected</GradientText>
            </h2>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: Shield,
                title: "SIPC insured up to $500K",
                desc: "Your investments are protected by the Securities Investor Protection Corporation.",
              },
              {
                icon: Check,
                title: "DriveWealth clearing",
                desc: "All trades are executed through DriveWealth, LLC, a FINRA-registered broker-dealer with fractional share support.",
              },
              {
                icon: Lock,
                title: "Bank-level encryption",
                desc: "256-bit encryption protects your data. The same level of security used by major banks.",
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <motion.div
                  className="bg-card rounded-2xl shadow-premium-sm p-8 text-center h-full"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  data-testid={`card-trust-${i}`}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.3} className="text-center mt-8">
            <p className="text-xs text-muted-foreground" data-testid="text-clearing-partner">
              Assets held at DriveWealth, LLC, Member FINRA/SIPC.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Why Kora Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn className="text-center mb-16">
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight" data-testid="text-why-heading">
              More than a <GradientText>brokerage account</GradientText>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              You could open a UTMA at any brokerage. Here's what you'd be missing.
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: Gift,
                title: "One-link gifting",
                desc: "Grandma doesn't need to download an app or create an account. She just opens a link, picks an amount, and pays with Apple Pay. Done in 60 seconds.",
              },
              {
                icon: Zap,
                title: "Auto-invest every gift",
                desc: "No collecting checks, depositing cash, or placing trades yourself. Every gift automatically buys real investments at the next trading window.",
              },
              {
                icon: Star,
                title: "Memory Book",
                desc: "Every gift comes with a personal message. Photos, milestones, and notes are saved in a timeline your child will treasure when they grow up.",
              },
              {
                icon: Users,
                title: "Event pages",
                desc: "Create a page for birthdays, baby showers, or holidays. Share a link or QR code. Guests gift investments instead of another toy they'll outgrow.",
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <motion.div
                  className="bg-card rounded-2xl shadow-premium-sm p-7 flex gap-5 h-full"
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  data-testid={`card-why-${i}`}
                >
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 md:py-32 gemini-warm-section" id="pricing">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn className="text-center mb-16">
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight" data-testid="text-pricing-heading">
              Simple, transparent <GradientText>pricing</GradientText>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Plans that grow with your family. Start free, upgrade when you're ready.
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                id: "free",
                name: "Free",
                price: "$0",
                period: "",
                tagline: "Perfect for getting started",
                features: [
                  "1 investment fund",
                  "1 event page",
                  "Apple Pay, Google Pay, card, or bank transfer",
                  "$2 platform fee per gift",
                  "Event Boost available ($29/event)",
                ],
                cta: "Get Started Free",
                featured: false,
              },
              {
                id: "starter",
                name: "Starter",
                price: "$5",
                period: "/mo per fund",
                tagline: "No fees on every gift",
                features: [
                  "No platform fee on gifts",
                  "2 event pages per fund",
                  "Memory Book included",
                  "Auto-invest for incoming gifts",
                  "Event Boost available ($29/event)",
                ],
                cta: "Start for $5/mo",
                featured: true,
              },
              {
                id: "family",
                name: "Family",
                price: "$12",
                period: "/mo",
                tagline: "Everything, unlimited",
                features: [
                  "No platform fee on gifts",
                  "Unlimited funds and event pages",
                  "Household dashboard for all kids",
                  "Recurring gift management",
                  "Priority support",
                ],
                cta: "Go Family",
                featured: false,
                badge: "$119/yr (save 17%)",
              },
            ].map((plan, i) => (
              <FadeIn key={plan.id} delay={i * 0.1}>
                <motion.div
                  className={`bg-card rounded-2xl shadow-premium-sm p-8 h-full flex flex-col relative ${
                    plan.featured ? "ring-2 ring-primary" : ""
                  }`}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  data-testid={`card-pricing-${plan.id}`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3" /> Most popular
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="font-heading text-xl font-semibold text-foreground mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-heading text-4xl font-bold text-foreground">{plan.price}</span>
                      {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                    </div>
                    {"badge" in plan && plan.badge && (
                      <p className="text-xs text-green-600 font-medium mt-2">{plan.badge}</p>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/get-started">
                    <Button
                      variant={plan.featured ? "default" : "outline"}
                      className="w-full"
                      data-testid={`button-pricing-${plan.id}`}
                      onClick={() => haptic('light')}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </motion.div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.4} className="mt-10 max-w-3xl mx-auto">
            <div className="bg-card rounded-2xl shadow-premium-sm p-6" data-testid="section-fee-details">
              <p className="text-sm font-semibold text-foreground mb-4 text-center">Complete fee breakdown</p>
              <div className="grid md:grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-foreground text-sm mb-1">Payment processing (Stripe)</p>
                    <div className="space-y-1.5 pl-3 border-l-2 border-primary/20">
                      <div className="flex justify-between">
                        <span>Credit/debit card</span>
                        <span className="font-medium">2.9% + $0.30</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Apple Pay / Google Pay</span>
                        <span className="font-medium">2.9% + $0.30</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bank transfer (ACH)</span>
                        <span className="font-medium text-green-600">0.8% (max $5)</span>
                      </div>
                    </div>
                    <p className="text-[10px] mt-1">Charged by Stripe for secure payment processing. Kora does not mark up processing fees.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-foreground text-sm mb-1">Kora platform fee</p>
                    <div className="space-y-1.5 pl-3 border-l-2 border-primary/20">
                      <div className="flex justify-between">
                        <span>Free plan</span>
                        <span className="font-medium">$2.00 per gift</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Starter ($5/mo per fund)</span>
                        <span className="font-medium text-green-600">$0.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Family ($12/mo or $119/yr)</span>
                        <span className="font-medium text-green-600">$0.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Event Boost ($29/event)</span>
                        <span className="font-medium text-green-600">Waived for that event</span>
                      </div>
                    </div>
                    <p className="text-[10px] mt-1">Covers investing infrastructure, compliance, and customer support. No hidden charges.</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/30 text-center">
                <p className="text-xs text-muted-foreground">
                  Givers always see a clear order summary with every fee itemized before paying. Hosts can cover fees so recipients get 100%. No withdrawal fees. No account fees. No surprise charges.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <Mascot size="lg" className="mx-auto mb-6" context="home-cta" />
            <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground tracking-tight mb-6" data-testid="text-cta-heading">
              Start building their future <GradientText>today</GradientText>
            </h2>
            <Link href="/get-started">
              <Button size="lg" className="h-14 px-10 text-base" data-testid="button-cta-get-started" onClick={() => haptic('medium')}>
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-6" data-testid="text-cta-subtext">
              No credit card required. Set up in under 2 minutes.
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
