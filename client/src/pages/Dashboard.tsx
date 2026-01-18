import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useSearch, useLocation } from "wouter";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Plus, User, Users, ChevronRight, ChevronDown, Share2, TrendingUp, Clock, Gift, Shield, MessageCircle, Calendar, X, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ShareKit } from "@/components/ui/share-kit";
import { TrustFooter, WhoControlsDrawer } from "@/components/ui/trust-elements";
import { PageTransition } from "@/components/layout/PageTransition";
import { springSnappy, springGentle, easeOutExpo, cardTactile, staggerFast } from "@/lib/animations";

function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 250;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
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
  const [showShareKit, setShowShareKit] = useState(false);
  const [showAddFund, setShowAddFund] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");

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
  const [selectedFundSlug, setSelectedFundSlug] = useState(funds[0]?.slug || profileName.toLowerCase().replace(/\s+/g, "-"));
  const selectedFund = funds.find(f => f.slug === selectedFundSlug) || funds[0];
  const [expandedGift, setExpandedGift] = useState<string | null>(null);
  const [expandedHolding, setExpandedHolding] = useState<number | null>(null);
    const [showFundPicker, setShowFundPicker] = useState(false);
  
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
      case "draft": return "bg-muted text-muted-foreground";
      case "pending": return "bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))]";
      case "active": return "bg-[hsl(var(--kora-evergreen)/0.15)] text-[hsl(var(--kora-evergreen))]";
      case "needs_action": return "bg-destructive/15 text-destructive";
    }
  };

  const portfolioValue = selectedFund?.balance || 0;
  const marketChange = selectedFund?.gain || 0;
  const totalReceived = portfolioValue - marketChange;
  const investedAmount = Math.round(portfolioValue * 0.85);
  const pendingAmount = isNewAccount ? 0 : 180;

  const holdings = isNewAccount ? [] : [
    { ticker: "VTI", name: "US Total Market ETF", shares: 12.4, value: 2125, gain: 245 },
    { ticker: "VXUS", name: "International ETF", shares: 8.2, value: 850, gain: 72 },
    { ticker: "DIS", name: "Disney", shares: 3.5, value: 425, gain: 38 },
    { ticker: "AAPL", name: "Apple", shares: 2.1, value: 400, gain: 85 },
  ];

  const allContributions = isNewAccount ? [] : [
    { id: "gift_1", from: "Dave Chen", amount: 180, event: "5th Birthday", date: new Date(Date.now() - 2 * 60 * 60 * 1000), note: "So proud of you", status: "pending" as const },
    { id: "gift_2", from: "Ruth Stein", amount: 500, event: "Open anytime", date: new Date(Date.now() - 24 * 60 * 60 * 1000), note: "With love", status: "invested" as const },
    { id: "gift_3", from: "Michael Park", amount: 100, event: "Open anytime", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), note: null, status: "invested" as const },
    { id: "gift_4", from: "Sarah Johnson", amount: 250, event: "5th Birthday", date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), note: "Happy birthday sweetie!", status: "invested" as const },
    { id: "gift_5", from: "The Goldbergs", amount: 100, event: "5th Birthday", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), note: "Wishing you the best!", status: "invested" as const },
    { id: "gift_6", from: "Uncle James", amount: 300, event: "Open anytime", date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), note: "For your future", status: "invested" as const },
  ];

  const formatRelativeTime = (date: Date) => {
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (hours < 1) return "Just now";
    if (hours < 2) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <motion.header 
          className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: easeOutExpo }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Logo size="sm" className="text-primary" />
            
            <div className="flex items-center gap-2">
              {funds.length > 1 && (
                <motion.button
                  onClick={() => setShowFundPicker(true)}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 text-sm font-medium text-foreground bg-muted hover:bg-border px-3 py-2 rounded-xl transition-colors"
                  data-testid="button-fund-switcher"
                >
                  <div className="w-6 h-6 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center text-[hsl(var(--kora-evergreen))] text-xs font-semibold">
                    {selectedFund.name.charAt(0)}
                  </div>
                  <span className="max-w-[100px] truncate">{selectedFund.name}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </motion.button>
              )}
              <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
                <div className="w-9 h-9 rounded-full bg-muted hover:bg-border flex items-center justify-center text-muted-foreground transition-colors" data-testid="button-account">
                  <User size={16} />
                </div>
              </Link>
            </div>
          </div>
      </motion.header>
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-12 momentum-scroll">
        
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="text-center py-4">
            <motion.h1 
              className="text-2xl font-bold text-foreground mb-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
            >
              {selectedFund.name}'s Fund
            </motion.h1>
            <p className="text-sm text-muted-foreground">
              {isPersonal 
                ? "Your investment fund"
                : `${selectedFund.yearsLeft} years until 18`
              }
            </p>
          </div>
          
          <motion.button
            onClick={() => setShowShareKit(true)}
            data-testid="button-hero-share"
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-[hsl(var(--kora-evergreen))] text-white font-semibold rounded-2xl flex items-center justify-center gap-2.5 touch-target shadow-lg shadow-[hsl(var(--kora-evergreen)/0.2)]"
          >
            <Share2 size={18} />
            Share fund link
          </motion.button>
        </motion.section>

        <div className="lg:grid lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2">
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.05, ease: "easeOut" }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-6">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(selectedFund.status)}`}>
                  {getStatusLabel(selectedFund.status)}
                </span>
                {selectedFund.status === "pending" && (
                  <span className="text-xs text-muted-foreground">Usually under 2 minutes</span>
                )}
              </div>
              
              {selectedFund.status === "draft" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card border border-border rounded-2xl p-6 sm:p-8"
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--kora-evergreen))] flex items-center justify-center">
                      <Shield size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1">One more step</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedFund.name}'s fund is ready. Activate investing to start receiving real gifts.
                      </p>
                    </div>
                  </div>
                  
                  <Link href={`/activate?type=${accountType}&children=${childrenParam || ""}`}>
                    <Button 
                      data-testid="button-activate-investing"
                      size="lg"
                      className="w-full h-14 text-base rounded-2xl bg-primary text-primary-foreground hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors duration-200"
                    >
                      Activate investing
                      <ChevronRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-4 text-center">Takes about 2 minutes. Identity verification required.</p>
                </motion.div>
              ) : selectedFund.status === "pending" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card border border-border rounded-2xl p-6 sm:p-8"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--kora-gold))] flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1">Verifying your identity</h3>
                      <p className="text-sm text-muted-foreground">This usually takes under 2 minutes</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  <motion.div 
                    className="bg-card border border-border rounded-3xl p-8 sm:p-10 mb-8 shadow-sm"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="text-center mb-8">
                      <motion.p 
                        className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tight mb-3"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                      >
                        <AnimatedValue value={portfolioValue} />
                      </motion.p>
                      <p className="text-base text-muted-foreground font-medium">Total Value</p>
                      {marketChange > 0 && (
                        <motion.p 
                          className="text-base text-[hsl(var(--kora-evergreen))] mt-2 flex items-center justify-center gap-1.5 font-semibold"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          <TrendingUp size={18} />
                          +${marketChange.toLocaleString()} growth
                        </motion.p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
                      <div className="text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-foreground">${investedAmount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground mt-1.5 font-medium">Invested</p>
                      </div>
                      <div className="text-center border-x border-border">
                        <p className="text-2xl sm:text-3xl font-bold text-[hsl(var(--kora-gold))]">${pendingAmount}</p>
                        <p className="text-sm text-muted-foreground mt-1.5 flex items-center justify-center gap-1.5 font-medium">
                          <motion.span 
                            className="w-2 h-2 rounded-full bg-[hsl(var(--kora-gold))]"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                          Pending
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-foreground">${totalReceived.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground mt-1.5 font-medium">Received</p>
                      </div>
                    </div>
                  </motion.div>

                  <Tabs defaultValue="gifts" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="gifts" data-testid="tab-gifts" className="flex items-center gap-2">
                        <Gift size={14} />
                        Gifts
                      </TabsTrigger>
                      <TabsTrigger value="holdings" data-testid="tab-holdings" className="flex items-center gap-2">
                        <TrendingUp size={14} />
                        Holdings
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="gifts" className="space-y-3">
                      {allContributions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Gift size={32} className="mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No gifts yet. Share your fund to start receiving!</p>
                        </div>
                      ) : (
                        allContributions.map((gift, index) => {
                          const isExpanded = expandedGift === gift.id;
                          return (
                            <motion.div
                              key={gift.id}
                              layout
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.04, duration: 0.2, ease: "easeOut", layout: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } }}
                              className={`bg-card border rounded-2xl overflow-hidden cursor-pointer touch-target ${isExpanded ? "border-[hsl(var(--kora-evergreen)/0.3)] shadow-lg" : "border-border"}`}
                              onClick={() => setExpandedGift(isExpanded ? null : gift.id)}
                            >
                              <motion.div 
                                className="p-5 flex items-center justify-between"
                                whileTap={{ scale: isExpanded ? 1 : 0.98 }}
                              >
                                <div className="flex items-center gap-4">
                                  <motion.div 
                                    layout="position"
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-semibold ${
                                      gift.status === "pending" 
                                        ? "bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))]"
                                        : "bg-[hsl(var(--kora-evergreen)/0.15)] text-[hsl(var(--kora-evergreen))]"
                                    }`}
                                  >
                                    {gift.from.charAt(0)}
                                  </motion.div>
                                  <div>
                                    <p className="text-base font-semibold text-foreground">{gift.from}</p>
                                    <p className="text-sm text-muted-foreground">{formatRelativeTime(gift.date)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-foreground">${gift.amount}</p>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      gift.status === "pending"
                                        ? "bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))]"
                                        : "bg-success/15 text-success"
                                    }`}>
                                      {gift.status === "pending" ? "Pending" : "Invested"}
                                    </span>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ChevronDown size={18} className="text-muted-foreground" />
                                  </motion.div>
                                </div>
                              </motion.div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-5 pb-5 pt-0 space-y-4 border-t border-border/50">
                                      <div className="pt-4 grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                            <Calendar size={14} className="text-muted-foreground" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">Event</p>
                                            <p className="text-sm font-medium text-foreground">{gift.event}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                            <Clock size={14} className="text-muted-foreground" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">Status</p>
                                            <p className={`text-sm font-medium ${gift.status === "pending" ? "text-[hsl(var(--kora-gold))]" : "text-[hsl(var(--kora-evergreen))]"}`}>
                                              {gift.status === "pending" ? "Pending investment" : "Invested"}
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {gift.note && (
                                        <motion.div
                                          initial={{ opacity: 0, y: 8 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: 0.1 }}
                                          className="bg-[hsl(var(--kora-gold)/0.08)] rounded-xl p-4"
                                        >
                                          <div className="flex items-center gap-2 mb-2">
                                            <MessageCircle size={14} className="text-[hsl(var(--kora-gold))]" />
                                            <p className="text-xs font-medium text-[hsl(var(--kora-gold))]">Message</p>
                                          </div>
                                          <p className="text-sm text-foreground">"{gift.note}"</p>
                                        </motion.div>
                                      )}

                                      {gift.status === "invested" && (
                                        <motion.div
                                          initial={{ opacity: 0, y: 8 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: 0.15 }}
                                          className="bg-[hsl(var(--kora-evergreen)/0.08)] rounded-xl p-4"
                                        >
                                          <div className="flex items-center gap-2 mb-3">
                                            <TrendingUp size={14} className="text-[hsl(var(--kora-evergreen))]" />
                                            <p className="text-xs font-medium text-[hsl(var(--kora-evergreen))]">Invested in</p>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            <span className="text-xs px-2.5 py-1 rounded-md bg-background border border-border text-foreground">VTI</span>
                                            <span className="text-xs px-2.5 py-1 rounded-md bg-background border border-border text-foreground">VXUS</span>
                                          </div>
                                        </motion.div>
                                      )}

                                      {gift.status === "pending" && (
                                        <p className="text-xs text-muted-foreground text-center pt-2">
                                          Invests at next market open (9:30 AM ET)
                                        </p>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })
                      )}
                    </TabsContent>
                    
                    <TabsContent value="holdings" className="space-y-3">
                      {holdings.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <TrendingUp size={32} className="mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No holdings yet. Activate investing to get started!</p>
                        </div>
                      ) : (
                        holdings.map((holding, i) => {
                          const isExpanded = expandedHolding === i;
                          const pricePerShare = (holding.value / holding.shares).toFixed(2);
                          const costBasis = holding.value - holding.gain;
                          const gainPercent = ((holding.gain / costBasis) * 100).toFixed(1);
                          
                          return (
                            <motion.div
                              key={i}
                              layout
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04, duration: 0.2, ease: "easeOut", layout: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } }}
                              className={`bg-card border rounded-2xl overflow-hidden cursor-pointer touch-target ${isExpanded ? "border-[hsl(var(--kora-evergreen)/0.3)] shadow-lg" : "border-border"}`}
                              onClick={() => setExpandedHolding(isExpanded ? null : i)}
                            >
                              <motion.div 
                                className="p-5 flex items-center justify-between"
                                whileTap={{ scale: isExpanded ? 1 : 0.98 }}
                              >
                                <div className="flex items-center gap-3">
                                  <motion.span 
                                    layout="position"
                                    className="text-xs font-bold text-foreground bg-muted px-3 py-2 rounded-lg border border-border"
                                  >
                                    {holding.ticker}
                                  </motion.span>
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{holding.name}</p>
                                    <p className="text-xs text-muted-foreground">{holding.shares} shares</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-base font-bold text-foreground">${holding.value.toLocaleString()}</p>
                                    <p className="text-xs text-[hsl(var(--kora-evergreen))] font-medium">+${holding.gain} ({gainPercent}%)</p>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ChevronDown size={18} className="text-muted-foreground" />
                                  </motion.div>
                                </div>
                              </motion.div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-5 pb-5 pt-0 space-y-4 border-t border-border/50">
                                      <div className="pt-4 grid grid-cols-3 gap-3">
                                        <motion.div
                                          initial={{ opacity: 0, y: 8 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: 0.05 }}
                                          className="bg-muted/50 rounded-xl p-3 text-center"
                                        >
                                          <p className="text-lg font-bold text-foreground">${pricePerShare}</p>
                                          <p className="text-xs text-muted-foreground">Per share</p>
                                        </motion.div>
                                        <motion.div
                                          initial={{ opacity: 0, y: 8 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: 0.1 }}
                                          className="bg-muted/50 rounded-xl p-3 text-center"
                                        >
                                          <p className="text-lg font-bold text-foreground">${costBasis.toLocaleString()}</p>
                                          <p className="text-xs text-muted-foreground">Cost basis</p>
                                        </motion.div>
                                        <motion.div
                                          initial={{ opacity: 0, y: 8 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: 0.15 }}
                                          className="bg-[hsl(var(--kora-evergreen)/0.1)] rounded-xl p-3 text-center"
                                        >
                                          <p className="text-lg font-bold text-[hsl(var(--kora-evergreen))]">+{gainPercent}%</p>
                                          <p className="text-xs text-muted-foreground">Return</p>
                                        </motion.div>
                                      </div>

                                      <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="bg-gradient-to-r from-[hsl(var(--kora-evergreen)/0.08)] to-transparent rounded-xl p-4"
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <TrendingUp size={14} className="text-[hsl(var(--kora-evergreen))]" />
                                          <p className="text-xs font-medium text-[hsl(var(--kora-evergreen))]">Performance</p>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                          <motion.div 
                                            className="h-full bg-[hsl(var(--kora-evergreen))] rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (holding.value / 3000) * 100)}%` }}
                                            transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                                          />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                          {((holding.value / portfolioValue) * 100).toFixed(0)}% of portfolio
                                        </p>
                                      </motion.div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </motion.div>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              <div className="text-xs text-muted-foreground text-center pt-4">
                <p>Brokerage services by Alpaca Securities LLC</p>
                <p>Member FINRA/SIPC</p>
                <button 
                  onClick={() => toast({ title: "Custody & Protection", description: "Your assets are held by Alpaca Securities LLC and protected by SIPC up to $500,000." })}
                  className="text-muted-foreground hover:text-foreground underline mt-1"
                >
                  Learn about custody + SIPC
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden text-xs text-muted-foreground text-center mt-12 pb-8">
          <p>Brokerage services by Alpaca Securities LLC</p>
          <p>Member FINRA/SIPC</p>
        </div>
      </main>

      {/* Add Fund Sheet - Bottom on mobile, Dialog on desktop */}
      <Sheet open={showAddFund} onOpenChange={setShowAddFund}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader className="text-left mb-6">
            <SheetTitle className="text-xl font-bold">Add a fund</SheetTitle>
            <p className="text-base text-muted-foreground">Each fund is a separate investment account</p>
          </SheetHeader>
          
          <div className="space-y-4">
            <motion.button
              onClick={() => {
                setShowAddFund(false);
                setShowAddChild(true);
              }}
              whileTap={{ scale: 0.98 }}
              data-testid="button-add-child-fund-mobile"
              className="w-full p-5 rounded-2xl border-2 border-border bg-card text-left transition-all touch-target"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Users size={24} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-foreground">Add a child</p>
                  <p className="text-base text-muted-foreground mt-1">Open a custodial account (UTMA)</p>
                </div>
              </div>
            </motion.button>

            {!isPersonal && (
              <motion.button
                onClick={() => {
                  setShowAddFund(false);
                  setLocation("/get-started?intent=personal");
                }}
                whileTap={{ scale: 0.98 }}
                data-testid="button-add-personal-fund-mobile"
                className="w-full p-5 rounded-2xl border-2 border-border bg-card text-left transition-all touch-target"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                    <User size={24} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-foreground">Open a personal fund</p>
                    <p className="text-base text-muted-foreground mt-1">For yourself (individual brokerage)</p>
                  </div>
                </div>
              </motion.button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Dialog fallback */}
      <Dialog open={showAddFund} onOpenChange={setShowAddFund}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 hidden md:block" aria-describedby={undefined}>
          <div className="p-5 border-b border-border">
            <DialogTitle className="font-medium text-foreground">Add a fund</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Each fund is a separate investment account</p>
          </div>
          
          <div className="p-5 space-y-3">
            <button
              onClick={() => {
                setShowAddFund(false);
                setShowAddChild(true);
              }}
              data-testid="button-add-child-fund"
              className="w-full p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 bg-white text-left transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-border flex items-center justify-center transition-colors">
                  <Users size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Add a child</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Open a custodial account (UTMA)</p>
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
                className="w-full p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 bg-white text-left transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-border flex items-center justify-center transition-colors">
                    <User size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Open a personal fund</p>
                    <p className="text-sm text-muted-foreground mt-0.5">For yourself (individual brokerage)</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Child Sheet - Bottom on mobile */}
      <Sheet open={showAddChild} onOpenChange={setShowAddChild}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader className="text-left mb-6">
            <SheetTitle className="text-xl font-bold">Add a child</SheetTitle>
            <p className="text-base text-muted-foreground">We'll create a custodial account for them</p>
          </SheetHeader>
          
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-foreground mb-2">Child's first name</label>
              <input
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="e.g., Mila"
                data-testid="input-new-child-name-mobile"
                className="w-full px-5 py-4 border border-border rounded-2xl text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary touch-target"
              />
            </div>

            <motion.button 
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
                  setShowAddChild(false);
                  setNewChildName("");
                  toast({ title: `${name}'s fund created`, description: "Activate investing to start growing gifts" });
                }
              }}
              whileTap={{ scale: 0.98 }}
              disabled={!newChildName.trim()}
              data-testid="button-continue-add-child-mobile"
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-lg font-semibold transition-colors disabled:opacity-40 touch-target"
            >
              Create fund
            </motion.button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Dialog fallback for Add Child */}
      <Dialog open={showAddChild} onOpenChange={setShowAddChild}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 hidden md:block" aria-describedby={undefined}>
          <div className="p-5 border-b border-border">
            <DialogTitle className="font-medium text-foreground">Add a child</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">We'll create a custodial account for them</p>
          </div>
          
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Child's first name</label>
              <input
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="e.g., Mila"
                data-testid="input-new-child-name"
                className="w-full px-4 py-3 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted-foreground"
              />
            </div>
          </div>

          <div className="p-5 border-t border-border">
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
                  setShowAddChild(false);
                  setNewChildName("");
                  toast({ title: `${name}'s fund created`, description: "Activate investing to start growing gifts" });
                }
              }}
              disabled={!newChildName.trim()}
              data-testid="button-continue-add-child"
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors disabled:opacity-40"
            >
              Create fund
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fund Picker Sheet */}
      <Sheet open={showFundPicker} onOpenChange={setShowFundPicker}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="text-lg font-semibold">Your funds</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-2 pb-4">
            {funds.map((fund) => (
              <motion.button
                key={fund.slug}
                onClick={() => {
                  setSelectedFundSlug(fund.slug);
                  setShowFundPicker(false);
                }}
                whileTap={{ scale: 0.98 }}
                className={`w-full p-4 rounded-xl flex items-center gap-4 transition-colors ${
                  fund.slug === selectedFundSlug
                    ? "bg-[hsl(var(--kora-evergreen)/0.1)] border-2 border-[hsl(var(--kora-evergreen))]"
                    : "bg-muted border-2 border-transparent hover:bg-border"
                }`}
                data-testid={`fund-option-${fund.slug}`}
              >
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center text-[hsl(var(--kora-evergreen))] text-lg font-semibold">
                  {fund.name.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">{fund.name}'s Fund</p>
                  <p className="text-sm text-muted-foreground">
                    {fund.accountType} · {fund.status === "active" ? "Active" : fund.status === "draft" ? "Not activated" : "Pending"}
                  </p>
                </div>
                {fund.slug === selectedFundSlug && (
                  <div className="w-6 h-6 rounded-full bg-[hsl(var(--kora-evergreen))] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </motion.button>
            ))}

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowFundPicker(false);
                setShowAddFund(true);
              }}
              className="w-full p-4 rounded-xl border-2 border-dashed border-border flex items-center gap-4 hover:border-muted-foreground/50 transition-colors"
              data-testid="fund-picker-add-fund"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Plus size={20} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">Add a fund</p>
                <p className="text-sm text-muted-foreground">New child or personal account</p>
              </div>
            </motion.button>
          </div>
        </SheetContent>
      </Sheet>

      <ShareKit 
        isOpen={showShareKit} 
        onClose={() => setShowShareKit(false)}
        fundName={selectedFund.name}
        fundSlug={selectedFund.slug}
        recipientName={selectedFund.name}
      />

      {/* Trust Footer */}
      <TrustFooter />

        {/* Spacer for mobile nav */}
        <div className="h-24 md:hidden" />
      </div>
    </PageTransition>
  );
}
