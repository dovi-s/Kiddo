import { Link } from "wouter";
import { Menu, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";

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
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm"
    >
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Logo size="md" className="text-foreground" />

        <div className="hidden md:flex md:items-center md:gap-6">
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
            <>
              <a 
                href="/#how" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                How it works
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
              </a>
              <a 
                href="/#pricing" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                Pricing
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
              </a>
              <a href="/api/login">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="ghost" size="sm" data-testid="button-login">Log in</Button>
                </motion.div>
              </a>
              <Link href="/get-started">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="sm" data-testid="button-get-started">Get started</Button>
                </motion.div>
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
                  <a href="/#how" onClick={() => setIsOpen(false)} className="font-medium">How it works</a>
                  <a href="/#pricing" onClick={() => setIsOpen(false)} className="font-medium">Pricing</a>
                  <hr />
                  <a href="/api/login" onClick={() => setIsOpen(false)} className="font-medium">Log in</a>
                  <Link href="/get-started"><Button className="w-full" onClick={() => setIsOpen(false)}>Get started</Button></Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.nav>
  );
}
