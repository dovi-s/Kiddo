import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, CalendarHeart, Activity, Settings } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";

const navItems = [
  { href: "/dashboard", icon: Wallet, label: "Fund" },
  { href: "/events", icon: CalendarHeart, label: "Events" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNav() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  
  const hiddenPaths = ["/checkout", "/get-started", "/onboard", "/activate", "/login", "/claim", "/give"];
  const shouldHide = hiddenPaths.some(path => location.startsWith(path));
  
  const hasActiveFund = funds.some((f: { status: string }) => f.status === 'active');
  
  if (shouldHide || isLoading || fundsLoading || !isAuthenticated || !hasActiveFund) return null;

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/98 backdrop-blur-2xl border-t border-border/50 px-2 pb-safe shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center justify-around h-20">
        {navItems.map((item) => {
          const isActive = location === item.href || 
            (item.href === "/dashboard" && location.startsWith("/dashboard")) ||
            (item.href === "/events" && (location.startsWith("/events") || location.startsWith("/event"))) ||
            (item.href === "/activity" && location.startsWith("/activity"));
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => !isActive && haptic('selection')}
                className="flex flex-col items-center justify-center py-3 px-5 relative touch-target"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <motion.div
                  layout
                  className={`p-2 rounded-2xl transition-colors duration-200 ${
                    isActive ? "bg-primary/12" : ""
                  }`}
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.08 : 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <Icon 
                      className={`w-6 h-6 transition-colors duration-200 ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`} 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </motion.div>
                </motion.div>
                <span className={`text-[11px] mt-1 transition-all duration-200 ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                }`}>
                  {item.label}
                </span>
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute -top-0.5 w-1 h-1 rounded-full bg-primary"
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
