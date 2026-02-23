import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KoraProvider } from "./lib/KoraContext";
import { MobileNav } from "@/components/layout/MobileNav";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import Activity from "@/pages/Activity";
import ActivityDetail from "@/pages/ActivityDetail";
import Onboard from "@/pages/Onboard";
import MomentCreate from "@/pages/MomentCreate";
import Send from "@/pages/Send";
import PageEditor from "@/pages/PageEditor";
import Claim from "@/pages/Claim";
import GetStarted from "@/pages/GetStarted";
import ActivateInvesting from "@/pages/ActivateInvesting";
import GiftCheckout from "@/pages/GiftCheckout";
import Login from "@/pages/Login";
import Events from "@/pages/Events";
import EventCreate from "@/pages/EventCreate";
import FAQ from "@/pages/FAQ";
import MemoryBook from "@/pages/MemoryBook";
import GiftSuccess from "@/pages/GiftSuccess";
import KidView from "@/pages/KidView";
import About from "@/pages/About";
import Legal from "@/pages/Legal";
import brandMark from "@/assets/kora-brand-mark.png";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
    <ScrollToTop />
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/get-started" component={GetStarted} />
      <Route path="/onboard" component={Onboard} />
      <Route path="/activate" component={ActivateInvesting} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/activity" component={Activity} />
      <Route path="/activity/:id" component={ActivityDetail} />
      <Route path="/events" component={Events} />
      <Route path="/event/create" component={EventCreate} />
      <Route path="/send" component={Send} />
      <Route path="/claim/:token" component={Claim} />
      <Route path="/edit/:fund/:event" component={PageEditor} />
      <Route path="/settings" component={Settings} />
      <Route path="/faq" component={FAQ} />
      <Route path="/how-it-works">{() => { window.location.href = "/#how-it-works"; return null; }}</Route>
      <Route path="/about" component={About} />
      <Route path="/legal" component={Legal} />
      <Route path="/memory/:fundId" component={MemoryBook} />
      <Route path="/gift/success" component={GiftSuccess} />
      <Route path="/kid/:fundId" component={KidView} />
      <Route path="/:fund" component={GiftCheckout} />
      <Route path="/:fund/:event" component={GiftCheckout} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-background gemini-warm-section flex items-center justify-center" data-testid="splash-screen">
      <div className="text-center">
        <img
          src={brandMark}
          alt="Kora"
          data-testid="img-brand-mark-splash"
          className="w-44 h-auto mx-auto animate-splash-enter"
        />
        <div className="mt-6 flex justify-center gap-1 animate-splash-dots">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary/40"
              style={{ animation: `splashDot 1.2s ease-in-out ${i * 0.15}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    if (sessionStorage.getItem("kora-launched")) return false;
    return true;
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem("kora-launched", "1");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <KoraProvider>
        <TooltipProvider>
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          <Toaster />
          <DesktopSidebar />
          <Router />
          <MobileNav />
        </TooltipProvider>
      </KoraProvider>
    </QueryClientProvider>
  );
}

export default App;
