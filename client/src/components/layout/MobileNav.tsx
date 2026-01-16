import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home, Wallet, Activity, Settings } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: Wallet, label: "Funds" },
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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border px-2 pb-safe"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location === item.href || 
            (item.href === "/dashboard" && location.startsWith("/dashboard")) ||
            (item.href === "/activity" && location.startsWith("/activity"));
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center justify-center py-2 px-4 relative"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon 
                  className={`w-6 h-6 transition-colors duration-150 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`} 
                />
                <span className={`text-[10px] mt-1 transition-colors duration-150 ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                }`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    transition={{ duration: 0.15 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
