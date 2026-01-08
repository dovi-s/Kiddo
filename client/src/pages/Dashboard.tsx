import { useState } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, QrCode, Copy, Users, Gift, MessageSquare, TrendingUp, Check, ExternalLink, PieChart, Shield, CheckCircle2, Clock, ArrowUpRight, ArrowRight, Landmark, Sparkles, Share2, Settings, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";

const HOLDINGS = [
  { name: "Total Stock Market", ticker: "VTI", value: 2125, allocation: 50, change: 12.4 },
  { name: "International Stocks", ticker: "VXUS", value: 850, allocation: 20, change: 8.2 },
  { name: "Bond Index", ticker: "BND", value: 637, allocation: 15, change: 2.1 },
  { name: "Cash (Seed)", ticker: "—", value: 638, allocation: 15, change: 0 },
];

const ACTIVITY = [
  { type: "invested", desc: "Contribution invested into Future Fund", time: "Today, 4:30 PM" },
  { type: "invested", desc: "Contribution invested into Future Fund", time: "Yesterday" },
  { type: "pending", desc: "New contribution pending investment", time: "Today, 2:15 PM" },
];

export default function Dashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || (accountType === "personal" ? "My Fund" : "Ari"));
  const userEmail = decodeURIComponent(params.get("email") || "you@example.com");
  const isPersonal = accountType === "personal";

  const [isNewUser, setIsNewUser] = useState(true);
  
  const getOnboardingSteps = () => [
    { 
      id: "profile", 
      label: "Create a profile", 
      desc: isPersonal ? "Set up your personal fund" : `Set up ${profileName}'s fund`, 
      done: true, 
      icon: CheckCircle2 
    },
    { 
      id: "brokerage", 
      label: "Open investment account", 
      desc: isPersonal ? "Personal account within Everleaf (2 min)" : "Custodial account within Everleaf (2 min)", 
      done: false, 
      icon: Landmark, 
      action: `/onboard?type=${accountType}&name=${encodeURIComponent(profileName)}&email=${encodeURIComponent(userEmail)}`, 
      cta: "Open now" 
    },
    { 
      id: "moment", 
      label: "Create your first Moment", 
      desc: "Design a shareable page for an event", 
      done: false, 
      icon: Sparkles, 
      action: "/moment/create", 
      cta: "Create" 
    },
    { 
      id: "share", 
      label: "Share with contributors", 
      desc: "Send your link to family and friends", 
      done: false, 
      icon: Share2 
    },
  ];

  const [steps, setSteps] = useState(getOnboardingSteps());
  
  const completedSteps = steps.filter(s => s.done).length;
  const progress = (completedSteps / steps.length) * 100;
  const brokerageConnected = steps.find(s => s.id === "brokerage")?.done;

  const completeStep = (id: string) => {
    setSteps(steps.map(s => s.id === id ? { ...s, done: true } : s));
  };

  const mockContributions = [
    { from: "Uncle Dave", amount: 180, message: "Congrats! So proud of you.", status: "Invested" },
    { from: "Grandma Ruth", amount: 500, message: "For your future, with all my love.", status: "Invested" },
    { from: "The Cohens", amount: 100, message: "Here's to many more milestones!", status: "Pending" },
  ];

  const mockThankYous = [
    { to: "Uncle Dave", amount: 180, status: "Draft ready" },
    { to: "Grandma Ruth", amount: 500, status: "Draft ready" },
    { to: "The Cohens", amount: 100, status: "Not started" },
  ];

  const mockMoments = [
    { id: "1", title: isPersonal ? "My Birthday Fund" : `${profileName}'s Celebration`, date: "May 24, 2025", goal: 5000, raised: 4250, status: "Active" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav showDashboard accountType={accountType} profileName={profileName} />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {isNewUser && completedSteps < 4 ? "Welcome to Everleaf" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isNewUser && completedSteps < 4 
                ? "Let's get you set up in just a few steps." 
                : isPersonal ? "Manage your fund and contributions." : `Manage ${profileName}'s fund and thank your contributors.`
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
              <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
            </Link>
            <Link href="/create">
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add profile</Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Checklist */}
        {isNewUser && completedSteps < 4 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-none shadow-sm mb-8 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-5 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">Get started</p>
                    <p className="text-sm text-muted-foreground">{completedSteps} of {steps.length} complete</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-primary">{Math.round(progress)}%</p>
                  </div>
                </div>
                <Progress value={progress} className="h-1.5 mt-3" />
              </div>
              <CardContent className="p-0">
                {steps.map((step) => (
                  <div 
                    key={step.id} 
                    className={`flex items-center justify-between p-4 border-b last:border-b-0 ${step.done ? "bg-muted/30" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        step.done ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        {step.done ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                    {!step.done && step.cta && (
                      <Link href={step.action || "#"}>
                        <Button size="sm" onClick={() => step.id === "brokerage" && completeStep("brokerage")}>
                          {step.cta} <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                    {step.done && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick action if brokerage not connected */}
            {!brokerageConnected && (
              <Card className="border-2 border-dashed border-primary/30 bg-primary/5 mb-8">
                <CardContent className="p-6 text-center">
                  <Landmark className="h-10 w-10 text-primary mx-auto mb-3" />
                  <p className="font-semibold text-foreground mb-1 flex items-center justify-center gap-1.5">
                    Open {isPersonal ? "your" : "a custodial"} investment account
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-left">
                        <p className="text-sm">We'll create a new {isPersonal ? "brokerage" : "UTMA custodial"} account for you within Everleaf, powered by Apex Clearing. SIPC insured up to $500k.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Takes about 2 minutes. No external accounts needed.
                  </p>
                  <Link href={`/onboard?type=${accountType}&name=${encodeURIComponent(profileName)}&email=${encodeURIComponent(userEmail)}`}>
                    <Button onClick={() => completeStep("brokerage")}>
                      Open account <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Skip for demo */}
            <div className="text-center mb-8">
              <button 
                onClick={() => { setIsNewUser(false); setSteps(steps.map(s => ({ ...s, done: true }))); }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Skip to full dashboard (demo)
              </button>
            </div>
          </motion.div>
        )}

        {/* Full Dashboard - after onboarding */}
        {(!isNewUser || completedSteps === 4) && (
          <>
            {/* Tasks */}
            <Card className="border-none shadow-sm mb-8">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">3 thank-yous pending</p>
                      <p className="text-sm text-muted-foreground">Drafts are ready to send</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Send all</Button>
                </div>
              </CardContent>
            </Card>

            {/* Profile Card */}
            <Card className="border-none shadow-sm mb-6">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
                      {profileName.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{isPersonal ? "My Fund" : `${profileName}'s Fund`}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {isPersonal ? "Personal brokerage" : "Custodial account"} • 18 contributors
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-foreground">$4,250</p>
                    <p className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" /> +12.5% all time
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="holdings" className="space-y-6">
              <TabsList className="bg-muted/50 w-full grid grid-cols-4">
                <TabsTrigger value="holdings"><PieChart className="mr-2 h-4 w-4" /> Holdings</TabsTrigger>
                <TabsTrigger value="moments"><Gift className="mr-2 h-4 w-4" /> Moments</TabsTrigger>
                <TabsTrigger value="contributions"><Users className="mr-2 h-4 w-4" /> Activity</TabsTrigger>
                <TabsTrigger value="thankyou"><MessageSquare className="mr-2 h-4 w-4" /> Thank you</TabsTrigger>
              </TabsList>

              {/* Holdings Tab */}
              <TabsContent value="holdings" className="space-y-4">
                <Card className="border-none shadow-sm bg-primary/5 border-l-4 border-l-primary">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground text-sm flex items-center gap-1.5">
                          Investment account active
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-left">
                              <p className="text-sm">Your {isPersonal ? "personal" : "UTMA custodial"} account is held within Everleaf, cleared by Apex Clearing Corporation. SIPC insured up to $500k.</p>
                            </TooltipContent>
                          </Tooltip>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isPersonal ? "Personal account" : "Custodial account"} • Powered by Apex • SIPC insured
                        </p>
                      </div>
                    </div>
                    <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}#brokerage`}>
                      <Button variant="ghost" size="sm">Manage</Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Portfolio allocation</CardTitle>
                      <p className="text-xs text-muted-foreground">Future Fund (auto-managed)</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {HOLDINGS.map((h, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {h.allocation}%
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{h.name}</p>
                            <p className="text-xs text-muted-foreground">{h.ticker}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground text-sm">${h.value.toLocaleString()}</p>
                          {h.change > 0 && (
                            <p className="text-xs text-primary flex items-center justify-end gap-0.5">
                              <ArrowUpRight className="h-3 w-3" /> {h.change}%
                            </p>
                          )}
                          {h.change === 0 && h.ticker === "—" && (
                            <p className="text-xs text-muted-foreground">Uninvested</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-3">
                  <Card className="border-none shadow-sm">
                    <CardContent className="p-4 text-center">
                      <p className="text-lg font-semibold text-foreground">$4,250</p>
                      <p className="text-xs text-muted-foreground">Total value</p>
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-sm">
                    <CardContent className="p-4 text-center">
                      <p className="text-lg font-semibold text-primary">+$472</p>
                      <p className="text-xs text-muted-foreground">Total return</p>
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-sm">
                    <CardContent className="p-4 text-center">
                      <p className="text-lg font-semibold text-foreground">$638</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ACTIVITY.map((a, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                          a.type === "invested" ? "bg-primary/10" : "bg-muted"
                        }`}>
                          {a.type === "invested" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="text-sm text-foreground">{a.desc}</p>
                          <p className="text-xs text-muted-foreground">{a.time}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> SIPC insured</span>
                  <span>•</span>
                  <span>Cleared by Apex</span>
                  <span>•</span>
                  <span>256-bit encryption</span>
                </div>
              </TabsContent>

              <TabsContent value="moments" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Shareable pages for events</p>
                  <Link href={`/moment/create?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> New moment</Button>
                  </Link>
                </div>
                {mockMoments.map((m) => (
                  <Card key={m.id} className="border-none shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-medium text-foreground">{m.title}</p>
                          <p className="text-sm text-muted-foreground">{m.date}</p>
                        </div>
                        <Badge variant="outline" className="text-primary border-primary/30">{m.status}</Badge>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Goal progress</span>
                          <span className="font-medium">${m.raised.toLocaleString()} / ${m.goal.toLocaleString()}</span>
                        </div>
                        <Progress value={(m.raised / m.goal) * 100} className="h-2" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1"><QrCode className="mr-2 h-4 w-4" /> QR</Button>
                        <Button variant="outline" size="sm" className="flex-1"><Copy className="mr-2 h-4 w-4" /> Link</Button>
                        <Link href={`/moment?name=${encodeURIComponent(profileName)}&title=${encodeURIComponent(m.title)}`}>
                          <Button variant="outline" size="sm"><ExternalLink className="mr-2 h-4 w-4" /> Preview</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="contributions" className="space-y-4">
                <p className="text-sm text-muted-foreground">Recent contributions to {isPersonal ? "your" : `${profileName}'s`} fund</p>
                {mockContributions.map((c, i) => (
                  <Card key={i} className="border-none shadow-sm">
                    <CardContent className="p-5 flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                          {c.from.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.from}</p>
                          <p className="text-sm text-muted-foreground">{c.message}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-foreground">${c.amount}</p>
                        <Badge variant={c.status === "Invested" ? "default" : "secondary"} className="text-xs mt-1">
                          {c.status === "Invested" && <Check className="mr-1 h-3 w-3" />}
                          {c.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="thankyou" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Send thank-yous to your contributors</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={33} className="h-2 w-24" />
                      <span className="text-xs text-muted-foreground">1 of 3 sent</span>
                    </div>
                  </div>
                  <Button size="sm">Send all drafts</Button>
                </div>
                {mockThankYous.map((t, i) => (
                  <Card key={i} className="border-none shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                          {t.to.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{t.to}</p>
                          <p className="text-sm text-muted-foreground">${t.amount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={t.status === "Draft ready" ? "default" : "secondary"} className="text-xs">
                          {t.status}
                        </Badge>
                        <Button size="sm" variant="outline">
                          {t.status === "Draft ready" ? "Send" : "Write"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
