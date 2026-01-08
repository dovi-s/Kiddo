import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Shield, CreditCard, LogOut, Landmark, CheckCircle2, ExternalLink, TrendingUp, Sprout } from "lucide-react";

export default function Settings() {
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
                    <p className="font-medium text-sm">Connected</p>
                    <p className="text-xs text-muted-foreground">Apex Clearing • SIPC insured</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-primary border-primary/30">Active</Badge>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Account details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground text-xs">Account type</p>
                    <p className="font-medium">Custodial (UTMA)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground text-xs">Account number</p>
                    <p className="font-medium">••••4827</p>
                  </div>
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
                <Input value="parent@example.com" disabled className="bg-muted/50" />
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show messages to recipient</p>
                  <p className="text-xs text-muted-foreground">Let them see contributor notes</p>
                </div>
                <Switch defaultChecked />
              </div>
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
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Free</p>
                  <p className="text-xs text-muted-foreground">2.9% + $0.30 per contribution</p>
                </div>
                <Button size="sm">Upgrade</Button>
              </div>
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
