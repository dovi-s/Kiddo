import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Shield, CreditCard, LogOut, Landmark, CheckCircle2, ExternalLink, TrendingUp } from "lucide-react";
import { useSearch } from "wouter";

export default function Settings() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || "Ari");
  const isPersonal = accountType === "personal";

  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-10 max-w-lg">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Brokerage */}
          <Card className="border-none shadow-sm" id="brokerage">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> Brokerage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Account active</p>
                    <p className="text-xs text-muted-foreground">Member FINRA/SIPC • Cleared by Apex</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-primary border-primary/30">Active</Badge>
              </div>
              
              <p className="text-[10px] text-muted-foreground">
                Brokerage services provided by [Broker-Dealer], Member FINRA/SIPC. Clearing and custody by Apex Clearing Corporation. Everleaf is a technology platform and is not a broker-dealer.
              </p>

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Account details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground text-xs">Account type</p>
                    <p className="font-medium">{isPersonal ? "Individual brokerage" : "UTMA custodial"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground text-xs">Account number</p>
                    <p className="font-medium">••••4827</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground text-xs">Clearing firm</p>
                    <p className="font-medium">Apex Clearing Corp.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground text-xs">Protection</p>
                    <p className="font-medium">SIPC up to $500k</p>
                  </div>
                  {!isPersonal && (
                    <div className="p-3 rounded-lg bg-muted/50 col-span-2">
                      <p className="text-muted-foreground text-xs">Beneficiary</p>
                      <p className="font-medium">{profileName}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Default investment</p>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Future Fund</p>
                      <p className="text-xs text-muted-foreground">Auto-invest into diversified basket</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Change</Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <ExternalLink className="mr-2 h-3 w-3" /> View statements
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Tax documents
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Email</Label>
                <Input value="you@example.com" disabled className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Name</Label>
                <Input defaultValue="Sarah Miller" />
              </div>
              <Button variant="outline" size="sm">Update</Button>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Hide amounts publicly</p>
                  <p className="text-xs text-muted-foreground">Contributors see their own, not others'</p>
                </div>
                <Switch defaultChecked />
              </div>
              {!isPersonal && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Show messages to {profileName}</p>
                    <p className="text-xs text-muted-foreground">Let them see contributor notes</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">New contributions</p>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Weekly summary</p>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Investment updates</p>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Plan */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">Free</p>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Current</span>
                </div>
                <p className="text-xs text-muted-foreground">Guests pay fees at checkout</p>
                <p className="text-xs text-muted-foreground">2.9% + $0.30 (card) + 1.5% platform fee (capped at $10)</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Upgrade options</p>
                
                <div className="p-4 rounded-xl border hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">Plus</p>
                    <p className="font-semibold text-sm">$79 <span className="text-muted-foreground font-normal text-xs">per event</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Guests pay $0 fees. Premium templates. Auto thank-yous.</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Host covers processing at cost</li>
                    <li>• Everleaf fee waived up to $7,500</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">Family</p>
                    <p className="font-semibold text-sm">$129 <span className="text-muted-foreground font-normal text-xs">per year</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Multiple kids and events. Guests pay $0 on all.</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Up to 10 event pages per year</li>
                    <li>• Everleaf fee waived up to $15,000/year</li>
                    <li>• Household dashboard</li>
                  </ul>
                </div>
              </div>

              <Button className="w-full">Upgrade Plan</Button>
            </CardContent>
          </Card>

          {/* Sign out */}
          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <Button variant="outline" className="w-full justify-start"><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
