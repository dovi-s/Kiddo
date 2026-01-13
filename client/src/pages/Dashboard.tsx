import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useSearch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Pencil, Copy, QrCode, ExternalLink, Plus, User, Users, Archive, Eye, FileText, ChevronDown, ChevronUp, Info, Sparkles, Trophy } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { staggerContainer, fadeInUp, liftCard, gentleSpring, bouncySpring } from "@/lib/animations";
import { AchievementBadge, getDefaultAchievements } from "@/components/ui/achievements";

function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}</span>;
}

type FundStatus = "draft" | "pending" | "active" | "needs_action";

interface StoredFund {
  id: number;
  name: string;
  slug: string;
  accountType: string;
  status: FundStatus;
  balance: number;
  gain: number;
  gainPercent: number;
  contributors: number;
  projection: number;
  yearsLeft: number;
  isNew: boolean;
  events: { id: number; slug: string; title: string; raised: number; gifts: number; date?: string; active: boolean }[];
}

const loadStoredFunds = (): StoredFund[] => {
  try {
    const stored = localStorage.getItem("kora_funds");
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const saveStoredFunds = (funds: StoredFund[]) => {
  try {
    localStorage.setItem("kora_funds", JSON.stringify(funds));
  } catch {}
};

export default function Dashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || "Mila");
  const childrenParam = params.get("children");
  const isPersonal = accountType === "personal";
  const isNewFund = params.get("new") === "true";
  const newFundName = params.get("newFund");

  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [expandedFund, setExpandedFund] = useState<number | null>(1);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showEditFund, setShowEditFund] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState<number | null>(null);
  const [showPageQR, setShowPageQR] = useState<string | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddFund, setShowAddFund] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [showThankYous, setShowThankYous] = useState(false);
  const [sentThankYous, setSentThankYous] = useState<string[]>([]);
  const [snoozedThankYous, setSnoozedThankYous] = useState<string[]>([]);
  const [expandedThankYou, setExpandedThankYou] = useState<string | null>(null);
  const [thankYouDrafts, setThankYouDrafts] = useState<Record<string, string>>({});
  const [showContributors, setShowContributors] = useState(false);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [showGainAsPercent, setShowGainAsPercent] = useState(false);
  const [showFundPreview, setShowFundPreview] = useState(false);
  const [showGiftRules, setShowGiftRules] = useState(false);

  const [funds, setFunds] = useState<StoredFund[]>(() => {
    const stored = loadStoredFunds();
    if (stored.length > 0) return stored;
    
    const childNames = childrenParam ? decodeURIComponent(childrenParam).split(",") : [profileName];
    const isNewAccount = isNewFund;
    
    if (isPersonal) {
      return [{
        id: 1,
        name: profileName,
        slug: profileName.toLowerCase().replace(/\s+/g, "-"),
        accountType: "Individual",
        status: (isNewAccount ? "draft" : "active") as FundStatus,
        balance: isNewAccount ? 0 : 4250,
        gain: isNewAccount ? 0 : 472,
        gainPercent: isNewAccount ? 0 : 12.5,
        contributors: isNewAccount ? 0 : 18,
        projection: isNewAccount ? 0 : 28400,
        yearsLeft: 20,
        isNew: isNewAccount,
        events: isNewAccount ? [
          { id: 1, slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
        ] : [
          { id: 1, slug: "anytime", title: "Open anytime", raised: 2180, gifts: 12, active: true },
          { id: 2, slug: "30th-birthday", title: "30th Birthday", raised: 1420, gifts: 8, date: "Dec 2025", active: false },
          { id: 3, slug: "mba-graduation", title: "MBA Graduation", raised: 650, gifts: 4, date: "May 2026", active: true },
        ]
      }];
    }
    
    return childNames.map((name, index) => ({
      id: index + 1,
      name: name.trim(),
      slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
      accountType: "UTMA",
      status: (isNewAccount ? "draft" : "active") as FundStatus,
      balance: isNewAccount ? 0 : (index === 0 ? 4250 : index === 1 ? 1820 : 650),
      gain: isNewAccount ? 0 : (index === 0 ? 472 : index === 1 ? 156 : 42),
      gainPercent: isNewAccount ? 0 : (index === 0 ? 12.5 : index === 1 ? 9.4 : 6.9),
      contributors: isNewAccount ? 0 : (index === 0 ? 18 : index === 1 ? 8 : 3),
      projection: isNewAccount ? 0 : (index === 0 ? 28400 : index === 1 ? 12200 : 4350),
      yearsLeft: index === 0 ? 14 : index === 1 ? 16 : 17,
      isNew: isNewAccount,
      events: isNewAccount ? [
        { id: index * 10 + 1, slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
      ] : (index === 0 ? [
        { id: 1, slug: "anytime", title: "Open anytime", raised: 2180, gifts: 12, active: true },
        { id: 2, slug: "5th-birthday", title: "5th Birthday", raised: 1420, gifts: 8, date: "Dec 2025", active: false },
        { id: 3, slug: "kindergarten-graduation", title: "Kindergarten", raised: 650, gifts: 4, date: "May 2026", active: true },
      ] : index === 1 ? [
        { id: 4, slug: "anytime", title: "Open anytime", raised: 1200, gifts: 6, active: true },
        { id: 5, slug: "3rd-birthday", title: "3rd Birthday", raised: 620, gifts: 4, date: "Mar 2025", active: true },
      ] : [
        { id: 6, slug: "anytime", title: "Open anytime", raised: 650, gifts: 3, active: true },
      ])
    }));
  });

  useEffect(() => {
    if (newFundName && !funds.some(f => f.name.toLowerCase() === newFundName.toLowerCase())) {
      const newFund: StoredFund = {
        id: funds.length + 1,
        name: newFundName,
        slug: newFundName.toLowerCase().replace(/\s+/g, "-"),
        accountType: "UTMA",
        status: "draft",
        balance: 0,
        gain: 0,
        gainPercent: 0,
        contributors: 0,
        projection: 0,
        yearsLeft: 18,
        isNew: true,
        events: [
          { id: Date.now(), slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
        ]
      };
      const updatedFunds = [...funds, newFund];
      setFunds(updatedFunds);
      saveStoredFunds(updatedFunds);
      toast({ title: `${newFundName}'s fund created`, description: "Activate investing to start growing gifts" });
    }
  }, [newFundName]);

  useEffect(() => {
    if (funds.length > 0) {
      saveStoredFunds(funds);
    }
  }, [funds]);

  const isNewAccount = funds.every(f => f.isNew);
  
  const [fundName, setFundName] = useState(funds[0]?.name || profileName);
  const [fundSlugEdit, setFundSlugEdit] = useState((funds[0]?.slug || profileName).toLowerCase().replace(/\s+/g, "-"));
  const [eventEdits, setEventEdits] = useState<Record<number, { title: string; slug: string }>>({});
  const [selectedFundSlug, setSelectedFundSlug] = useState(funds[0]?.slug || profileName.toLowerCase().replace(/\s+/g, "-"));

  const fundSlug = selectedFundSlug;
  const momentLink = `kora.com/${fundSlug}`;

  const handleCopy = (link?: string) => {
    navigator.clipboard?.writeText(`https://${link || momentLink}`);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyClick = () => handleCopy();
  
  const selectedFund = funds.find(f => f.slug === selectedFundSlug) || funds[0];
  
  const getStatusLabel = (status: FundStatus) => {
    switch (status) {
      case "draft": return "Not activated";
      case "pending": return "Verification pending";
      case "active": return "Active";
      case "needs_action": return "Needs attention";
    }
  };
  
  const getStatusColor = (status: FundStatus) => {
    switch (status) {
      case "draft": return "bg-stone-100 text-stone-600";
      case "pending": return "bg-amber-100 text-amber-700";
      case "active": return "bg-blue-100 text-blue-700";
      case "needs_action": return "bg-red-100 text-red-700";
    }
  };

  const portfolioValue = funds.reduce((sum, f) => sum + f.balance, 0);
  const marketChange = funds.reduce((sum, f) => sum + f.gain, 0);
  const totalReceived = portfolioValue - marketChange;
  const marketChangePercent = totalReceived > 0 ? ((marketChange / totalReceived) * 100).toFixed(1) : "0";
  const investedAmount = Math.round(portfolioValue * 0.85);
  const cashAmount = portfolioValue - investedAmount;
  const pendingAmount = isNewAccount ? 0 : 180;

  const holdings = isNewAccount ? [] : [
    { ticker: "VTI", name: "US Total Market ETF", shares: 12.4, value: 2125, gain: 245 },
    { ticker: "VXUS", name: "International ETF", shares: 8.2, value: 850, gain: 72 },
    { ticker: "DIS", name: "Disney", shares: 3.5, value: 425, gain: 38 },
    { ticker: "AAPL", name: "Apple", shares: 2.1, value: 400, gain: 85 },
  ];

  const portfolio = isNewAccount ? [] : [
    { name: "US Total Market", allocation: "50%", value: 2125 },
    { name: "International Developed", allocation: "20%", value: 850 },
    { name: "Bonds", allocation: "15%", value: 638 },
    { name: "Cash", allocation: "15%", value: 637 },
  ];

  const allContributions = isNewAccount ? [] : [
    { id: "gift_1", from: "Dave Chen", email: "dave@example.com", amount: 180, event: "5th Birthday", date: new Date(Date.now() - 2 * 60 * 60 * 1000), note: "So proud of you", status: "pending" as const },
    { id: "gift_2", from: "Ruth Stein", email: "ruth@example.com", amount: 500, event: "Open anytime", date: new Date(Date.now() - 24 * 60 * 60 * 1000), note: "With love", status: "invested" as const },
    { id: "gift_3", from: "Michael Park", email: "michael@example.com", amount: 100, event: "Open anytime", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), note: null, status: "invested" as const },
    { id: "gift_4", from: "Sarah Johnson", email: "sarah@example.com", amount: 250, event: "5th Birthday", date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), note: "Happy birthday sweetie!", status: "invested" as const },
    { id: "gift_5", from: "The Goldbergs", email: "goldberg@example.com", amount: 100, event: "5th Birthday", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), note: "Wishing you the best!", status: "invested" as const },
    { id: "gift_6", from: "Uncle James", email: "james@example.com", amount: 300, event: "Open anytime", date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), note: "For your future", status: "invested" as const },
    { id: "gift_7", from: "Aunt Lisa", email: "lisa@example.com", amount: 75, event: "Kindergarten", date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), note: "Can't wait to see all you accomplish!", status: "invested" as const },
    { id: "gift_8", from: "The Cohens", email: "cohens@example.com", amount: 200, event: "Open anytime", date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), note: "Here's to many more milestones!", status: "invested" as const },
    { id: "gift_9", from: "Grandma Helen", email: "helen@example.com", amount: 500, event: "5th Birthday", date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), note: "My beautiful grandchild", status: "invested" as const },
    { id: "gift_10", from: "Mom & Dad", email: "parents@example.com", amount: 1000, event: "Open anytime", date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), note: "Starting your journey", status: "invested" as const },
    { id: "gift_11", from: "Cousin Jake", email: "jake@example.com", amount: 50, event: "5th Birthday", date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), note: null, status: "invested" as const },
    { id: "gift_12", from: "The Petersons", email: "petersons@example.com", amount: 150, event: "Open anytime", date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), note: "Best wishes!", status: "invested" as const },
    { id: "gift_13", from: "Nana", email: "nana@example.com", amount: 250, event: "Kindergarten", date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), note: "So proud of you", status: "invested" as const },
    { id: "gift_14", from: "Friend from work", email: "work@example.com", amount: 100, event: "Open anytime", date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), note: "Congratulations!", status: "invested" as const },
    { id: "gift_15", from: "The Smiths", email: "smiths@example.com", amount: 75, event: "5th Birthday", date: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000), note: null, status: "invested" as const },
    { id: "gift_16", from: "Grandpa Joe", email: "joe@example.com", amount: 400, event: "Open anytime", date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), note: "For your college fund", status: "invested" as const },
    { id: "gift_17", from: "Aunt Maya", email: "maya@example.com", amount: 125, event: "Kindergarten", date: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000), note: "Love you!", status: "invested" as const },
    { id: "gift_18", from: "Family Friends", email: "friends@example.com", amount: 200, event: "Open anytime", date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), note: "Wishing you the best future", status: "invested" as const },
  ];

  const recentActivity = allContributions.slice(0, 3).map(c => ({
    ...c,
    time: c.date.getTime() > Date.now() - 3 * 60 * 60 * 1000 
      ? `${Math.round((Date.now() - c.date.getTime()) / (60 * 60 * 1000))} hours ago`
      : c.date.getTime() > Date.now() - 24 * 60 * 60 * 1000
        ? "Yesterday"
        : `${Math.round((Date.now() - c.date.getTime()) / (24 * 60 * 60 * 1000))} days ago`
  }));

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getDefaultThankYou = (item: typeof recentActivity[0]) => {
    const firstName = item.from.split(" ")[0];
    return `Thank you so much for your generous gift of $${item.amount}, ${firstName}! It means the world to us and will help ${selectedFund.name}'s future grow.`;
  };

  const pendingThankYous = recentActivity.filter(a => a.status === "invested" && !sentThankYous.includes(a.id) && !snoozedThankYous.includes(a.id)).length;
  const snoozedCount = recentActivity.filter(a => a.status === "invested" && snoozedThankYous.includes(a.id) && !sentThankYous.includes(a.id)).length;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="text-stone-900" />
            {funds.length > 1 && (
              <select 
                value={selectedFundSlug}
                onChange={(e) => setSelectedFundSlug(e.target.value)}
                className="text-sm text-stone-600 bg-transparent border-0 cursor-pointer hover:text-stone-900 transition-colors focus:outline-none focus:ring-0"
                data-testid="select-fund-switcher"
              >
                {funds.map(f => (
                  <option key={f.slug} value={f.slug}>{f.name}'s Fund</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowAddFund(true)}
              data-testid="button-add-fund"
              className="text-sm text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add fund</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/send">
              <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-send">Send a gift</span>
            </Link>
            <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
              <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-settings">Settings</span>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-12">
          
          {/* Main column */}
          <div className="lg:col-span-2">
            
            {/* Financial Overview */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-10 lg:mb-12"
            >
              {/* Status chip */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(selectedFund.status)}`}>
                  {getStatusLabel(selectedFund.status)}
                </span>
                {selectedFund.status === "pending" && (
                  <span className="text-xs text-stone-400">Usually under 2 minutes, sometimes up to 24 hours</span>
                )}
              </div>
              
              {selectedFund.status === "draft" ? (
                <>
                  {/* Draft state - show activate prompt */}
                  <p className="text-sm text-stone-500 mb-1">Portfolio value</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-stone-900 mb-3">
                    $0
                  </h1>
                  
                  <div className="p-4 rounded-xl bg-stone-100 border border-stone-200 mb-4">
                    <p className="text-sm text-stone-600 mb-3">
                      {funds.length === 1 
                        ? `${funds[0].name}'s fund is ready to share. Activate investing to accept gifts.`
                        : `${selectedFund.name}'s fund is ready to share. Activate investing to accept gifts.`
                      }
                    </p>
                    <Link href={`/activate?type=${accountType}&children=${childrenParam || ""}`}>
                      <Button 
                        data-testid="button-activate-investing"
                        className="bg-stone-900 text-white hover:bg-stone-800"
                      >
                        Activate investing
                      </Button>
                    </Link>
                    <p className="text-xs text-stone-400 mt-3">Takes about 2 minutes. Identity verification required.</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-700">
                      <strong>Gift rules:</strong> Contributors can pledge gifts now. Pledges convert to real gifts once you activate investing.
                    </p>
                  </div>
                </>
              ) : selectedFund.status === "pending" ? (
                <>
                  {/* Pending verification state */}
                  <p className="text-sm text-stone-500 mb-1">Portfolio value</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-stone-900 mb-3">
                    $0
                  </h1>
                  
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 mb-4">
                    <p className="text-xs text-amber-700">
                      <strong>Gift rules:</strong> Gifts will be held as cash (Seed) until verification completes. They will auto-invest once your account is active.
                    </p>
                  </div>
                  
                  <p className="text-sm text-stone-500">
                    We're verifying your identity. This usually takes under 2 minutes.
                  </p>
                </>
              ) : selectedFund.status === "needs_action" ? (
                <>
                  {/* Needs action state */}
                  <p className="text-sm text-stone-500 mb-1">Portfolio value</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-stone-900 mb-3">
                    $0
                  </h1>
                  
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 mb-4">
                    <p className="text-sm text-red-700 mb-3">
                      We need additional information to verify your identity. This is common and usually takes just a minute to resolve.
                    </p>
                    <Link href={`/activate?type=${accountType}&children=${childrenParam || ""}&retry=true`}>
                      <Button 
                        data-testid="button-retry-verification"
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        Complete verification
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-700">
                      <strong>Gift rules:</strong> Gifts will be held as cash until verification is complete.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Active state - show metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-4">
                    <div className="p-4 sm:p-0 bg-stone-50 sm:bg-transparent rounded-xl sm:rounded-none">
                      <p className="text-xs sm:text-sm text-stone-500 mb-1 flex items-center gap-1 uppercase tracking-wide sm:tracking-normal sm:normal-case">
                        Total received
                        <span className="text-stone-300 text-xs hidden sm:inline" title="All completed gifts to this fund">(gifts)</span>
                      </p>
                      <p className="text-3xl sm:text-3xl lg:text-4xl font-semibold sm:font-light tracking-tight text-stone-900">
                        <AnimatedValue value={totalReceived} />
                      </p>
                    </div>
                    <div className="p-4 sm:p-0 bg-stone-50 sm:bg-transparent rounded-xl sm:rounded-none">
                      <p className="text-xs sm:text-sm text-stone-500 mb-1 flex items-center gap-1 uppercase tracking-wide sm:tracking-normal sm:normal-case">
                        Portfolio value
                        <span className="text-stone-300 text-xs hidden sm:inline" title="Invested + cash + growth">(+growth)</span>
                      </p>
                      <p className="text-3xl sm:text-3xl lg:text-4xl font-semibold sm:font-light tracking-tight text-stone-900">
                        <AnimatedValue value={portfolioValue} />
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <button 
                      onClick={() => setShowGainAsPercent(!showGainAsPercent)}
                      data-testid="button-toggle-gain-format"
                      className={`${marketChange >= 0 ? "text-emerald-700" : "text-red-600"} hover:underline cursor-pointer`}
                    >
                      {showGainAsPercent 
                        ? `${marketChange >= 0 ? "+" : ""}${marketChangePercent}% gain`
                        : `${marketChange >= 0 ? "+" : ""}$${Math.abs(marketChange).toLocaleString()} gain`
                      }
                    </button>
                    {pendingAmount > 0 && (
                      <>
                        <span className="text-stone-300">|</span>
                        <span className="text-amber-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          ${pendingAmount} pending
                        </span>
                      </>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setShowGiftRules(!showGiftRules)}
                    className="w-full p-3 rounded-lg bg-stone-50 border border-stone-100 mt-4 text-left hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-500 flex items-center gap-1.5">
                        <Info size={12} />
                        How gifts work
                      </span>
                      {showGiftRules ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </div>
                    {showGiftRules && (
                      <p className="text-xs text-stone-500 mt-2">
                        {portfolioValue === 0 
                          ? "Share your link and contributions will automatically invest per your settings. Gifts typically settle in 1-2 business days."
                          : "Gifts are accepted and invested automatically when markets are open. Pending gifts invest at the next market open."
                        }
                      </p>
                    )}
                  </button>
                </>
              )}
            </motion.div>

            {/* Portfolio Preview - only show if has holdings */}
            {!isNewAccount && portfolio.length > 0 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                onClick={() => setShowPortfolio(true)}
                data-testid="button-portfolio"
                className="w-full mb-8 lg:mb-10 text-left group"
              >
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Allocation</p>
                <div className="flex h-2 lg:h-2.5 rounded-full overflow-hidden mb-2 bg-stone-200">
                  <div className="bg-stone-900 transition-all group-hover:opacity-90" style={{ width: "50%" }} title="Stocks 50%" />
                  <div className="bg-stone-600" style={{ width: "20%" }} title="International 20%" />
                  <div className="bg-stone-400" style={{ width: "15%" }} title="Bonds 15%" />
                  <div className="bg-stone-300" style={{ width: "15%" }} title="Cash 15%" />
                </div>
                <div className="flex gap-4 text-xs text-stone-400 group-hover:text-stone-500 transition-colors">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-900"></span>Stocks 50%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-600"></span>Int'l 20%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-400"></span>Bonds 15%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-300"></span>Cash 15%</span>
                </div>
              </motion.button>
            )}

            {/* Share - Mobile only */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8 lg:hidden p-5 rounded-lg bg-white border border-stone-200"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-stone-500">Share this fund</p>
                <button 
                  onClick={() => setShowEditFund(true)}
                  data-testid="button-edit-share-mobile"
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Edit
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-stone-50 rounded text-sm text-stone-600 truncate">
                  {momentLink}
                </div>
                <button 
                  onClick={handleCopyClick}
                  data-testid="button-copy-mobile"
                  className="px-4 py-2 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button 
                  onClick={() => setShowQR(true)}
                  data-testid="button-qr-mobile"
                  className="px-3 py-2 border border-stone-200 rounded text-sm hover:bg-stone-50 transition-colors"
                >
                  QR
                </button>
              </div>
            </motion.div>

            {/* Selected Fund Details */}
            {selectedFund && (
              <motion.div
                key={selectedFund.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mb-10 lg:mb-12"
              >
                <div className="border border-stone-200 rounded-lg bg-white overflow-hidden">
                  {selectedFund.status === "draft" && (
                    <div className="px-4 sm:px-5 py-4 bg-amber-50 border-b border-amber-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-amber-800">Activate investing to start growing gifts</p>
                          <p className="text-xs text-amber-600 mt-0.5">Contributors can pledge now — funds invest once activated</p>
                        </div>
                        <Link href="/activate">
                          <button 
                            data-testid="button-activate-fund"
                            className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap"
                          >
                            Activate investing
                          </button>
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 gap-3">
                    <div>
                      {selectedFund.status === "active" && (
                        <p className="text-xs text-emerald-600 mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Connected to Alpaca Securities · <button className="underline hover:no-underline">Account settings</button>
                        </p>
                      )}
                      <p className="text-sm text-stone-500">
                        <span className="text-stone-400">Projection:</span> {isPersonal ? "In 20 years" : `When ${selectedFund.name} turns 18`}: <span className="font-medium text-stone-900">${selectedFund.projection.toLocaleString()}</span>
                      </p>
                      <button 
                        onClick={() => setShowContributors(true)}
                        className="text-xs text-stone-400 hover:text-stone-600 hover:underline transition-colors"
                        data-testid="button-view-contributors"
                      >
                        {selectedFund.contributors} contributors →
                      </button>
                      <p className="text-[10px] text-stone-300 mt-1">Assumes 7% annual return. Not guaranteed.</p>
                    </div>
                    <div className="flex gap-0.5 sm:gap-1">
                      <button 
                        onClick={() => setShowEditFund(true)}
                        data-testid="button-edit-fund"
                        className="p-2.5 sm:p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        title="Edit"
                      >
                        <Pencil size={16} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                      <button 
                        onClick={handleCopyClick}
                        data-testid="button-copy-link"
                        className="p-2.5 sm:p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        title="Copy link"
                      >
                        <Copy size={16} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                      <button 
                        onClick={() => setShowQR(true)}
                        data-testid="button-show-qr"
                        className="p-2.5 sm:p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                        title="QR code"
                      >
                        <QrCode size={16} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                      <Link href={`/${fundSlug}`}>
                        <button 
                          className="p-2.5 sm:p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" 
                          title="View fund & events"
                          data-testid="button-view-fund"
                        >
                          <ExternalLink size={16} className="sm:w-3.5 sm:h-3.5" />
                        </button>
                      </Link>
                    </div>
                  </div>

                  <div className="px-4 sm:px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Events</p>
                      <Link href="/event/create" className="text-xs text-stone-500 hover:text-stone-900 transition-colors px-2 py-1.5 -mr-2 rounded-lg hover:bg-stone-100">
                        + New event
                      </Link>
                    </div>
                    
                    <div className="space-y-0">
                      {selectedFund.events.map((event, idx) => {
                        const eventData = eventEdits[event.id] || { title: event.title, slug: event.slug };
                        const isLast = idx === selectedFund.events.length - 1;
                        return (
                          <div key={event.id} className="flex">
                            <div className="w-6 flex flex-col items-center mr-2">
                              <div className={`w-px bg-stone-200 ${idx === 0 ? 'h-3' : 'h-full'}`} />
                              <div className="w-3 h-px bg-stone-200" style={{ marginTop: idx === 0 ? 0 : -12 }} />
                              {!isLast && <div className="w-px bg-stone-200 flex-1" />}
                            </div>
                            
                            <div className="flex-1 py-2 flex items-center justify-between group">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`h-2 w-2 rounded-full shrink-0 ${event.active ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                                <div className="min-w-0">
                                  <p className="text-sm text-stone-900 truncate">{eventData.title}</p>
                                  <p className="text-xs text-stone-400 truncate">/{fundSlug}/{eventData.slug}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <p className="text-sm text-stone-600 mr-2">${event.raised.toLocaleString()}</p>
                                <button 
                                  onClick={() => { navigator.clipboard.writeText(`kora.com/${fundSlug}/${eventData.slug}`); toast({ title: "Link copied", description: "Anyone with the link can contribute" }); }}
                                  className="px-2 py-1 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded transition-all"
                                  data-testid={`button-share-event-${event.id}`}
                                >
                                  Share
                                </button>
                                <Link href={`/edit/${fundSlug}/${eventData.slug}`}>
                                  <button 
                                    className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-all"
                                    title="Edit event"
                                    data-testid={`button-edit-event-${event.id}`}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                </Link>
                                <Link href={`/${fundSlug}/${eventData.slug}`}>
                                  <button 
                                    className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-all" 
                                    title="View event page"
                                    data-testid={`button-view-event-${event.id}`}
                                  >
                                    <ExternalLink size={14} />
                                  </button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Statements & Tax Docs - Only for active accounts */}
                  {selectedFund.status === "active" && (
                    <div className="px-4 sm:px-5 py-4 border-t border-stone-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Documents</p>
                      </div>
                      <div className="space-y-2">
                        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors text-left group">
                          <div className="flex items-center gap-3">
                            <FileText size={16} className="text-stone-400" />
                            <div>
                              <p className="text-sm text-stone-700">Monthly Statements</p>
                              <p className="text-xs text-stone-400">No statements yet</p>
                            </div>
                          </div>
                          <ExternalLink size={14} className="text-stone-300 group-hover:text-stone-500" />
                        </button>
                        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors text-left group">
                          <div className="flex items-center gap-3">
                            <FileText size={16} className="text-stone-400" />
                            <div>
                              <p className="text-sm text-stone-700">Tax Documents</p>
                              <p className="text-xs text-stone-400">Available after year-end</p>
                            </div>
                          </div>
                          <ExternalLink size={14} className="text-stone-300 group-hover:text-stone-500" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Activity */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4">Recent Activity</h2>
              
              {recentActivity.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-stone-100 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-stone-700 mb-1">No activity yet</p>
                  <p className="text-xs text-stone-500 mb-4">Share your link to start receiving gifts</p>
                  <button 
                    onClick={handleCopyClick}
                    className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
                  >
                    Copy link to share
                  </button>
                </div>
              ) : (
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {recentActivity.map((item, i) => {
                  const isExpanded = expandedActivity === item.id;
                  return (
                    <motion.div 
                      key={i}
                      variants={fadeInUp}
                      whileHover={{ scale: 1.01, y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      transition={gentleSpring}
                      className="bg-white border border-stone-200 rounded-xl overflow-hidden cursor-pointer hover:border-stone-300 hover:shadow-md"
                      onClick={() => setExpandedActivity(isExpanded ? null : item.id)}
                      data-testid={`activity-item-${item.id}`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-stone-900">
                                <span className="font-medium">{item.from}</span>
                                <span className="text-stone-400 mx-1.5">→</span>
                                <span>{item.event}</span>
                              </p>
                              {item.status === "pending" ? (
                                <motion.span 
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-1"
                                  animate={{ opacity: [0.8, 1, 0.8] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                  Pending
                                </motion.span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                                  Invested
                                </span>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-sm text-stone-500 mt-1 truncate">"{item.note}"</p>
                            )}
                            <p className="text-xs text-stone-400 mt-1.5">{item.time}</p>
                          </div>
                          <motion.p 
                            className="text-sm font-medium text-emerald-600 shrink-0 ml-4"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.1 + 0.2 }}
                          >
                            +${item.amount}
                          </motion.p>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-0 border-t border-stone-100">
                              <div className="pt-3 space-y-2">
                                {item.status === "pending" ? (
                                  <>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-stone-600">Payment received</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0 animate-pulse"></div>
                                      <p className="text-xs text-stone-600">Will invest when US markets open (9:30am ET weekdays)</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-stone-300 mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-stone-400">Trade settles in 1-2 business days</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-stone-600">Payment received</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-stone-600">Trade executed at market open</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-stone-600">Settled · Bought 0.{Math.floor(item.amount / 5)} shares of VTI</p>
                                    </div>
                                  </>
                                )}
                                <p className="text-[10px] text-stone-400 pt-2 border-t border-stone-50 mt-2">
                                  Assets held by Alpaca Securities LLC · SIPC protected
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
              )}
            </motion.div>
          </div>

          {/* Sidebar - Desktop only */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              
              {/* Share Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="p-5 rounded-lg bg-white border border-stone-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-stone-900">Share this fund</p>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setShowFundPreview(true)}
                      data-testid="button-preview-fund"
                      className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                      title="Preview page"
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      onClick={() => setShowEditFund(true)}
                      data-testid="button-edit-share"
                      className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="px-3 py-2.5 bg-stone-50 rounded text-sm text-stone-600 truncate">
                    {momentLink}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCopyClick}
                      data-testid="button-copy-desktop"
                      className="flex-1 py-2.5 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors"
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <button 
                      onClick={() => setShowQR(true)}
                      data-testid="button-qr-desktop"
                      className="px-4 py-2.5 border border-stone-200 rounded text-sm hover:bg-stone-50 transition-colors"
                    >
                      QR
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Quick Actions - State-driven primary CTA */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="p-5 rounded-lg bg-white border border-stone-200"
              >
                <p className="text-sm font-medium text-stone-900 mb-4">Do next</p>
                <div className="space-y-2">
                  {/* Primary CTA - changes based on state */}
                  {pendingThankYous > 0 ? (
                    <button 
                      data-testid="button-thank-yous-primary"
                      onClick={() => setShowThankYous(true)}
                      className="w-full py-2.5 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors text-left px-3 flex items-center justify-between"
                    >
                      <span>Send thank-yous</span>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{pendingThankYous} pending</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleCopyClick}
                      data-testid="button-quick-share"
                      className="w-full py-2.5 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors text-left px-3"
                    >
                      Share fund link
                    </button>
                  )}
                  
                  {/* Secondary actions */}
                  {pendingThankYous > 0 && (
                    <button 
                      onClick={handleCopyClick}
                      data-testid="button-quick-share-secondary"
                      className="w-full py-2.5 border border-stone-200 rounded text-sm text-stone-700 hover:bg-stone-50 transition-colors text-left px-3"
                    >
                      Share fund link
                    </button>
                  )}
                  <Link href="/event/create" className="block">
                    <button 
                      data-testid="button-new-event"
                      className="w-full py-2.5 border border-stone-200 rounded text-sm text-stone-700 hover:bg-stone-50 transition-colors text-left px-3"
                    >
                      Create event page
                    </button>
                  </Link>
                  {pendingThankYous === 0 && (
                    <button 
                      data-testid="button-thank-yous"
                      onClick={() => setShowThankYous(true)}
                      className="w-full py-2.5 border border-stone-200 rounded text-sm text-stone-700 hover:bg-stone-50 transition-colors text-left px-3"
                    >
                      Send thank-yous
                    </button>
                  )}
                  <Link href="/send" className="block">
                    <button 
                      data-testid="button-send-gift"
                      className="w-full py-2.5 border border-stone-200 rounded text-sm text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-colors text-left px-3"
                    >
                      Send a gift
                    </button>
                  </Link>
                </div>
              </motion.div>

              {/* Achievements Section */}
              {(() => {
                const achievements = getDefaultAchievements(
                  selectedFund?.balance || 0,
                  selectedFund?.contributors || 0,
                  180
                );
                const unlockedCount = achievements.filter(a => a.unlocked).length;
                return (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-5 rounded-lg bg-gradient-to-br from-stone-50 to-white border border-stone-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-stone-900">Milestones</p>
                      <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {achievements.slice(0, 4).map((achievement) => (
                        <AchievementBadge key={achievement.id} achievement={achievement} size="sm" />
                      ))}
                    </div>
                    <p className="text-xs text-stone-400 mt-3">
                      {selectedFund?.status === "active" 
                        ? `${unlockedCount} of 6 unlocked`
                        : "Start growing to unlock achievements"}
                    </p>
                  </motion.div>
                );
              })()}

              {/* Brokerage Footer */}
              <div className="text-xs text-stone-400 text-center pt-4">
                <p>Brokerage services by Alpaca Securities LLC</p>
                <p>Member FINRA/SIPC</p>
                <button 
                  onClick={() => toast({ title: "Custody & Protection", description: "Your assets are held by Alpaca Securities LLC and protected by SIPC up to $500,000." })}
                  className="text-stone-500 hover:text-stone-700 underline mt-1"
                >
                  Learn about custody + SIPC
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <div className="lg:hidden text-xs text-stone-400 text-center mt-12 pb-8">
          <p>Brokerage services by Alpaca Securities LLC</p>
          <p>Member FINRA/SIPC</p>
          <button 
            onClick={() => toast({ title: "Custody & Protection", description: "Your assets are held by Alpaca Securities LLC and protected by SIPC up to $500,000." })}
            className="text-stone-500 hover:text-stone-700 underline mt-1"
          >
            Learn about custody + SIPC
          </button>
        </div>
      </main>

      {/* Portfolio Modal */}
      <Dialog open={showPortfolio} onOpenChange={setShowPortfolio}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="font-medium">Where it's invested</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
              <div>
                <p className="text-sm text-stone-500">Invested</p>
                <p className="text-lg font-medium text-stone-900">${investedAmount.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-stone-500">Cash</p>
                <p className="text-lg font-medium text-stone-900">${cashAmount.toLocaleString()}</p>
              </div>
            </div>
            
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Holdings</p>
            <div className="space-y-3">
              {holdings.map((holding, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-stone-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-stone-600 bg-white px-2 py-1 rounded border border-stone-200">{holding.ticker}</span>
                    <div>
                      <p className="text-sm text-stone-900">{holding.name}</p>
                      <p className="text-xs text-stone-400">{holding.shares} shares</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-stone-900">${holding.value.toLocaleString()}</p>
                    <p className="text-xs text-emerald-600">+${holding.gain}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-stone-400 pt-4 mt-4 border-t border-stone-100">
              Holdings are at the Fund level. Gifts from all events invest into the same account.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Modal - Fund */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs bg-white">
          <div className="flex flex-col items-center py-6">
            <div className="p-4 bg-white rounded-lg border border-stone-200 mb-4">
              <QRCodeSVG value={`https://${momentLink}`} size={180} level="H" />
            </div>
            <p className="text-xs text-stone-400 text-center mb-1">{momentLink}</p>
            <p className="text-sm text-stone-500 text-center">
              Scan to give
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Modal - Page */}
      <Dialog open={showPageQR !== null} onOpenChange={() => setShowPageQR(null)}>
        <DialogContent className="max-w-xs bg-white">
          <div className="flex flex-col items-center py-6">
            <div className="p-4 bg-white rounded-lg border border-stone-200 mb-4">
              <QRCodeSVG value={`https://${showPageQR}`} size={180} level="H" />
            </div>
            <p className="text-xs text-stone-400 text-center mb-1">{showPageQR}</p>
            <p className="text-sm text-stone-500 text-center">
              Scan to give
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fund Settings Panel */}
      <Dialog open={showEditFund} onOpenChange={setShowEditFund}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          
          <div className="p-5 border-b border-stone-100">
            <div className="flex items-center justify-between mb-1">
              <DialogTitle className="font-medium text-stone-900">Fund Settings</DialogTitle>
              <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider px-2 py-1 bg-stone-100 rounded">
                {isPersonal ? "Individual" : "UTMA"}
              </span>
            </div>
            <p className="text-sm text-stone-500">Manage your fund and events</p>
          </div>

          <div className="p-5 border-b border-stone-100 space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Fund name</label>
              <input
                type="text"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                data-testid="input-fund-name"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Fund URL</label>
              <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                <span className="px-3 py-2.5 bg-stone-50 text-sm text-stone-400 border-r border-stone-200">kora.com/</span>
                <input
                  type="text"
                  value={fundSlugEdit}
                  onChange={(e) => setFundSlugEdit(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  data-testid="input-fund-slug"
                  className="flex-1 px-3 py-2.5 text-stone-900 focus:outline-none"
                />
              </div>
              <p className="text-xs text-stone-400 mt-1.5">Your fund's shareable link — contributors can give anytime</p>
            </div>
          </div>

          <div className="p-5 border-b border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-stone-400 uppercase tracking-wider">Events</label>
              <Link href="/event/create" onClick={() => setShowEditFund(false)}>
                <span className="text-xs text-stone-500 hover:text-stone-900 transition-colors">+ Add event</span>
              </Link>
            </div>
            
            <div className="space-y-2">
              {funds[0]?.events.map((event) => {
                const eventData = eventEdits[event.id] || { title: event.title, slug: event.slug };
                return (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${event.active ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      <p className="text-sm text-stone-900 truncate">{eventData.title}</p>
                    </div>
                    <button 
                      onClick={() => setShowEditEvent(event.id)}
                      data-testid={`button-edit-modal-event-${event.id}`}
                      className="text-xs text-stone-400 hover:text-stone-600 shrink-0 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5">
            <button 
              onClick={() => setShowEditFund(false)}
              data-testid="button-done"
              className="w-full py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Fund Modal */}
      <Dialog open={showAddFund} onOpenChange={setShowAddFund}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          <div className="p-5 border-b border-stone-100">
            <DialogTitle className="font-medium text-stone-900">Add a fund</DialogTitle>
            <p className="text-sm text-stone-500 mt-1">Each fund is a separate brokerage account</p>
          </div>
          
          <div className="p-5 space-y-3">
            <button
              onClick={() => {
                setShowAddFund(false);
                setShowAddChild(true);
              }}
              data-testid="button-add-child-fund"
              className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-300 bg-white text-left transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center transition-colors">
                  <Users size={18} className="text-stone-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-stone-900">Add a child</p>
                  <p className="text-sm text-stone-500 mt-0.5">Open a custodial account (UTMA)</p>
                </div>
              </div>
            </button>

            {!isPersonal && (
              <button
                onClick={() => {
                  setShowAddFund(false);
                  setLocation("/get-started?intent=personal");
                }}
                data-testid="button-add-personal-fund"
                className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-300 bg-white text-left transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center transition-colors">
                    <User size={18} className="text-stone-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-stone-900">Open a personal fund</p>
                    <p className="text-sm text-stone-500 mt-0.5">For yourself (individual brokerage)</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Child Modal */}
      <Dialog open={showAddChild} onOpenChange={setShowAddChild}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          <div className="p-5 border-b border-stone-100">
            <DialogTitle className="font-medium text-stone-900">Add a child</DialogTitle>
            <p className="text-sm text-stone-500 mt-1">We'll create a custodial account for them</p>
          </div>
          
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Child's first name</label>
              <input
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="e.g., Mila"
                data-testid="input-new-child-name"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
              />
            </div>
          </div>

          <div className="p-5 border-t border-stone-100">
            <button 
              onClick={() => {
                if (newChildName.trim()) {
                  const name = newChildName.trim();
                  if (funds.some(f => f.name.toLowerCase() === name.toLowerCase())) {
                    toast({ title: "Fund already exists", description: `You already have a fund for ${name}` });
                    return;
                  }
                  const newFund: StoredFund = {
                    id: Date.now(),
                    name: name,
                    slug: name.toLowerCase().replace(/\s+/g, "-"),
                    accountType: "UTMA",
                    status: "draft",
                    balance: 0,
                    gain: 0,
                    gainPercent: 0,
                    contributors: 0,
                    projection: 0,
                    yearsLeft: 18,
                    isNew: true,
                    events: [
                      { id: Date.now(), slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
                    ]
                  };
                  const updatedFunds = [...funds, newFund];
                  setFunds(updatedFunds);
                  saveStoredFunds(updatedFunds);
                  setSelectedFundSlug(newFund.slug);
                  setExpandedFund(newFund.id);
                  setShowAddChild(false);
                  setNewChildName("");
                  toast({ title: `${name}'s fund created`, description: "Activate investing to start growing gifts" });
                }
              }}
              disabled={!newChildName.trim()}
              data-testid="button-continue-add-child"
              className="w-full py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-40"
            >
              Create fund
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Edit Modal */}
      <Dialog open={showEditEvent !== null} onOpenChange={() => setShowEditEvent(null)}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          {showEditEvent !== null && (() => {
            const event = funds[0]?.events.find(e => e.id === showEditEvent);
            if (!event) return null;
            const eventData = eventEdits[showEditEvent] || { title: event.title, slug: event.slug };
            
            return (
              <>
                <div className="p-5 border-b border-stone-100">
                  <DialogTitle className="font-medium text-stone-900">Edit Event</DialogTitle>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Event name</label>
                    <input
                      type="text"
                      value={eventData.title}
                      onChange={(e) => setEventEdits(prev => ({
                        ...prev,
                        [showEditEvent]: { ...eventData, title: e.target.value }
                      }))}
                      data-testid="input-event-title"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Event URL</label>
                    <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                      <span className="px-3 py-2.5 bg-stone-50 text-sm text-stone-400 border-r border-stone-200 truncate">kora.com/{fundSlug}/</span>
                      <input
                        type="text"
                        value={eventData.slug}
                        onChange={(e) => setEventEdits(prev => ({
                          ...prev,
                          [showEditEvent]: { ...eventData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }
                        }))}
                        data-testid="input-event-url"
                        className="flex-1 px-3 py-2.5 text-stone-900 focus:outline-none min-w-0"
                      />
                    </div>
                  </div>
                  <Link href={`/edit/${fundSlug}/${eventData.slug}`} onClick={() => setShowEditEvent(null)}>
                    <button 
                      data-testid="button-full-editor"
                      className="w-full py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      Open full editor
                    </button>
                  </Link>
                </div>
                <div className="p-5 border-t border-stone-100">
                  <button 
                    onClick={() => setShowEditEvent(null)}
                    data-testid="button-save-event"
                    className="w-full py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Thank-Yous Modal */}
      <Dialog open={showThankYous} onOpenChange={(open) => {
        setShowThankYous(open);
        if (!open) setExpandedThankYou(null);
      }}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          <div className="p-5 border-b border-stone-100">
            <DialogTitle className="font-medium text-stone-900">Send thank-yous</DialogTitle>
            <p className="text-sm text-stone-500 mt-1">
              {pendingThankYous > 0 
                ? `${pendingThankYous} pending${snoozedCount > 0 ? ` • ${snoozedCount} for later` : ''}`
                : snoozedCount > 0 
                  ? `${snoozedCount} saved for later`
                  : "All caught up!"}
            </p>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {recentActivity
              .filter(a => a.status === "invested")
              .map((item, i) => {
                const isSent = sentThankYous.includes(item.id);
                const isSnoozed = snoozedThankYous.includes(item.id);
                const isExpanded = expandedThankYou === item.id;
                const draftMessage = thankYouDrafts[item.id] ?? getDefaultThankYou(item);
                
                return (
                  <div 
                    key={item.id} 
                    className={`border-b border-stone-100 last:border-0 ${isSent ? 'bg-emerald-50/50' : isSnoozed ? 'bg-stone-50' : ''}`}
                  >
                    <div 
                      className={`p-4 ${!isSent ? 'cursor-pointer hover:bg-stone-50' : ''} transition-colors`}
                      onClick={() => !isSent && setExpandedThankYou(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-stone-900">{item.from}</p>
                            {isSent && (
                              <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Sent</span>
                            )}
                            {isSnoozed && !isSent && (
                              <span className="text-xs text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">Later</span>
                            )}
                          </div>
                          <p className="text-sm text-stone-500">${item.amount} • {item.event}</p>
                          {item.note && (
                            <p className="text-sm text-stone-400 mt-1 italic">"{item.note}"</p>
                          )}
                        </div>
                        {!isSent && (
                          <span className="text-xs text-stone-400">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && !isSent && (
                      <div className="px-4 pb-4 space-y-3">
                        <textarea
                          value={draftMessage}
                          onChange={(e) => setThankYouDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-full p-3 text-sm border border-stone-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                          rows={3}
                          placeholder="Write your thank-you message..."
                          data-testid={`textarea-thankyou-${item.id}`}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSentThankYous(prev => [...prev, item.id]);
                              setSnoozedThankYous(prev => prev.filter(id => id !== item.id));
                              setExpandedThankYou(null);
                              toast({ title: `Thank-you sent to ${item.from}` });
                            }}
                            data-testid={`button-send-thanks-${item.id}`}
                            className="flex-1 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
                          >
                            Send thank-you
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSnoozed) {
                                setSnoozedThankYous(prev => prev.filter(id => id !== item.id));
                              } else {
                                setSnoozedThankYous(prev => [...prev, item.id]);
                              }
                              setExpandedThankYou(null);
                            }}
                            data-testid={`button-snooze-thanks-${item.id}`}
                            className="px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50 transition-colors"
                          >
                            {isSnoozed ? 'Restore' : 'Later'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="p-5 border-t border-stone-100">
            <button 
              onClick={() => {
                setShowThankYous(false);
                setExpandedThankYou(null);
              }}
              data-testid="button-close-thankyous"
              className="w-full py-2.5 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contributors Ledger Modal */}
      <Dialog open={showContributors} onOpenChange={setShowContributors}>
        <DialogContent className="max-w-lg bg-white p-0 gap-0 max-h-[85vh] flex flex-col">
          <div className="p-5 border-b border-stone-100 shrink-0">
            <DialogTitle className="font-medium text-stone-900">All Contributors</DialogTitle>
            <p className="text-sm text-stone-500 mt-1">
              {allContributions.length} gifts totaling ${allContributions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {allContributions.map((contribution) => {
              const isThanked = sentThankYous.includes(contribution.id);
              return (
                <div 
                  key={contribution.id} 
                  className="p-4 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-stone-900">{contribution.from}</p>
                      {contribution.status === "pending" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                          Pending
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                          Invested
                        </span>
                      )}
                      {contribution.status === "invested" && (
                        isThanked ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                            Thanked
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 font-medium">
                            Not thanked
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {contribution.event} • {formatDate(contribution.date)} at {formatTime(contribution.date)}
                    </p>
                    {contribution.note && (
                      <p className="text-sm text-stone-400 mt-1 italic">"{contribution.note}"</p>
                    )}
                  </div>
                  <p className="text-sm font-medium text-stone-900 shrink-0">+${contribution.amount}</p>
                </div>
                </div>
              );
            })}
          </div>

          <div className="p-5 border-t border-stone-100 shrink-0">
            <button 
              onClick={() => setShowContributors(false)}
              data-testid="button-close-contributors"
              className="w-full py-2.5 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Action Bar - Fixed position for easy access */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...bouncySpring, delay: 0.3 }}
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-stone-200 p-4 pb-6 lg:hidden z-40 shadow-xl"
      >
        <div className="flex gap-3 max-w-lg mx-auto">
          <motion.button
            onClick={handleCopyClick}
            data-testid="mobile-bottom-share"
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-stone-900 text-white rounded-xl font-medium text-base shadow-lg"
            whileTap={{ scale: 0.95, y: 2 }}
            whileHover={{ scale: 1.02 }}
            transition={gentleSpring}
          >
            <motion.div
              animate={copied ? { rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              {copied ? <Sparkles size={18} /> : <Copy size={18} />}
            </motion.div>
            {copied ? "Copied!" : "Share Link"}
          </motion.button>
          <Link href="/event/create" className="flex-1">
            <motion.button
              data-testid="mobile-bottom-event"
              className="w-full flex items-center justify-center gap-2 py-4 bg-stone-100 text-stone-900 rounded-xl font-medium text-base border border-stone-200"
              whileTap={{ scale: 0.95, y: 2 }}
              whileHover={{ scale: 1.02, backgroundColor: "#f5f5f4" }}
              transition={gentleSpring}
            >
              <motion.div whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }}>
                <Plus size={18} />
              </motion.div>
              New Event
            </motion.button>
          </Link>
        </div>
      </motion.div>
      
      {/* Spacer for bottom action bar on mobile */}
      <div className="h-24 lg:hidden" aria-hidden="true" />

      {/* Fund Preview Modal */}
      <Dialog open={showFundPreview} onOpenChange={setShowFundPreview}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] bg-white p-0 gap-0 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-2 py-1 bg-stone-100 rounded-lg text-xs text-stone-500">
                <Eye size={12} />
                <span>Preview</span>
              </div>
              <span className="text-sm text-stone-600 truncate">kora.com/{selectedFundSlug}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/${selectedFundSlug}`}>
                <button 
                  onClick={() => setShowFundPreview(false)}
                  data-testid="button-view-live"
                  className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Open
                </button>
              </Link>
              <button 
                onClick={() => {
                  setShowFundPreview(false);
                  setShowEditFund(true);
                }}
                data-testid="button-edit-from-preview"
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
            </div>
          </div>
          
          {/* Iframe Container */}
          <div className="flex-1 bg-stone-100 overflow-hidden">
            <iframe
              src={`/${selectedFundSlug}?preview=true`}
              className="w-full h-full border-0"
              title="Fund page preview"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
