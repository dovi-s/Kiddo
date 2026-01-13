import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Wallet, PlusCircle, Gift, User } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: Wallet, label: "Funds" },
  { href: "/get-started", icon: PlusCircle, label: "Create", isAction: true },
  { href: "/send", icon: Gift, label: "Send" },
  { href: "/settings", icon: User, label: "Account" },
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
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-stone-200 px-2 pb-safe"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location === item.href || 
            (item.href === "/dashboard" && location.startsWith("/dashboard"));
          const Icon = item.icon;
          
          if (item.isAction) {
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center justify-center -mt-6"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <div className="w-14 h-14 rounded-full bg-stone-900 flex items-center justify-center shadow-lg shadow-stone-900/30">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">{item.label}</span>
                </motion.div>
              </Link>
            );
          }
          
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center justify-center py-2 px-3 relative"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon 
                  className={`w-6 h-6 transition-colors ${
                    isActive ? "text-stone-900" : "text-stone-400"
                  }`} 
                />
                <span className={`text-[10px] mt-1 transition-colors ${
                  isActive ? "text-stone-900 font-medium" : "text-stone-400"
                }`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-stone-900"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
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
