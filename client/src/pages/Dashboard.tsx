import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, ArrowUpRight, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Mock Data
const CHART_DATA = [
  { month: "Jan", value: 5000 },
  { month: "Feb", value: 5200 },
  { month: "Mar", value: 5150 },
  { month: "Apr", value: 6800 }, // Big jump from Bar Mitzvah
  { month: "May", value: 7100 },
  { month: "Jun", value: 7400 },
];

const RECENT_GIFTS = [
  { from: "Uncle Dave", amount: 180, asset: "S&P 500", date: "2 days ago", message: "Mazel Tov Leo! Watch this grow." },
  { from: "Grandma Sarah", amount: 500, asset: "College Fund", date: "1 week ago", message: "For your education, my dear." },
  { from: "The Cohen Family", amount: 100, asset: "Apple Inc", date: "1 week ago", message: "Buy yourself something nice... in 10 years!" },
  { from: "Aunt Rachel", amount: 36, asset: "Israel Bond", date: "2 weeks ago", message: "With love." },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-muted/10 font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-serif text-3xl font-bold text-primary">Leo's Vault</h1>
            <p className="text-muted-foreground">Manage your gifts and watch them compound.</p>
          </div>
          <Button>Add Funds</Button>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="border-none shadow-md bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-80">Total Portfolio Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-serif">$7,400.00</div>
              <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +14.2% all time
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-serif text-primary">$6,450.00</div>
              <p className="text-xs text-muted-foreground mt-1">From 24 gifts</p>
            </CardContent>
          </Card>

           <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Projected Value (Age 18)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-serif text-secondary-foreground">$12,850.00</div>
              <p className="text-xs text-muted-foreground mt-1">Assuming 8% annual return</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Chart Section */}
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
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(35, 92%, 55%)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="shadow-sm border-none">
            <CardHeader>
              <CardTitle className="font-serif">Recent Gifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {RECENT_GIFTS.map((gift, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{gift.from}</p>
                      <p className="text-xs text-muted-foreground">{gift.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                         <Badge variant="outline" className="text-[10px] h-5">{gift.asset}</Badge>
                         <span className="text-xs font-bold text-primary">${gift.amount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
