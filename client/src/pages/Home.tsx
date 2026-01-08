import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      
      {/* Hero */}
      <section className="pt-20 pb-24 md:pt-32 md:pb-36">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-semibold leading-[1.1] text-foreground tracking-tight mb-6">
              A gift they'll still have<br className="hidden sm:block" /> in twenty years.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto mb-10">
              Create a page. Share it. Friends and family contribute. It becomes a long-term investment fund.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create">
                <Button size="lg" className="h-12 px-8 text-base" data-testid="button-create-fund">
                  Create a fund
                </Button>
              </Link>
              <Link href="/moment">
                <Button variant="ghost" size="lg" className="h-12 px-8 text-base text-muted-foreground" data-testid="button-send-gift">
                  Send a gift
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social proof - minimal */}
      <section className="py-16 border-t border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-center">
            <div>
              <p className="text-2xl md:text-3xl font-semibold text-foreground">10,000+</p>
              <p className="text-sm text-muted-foreground">families</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-semibold text-foreground">$2.4M</p>
              <p className="text-sm text-muted-foreground">contributed</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-semibold text-foreground">47 sec</p>
              <p className="text-sm text-muted-foreground">avg. gift time</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24" id="how">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-16 text-center">How it works</h2>
            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {[
                { num: "01", title: "Create", desc: "Set up a fund in two minutes. For your child, or yourself." },
                { num: "02", title: "Share", desc: "Send the link. Print it. Display a QR at your event." },
                { num: "03", title: "Grow", desc: "Every contribution invests automatically. Watch it compound." },
              ].map((step) => (
                <div key={step.num} className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">{step.num}</p>
                  <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The math */}
      <section className="py-24 bg-card border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">Time does the work.</h2>
            <p className="text-muted-foreground mb-12">A birthday gift today becomes something real in the future.</p>
            <div className="flex items-end justify-center gap-4 md:gap-8 mb-8">
              <div className="text-center">
                <div className="h-16 w-20 md:w-24 bg-primary/10 rounded-t-lg flex items-end justify-center pb-2">
                  <span className="text-lg font-semibold text-foreground">$500</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Today</p>
              </div>
              <div className="text-center">
                <div className="h-28 w-20 md:w-24 bg-primary/20 rounded-t-lg flex items-end justify-center pb-2">
                  <span className="text-lg font-semibold text-foreground">$1,200</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">10 years</p>
              </div>
              <div className="text-center">
                <div className="h-40 w-20 md:w-24 bg-primary/30 rounded-t-lg flex items-end justify-center pb-2">
                  <span className="text-lg font-semibold text-foreground">$2,100</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">18 years</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Hypothetical. 7% annual return. Past performance doesn't guarantee future results.
            </p>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-24 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-12">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Protected</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Accounts are SIPC-insured up to $500k. Your broker-dealer is a FINRA member. We don't hold your money.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Instant</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Contributors give in under a minute. No account required. Apple Pay, cards, bank transfer.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Long-term</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Not cash that disappears. A fund they'll still have in ten, twenty, thirty years.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Occasions */}
      <section className="py-24 border-t bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-12">For any occasion.</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {["Birthday", "Bar Mitzvah", "Bat Mitzvah", "Graduation", "Wedding", "Baby Shower", "Holiday", "Just Because"].map((occasion) => (
                <span 
                  key={occasion} 
                  className="px-4 py-2 rounded-full border text-sm text-foreground"
                >
                  {occasion}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 border-t" id="pricing">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4 text-center">Pricing</h2>
            <p className="text-muted-foreground text-center mb-12">Free to create. Transparent fees.</p>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border shadow-none">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Free</h3>
                    <p className="text-3xl font-semibold mt-2">$0</p>
                    <p className="text-sm text-muted-foreground mt-1">Guests pay fees</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited funds</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited events</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> All templates</li>
                  </ul>
                  <Link href="/create">
                    <Button variant="outline" className="w-full">Get started</Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-2 border-foreground shadow-none">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Plus</h3>
                    <p className="text-3xl font-semibold mt-2">$99</p>
                    <p className="text-sm text-muted-foreground mt-1">per event · fee-free for guests</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Guests see $0</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Service fee waived to $5k</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Premium templates</li>
                  </ul>
                  <Link href="/create">
                    <Button className="w-full">Choose Plus</Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="border shadow-none">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Family</h3>
                    <p className="text-3xl font-semibold mt-2">$199</p>
                    <p className="text-sm text-muted-foreground mt-1">per year · up to 10 events</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Multiple children</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Household dashboard</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Recurring gifts</li>
                  </ul>
                  <Link href="/create">
                    <Button variant="outline" className="w-full">Choose Family</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Card processing is pass-through. Everleaf service fee: 2% (cap $12). Bank transfer: 1% (cap $12).
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t bg-foreground text-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Start in two minutes.</h2>
          <p className="text-background/70 mb-8 max-w-md mx-auto">
            Free to create. Share it with anyone. Watch their future grow.
          </p>
          <Link href="/create">
            <Button size="lg" variant="secondary" className="h-12 px-8 text-base">
              Create a fund <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
