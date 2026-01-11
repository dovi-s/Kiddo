import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Give from "@/pages/Give";
import Moment from "@/pages/Moment";
import Recipient from "@/pages/Recipient";
import Settings from "@/pages/Settings";
import Onboard from "@/pages/Onboard";
import MomentCreate from "@/pages/MomentCreate";
import Send from "@/pages/Send";
import FundPage from "@/pages/FundPage";
import EventPage from "@/pages/EventPage";
import PageEditor from "@/pages/PageEditor";
import Claim from "@/pages/Claim";
import GetStarted from "@/pages/GetStarted";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/get-started" component={GetStarted} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/give" component={Give} />
      <Route path="/give/:id" component={Give} />
      <Route path="/moment/create" component={MomentCreate} />
      <Route path="/moment" component={Moment} />
      <Route path="/moment/:id" component={Moment} />
      <Route path="/send" component={Send} />
      <Route path="/claim/:token" component={Claim} />
      <Route path="/edit/:fund/:event" component={PageEditor} />
      <Route path="/:slug" component={FundPage} />
      <Route path="/:slug/:event" component={EventPage} />
      <Route path="/recipient" component={Recipient} />
      <Route path="/recipient/:id" component={Recipient} />
      <Route path="/settings" component={Settings} />
      <Route path="/onboard" component={Onboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
