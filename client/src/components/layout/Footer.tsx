import { Link } from "wouter";
import { motion } from "framer-motion";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/">
              <motion.a 
                className="flex items-center gap-2.5 group"
                whileHover={{ x: 2 }}
              >
                <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                  <path 
                    d="M8 6v20M8 16l10-10M8 16l10 10" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="text-foreground"
                  />
                </svg>
                <span className="font-medium text-foreground tracking-wide text-[15px]" style={{ letterSpacing: '0.04em' }}>kora</span>
              </motion.a>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              Give something that stays.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                { href: "/get-started", label: "Get started" },
                { href: "/moment", label: "Send a gift" },
                { href: "/#pricing", label: "Pricing" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <motion.a 
                      className="hover:text-foreground transition-colors inline-block"
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.2 }}
                    >
                      {link.label}
                    </motion.a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {["About", "Trust", "Support"].map((label) => (
                <li key={label}>
                  <motion.a 
                    href="#" 
                    className="hover:text-foreground transition-colors inline-block"
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    {label}
                  </motion.a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Legal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {["Terms", "Privacy", "Disclosures"].map((label) => (
                <li key={label}>
                  <motion.a 
                    href="#" 
                    className="hover:text-foreground transition-colors inline-block"
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    {label}
                  </motion.a>
                </li>
              ))}
            </ul>
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
