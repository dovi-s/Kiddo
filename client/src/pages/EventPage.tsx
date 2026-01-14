import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, TrendingUp, DollarSign, Sparkles, Share2, Copy, Check } from "lucide-react";
import { Confetti } from "@/components/ui/confetti";
import { bouncySpring, gentleSpring } from "@/lib/animations";
import { LiveContributorTicker, ContributorBubbles, InvestmentReveal } from "@/components/ui/live-ticker";

const AMOUNTS = [25, 50, 100, 250];

interface StockOption {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  sector?: string;
  popular?: boolean;
}

const STOCK_DATABASE: StockOption[] = [
  // Popular / Featured
  { id: "VTI", symbol: "VTI", name: "Total US Market", price: 268.45, change: 0.42, sector: "Index", popular: true },
  { id: "VOO", symbol: "VOO", name: "S&P 500", price: 489.12, change: 0.38, sector: "Index", popular: true },
  { id: "AAPL", symbol: "AAPL", name: "Apple", price: 178.50, change: 1.24, sector: "Technology", popular: true },
  { id: "MSFT", symbol: "MSFT", name: "Microsoft", price: 425.22, change: 0.89, sector: "Technology", popular: true },
  { id: "GOOGL", symbol: "GOOGL", name: "Alphabet", price: 175.98, change: -0.32, sector: "Technology", popular: true },
  { id: "AMZN", symbol: "AMZN", name: "Amazon", price: 185.60, change: 1.15, sector: "Consumer", popular: true },
  { id: "DIS", symbol: "DIS", name: "Disney", price: 112.45, change: 0.67, sector: "Entertainment", popular: true },
  { id: "TSLA", symbol: "TSLA", name: "Tesla", price: 248.50, change: -1.82, sector: "Automotive", popular: true },
  // Technology
  { id: "NFLX", symbol: "NFLX", name: "Netflix", price: 628.90, change: 2.14, sector: "Entertainment" },
  { id: "NVDA", symbol: "NVDA", name: "NVIDIA", price: 875.28, change: 3.45, sector: "Technology" },
  { id: "META", symbol: "META", name: "Meta", price: 505.75, change: 1.28, sector: "Technology" },
  { id: "AMD", symbol: "AMD", name: "Advanced Micro Devices", price: 156.82, change: 2.15, sector: "Technology" },
  { id: "INTC", symbol: "INTC", name: "Intel", price: 31.45, change: -0.85, sector: "Technology" },
  { id: "CRM", symbol: "CRM", name: "Salesforce", price: 268.90, change: 0.92, sector: "Technology" },
  { id: "ORCL", symbol: "ORCL", name: "Oracle", price: 142.35, change: 0.45, sector: "Technology" },
  { id: "ADBE", symbol: "ADBE", name: "Adobe", price: 485.60, change: 1.35, sector: "Technology" },
  { id: "CSCO", symbol: "CSCO", name: "Cisco Systems", price: 48.72, change: 0.28, sector: "Technology" },
  { id: "IBM", symbol: "IBM", name: "IBM", price: 168.45, change: 0.65, sector: "Technology" },
  { id: "PYPL", symbol: "PYPL", name: "PayPal", price: 62.85, change: -1.25, sector: "Technology" },
  { id: "SQ", symbol: "SQ", name: "Block (Square)", price: 72.40, change: 1.85, sector: "Technology" },
  { id: "SHOP", symbol: "SHOP", name: "Shopify", price: 68.95, change: 2.45, sector: "Technology" },
  { id: "SPOT", symbol: "SPOT", name: "Spotify", price: 315.20, change: 1.68, sector: "Technology" },
  { id: "UBER", symbol: "UBER", name: "Uber", price: 78.45, change: 0.95, sector: "Technology" },
  { id: "LYFT", symbol: "LYFT", name: "Lyft", price: 12.85, change: -0.45, sector: "Technology" },
  { id: "ABNB", symbol: "ABNB", name: "Airbnb", price: 142.60, change: 1.25, sector: "Technology" },
  { id: "SNOW", symbol: "SNOW", name: "Snowflake", price: 158.90, change: 2.85, sector: "Technology" },
  { id: "PLTR", symbol: "PLTR", name: "Palantir", price: 22.45, change: 3.25, sector: "Technology" },
  { id: "ZM", symbol: "ZM", name: "Zoom Video", price: 68.25, change: -0.65, sector: "Technology" },
  { id: "DOCU", symbol: "DOCU", name: "DocuSign", price: 58.90, change: 0.45, sector: "Technology" },
  // Finance
  { id: "JPM", symbol: "JPM", name: "JPMorgan Chase", price: 198.45, change: 0.56, sector: "Finance" },
  { id: "BAC", symbol: "BAC", name: "Bank of America", price: 38.92, change: 0.42, sector: "Finance" },
  { id: "WFC", symbol: "WFC", name: "Wells Fargo", price: 58.45, change: 0.35, sector: "Finance" },
  { id: "GS", symbol: "GS", name: "Goldman Sachs", price: 458.75, change: 0.85, sector: "Finance" },
  { id: "MS", symbol: "MS", name: "Morgan Stanley", price: 98.65, change: 0.65, sector: "Finance" },
  { id: "V", symbol: "V", name: "Visa", price: 285.40, change: 0.48, sector: "Finance" },
  { id: "MA", symbol: "MA", name: "Mastercard", price: 468.90, change: 0.55, sector: "Finance" },
  { id: "AXP", symbol: "AXP", name: "American Express", price: 235.80, change: 0.72, sector: "Finance" },
  { id: "BRK.B", symbol: "BRK.B", name: "Berkshire Hathaway", price: 412.50, change: 0.28, sector: "Finance" },
  { id: "C", symbol: "C", name: "Citigroup", price: 62.45, change: 0.45, sector: "Finance" },
  // Healthcare
  { id: "JNJ", symbol: "JNJ", name: "Johnson & Johnson", price: 156.20, change: -0.18, sector: "Healthcare" },
  { id: "UNH", symbol: "UNH", name: "UnitedHealth", price: 528.45, change: 0.65, sector: "Healthcare" },
  { id: "PFE", symbol: "PFE", name: "Pfizer", price: 28.65, change: -0.35, sector: "Healthcare" },
  { id: "MRK", symbol: "MRK", name: "Merck", price: 125.80, change: 0.42, sector: "Healthcare" },
  { id: "ABBV", symbol: "ABBV", name: "AbbVie", price: 178.90, change: 0.55, sector: "Healthcare" },
  { id: "LLY", symbol: "LLY", name: "Eli Lilly", price: 785.45, change: 2.15, sector: "Healthcare" },
  { id: "TMO", symbol: "TMO", name: "Thermo Fisher", price: 545.20, change: 0.85, sector: "Healthcare" },
  { id: "ABT", symbol: "ABT", name: "Abbott Labs", price: 108.65, change: 0.35, sector: "Healthcare" },
  { id: "DHR", symbol: "DHR", name: "Danaher", price: 248.90, change: 0.65, sector: "Healthcare" },
  { id: "BMY", symbol: "BMY", name: "Bristol-Myers Squibb", price: 42.85, change: -0.25, sector: "Healthcare" },
  // Consumer
  { id: "KO", symbol: "KO", name: "Coca-Cola", price: 62.45, change: 0.22, sector: "Consumer" },
  { id: "PEP", symbol: "PEP", name: "PepsiCo", price: 168.90, change: 0.35, sector: "Consumer" },
  { id: "NKE", symbol: "NKE", name: "Nike", price: 98.75, change: -0.45, sector: "Consumer" },
  { id: "SBUX", symbol: "SBUX", name: "Starbucks", price: 95.80, change: 0.34, sector: "Consumer" },
  { id: "MCD", symbol: "MCD", name: "McDonald's", price: 285.45, change: 0.42, sector: "Consumer" },
  { id: "WMT", symbol: "WMT", name: "Walmart", price: 168.25, change: 0.55, sector: "Consumer" },
  { id: "TGT", symbol: "TGT", name: "Target", price: 142.80, change: -0.65, sector: "Consumer" },
  { id: "COST", symbol: "COST", name: "Costco", price: 745.90, change: 0.85, sector: "Consumer" },
  { id: "HD", symbol: "HD", name: "Home Depot", price: 358.45, change: 0.45, sector: "Consumer" },
  { id: "LOW", symbol: "LOW", name: "Lowe's", price: 228.90, change: 0.55, sector: "Consumer" },
  { id: "PG", symbol: "PG", name: "Procter & Gamble", price: 165.80, change: 0.28, sector: "Consumer" },
  { id: "CL", symbol: "CL", name: "Colgate-Palmolive", price: 92.45, change: 0.18, sector: "Consumer" },
  // Energy
  { id: "XOM", symbol: "XOM", name: "Exxon Mobil", price: 108.45, change: -0.85, sector: "Energy" },
  { id: "CVX", symbol: "CVX", name: "Chevron", price: 158.90, change: -0.65, sector: "Energy" },
  { id: "COP", symbol: "COP", name: "ConocoPhillips", price: 115.25, change: -0.45, sector: "Energy" },
  { id: "SLB", symbol: "SLB", name: "Schlumberger", price: 48.65, change: -0.35, sector: "Energy" },
  // Industrial
  { id: "BA", symbol: "BA", name: "Boeing", price: 185.45, change: 1.25, sector: "Industrial" },
  { id: "CAT", symbol: "CAT", name: "Caterpillar", price: 358.90, change: 0.85, sector: "Industrial" },
  { id: "GE", symbol: "GE", name: "General Electric", price: 168.45, change: 0.65, sector: "Industrial" },
  { id: "HON", symbol: "HON", name: "Honeywell", price: 198.75, change: 0.45, sector: "Industrial" },
  { id: "UPS", symbol: "UPS", name: "United Parcel Service", price: 142.85, change: 0.35, sector: "Industrial" },
  { id: "FDX", symbol: "FDX", name: "FedEx", price: 268.90, change: 0.55, sector: "Industrial" },
  // ETFs
  { id: "QQQ", symbol: "QQQ", name: "Nasdaq 100 ETF", price: 445.80, change: 0.95, sector: "Index" },
  { id: "SPY", symbol: "SPY", name: "S&P 500 ETF", price: 498.45, change: 0.42, sector: "Index" },
  { id: "IWM", symbol: "IWM", name: "Russell 2000 ETF", price: 218.90, change: 0.65, sector: "Index" },
  { id: "DIA", symbol: "DIA", name: "Dow Jones ETF", price: 398.45, change: 0.35, sector: "Index" },
  { id: "VGT", symbol: "VGT", name: "Vanguard Tech ETF", price: 528.90, change: 1.15, sector: "Index" },
  { id: "XLF", symbol: "XLF", name: "Financial Select ETF", price: 42.85, change: 0.45, sector: "Index" },
  { id: "XLE", symbol: "XLE", name: "Energy Select ETF", price: 88.45, change: -0.55, sector: "Index" },
  { id: "XLV", symbol: "XLV", name: "Healthcare Select ETF", price: 142.65, change: 0.35, sector: "Index" },
  { id: "ARKK", symbol: "ARKK", name: "ARK Innovation ETF", price: 48.90, change: 2.85, sector: "Index" },
  { id: "VEA", symbol: "VEA", name: "Developed Markets ETF", price: 48.25, change: 0.25, sector: "Index" },
  { id: "VWO", symbol: "VWO", name: "Emerging Markets ETF", price: 42.85, change: 0.45, sector: "Index" },
  // Entertainment & Media
  { id: "WBD", symbol: "WBD", name: "Warner Bros Discovery", price: 8.45, change: -1.25, sector: "Entertainment" },
  { id: "PARA", symbol: "PARA", name: "Paramount Global", price: 12.85, change: -0.85, sector: "Entertainment" },
  { id: "CMCSA", symbol: "CMCSA", name: "Comcast", price: 38.90, change: 0.35, sector: "Entertainment" },
  { id: "T", symbol: "T", name: "AT&T", price: 18.45, change: 0.25, sector: "Telecom" },
  { id: "VZ", symbol: "VZ", name: "Verizon", price: 42.85, change: 0.35, sector: "Telecom" },
  { id: "TMUS", symbol: "TMUS", name: "T-Mobile", price: 168.90, change: 0.55, sector: "Telecom" },
  // Gaming & Sports
  { id: "EA", symbol: "EA", name: "Electronic Arts", price: 138.45, change: 0.65, sector: "Gaming" },
  { id: "TTWO", symbol: "TTWO", name: "Take-Two Interactive", price: 158.90, change: 0.85, sector: "Gaming" },
  { id: "RBLX", symbol: "RBLX", name: "Roblox", price: 42.85, change: 2.45, sector: "Gaming" },
  { id: "DKNG", symbol: "DKNG", name: "DraftKings", price: 38.90, change: 1.85, sector: "Gaming" },
  // Automotive
  { id: "F", symbol: "F", name: "Ford", price: 12.45, change: 0.35, sector: "Automotive" },
  { id: "GM", symbol: "GM", name: "General Motors", price: 38.90, change: 0.45, sector: "Automotive" },
  { id: "RIVN", symbol: "RIVN", name: "Rivian", price: 18.45, change: -1.85, sector: "Automotive" },
  { id: "LCID", symbol: "LCID", name: "Lucid Motors", price: 3.85, change: -2.45, sector: "Automotive" },
  { id: "TM", symbol: "TM", name: "Toyota", price: 248.90, change: 0.45, sector: "Automotive" },
  // Food & Beverage
  { id: "MDLZ", symbol: "MDLZ", name: "Mondelez", price: 72.45, change: 0.25, sector: "Consumer" },
  { id: "KHC", symbol: "KHC", name: "Kraft Heinz", price: 35.80, change: 0.15, sector: "Consumer" },
  { id: "GIS", symbol: "GIS", name: "General Mills", price: 68.45, change: 0.22, sector: "Consumer" },
  { id: "K", symbol: "K", name: "Kellogg's", price: 58.90, change: 0.18, sector: "Consumer" },
  { id: "HSY", symbol: "HSY", name: "Hershey", price: 195.45, change: 0.35, sector: "Consumer" },
  // Real Estate
  { id: "AMT", symbol: "AMT", name: "American Tower", price: 198.45, change: 0.45, sector: "Real Estate" },
  { id: "PLD", symbol: "PLD", name: "Prologis", price: 128.90, change: 0.55, sector: "Real Estate" },
  { id: "SPG", symbol: "SPG", name: "Simon Property", price: 158.45, change: 0.65, sector: "Real Estate" },
  // Crypto-related
  { id: "COIN", symbol: "COIN", name: "Coinbase", price: 225.80, change: 4.85, sector: "Finance" },
  { id: "MSTR", symbol: "MSTR", name: "MicroStrategy", price: 1685.45, change: 5.25, sector: "Technology" },
  // Space & Defense
  { id: "LMT", symbol: "LMT", name: "Lockheed Martin", price: 468.90, change: 0.45, sector: "Defense" },
  { id: "RTX", symbol: "RTX", name: "RTX (Raytheon)", price: 98.45, change: 0.35, sector: "Defense" },
  { id: "NOC", symbol: "NOC", name: "Northrop Grumman", price: 478.90, change: 0.55, sector: "Defense" },
];

