import { Link } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Mascot } from "@/components/ui/mascot";

export function Footer() {
  const productLinks = [
    { href: "/get-started", label: "Get Started" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/faq", label: "FAQ" },
  ];

  const companyLinks = [
    { href: "/about", label: "About" },
    { href: "/about#trust", label: "Trust & Security" },
  ];

  const legalLinks = [
    { href: "/legal", label: "Terms of Service" },
    { href: "/legal", label: "Privacy Policy" },
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
    <footer className="border-t border-border/40">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mascot size="sm" context="footer" />
              <Logo size="md" className="text-foreground" linkTo={null} />
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
            Securities offered through our clearing partners. Not FDIC insured. Not bank guaranteed. May lose value.
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kora. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
