import { useState } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, QrCode, Copy, MessageSquare, Check, ArrowRight, Settings, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";

const HOLDINGS = [
  { name: "Total Stock Market", ticker: "VTI", value: 2125, percent: 50 },
  { name: "International", ticker: "VXUS", value: 850, percent: 20 },
  { name: "Bonds", ticker: "BND", value: 637, percent: 15 },
  { name: "Cash", ticker: "—", value: 638, percent: 15 },
];

export default function Dashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || (accountType === "personal" ? "My Fund" : "Ari"));
  const userEmail = decodeURIComponent(params.get("email") || "you@example.com");
  const isPersonal = accountType === "personal";

  const [showFull, setShowFull] = useState(false);
  const [brokerageOpen, setBrokerageOpen] = useState(false);

  const contributions = [
    { from: "Uncle Dave", amount: 180, message: "Congrats! So proud of you." },
    { from: "Grandma Ruth", amount: 500, message: "For your future, with all my love." },
    { from: "The Cohens", amount: 100, message: "Here's to many more milestones!" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Nav showDashboard accountType={accountType} profileName={profileName} />
      
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {!showFull ? "Welcome" : "Dashboard"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {!showFull ? "Let's get you set up." : isPersonal ? "Your fund" : `${profileName}'s fund`}
            </p>
          </div>
          <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
            <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
          </Link>
        </div>

        {/* Onboarding */}
        {!showFull && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Step 1: Done */}
            <div className="flex items-center justify-between p-5 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-medium">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm text-muted-foreground line-through">Create profile</p>
                  <p className="text-xs text-muted-foreground">{isPersonal ? "Personal fund" : `${profileName}'s fund`}</p>
                </div>
              </div>
            </div>

            {/* Step 2: Open account */}
            {!brokerageOpen ? (
              <div className="flex items-center justify-between p-5 border-2 border-foreground rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full border-2 border-foreground flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-sm">Open investment account</p>
                    <p className="text-xs text-muted-foreground">Takes about 2 minutes</p>
                  </div>
                </div>
                <Link href={`/onboard?type=${accountType}&name=${encodeURIComponent(profileName)}&email=${encodeURIComponent(userEmail)}`}>
                  <Button size="sm" onClick={() => setBrokerageOpen(true)}>
                    Continue <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between p-5 border rounded-lg bg-card">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-medium">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-muted-foreground line-through">Open investment account</p>
                    <p className="text-xs text-muted-foreground">Apex Clearing</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Create moment */}
            <div className="flex items-center justify-between p-5 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium text-muted-foreground">
                  3
                </div>
                <div>
                  <p className="font-medium text-sm text-muted-foreground">Create a shareable page</p>
                  <p className="text-xs text-muted-foreground">For an event or always-on</p>
                </div>
              </div>
            </div>

            {/* Step 4: Share */}
            <div className="flex items-center justify-between p-5 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium text-muted-foreground">
                  4
                </div>
                <div>
                  <p className="font-medium text-sm text-muted-foreground">Share with family</p>
                  <p className="text-xs text-muted-foreground">Send your link</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={() => setShowFull(true)}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Skip to dashboard
              </button>
            </div>
          </motion.div>
        )}

        {/* Full Dashboard */}
        {showFull && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Value */}
            <div className="text-center py-8">
              <p className="text-4xl font-semibold text-foreground">$4,250</p>
              <p className="text-muted-foreground text-sm mt-2">Total value · 18 contributors</p>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <Link href={`/moment?name=${encodeURIComponent(profileName)}`}>
                <Card className="border hover:border-foreground/20 transition-colors cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <ExternalLink className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Preview</p>
                  </CardContent>
                </Card>
              </Link>
              <Card className="border hover:border-foreground/20 transition-colors cursor-pointer">
                <CardContent className="p-4 text-center">
                  <Copy className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Copy link</p>
                </CardContent>
              </Card>
              <Card className="border hover:border-foreground/20 transition-colors cursor-pointer">
                <CardContent className="p-4 text-center">
                  <QrCode className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">QR code</p>
                </CardContent>
              </Card>
            </div>

            {/* Holdings */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Holdings</h2>
                <span className="text-xs text-muted-foreground">Future Fund</span>
              </div>
              <Card className="border">
                <CardContent className="p-0 divide-y">
                  {HOLDINGS.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium">{h.name}</p>
                        <p className="text-xs text-muted-foreground">{h.ticker}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${h.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{h.percent}%</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Contributions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Recent gifts</h2>
                <span className="text-xs text-muted-foreground">3 pending thank-yous</span>
              </div>
              <div className="space-y-3">
                {contributions.map((c, i) => (
                  <Card key={i} className="border">
                    <CardContent className="p-4 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{c.from}</p>
                        <p className="text-sm text-muted-foreground">{c.message}</p>
                      </div>
                      <p className="text-sm font-medium">${c.amount}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Thank yous */}
            <Card className="border">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">3 thank-yous ready</p>
                    <p className="text-xs text-muted-foreground">Drafts generated from messages</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Send all</Button>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center pt-4">
              Brokerage by [Broker-Dealer], Member FINRA/SIPC. Clearing by Apex.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
