import { Link } from "wouter";
import { Leaf, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/">
          <a className="flex items-center gap-2" data-testid="link-home">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Everleaf</span>
          </a>
        </Link>

        <div className="hidden md:flex md:items-center md:gap-6">
          <Link href="/#how">
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
          </Link>
          <Link href="/moment">
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">Send a gift</a>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-login">Log in</Button>
          </Link>
          <Link href="/create">
            <Button size="sm" data-testid="button-get-started">Get started</Button>
          </Link>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <div className="flex flex-col gap-6 pt-10">
              <Link href="/#how"><a onClick={() => setIsOpen(false)} className="font-medium">How it works</a></Link>
              <Link href="/moment"><a onClick={() => setIsOpen(false)} className="font-medium">Send a gift</a></Link>
              <hr />
              <Link href="/dashboard"><a onClick={() => setIsOpen(false)} className="font-medium">Log in</a></Link>
              <Link href="/create"><Button className="w-full" onClick={() => setIsOpen(false)}>Get started</Button></Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
