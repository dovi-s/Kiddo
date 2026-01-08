import { Leaf } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <Link href="/">
              <a className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Everleaf</span>
              </a>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A modern way to give a gift that lasts.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-3 text-foreground">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/create"><a className="hover:text-foreground transition-colors">Create a fund</a></Link></li>
              <li><Link href="/moment"><a className="hover:text-foreground transition-colors">Send a gift</a></Link></li>
              <li><Link href="/#how"><a className="hover:text-foreground transition-colors">How it works</a></Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3 text-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Trust & Security</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3 text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Disclosures</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Everleaf Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
