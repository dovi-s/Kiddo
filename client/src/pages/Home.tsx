import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

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
    <div className="min-h-screen bg-background">
      <Nav />
      
      {/* Hero */}
      <section className="pt-20 pb-24 md:pt-32 md:pb-36">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-semibold leading-[1.1] text-foreground tracking-tight mb-6">
              A gift they'll still have<br className="hidden sm:block" /> in twenty years.
            </h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto mb-10"
            >
              Create a page. Share it. Friends and family contribute. It becomes a long-term investment fund.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/create">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="lg" className="h-12 px-8 text-base" data-testid="button-create-fund">
                    Create a fund
                  </Button>
                </motion.div>
              </Link>
              <Link href="/moment">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="ghost" size="lg" className="h-12 px-8 text-base text-muted-foreground" data-testid="button-send-gift">
                    Send a gift
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-16 border-t border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-x-16 gap-y-6 text-center">
            {[
              { value: 10000, suffix: "+", label: "families" },
              { value: 2.4, suffix: "M", label: "contributed", prefix: "$" },
              { value: 47, suffix: " sec", label: "avg. gift time" },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <p className="text-2xl md:text-3xl font-semibold text-foreground">
                  {stat.prefix || ""}<AnimatedNumber value={stat.value} suffix={stat.suffix} />
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

      {/* The math */}
      <section className="py-24 bg-card border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <FadeIn>
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-4">Time does the work.</h2>
              <p className="text-muted-foreground mb-12">A birthday gift today becomes something real in the future.</p>
            </FadeIn>
            <div className="flex items-end justify-center gap-4 md:gap-8 mb-8">
              {[
                { height: "h-16", value: 500, label: "Today", opacity: "bg-foreground/10" },
                { height: "h-28", value: 1200, label: "10 years", opacity: "bg-foreground/20" },
                { height: "h-44", value: 2100, label: "18 years", opacity: "bg-foreground/30" },
              ].map((bar, i) => (
                <motion.div 
                  key={i}
                  className="text-center"
                  initial={{ opacity: 0, scaleY: 0 }}
                  whileInView={{ opacity: 1, scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ originY: 1 }}
                >
                  <motion.div 
                    className={`${bar.height} w-20 md:w-24 ${bar.opacity} rounded-t-lg flex items-end justify-center pb-2`}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="text-lg font-semibold text-foreground">${bar.value.toLocaleString()}</span>
                  </motion.div>
                  <p className="text-xs text-muted-foreground mt-2">{bar.label}</p>
                </motion.div>
              ))}
            </div>
            <FadeIn delay={0.6}>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
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

      {/* Occasions */}
      <section className="py-24 border-t bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <FadeIn>
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-12">For any occasion.</h2>
            </FadeIn>
            <div className="flex flex-wrap justify-center gap-3">
              {["Birthday", "Bar Mitzvah", "Bat Mitzvah", "Graduation", "Wedding", "Baby Shower", "Holiday", "Just Because"].map((occasion, i) => (
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
            </FadeIn>

            <div className="space-y-4">
              {[
                { id: "free", name: "Free", price: "$0", period: "", desc: "Create unlimited funds. Share with anyone. Contributors pay a small fee at checkout.", featured: false },
                { id: "plus", name: "Plus", price: "$99", period: "per event", desc: "For big events. You cover fees so guests contribute the full amount.", featured: true },
                { id: "family", name: "Family", price: "$199", period: "per year", desc: "Multiple children, up to 10 events per year. One dashboard.", featured: false },
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
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{plan.desc}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-semibold">{plan.price}</p>
                        {plan.period && <p className="text-xs text-muted-foreground">{plan.period}</p>}
                      </div>
                      <Link href="/create">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button variant={plan.featured ? "default" : "outline"}>
                            {plan.featured ? "Choose Plus" : plan.id === "free" ? "Get started" : "Choose Family"}
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
                Free tier: guests pay ~3% at checkout. Plus/Family: you cover processing, we waive our fee on the first $5k–$10k.
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
            <Link href="/create">
              <motion.div 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.98 }}
                className="inline-block"
              >
                <Button size="lg" variant="secondary" className="h-12 px-8 text-base">
                  Create a fund <ArrowRight className="ml-2 h-4 w-4" />
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
