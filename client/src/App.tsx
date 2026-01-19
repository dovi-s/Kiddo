import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KoraProvider } from "./lib/KoraContext";
import { MobileNav } from "@/components/layout/MobileNav";
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

function Router() {
  return (
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
      <Route path="/event/create" component={MomentCreate} />
      <Route path="/send" component={Send} />
      <Route path="/claim/:token" component={Claim} />
      <Route path="/edit/:fund/:event" component={PageEditor} />
      <Route path="/settings" component={Settings} />
      <Route path="/:fund" component={GiftCheckout} />
      <Route path="/:fund/:event" component={GiftCheckout} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KoraProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <MobileNav />
        </TooltipProvider>
      </KoraProvider>
    </QueryClientProvider>
  );
}

export default App;
