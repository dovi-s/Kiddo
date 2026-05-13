import { Link } from "wouter";
import { Menu, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";

interface NavProps {
  showDashboard?: boolean;
  accountType?: string;
  profileName?: string;
}

export function Nav({ showDashboard, accountType, profileName }: NavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  
  const displayName = user?.firstName || profileName || "User";

  return (
    <motion.nav 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg"
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo size="md" className="text-foreground" />

        <div className="hidden md:flex md:items-center md:gap-8">
          {showDashboard ? (
            <>
              <Link 
                href={`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName || "")}`} 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link 
                href={`/recipient?name=${encodeURIComponent(profileName || "")}`} 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {accountType === "personal" ? "My View" : `${profileName}'s View`}
              </Link>
              <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName || "")}`}>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
                </motion.div>
              </Link>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-medium"
              >
                {(profileName || "U").charAt(0)}
              </motion.div>
            </>
          ) : (
            // Desktop nav restraint: 3 second-tier surfaces + 1 CTA.
            // Hera / Stripe register. The earlier 5-item set (How It
            // Works / FAQ / Pricing / About / Guides) creeped past the
            // discipline; FAQ + About + Guides are demoted to the footer
            // (and remain in the mobile sheet for thumb-reach access).
            // The three slots are the questions a first-time visitor
            // actually asks: "what does it do," "what does it cost,"
            // "do other parents use it." See PRODUCT.md §3 (competitive
            // frame) for why Stories beats Compare in the third slot —
            // the proof gallery is the moat surface.
            <>
              <Link
                href="/how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-how-it-works-nav"
              >
                How it works
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-pricing-nav"
              >
                Pricing
              </Link>
              <Link href="/stories" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-stories-nav">
                Stories
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!showDashboard && (
            <>
              <Link href="/login" data-testid="link-login">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer hidden md:inline">Log in</span>
              </Link>
              <Link href="/get-started">
                <Button size="sm" data-testid="button-get-started-nav" onClick={() => haptic('light')}>
                  Start for free
                </Button>
              </Link>
            </>
          )}

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
                    <Link href={`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName || "")}`} onClick={() => setIsOpen(false)} className="font-medium">
                      Dashboard
                    </Link>
                    <Link href={`/recipient?name=${encodeURIComponent(profileName || "")}`} onClick={() => setIsOpen(false)} className="font-medium">
                      {accountType === "personal" ? "My View" : `${profileName}'s View`}
                    </Link>
                    <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName || "")}`} onClick={() => setIsOpen(false)} className="font-medium">
                      Settings
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/how-it-works" onClick={() => setIsOpen(false)} className="font-medium">How it works</Link>
                    <Link href="/pricing" onClick={() => setIsOpen(false)} className="font-medium">Pricing</Link>
                    <Link href="/stories" onClick={() => setIsOpen(false)} className="font-medium">Stories</Link>
                    <Link href="/faq" onClick={() => setIsOpen(false)} className="font-medium">FAQ</Link>
                    <Link href="/about" onClick={() => setIsOpen(false)} className="font-medium">About</Link>
                    <Link href="/blog" onClick={() => setIsOpen(false)} className="font-medium">Guides</Link>
                    <hr />
                    <Link href="/login" onClick={() => setIsOpen(false)} className="font-medium">Log in</Link>
                    <Link href="/get-started"><Button className="w-full" onClick={() => setIsOpen(false)}>Start for free</Button></Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.nav>
  );
}
