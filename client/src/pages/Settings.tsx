import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { LogOut } from "lucide-react";
import { useSearch } from "wouter";

export default function Settings() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || "Ari");
  const isPersonal = accountType === "personal";

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      
      <main className="container mx-auto px-4 py-10 max-w-lg">
        <h1 className="text-2xl font-semibold text-foreground mb-10">Settings</h1>

        <div className="space-y-8">
          {/* Brokerage */}
          <section>
            <h2 className="font-semibold mb-4">Investment account</h2>
            <Card className="border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Account active</p>
                    <p className="text-xs text-muted-foreground">Apex Clearing · SIPC protected</p>
                  </div>
                  <span className="text-xs border px-2 py-1 rounded">Active</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium">{isPersonal ? "Individual" : "Custodial"}</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Account</p>
                    <p className="font-medium">••••4827</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">Statements</Button>
                  <Button variant="outline" size="sm" className="flex-1">Tax docs</Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Account */}
          <section>
            <h2 className="font-semibold mb-4">Account</h2>
            <Card className="border">
              <CardContent className="p-5 space-y-4">
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
          </section>

          {/* Notifications */}
          <section>
            <h2 className="font-semibold mb-4">Notifications</h2>
            <Card className="border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm">New contributions</p>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Weekly summary</p>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Plan */}
          <section>
            <h2 className="font-semibold mb-4">Plan</h2>
            <Card className="border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Free</p>
                    <p className="text-xs text-muted-foreground">Guests pay ~3% at checkout</p>
                  </div>
                  <span className="text-xs border px-2 py-1 rounded">Current</span>
                </div>
                <div className="p-4 rounded-md border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Plus</p>
                    <p className="text-sm font-medium">$99/event</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Guests pay $0. You cover processing.</p>
                </div>
                <div className="p-4 rounded-md border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Family</p>
                    <p className="text-sm font-medium">$199/year</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Up to 10 events. Household dashboard.</p>
                </div>
                <Button className="w-full">Upgrade</Button>
              </CardContent>
            </Card>
          </section>

          {/* Sign out */}
          <Card className="border">
            <CardContent className="p-5">
              <Button variant="outline" className="w-full justify-start">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center pt-4">
            Brokerage by [Broker-Dealer], Member FINRA/SIPC. Clearing by Apex.
          </p>
        </div>
      </main>
    </div>
  );
}
