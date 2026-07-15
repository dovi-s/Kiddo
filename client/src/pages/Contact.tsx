import { Link } from "wouter";
import { Clock, Mail, MessageSquare } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/lib/seo";

export default function Contact() {
  usePageSeo({
    title: "Contact Kiddo | We respond to every message.",
    description: "Questions about Kiddo? Email us. We respond to every message. For transfers, support, security, and press inquiries.",
    ogType: "website",
  });

  return (
    <main className="min-h-screen bg-background">
      <Nav />

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">Contact</p>
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-[-0.03em] text-foreground md:text-6xl">
            We respond to every message.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            A person reads every message and writes back, never a bot. Here is exactly who to contact and what to expect.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold text-foreground">General support</h2>
              <a
                href="mailto:support@kiddofund.com"
                className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
                data-testid="link-contact-support-email"
              >
                support@kiddofund.com
              </a>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Response time: within 24 hours.</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold text-foreground">Transfers and security</h2>
              <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                <p><a href="mailto:transfers@kiddofund.com" className="text-primary underline-offset-4 hover:underline">transfers@kiddofund.com</a></p>
                <p><a href="mailto:security@kiddofund.com" className="text-primary underline-offset-4 hover:underline">security@kiddofund.com</a></p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold text-foreground">Press and legal</h2>
              <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                <p><a href="mailto:press@kiddofund.com" className="text-primary underline-offset-4 hover:underline">press@kiddofund.com</a></p>
                <p><a href="mailto:legal@kiddofund.com" className="text-primary underline-offset-4 hover:underline">legal@kiddofund.com</a></p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-border/60 bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">What helps us answer faster</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Include the fund name, the page you were on, and what happened. If the issue is gift-related, include the date and amount so we can trace it quickly.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link href="/get-started">
              <Button data-testid="button-contact-primary">Start your child&apos;s fund</Button>
            </Link>
            <Link href="/faq">
              <Button variant="outline" data-testid="button-contact-secondary">Read the FAQ</Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
