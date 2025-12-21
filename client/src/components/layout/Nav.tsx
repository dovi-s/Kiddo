import { Link, useLocation } from "wouter";
import { Gift, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Nav() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { label: "Find a Registry", href: "/registry" },
    { label: "For Parents", href: "/create" },
    { label: "About Us", href: "/#about" },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/">
          <a className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <Gift className="h-5 w-5" />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight text-primary">DorVador</span>
          </a>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex md:items-center md:gap-8">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                {item.label}
              </a>
            </Link>
          ))}
          <Link href="/dashboard">
            <Button variant="outline" className="border-primary/20 hover:bg-primary/5">
              Log In
            </Button>
          </Link>
          <Link href="/create">
            <Button>Start a Registry</Button>
          </Link>
        </div>

        {/* Mobile Nav */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <div className="flex flex-col gap-8 pt-10">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a 
                    className="text-lg font-semibold"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </a>
                </Link>
              ))}
              <hr />
              <Link href="/dashboard">
                <a onClick={() => setIsOpen(false)} className="text-lg font-semibold">Log In</a>
              </Link>
              <Link href="/create">
                <Button className="w-full" onClick={() => setIsOpen(false)}>Start a Registry</Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
