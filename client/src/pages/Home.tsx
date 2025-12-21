import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, TrendingUp, ShieldCheck, Heart } from "lucide-react";
import heroImage from "@assets/generated_images/golden_tree_growing_from_digital_foundation.png";
import giftCardImage from "@assets/generated_images/premium_stock_gift_card_on_marble.png";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <h1 className="font-serif text-4xl font-bold leading-tight text-primary md:text-6xl">
                Give gifts that <span className="text-secondary italic">grow</span>.
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl leading-relaxed">
                Forget disposable toys and cash that disappears. Create a registry for stocks, ETFs, and college funds. Build a future for the ones you love.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/create">
                  <Button size="lg" className="h-12 px-8 text-lg shadow-lg shadow-primary/20">
                    Create a Registry
                  </Button>
                </Link>
                <Link href="/registry">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-lg">
                    Find a Registry
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-gray-200" />
                  ))}
                </div>
                <p>Trusted by 10,000+ families</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative mx-auto w-full max-w-lg lg:max-w-none"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl">
                <img 
                  src={heroImage} 
                  alt="Golden tree growing representing wealth" 
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent mix-blend-multiply" />
              </div>
              
              {/* Floating Card */}
              <div className="absolute -bottom-8 -left-8 hidden md:block">
                <div className="rounded-xl bg-white p-6 shadow-xl border border-border/50 max-w-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                      <p className="font-bold text-lg text-primary">$12,450.00</p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[70%] bg-secondary rounded-full" />
                  </div>
                  <p className="text-xs text-right mt-1 text-muted-foreground">+12% this year</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof / Partners */}
      <section className="border-y bg-muted/30 py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Perfect for every milestone
          </p>
          <div className="flex flex-wrap justify-center gap-8 opacity-60 md:gap-16">
            {["Bar Mitzvahs", "Birthdays", "Graduations", "Weddings", "Newborns"].map((item) => (
              <span key={item} className="text-xl font-serif font-medium text-primary">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24" id="about">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="mb-4 font-serif text-3xl font-bold text-primary md:text-4xl">
              Why gift shares instead of stuff?
            </h2>
            <p className="text-lg text-muted-foreground">
              Most gifts are forgotten in a year. Assets grow with them as they grow up.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                title: "Compound Growth",
                description: "$100 gifted today could be worth $500+ when they turn 18. Let time do the work."
              },
              {
                icon: ShieldCheck,
                title: "Secure & Regulated",
                description: "Funds are held in regulated custodial accounts (UGMA/UTMA) or 529 plans."
              },
              {
                icon: Heart,
                title: "Meaningful Memories",
                description: "Leave a digital note with your gift that they can read for years to come."
              }
            ].map((feature, i) => (
              <div key={i} className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-lg hover:-translate-y-1">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 font-serif text-xl font-bold text-primary">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid gap-16 md:grid-cols-2 items-center">
            <div className="order-2 md:order-1">
               <img 
                  src={giftCardImage} 
                  alt="Premium gift card" 
                  className="rounded-lg shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500"
                />
            </div>
            <div className="space-y-8 order-1 md:order-2">
              <h2 className="font-serif text-3xl font-bold md:text-4xl text-white">
                Simple for you. <br/>Powerful for them.
              </h2>
              <div className="space-y-6">
                {[
                  { step: "01", text: "Parents create a registry in 2 minutes." },
                  { step: "02", text: "Guests choose a gift (S&P 500, College Fund, etc)." },
                  { step: "03", text: "Funds are invested automatically." },
                  { step: "04", text: "Watch the wealth grow over decades." }
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 font-serif text-lg font-bold text-secondary">
                      {item.step}
                    </span>
                    <p className="text-lg text-white/90">{item.text}</p>
                  </div>
                ))}
              </div>
              <Link href="/create">
                <Button size="lg" variant="secondary" className="mt-4 h-14 px-8 text-lg font-semibold">
                  Start Your Registry
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
