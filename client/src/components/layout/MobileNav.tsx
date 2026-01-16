import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
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
                whileTap={{ scale: 0.92, y: 1 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex flex-col items-center justify-center py-2 px-4 relative"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon 
                    className={`w-6 h-6 transition-colors duration-150 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`} 
                  />
                </motion.div>
                <span className={`text-[10px] mt-1 transition-colors duration-150 ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                }`}>
                  {item.label}
                </span>
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-primary"
                      transition={{ duration: 0.15, ease: "easeOut" }}
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
