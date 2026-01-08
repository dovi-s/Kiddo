import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Shield, Zap, Clock, Check, TrendingUp, Quote } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      {/* Hero */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2">
              <TrendingUp className="h-4 w-4" />
              $2.4M+ gifted to families
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.08] text-foreground tracking-tight">
              A gift they'll still have<br className="hidden sm:block" /> in 10 years.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Create a page. Friends and family contribute in under a minute. It becomes a long-term investment fund.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/create">
                <Button size="lg" className="h-12 px-8 text-base font-medium shadow-lg shadow-primary/20" data-testid="button-create-fund">
                  Create a fund <ArrowRight className="ml-2 h-4 w-4" />
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
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> No account needed</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Apple Pay ready</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> SIPC protected</span>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { quote: "My son's birthday gifts used to disappear in a week. Now they're growing for his future.", name: "Sarah M.", context: "Mother of 2" },
              { quote: "I gave at a friend's baby shower. Took 30 seconds. The parents loved it.", name: "Michael R.", context: "Gift contributor" },
              { quote: "We use it for every birthday and holiday now. The grandparents are obsessed.", name: "Jennifer K.", context: "Family plan user" },
            ].map((t, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-5 rounded-xl bg-card border"
              >
                <Quote className="h-5 w-5 text-primary/40 mb-3" />
                <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="font-medium text-sm text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.context}</p>
                </div>
              </motion.div>
            ))}
          </div>
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

      {/* Growth visualization */}
      <section className="py-16 border-t bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">Small gifts, big futures</h2>
            <p className="text-muted-foreground">See how birthday gifts can grow over time.</p>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-xl mx-auto">
            {[
              { year: "Today", amount: "$500", desc: "Birthday gifts" },
              { year: "10 years", amount: "$1,200", desc: "7% avg return" },
              { year: "18 years", amount: "$2,100", desc: "Ready for them" },
            ].map((item, i) => (
              <motion.div 
                key={item.year}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center p-4 md:p-6 rounded-xl bg-card border"
              >
                <p className="text-xs text-muted-foreground mb-1">{item.year}</p>
                <p className="text-xl md:text-2xl font-semibold text-foreground">{item.amount}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto">
            Hypothetical example. Actual returns vary. Past performance doesn't guarantee future results.
          </p>
        </div>
      </section>

      {/* Templates preview */}
      <section className="py-20 border-t bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">For every milestone</h2>
            <p className="text-muted-foreground">Beautiful pages for birthdays, bar mitzvahs, graduations, and more.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
            {[
              { name: "Birthday", emoji: "🎂" },
              { name: "Bar/Bat Mitzvah", emoji: "✡️" },
              { name: "Graduation", emoji: "🎓" },
              { name: "Wedding", emoji: "💒" },
              { name: "New Baby", emoji: "👶" },
              { name: "Just Because", emoji: "💚" },
            ].map((template) => (
              <motion.span 
                key={template.name} 
                whileHover={{ scale: 1.05 }}
                className="px-4 py-2.5 rounded-full bg-background border text-sm font-medium text-foreground cursor-default hover:border-primary/50 transition-colors"
              >
                <span className="mr-1.5">{template.emoji}</span>{template.name}
              </motion.span>
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

      {/* Pricing */}
      <section className="py-20 border-t bg-card" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">Simple pricing</h2>
            <p className="text-muted-foreground">Free to create. Upgrade when you're ready.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <Card className="border-none shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Free</h3>
                  <p className="text-3xl font-semibold mt-2">$0</p>
                  <p className="text-sm text-muted-foreground mt-1">Guests pay fees at checkout</p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited funds + events</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Templates, QR, gift pages</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Thank-you list export</li>
                </ul>
                <Link href="/create">
                  <Button variant="outline" className="w-full">Get started</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Plus */}
            <Card className="border-2 border-primary shadow-sm relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">Popular</div>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Plus</h3>
                  <p className="text-3xl font-semibold mt-2">$99 <span className="text-base font-normal text-muted-foreground">per event</span></p>
                  <p className="text-sm text-muted-foreground mt-1">Fee-free for guests</p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Guests see $0 fees</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Service fee waived to $5k</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Premium templates + cards</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Auto thank-you drafts</li>
                </ul>
                <Link href="/create">
                  <Button className="w-full">Choose Plus</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Family */}
            <Card className="border-none shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Family</h3>
                  <p className="text-3xl font-semibold mt-2">$199 <span className="text-base font-normal text-muted-foreground">per year</span></p>
                  <p className="text-sm text-muted-foreground mt-1">Multiple kids, one home base</p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Up to 10 events/year</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Service fee waived to $10k/yr</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Household dashboard</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Recurring gift management</li>
                </ul>
                <Link href="/create">
                  <Button variant="outline" className="w-full">Choose Family</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-xs text-muted-foreground mt-8 max-w-xl mx-auto space-y-1">
            <p><strong>How fees work:</strong> Card processing is pass-through. Everleaf service fee powers the platform.</p>
            <p>Card: processing + 2.0% service (cap $12). Bank: 1.0% service (cap $12). Recurring: −0.5%.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Start in 2 minutes.</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
            Free to create. Share your link. Watch their future grow.
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
