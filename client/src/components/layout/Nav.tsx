import { Link, useLocation } from "wouter";
import { Leaf, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/">
          <a className="flex items-center gap-2 group" data-testid="link-home">
            <Leaf className="h-6 w-6 text-primary transition-transform group-hover:rotate-12" />
            <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">Everleaf</span>
          </a>
        </Link>

        <div className="hidden md:flex md:items-center md:gap-8">
          <Link href="/#how">
            <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">How It Works</a>
          </Link>
          <Link href="/give">
            <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Give a Gift</a>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" data-testid="button-login">Log In</Button>
          </Link>
          <Link href="/create">
            <Button data-testid="button-get-started">Get Started</Button>
          </Link>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <div className="flex flex-col gap-6 pt-10">
              <Link href="/#how"><a onClick={() => setIsOpen(false)} className="text-lg font-medium">How It Works</a></Link>
              <Link href="/give"><a onClick={() => setIsOpen(false)} className="text-lg font-medium">Give a Gift</a></Link>
              <hr />
              <Link href="/dashboard"><a onClick={() => setIsOpen(false)} className="text-lg font-medium">Log In</a></Link>
              <Link href="/create"><Button className="w-full" onClick={() => setIsOpen(false)}>Get Started</Button></Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
