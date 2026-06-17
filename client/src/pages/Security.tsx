import { Link } from "wouter";
import { Lock, Shield, Wallet } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/lib/seo";

export default function Security() {
  usePageSeo({
    title: "Kiddo Security | How your child's money is protected",
    description: "When investing is live, investments are held by our broker-dealer partner, a FINRA-registered broker-dealer with SIPC coverage. Here is exactly how Kiddo protects your child's investments.",
    ogType: "article",
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Security</p>
          {/* "How ... is protected" (architecture), not "is protected."
              (absolute) — pre-custody, an unconditional present-tense
              protection claim overstates. The body hedges every layer
              correctly; the headline must not outrun it. 2026-06-03. */}
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            How your child&apos;s money is protected.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Here is exactly how. No jargon. No fine print buried at the bottom. Just the truth, plainly stated.
          </p>
        </div>
      </section>

      <section className="pb-20 md:pb-24">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-3">
          {[
            {
              icon: Wallet,
              // Future/conditional, not "we never hold... a custodian does"
              // (present tense): pre-custody, gift payments route through
              // Kiddo's Stripe — the unconditional claim was false TODAY and
              // is exactly the structure question in COUNSEL_ENGAGEMENT_PACKET
              // Part 2. The architecture statement below is the honest claim.
              title: "Your child's investments won't sit with Kiddo. They'll sit with a regulated broker-custodian.",
              body: "Kiddo is the experience. Our broker-custodian partner holds the investments once your account is open.",
            },
            {
              icon: Shield,
              title: "What protects your child's fund",
              body: "Once investing is live, SIPC coverage and FINRA oversight through our broker-dealer partner, plus encrypted data handling and unlisted fund links, sit underneath the product experience.",
            },
            {
              icon: Lock,
              title: "What we cannot protect against",
              body: "Investing involves risk. SIPC protects against broker failure, not market losses. We will always say that plainly.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-border bg-card p-7 shadow-premium-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-5 font-heading text-xl font-semibold text-foreground">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-20 md:pb-24">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-[32px] border border-border bg-card p-8 shadow-premium-sm md:p-12">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              What happens if Kiddo shuts down?
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">
              Your child&apos;s investments are not Kiddo&apos;s assets. Once invested, they are held at the broker-custodian layer, separate from Kiddo. If Kiddo disappeared, those assets would still exist and you could move them to another broker.
            </p>

            <h3 className="mt-10 font-heading text-2xl font-semibold text-foreground">How we think about privacy</h3>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Kiddo is invitation-driven, not search-driven. A child&apos;s fund should feel shareable for family, not publicly discoverable by strangers.
            </p>

            <h3 className="mt-10 font-heading text-2xl font-semibold text-foreground">Who regulates what</h3>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Kiddo is the technology layer, not a broker-dealer, investment adviser, or bank. Our broker-dealer partner handles brokerage and custody. Stripe handles payment processing. Each layer has a distinct job.
            </p>

            {/* Canonical DriveWealth + SIPC disclosure. Same shape as
                CalculatorAt18.tsx + UtmaByState.tsx so the legal posture
                reads consistently across every page that touches custody
                claims. The /security page is the most canonical surface
                for this — it must render the disclosure explicitly, not
                just hint at it through card bodies above. Per the
                2026-05-23 overclaim audit. */}
            <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">
              <p>
                When investing is live, Kiddo funds are held by our broker-dealer partner (Member FINRA/SIPC). Eligible accounts are then SIPC-protected up to $500,000 against brokerage failure. SIPC does not protect against market losses. Investments may lose value. Not FDIC insured, not bank guaranteed.
              </p>
              <p className="mt-3">
                Check the background of our broker-dealer partner on{" "}
                <a
                  href="https://brokercheck.finra.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  FINRA's BrokerCheck
                </a>
                .
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link href="/faq" className="text-primary hover:underline">Read the FAQ</Link>
              <Link href="/contact" className="text-primary hover:underline">Contact us</Link>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href="/get-started">
                <Button data-testid="button-security-primary">Start your child&apos;s fund</Button>
              </Link>
              <Link href="/faq">
                <Button variant="outline" data-testid="button-security-secondary">Read the FAQ</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
