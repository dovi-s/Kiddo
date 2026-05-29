// ORPHAN / UNLISTED partner pitch page. NOT linked from nav, footer, or pricing
// (kept off the consumer funnel). robots=noindex so it stays out of search and
// competitor crawls — you control distribution by sending the URL to a specific
// hospital / registry / school / employer contact. Route: /partners.
//
// Honesty rules (same as the rest of the site): NO fabricated partner programs
// or traction; custody copy stays conditional ("when investing is live"); no
// hard-named custodian; no em-dashes. This is an INVITATION to explore a
// partnership grounded in the real product, not a claim of an existing program.
// Audience-specific pages (e.g. /for-hospitals) get built when there's a real
// per-audience offer to put on them.

import { Link } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/lib/seo";

const WHAT_KIDDO_IS = [
  {
    title: "A fund, not a card",
    body: "A custodial UTMA investment account for the child. Real ownership, no spending restrictions, fully theirs at the state's age of majority.",
  },
  {
    title: "Anyone can give in a minute",
    body: "A shareable gift link, with no account needed to give. Grandparents, aunts, and friends all add to the same fund, and every gift carries a note in the Memory Book.",
  },
  {
    title: "Built for the long horizon",
    body: "The fund grows toward the child's 18th birthday and beyond. Free to start; the only ongoing fee is $1 a year per $1,000 invested.",
  },
];

export default function Partners() {
  usePageSeo({
    title: "Partner with Kiddo | For organizations that reach new families",
    description:
      "Kiddo gives families a head-start investment fund that anyone can add to in about a minute. If your organization reaches new families, let's talk.",
    robots: "noindex,nofollow",
    ogType: "website",
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">For partners</p>
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            You reach new families. We help them start.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Kiddo is a custodial investment account for a child that anyone who loves them can add to in about a
            minute. If your organization touches families at the start of a child's life, that is the moment a head
            start matters most.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/contact"><Button size="lg" data-testid="button-partners-hero-contact">Start a conversation</Button></Link>
            <Link href="/how-it-works"><Button size="lg" variant="outline">See how Kiddo works</Button></Link>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-xs leading-relaxed text-muted-foreground/70">
            This is an early-stage partnership invitation, not a packaged program yet. Tell us your audience and how
            you reach them, and we will shape the right fit together.
          </p>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-3">
          {WHAT_KIDDO_IS.map((c) => (
            <div key={c.title} className="rounded-3xl border border-border bg-card p-7 shadow-premium-sm">
              <h2 className="font-heading text-xl font-semibold text-foreground">{c.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-[32px] border border-border bg-card p-8 shadow-premium-sm md:p-12">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">Who we want to work with</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Organizations that meet families at the beginning: hospitals and birth centers, baby registries,
              pediatric and family practices, schools and PTAs, and employers offering family benefits. If you reach
              new parents, Kiddo is a genuinely useful thing to put in front of them.
            </p>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              We do not run a single one-size partner program. Tell us your audience and how you reach them, and we
              will build the right fit together.
            </p>
            <div className="mt-8">
              <Link href="/contact"><Button data-testid="button-partners-contact">Tell us about your organization</Button></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl border border-border bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">
            <p>
              Kiddo, Inc. is a technology company, not a broker-dealer, investment adviser, or bank. When investing is
              live, funds are held by our broker-dealer partner (Member FINRA/SIPC), not by Kiddo; eligible accounts
              are then SIPC-protected up to $500,000 against brokerage failure, not against market losses. Investing
              involves risk, including possible loss of principal.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
