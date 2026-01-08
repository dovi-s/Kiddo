import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, User, Plus, Share2, QrCode, Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

const ACCOUNTS = [
  { id: "leo", name: "Leo", type: "Child", photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=150", balance: 7400, gain: 14.2, gifts: 24 },
  { id: "sarah", name: "Sarah", type: "Child", photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150", balance: 3200, gain: 8.5, gifts: 12 },
];

const CHART_DATA = [
  { month: "Jan", value: 5000 },
  { month: "Feb", value: 5200 },
  { month: "Mar", value: 5150 },
  { month: "Apr", value: 6800 },
  { month: "May", value: 7100 },
  { month: "Jun", value: 7400 },
];

const RECENT_GIFTS = [
  { from: "Uncle Dave", amount: 180, asset: "S&P 500", message: "Mazel Tov Leo! Watch this grow." },
  { from: "Grandma Sarah", amount: 500, asset: "College Fund", message: "For your education, my dear." },
  { from: "The Cohen Family", amount: 100, asset: "Apple Inc", message: "Buy yourself something nice... in 10 years!" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-muted/10 font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-serif text-3xl font-bold text-primary">Your Accounts</h1>
            <p className="text-muted-foreground">Manage funds for yourself and your family.</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Account
          </Button>
        </div>

        {/* Account Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
          {ACCOUNTS.map((account) => (
            <Link key={account.id} href={`/dashboard`}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-none shadow-sm">
                <CardHeader className="pb-4 flex flex-row items-center gap-4">
                  <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-white shadow-md">
                    <img src={account.photo} alt={account.name} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <CardTitle className="font-serif text-xl">{account.name}</CardTitle>
                    <CardDescription>{account.type} Account • {account.gifts} gifts</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold font-serif text-primary">${account.balance.toLocaleString()}</p>
                      <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> +{account.gain}% all time
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Add New Account Card */}
          <Card className="border-dashed border-2 bg-transparent flex items-center justify-center min-h-[200px] hover:border-primary/50 transition-colors cursor-pointer">
            <div className="text-center p-6">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-bold text-muted-foreground">Add New Account</p>
              <p className="text-sm text-muted-foreground">For yourself or a child</p>
            </div>
          </Card>
        </div>

        {/* Selected Account Detail */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl font-bold text-primary">Leo's Account</h2>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="gifts">Gift History</TabsTrigger>
              <TabsTrigger value="share">Share Link</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Chart */}
              <Card className="col-span-2 shadow-sm border-none">
                <CardHeader>
                  <CardTitle className="font-serif">Growth Over Time</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={CHART_DATA}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(35, 92%, 55%)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(35, 92%, 55%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="value" stroke="hsl(35, 92%, 55%)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="space-y-4">
                <Card className="shadow-sm border-none bg-primary text-primary-foreground">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium opacity-80">Total Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold font-serif">$7,400.00</div>
                    <p className="text-xs opacity-70 mt-1">+14.2% all time</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Contributions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-serif text-primary">$6,450.00</div>
                    <p className="text-xs text-muted-foreground mt-1">From 24 gifts</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Projected (Age 18)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-serif text-secondary">$12,850.00</div>
                    <p className="text-xs text-muted-foreground mt-1">At 8% annual growth</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gifts">
            <Card className="shadow-sm border-none">
              <CardHeader>
                <CardTitle className="font-serif">Recent Gifts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {RECENT_GIFTS.map((gift, i) => (
                    <div key={i} className="flex gap-4 items-start pb-4 border-b last:border-none last:pb-0">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-grow space-y-1">
                        <p className="font-medium">{gift.from}</p>
                        <p className="text-sm text-muted-foreground">{gift.message}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">${gift.amount}</p>
                        <Badge variant="outline" className="text-[10px]">{gift.asset}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="share">
            <Card className="shadow-sm border-none max-w-lg">
              <CardHeader>
                <CardTitle className="font-serif">Share Leo's Gift Link</CardTitle>
                <CardDescription>Anyone with this link can gift shares to Leo's account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <input 
                    readOnly 
                    value="dorvador.com/give/leo-xyz123" 
                    className="flex-grow bg-transparent text-sm font-mono outline-none"
                  />
                  <Button variant="ghost" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1">
                    <QrCode className="mr-2 h-4 w-4" /> QR Code
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <ExternalLink className="mr-2 h-4 w-4" /> Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
