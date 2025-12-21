import { Gift } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/">
              <a className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
                  <Gift className="h-5 w-5" />
                </div>
                <span className="font-serif text-xl font-bold tracking-tight text-primary">DorVador</span>
              </a>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The registry for future generations. Give gifts that grow, compound, and create lasting financial security.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/create">Start a Registry</Link></li>
              <li><Link href="/registry">Find a Registry</Link></li>
              <li><Link href="#">Sample Registry</Link></li>
              <li><Link href="#">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#">About Us</Link></li>
              <li><Link href="#">Careers</Link></li>
              <li><Link href="#">Blog</Link></li>
              <li><Link href="#">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#">Terms of Service</Link></li>
              <li><Link href="#">Privacy Policy</Link></li>
              <li><Link href="#">Security</Link></li>
              <li><Link href="#">Disclosures</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} DorVador Inc. All rights reserved. Not an investment advisor.</p>
        </div>
      </div>
    </footer>
  );
}
