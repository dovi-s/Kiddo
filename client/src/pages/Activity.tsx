import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Plus, Gift, TrendingUp, CheckCircle, Send, Clock, ChevronRight, Filter } from "lucide-react";
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
    status: "completed"
  },
  {
    id: "2",
    type: "investment_placed",
    title: "Investment placed",
    description: "Bought 0.37 shares of VTI",
    amount: 100,
    date: new Date(Date.now() - 1000 * 60 * 60 * 2),
    fundName: "Mila",
    status: "completed"
  },
  {
    id: "3",
    type: "thank_you_sent",
    title: "Thank you sent",
    description: "To Sarah Johnson",
    date: new Date(Date.now() - 1000 * 60 * 60 * 3),
    fundName: "Mila",
    status: "completed"
  },
  {
    id: "4",
    type: "gift_received",
    title: "Gift received",
    description: "Mike Chen sent $50",
    amount: 50,
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
    fundName: "Noah",
    status: "pending"
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
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <Logo size="md" />
            <Link href="/get-started">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20"
                data-testid="button-create"
              >
                <Plus size={22} />
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
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Activity</h1>
            <p className="text-muted-foreground mt-2 text-base">Recent updates across all funds</p>
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
          {filteredActivity.map((item) => (
            <motion.div
              key={item.id}
              variants={{
                hidden: { opacity: 0, y: 16, scale: 0.97 },
                visible: { opacity: 1, y: 0, scale: 1 }
              }}
              whileHover={{ y: -3, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-card border border-border rounded-2xl p-5 cursor-pointer touch-target swipe-hint"
              data-testid={`activity-${item.id}`}
            >
              <div className="flex items-start gap-4">
                <motion.div 
                  className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center shrink-0"
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  {getActivityIcon(item.type)}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-foreground">{item.title}</p>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formatRelativeTime(item.date)}
                    </span>
                  </div>
                  <p className="text-base text-muted-foreground mt-1">{item.description}</p>
                  <div className="flex items-center gap-2.5 mt-3">
                    <span className="text-sm px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                      {item.fundName}
                    </span>
                    {item.status === "pending" && (
                      <motion.span 
                        className="text-sm px-3 py-1 rounded-full bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))] flex items-center gap-1.5 font-medium"
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <Clock size={12} />
                        Pending
                      </motion.span>
                    )}
                  </div>
                </div>
                <motion.div
                  className="shrink-0 mt-2"
                  whileTap={{ x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronRight size={20} className="text-muted-foreground" />
                </motion.div>
              </div>
            </motion.div>
          ))}
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
