import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { User, Bell, Shield, CreditCard, LogOut } from "lucide-react";

export default function Settings() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-10 max-w-lg">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Settings</h1>

        <div className="space-y-6">
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
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Free</p>
                  <p className="text-xs text-muted-foreground">Standard fees apply</p>
                </div>
                <Button size="sm">Upgrade</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-5 space-y-3">
              <Button variant="outline" className="w-full justify-start"><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
