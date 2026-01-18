import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { springGentle, easeOutExpo, easeOutBack } from "@/lib/animations";
import { haptic } from "@/lib/haptics";

function GrowthCalculator() {
  const [amount, setAmount] = useState(100);
  const growth10 = Math.round(amount * Math.pow(1.07, 10));
  const growth18 = Math.round(amount * Math.pow(1.07, 18));
  
  const maxHeight = 160;
  const baseHeight = 40;
  const height10 = baseHeight + ((growth10 / growth18) * (maxHeight - baseHeight));
  const height18 = maxHeight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Slider */}
      <div className="max-w-xs mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Gift amount</span>
          <motion.span 
            key={amount}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-2xl font-semibold text-foreground"
          >
            ${amount}
          </motion.span>
        </div>
        <Slider
          value={[amount]}
          onValueChange={(v) => setAmount(v[0])}
          min={25}
          max={500}
          step={25}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>$25</span>
          <span>$500</span>
        </div>
      </div>

      {/* Bars */}
      <div className="flex items-end justify-center gap-6 md:gap-10">
        {[
          { value: amount, label: "Today", height: baseHeight, color: "bg-slate-100 dark:bg-slate-900/30" },
          { value: growth10, label: "10 years", height: height10, color: "bg-slate-200 dark:bg-slate-800/40" },
          { value: growth18, label: "18 years", height: height18, color: "bg-slate-300 dark:bg-slate-700/50" },
        ].map((bar, i) => (
          <motion.div 
            key={i}
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <motion.div 
              className={`w-20 md:w-24 ${bar.color} rounded-t-lg flex items-end justify-center pb-3 transition-all duration-500 ease-out`}
              style={{ height: bar.height }}
              layout
            >
              <motion.span 
                key={bar.value}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                ${bar.value.toLocaleString()}
              </motion.span>
            </motion.div>
            <p className="text-xs text-muted-foreground mt-2">{bar.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Multiplier */}
      <motion.p 
        key={growth18}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        className="text-sm text-muted-foreground"
      >
        <span className="font-medium text-primary dark:text-primary">{(growth18 / amount).toFixed(1)}×</span> growth over 18 years
      </motion.p>
    </motion.div>
  );
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [isInView, value]);
  
  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>;
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/30 via-background to-background dark:from-slate-950/10">
      <Nav />
      
      {/* Hero */}
      <section className="pt-24 pb-28 md:pt-36 md:pb-40">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center"
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-medium text-primary dark:text-primary mb-4"
            >
              The gift that grows
            </motion.p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] text-foreground tracking-tight mb-6">
              Give a gift they'll still<br className="hidden sm:block" /> have in twenty years.
            </h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto mb-10"
            >
              Create a fund for someone you love. Share the link. Family and friends contribute in under 60 seconds. It becomes an investment that compounds for years.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/get-started">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="lg" className="h-14 px-10 text-base rounded-xl shadow-lg shadow-primary/20" data-testid="button-create-fund">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/send">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" size="lg" className="h-14 px-10 text-base rounded-xl" data-testid="button-send-gift">
                    Send stock
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-center">
            {[
              { value: 10000, suffix: "+", label: "families", prefix: "" },
              { value: 2.4, suffix: "M", label: "contributed", prefix: "$" },
              { value: 47, suffix: "s", label: "avg. gift time", prefix: "" },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex items-baseline gap-2"
              >
                <p className="text-3xl md:text-4xl font-light text-foreground tracking-tight">
                  {stat.prefix}<AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24" id="how">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <FadeIn className="text-center mb-16">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">How it works</h2>
            </FadeIn>
            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {[
                { num: "01", title: "Create", desc: "Set up a fund in two minutes. For your child, or yourself." },
                { num: "02", title: "Share", desc: "Send the link. Print it. Display a QR at your event." },
                { num: "03", title: "Grow", desc: "Every contribution invests automatically. Watch it compound." },
              ].map((step, i) => (
                <FadeIn key={step.num} delay={i * 0.15}>
                  <motion.div 
                    className="space-y-4 group cursor-default"
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{step.num}</p>
                    <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                  </motion.div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The math - Interactive */}
      <section className="py-24 bg-card border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <FadeIn>
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-4">Time does the work.</h2>
              <p className="text-muted-foreground mb-12">See how a gift today becomes something real.</p>
            </FadeIn>
            
            <GrowthCalculator />
            
            <FadeIn delay={0.6}>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-8">
                Hypothetical. 7% annual return. Past performance doesn't guarantee future results.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-24 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-12">
            {[
              { title: "Protected", desc: "Accounts are SIPC-insured up to $500k. Your broker-dealer is a FINRA member. We don't hold your money." },
              { title: "Instant", desc: "Contributors give in under a minute. No account required. Apple Pay, cards, bank transfer." },
              { title: "Long-term", desc: "Not cash that disappears. A fund they'll still have in ten, twenty, thirty years." },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <motion.div 
                  className="space-y-3 cursor-default"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Two Ways to Give */}
      <section className="py-24 border-t bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <FadeIn className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">Two ways to give ownership.</h2>
            </FadeIn>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Create a Fund */}
              <FadeIn delay={0.1}>
                <Link href="/get-started">
                  <motion.div 
                    whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)" }}
                    className="p-8 rounded-2xl border bg-background cursor-pointer transition-all h-full"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-2xl mb-6 shadow-lg shadow-slate-500/20">
                      <svg className="w-7 h-7 text-white" viewBox="0 0 32 32" fill="none">
                        <path d="M8 6v20M8 16l10-10M8 16l10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Create a fund</h3>
                    <p className="text-muted-foreground mb-4">
                      For a child, yourself, or anyone. Share the link at events. Family and friends contribute to one growing investment.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {["Baby shower", "Birthday", "Graduation", "Wedding"].map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-full bg-muted">{tag}</span>
                      ))}
                    </div>
                    <span className="text-sm font-medium text-primary flex items-center gap-1">
                      Get started free <ArrowRight className="h-4 w-4" />
                    </span>
                  </motion.div>
                </Link>
              </FadeIn>

              {/* Send Stock */}
              <FadeIn delay={0.2}>
                <Link href="/send">
                  <motion.div 
                    whileHover={{ y: -4, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)" }}
                    className="p-8 rounded-2xl border bg-background cursor-pointer transition-all h-full"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-2xl mb-6 shadow-lg shadow-violet-500/20">
                      📈
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Send stock directly</h3>
                    <p className="text-muted-foreground mb-4">
                      Give someone ownership in a real company. Pick a stock, enter the amount, they claim it. Better than cash.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {["Thank you", "Congrats", "Birthday", "Just because"].map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-full bg-muted">{tag}</span>
                      ))}
                    </div>
                    <span className="text-sm font-medium text-violet-600 flex items-center gap-1">
                      Send stock now <ArrowRight className="h-4 w-4" />
                    </span>
                  </motion.div>
                </Link>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* Occasions */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <FadeIn>
              <p className="text-sm text-muted-foreground mb-6">Perfect for</p>
            </FadeIn>
            <div className="flex flex-wrap justify-center gap-3">
              {["First birthday", "Bar/Bat Mitzvah", "Graduation", "Wedding", "Baby shower", "Holidays", "New job", "Just because"].map((occasion, i) => (
                <motion.span 
                  key={occasion}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  whileHover={{ scale: 1.05, backgroundColor: "hsl(var(--foreground) / 0.05)" }}
                  className="px-4 py-2 rounded-full border text-sm text-foreground cursor-default transition-colors"
                >
                  {occasion}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 border-t" id="pricing">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <FadeIn className="text-center mb-16">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">Pricing</h2>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                Start free. Upgrade when you want to cover fees for guests.
              </p>
            </FadeIn>

            <div className="space-y-4">
              {[
                { 
                  id: "free", 
                  name: "Free", 
                  price: "$0", 
                  period: "forever", 
                  desc: "Create your fund and share it. Guests pay a small fee at checkout.", 
                  details: "Guest pays: 1.5% (max $10) + processing",
                  featured: false,
                  cta: "Get started free"
                },
                { 
                  id: "plus", 
                  name: "Plus", 
                  price: "$49", 
                  period: "per event", 
                  desc: "Upgrade any event to cover fees for guests. Premium templates included.", 
                  details: "You pay once • Covers up to $7,500 in gifts",
                  featured: true,
                  cta: "Learn more"
                },
                { 
                  id: "family", 
                  name: "Family", 
                  price: "$99", 
                  period: "per year", 
                  desc: "Best for multiple kids or 3+ events per year. Fee-free gifting on everything.", 
                  details: "Unlimited events • Covers up to $15k/year",
                  featured: false,
                  cta: "Learn more"
                },
              ].map((plan, i) => (
                <FadeIn key={plan.id} delay={i * 0.1}>
                  <motion.div
                    onHoverStart={() => setHoveredPlan(plan.id)}
                    onHoverEnd={() => setHoveredPlan(null)}
                    whileHover={{ x: 4 }}
                    className={`flex flex-col md:flex-row md:items-center justify-between p-6 rounded-lg transition-all ${
                      plan.featured 
                        ? "border-2 border-foreground" 
                        : `border ${hoveredPlan === plan.id ? "border-foreground/30 bg-foreground/[0.02]" : ""}`
                    }`}
                  >
                    <div className="mb-4 md:mb-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        {plan.featured && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium">
                            Most popular
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">{plan.desc}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{plan.details}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-semibold">{plan.price}</p>
                        {plan.period && <p className="text-xs text-muted-foreground">{plan.period}</p>}
                      </div>
                      <Link href="/get-started">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button variant={plan.featured ? "default" : "outline"}>
                            {plan.cta}
                          </Button>
                        </motion.div>
                      </Link>
                    </div>
                  </motion.div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={0.4} className="text-center mt-10">
              <p className="text-xs text-muted-foreground">
                All plans include real investment accounts and shareable event pages. Upgrade anytime from your dashboard.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t bg-foreground text-background overflow-hidden">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">Start in two minutes.</h2>
            <p className="text-background/70 mb-8 max-w-md mx-auto">
              Free to create. Share it with anyone. Watch their future grow.
            </p>
            <Link href="/get-started">
              <motion.div 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.98 }}
                className="inline-block"
              >
                <Button size="lg" variant="secondary" className="h-12 px-8 text-base">
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
