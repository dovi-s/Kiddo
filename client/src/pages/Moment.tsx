import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaf, DollarSign, Check, ArrowLeft, Shield, Zap, Clock, ChevronDown, Share2, MessageSquare, Printer, TrendingUp, Search, Star, Gift, Users } from "lucide-react";
import { Link, useSearch } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple", price: 178.50 },
  { symbol: "DIS", name: "Disney", price: 112.30 },
  { symbol: "COST", name: "Costco", price: 542.20 },
  { symbol: "GOOGL", name: "Google", price: 141.80 },
  { symbol: "AMZN", name: "Amazon", price: 178.25 },
  { symbol: "MSFT", name: "Microsoft", price: 378.90 },
];

const TEMPLATE_AMOUNTS: Record<string, string[]> = {
  birthday: ["25", "50", "100", "150"],
  graduation: ["50", "100", "200", "500"],
  barmitzvah: ["54", "100", "180", "360"],
  wedding: ["100", "150", "250", "500"],
  baby: ["25", "50", "100", "250"],
  general: ["25", "50", "100", "200"],
};

export default function Moment() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recipientName = decodeURIComponent(params.get("name") || "Ari");
  const eventTitle = decodeURIComponent(params.get("title") || `${recipientName}'s Celebration`);
  const template = params.get("template") || "general";
  
  const amounts = TEMPLATE_AMOUNTS[template] || TEMPLATE_AMOUNTS.general;
  const goal = 5000;
  const raised = 4250;
  const contributors = 18;

  const [step, setStep] = useState(0);
  const [giftType, setGiftType] = useState<"fund" | "stock">("fund");
  const [amount, setAmount] = useState(amounts[1]);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedStock, setSelectedStock] = useState<typeof POPULAR_STOCKS[0] | null>(null);
  const [stockShares, setStockShares] = useState("1");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");
  const [showHow, setShowHow] = useState(false);

  const finalAmount = giftType === "fund" 
    ? (customAmount || amount) 
    : selectedStock ? (Number(stockShares) * selectedStock.price).toFixed(2) : "0";
  const fee = (Number(finalAmount) * 0.029 + 0.30).toFixed(2);
  const total = (Number(finalAmount) + Number(fee)).toFixed(2);
  const progress = (raised / goal) * 100;

  const handleConfirm = () => {
    const giftDesc = giftType === "stock" && selectedStock 
      ? `${stockShares} share${Number(stockShares) > 1 ? "s" : ""} of ${selectedStock.name}`
      : `$${finalAmount}`;
    toast({ title: "Gift sent!", description: `You've contributed ${giftDesc} to ${recipientName}'s future.` });
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="p-4 border-b bg-card">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/">
            <a className="flex items-center gap-2 text-foreground">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Everleaf</span>
            </a>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Hero */}
              <div className="text-center mb-8">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mx-auto mb-5 h-16 w-16 rounded-full bg-foreground/5 flex items-center justify-center text-2xl font-semibold text-foreground"
                >
                  {recipientName.charAt(0)}
                </motion.div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">{eventTitle}</h1>
                <p className="text-muted-foreground text-sm">Give a gift that grows.</p>
              </div>

              {/* Gift type tabs */}
              <Card className="border-none shadow-sm mb-4">
                <CardContent className="p-6 space-y-5">
                  <Tabs value={giftType} onValueChange={(v) => setGiftType(v as "fund" | "stock")}>
                    <TabsList className="w-full grid grid-cols-2 mb-4">
                      <TabsTrigger value="fund" className="text-sm">
                        <TrendingUp className="mr-2 h-4 w-4" /> Contribute to Fund
                      </TabsTrigger>
                      <TabsTrigger value="stock" className="text-sm">
                        <Gift className="mr-2 h-4 w-4" /> Gift a Stock
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="fund" className="space-y-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-muted-foreground">Select amount</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {amounts.map((val) => (
                            <Button
                              key={val}
                              variant={amount === val && !customAmount ? "default" : "outline"}
                              onClick={() => { setAmount(val); setCustomAmount(""); }}
                              className="h-12 font-semibold"
                              data-testid={`button-amount-${val}`}
                            >
                              ${val}
                            </Button>
                          ))}
                        </div>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Custom amount"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                            className="pl-9 h-12"
                            data-testid="input-custom-amount"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">Future Fund</p>
                            <p className="text-xs text-muted-foreground">Auto-invests into a diversified basket by end of day</p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="stock" className="space-y-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-muted-foreground">Choose a stock to gift</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search stocks..." className="pl-9 h-11" data-testid="input-search-stock" />
                        </div>

                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> Popular choices</p>
                        <div className="grid grid-cols-2 gap-2">
                          {POPULAR_STOCKS.map((stock) => (
                            <button
                              key={stock.symbol}
                              onClick={() => setSelectedStock(stock)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                selectedStock?.symbol === stock.symbol
                                  ? "border-primary bg-primary/5"
                                  : "hover:border-primary/40"
                              }`}
                              data-testid={`button-stock-${stock.symbol}`}
                            >
                              <p className="font-semibold text-sm">{stock.symbol}</p>
                              <p className="text-xs text-muted-foreground">{stock.name}</p>
                              <p className="text-xs text-primary mt-1">${stock.price}</p>
                            </button>
                          ))}
                        </div>

                        {selectedStock && (
                          <div className="space-y-2">
                            <Label className="text-sm">Number of shares</Label>
                            <div className="flex gap-2">
                              {["1", "2", "5"].map((n) => (
                                <Button
                                  key={n}
                                  variant={stockShares === n ? "default" : "outline"}
                                  onClick={() => setStockShares(n)}
                                  size="sm"
                                >
                                  {n} share{Number(n) > 1 ? "s" : ""}
                                </Button>
                              ))}
                              <Input
                                value={stockShares}
                                onChange={(e) => setStockShares(e.target.value.replace(/[^0-9]/g, "") || "1")}
                                className="w-20 h-9"
                                data-testid="input-shares"
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              = <span className="font-medium text-foreground">${(Number(stockShares) * selectedStock.price).toFixed(2)}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button 
                    onClick={() => setStep(1)} 
                    className="w-full h-12 text-base font-medium" 
                    disabled={giftType === "stock" && !selectedStock}
                    data-testid="button-contribute"
                  >
                    {giftType === "stock" && selectedStock 
                      ? `Gift ${stockShares} ${selectedStock.symbol} share${Number(stockShares) > 1 ? "s" : ""}`
                      : `Contribute $${customAmount || amount}`
                    }
                  </Button>

                  {/* Trust strip */}
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                    <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Secure</span>
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Apple Pay</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Instant receipt</span>
                  </div>
                </CardContent>
              </Card>

              {/* Goal card */}
              <Card className="border-none shadow-sm mb-4">
                <CardContent className="p-5">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-2xl font-semibold text-foreground">${raised.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">of ${goal.toLocaleString()} goal</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{contributors} contributors</p>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>

              {/* Trust drawer */}
              <Collapsible open={showHow} onOpenChange={setShowHow}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> How your gift is protected</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showHow ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="border-none shadow-sm mb-4">
                    <CardContent className="p-5 space-y-4 text-sm">
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Clock className="h-3 w-3 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Where it sits</p>
                            <p className="text-muted-foreground text-xs">Funds are held in {recipientName}'s brokerage account. Cash gifts auto-invest into the Future Fund within 3 business days.</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <TrendingUp className="h-3 w-3 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">When it invests</p>
                            <p className="text-muted-foreground text-xs">Cash gifts invest automatically. Stock gifts are purchased and added to the portfolio within 1 business day.</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-3 w-3 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Who controls it</p>
                            <p className="text-muted-foreground text-xs">{recipientName}'s parent/guardian manages the account until {recipientName} reaches the age of majority (18-21 depending on state).</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <DollarSign className="h-3 w-3 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Refunds</p>
                            <p className="text-muted-foreground text-xs">Before trades execute: fully refundable. After trades execute: refunds are not available (shares belong to the recipient).</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Shield className="h-3 w-3 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Fees</p>
                            <p className="text-muted-foreground text-xs">Card: processing (pass-through) + 2.0% service (cap $12). Bank: 1.0% service (cap $12). Recurring: −0.5%.</p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-muted-foreground pt-2 border-t">
                        Brokerage services provided by [Broker-Dealer], Member FINRA/SIPC. Clearing by Apex Clearing Corporation. Everleaf is a technology platform and is not a broker-dealer.
                      </p>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <p className="font-semibold text-foreground mb-1">
                      {giftType === "stock" && selectedStock 
                        ? `Gifting ${stockShares} ${selectedStock.name} share${Number(stockShares) > 1 ? "s" : ""}`
                        : `Contributing $${finalAmount}`
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {giftType === "stock" 
                        ? "This stock will be added directly to their portfolio."
                        : "Your contribution becomes part of their long-term fund."
                      }
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Your name</Label>
                      <Input placeholder="How should we sign the card?" value={giverName} onChange={(e) => setGiverName(e.target.value)} className="h-11" data-testid="input-name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Message (optional)</Label>
                      <Textarea placeholder={`Congratulations, ${recipientName}!`} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} data-testid="input-message" />
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {giftType === "stock" && selectedStock ? `${stockShares}x ${selectedStock.symbol}` : "Gift"}
                      </span>
                      <span className="font-medium">${finalAmount}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Service fee</span><span className="font-medium">${fee}</span></div>
                    <hr className="border-border" />
                    <div className="flex justify-between"><span className="font-medium">Total</span><span className="font-semibold">${total}</span></div>
                  </div>

                  <Button onClick={handleConfirm} className="w-full h-12 text-base font-medium" data-testid="button-pay">
                    Pay ${total}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">Secure checkout • 256-bit encryption</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="animate-card-reveal">
              <Card className="border-none shadow-lg text-center">
                <CardContent className="p-8 space-y-6">
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30"
                  >
                    <Check className="h-10 w-10 text-white" />
                  </motion.div>
                  
                  <div>
                    <p className="text-xl font-semibold text-foreground mb-1">Your card is ready</p>
                    <p className="text-muted-foreground">
                      {giftType === "stock" && selectedStock 
                        ? `You gifted ${stockShares} ${selectedStock.name} share${Number(stockShares) > 1 ? "s" : ""} to ${recipientName}.`
                        : `You contributed $${finalAmount} to ${recipientName}'s future.`
                      }
                    </p>
                  </div>

                  {/* Card preview */}
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 text-left border border-primary/10">
                    <p className="text-sm text-muted-foreground mb-2">From {giverName || "Anonymous"}</p>
                    <p className="text-foreground">{message || `Congratulations, ${recipientName}!`}</p>
                    <p className="text-sm font-semibold text-primary mt-4">
                      {giftType === "stock" && selectedStock 
                        ? `${stockShares} ${selectedStock.symbol} share${Number(stockShares) > 1 ? "s" : ""} gifted`
                        : `$${finalAmount} contributed`
                      }
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" data-testid="button-share-text">
                      <MessageSquare className="mr-2 h-4 w-4" /> Text
                    </Button>
                    <Button variant="outline" className="flex-1" data-testid="button-share-email">
                      <Share2 className="mr-2 h-4 w-4" /> Email
                    </Button>
                    <Button variant="outline" className="flex-1" data-testid="button-print">
                      <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                  </div>

                  <Link href="/">
                    <Button variant="ghost" className="w-full text-muted-foreground" data-testid="button-done">Done</Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground border-t">
        <a href="#" className="hover:text-foreground">Support</a> · <a href="#" className="hover:text-foreground">Privacy</a>
      </footer>
    </div>
  );
}
