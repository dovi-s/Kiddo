import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, CalendarHeart, Activity, Settings, ShieldCheck } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/dashboard", icon: Wallet, label: "Fund" },
  { href: "/events", icon: CalendarHeart, label: "Events" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const adminNavItem = { href: "/admin", icon: ShieldCheck, label: "Admin" };

export function MobileNav() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const hiddenPaths = ["/checkout", "/get-started", "/onboard", "/activate", "/login", "/claim", "/give", "/send"];
  const shouldHide = hiddenPaths.some(path => location.startsWith(path));
  const isPublicPage = location === "/" || location.startsWith("/faq") || location.startsWith("/about") || location.startsWith("/legal") || location.startsWith("/how-it-works") || location.startsWith("/kid/");
  
  if (shouldHide || isPublicPage || isLoading || !isAuthenticated) return null;

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden gemini-glass-nav border-t border-border/40 px-2 pb-safe"
      style={{ backdropFilter: "blur(24px) saturate(1.4)", WebkitBackdropFilter: "blur(24px) saturate(1.4)" }}
    >
      <div className="flex items-center justify-around h-16">
        {[...navItems, ...(user?.isAdmin ? [adminNavItem] : [])].map((item) => {
          const isActive = location === item.href || 
            (item.href === "/dashboard" && location.startsWith("/dashboard")) ||
            (item.href === "/events" && (location.startsWith("/events") || location.startsWith("/event"))) ||
            (item.href === "/activity" && location.startsWith("/activity")) ||
            (item.href === "/admin" && location.startsWith("/admin"));
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
                onClick={() => !isActive && haptic('selection')}
                className="flex flex-col items-center justify-center py-2 px-5 relative touch-target"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <div className="relative">
                  <Icon 
                    className={`w-[22px] h-[22px] transition-colors duration-150 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`} 
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </div>
                <span className={`text-[10px] mt-1 transition-colors duration-150 ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground"
                }`}>
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
