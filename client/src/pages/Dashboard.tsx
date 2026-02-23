import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { AddFundSheet } from "@/components/AddFundSheet";
import { EventGateModal } from "@/components/EventGateModal";
import {
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Gift,
  Share2,
  Calendar,
  BookOpen,
  Plus,
  ChevronDown,
  Wallet,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { EducationTip, educationContent } from "@/components/ui/education";
import { GradientText, GeminiBalanceGlow } from "@/components/ui/gemini";
import mascotImg from "@/assets/kora-mascot.png";
import type { Fund, Holding, Gift as GiftType, Event } from "@shared/schema";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-muted rounded-lg animate-pulse ${className}`} />
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: subscription } = useSubscription();
  const queryClient = useQueryClient();
  const [selectedFundId, setSelectedFundId] = useState<string>("");
  const [fundPickerOpen, setFundPickerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [addFundOpen, setAddFundOpen] = useState(false);
  const [eventGateOpen, setEventGateOpen] = useState(false);
  const [investingCash, setInvestingCash] = useState(false);
  const [sellingHolding, setSellingHolding] = useState<Holding | null>(null);
  const [sellShares, setSellShares] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const isFamily = subscription?.plan === "family" && subscription?.status === "active";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const { data: funds = [], isLoading: fundsLoading } = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const activeFundId = selectedFundId || funds[0]?.id || "";
  const activeFund = funds.find((f) => f.id === activeFundId) || funds[0];

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ["/api/funds", activeFundId, "holdings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/holdings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId,
  });

  const { data: gifts = [], isLoading: giftsLoading } = useQuery<GiftType[]>({
    queryKey: ["/api/funds", activeFundId, "gifts"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/gifts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/funds", activeFundId, "events"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/events`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SkeletonBlock className="w-12 h-12 rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const balance = parseFloat(activeFund?.balance || "0");
  const pendingBalance = parseFloat(activeFund?.pendingBalance || "0");
  const totalGain = parseFloat(activeFund?.totalGain || "0");
  const gainPercent = parseFloat(activeFund?.gainPercent || "0");
  const invested = balance;
  const cash = pendingBalance;
  const totalValue = balance + pendingBalance;
  const isGain = totalGain >= 0;

  const yearsRemaining = (() => {
    if (activeFund?.recipientBirthdate) {
      const birth = new Date(activeFund.recipientBirthdate);
      const age18 = new Date(birth);
      age18.setFullYear(age18.getFullYear() + 18);
      const now = new Date();
      const years = Math.max(0, Math.ceil((age18.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
      return years;
    }
    return 15;
  })();

  const projectedValue = totalValue * Math.pow(1.10, yearsRemaining);

  const activeEvents = events.filter((e) => e.status === "active");

  const recentGifts = [...gifts]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const userInitial = user?.firstName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  const handleShareLink = async () => {
    const link = `${window.location.origin}/fund/${activeFund?.slug || activeFundId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      haptic("success");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      haptic("error");
    }
  };

  const handleInvestCash = async () => {
    if (!activeFundId || investingCash) return;
    setInvestingCash(true);
    haptic("medium");
    try {
      const res = await fetch(`/api/funds/${activeFundId}/auto-invest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        toast({ title: "Cash invested", description: `$${data.invested} invested across ${data.holdings.length} positions` });
        queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "holdings"] });
      } else {
        toast({ title: "Could not invest", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not invest", description: "Please try again", variant: "destructive" });
    } finally {
      setInvestingCash(false);
    }
  };

  const handleSellHolding = async () => {
    if (!sellingHolding || sellLoading) return;
    const shares = parseFloat(sellShares);
    const maxShares = parseFloat(sellingHolding.shares || "0");
    if (isNaN(shares) || shares <= 0 || shares > maxShares) {
      toast({ title: "Invalid amount", description: `Enter between 0 and ${maxShares.toFixed(4)} shares`, variant: "destructive" });
      return;
    }
    setSellLoading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/holdings/sell", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: sellingHolding.id,
          shares: shares,
          sellAll: shares >= maxShares,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        toast({ title: "Sold", description: `Sold ${shares.toFixed(4)} shares of ${sellingHolding.ticker} for ${formatCurrency(data.proceeds || 0)}` });
        setSellingHolding(null);
        setSellShares("");
        queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "holdings"] });
      } else {
        toast({ title: "Sale failed", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Sale failed", description: "Please try again", variant: "destructive" });
    } finally {
      setSellLoading(false);
    }
  };

  const isPageLoading = fundsLoading;

  return (
    <div className="min-h-screen gemini-warm-section md:ml-[220px] lg:ml-[260px] pb-24 md:pb-8">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/30 md:hidden">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" className="text-primary" />
          <button
            onClick={() => setLocation("/settings")}
            className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden"
            data-testid="avatar-user-initial"
          >
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              userInitial
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="relative">
          <div className="flex gap-2">
            {funds.length > 0 ? (
              <button
                onClick={() => { haptic("selection"); if (funds.length > 1) setFundPickerOpen(!fundPickerOpen); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-card rounded-xl border border-border/50 shadow-premium-sm flex-1 min-w-0"
                data-testid="button-fund-switcher"
              >
                <Wallet size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-left font-medium text-sm truncate">
                  {activeFund?.name || "Select fund"}
                </span>
                {funds.length > 1 && (
                  <ChevronDown size={16} className={`text-muted-foreground transition-transform flex-shrink-0 ${fundPickerOpen ? "rotate-180" : ""}`} />
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-card rounded-xl border border-border/50 shadow-premium-sm flex-1 min-w-0">
                <Wallet size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-left text-sm text-muted-foreground">No funds yet</span>
              </div>
            )}
            <button
              onClick={() => { setAddFundOpen(true); haptic("selection"); }}
              className="flex items-center justify-center w-10 h-10 bg-card rounded-xl border border-border/50 shadow-premium-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
              data-testid="button-add-fund"
            >
              <Plus size={18} />
            </button>
          </div>
          {fundPickerOpen && funds.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl border border-border/50 shadow-premium-sm z-50 overflow-hidden"
            >
              {funds.map((fund) => (
                <button
                  key={fund.id}
                  onClick={() => {
                    setSelectedFundId(fund.id);
                    setFundPickerOpen(false);
                    haptic("selection");
                  }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors ${
                    fund.id === activeFundId ? "bg-primary/5 font-semibold" : ""
                  }`}
                  data-testid={`button-select-fund-${fund.id}`}
                >
                  {fund.name}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {isPageLoading ? (
          <div className="space-y-4">
            <SkeletonBlock className="h-48 w-full" />
            <div className="flex gap-3">
              <SkeletonBlock className="h-10 flex-1" />
              <SkeletonBlock className="h-10 flex-1" />
              <SkeletonBlock className="h-10 flex-1" />
            </div>
          </div>
        ) : (
          <>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="relative bg-card rounded-2xl border border-border/50 shadow-premium-sm overflow-hidden gemini-soft-container">
                <GeminiBalanceGlow />
                <div className="relative z-10 p-6 sm:p-8">
                  <p className="text-sm text-muted-foreground mb-1">Total Value</p>
                  <h2
                    className="font-heading text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-3"
                    data-testid="text-total-balance"
                  >
                    {formatCurrency(totalValue)}
                  </h2>

                  {(totalGain !== 0 || gainPercent !== 0) && (
                    <div
                      className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${
                        isGain
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                      data-testid="text-gain-loss"
                    >
                      {isGain ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      {isGain ? "+" : ""}
                      {formatCurrency(totalGain)} ({gainPercent.toFixed(2)}%)
                    </div>
                  )}

                  <div className="flex items-center gap-4 sm:gap-6 mt-5 pt-5 border-t border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Invested</p>
                        <p className="text-sm font-semibold" data-testid="text-invested">{formatCurrency(invested)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cash</p>
                        <p className="text-sm font-semibold" data-testid="text-cash">{formatCurrency(cash)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className="text-sm font-semibold" data-testid="text-pending">{formatCurrency(pendingBalance)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {pendingBalance > 0 && activeFund?.status === "active" && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.04 }}
              >
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Cash ready to invest</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(pendingBalance)}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={investingCash}
                    onClick={handleInvestCash}
                    className="rounded-full gap-2"
                    data-testid="button-invest-cash"
                  >
                    {investingCash ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <TrendingUp size={15} />
                    )}
                    {investingCash ? "Investing..." : "Invest Now"}
                  </Button>
                </div>
              </motion.section>
            )}

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="flex gap-3"
            >
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full gap-2 h-10"
                onClick={handleShareLink}
                data-testid="button-share-link"
              >
                {copiedLink ? <Copy size={15} /> : <Share2 size={15} />}
                {copiedLink ? "Copied!" : "Share Link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full gap-2 h-10"
                onClick={() => {
                  haptic("selection");
                  if (isFamily) {
                    setLocation("/event/create");
                  } else {
                    setEventGateOpen(true);
                  }
                }}
                data-testid="button-create-event"
              >
                <Calendar size={15} />
                Create Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full gap-2 h-10"
                onClick={() => setLocation(`/memory/${activeFundId}`)}
                data-testid="button-memory-book"
              >
                <BookOpen size={15} />
                Memory Book
              </Button>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold mb-1" data-testid="text-growth-title">
                      Growth Projection
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-growth-projection">
                      At 10% average yearly return, this fund could be worth{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(projectedValue)}
                      </span>{" "}
                      {activeFund?.recipientBirthdate
                        ? `by age 18 (${yearsRemaining} years)`
                        : `in ${yearsRemaining} years`}
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            {activeFund?.status === "draft" && (
              <EducationTip title={educationContent.pendingCash.title} icon="tip" variant="inline">
                {educationContent.pendingCash.content}
              </EducationTip>
            )}

            {activeFund?.accountType === "UTMA" && !holdings.length && (
              <EducationTip title={educationContent.utma.title} icon="help" variant="expandable">
                {educationContent.utma.content}
              </EducationTip>
            )}

            {holdings.length > 0 && (
              <EducationTip title={educationContent.withdrawals.title} icon="tip" variant="expandable">
                {educationContent.withdrawals.content}
              </EducationTip>
            )}

            <div className="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.15 }}
              >
                <h3 className="font-heading text-lg font-semibold mb-3" data-testid="text-holdings-title">
                  Holdings
                </h3>
                {holdingsLoading ? (
                  <div className="space-y-3">
                    <SkeletonBlock className="h-16 w-full" />
                    <SkeletonBlock className="h-16 w-full" />
                  </div>
                ) : holdings.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-6 text-center">
                    <p className="text-sm text-muted-foreground" data-testid="text-no-holdings">
                      No investments yet. Share your fund link to start receiving gifts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {holdings.map((h) => {
                      const hValue = parseFloat(h.currentValue || "0");
                      const hGain = parseFloat(h.gain || "0");
                      const hShares = parseFloat(h.shares || "0");
                      const hIsGain = hGain >= 0;
                      return (
                        <div
                          key={h.id}
                          className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-4 flex items-center justify-between"
                          data-testid={`card-holding-${h.id}`}
                        >
                          <div>
                            <p className="font-semibold text-sm">{h.ticker}</p>
                            <p className="text-xs text-muted-foreground">{h.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hShares.toFixed(4)} shares
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatCurrency(hValue)}</p>
                              <p
                                className={`text-xs font-medium ${
                                  hIsGain ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {hIsGain ? "+" : ""}
                                {formatCurrency(hGain)}
                              </p>
                            </div>
                            {activeFund?.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setSellingHolding(h);
                                  setSellShares(hShares.toFixed(4));
                                }}
                                data-testid={`button-sell-${h.id}`}
                              >
                                Sell
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.2 }}
              >
                <h3 className="font-heading text-lg font-semibold mb-3" data-testid="text-gifts-title">
                  Recent Gifts
                </h3>
                {giftsLoading ? (
                  <div className="space-y-3">
                    <SkeletonBlock className="h-16 w-full" />
                    <SkeletonBlock className="h-16 w-full" />
                  </div>
                ) : recentGifts.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-6 text-center">
                    <img
                      src={mascotImg}
                      alt="Kora mascot"
                      className="w-16 h-16 mx-auto mb-3 object-contain"
                      data-testid="img-mascot-empty-gifts"
                    />
                    <p className="text-sm text-muted-foreground" data-testid="text-no-gifts">
                      Share your link to start receiving gifts!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentGifts.map((g) => {
                      const gAmount = parseFloat(g.amount || "0");
                      const messagePreview = g.message
                        ? g.message.length > 60
                          ? g.message.slice(0, 60) + "..."
                          : g.message
                        : null;
                      return (
                        <div
                          key={g.id}
                          className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-4 flex items-start gap-3"
                          data-testid={`card-gift-${g.id}`}
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Gift size={16} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-sm truncate">
                                {g.senderName || "Anonymous"}
                              </p>
                              <p className="text-sm font-semibold text-foreground shrink-0">
                                {formatCurrency(gAmount)}
                              </p>
                            </div>
                            {messagePreview && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {messagePreview}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(g.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.section>
            </div>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.25 }}
            >
              {eventsLoading ? (
                <SkeletonBlock className="h-20 w-full" />
              ) : (
                <div
                  className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-5 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setLocation("/events")}
                  data-testid="card-events-summary"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading text-base font-semibold">Events</h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-events-count">
                        You have {activeEvents.length} active event{activeEvents.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    data-testid="button-view-events"
                  >
                    View all
                  </Button>
                </div>
              )}
            </motion.section>
          </>
        )}
      </main>

      <AddFundSheet
        open={addFundOpen}
        onClose={() => setAddFundOpen(false)}
        onSuccess={(newFundId) => {
          if (newFundId) setSelectedFundId(newFundId);
        }}
      />

      <EventGateModal
        open={eventGateOpen}
        onClose={() => setEventGateOpen(false)}
      />

      {sellingHolding && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setSellingHolding(null); setSellShares(""); }}
          />
          <div className="relative bg-card rounded-t-3xl sm:rounded-2xl border border-border/50 shadow-premium-lg w-full sm:max-w-md p-6 z-10">
            <h3 className="font-heading text-lg font-semibold mb-1">Sell {sellingHolding.ticker}</h3>
            <p className="text-sm text-muted-foreground mb-4">{sellingHolding.name}</p>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current value</span>
                <span className="font-medium">{formatCurrency(parseFloat(sellingHolding.currentValue || "0"))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total shares</span>
                <span className="font-medium">{parseFloat(sellingHolding.shares || "0").toFixed(4)}</span>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Shares to sell</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max={sellingHolding.shares || "0"}
                  value={sellShares}
                  onChange={(e) => setSellShares(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-sell-shares"
                />
                <button
                  className="text-xs text-primary mt-1"
                  onClick={() => setSellShares(parseFloat(sellingHolding.shares || "0").toFixed(4))}
                  data-testid="button-sell-all"
                >
                  Sell all shares
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => { setSellingHolding(null); setSellShares(""); }}
                data-testid="button-cancel-sell"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={sellLoading || !sellShares || parseFloat(sellShares) <= 0}
                onClick={handleSellHolding}
                data-testid="button-confirm-sell"
              >
                {sellLoading ? "Selling..." : "Confirm Sale"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
