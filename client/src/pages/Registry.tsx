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
import { TrendingUp, GraduationCap, Building2, Globe, DollarSign, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

// Mock Data for the Registry
const REGISTRY_DATA = {
  name: "Leo's Bar Mitzvah",
  date: "May 24, 2025",
  recipient: "Leo",
  photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=300&auto=format&fit=crop",
  description: "Help Leo build his future! Instead of gadgets that break, we're asking for contributions to his long-term savings and education.",
};

const GIFT_OPTIONS = [
  {
    id: "basket-growth",
    title: "Core Growth Basket",
    ticker: "BASKET",
    type: "Grow Basket",
    risk: "Medium",
    description: "A diversified mix of broad index ETFs. Best for long-term compounding.",
    icon: Zap,
    color: "bg-secondary/10 text-secondary-foreground",
    isRecommended: true
  },
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
    ticker: "529",
    type: "Education",
    risk: "Low",
    description: "Tax-advantaged savings specifically for future tuition and books.",
    icon: GraduationCap,
    color: "bg-green-100 text-green-700",
  },
  {
    id: "seed",
    title: "Future Seed",
    ticker: "SEED",
    type: "Hybrid",
    risk: "Variable",
    description: "You give the capital, Leo chooses the position later. Zero friction gifting.",
    icon: DollarSign,
    color: "bg-amber-100 text-amber-700",
  },
  {
    id: "apple",
    title: "Apple Inc.",
    ticker: "AAPL",
    type: "Stock",
    risk: "Medium",
    description: "Direct ownership in the world's leading technology innovator.",
    icon: Building2,
    color: "bg-gray-100 text-gray-700",
  },
  {
    id: "israel",
    title: "Israel Bond",
    ticker: "BOND",
    type: "Bond",
    risk: "Low",
    description: "Support the nation and earn steady interest for his future.",
    icon: ShieldCheck,
    color: "bg-orange-100 text-orange-700",
  },
];

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
                <TabsTrigger value="all">All Modes</TabsTrigger>
                <TabsTrigger value="baskets">Baskets</TabsTrigger>
                <TabsTrigger value="stocks">Direct Shares</TabsTrigger>
                <TabsTrigger value="seed">Seed Gifts</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {GIFT_OPTIONS.map((gift) => (
                  <GiftCard key={gift.id} gift={gift} recipient={REGISTRY_DATA.recipient} />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="baskets" className="mt-0">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {GIFT_OPTIONS.filter(g => g.type === "Grow Basket").map((gift) => (
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

            <TabsContent value="seed" className="mt-0">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {GIFT_OPTIONS.filter(g => g.type === "Hybrid" || g.type === "Education").map((gift) => (
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
      title: "Investment Initialized!",
      description: `Your $${amount} contribution will convert to ${gift.type === 'Hybrid' ? 'shares once selected' : 'fractional shares'} for ${recipient}.`,
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`overflow-hidden transition-all hover:shadow-lg border-border/50 group relative ${gift.isRecommended ? 'border-secondary/50 ring-1 ring-secondary/20' : ''}`}>
        {gift.isRecommended && (
          <div className="absolute top-0 right-0 bg-secondary px-3 py-1 text-[10px] font-bold text-secondary-foreground uppercase tracking-wider rounded-bl-lg">
            Recommended
          </div>
        )}
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
          <p className="text-sm text-muted-foreground leading-relaxed">{gift.description}</p>
        </CardContent>
        <CardFooter className="bg-muted/30 p-4">
          <DialogTrigger asChild>
            <Button className="w-full font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              Gift {gift.type === 'Grow Basket' ? 'to Basket' : gift.type === 'Hybrid' ? 'Seed Capital' : 'Shares'}
            </Button>
          </DialogTrigger>
        </CardFooter>
      </Card>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Gift to {gift.title}</DialogTitle>
          <DialogDescription>
            {gift.type === 'Hybrid' 
              ? "Your gift will be held as seed capital until Leo selects a position."
              : `Your gift will convert to fractional shares of ${gift.title} for ${recipient}'s future.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label>Select Contribution Amount</Label>
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
            <Label>Message for {recipient}</Label>
            <Textarea placeholder={`Mazel Tov ${recipient}! Investing in your growth...`} />
          </div>
        </div>
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-4 text-xs text-muted-foreground">
            <p><strong>Note:</strong> This is a gift of ownership. Recipient will receive a receipt for approximately { (Number(amount) / 250).toFixed(4) } fractional shares based on current market estimates.</p>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleGift} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold">
            Confirm Gift
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
