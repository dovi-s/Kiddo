import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, TrendingUp, ShieldCheck, Heart, Sparkles, Star, Users, Baby, User, Wallet } from "lucide-react";
import heroImage from "@assets/generated_images/golden_tree_growing_from_digital_foundation.png";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      {/* Hero Section - Clean, Sophisticated */}
      <section className="relative overflow-hidden pt-20 pb-32 md:pt-32 md:pb-40">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="font-serif text-5xl font-bold leading-tight text-primary md:text-7xl tracking-tight">
                Invest in the ones you love.
              </h1>
            </motion.div>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-muted-foreground md:text-2xl leading-relaxed max-w-2xl mx-auto"
            >
              One account for a lifetime of growth. Family, friends, and loved ones can gift shares for birthdays, bar mitzvahs, graduations, or just because.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col gap-4 sm:flex-row justify-center pt-4"
            >
              <Link href="/create">
                <Button size="lg" className="h-14 px-10 text-lg font-bold shadow-xl shadow-primary/20">
                  Open an Account
                </Button>
              </Link>
              <Link href="/give">
                <Button variant="outline" size="lg" className="h-14 px-10 text-lg font-bold">
                  Give a Gift
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
        
        {/* Abstract Background Element */}
        <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 w-[150%] aspect-square rounded-full bg-gradient-to-t from-secondary/5 to-transparent blur-3xl pointer-events-none" />
      </section>

      {/* Who It's For */}
      <section className="py-24 border-t bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl font-bold text-primary md:text-4xl">Built for everyone.</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <Card className="border-none shadow-sm hover:shadow-lg transition-shadow bg-white">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <Baby className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="font-serif text-xl">For Your Children</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Open a custodial account and let your community invest in your child's future. One fund, a lifetime of gifts.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm hover:shadow-lg transition-shadow bg-white">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                  <User className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="font-serif text-xl">For Yourself</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Build your own portfolio and let friends and family contribute to your goals. Weddings, milestones, or just because.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm hover:shadow-lg transition-shadow bg-white">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="font-serif text-xl">For Givers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  No account needed. Scan a QR code, pick an amount, and gift ownership in seconds. It's that simple.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works - Simplified */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid gap-16 md:grid-cols-2 items-center max-w-6xl mx-auto">
            <div className="space-y-10">
              <h2 className="font-serif text-3xl font-bold text-primary md:text-4xl">
                One account.<br/>A lifetime of growth.
              </h2>
              <div className="space-y-8">
                {[
                  { num: "1", title: "Open an account", desc: "For yourself or your child. Takes 2 minutes." },
                  { num: "2", title: "Share your link", desc: "Send it, print it, or display a QR code at your event." },
                  { num: "3", title: "Watch it grow", desc: "Every gift becomes real ownership. Track it all in one place." }
                ].map((item) => (
                  <div key={item.num} className="flex gap-6 items-start">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-serif font-bold">
                      {item.num}
                    </span>
                    <div>
                      <h3 className="font-bold text-lg text-primary">{item.title}</h3>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/create">
                <Button size="lg" className="h-12 px-8 text-lg font-bold">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="relative">
              <img 
                src={heroImage} 
                alt="Growth visualization" 
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl p-4 shadow-lg border max-w-[200px]">
                <p className="text-xs text-muted-foreground">Total Contributions</p>
                <p className="text-2xl font-bold font-serif text-primary">$12,450</p>
                <p className="text-xs text-green-600 font-medium">+14.2% all time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-16 border-y bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10,000+", label: "Families" },
              { value: "$2.4M", label: "Gifted" },
              { value: "SIPC", label: "Insured" },
              { value: "256-bit", label: "Encryption" }
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold font-serif">{stat.value}</p>
                <p className="text-sm opacity-70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-24" id="about">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="mb-4 font-serif text-3xl font-bold text-primary md:text-4xl">
              Why ownership matters.
            </h2>
            <p className="text-lg text-muted-foreground">
              Cash gets spent. Toys break. Ownership compounds.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {[
              {
                icon: TrendingUp,
                title: "Compound Growth",
                description: "$100 today could be $500+ by age 18. Time is the ultimate gift."
              },
              {
                icon: ShieldCheck,
                title: "Real Ownership",
                description: "Not points. Not credits. Real shares in real companies, held in their name."
              },
              {
                icon: Heart,
                title: "Lasting Memory",
                description: "Every gift includes a message. A permanent record of who believed in them."
              }
            ].map((feature, i) => (
              <div key={i} className="text-center p-8">
                <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-3 font-serif text-xl font-bold text-primary">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-muted/30 border-t">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl font-bold text-primary md:text-4xl mb-6">
            Start building their future today.
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            It takes 2 minutes to open an account. Free to create. Transparent pricing.
          </p>
          <Link href="/create">
            <Button size="lg" className="h-14 px-12 text-lg font-bold shadow-xl shadow-primary/20">
              Open an Account
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
