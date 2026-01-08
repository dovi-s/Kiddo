import { Leaf } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t bg-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/">
              <a className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-primary" />
                <span className="font-serif text-xl font-semibold text-foreground">Everleaf</span>
              </a>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              A gift layer for life events. Contributors give. Recipients grow.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/create"><a className="text-foreground/80 hover:text-foreground transition-colors">Create a Profile</a></Link></li>
              <li><Link href="/give"><a className="text-foreground/80 hover:text-foreground transition-colors">Give a Gift</a></Link></li>
              <li><Link href="/#how"><a className="text-foreground/80 hover:text-foreground transition-colors">How It Works</a></Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-foreground/80 hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="text-foreground/80 hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="text-foreground/80 hover:text-foreground transition-colors">Careers</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-foreground/80 hover:text-foreground transition-colors">Terms</a></li>
              <li><a href="#" className="text-foreground/80 hover:text-foreground transition-colors">Privacy</a></li>
              <li><a href="#" className="text-foreground/80 hover:text-foreground transition-colors">Disclosures</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Everleaf Inc. All rights reserved. Not investment advice.</p>
        </div>
      </div>
    </footer>
  );
}
