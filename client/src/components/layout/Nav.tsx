import { Link } from "wouter";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";

// Marketing-surface nav (Home, About, FAQ, Demo, the public pages). The
// authenticated app uses its own shell (DesktopSidebar / AppHeader), so the
// old `showDashboard` prop + its Dashboard / "{Name}'s View" / Settings
// branches were dead code no caller ever rendered — and the "{Name}'s View"
// link pointed at /recipient, a route that doesn't exist. Removed 2026-06-03;
// if an in-app nav is ever needed here again, link real routes (/dashboard,
// /settings) and the per-fund Kid View share flow, not /recipient.
export function Nav() {
  const [isOpen, setIsOpen] = useState(false);

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
          {/* Desktop nav restraint: 3 second-tier surfaces + 1 CTA.
              Hera / Stripe register. The earlier 5-item set (How It
              Works / FAQ / Pricing / About / Guides) creeped past the
              discipline; FAQ + About + Guides are demoted to the footer
              (and remain in the mobile sheet for thumb-reach access).
              The three slots are the questions a first-time visitor
              actually asks: "what does it do," "what does it cost,"
              "do other parents use it." See PRODUCT.md §3 (competitive
              frame) for why Stories beats Compare in the third slot —
              the proof gallery is the moat surface. */}
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
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login" data-testid="link-login">
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer hidden md:inline">Log in</span>
          </Link>
          <Link href="/get-started">
            <Button size="sm" data-testid="button-get-started-nav" onClick={() => haptic('light')}>
              Start for free
            </Button>
          </Link>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <div className="flex flex-col gap-6 pt-10">
                <Link href="/how-it-works" onClick={() => setIsOpen(false)} className="font-medium">How it works</Link>
                <Link href="/pricing" onClick={() => setIsOpen(false)} className="font-medium">Pricing</Link>
                <Link href="/stories" onClick={() => setIsOpen(false)} className="font-medium">Stories</Link>
                <Link href="/faq" onClick={() => setIsOpen(false)} className="font-medium">FAQ</Link>
                <Link href="/about" onClick={() => setIsOpen(false)} className="font-medium">About</Link>
                <Link href="/blog" onClick={() => setIsOpen(false)} className="font-medium">Guides</Link>
                <hr />
                <Link href="/login" onClick={() => setIsOpen(false)} className="font-medium">Log in</Link>
                <Link href="/get-started"><Button className="w-full" onClick={() => setIsOpen(false)}>Start for free</Button></Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.nav>
  );
}
