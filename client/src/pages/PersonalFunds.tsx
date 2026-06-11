import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Bell, Cake, PartyPopper } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { PersonalFundWaitlistModal } from "@/components/PersonalFundWaitlistModal";
import { usePageSeo } from "@/lib/seo";

export default function PersonalFunds() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  usePageSeo({
    title: "Personal Investment Funds | Kiddo",
    description:
      "Want to receive stock as gifts for your own occasions? Personal Kiddo funds are coming. Join the waitlist and be first to know.",
    ogType: "website",
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Coming soon</p>
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            A gift fund for your own life milestones.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Personal investment funds are on the way. Think birthdays, graduations, a house deposit, a sabbatical, or any moment where you want something more meaningful than cash or random stuff.
          </p>
          <div className="mx-auto mt-6 max-w-3xl rounded-[28px] border border-border bg-card px-6 py-5 text-left shadow-premium-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Join the waitlist if you want</p>
            <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
              <p>One shareable gift link for your own occasion.</p>
              <p>Launch access as soon as personal funds go live.</p>
              <p>A single launch email instead of ongoing marketing spam.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 md:pb-20">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-3">
          {[
            {
              icon: Cake,
              title: "Birthday gifts that last",
              body: "Share one link and let friends send stock instead of another forgettable thing.",
            },
            {
              icon: PartyPopper,
              title: "Any occasion, any age",
              body: "Graduation, moving, a sabbatical, or a big life milestone. Same gifting loop, different moment.",
            },
            {
              icon: Bell,
              title: "Waitlist gets first access",
              body: "The first people on the list hear first, get the launch email first, and help show us which use cases matter most.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[28px] border border-border bg-card p-6 shadow-premium-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 font-heading text-xl font-semibold text-foreground">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-12 md:pb-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-[32px] border border-border bg-card p-8 shadow-premium-sm md:p-12">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              What personal funds will do.
            </h2>
            <div className="mt-6 space-y-5 text-base leading-8 text-muted-foreground">
              <p>Everything Kiddo does for children, now for you.</p>
              <p>
                Create a fund for yourself. Share a link. Your friends and family gift real stocks for your
                birthday, your graduation, your house deposit, your sabbatical, or any other life moment that
                deserves something better than cash in an envelope.
              </p>
              <p>&quot;Pay me back for dinner in Netflix shares&quot; is still the vibe.</p>
              <p className="font-medium text-foreground">
                The core promise is the same. You share a link, people gift, and the gift can keep growing.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-[32px] border border-border bg-card p-8 text-center shadow-premium-sm md:p-12">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Why it is not live yet.
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Kiddo is focused entirely on children&apos;s investment funds right now and making that gifting experience the best version of itself first.
            </p>
            <p className="mt-3 text-base leading-8 text-muted-foreground">
              Personal funds are next. This page is the waitlist for that launch.
            </p>
            <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-5 text-left">
              <p className="text-sm font-semibold text-foreground">What joining the waitlist gets you</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>1. A single launch email when personal funds are ready.</p>
                <p>2. Early access before the feature is promoted broadly.</p>
                <p>3. A better chance that your use case shapes the first release.</p>
              </div>
            </div>
            <h3 className="mt-8 font-heading text-2xl font-semibold text-foreground">Join the waitlist.</h3>
            <p className="mt-3 text-base leading-8 text-muted-foreground">
              You get a single launch email when personal funds go live. No spam or newsletter drip.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button onClick={() => setWaitlistOpen(true)} data-testid="link-personal-funds-waitlist">
                  Notify me
                  <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Link href="/get-started">
                <Button variant="outline">Start your child&apos;s fund</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PersonalFundWaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        sourceSurface="personal_funds_page"
      />

      <Footer />
    </div>
  );
}
