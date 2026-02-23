import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useSearch, useLocation } from "wouter";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Plus, User, Users, ChevronRight, ChevronDown, Share2, TrendingUp, Clock, Gift, Shield, MessageCircle, Calendar, X, Lock, Check } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ShareKit } from "@/components/ui/share-kit";
import { TrustFooter, WhoControlsDrawer } from "@/components/ui/trust-elements";
import { PageTransition } from "@/components/layout/PageTransition";
import { springSnappy, springGentle, easeOutExpo, cardTactile, staggerFast, sharePulse, staggerPremium, listItemSpring } from "@/lib/animations";
import { AnimatedValue } from "@/components/ui/animated-value";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GeminiBalanceGlow, GradientText, ThinkingOrb, EnlighteningReveal } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";
import { useFunds, useFundEvents, useFundHoldings, useFundGifts, useCreateFund } from "@/hooks/use-funds";
import { useEvents } from "@/hooks/use-events";
import type { Fund, Event, Holding, Gift as GiftType } from "@shared/schema";

type FundStatus = "draft" | "pending" | "active" | "needs_action";

interface StoredFund {
  id: string;
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
  events: { id: string; slug: string; title: string; date?: string; active: boolean; isDefault?: boolean }[];
}

export default function Dashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [, setLocation] = useLocation();
  
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: apiFunds = [], isLoading: fundsLoading } = useFunds();
  const { data: apiEvents = [], isLoading: eventsLoading } = useEvents();
  const createFundMutation = useCreateFund();

  const [showShareKit, setShowShareKit] = useState(false);
  const [showAddFund, setShowAddFund] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [selectedFundSlug, setSelectedFundSlug] = useState("");
  const [expandedGift, setExpandedGift] = useState<string | null>(null);
  const [expandedHolding, setExpandedHolding] = useState<number | null>(null);
  const [showFundPicker, setShowFundPicker] = useState(false);
  
  const effectiveSlug = selectedFundSlug || apiFunds[0]?.slug || "";
  const currentFundId = apiFunds.find(f => f.slug === effectiveSlug)?.id || apiFunds[0]?.id || "";
  const { data: fundGifts = [] } = useFundGifts(currentFundId);
  const { data: fundHoldings = [] } = useFundHoldings(currentFundId);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [authLoading, isAuthenticated]);

  const funds: StoredFund[] = apiFunds.map(f => {
    const fundEvents = apiEvents
      .filter(e => e.fundId === f.id)
      .map(e => ({
        id: e.id,
        slug: e.slug,
        title: e.name,
        date: e.eventDate ? new Date(e.eventDate).toLocaleDateString() : undefined,
        active: e.status === "active",
        isDefault: e.isPermanent,
      }));
    
    return {
      id: f.id,
      name: f.name,
      slug: f.slug,
      accountType: f.accountType,
      status: (f.status || "active") as FundStatus,
      balance: parseFloat(f.balance || "0"),
      gain: parseFloat(f.totalGain || "0"),
      gainPercent: parseFloat(f.gainPercent || "0"),
      contributors: f.contributorCount || 0,
      projection: parseFloat(f.projectedValue || "0"),
      yearsLeft: f.yearsUntilMaturity || 18,
      isNew: f.status === "draft",
      events: fundEvents,
    };
  });

  const isNewAccount = funds.length === 0 || funds.every(f => f.status === "draft");

  if (authLoading || fundsLoading || eventsLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <ThinkingOrb size={48} variant="default" />
        <motion.p
          className="text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Loading your fund...
        </motion.p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (funds.length === 0) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
          <Logo size="lg" className="text-foreground mb-8" />
          <h1 className="text-2xl font-semibold mb-4">Welcome to Kora</h1>
          <p className="text-muted-foreground text-center max-w-md mb-8">
            Create your first investment fund to start receiving gifts that grow over time.
          </p>
          <Link href="/get-started">
            <Button size="lg" className="h-12 px-8" data-testid="button-create-first-fund">
              Create your first fund
            </Button>
          </Link>
        </div>
      </PageTransition>
    );
  }

  const profileName = funds[0]?.name || user?.firstName || "My Fund";
  const isPersonal = funds[0]?.accountType === "Individual";
  const effectiveSelectedSlug = selectedFundSlug || funds[0]?.slug || "";
  const selectedFund = funds.find(f => f.slug === effectiveSelectedSlug) || funds[0];
  
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
  
  const pendingGifts = fundGifts.filter(g => g.status === "pending" || g.status === "processing");
  const investedGifts = fundGifts.filter(g => g.status === "invested" || g.status === "completed");
  const pendingAmount = pendingGifts.reduce((sum, g) => sum + parseFloat(g.amount || "0"), 0);
  const investedAmount = investedGifts.reduce((sum, g) => sum + parseFloat(g.amount || "0"), 0);

  const holdings = fundHoldings.map(h => ({
    ticker: h.ticker,
    name: h.name,
    shares: parseFloat(h.shares || "0"),
    value: parseFloat(h.currentValue || "0"),
    gain: parseFloat(h.gain || "0"),
  }));

  const allContributions = fundGifts.map(g => {
    const eventForGift = apiEvents.find(e => e.id === g.eventId);
    return {
      id: g.id,
      from: g.senderName || "Anonymous",
      amount: parseFloat(g.amount || "0"),
      event: eventForGift?.name || "Gift",
      date: new Date(g.createdAt || Date.now()),
      note: g.message || null,
      status: (g.status === "invested" || g.status === "completed" ? "invested" : "pending") as "invested" | "pending",
    };
  });

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
      <div className={`min-h-screen bg-background md:pb-0 ${selectedFund.status === 'active' ? 'pb-24' : 'pb-4'}`}>
        <motion.header 
          className="sticky top-0 z-50 gemini-glass-nav"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: easeOutExpo }}
        >
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            <Logo size="sm" className="text-primary" />
          </div>
      </motion.header>
      
      <main className="max-w-lg mx-auto px-4 py-6 momentum-scroll">
        
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="text-center py-4">
            {funds.length > 1 ? (
              <motion.button
                onClick={() => { haptic('selection'); setShowFundPicker(true); }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 mb-1"
                data-testid="button-fund-switcher"
              >
                <motion.h1 
                  className="text-2xl font-bold text-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 }}
                >
                  {selectedFund.name}'s Fund
                </motion.h1>
                <ChevronDown size={20} className="text-muted-foreground" />
              </motion.button>
            ) : (
              <motion.h1 
                className="text-2xl font-bold text-foreground mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}
              >
                {selectedFund.name}'s Fund
              </motion.h1>
            )}
            <p className="text-sm text-muted-foreground">
              {isPersonal 
                ? "Your investment fund"
                : `${selectedFund.yearsLeft} years until 18`
              }
            </p>
          </div>
          
          <MagneticButton
            onClick={() => setShowShareKit(true)}
            data-testid="button-hero-share"
            className="gemini-btn-shimmer w-full py-4 bg-[hsl(var(--kora-evergreen))] text-white font-semibold rounded-2xl flex items-center justify-center gap-2.5 touch-target shadow-premium-lg btn-premium"
          >
            <motion.span
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.18 }}
            >
              <Share2 size={18} />
              Share fund link
            </motion.span>
          </MagneticButton>
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
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                  className="relative"
                >
                  <div className="bg-gradient-to-br from-[hsl(var(--kora-evergreen))] to-[hsl(var(--kora-evergreen-light))] rounded-3xl p-8 sm:p-10 text-white shadow-premium-lg">
                    <div className="flex items-start gap-5 mb-6">
                      <div className="w-14 h-14 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center text-[hsl(var(--kora-evergreen))] text-xl font-bold shadow-md">
                        {selectedFund.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold mb-1">
                          Activate {selectedFund.name}'s portfolio
                        </h2>
                        <p className="text-white/75 text-sm sm:text-base">
                          One quick step, then gifts start investing
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded-2xl p-4 mb-6">
                      <p className="text-white/90 text-sm font-medium mb-3">After activation, you can:</p>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center">
                            <Check size={12} className="text-[hsl(var(--kora-evergreen))]" />
                          </div>
                          <span className="text-white/90 text-sm">Share gift links with family</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center">
                            <Check size={12} className="text-[hsl(var(--kora-evergreen))]" />
                          </div>
                          <span className="text-white/90 text-sm">Receive gifts that auto-invest</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center">
                            <Check size={12} className="text-[hsl(var(--kora-evergreen))]" />
                          </div>
                          <span className="text-white/90 text-sm">Watch their portfolio grow</span>
                        </div>
                      </div>
                    </div>
                      
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        <Link href={`/activate?fund=${selectedFund.slug}`}>
                          <MagneticButton 
                            data-testid="button-activate-investing"
                            className="gemini-btn-shimmer w-full h-14 text-base font-semibold rounded-2xl bg-white text-[hsl(var(--kora-evergreen))] hover:bg-white/95 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                          >
                            <span>Continue</span>
                            <ChevronRight className="w-5 h-5" />
                          </MagneticButton>
                        </Link>
                        <p className="text-white/60 text-sm mt-4 text-center">
                          Takes about 2 minutes
                        </p>
                      </motion.div>
                  </div>
                  
                  <motion.div 
                    className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Shield size={12} />
                      <span>SIPC Protected</span>
                    </div>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <div className="flex items-center gap-1.5">
                      <Lock size={12} />
                      <span>256-bit encryption</span>
                    </div>
                  </motion.div>
                </motion.div>
              ) : selectedFund.status === "pending" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card border border-border/50 rounded-2xl p-6 sm:p-8 shadow-premium-sm"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <ThinkingOrb size={56} variant="processing" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1">Verifying your identity</h3>
                      <motion.p
                        className="text-sm text-muted-foreground"
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        This usually takes under 2 minutes
                      </motion.p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  <motion.div 
                    className="relative bg-card border border-border rounded-3xl p-8 sm:p-10 mb-8 gemini-card-soft overflow-hidden"
                    initial={{ opacity: 0, scale: 0.97, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <GeminiBalanceGlow />
                    <div className="relative z-10 text-center mb-8">
                      <motion.p 
                        className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tight mb-3 gemini-value-glow"
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
                    
                    <motion.div 
                      className="relative z-10 grid grid-cols-3 gap-6 pt-8 border-t border-border/50"
                      initial="hidden"
                      animate="visible"
                      variants={staggerPremium}
                    >
                      <motion.div variants={listItemSpring} className="text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-foreground">${investedAmount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground mt-1.5 font-medium">Invested</p>
                      </motion.div>
                      <motion.div variants={listItemSpring} className="text-center border-x border-border">
                        <p className="text-2xl sm:text-3xl font-bold text-[hsl(var(--kora-gold))]">${pendingAmount}</p>
                        <p className="text-sm text-muted-foreground mt-1.5 flex items-center justify-center gap-1.5 font-medium">
                          <span className="gemini-pulse-dot" />
                          Pending
                        </p>
                      </motion.div>
                      <motion.div variants={listItemSpring} className="text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-foreground">${totalReceived.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground mt-1.5 font-medium">Received</p>
                      </motion.div>
                    </motion.div>
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
                              className={`bg-card border rounded-2xl overflow-hidden cursor-pointer touch-target shadow-premium-sm gemini-hover-glow transition-all duration-150 ${isExpanded ? "border-primary/20 shadow-premium-lg" : "border-border/50"}`}
                              onClick={() => { haptic('selection'); setExpandedGift(isExpanded ? null : gift.id); }}
                            >
                              <motion.div 
                                className="p-5 flex items-center justify-between"
                                whileTap={{ scale: isExpanded ? 1 : 0.98 }}
                              >
                                <div className="flex items-center gap-4">
                                  <motion.div 
                                    layout="position"
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold ${
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
                              className={`bg-card border rounded-2xl overflow-hidden cursor-pointer touch-target gemini-hover-glow ${isExpanded ? "border-[hsl(var(--kora-evergreen)/0.3)] shadow-lg" : "border-border"}`}
                              onClick={() => setExpandedHolding(isExpanded ? null : i)}
                            >
                              <motion.div 
                                className="p-5 flex items-center justify-between"
                                whileTap={{ scale: isExpanded ? 1 : 0.98 }}
                              >
                                <div className="flex items-center gap-3">
                                  <motion.span 
                                    layout="position"
                                    className="w-10 h-10 flex items-center justify-center text-xs font-bold text-foreground bg-gradient-to-br from-primary/10 to-accent/5 rounded-full border border-border/50"
                                  >
                                    {holding.ticker.slice(0, 2)}
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
                                        <div className="gemini-progress">
                                          <motion.div 
                                            className="gemini-progress-fill"
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
                  createFundMutation.mutateAsync({
                    name: name,
                    slug: name.toLowerCase().replace(/\s+/g, "-"),
                    accountType: "UTMA",
                    status: "draft",
                  }).then((newFund) => {
                    setSelectedFundSlug(newFund.slug);
                    setShowAddChild(false);
                    setNewChildName("");
                    toast({ title: `${name}'s fund created`, description: "Activate investing to start growing gifts" });
                  }).catch(() => {
                    toast({ title: "Error", description: "Could not create fund", variant: "destructive" });
                  });
                }
              }}
              whileTap={{ scale: 0.98 }}
              disabled={!newChildName.trim() || createFundMutation.isPending}
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
                  createFundMutation.mutateAsync({
                    name: name,
                    slug: name.toLowerCase().replace(/\s+/g, "-"),
                    accountType: "UTMA",
                    status: "draft",
                  }).then((newFund) => {
                    setSelectedFundSlug(newFund.slug);
                    setShowAddChild(false);
                    setNewChildName("");
                    toast({ title: `${name}'s fund created`, description: "Activate investing to start growing gifts" });
                  }).catch(() => {
                    toast({ title: "Error", description: "Could not create fund", variant: "destructive" });
                  });
                }
              }}
              disabled={!newChildName.trim() || createFundMutation.isPending}
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
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground">
                      {fund.accountType === "UTMA" ? "Custodial" : fund.accountType === "Personal" ? "Personal" : fund.accountType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fund.accountType === "UTMA" ? "You manage for " + fund.name : "Your account"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fund.status === "active" ? "Active" : fund.status === "draft" ? "Not activated yet" : "Verification pending"}
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
        shareOptions={[
          { id: "fund", title: "Gift anytime", slug: "", isDefault: true },
          ...(selectedFund.events?.filter(e => e.active && !e.title.toLowerCase().includes("anytime")).map(e => ({
            id: e.slug,
            title: e.title,
            slug: e.slug,
            isDefault: false,
            date: e.date
          })) || [])
        ]}
        defaultShareId="fund"
      />

      {/* Trust Footer */}
      <TrustFooter />
      </div>
    </PageTransition>
  );
}
