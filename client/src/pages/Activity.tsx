import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Gift, TrendingUp, CheckCircle, Send, Clock, ChevronDown, Calendar, MessageCircle, DollarSign, Check } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { springSnappy, easeOutExpo, cardTactile, staggerPremium, listItemSpring } from "@/lib/animations";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";
import { useActivities } from "@/hooks/use-activities";
import { useFunds } from "@/hooks/use-funds";
import { ThinkingOrb } from "@/components/ui/gemini";

type ActivityItem = {
  id: string;
  type: "gift_received" | "investment_placed" | "thank_you_sent" | "verification";
  title: string;
  description: string;
  amount?: number;
  date: Date;
  fundName: string;
  status: "completed" | "pending";
  senderName?: string;
  message?: string;
  eventName?: string;
  holdings?: { ticker: string; shares: string }[];
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getActivityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "gift_received":
      return <Gift size={18} className="text-success" />;
    case "investment_placed":
      return <TrendingUp size={18} className="text-primary" />;
    case "thank_you_sent":
      return <Send size={18} className="text-[hsl(var(--kora-gold))]" />;
    case "verification":
      return <CheckCircle size={18} className="text-success" />;
  }
}

export default function Activity() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: apiFunds = [], isLoading: fundsLoading } = useFunds();
  const { data: apiActivities = [], isLoading: activitiesLoading } = useActivities();
  
  const [filter, setFilter] = useState<"all" | "gifts" | "investments">("all");
  const [selectedFundSlug, setSelectedFundSlug] = useState("");
  const [showFundPicker, setShowFundPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (apiFunds.length > 0 && !selectedFundSlug) {
      setSelectedFundSlug(apiFunds[0].slug);
    }
  }, [apiFunds, selectedFundSlug]);

  const funds = apiFunds.map(f => ({
    slug: f.slug,
    name: f.name,
    accountType: f.accountType,
  }));

  const selectedFund = funds.find(f => f.slug === selectedFundSlug) || funds[0];

  const activities: ActivityItem[] = apiActivities.map(a => ({
    id: a.id,
    type: (a.type as ActivityItem["type"]) || "gift_received",
    title: a.title,
    description: a.description || "",
    amount: a.amount ? parseFloat(a.amount) : undefined,
    date: new Date(a.createdAt || Date.now()),
    fundName: selectedFund?.name || "Fund",
    status: "completed" as const,
  }));

  const filteredActivity = activities.filter(item => {
    if (filter === "all") return true;
    if (filter === "gifts") return item.type === "gift_received";
    if (filter === "investments") return item.type === "investment_placed";
    return true;
  });

  if (authLoading || fundsLoading || activitiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ThinkingOrb size={40} variant="default" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <motion.header 
          className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: easeOutExpo }}
        >
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            <Logo size="sm" className="text-primary" />
          </div>
        </motion.header>

        <main className="max-w-lg mx-auto px-4 py-6 momentum-scroll">
          {/* Title */}
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.25, ease: easeOutExpo }}
          >
            {funds.length > 1 ? (
              <motion.button
                onClick={() => { haptic('selection'); setShowFundPicker(true); }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 mb-2"
                data-testid="button-fund-context"
              >
                <h1 className="text-2xl font-bold text-foreground">{selectedFund.name}'s Activity</h1>
                <ChevronDown size={20} className="text-muted-foreground" />
              </motion.button>
            ) : (
              <h1 className="text-2xl font-bold text-foreground mb-2">Activity</h1>
            )}
            <p className="text-muted-foreground">Recent updates and transactions</p>
          </motion.div>

        {/* Filter chips - larger touch targets */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 -mx-4 px-4">
          {[
            { value: "all", label: "All" },
            { value: "gifts", label: "Gifts" },
            { value: "investments", label: "Investments" },
          ].map((option) => (
            <motion.button
              key={option.value}
              onClick={() => setFilter(option.value as typeof filter)}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`px-6 py-3 rounded-2xl text-base font-semibold transition-colors duration-150 touch-target whitespace-nowrap ${
                filter === option.value
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid={`filter-${option.value}`}
            >
              {option.label}
            </motion.button>
          ))}
        </div>

        {/* Activity list */}
        <motion.div 
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={staggerPremium}
        >
          {filteredActivity.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <motion.div
                key={item.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 16, scale: 0.97 },
                  visible: { opacity: 1, y: 0, scale: 1 }
                }}
                transition={{ duration: 0.2, ease: "easeOut", layout: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } }}
                className={`bg-card border rounded-2xl overflow-hidden cursor-pointer touch-target shadow-premium-sm hover:shadow-premium transition-all duration-150 ${isExpanded ? "border-primary/20 shadow-premium-lg" : "border-border/50"}`}
                onClick={() => { haptic('selection'); setExpandedId(isExpanded ? null : item.id); }}
                data-testid={`activity-${item.id}`}
              >
                <motion.div 
                  className="p-5"
                  whileTap={{ scale: isExpanded ? 1 : 0.98 }}
                >
                  <div className="flex items-start gap-4">
                    <motion.div 
                      layout="position"
                      className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0"
                    >
                      {getActivityIcon(item.type)}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground shrink-0">
                            {formatRelativeTime(item.date)}
                          </span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={18} className="text-muted-foreground" />
                          </motion.div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                          {item.fundName}
                        </span>
                        {item.status === "pending" && (
                          <motion.span 
                            className="text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))] flex items-center gap-1.5 font-medium"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Clock size={10} />
                            Pending
                          </motion.span>
                        )}
                        {item.status === "completed" && item.type === "gift_received" && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">
                            Invested
                          </span>
                        )}
                      </div>
                    </div>
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
                        <div className="pt-4 grid grid-cols-2 gap-3">
                          {item.amount && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.05 }}
                              className="flex items-center gap-2.5"
                            >
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                <DollarSign size={14} className="text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Amount</p>
                                <p className="text-sm font-semibold text-foreground">${item.amount}</p>
                              </div>
                            </motion.div>
                          )}
                          {item.eventName && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                              className="flex items-center gap-2.5"
                            >
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                <Calendar size={14} className="text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Event</p>
                                <p className="text-sm font-medium text-foreground">{item.eventName}</p>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        {item.message && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-[hsl(var(--kora-gold)/0.08)] rounded-xl p-4"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle size={14} className="text-[hsl(var(--kora-gold))]" />
                              <p className="text-xs font-medium text-[hsl(var(--kora-gold))]">Message from {item.senderName}</p>
                            </div>
                            <p className="text-sm text-foreground">"{item.message}"</p>
                          </motion.div>
                        )}

                        {item.holdings && item.holdings.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-[hsl(var(--kora-evergreen)/0.08)] rounded-xl p-4"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp size={14} className="text-[hsl(var(--kora-evergreen))]" />
                              <p className="text-xs font-medium text-[hsl(var(--kora-evergreen))]">
                                {item.type === "investment_placed" ? "Holdings purchased" : "Invested in"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {item.holdings.map((h, idx) => (
                                <span key={idx} className="text-xs px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-medium">
                                  {h.ticker} <span className="text-muted-foreground font-normal">({h.shares} shares)</span>
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {item.status === "pending" && (
                          <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.25 }}
                            className="text-xs text-muted-foreground text-center pt-2"
                          >
                            Invests at next market open (9:30 AM ET)
                          </motion.p>
                        )}

                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="text-xs text-muted-foreground text-center"
                        >
                          {item.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at {item.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </motion.p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        {filteredActivity.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Gift size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No activity yet</p>
          </div>
        )}
      </main>

        {/* Spacer for mobile nav */}
        <div className="h-24 md:hidden" />

        {/* Fund Picker Sheet */}
        <Sheet open={showFundPicker} onOpenChange={setShowFundPicker}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader className="text-left mb-4">
              <SheetTitle className="text-lg font-semibold">Select fund</SheetTitle>
            </SheetHeader>
            
            <div className="space-y-2 pb-4">
              {funds.map((fund) => (
                <motion.button
                  key={fund.slug}
                  onClick={() => {
                    haptic('selection');
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
                  </div>
                  {fund.slug === selectedFundSlug && (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--kora-evergreen))] flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </PageTransition>
  );
}
