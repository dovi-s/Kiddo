import { Leaf } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/">
              <a className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Everleaf</span>
              </a>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              Gifts that grow.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/create"><a className="hover:text-foreground transition-colors">Create a fund</a></Link></li>
              <li><Link href="/moment"><a className="hover:text-foreground transition-colors">Send a gift</a></Link></li>
              <li><a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Trust</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4 text-foreground">Legal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Disclosures</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            Everleaf is a technology platform and is not a broker-dealer. Brokerage services provided by [Broker-Dealer], Member FINRA/SIPC. Clearing and custody by Apex Clearing Corporation, Member FINRA/SIPC. SIPC protects against broker failure, not market losses.
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Everleaf Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
