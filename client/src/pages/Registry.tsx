import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, GraduationCap, Building2, Globe, DollarSign } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

// Mock Data for the Registry
const REGISTRY_DATA = {
  name: "Leo's Bar Mitzvah",
  date: "May 24, 2025",
  recipient: "Leo",
  photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=300&auto=format&fit=crop", // Stock photo of a kid
  description: "Help Leo build his future! Instead of gadgets that break, we're asking for contributions to his long-term savings and education.",
};

const GIFT_OPTIONS = [
  {
    id: "sp500",
    title: "S&P 500 Fund",
    ticker: "VOO",
    type: "ETF",
    risk: "Medium",
    description: "A slice of the 500 largest US companies. The classic long-term builder.",
    icon: TrendingUp,
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "college",
    title: "College 529 Plan",
    ticker: "EDU",
    type: "Education",
    risk: "Low",
    description: "Tax-advantaged savings specifically for future tuition and books.",
    icon: GraduationCap,
    color: "bg-green-100 text-green-700",
  },
  {
    id: "tech",
    title: "Future Tech Basket",
    ticker: "QQQ",
    type: "ETF",
    risk: "High",
    description: "Invest in the companies building tomorrow (Apple, Microsoft, Nvidia).",
    icon: Globe,
    color: "bg-purple-100 text-purple-700",
  },
  {
    id: "apple",
    title: "Apple Inc.",
    ticker: "AAPL",
    type: "Stock",
    risk: "Medium",
    description: "Ownership in the company that makes the iPhone.",
    icon: Building2,
    color: "bg-gray-100 text-gray-700",
  },
  {
    id: "disney",
    title: "Disney",
    ticker: "DIS",
    type: "Stock",
    risk: "Medium",
    description: "The magic kingdom. Movies, parks, and entertainment.",
    icon: Building2,
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    id: "israel",
    title: "Israel Bond",
    ticker: "BOND",
    type: "Bond",
    risk: "Low",
    description: "Support the nation and earn steady interest.",
    icon: ShieldCheck,
    color: "bg-orange-100 text-orange-700",
  },
];

import { ShieldCheck } from "lucide-react";

export default function Registry() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-12">
        {/* Header Profile */}
        <div className="mx-auto max-w-4xl mb-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-xl">
              <img 
                src={REGISTRY_DATA.photo} 
                alt={REGISTRY_DATA.recipient} 
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <h1 className="mb-2 font-serif text-4xl font-bold text-primary">{REGISTRY_DATA.name}</h1>
          <p className="mb-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">{REGISTRY_DATA.date}</p>
          <div className="mx-auto max-w-2xl rounded-2xl bg-card p-6 shadow-sm border">
            <p className="text-lg text-muted-foreground italic">"{REGISTRY_DATA.description}"</p>
          </div>
        </div>

        {/* Gift Grid */}
        <div className="mx-auto max-w-6xl">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all">All Gifts</TabsTrigger>
                <TabsTrigger value="stocks">Stocks</TabsTrigger>
                <TabsTrigger value="education">Education</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {GIFT_OPTIONS.map((gift) => (
                  <GiftCard key={gift.id} gift={gift} recipient={REGISTRY_DATA.recipient} />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="stocks" className="mt-0">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {GIFT_OPTIONS.filter(g => g.type === "Stock" || g.type === "ETF").map((gift) => (
                  <GiftCard key={gift.id} gift={gift} recipient={REGISTRY_DATA.recipient} />
                ))}
              </div>
            </TabsContent>

             <TabsContent value="education" className="mt-0">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {GIFT_OPTIONS.filter(g => g.type === "Education").map((gift) => (
                  <GiftCard key={gift.id} gift={gift} recipient={REGISTRY_DATA.recipient} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function GiftCard({ gift, recipient }: { gift: any, recipient: string }) {
  const [amount, setAmount] = useState("100");
  const [isOpen, setIsOpen] = useState(false);

  const handleGift = () => {
    toast({
      title: "Gift Sent!",
      description: `You successfully gifted $${amount} of ${gift.title} to ${recipient}.`,
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-all hover:shadow-lg border-border/50 group">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${gift.color}`}>
              <gift.icon className="h-6 w-6" />
            </div>
            <Badge variant="secondary" className="font-mono text-xs">{gift.ticker}</Badge>
          </div>
          <CardTitle className="font-serif text-xl">{gift.title}</CardTitle>
          <CardDescription>{gift.type} • {gift.risk} Risk</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{gift.description}</p>
        </CardContent>
        <CardFooter className="bg-muted/30 p-4">
          <DialogTrigger asChild>
            <Button className="w-full font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              Gift {gift.ticker}
            </Button>
          </DialogTrigger>
        </CardFooter>
      </Card>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Gift {gift.title}</DialogTitle>
          <DialogDescription>
            Your gift will be invested in {gift.title} for {recipient}'s future.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label>Select Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {["54", "100", "180"].map((val) => (
                <Button 
                  key={val} 
                  variant={amount === val ? "default" : "outline"}
                  onClick={() => setAmount(val)}
                  className={amount === val ? "border-primary" : ""}
                >
                  ${val}
                </Button>
              ))}
            </div>
            <div className="relative mt-2">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-9" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label>Leave a note</Label>
            <Textarea placeholder={`Mazel Tov ${recipient}! investing in your future...`} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleGift} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            Confirm Gift
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
