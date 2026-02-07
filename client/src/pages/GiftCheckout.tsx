import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, CreditCard, Building2, Check, ChevronDown, Lock, Shield, Eye, EyeOff, Sparkles, Search, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/ui/logo";
import { PageTransition } from "@/components/layout/PageTransition";
import { Celebration, SuccessGlow } from "@/components/ui/celebration";
import { bouncySpring, successPop, easeOutExpo } from "@/lib/animations";
import { haptic } from "@/lib/haptics";
import { useQuery } from "@tanstack/react-query";

const SUGGESTED_AMOUNTS = ["25", "50", "100", "250"];

const ALL_STOCKS = [
  // Index ETFs
  { symbol: "VTI", name: "Total US Stock Market", price: 268.45, category: "Index" },
  { symbol: "VOO", name: "S&P 500 Index", price: 489.12, category: "Index" },
  { symbol: "QQQ", name: "Nasdaq 100", price: 485.30, category: "Index" },
  { symbol: "SPY", name: "S&P 500 SPDR", price: 512.45, category: "Index" },
  { symbol: "IWM", name: "Russell 2000", price: 198.75, category: "Index" },
  { symbol: "DIA", name: "Dow Jones", price: 389.20, category: "Index" },
  { symbol: "VEA", name: "International Developed", price: 48.92, category: "Index" },
  { symbol: "VWO", name: "Emerging Markets", price: 42.15, category: "Index" },
  // Tech Giants
  { symbol: "AAPL", name: "Apple", price: 178.50, category: "Tech" },
  { symbol: "MSFT", name: "Microsoft", price: 425.22, category: "Tech" },
  { symbol: "GOOGL", name: "Alphabet (Google)", price: 175.98, category: "Tech" },
  { symbol: "GOOG", name: "Alphabet Class C", price: 177.45, category: "Tech" },
  { symbol: "AMZN", name: "Amazon", price: 185.60, category: "Tech" },
  { symbol: "META", name: "Meta (Facebook)", price: 505.75, category: "Tech" },
  { symbol: "NVDA", name: "NVIDIA", price: 875.28, category: "Tech" },
  { symbol: "TSLA", name: "Tesla", price: 248.50, category: "Tech" },
  { symbol: "NFLX", name: "Netflix", price: 628.90, category: "Tech" },
  { symbol: "AMD", name: "AMD", price: 156.80, category: "Tech" },
  { symbol: "INTC", name: "Intel", price: 42.15, category: "Tech" },
  { symbol: "CRM", name: "Salesforce", price: 278.90, category: "Tech" },
  { symbol: "ORCL", name: "Oracle", price: 125.40, category: "Tech" },
  { symbol: "ADBE", name: "Adobe", price: 498.75, category: "Tech" },
  { symbol: "PYPL", name: "PayPal", price: 62.30, category: "Tech" },
  { symbol: "SQ", name: "Block (Square)", price: 68.45, category: "Tech" },
  { symbol: "SHOP", name: "Shopify", price: 78.90, category: "Tech" },
  { symbol: "UBER", name: "Uber", price: 72.15, category: "Tech" },
  { symbol: "LYFT", name: "Lyft", price: 12.45, category: "Tech" },
  { symbol: "SNAP", name: "Snap", price: 11.20, category: "Tech" },
  { symbol: "PINS", name: "Pinterest", price: 32.80, category: "Tech" },
  { symbol: "SPOT", name: "Spotify", price: 312.45, category: "Tech" },
  { symbol: "ZM", name: "Zoom", price: 68.90, category: "Tech" },
  { symbol: "DOCU", name: "DocuSign", price: 58.75, category: "Tech" },
  { symbol: "TWLO", name: "Twilio", price: 62.30, category: "Tech" },
  { symbol: "NET", name: "Cloudflare", price: 92.45, category: "Tech" },
  { symbol: "PLTR", name: "Palantir", price: 24.80, category: "Tech" },
  { symbol: "COIN", name: "Coinbase", price: 245.60, category: "Tech" },
  { symbol: "RBLX", name: "Roblox", price: 42.15, category: "Tech" },
  { symbol: "U", name: "Unity Software", price: 22.30, category: "Tech" },
  // Consumer & Entertainment
  { symbol: "DIS", name: "Disney", price: 112.45, category: "Consumer" },
  { symbol: "NKE", name: "Nike", price: 98.75, category: "Consumer" },
  { symbol: "SBUX", name: "Starbucks", price: 92.30, category: "Consumer" },
  { symbol: "MCD", name: "McDonald's", price: 278.90, category: "Consumer" },
  { symbol: "KO", name: "Coca-Cola", price: 62.45, category: "Consumer" },
  { symbol: "PEP", name: "PepsiCo", price: 168.90, category: "Consumer" },
  { symbol: "WMT", name: "Walmart", price: 165.80, category: "Consumer" },
  { symbol: "TGT", name: "Target", price: 142.30, category: "Consumer" },
  { symbol: "COST", name: "Costco", price: 725.40, category: "Consumer" },
  { symbol: "HD", name: "Home Depot", price: 352.80, category: "Consumer" },
  { symbol: "LOW", name: "Lowe's", price: 225.60, category: "Consumer" },
  { symbol: "LULU", name: "Lululemon", price: 385.20, category: "Consumer" },
  { symbol: "CMG", name: "Chipotle", price: 2850.00, category: "Consumer" },
  { symbol: "YUM", name: "Yum! Brands", price: 138.45, category: "Consumer" },
  { symbol: "ABNB", name: "Airbnb", price: 145.80, category: "Consumer" },
  { symbol: "BKNG", name: "Booking Holdings", price: 3680.00, category: "Consumer" },
  { symbol: "MAR", name: "Marriott", price: 235.60, category: "Consumer" },
  // Healthcare
  { symbol: "JNJ", name: "Johnson & Johnson", price: 158.90, category: "Healthcare" },
  { symbol: "PFE", name: "Pfizer", price: 28.45, category: "Healthcare" },
  { symbol: "MRNA", name: "Moderna", price: 98.75, category: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth", price: 525.80, category: "Healthcare" },
  { symbol: "ABBV", name: "AbbVie", price: 168.90, category: "Healthcare" },
  { symbol: "LLY", name: "Eli Lilly", price: 785.40, category: "Healthcare" },
  { symbol: "MRK", name: "Merck", price: 125.60, category: "Healthcare" },
  { symbol: "BMY", name: "Bristol-Myers", price: 52.30, category: "Healthcare" },
  // Financial
  { symbol: "JPM", name: "JPMorgan Chase", price: 198.45, category: "Financial" },
  { symbol: "BAC", name: "Bank of America", price: 38.90, category: "Financial" },
  { symbol: "WFC", name: "Wells Fargo", price: 58.75, category: "Financial" },
  { symbol: "GS", name: "Goldman Sachs", price: 475.60, category: "Financial" },
  { symbol: "MS", name: "Morgan Stanley", price: 98.45, category: "Financial" },
  { symbol: "V", name: "Visa", price: 278.90, category: "Financial" },
  { symbol: "MA", name: "Mastercard", price: 458.75, category: "Financial" },
  { symbol: "AXP", name: "American Express", price: 228.60, category: "Financial" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", price: 398.45, category: "Financial" },
  { symbol: "C", name: "Citigroup", price: 62.30, category: "Financial" },
  // Energy & Industrial
  { symbol: "XOM", name: "Exxon Mobil", price: 108.90, category: "Energy" },
  { symbol: "CVX", name: "Chevron", price: 152.45, category: "Energy" },
  { symbol: "COP", name: "ConocoPhillips", price: 118.75, category: "Energy" },
  { symbol: "NEE", name: "NextEra Energy", price: 72.30, category: "Energy" },
  { symbol: "BA", name: "Boeing", price: 198.45, category: "Industrial" },
  { symbol: "CAT", name: "Caterpillar", price: 325.80, category: "Industrial" },
  { symbol: "GE", name: "GE Aerospace", price: 168.90, category: "Industrial" },
  { symbol: "UPS", name: "UPS", price: 142.30, category: "Industrial" },
  { symbol: "FDX", name: "FedEx", price: 268.75, category: "Industrial" },
  // Communications
  { symbol: "T", name: "AT&T", price: 18.45, category: "Telecom" },
  { symbol: "VZ", name: "Verizon", price: 42.30, category: "Telecom" },
  { symbol: "TMUS", name: "T-Mobile", price: 168.90, category: "Telecom" },
  { symbol: "CMCSA", name: "Comcast", price: 42.15, category: "Telecom" },
  // Gaming
  { symbol: "EA", name: "Electronic Arts", price: 138.90, category: "Gaming" },
  { symbol: "TTWO", name: "Take-Two Interactive", price: 158.45, category: "Gaming" },
  { symbol: "ATVI", name: "Activision Blizzard", price: 82.30, category: "Gaming" },
  { symbol: "GME", name: "GameStop", price: 18.75, category: "Gaming" },
  // Real Estate
  { symbol: "VNQ", name: "Real Estate ETF", price: 88.45, category: "Real Estate" },
  { symbol: "O", name: "Realty Income", price: 58.90, category: "Real Estate" },
  // Specialty ETFs
  { symbol: "ARKK", name: "ARK Innovation", price: 48.75, category: "Thematic" },
  { symbol: "ICLN", name: "Clean Energy", price: 14.20, category: "Thematic" },
  { symbol: "SOXX", name: "Semiconductor ETF", price: 225.80, category: "Thematic" },
  { symbol: "XLF", name: "Financial Sector", price: 42.30, category: "Thematic" },
  { symbol: "XLE", name: "Energy Sector", price: 88.45, category: "Thematic" },
  { symbol: "XLK", name: "Technology Sector", price: 198.75, category: "Thematic" },
  { symbol: "XLV", name: "Healthcare Sector", price: 142.30, category: "Thematic" },
  { symbol: "XLY", name: "Consumer Discretionary", price: 178.90, category: "Thematic" },
  { symbol: "XLP", name: "Consumer Staples", price: 78.45, category: "Thematic" },
  // Bonds & Safe Haven
  { symbol: "BND", name: "Total Bond Market", price: 72.30, category: "Bonds" },
  { symbol: "AGG", name: "US Aggregate Bond", price: 98.45, category: "Bonds" },
  { symbol: "TLT", name: "20+ Year Treasury", price: 92.80, category: "Bonds" },
  { symbol: "GLD", name: "Gold", price: 185.60, category: "Commodities" },
  { symbol: "SLV", name: "Silver", price: 22.45, category: "Commodities" },
];

const TOP_PICKS = ["VTI", "VOO", "DIS"];
const SHOW_MORE_PICKS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"];

type Stock = typeof ALL_STOCKS[0];

interface FeeCalculation {
  baseAmount: number;
  processingFee: number;
  koraFee: number;
  totalCharge: number;
  netToFund: number;
  hasEventPass: boolean;
  hasFamilyPlan: boolean;
}

export default function GiftCheckout() {
  const { fund, event } = useParams<{ fund: string; event?: string }>();
  const [, setLocation] = useLocation();
  
  const [amount, setAmount] = useState("50");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'apple' | 'card' | 'bank'>('apple');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [hideFromOthers, setHideFromOthers] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [coverFees, setCoverFees] = useState(true);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [stockSearch, setStockSearch] = useState("");
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [showMoreStocks, setShowMoreStocks] = useState(false);
  
  const displayAmount = customAmount || amount;
  const numAmount = parseFloat(displayAmount) || 0;
  
  const topPicks = useMemo(() => 
    ALL_STOCKS.filter(s => TOP_PICKS.includes(s.symbol)), 
  []);
  
  const morePicks = useMemo(() =>
    ALL_STOCKS.filter(s => SHOW_MORE_PICKS.includes(s.symbol)),
  []);
  
  const filteredStocks = useMemo(() => {
    if (!stockSearch.trim()) return topPicks;
    const q = stockSearch.toLowerCase();
    return ALL_STOCKS.filter((s: Stock) => 
      s.symbol.toLowerCase().includes(q) || 
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [stockSearch, topPicks]);
  

  const { data: feeData } = useQuery<FeeCalculation>({
    queryKey: ['fees', fund, event, numAmount, coverFees],
    queryFn: async () => {
      const res = await fetch('/api/stripe/calculate-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fundSlug: fund, 
          eventSlug: event, 
          amount: numAmount,
          coverFees 
        }),
      });
      if (!res.ok) throw new Error('Failed to calculate fees');
      return res.json();
    },
    enabled: numAmount >= 5,
    staleTime: 5000,
  });

  const processingFee = feeData?.processingFee ?? (numAmount * 0.029 + 0.30);
  const platformFee = feeData?.koraFee ?? Math.max(1, Math.min(10, numAmount * 0.015));
  const total = feeData?.totalCharge ?? (numAmount + processingFee + platformFee);
  const hasEventPass = feeData?.hasEventPass ?? false;
  const hasFamilyPlan = feeData?.hasFamilyPlan ?? false;
  const feeWaived = hasEventPass || hasFamilyPlan;
  
  const recipientName = fund ? fund.charAt(0).toUpperCase() + fund.slice(1) : "Recipient";
  const eventTitle = event ? event.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null;

  const canQuickPay = numAmount >= 5 && paymentMethod === 'apple';
  const canSubmit = numAmount >= 5 && (paymentMethod === 'apple' || (name && email));

  const handleSubmitPayment = () => {
    if (!canQuickPay && !canSubmit) return;
    haptic('medium');
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);
      haptic('success');
    }, 2000);
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <Logo size="sm" className="text-primary" />
            <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-full">
              <Lock size={12} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Secure</span>
            </div>
          </div>
        </header>
        <Celebration trigger={isComplete} intensity="grand" type="confetti" />
        <main className="container mx-auto px-4 py-12 max-w-md">
          <SuccessGlow trigger={isComplete}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={bouncySpring}
            >
              <Card className="border-border shadow-xl text-center overflow-hidden">
                <motion.div 
                  className="h-2 bg-success"
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                />
                <CardContent className="p-8 space-y-6">
                  <motion.div
                    className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto relative"
                    variants={successPop}
                    initial="hidden"
                    animate="visible"
                  >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-success/20"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, ...bouncySpring }}
                  >
                    <Check className="h-8 w-8 text-success" />
                  </motion.div>
                </motion.div>
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-foreground">Gift sent!</h2>
                  <p className="text-muted-foreground">
                    ${displayAmount} to {recipientName}'s Future Fund
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-muted text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--kora-gold))]/20 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-[hsl(var(--kora-gold))]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">${displayAmount}{selectedStock ? ` of ${selectedStock.symbol}` : ''}</p>
                      <p className="text-xs text-muted-foreground">Will invest at next market open</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-[hsl(var(--kora-gold))] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--kora-gold))] animate-pulse"></span>
                        Processing
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invests in</span>
                      <span className="text-foreground">~4 hours (9:30 AM ET)</span>
                    </div>
                  </div>
                </div>

                {note && (
                  <div className="p-3 rounded-lg bg-[hsl(var(--kora-gold))]/10 border border-[hsl(var(--kora-gold))]/20 text-left">
                    <p className="text-xs text-[hsl(var(--kora-gold))] mb-1">Your message</p>
                    <p className="text-sm text-foreground">"{note}"</p>
                  </div>
                )}

                <div className="space-y-2">
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2"
                    onClick={() => {
                      haptic('light');
                      navigator.share?.({ 
                        title: `I just gifted to ${recipientName}'s Future Fund!`,
                        url: window.location.origin + `/${fund}`
                      }).catch(() => {});
                    }}
                    data-testid="button-share-gift"
                  >
                    Share this gift
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-11 border border-border text-foreground hover:bg-muted rounded-xl font-medium"
                    onClick={() => {
                      haptic('light');
                      setLocation('/');
                    }}
                    data-testid="button-done"
                  >
                    Done
                  </motion.button>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Confirmation sent to {email}. Assets held by Alpaca Securities LLC, Member FINRA/SIPC.
                </p>
              </CardContent>
              </Card>
            </motion.div>
          </SuccessGlow>
        </main>
      </div>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-background font-sans pb-8">
      <motion.header
        className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2, ease: easeOutExpo }}
      >
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" className="text-primary" />
          <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-full">
            <Lock size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Secure</span>
          </div>
        </div>
      </motion.header>
      
      <main className="max-w-lg mx-auto px-4 py-6">
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          <motion.div 
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--kora-gold))] to-[hsl(var(--kora-gold)/0.7)] flex items-center justify-center mx-auto mb-4 shadow-premium"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
          >
            <Gift className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Gift to {recipientName}'s Future
          </h1>
          {eventTitle && (
            <p className="text-sm text-muted-foreground">{eventTitle}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
        >
          <Card className="border-border/50 shadow-premium-sm rounded-2xl mb-4 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label className="text-sm font-semibold text-foreground">Pick a stock to gift</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">We'll invest this in their account</p>
                </div>
                {selectedStock && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => { haptic('light'); setSelectedStock(null); }}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    data-testid="button-clear-stock"
                  >
                    Change
                  </motion.button>
                )}
              </div>
              
              {!showStockPicker && !selectedStock ? (
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    {topPicks.map((stock) => (
                      <motion.button
                        key={stock.symbol}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { haptic('selection'); setSelectedStock(stock); }}
                        className="w-full p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors flex items-center gap-3 text-left"
                        data-testid={`quick-pick-${stock.symbol}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">{stock.symbol.slice(0, 2)}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{stock.symbol}</p>
                          <p className="text-xs text-muted-foreground">{stock.name}</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
                      </motion.button>
                    ))}
                  </div>
                  
                  {!showMoreStocks ? (
                    <button
                      onClick={() => { haptic('light'); setShowMoreStocks(true); }}
                      className="w-full text-center text-sm text-primary font-medium py-2 hover:underline"
                      data-testid="button-show-more-stocks"
                    >
                      Or pick a specific stock
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3"
                    >
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          autoFocus
                          placeholder="Search any stock..."
                          value={stockSearch}
                          onChange={(e) => { setStockSearch(e.target.value); if (e.target.value) setShowStockPicker(true); }}
                          onFocus={() => setShowStockPicker(true)}
                          className="pl-10 h-11 border-border bg-muted/50 text-foreground placeholder:text-muted-foreground rounded-xl text-sm"
                          data-testid="input-stock-search"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {morePicks.map((stock) => (
                          <motion.button
                            key={stock.symbol}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { haptic('selection'); setSelectedStock(stock); setShowMoreStocks(false); }}
                            className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-xs font-medium text-foreground"
                            data-testid={`more-pick-${stock.symbol}`}
                          >
                            {stock.symbol}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : selectedStock ? (
                <motion.button
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { haptic('light'); setShowStockPicker(true); setSelectedStock(null); }}
                  className="w-full p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mt-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                      <span className="text-white font-bold text-sm">{selectedStock.symbol.slice(0, 2)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-lg">{selectedStock.symbol}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {selectedStock.category}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedStock.name}</p>
                    </div>
                    <span className="text-xs text-primary font-medium">Change</span>
                  </div>
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 mt-3"
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Search any stock or ETF..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      className="pl-10 pr-10 h-12 border-border bg-muted/50 text-foreground placeholder:text-muted-foreground rounded-xl"
                      data-testid="input-stock-search"
                    />
                    <button
                      onClick={() => { setShowStockPicker(false); setStockSearch(''); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {!stockSearch.trim() && (
                    <p className="text-xs font-medium text-muted-foreground">Popular picks</p>
                  )}
                  {stockSearch.trim() && filteredStocks.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {filteredStocks.length} result{filteredStocks.length !== 1 ? 's' : ''} for "{stockSearch}"
                    </p>
                  )}
                  
                  <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
                    {filteredStocks.map((stock, i) => (
                      <motion.button
                        key={stock.symbol}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.015 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          haptic('selection');
                          setSelectedStock(stock);
                          setShowStockPicker(false);
                          setStockSearch('');
                        }}
                        className="w-full p-3 rounded-xl hover:bg-muted/80 active:bg-muted transition-colors flex items-center gap-3 text-left"
                        data-testid={`stock-${stock.symbol}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-muted to-border flex items-center justify-center text-xs font-bold text-foreground">
                          {stock.symbol.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{stock.symbol}</p>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {stock.category}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{stock.name}</p>
                        </div>
                      </motion.button>
                    ))}
                    {filteredStocks.length === 0 && stockSearch.trim() && (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground mb-1">No results for "{stockSearch}"</p>
                        <p className="text-xs text-muted-foreground">Try searching by ticker symbol or company name</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <Card className="border-border/50 shadow-premium-sm rounded-2xl mb-4 overflow-hidden">
            <CardContent className="p-6">
              <Label className="text-sm font-semibold text-foreground mb-4 block">
                {selectedStock ? `Gift amount of ${selectedStock.symbol}` : 'Choose amount'}
              </Label>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {SUGGESTED_AMOUNTS.map((amt, i) => {
                  const isSelected = amount === amt && !customAmount;
                  return (
                    <motion.button
                      key={amt}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15 + i * 0.03, type: "spring", stiffness: 400, damping: 25 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => { haptic('selection'); setAmount(amt); setCustomAmount(""); }}
                      className={`h-14 rounded-xl font-semibold text-base transition-all duration-150 ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground shadow-premium-lg ring-2 ring-primary/20' 
                          : 'bg-muted text-foreground hover:bg-border'
                      }`}
                      data-testid={`amount-${amt}`}
                    >
                      ${amt}
                    </motion.button>
                  );
                })}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  placeholder="Other amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-8 h-14 border-border bg-muted/50 text-foreground placeholder:text-muted-foreground rounded-xl text-base"
                  data-testid="input-custom-amount"
                />
              </div>
              {numAmount > 0 && numAmount < 5 && (
                <p className="text-xs text-destructive mt-3">Minimum gift is $5</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {paymentMethod === 'apple' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-5"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmitPayment}
              disabled={!canQuickPay || isProcessing}
              className="w-full h-16 bg-black text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 disabled:opacity-50 shadow-premium-lg"
              data-testid="button-apple-pay"
            >
              {isProcessing ? (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <span>Processing...</span>
                </motion.div>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <span>Pay · ${total.toFixed(2)}</span>
                </>
              )}
            </motion.button>
            <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Instant checkout with Apple Pay
            </p>
          </motion.div>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { haptic('light'); setShowDetails(!showDetails); }}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-muted/70 mb-4 transition-colors hover:bg-muted"
          data-testid="button-show-details"
        >
          <span className="text-sm font-medium text-foreground">
            {paymentMethod === 'apple' ? 'Add a note or change payment' : 'Your details & payment'}
          </span>
          <motion.div
            animate={{ rotate: showDetails ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="space-y-4 overflow-hidden"
            >
              <Card className="border-border/50 shadow-premium-sm rounded-2xl overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-foreground">Your details</h2>
                  <p className="text-xs text-muted-foreground -mt-2">So {recipientName} knows who sent this gift</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Your name</Label>
                      <Input
                        placeholder="Jane Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 border-border bg-card text-foreground placeholder:text-muted-foreground"
                        data-testid="input-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Email</Label>
                      <Input
                        type="email"
                        placeholder="jane@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 border-border bg-card text-foreground placeholder:text-muted-foreground"
                        data-testid="input-email"
                      />
                      <p className="text-xs text-muted-foreground">For your receipt and confirmation</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        {hideFromOthers ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">Hide my name from others</p>
                          <p className="text-xs text-muted-foreground">
                            {hideFromOthers 
                              ? "Only the recipient will see your name" 
                              : "Your name will appear on the contributor list"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hideFromOthers}
                        onCheckedChange={setHideFromOthers}
                        data-testid="toggle-hide-name"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-premium-sm rounded-2xl overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <Label className="text-sm font-semibold text-foreground">Add a note (optional)</Label>
                  <Textarea
                    placeholder="Happy birthday! This is for your future..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="resize-none border-border bg-muted/50 text-foreground placeholder:text-muted-foreground rounded-xl"
                    rows={3}
                    data-testid="input-note"
                  />
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-premium-sm rounded-2xl overflow-hidden">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-3">Payment method</h2>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => { haptic('selection'); setPaymentMethod('apple'); }}
                      className={`w-full p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 active:scale-[0.98] ${
                        paymentMethod === 'apple' 
                          ? 'border-primary bg-primary/5 shadow-premium-sm' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      data-testid="payment-apple"
                    >
                      <div className={`w-5 h-5 flex items-center justify-center ${paymentMethod === 'apple' ? 'text-primary' : 'text-muted-foreground'}`}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-foreground">Apple Pay</p>
                        <p className="text-xs text-muted-foreground">Fastest · 2.9% + $0.30</p>
                      </div>
                      {paymentMethod === 'apple' && <Check className="w-4 h-4 text-primary" />}
                    </button>
                    
                    <button
                      onClick={() => { haptic('selection'); setPaymentMethod('card'); }}
                      className={`w-full p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 active:scale-[0.98] ${
                        paymentMethod === 'card' 
                          ? 'border-primary bg-primary/5 shadow-premium-sm' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      data-testid="payment-card"
                    >
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-foreground">Card</p>
                        <p className="text-xs text-muted-foreground">Instant · 2.9% + $0.30</p>
                      </div>
                      {paymentMethod === 'card' && <Check className="w-4 h-4 text-primary" />}
                    </button>
                    
                    <button
                      onClick={() => { haptic('selection'); setPaymentMethod('bank'); }}
                      className={`w-full p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 active:scale-[0.98] ${
                        paymentMethod === 'bank' 
                          ? 'border-primary bg-primary/5 shadow-premium-sm' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      data-testid="payment-bank"
                    >
                      <Building2 className={`w-5 h-5 ${paymentMethod === 'bank' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-foreground">Bank transfer</p>
                        <p className="text-xs text-muted-foreground">2-3 days · $0.75</p>
                      </div>
                      {paymentMethod === 'bank' && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  </div>
                </CardContent>
              </Card>

              {paymentMethod === 'card' && (
                <Card className="border-border/50 shadow-premium-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Card number</Label>
                      <Input placeholder="4242 4242 4242 4242" className="h-12 border-border bg-muted/50 rounded-xl" data-testid="input-card-number" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Expiry</Label>
                        <Input placeholder="MM/YY" className="h-12 border-border bg-muted/50 rounded-xl" data-testid="input-card-expiry" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">CVC</Label>
                        <Input placeholder="123" className="h-12 border-border bg-muted/50 rounded-xl" data-testid="input-card-cvc" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="bg-muted/70 rounded-2xl p-5">
                {feeWaived && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-[hsl(var(--kora-evergreen)/0.1)] rounded-xl">
                    <Sparkles size={16} className="text-[hsl(var(--kora-evergreen))]" />
                    <span className="text-sm font-medium text-[hsl(var(--kora-evergreen))]">
                      {hasEventPass ? "Event Pass active" : "Family Plan active"} — platform fee waived!
                    </span>
                  </div>
                )}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gift amount</span>
                    <span className="font-medium text-foreground">${numAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing fee</span>
                    <span className="text-foreground">${processingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kora fee</span>
                    {feeWaived ? (
                      <span className="text-[hsl(var(--kora-evergreen))] flex items-center gap-1">
                        <span className="line-through text-muted-foreground">${(Math.max(1, Math.min(10, numAmount * 0.015))).toFixed(2)}</span>
                        $0.00
                      </span>
                    ) : (
                      <span className="text-foreground">${platformFee.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex justify-between font-semibold pt-3 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground text-lg">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmitPayment}
                disabled={!canSubmit || isProcessing}
                className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-premium-lg"
                data-testid="button-complete-gift"
              >
                {isProcessing ? (
                  <motion.div className="flex items-center gap-2">
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <span>Processing...</span>
                  </motion.div>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Complete gift · ${total.toFixed(2)}
                  </>
                )}
              </motion.button>

              <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground py-2">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>SIPC protected</span>
                </div>
              </div>
              
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed mt-3">
                Brokerage services provided by Alpaca Securities LLC, member{' '}
                <span className="font-medium">FINRA/SIPC</span>. 
                Investments involve risk and are not FDIC insured.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {!showDetails && !canSubmit && (
          <p className="text-xs text-muted-foreground text-center">
            Expand "Your details" above to enter your name and email
          </p>
        )}
        
        <footer className="mt-8 pt-4 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Brokerage services provided by Alpaca Securities LLC, member FINRA/SIPC. 
            SIPC protects against broker-dealer failure up to $500k, not market losses.
          </p>
        </footer>
      </main>
    </PageTransition>
  );
}
