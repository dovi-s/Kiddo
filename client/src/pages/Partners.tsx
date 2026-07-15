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

import { useState } from "react";
import { Link } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePageSeo } from "@/lib/seo";

const ORG_TYPES = [
  "Hospital or birth center",
  "Baby registry",
  "Pediatric or family practice",
  "School or PTA",
  "Employer or benefits",
  "Other",
] as const;

// Persisted lead capture for the (unlisted) /partners page. Posts to
// /api/partners/inquiry (rate-limited, stored in partner_inquiries) instead of a
// raw mailto, so an inbound partner is never lost to an email client that never
// opens. Copy stays honest: an invitation to explore, not a packaged program.
function PartnerInquiryForm() {
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setError("");
    try {
      const res = await fetch("/api/partners/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, orgType, contactName, email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data && data.error) || "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div
        className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center"
        data-testid="partner-inquiry-success"
      >
        <p className="font-heading text-lg font-semibold text-foreground">Thanks. We have your note.</p>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          We read every one of these ourselves and will reach out to talk through the right fit.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" data-testid="partner-inquiry-form">
      <div className="sm:col-span-2">
        <Label htmlFor="pi-org">Organization name</Label>
        <Input
          id="pi-org"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          maxLength={200}
          placeholder="Riverside Birth Center"
          className="mt-1.5"
          data-testid="input-partner-org"
        />
      </div>
      <div>
        <Label htmlFor="pi-type">What kind of organization</Label>
        <select
          id="pi-type"
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="select-partner-type"
        >
          <option value="">Select one</option>
          {ORG_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="pi-name">Your name</Label>
        <Input
          id="pi-name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          maxLength={120}
          placeholder="Jordan Lee"
          className="mt-1.5"
          data-testid="input-partner-name"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="pi-email">Email</Label>
        <Input
          id="pi-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={200}
          placeholder="you@organization.org"
          className="mt-1.5"
          data-testid="input-partner-email"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="pi-message">How you reach families (optional)</Label>
        <Textarea
          id="pi-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="Tell us about your audience and how you connect with new parents."
          className="mt-1.5"
          data-testid="input-partner-message"
        />
      </div>
      {state === "error" && (
        <p className="sm:col-span-2 text-sm text-destructive" data-testid="partner-inquiry-error">{error}</p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={state === "submitting"} data-testid="button-partner-submit">
          {state === "submitting" ? "Sending..." : "Send"}
        </Button>
      </div>
    </form>
  );
}

const WHAT_KIDDO_IS = [
  {
    title: "A fund, not a card",
    body: "A custodial UTMA investment account for the child. Real ownership, no spending restrictions, fully theirs at the state's age of majority.",
  },
  {
    title: "Anyone can give in seconds",
    body: "A shareable gift link, with no account needed to give. Grandparents, aunts, and friends all add to the same fund, and every gift carries a note in the Memory Book.",
  },
  {
    title: "Built for the long horizon",
    body: "The fund grows toward the child's 18th birthday and beyond. Free to start; the only ongoing investment fee is $1 a year per $1,000 invested.",
  },
];

export default function Partners() {
  usePageSeo({
    title: "Partner with Kiddo | For organizations that reach new families",
    description:
      "Kiddo gives families a head-start investment fund that anyone can add to in seconds. If your organization reaches new families, let's talk.",
    robots: "noindex,nofollow",
    ogType: "website",
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">For partners</p>
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-[-0.03em] text-foreground md:text-6xl">
            You reach new families. We help them start.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Kiddo is a custodial investment account for a child that anyone who loves them can add to in seconds.
            If your organization touches families at the start of a child's life, that is the moment a head
            start matters most.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {/* Scrolls to the persisted inquiry form below (was a raw mailto). */}
            <a href="#partner-inquiry"><Button size="lg" data-testid="button-partners-hero-contact">Start a conversation</Button></a>
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
            <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground">Who we want to work with</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Organizations that meet families at the beginning: hospitals and birth centers, baby registries,
              pediatric and family practices, schools and PTAs, and employers offering family benefits. If you reach
              new parents, Kiddo is a genuinely useful thing to put in front of them.
            </p>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              We do not run a single one-size partner program. Tell us your audience and how you reach them, and we
              will build the right fit together.
            </p>
            <div className="mt-8 scroll-mt-24" id="partner-inquiry">
              <PartnerInquiryForm />
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
