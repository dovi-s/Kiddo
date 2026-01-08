import { Link } from "wouter";
import { Leaf, Menu, Settings, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavProps {
  showDashboard?: boolean;
  accountType?: string;
  profileName?: string;
}

export function Nav({ showDashboard, accountType, profileName }: NavProps) {
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
          {showDashboard ? (
            <>
              <Link href={`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName || "")}`}>
                <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
              </Link>
              <Link href={`/recipient?name=${encodeURIComponent(profileName || "")}`}>
                <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {accountType === "personal" ? "My View" : `${profileName}'s View`}
                </a>
              </Link>
              <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName || "")}`}>
                <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
              </Link>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {(profileName || "U").charAt(0)}
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <div className="flex flex-col gap-6 pt-10">
              {showDashboard ? (
                <>
                  <Link href={`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName || "")}`}>
                    <a onClick={() => setIsOpen(false)} className="font-medium">Dashboard</a>
                  </Link>
                  <Link href={`/recipient?name=${encodeURIComponent(profileName || "")}`}>
                    <a onClick={() => setIsOpen(false)} className="font-medium">
                      {accountType === "personal" ? "My View" : `${profileName}'s View`}
                    </a>
                  </Link>
                  <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName || "")}`}>
                    <a onClick={() => setIsOpen(false)} className="font-medium">Settings</a>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/#how"><a onClick={() => setIsOpen(false)} className="font-medium">How it works</a></Link>
                  <Link href="/moment"><a onClick={() => setIsOpen(false)} className="font-medium">Send a gift</a></Link>
                  <hr />
                  <Link href="/dashboard"><a onClick={() => setIsOpen(false)} className="font-medium">Log in</a></Link>
                  <Link href="/create"><Button className="w-full" onClick={() => setIsOpen(false)}>Get started</Button></Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
