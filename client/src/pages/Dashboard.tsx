import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Share2, QrCode, Copy, Users, Gift, MessageSquare, TrendingUp, Check, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";

const PROFILES = [
  { id: "ari", name: "Ari", balance: 4250, contributors: 18, pendingThanks: 3 },
];

const MOMENTS = [
  { id: "1", title: "Bar Mitzvah", date: "May 24, 2025", goal: 5000, raised: 4250, status: "Active" },
];

const CONTRIBUTIONS = [
  { from: "Uncle Dave", amount: 180, message: "Mazel Tov! Watching you grow has been amazing.", status: "Invested" },
  { from: "Grandma Ruth", amount: 500, message: "For your future, with all my love.", status: "Invested" },
  { from: "The Cohens", amount: 100, message: "Here's to many more milestones!", status: "Pending" },
];

const THANK_YOUS = [
  { to: "Uncle Dave", amount: 180, status: "Draft ready" },
  { to: "Grandma Ruth", amount: 500, status: "Draft ready" },
  { to: "The Cohens", amount: 100, status: "Not started" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Manage your funds and thank your contributors.</p>
          </div>
          <Link href="/create">
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add profile</Button>
          </Link>
        </div>

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
        {PROFILES.map((profile) => (
          <Card key={profile.id} className="border-none shadow-sm mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
                    {profile.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{profile.name}'s Fund</CardTitle>
                    <p className="text-sm text-muted-foreground">{profile.contributors} contributors</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-foreground">${profile.balance.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                    <TrendingUp className="h-3 w-3 text-primary" /> +12.5%
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {/* Tabs */}
        <Tabs defaultValue="moments" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="moments"><Gift className="mr-2 h-4 w-4" /> Moments</TabsTrigger>
            <TabsTrigger value="contributions"><Users className="mr-2 h-4 w-4" /> Contributions</TabsTrigger>
            <TabsTrigger value="thankyou"><MessageSquare className="mr-2 h-4 w-4" /> Thank you</TabsTrigger>
          </TabsList>

          <TabsContent value="moments" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Shareable pages for events</p>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> New moment</Button>
            </div>
            {MOMENTS.map((m) => (
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
                    <Button variant="outline" size="sm" className="flex-1"><ExternalLink className="mr-2 h-4 w-4" /> Preview</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="contributions" className="space-y-4">
            <p className="text-sm text-muted-foreground">Recent contributions to Ari's fund</p>
            {CONTRIBUTIONS.map((c, i) => (
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
            {THANK_YOUS.map((t, i) => (
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
      </main>
    </div>
  );
}
