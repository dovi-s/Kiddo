import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Wallet, CalendarHeart, Activity, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: Wallet, label: "Fund" },
  { href: "/events", icon: CalendarHeart, label: "Events" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNav() {
  const [location] = useLocation();
  
  const hiddenPaths = ["/checkout", "/get-started", "/onboard", "/activate", "/login", "/claim"];
  const shouldHide = hiddenPaths.some(path => location.startsWith(path));
  
  if (shouldHide) return null;

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
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex flex-col items-center justify-center py-3 px-5 relative touch-target"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`p-2 rounded-2xl transition-colors duration-150 ${
                    isActive ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon 
                    className={`w-7 h-7 transition-colors duration-150 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`} 
                  />
                </motion.div>
                <span className={`text-xs mt-1.5 transition-colors duration-150 font-medium ${
                  isActive ? "text-primary" : "text-muted-foreground"
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
