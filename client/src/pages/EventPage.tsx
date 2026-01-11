import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, TrendingUp, DollarSign, Sparkles } from "lucide-react";

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
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button 
            onClick={() => window.history.back()}
            data-testid="button-back"
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm font-medium text-stone-900">{eventTitle || "Give"}</span>
          <span className="text-xs text-stone-400 w-16 text-right">Secure</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          
          {/* Left column - Info (desktop) */}
          <div className="hidden lg:block lg:sticky lg:top-20">
            {/* Photo */}
            {photo && (
              <img 
                src={photo} 
                alt="" 
                className="w-full aspect-video object-cover rounded-2xl mb-8"
              />
            )}

            {/* Header */}
            <div className="mb-8">
              {!photo && (
                <div className="w-20 h-20 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-2xl font-light mb-6">
                  {recipientName.charAt(0)}
                </div>
              )}
              <h1 className="text-3xl font-light text-stone-900 mb-2">
                {headline || `Give to ${recipientName}`}
              </h1>
              {description && (
                <p className="text-stone-500 text-lg leading-relaxed">{description}</p>
              )}
              {!description && eventTitle && (
                <p className="text-stone-500 text-lg">{eventTitle}</p>
              )}
            </div>

            {/* Progress bar with teamwork feel */}
            {showProgress && (
              <div className="mb-8 p-5 bg-white rounded-xl border border-stone-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-stone-900">Group goal</span>
                  <span className="text-xs text-stone-400">
                    {Math.round((currentAmount / goalAmount) * 100)}% funded
                  </span>
                </div>
                <div className="h-3 bg-stone-100 rounded-full overflow-hidden mb-3">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                    style={{ width: `${Math.min((currentAmount / goalAmount) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {["D", "R", "S", "M"].slice(0, 4).map((initial, i) => (
                        <div 
                          key={i} 
                          className="w-6 h-6 rounded-full bg-stone-200 border-2 border-white flex items-center justify-center text-[10px] font-medium text-stone-600"
                        >
                          {initial}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-stone-500">12 people have given</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-stone-900">${currentAmount.toLocaleString()}</span>
                    <span className="text-xs text-stone-400"> / ${goalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="space-y-3 text-sm text-stone-500">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>100% of your gift is invested</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>SIPC protected up to $500,000</span>
              </div>
            </div>
          </div>

          {/* Right column - Form */}
          <div className="max-w-lg mx-auto lg:mx-0 lg:max-w-none">
            <AnimatePresence mode="wait">
              
              {/* Step 0: Amount */}
              {step === 0 && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Mobile-only info section */}
                  <div className="lg:hidden">
                    {/* Breadcrumb */}
                    <div className="text-sm mb-8 flex items-center gap-1.5">
                      <Link href="/dashboard">
                        <span className="text-stone-400 hover:text-stone-600">Dashboard</span>
                      </Link>
                      <span className="text-stone-300">/</span>
                      <Link href={`/${fundSlug}`}>
                        <span className="text-stone-500 hover:text-stone-900">{recipientName}</span>
                      </Link>
                      {eventTitle && (
                        <>
                          <span className="text-stone-300">/</span>
                          <span className="text-stone-900">{eventTitle}</span>
                        </>
                      )}
                    </div>

                    {/* Photo */}
                    {photo && (
                      <img 
                        src={photo} 
                        alt="" 
                        className="w-full aspect-video object-cover rounded-xl mb-6"
                      />
                    )}

                    {/* Header */}
                    <div className="text-center mb-10">
                      {!photo && (
                        <div className="w-16 h-16 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-xl font-light mx-auto mb-5">
                          {recipientName.charAt(0)}
                        </div>
                      )}
                      <h1 className="text-2xl font-light text-stone-900 mb-1">
                        {headline || `Give to ${recipientName}`}
                      </h1>
                      {description && (
                        <p className="text-stone-500 text-sm mt-2 leading-relaxed">{description}</p>
                      )}
                      {!description && eventTitle && (
                        <p className="text-stone-500">{eventTitle}</p>
                      )}
                    </div>

                    {/* Progress bar */}
                    {showProgress && (
                      <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-stone-900">${currentAmount.toLocaleString()}</span>
                          <span className="text-stone-400">of ${goalAmount.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-stone-900 transition-all"
                            style={{ width: `${Math.min((currentAmount / goalAmount) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amount Selection */}
                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <h2 className="hidden lg:block text-lg font-medium text-stone-900 mb-6">Choose an amount</h2>
                    
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {AMOUNTS.map((a) => (
                        <button
                          key={a}
                          onClick={() => { setAmount(a); setCustomAmount(""); }}
                          data-testid={`amount-${a}`}
                          className={`py-3 lg:py-4 rounded text-sm font-medium transition-all ${
                            amount === a && !customAmount
                              ? "bg-stone-900 text-stone-50"
                              : "bg-white border border-stone-200 text-stone-900 hover:border-stone-300"
                          }`}
                        >
                          ${a}
                        </button>
                      ))}
                    </div>

                    <div className="relative mb-8">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Other amount"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        data-testid="input-custom-amount"
                        className="w-full pl-8 pr-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                      />
                    </div>

                    {/* Projection */}
                    {finalAmount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 lg:p-6 bg-stone-900 text-stone-50 rounded-lg mb-6"
                      >
                        <p className="text-stone-400 text-sm mb-1">Your ${finalAmount} could become</p>
                        <p className="text-3xl lg:text-4xl font-light">${projectedGrowth.toLocaleString()}</p>
                        <p className="text-stone-500 text-sm mt-1">in 18 years at 7% annual return</p>
                      </motion.div>
                    )}

                    {/* Investment Choice - Premium Compact Display */}
                    <div className="mb-8">
                      <button
                        onClick={() => setShowStockPicker(true)}
                        data-testid="button-open-stock-picker"
                        className="w-full p-4 bg-white border border-stone-200 rounded-xl hover:border-stone-300 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              deliveryType === "cash" 
                                ? "bg-emerald-50 text-emerald-600" 
                                : deliveryType === "stock" 
                                  ? "bg-stone-100 text-stone-700" 
                                  : "bg-stone-900 text-stone-50"
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
                              <p className="text-sm font-medium text-stone-900">
                                {deliveryType === "cash" 
                                  ? "Hold as cash" 
                                  : deliveryType === "stock" && selectedStock 
                                    ? selectedStock.name 
                                    : "Fund's strategy"}
                              </p>
                              <p className="text-xs text-stone-400">
                                {deliveryType === "cash" 
                                  ? "Family will invest when ready" 
                                  : deliveryType === "stock" && selectedStock 
                                    ? `${selectedStock.symbol} · $${selectedStock.price.toFixed(2)}` 
                                    : "Diversified portfolio"}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-stone-400 group-hover:text-stone-600 transition-colors">Change</span>
                        </div>
                        
                        {/* Share calculation */}
                        {deliveryType === "stock" && selectedStock && finalAmount > 0 && (
                          <div className="mt-3 pt-3 border-t border-stone-100">
                            <p className="text-xs text-stone-500">
                              ${finalAmount} = <span className="font-medium text-stone-700">{shareQuantity} shares</span> at ${selectedStock.price.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => setStep(1)}
                      disabled={finalAmount < 5}
                      data-testid="button-continue"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
                    >
                      {buttonText}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Details + Payment */}
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
                    className="text-sm text-stone-500 hover:text-stone-900 mb-8 transition-colors"
                  >
                    ← Back
                  </button>

                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <p className="text-sm text-stone-500 mb-1">Giving ${finalAmount} to {recipientName}</p>
                    <h1 className="text-2xl font-light text-stone-900 mb-8">Add your details</h1>

                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Your name</label>
                        <input
                          type="text"
                          value={giverName}
                          onChange={(e) => setGiverName(e.target.value)}
                          placeholder="How they'll see you"
                          data-testid="input-name"
                          className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Add a note (optional)</label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="A message for them..."
                          rows={3}
                          data-testid="input-message"
                          className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                        />
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-white border border-stone-200 rounded mb-6 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Gift amount</span>
                        <span className="text-stone-900">${finalAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Processing fee</span>
                        <span className="text-stone-900">${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium pt-2 border-t border-stone-100">
                        <span className="text-stone-900">Total</span>
                        <span className="text-stone-900">${total}</span>
                      </div>
                    </div>

                    {/* Payment buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={handleGive}
                        disabled={isProcessing || !giverName}
                        data-testid="button-apple-pay"
                        className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
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
                        disabled={isProcessing || !giverName}
                        data-testid="button-card"
                        className="w-full py-3 lg:py-4 bg-white border border-stone-200 text-stone-900 rounded font-medium disabled:opacity-40 hover:bg-stone-50 transition-colors"
                      >
                        Pay with card
                      </button>
                    </div>

                    <p className="text-xs text-stone-400 text-center mt-4">
                      100% of your gift is invested
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Success */}
              {step === 2 && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center pt-8 lg:pt-16"
                >
                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-8">
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                    >
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-6">
                        <svg className="w-8 h-8 lg:w-10 lg:h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h1 className="text-2xl lg:text-3xl font-light text-stone-900 mb-2">Gift sent</h1>
                      <p className="text-stone-500 mb-4">
                        You gave ${finalAmount} to {recipientName}'s future
                      </p>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm mb-8">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Will invest when markets open
                      </div>
                    </motion.div>

                    <div className="p-5 bg-white border border-stone-200 rounded text-left max-w-xs mx-auto mb-8">
                      <div className="flex justify-between mb-3">
                        <span className="text-stone-500">Amount</span>
                        <span className="font-medium text-stone-900">${finalAmount}</span>
                      </div>
                      <div className="flex justify-between mb-3">
                        <span className="text-stone-500">To</span>
                        <span className="font-medium text-stone-900">{recipientName}</span>
                      </div>
                      {eventTitle && (
                        <div className="flex justify-between mb-3">
                          <span className="text-stone-500">For</span>
                          <span className="font-medium text-stone-900">{eventTitle}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t border-stone-100">
                        <span className="text-stone-500">Could grow to</span>
                        <span className="font-medium text-emerald-700">${projectedGrowth.toLocaleString()}</span>
                      </div>
                    </div>

                    <Link href={`/${fundSlug}`}>
                      <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-view-fund">
                        View {recipientName}'s fund →
                      </span>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Stock Picker Modal - Premium Full-Screen Overlay */}
      <AnimatePresence>
        {showStockPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowStockPicker(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-stone-100">
                <h2 className="text-lg font-medium text-stone-900">Choose what this gift becomes</h2>
                <button
                  onClick={() => setShowStockPicker(false)}
                  data-testid="button-close-stock-picker"
                  className="p-2 -mr-2 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-stone-100">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 100+ popular stocks & ETFs..."
                    data-testid="input-stock-search"
                    className="w-full pl-11 pr-4 py-3 bg-stone-50 border-0 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Default Options - Only show when not searching */}
                {!searchQuery && (
                  <>
                    {/* Fund's Strategy - Recommended */}
                    <button
                      onClick={handleSelectFund}
                      data-testid="option-fund-strategy"
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        deliveryType === "fund"
                          ? "border-stone-900 bg-stone-50"
                          : "border-stone-100 hover:border-stone-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center">
                          <TrendingUp size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-stone-900">Fund's strategy</p>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Recommended</span>
                          </div>
                          <p className="text-sm text-stone-500 mt-0.5">Diversified across stocks, bonds, and ETFs</p>
                        </div>
                        {deliveryType === "fund" && (
                          <div className="w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Cash Option */}
                    <button
                      onClick={handleSelectCash}
                      data-testid="option-cash"
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        deliveryType === "cash"
                          ? "border-stone-900 bg-stone-50"
                          : "border-stone-100 hover:border-stone-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <DollarSign size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-stone-900">Hold as cash</p>
                          <p className="text-sm text-stone-500 mt-0.5">Family decides when and what to invest</p>
                        </div>
                        {deliveryType === "cash" && (
                          <div className="w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-stone-100"></div>
                      <span className="text-xs text-stone-400 uppercase tracking-wider">Or pick a stock</span>
                      <div className="flex-1 h-px bg-stone-100"></div>
                    </div>
                  </>
                )}

                {/* Stock Results */}
                <div className="space-y-2">
                  {searchQuery && filteredStocks.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-full bg-stone-100 mx-auto mb-3 flex items-center justify-center">
                        <Search size={20} className="text-stone-400" />
                      </div>
                      <p className="text-stone-600 font-medium">No results for "{searchQuery}"</p>
                      <p className="text-sm text-stone-400 mt-1">Try Apple, Tesla, Disney, or S&P 500</p>
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
                              ? "border-stone-900 bg-stone-50"
                              : "border-stone-100 hover:border-stone-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-stone-600">{stock.symbol}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-stone-900 truncate">{stock.name}</p>
                                {stock.sector && (
                                  <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded shrink-0">{stock.sector}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-sm text-stone-600">${stock.price.toFixed(2)}</span>
                                <span className={`text-xs ${stock.change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {finalAmount > 0 && (
                                <p className="text-sm font-medium text-stone-700">{shares} shares</p>
                              )}
                              {isSelected && (
                                <div className="w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center mt-1 ml-auto">
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              {/* Footer */}
              <div className="p-4 border-t border-stone-100 bg-stone-50">
                <p className="text-xs text-stone-400 text-center">
                  All investments go to {recipientName}'s fund · Assets held by Alpaca Securities LLC
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
