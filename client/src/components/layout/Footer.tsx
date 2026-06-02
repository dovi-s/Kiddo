import { Link } from "wouter";
import { Logo } from "@/components/ui/logo";

const topRowLinks: Array<{ href: string; label: string; external?: boolean }> = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/give-a-gift", label: "Give a gift" },
  { href: "/demo", label: "See it live" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/stories", label: "Stories" },
  { href: "/blog", label: "Guides" },
];

const bottomRowLinks: Array<{ href: string; label: string; external?: boolean }> = [
  { href: "/compare", label: "Compare" },
  { href: "/tools/at-18-calculator", label: "At-18 calculator" },
  { href: "/tools/utma-by-state", label: "UTMA by state" },
  { href: "/security", label: "Security" },
  { href: "/age-18", label: "Age-18" },
  { href: "/personal-funds", label: "Personal funds" },
  { href: "/legal?tab=privacy", label: "Privacy policy" },
  { href: "/legal?tab=terms", label: "Terms of service" },
  { href: "/contact", label: "Contact" },
];

function FooterLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  const className =
    "inline-block cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground";

  if (external) {
    return (
      <a
        href={href}
        className={className}
        data-testid={`link-footer-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      data-testid={`link-footer-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="container mx-auto px-4 py-14 md:py-16">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <Logo size="md" className="text-foreground" linkTo={null} />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Give something that grows with them.
          </p>
        </div>

        <div className="mt-10 border-t border-border/50 pt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {topRowLinks.map((link) => (
              <FooterLink key={link.label} href={link.href} label={link.label} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {bottomRowLinks.map((link) => (
              <FooterLink key={link.label} href={link.href} label={link.label} external={link.external} />
            ))}
            <a
              href="mailto:support@kiddofund.com"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              data-testid="link-footer-support-email"
            >
              support@kiddofund.com
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-border/50 pt-6 text-center">
          <p className="mx-auto max-w-3xl text-xs leading-relaxed text-muted-foreground">
            When investing is live, investments are held by our broker-dealer partner (Member FINRA/SIPC), not by Kiddo. Investing involves risk, including possible loss of principal. Investments are not FDIC insured, not bank guaranteed, and may lose value. Past performance is not indicative of future results.
          </p>
          {/* Simulated-content disclosure — FINRA Rule 2210 covers
              communications-with-the-public; marketing surfaces showing
              example app screens, hypothetical testimonials with specific
              dollar amounts, or sample Memory Book entries need this line.
              Footer is the catch-all because it renders on 23 pages
              including Home / Pricing / Compare / HowItWorks / About — all
              of which carry simulated example content. Safe-to-add-now per
              the locked honest-disclosure trio in
              project_launch_readiness_drivewealth.md (entity-agnostic,
              industry-standard wording, no RIA claim implied). */}
          <p className="mx-auto mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Screen images and example dollar amounts shown across the site are simulated and subject to change. They illustrate how Kiddo works and do not reflect any specific account or guaranteed outcome.
          </p>
          {/* Geographic scope. Kora is currently US-only — UTMA legal
              structure + US-resident brokerage + 1099 tax reporting. The
              footer is the catch-all surface for visitors who missed the
              cue on Home / Pricing / signup. */}
          <p className="mx-auto mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Currently available to families in the United States.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kiddo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
