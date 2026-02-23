import { Link, useLocation } from "wouter";
import { Wallet, CalendarHeart, Activity, Settings, LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";

const navItems = [
  { href: "/dashboard", icon: Wallet, label: "Fund" },
  { href: "/events", icon: CalendarHeart, label: "Events" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function DesktopSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const hiddenPaths = ["/checkout", "/get-started", "/onboard", "/activate", "/login", "/claim", "/give", "/send"];
  const shouldHide = hiddenPaths.some(path => location.startsWith(path));
  const isHome = location === "/";

  if (shouldHide || isHome || isLoading || !isAuthenticated) return null;

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] lg:w-[260px] z-50 flex-col bg-background border-r border-border/40" data-testid="desktop-sidebar">
      <div className="px-6 h-16 flex items-center">
        <Logo size="md" className="text-foreground" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href ||
            (item.href === "/dashboard" && location.startsWith("/dashboard")) ||
            (item.href === "/events" && (location.startsWith("/events") || location.startsWith("/event"))) ||
            (item.href === "/activity" && location.startsWith("/activity"));
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={() => !isActive && haptic('selection')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                data-testid={`sidebar-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border/40">
        {user && (
          <Link href="/settings">
            <div
              onClick={() => haptic('selection')}
              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
              data-testid="sidebar-user-profile"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold overflow-hidden">
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  user.firstName?.charAt(0) || "U"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.firstName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </Link>
        )}
        <button
          onClick={() => { haptic('medium'); logout(); }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
          data-testid="sidebar-logout"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
