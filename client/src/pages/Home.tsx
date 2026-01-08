import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Leaf, Heart, Shield, Sparkles, Users, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      {/* Hero */}
      <section className="relative pt-20 pb-28 md:pt-32 md:pb-40 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Leaf className="h-4 w-4" /> A new way to give
            </div>
            <h1 className="font-serif text-5xl md:text-7xl font-semibold leading-[1.1] text-foreground">
              Invest in the ones you love.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              One account for a lifetime of gifts. Family and friends contribute to real investments for birthdays, bar mitzvahs, graduations, and beyond.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/create">
                <Button size="lg" className="h-14 px-10 text-lg font-semibold" data-testid="button-hero-cta">
                  Create a Profile
                </Button>
              </Link>
              <Link href="/give">
                <Button variant="outline" size="lg" className="h-14 px-10 text-lg font-semibold" data-testid="button-hero-give">
                  Give a Gift
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        <div className="absolute -bottom-1/3 left-1/2 -translate-x-1/2 w-[200%] aspect-square rounded-full bg-gradient-to-t from-primary/5 via-secondary/5 to-transparent blur-3xl pointer-events-none" />
      </section>

      {/* How It Works */}
      <section className="py-24 border-t bg-card" id="how">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4">Simple by design.</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">Three steps. Real ownership. Lasting impact.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { num: "01", title: "Create a profile", desc: "For your child or yourself. Set up a Future Fund in minutes.", icon: Users },
              { num: "02", title: "Share a Moment", desc: "Design a page for the event. Get a link and QR to share.", icon: Gift },
              { num: "03", title: "Watch it grow", desc: "Every gift becomes real ownership. Track it all in one place.", icon: Sparkles },
            ].map((step, i) => (
              <Card key={i} className="border-none bg-transparent shadow-none text-center group">
                <CardContent className="pt-8 space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <span className="font-serif text-sm text-muted-foreground">{step.num}</span>
                  <h3 className="font-serif text-2xl font-semibold text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Everleaf */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <div className="space-y-8">
              <h2 className="font-serif text-4xl font-semibold text-foreground">Why ownership matters.</h2>
              <div className="space-y-6">
                {[
                  { icon: Heart, title: "Gifts that last", text: "Not cash that vanishes. Not toys that break. Real shares in their name." },
                  { icon: Shield, title: "Secure & regulated", text: "Held in SIPC-insured custodial accounts. Bank-grade security." },
                  { icon: Sparkles, title: "Compound over time", text: "$100 today could be $500+ by age 18. Time is the ultimate gift." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{item.title}</h4>
                      <p className="text-muted-foreground text-sm mt-1">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/create">
                <Button className="mt-4" data-testid="button-why-cta">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 flex items-center justify-center">
                <div className="bg-card rounded-2xl shadow-2xl p-8 max-w-xs text-center space-y-4 border">
                  <div className="h-20 w-20 rounded-full bg-muted mx-auto" />
                  <p className="font-serif text-xl font-semibold">Ari's Future Fund</p>
                  <p className="text-3xl font-bold text-primary">$4,250</p>
                  <p className="text-sm text-muted-foreground">18 contributors</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold mb-6">Start building their future.</h2>
          <p className="text-xl opacity-90 mb-10 max-w-xl mx-auto">
            Create a profile in 2 minutes. Share it with anyone. No account needed to give.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/create">
              <Button size="lg" variant="secondary" className="h-14 px-12 text-lg font-semibold">
                Create a Profile
              </Button>
            </Link>
            <Link href="/give">
              <Button size="lg" variant="outline" className="h-14 px-12 text-lg font-semibold border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Give a Gift
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
