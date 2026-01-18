import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Plus, Gift, TrendingUp, CheckCircle, Send, Clock, ChevronDown, Filter, Calendar, MessageCircle, DollarSign } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import { springSnappy, easeOutExpo, cardTactile } from "@/lib/animations";

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

const sampleActivity: ActivityItem[] = [
  {
    id: "1",
    type: "gift_received",
    title: "Gift received",
    description: "Sarah Johnson sent $100",
    amount: 100,
    date: new Date(Date.now() - 1000 * 60 * 30),
    fundName: "Mila",
    status: "completed",
    senderName: "Sarah Johnson",
    message: "Happy birthday Mila! Can't wait to watch this grow with you.",
    eventName: "5th Birthday",
    holdings: [{ ticker: "VTI", shares: "0.37" }, { ticker: "VXUS", shares: "0.12" }]
  },
  {
    id: "2",
    type: "investment_placed",
    title: "Investment placed",
    description: "Bought 0.37 shares of VTI",
    amount: 100,
    date: new Date(Date.now() - 1000 * 60 * 60 * 2),
    fundName: "Mila",
    status: "completed",
    holdings: [{ ticker: "VTI", shares: "0.37" }]
  },
  {
    id: "3",
    type: "thank_you_sent",
    title: "Thank you sent",
    description: "To Sarah Johnson",
    date: new Date(Date.now() - 1000 * 60 * 60 * 3),
    fundName: "Mila",
    status: "completed",
    senderName: "Sarah Johnson"
  },
  {
    id: "4",
    type: "gift_received",
    title: "Gift received",
    description: "Mike Chen sent $50",
    amount: 50,
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
    fundName: "Noah",
    status: "pending",
    senderName: "Mike Chen",
    message: "For Noah's future!",
    eventName: "Baby Shower"
  },
  {
    id: "5",
    type: "verification",
    title: "Verification approved",
    description: "Account is now active",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    fundName: "All funds",
    status: "completed"
  },
];

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
  const [filter, setFilter] = useState<"all" | "gifts" | "investments">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredActivity = sampleActivity.filter(item => {
    if (filter === "all") return true;
    if (filter === "gifts") return item.type === "gift_received";
    if (filter === "investments") return item.type === "investment_placed";
    return true;
  });

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
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <Logo size="sm" className="text-primary" />
            <Link href="/get-started">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20"
                data-testid="button-create"
              >
                <Plus size={20} />
              </motion.button>
            </Link>
          </div>
        </motion.header>

        <main className="max-w-lg mx-auto px-4 py-6 momentum-scroll">
          {/* Title */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.25, ease: easeOutExpo }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-2">Activity</h1>
            <p className="text-muted-foreground">Recent updates across all funds</p>
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
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.04, delayChildren: 0.02 }
            }
          }}
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
                className={`bg-card border rounded-2xl overflow-hidden cursor-pointer touch-target ${isExpanded ? "border-[hsl(var(--kora-evergreen)/0.3)] shadow-lg" : "border-border"}`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
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
      </div>
    </PageTransition>
  );
}
