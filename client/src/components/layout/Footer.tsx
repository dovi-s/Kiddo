import { Leaf } from "lucide-react";
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
                className="flex items-center gap-2 group"
                whileHover={{ x: 2 }}
              >
                <motion.div whileHover={{ rotate: 10 }} transition={{ duration: 0.2 }}>
                  <Leaf className="h-5 w-5 text-primary" />
                </motion.div>
                <span className="font-semibold text-foreground tracking-tight">Everleaf</span>
              </motion.a>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              Gifts that grow.
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
            Everleaf is a technology platform and is not a broker-dealer. Brokerage services by Alpaca Securities LLC, member FINRA/SIPC. Clearing and custody by Apex Clearing Corporation, member FINRA/SIPC. SIPC protects against broker failure, not market losses.
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Everleaf Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
