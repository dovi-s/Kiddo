import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Shield, Zap, Clock, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      {/* Hero */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center space-y-6"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.1] text-foreground tracking-tight">
              A gift they'll still have in 10 years.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Create a page. Friends and family contribute in under a minute. It becomes a long-term fund.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/create">
                <Button size="lg" className="h-12 px-8 text-base font-medium" data-testid="button-create-fund">
                  Create a fund
                </Button>
              </Link>
              <Link href="/moment">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base font-medium" data-testid="button-send-gift">
                  Send a gift
                </Button>
              </Link>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> No account required</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Apple Pay</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Instant receipt</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t bg-card" id="how">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">How it works</h2>
            <p className="text-muted-foreground">Simple for everyone.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { num: "1", title: "Create a page", desc: "Set up a fund for your child or yourself in 2 minutes." },
              { num: "2", title: "Share the link", desc: "Send it, print it, or display a QR at your event." },
              { num: "3", title: "Watch it grow", desc: "Every contribution becomes part of their long-term fund." },
            ].map((step) => (
              <div key={step.num} className="text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {step.num}
                </div>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-16 border-t">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center max-w-3xl mx-auto">
            {[
              { value: "10,000+", label: "Families" },
              { value: "$2.4M", label: "Contributed" },
              { value: "SIPC", label: "Insured" },
              { value: "< 1 min", label: "To give" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl md:text-3xl font-semibold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates preview */}
      <section className="py-20 border-t bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">For every milestone</h2>
            <p className="text-muted-foreground">Beautiful pages for any occasion.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
            {["Birthday", "Bar Mitzvah", "Graduation", "Wedding", "Baby", "Just Because"].map((template) => (
              <span key={template} className="px-4 py-2 rounded-full bg-background border text-sm font-medium text-foreground">
                {template}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: "Secure & insured", desc: "Funds are held in SIPC-insured accounts with bank-grade security." },
              { icon: Zap, title: "Under a minute", desc: "Contributors give in seconds. No account needed. Apple Pay ready." },
              { icon: Clock, title: "Built to last", desc: "Not cash that vanishes. A fund they'll still have in 10, 20, 30 years." },
            ].map((item) => (
              <div key={item.title} className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Start in 2 minutes.</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
            Free to create. Transparent pricing. No commitments.
          </p>
          <Link href="/create">
            <Button size="lg" variant="secondary" className="h-12 px-8 text-base font-medium">
              Create a fund <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
