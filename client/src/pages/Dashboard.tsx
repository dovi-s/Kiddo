import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, User, Plus, Share2, QrCode, Copy, ExternalLink, Gift, MessageSquare, Settings, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

const PROFILES = [
  { id: "ari", name: "Ari", type: "Child", photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=150", balance: 4250, gain: 12.5, contributors: 18 },
  { id: "maya", name: "Maya", type: "Child", photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150", balance: 1820, gain: 8.2, contributors: 9 },
];

const CHART_DATA = [
  { month: "Jan", value: 2800 },
  { month: "Feb", value: 3100 },
  { month: "Mar", value: 3050 },
  { month: "Apr", value: 3900 },
  { month: "May", value: 4100 },
  { month: "Jun", value: 4250 },
];

const MOMENTS = [
  { id: "barmitzvah", title: "Bar Mitzvah", date: "May 24, 2025", goal: 5000, raised: 4250 },
  { id: "birthday", title: "13th Birthday", date: "Mar 15, 2025", goal: 1000, raised: 820 },
];

const CONTRIBUTIONS = [
  { from: "Uncle Dave", amount: 180, fund: "Future Fund", message: "Mazel Tov, Ari! Watching you grow has been amazing." },
  { from: "Grandma Ruth", amount: 500, fund: "Future Fund", message: "For your future, with all my love." },
  { from: "The Cohens", amount: 100, fund: "Future Fund", message: "Here's to many more milestones!" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-muted/10 font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-10">
        <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Household</p>
            <h1 className="font-serif text-4xl font-semibold text-foreground">My Profiles</h1>
          </div>
          <Button data-testid="button-add-profile"><Plus className="mr-2 h-4 w-4" /> Add Profile</Button>
        </div>

        {/* Profile Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {PROFILES.map((profile) => (
            <Card key={profile.id} className="border-none shadow-sm hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader className="flex flex-row items-center gap-4 pb-4">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-card shadow-md">
                  <img src={profile.photo} alt={profile.name} className="h-full w-full object-cover" />
                </div>
                <div>
                  <CardTitle className="font-serif text-2xl">{profile.name}</CardTitle>
                  <CardDescription>{profile.type} • {profile.contributors} contributors</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-foreground">${profile.balance.toLocaleString()}</p>
                    <p className="text-sm text-primary font-medium flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3" /> +{profile.gain}% all time
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-2 border-dashed bg-transparent flex items-center justify-center min-h-[200px] hover:border-primary/50 transition-colors cursor-pointer">
            <div className="text-center p-6">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">Add Profile</p>
              <p className="text-sm text-muted-foreground">For another child or yourself</p>
            </div>
          </Card>
        </div>

        {/* Selected Profile Detail */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-3xl font-semibold text-foreground">Ari's Profile</h2>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview"><Sparkles className="mr-2 h-4 w-4" /> Overview</TabsTrigger>
              <TabsTrigger value="moments"><Gift className="mr-2 h-4 w-4" /> Moments</TabsTrigger>
              <TabsTrigger value="contributors"><User className="mr-2 h-4 w-4" /> Contributors</TabsTrigger>
              <TabsTrigger value="thankyou"><MessageSquare className="mr-2 h-4 w-4" /> Thank You</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="col-span-2 shadow-sm border-none">
                  <CardHeader><CardTitle className="font-serif">Growth Over Time</CardTitle></CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={CHART_DATA}>
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(152, 45%, 28%)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="hsl(152, 45%, 28%)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="value" stroke="hsl(152, 45%, 28%)" strokeWidth={2.5} fillOpacity={1} fill="url(#areaGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="shadow-sm border-none bg-primary text-primary-foreground">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium opacity-80">Total Value</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold">$4,250</p><p className="text-xs opacity-70 mt-1">+12.5% all time</p></CardContent>
                  </Card>
                  <Card className="shadow-sm border-none">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Contributors</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold text-foreground">18</p><p className="text-xs text-muted-foreground mt-1">people in Ari's corner</p></CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="moments" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-muted-foreground">Moment pages for events. Each has its own link and theme.</p>
                <Button><Plus className="mr-2 h-4 w-4" /> Create Moment</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {MOMENTS.map((m) => (
                  <Card key={m.id} className="shadow-sm border-none">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl">{m.title}</CardTitle>
                      <CardDescription>{m.date}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Raised</span>
                          <span className="font-semibold">${m.raised.toLocaleString()} / ${m.goal.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(m.raised / m.goal) * 100}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1"><QrCode className="mr-2 h-4 w-4" /> QR</Button>
                        <Button variant="outline" size="sm" className="flex-1"><Copy className="mr-2 h-4 w-4" /> Link</Button>
                        <Button variant="outline" size="sm" className="flex-1"><ExternalLink className="mr-2 h-4 w-4" /> Preview</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="contributors">
              <Card className="shadow-sm border-none">
                <CardHeader><CardTitle className="font-serif">Recent Contributions</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {CONTRIBUTIONS.map((c, i) => (
                      <div key={i} className="flex gap-4 items-start pb-4 border-b last:border-none last:pb-0">
                        <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-grow space-y-1">
                          <p className="font-semibold text-foreground">{c.from}</p>
                          <p className="text-sm text-muted-foreground">{c.message}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">${c.amount}</p>
                          <Badge variant="outline" className="text-[10px]">{c.fund}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="thankyou">
              <Card className="shadow-sm border-none">
                <CardHeader>
                  <CardTitle className="font-serif">Thank You Workflow</CardTitle>
                  <CardDescription>Send personalized thank-you cards to contributors.</CardDescription>
                </CardHeader>
                <CardContent className="text-center py-10">
                  <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">Coming soon: Auto-generated drafts and printable cards.</p>
                  <Button variant="outline">Notify Me</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
