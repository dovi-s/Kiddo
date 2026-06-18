import { Link } from "wouter";
import { ArrowRight, Lock, Shield, Wallet } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { LockedRefusalsPanel } from "@/components/LockedRefusalsPanel";
import { usePageSeo } from "@/lib/seo";

const pillars = [
  {
    icon: Wallet,
    title: "Asset separation",
    body: "Kiddo is the product experience. When investing is live, the invested assets sit with the broker-dealer layer, not on Kiddo's own balance sheet.",
  },
  {
    icon: Shield,
    title: "Regulated layers",
    body: "Brokerage and custody will live with our broker-dealer partner. Payment processing runs through Stripe today.",
  },
  {
    icon: Lock,
    title: "Clear limits",
    body: "SIPC coverage protects against broker-dealer failure, not market losses.",
  },
] as const;

const architecture = [
  "Custodial structure: the fund is opened in the child's name under a custodial framework, typically UTMA.",
  "Private distribution: fund links are invitation-driven, not publicly searchable.",
  // TODO(founder): verify at-rest encryption on Supabase DB + Storage before claiming it.
  "Data handling: information is encrypted in transit, and stored access is restricted.",
  "Checkout clarity: the gift amount and any fees are shown before anyone pays.",
] as const;

export default function Security() {
  usePageSeo({
    title: "Kiddo Security | How your child's money is protected",
    description: "When investing is live, investments are held by our broker-dealer partner, a FINRA-registered broker-dealer with SIPC coverage.",
    ogType: "article",
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="overflow-x-hidden">
        <section className="relative overflow-hidden pb-16 pt-24 md:pb-20 md:pt-32">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[24rem] bg-[radial-gradient(circle_at_top,hsl(var(--kiddo-gold)/0.14),transparent_58%)]" />
          <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Security</p>
            <h1 className="mt-4 font-heading text-4xl font-bold tracking-[-0.03em] text-foreground md:text-6xl">
              How your child&apos;s account is protected.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              This page is the plain-English version of how Kiddo is built to protect the account, what each partner will be responsible for, and where the real boundaries are.
            </p>
          </div>
        </section>

        <section className="pb-8">
          <div className="mx-auto max-w-6xl px-4">
            <TrustMicroStrip />
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-6 md:grid-cols-3">
              {pillars.map((item) => (
                <div key={item.title} className="rounded-[1.75rem] border border-border/60 bg-card/90 p-7 shadow-premium-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.08)]">
                    <item.icon className="h-5 w-5 text-[hsl(var(--kiddo-evergreen))]" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">How the stack works</p>
                <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                  How the layers fit together.
                </h2>
                <div className="mt-8 space-y-4">
                  {architecture.map((item) => (
                    <div key={item} className="flex gap-3">
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                      <p className="leading-relaxed text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-sm leading-7 text-muted-foreground">
                  Kiddo is the technology layer, not a broker-dealer, investment adviser, or bank. Our broker-dealer partner will handle brokerage and custody, and Stripe handles payment processing.
                </p>
              </div>

              <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">What if Kiddo shuts down?</p>
                <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                  The account should not vanish with the interface.
                </h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  Once invested, the child's assets are not supposed to be Kiddo's corporate assets. The operating company and the asset layer are intentionally
                  separate.
                </p>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  That means the product experience could change, but the invested assets should still exist at the custody layer and be eligible to move.
                </p>
                <div className="mt-6 rounded-[1.5rem] border border-border/60 bg-[hsl(var(--kiddo-cream))] p-5 text-sm leading-7 text-muted-foreground">
                  SIPC coverage applies against brokerage failure, not market losses. Investments may lose value. They are not FDIC insured and not bank guaranteed.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
              <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-premium-sm md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Privacy and scope</p>
                <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl">
                  Kiddo is meant to feel shareable for family, not visible to strangers.
                </h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  The product is invitation-driven. A child should not need a public profile page to receive a meaningful gift from the people who know them.
                </p>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  That is why private links, careful disclosure, and quiet surfaces matter as much as encryption or custody language.
                </p>

                <div className="mt-8 rounded-[1.5rem] border border-border/60 bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">
                  <p>
                    When investing is live, Kiddo funds are held by our broker-dealer partner (Member FINRA/SIPC). Eligible accounts are then SIPC-protected up to
                    $500,000 against brokerage failure. SIPC does not protect against market losses. Investments may lose value. Not FDIC insured, not bank guaranteed.
                  </p>
                  <p className="mt-3">
                    Check the background of our broker-dealer partner on{" "}
                    <a href="https://brokercheck.finra.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      FINRA&apos;s BrokerCheck
                    </a>
                    .
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-4 text-sm">
                  <Link href="/faq" className="font-medium text-primary transition-colors hover:text-foreground">
                    Read the FAQ
                  </Link>
                  <Link href="/contact" className="font-medium text-primary transition-colors hover:text-foreground">
                    Contact us
                  </Link>
                </div>
              </div>

              <LockedRefusalsPanel variant="marketing" />
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Next step</p>
            <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
              Families should know exactly what they&apos;re trusting.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              If the structure feels right, the next move is still the same: start small, invite family, and let the account begin compounding.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base" data-testid="button-security-primary">
                  Start your child's fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/faq">
                <Button variant="outline" size="lg" className="h-14 px-10 text-base" data-testid="button-security-secondary">
                  Read the FAQ
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
