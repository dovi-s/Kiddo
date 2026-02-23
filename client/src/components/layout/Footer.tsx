import { Link } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Mascot } from "@/components/ui/mascot";

export function Footer() {
  const productLinks = [
    { href: "/get-started", label: "Get started" },
    { href: "/faq", label: "How it works" },
    { href: "/#pricing", label: "Pricing" },
  ];

  const companyLinks = [
    { href: "/about", label: "About" },
    { href: "/about#trust", label: "Trust" },
    { href: "/faq", label: "Support" },
  ];

  const legalLinks = [
    { href: "/legal", label: "Terms" },
    { href: "/legal", label: "Privacy" },
    { href: "/legal", label: "Disclosures" },
  ];

  const renderLinks = (links: { href: string; label: string }[]) => (
    <ul className="space-y-3 text-sm text-muted-foreground">
      {links.map((link) => (
        <li key={link.label}>
          <Link href={link.href}>
            <motion.span
              className="hover:text-foreground transition-colors inline-block cursor-pointer"
              whileHover={{ x: 2 }}
              transition={{ duration: 0.2 }}
              data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {link.label}
            </motion.span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mascot size="sm" context="footer" />
              <Logo size="sm" className="text-foreground" linkTo={null} />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              Give something that grows.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Product</h4>
            {renderLinks(productLinks)}
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Company</h4>
            {renderLinks(companyLinks)}
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Legal</h4>
            {renderLinks(legalLinks)}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            Kora is a technology platform and is not a broker-dealer. Brokerage services by Alpaca Securities LLC, member FINRA/SIPC. Clearing and custody by Apex Clearing Corporation, member FINRA/SIPC. SIPC protects against broker failure, not market losses.
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kora Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