const getStoredPageData = (key: string) => {
  try {
    const stored = localStorage.getItem(`kora_page_${key}`);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

export default function EventPage() {
  const params = useParams<{ slug: string; event: string }>();
  const fundSlug = params.slug || "mila";
  const eventSlug = params.event || "anytime";
  
  const savedData = getStoredPageData(`${fundSlug}_${eventSlug}`);
  
  const recipientName = fundSlug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const eventTitle = savedData?.title || (eventSlug === "anytime" 
    ? null 
    : eventSlug
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "));
  
  const headline = savedData?.headline;
  const description = savedData?.description;
  const photo = savedData?.photo;
  const buttonText = savedData?.buttonText || "Continue";
  const showProgress = savedData?.showAmount;
  const goalAmount = savedData?.goalAmount || 1000;
  const currentAmount = savedData?.currentAmount || 0;

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");
  const [giverEmail, setGiverEmail] = useState("");
  const [giverPhone, setGiverPhone] = useState("");
  const [wantsSmsUpdates, setWantsSmsUpdates] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryType, setDeliveryType] = useState<"fund" | "stock" | "cash">("fund");
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(null);

  const finalAmount = customAmount ? parseInt(customAmount) || 0 : amount;
  const fee = Math.round(finalAmount * 0.029 * 100) / 100;
  const total = (finalAmount + fee).toFixed(2);
  const projectedGrowth = Math.round(finalAmount * 4.6);

  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) {
      return STOCK_DATABASE.filter(s => s.popular);
    }
    const query = searchQuery.toLowerCase();
    return STOCK_DATABASE.filter(s => 
      s.symbol.toLowerCase().includes(query) || 
      s.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const shareQuantity = useMemo(() => {
    if (deliveryType === "cash" || deliveryType === "fund" || !selectedStock || finalAmount <= 0) return null;
    return (finalAmount / selectedStock.price).toFixed(4);
  }, [deliveryType, selectedStock, finalAmount]);

  const handleSelectStock = (stock: StockOption) => {
    setSelectedStock(stock);
    setDeliveryType("stock");
    setShowStockPicker(false);
    setSearchQuery("");
  };

  const handleSelectFund = () => {
    setDeliveryType("fund");
    setSelectedStock(null);
    setShowStockPicker(false);
  };

  const handleSelectCash = () => {
    setDeliveryType("cash");
    setSelectedStock(null);
    setShowStockPicker(false);
  };

  const getInvestmentLabel = () => {
    if (deliveryType === "cash") return "Cash";
    if (deliveryType === "fund") return "Fund's strategy";
    if (selectedStock) return selectedStock.symbol;
    return "Fund's strategy";
  };

  const handleGive = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep(2);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm pb-2">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => window.history.back()}
            data-testid="button-back"
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-foreground">{eventTitle || "Give"}</span>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--kora-evergreen)/0.1)] border border-[hsl(var(--kora-evergreen)/0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--kora-evergreen))]"></span>
            <span className="text-xs text-[hsl(var(--kora-evergreen))] font-medium">Secure</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 relative">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          
          <div className="hidden lg:block lg:sticky lg:top-20 relative z-10">
            {photo && (
              <img 
                src={photo} 
                alt="" 
                className="w-full aspect-video object-cover rounded-2xl mb-8 shadow-xl"
              />
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-card border border-border rounded-2xl p-8 mb-8 shadow-lg"
            >
              <div className="relative z-10">
                {!photo && (
                  <div className="w-20 h-20 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-medium mb-6 shadow-xl">
                    {recipientName.charAt(0)}
                  </div>
                )}
                <h1 className="text-3xl font-semibold text-foreground mb-3">
                  {headline || `Give to ${recipientName}`}
                </h1>
                {description && (
                  <p className="text-muted-foreground text-lg leading-relaxed">{description}</p>
                )}
                {!description && eventTitle && (
                  <p className="text-muted-foreground text-lg">{eventTitle}</p>
                )}
              </div>
            </motion.div>

            {showProgress && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8 p-6 bg-card rounded-2xl border border-border shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-foreground">Group goal</span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[hsl(var(--kora-evergreen)/0.1)] text-[hsl(var(--kora-evergreen))]">
                    {Math.round((currentAmount / goalAmount) * 100)}% funded
                  </span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((currentAmount / goalAmount) * 100, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-[hsl(var(--kora-evergreen))] rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {["D", "R", "S", "M"].slice(0, 4).map((initial, i) => (
                        <div 
                          key={i} 
                          className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-semibold text-muted-foreground shadow-sm"
                        >
                          {initial}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">12 people have given</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-foreground">${currentAmount.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground ml-1">/ ${goalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <LiveContributorTicker />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-5 rounded-2xl bg-card border border-border space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--kora-evergreen)/0.1)] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[hsl(var(--kora-evergreen))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-sm text-muted-foreground">100% of your gift is invested</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="text-sm text-muted-foreground">SIPC protected up to $500,000</span>
              </div>
            </motion.div>
          </div>

          <div className="max-w-lg mx-auto lg:mx-0 lg:max-w-none">
            <AnimatePresence mode="wait">
              
              {step === 0 && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="lg:hidden relative z-10">
                    <div className="text-sm mb-8 flex items-center gap-2 flex-wrap">
                      <Link href="/dashboard">
                        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-border transition-colors text-xs">Dashboard</span>
                      </Link>
                      <span className="text-border">›</span>
                      <Link href={`/${fundSlug}`}>
                        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-border transition-colors text-xs">{recipientName}</span>
                      </Link>
                      {eventTitle && (
                        <>
                          <span className="text-border">›</span>
                          <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs">{eventTitle}</span>
                        </>
                      )}
                    </div>

                    {photo && (
                      <img 
                        src={photo} 
                        alt="" 
                        className="w-full aspect-video object-cover rounded-2xl mb-6 shadow-lg"
                      />
                    )}

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center mb-10"
                    >
                      {!photo && (
                        <div className="w-20 h-20 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-medium mx-auto mb-6 shadow-xl ring-4 ring-card/80">
                          {recipientName.charAt(0)}
                        </div>
                      )}
                      <h1 className="text-2xl font-semibold text-foreground mb-2">
                        {headline || `Give to ${recipientName}`}
                      </h1>
                      {description && (
                        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{description}</p>
                      )}
                      {!description && eventTitle && (
                        <p className="text-muted-foreground">{eventTitle}</p>
                      )}
                    </motion.div>

                    {showProgress && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-8 p-4 rounded-2xl bg-card border border-border shadow-lg"
                      >
                        <div className="flex justify-between text-sm mb-3">
                          <span className="font-semibold text-foreground">${currentAmount.toLocaleString()}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--kora-evergreen)/0.1)] text-[hsl(var(--kora-evergreen))]">{Math.round((currentAmount / goalAmount) * 100)}%</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((currentAmount / goalAmount) * 100, 100)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-[hsl(var(--kora-evergreen))] rounded-full"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Goal: ${goalAmount.toLocaleString()}</p>
                      </motion.div>
                    )}
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative overflow-hidden bg-card border border-border rounded-2xl p-6 shadow-lg"
                  >
                    <div className="relative z-10">
                      <h2 className="text-lg font-semibold text-foreground mb-6">Choose an amount</h2>
                      
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {AMOUNTS.map((a) => (
                          <button
                            key={a}
                            onClick={() => { setAmount(a); setCustomAmount(""); }}
                            data-testid={`amount-${a}`}
                            className={`py-4 rounded-xl text-sm font-semibold transition-all ${
                              amount === a && !customAmount
                                ? "bg-primary text-primary-foreground shadow-lg"
                                : "bg-card border border-border text-foreground hover:border-muted-foreground hover:shadow-md"
                            }`}
                          >
                            ${a}
                          </button>
                        ))}
                      </div>

                      <div className="relative mb-6">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Other amount"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                          data-testid="input-custom-amount"
                          className="w-full pl-8 pr-4 py-4 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </div>

                      {finalAmount > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-6 bg-primary text-primary-foreground rounded-2xl mb-6 shadow-xl"
                        >
                          <p className="text-primary-foreground/70 text-sm mb-1">Your ${finalAmount} could become</p>
                          <p className="text-4xl font-semibold">${projectedGrowth.toLocaleString()}</p>
                          <p className="text-primary-foreground/60 text-sm mt-1">in 18 years at 7% annual return</p>
                        </motion.div>
                      )}

                      <div className="mb-6">
                        <button
                          onClick={() => setShowStockPicker(true)}
                          data-testid="button-open-stock-picker"
                          className="w-full p-4 bg-card border border-border rounded-xl hover:border-muted-foreground hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                deliveryType === "cash" 
                                  ? "bg-[hsl(var(--kora-evergreen)/0.1)] text-[hsl(var(--kora-evergreen))]" 
                                  : deliveryType === "stock" 
                                    ? "bg-muted text-foreground" 
                                    : "bg-primary text-primary-foreground"
                              }`}>
                                {deliveryType === "cash" ? (
                                  <DollarSign size={18} />
                                ) : deliveryType === "stock" && selectedStock ? (
                                  <span className="text-xs font-semibold">{selectedStock.symbol.slice(0, 3)}</span>
                                ) : (
                                  <TrendingUp size={18} />
                                )}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium text-foreground">
                                  {deliveryType === "cash" 
                                    ? "Let them choose" 
                                    : deliveryType === "stock" && selectedStock 
                                      ? selectedStock.name 
                                      : "Future Fund"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {deliveryType === "cash" 
                                    ? "Held as Seed until family decides" 
                                    : deliveryType === "stock" && selectedStock 
                                      ? `${selectedStock.symbol} · $${selectedStock.price.toFixed(2)}` 
                                      : "Diversified portfolio"}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Change</span>
                          </div>
                          
                          {deliveryType === "stock" && selectedStock && finalAmount > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground">
                                ${finalAmount} = <span className="font-medium text-foreground">{shareQuantity} shares</span> at ${selectedStock.price.toFixed(2)}
                              </p>
                            </div>
                          )}
                        </button>
                      </div>

                      <button
                        onClick={() => setStep(1)}
                        disabled={finalAmount < 5}
                        data-testid="button-continue"
                        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold disabled:opacity-40 hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors shadow-xl"
                      >
                        {buttonText}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button 
                    onClick={() => setStep(0)}
                    data-testid="button-back-step1"
                    className="text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
                  >
                    ← Back
                  </button>

                  <div className="lg:bg-card lg:border lg:border-border lg:rounded-xl lg:p-6">
                    <p className="text-sm text-muted-foreground mb-1">Giving ${finalAmount} to {recipientName}</p>
                    <h1 className="text-2xl font-light text-foreground mb-8">Add your details</h1>

                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">Your name</label>
                        <input
                          type="text"
                          value={giverName}
                          onChange={(e) => setGiverName(e.target.value)}
                          placeholder="How they'll see you"
                          data-testid="input-name"
                          className="w-full px-4 py-3 lg:py-4 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">Your email</label>
                        <input
                          type="email"
                          value={giverEmail}
                          onChange={(e) => setGiverEmail(e.target.value)}
                          placeholder="For your receipt"
                          data-testid="input-email"
                          className="w-full px-4 py-3 lg:py-4 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">Add a note (optional)</label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="A message for them..."
                          rows={3}
                          data-testid="input-message"
                          className="w-full px-4 py-3 lg:py-4 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none transition-all"
                        />
                      </div>
                      
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setWantsSmsUpdates(!wantsSmsUpdates)}
                          data-testid="toggle-sms-updates"
                          className="w-full flex items-start gap-3 p-4 bg-secondary border border-border rounded-xl hover:border-muted-foreground transition-all text-left"
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            wantsSmsUpdates 
                              ? "bg-primary border-primary" 
                              : "border-border bg-card"
                          }`}>
                            {wantsSmsUpdates && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Get text updates</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Receive a text when the gift is invested and a personal thank-you from {recipientName}'s family</p>
                          </div>
                        </button>
                        
                        <AnimatePresence>
                          {wantsSmsUpdates && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3">
                                <input
                                  type="tel"
                                  value={giverPhone}
                                  onChange={(e) => setGiverPhone(e.target.value)}
                                  placeholder="(555) 123-4567"
                                  data-testid="input-phone"
                                  className="w-full px-4 py-3 lg:py-4 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                                />
                                <p className="text-[11px] text-muted-foreground mt-2 px-1">
                                  By providing your number, you agree to receive SMS updates about this gift. Msg & data rates may apply.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="p-4 bg-card border border-border rounded mb-6 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Gift amount</span>
                        <span className="text-foreground">${finalAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Processing fee</span>
                        <span className="text-foreground">${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium pt-2 border-t border-border">
                        <span className="text-foreground">Total</span>
                        <span className="text-foreground">${total}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={handleGive}
                        disabled={isProcessing || !giverName || !giverEmail || (wantsSmsUpdates && !giverPhone)}
                        data-testid="button-apple-pay"
                        className="w-full py-3 lg:py-4 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-40 hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing ? "Processing..." : (
                          <>
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.0361 6.26816C16.9101 5.85953 16.5165 5.58594 16.0754 5.58594H7.92467C7.48358 5.58594 7.08997 5.85953 6.96392 6.26816L5.99219 9.57031V10.5703C5.99219 11.1226 6.43991 11.5703 6.99219 11.5703H7.00781V17.418C7.00781 17.9703 7.45553 18.418 8.00781 18.418H15.9922C16.5445 18.418 16.9922 17.9703 16.9922 17.418V11.5703H17.0078C17.5601 11.5703 18.0078 11.1226 18.0078 10.5703V9.57031L17.0361 6.26816Z"/>
                            </svg>
                            Pay with Apple Pay
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleGive}
                        disabled={isProcessing || !giverName || !giverEmail || (wantsSmsUpdates && !giverPhone)}
                        data-testid="button-card"
                        className="w-full py-3 lg:py-4 bg-card border border-border text-foreground rounded-xl font-medium disabled:opacity-40 hover:bg-muted transition-colors"
                      >
                        Pay with card
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center mt-4">
                      100% of your gift is invested
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={bouncySpring}
                  className="text-center pt-8 lg:pt-12"
                >
                  <Confetti isActive={true} />
                  
                  <div className="max-w-md mx-auto space-y-6">
                    <InvestmentReveal 
                      amount={finalAmount}
                      stockSymbol={deliveryType === "stock" && selectedStock ? selectedStock.symbol : "VTI"}
                      stockName={deliveryType === "stock" && selectedStock ? selectedStock.name : "Total US Market"}
                      shares={deliveryType === "stock" && selectedStock 
                        ? (finalAmount / selectedStock.price).toFixed(4) 
                        : (finalAmount / 268.45).toFixed(4)
                      }
                    />

                    <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                      >
                        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground mb-2">
                          Gift sent!
                        </h1>
                        <p className="text-muted-foreground mb-6">
                          {recipientName}'s family will be notified
                        </p>

                        <div className="p-4 bg-secondary rounded-xl mb-6 text-left space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium text-foreground">${finalAmount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Investment</span>
                            <span className="font-medium text-foreground">{getInvestmentLabel()}</span>
                          </div>
                          {message && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-sm text-muted-foreground">"{message}"</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <button
                            onClick={() => {
                              const shareUrl = window.location.href;
                              navigator.clipboard.writeText(shareUrl);
                            }}
                            data-testid="button-share"
                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors flex items-center justify-center gap-2"
                          >
                            <Share2 size={16} />
                            Share this fund
                          </button>
                          <Link href="/dashboard">
                            <button 
                              data-testid="button-done"
                              className="w-full py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-muted transition-colors"
                            >
                              Done
                            </button>
                          </Link>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showStockPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/60 z-50 flex items-end lg:items-center justify-center"
            onClick={() => setShowStockPicker(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={gentleSpring}
              onClick={(e) => e.stopPropagation()}
              className="w-full lg:max-w-lg bg-card rounded-t-3xl lg:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <h3 className="text-lg font-semibold text-foreground">Choose investment</h3>
                <button 
                  onClick={() => setShowStockPicker(false)}
                  data-testid="button-close-stock-picker"
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 border-b border-border shrink-0">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stocks..."
                    data-testid="input-stock-search"
                    className="w-full pl-10 pr-4 py-3 bg-muted border-0 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {!searchQuery && (
                  <>
                    <button
                      onClick={handleSelectFund}
                      data-testid="option-fund"
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        deliveryType === "fund"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <TrendingUp size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Future Fund</p>
                          <p className="text-sm text-muted-foreground">Diversified portfolio managed by family</p>
                        </div>
                        {deliveryType === "fund" && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={handleSelectCash}
                      data-testid="option-cash"
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        deliveryType === "cash"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[hsl(var(--kora-evergreen)/0.1)] text-[hsl(var(--kora-evergreen))] flex items-center justify-center">
                          <DollarSign size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Let them choose</p>
                          <p className="text-sm text-muted-foreground">Held as Seed until family decides</p>
                        </div>
                        {deliveryType === "cash" && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-border"></div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Or pick a stock</span>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  {searchQuery && filteredStocks.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                        <Search size={20} className="text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">No results for "{searchQuery}"</p>
                      <p className="text-sm text-muted-foreground mt-1">Try Apple, Tesla, Disney, or S&P 500</p>
                    </div>
                  ) : (
                    filteredStocks.map((stock) => {
                      const shares = finalAmount > 0 ? (finalAmount / stock.price).toFixed(4) : "0";
                      const isSelected = deliveryType === "stock" && selectedStock?.id === stock.id;
                      
                      return (
                        <button
                          key={stock.id}
                          onClick={() => handleSelectStock(stock)}
                          data-testid={`stock-${stock.symbol}`}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground bg-card"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <span className="text-xs font-bold text-muted-foreground">{stock.symbol}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground truncate">{stock.name}</p>
                                {stock.sector && (
                                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">{stock.sector}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-sm text-muted-foreground">${stock.price.toFixed(2)}</span>
                                <span className={`text-xs ${stock.change >= 0 ? "text-[hsl(var(--kora-evergreen))]" : "text-destructive"}`}>
                                  {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {finalAmount > 0 && (
                                <p className="text-sm font-medium text-foreground">{shares} shares</p>
                              )}
                              {isSelected && (
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-1 ml-auto">
                                  <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-border bg-secondary space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Orders execute during market hours · Final shares may differ from estimate
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  All investments go to {recipientName}'s fund · Assets held by Apex Clearing
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
