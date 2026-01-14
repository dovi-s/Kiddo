import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Plus, Gift, TrendingUp, CheckCircle, Send, Clock, ChevronRight, Filter } from "lucide-react";

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" />
          <Link href="/get-started">
            <button 
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
              data-testid="button-create"
            >
              <Plus size={20} />
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Activity</h1>
          <p className="text-muted-foreground mt-1">Recent updates across all funds</p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-6">
          {[
            { value: "all", label: "All" },
            { value: "gifts", label: "Gifts" },
            { value: "investments", label: "Investments" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value as typeof filter)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
                filter === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
              }`}
              data-testid={`filter-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Activity list */}
        <div className="space-y-3">
          {filteredActivity.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors duration-150"
              data-testid={`activity-${item.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {getActivityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeTime(item.date)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {item.fundName}
                    </span>
                    {item.status === "pending" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--kora-gold)/0.1)] text-[hsl(var(--kora-gold))] flex items-center gap-1">
                        <Clock size={10} />
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
              </div>
            </motion.div>
          ))}
        </div>

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
      <div className="h-20 md:hidden" />
    </div>
  );
}
