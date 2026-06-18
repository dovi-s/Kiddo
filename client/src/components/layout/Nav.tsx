import { Link } from "wouter";
import { ArrowRight, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";

// Marketing-surface nav (Home, About, FAQ, Demo, the public pages). The
// authenticated app uses its own shell (DesktopSidebar / AppHeader), so the
// old `showDashboard` prop + its Dashboard / "{Name}'s View" / Settings
// branches were dead code no caller ever rendered — and the "{Name}'s View"
// link pointed at /recipient, a route that doesn't exist. Removed 2026-06-03;
// if an in-app nav is ever needed here again, link real routes (/dashboard,
// /settings) and the per-fund Kid View share flow, not /recipient.
//
// AUTH-AWARE (2026-06-04): a signed-in user who lands on a public page (the
// app links to /legal, /pricing, the footer everywhere) used to see
// "Log in / Start for free" — reads as "you're logged out" and offers no way
// back into the app. When a session exists, the CTA pair swaps to one
// "Back to your dashboard" link (/dashboard — same default Login uses).
// useAuth's session query is cached (5-min staleTime), so this costs at most
// one lightweight /api/auth/user fetch per public-page visit.
export function Nav() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  // A demo session counts as authenticated, but it is NOT the visitor's real
  // account — so don't promise them "your dashboard." Send them back to the demo
  // (honest, keeps their place); the page body's CTAs carry the real conversion.
  const isDemo = !!(user as any)?.isDemoAccount;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg"
    >
      {/* Equal flex-1 wings keep the center links TRULY centered regardless
          of flank width. With plain justify-between, the middle group was
          only centered when the left/right sides happened to balance — the
          wider auth-aware "Back to your dashboard" button (2026-06-04)
          visibly shoved How-it-works/Pricing/Stories off center. */}
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex flex-1 items-center justify-start">
          <Logo size="md" className="text-foreground" />
        </div>

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

        <div className="flex flex-1 items-center justify-end gap-4">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="sm" variant="outline" data-testid="button-back-to-dashboard-nav" onClick={() => haptic('light')}>
                {isDemo ? "Back to the demo" : "Back to your dashboard"}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
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
                <Link href="/how-it-works" onClick={() => setIsOpen(false)} className="font-medium">How it works</Link>
                <Link href="/pricing" onClick={() => setIsOpen(false)} className="font-medium">Pricing</Link>
                <Link href="/stories" onClick={() => setIsOpen(false)} className="font-medium">Stories</Link>
                <Link href="/faq" onClick={() => setIsOpen(false)} className="font-medium">FAQ</Link>
                <Link href="/about" onClick={() => setIsOpen(false)} className="font-medium">About</Link>
                <Link href="/blog" onClick={() => setIsOpen(false)} className="font-medium">Guides</Link>
                <hr />
                {isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button className="w-full" variant="outline" onClick={() => setIsOpen(false)} data-testid="button-back-to-dashboard-sheet">
                      {isDemo ? "Back to the demo" : "Back to your dashboard"}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <>
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
