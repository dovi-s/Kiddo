import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Gift, TrendingUp, Calendar, Check, Clock, ArrowUp, ChevronDown, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { EnlighteningReveal } from "@/components/ui/gemini";
import { formatDistanceToNow } from "date-fns";
import { useActivities } from "@/hooks/use-activities";
import type { Activity as ActivityType } from "@shared/schema";

type FilterType = "all" | "gifts" | "investments" | "events";

const filterOptions: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "gifts", label: "Gifts" },
  { value: "investments", label: "Investments" },
  { value: "events", label: "Events" },
];

const GIFT_TYPES = ["gift_received"];
const INVESTMENT_TYPES = ["auto_invest", "sell", "withdrawal", "bank_linked"];
const EVENT_TYPES = ["event_pass_purchased", "subscription_started", "subscription_canceled", "payment_failed", "kyc_approved"];

function mapActivityTypeToCategory(type: string): "gift" | "investment" | "event" {
  if (GIFT_TYPES.includes(type)) return "gift";
  if (INVESTMENT_TYPES.includes(type)) return "investment";
  return "event";
}

function getTypeIcon(type: string) {
  const category = mapActivityTypeToCategory(type);
  switch (category) {
    case "gift":
      return <Gift size={18} className="text-[hsl(var(--kora-gold))]" />;
    case "investment":
      return <TrendingUp size={18} className="text-primary" />;
    case "event":
      return <Calendar size={18} className="text-blue-500" />;
  }
}

function getStatusBadge(status?: string) {
  if (!status) return null;
  switch (status) {
    case "pending":
      return (
        <span
          data-testid="badge-status-pending"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 font-medium"
        >
          <Clock size={10} />
          Pending
        </span>
      );
    case "invested":
      return (
        <span
          data-testid="badge-status-invested"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 font-medium"
        >
          <ArrowUp size={10} />
          Invested
        </span>
      );
    case "settled":
      return (
        <span
          data-testid="badge-status-settled"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium"
        >
          <Check size={10} />
          Settled
        </span>
      );
    default:
      return null;
  }
}

function groupByDate(items: ActivityType[]): { label: string; items: ActivityType[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, ActivityType[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Earlier: [],
  };

  items.forEach((item) => {
    const d = new Date(item.createdAt!);
    if (d >= today) {
      groups["Today"].push(item);
    } else if (d >= yesterday) {
      groups["Yesterday"].push(item);
    } else if (d >= weekAgo) {
      groups["This Week"].push(item);
    } else {
      groups["Earlier"].push(item);
    }
  });

  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function SkeletonCard() {
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default function Activity() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: activities = [], isLoading: feedLoading } = useActivities();

  if (!authLoading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background md:ml-[220px] lg:ml-[260px]">
        <div className="max-w-lg md:max-w-3xl mx-auto px-4 py-6 space-y-4">
          <div className="h-8 bg-muted rounded w-32 animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
            ))}
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const filtered = activities.filter((item) => {
    if (filter === "all") return true;
    const category = mapActivityTypeToCategory(item.type);
    if (filter === "gifts") return category === "gift";
    if (filter === "investments") return category === "investment";
    if (filter === "events") return category === "event";
    return true;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="min-h-screen bg-background md:ml-[220px] lg:ml-[260px]">
      <div className="md:hidden sticky top-0 z-40 h-14 flex items-center px-4 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <Link href="/dashboard">
          <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-dashboard">
            <ChevronLeft size={20} />
            <span className="text-sm">Fund</span>
          </button>
        </Link>
        <div className="flex-1" />
        <Logo size="sm" className="text-foreground" linkTo="/dashboard" />
      </div>
      <div className="max-w-lg md:max-w-3xl mx-auto px-4 py-6">
        <EnlighteningReveal>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4" data-testid="heading-activity">
            Activity
          </h1>
        </EnlighteningReveal>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" data-testid="filter-pills">
          {filterOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? "default" : "outline"}
              size="sm"
              className={`rounded-full text-sm whitespace-nowrap ${
                filter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                haptic("selection");
                setFilter(opt.value);
              }}
              data-testid={`filter-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {feedLoading && (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!feedLoading && filtered.length === 0 && (
          <EnlighteningReveal>
            <div className="text-center py-16" data-testid="empty-state">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Gift size={24} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-base">
                No activity yet. Once you start receiving gifts, you'll see everything here.
              </p>
            </div>
          </EnlighteningReveal>
        )}

        {!feedLoading &&
          grouped.map((group) => (
            <div key={group.label} className="mb-6">
              <EnlighteningReveal>
                <h2
                  className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3"
                  data-testid={`group-label-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {group.label}
                </h2>
              </EnlighteningReveal>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {group.items.map((item) => {
                    const isExpanded = expandedId === item.id;
                    const timestamp = formatDistanceToNow(new Date(item.createdAt!), { addSuffix: true });

                    return (
                      <EnlighteningReveal key={item.id}>
                        <motion.div
                          layout
                          className="bg-card rounded-2xl border border-border/50 shadow-premium-sm overflow-hidden"
                          data-testid={`activity-card-${item.id}`}
                        >
                          <button
                            className="w-full text-left p-4 flex items-start gap-3 cursor-pointer"
                            onClick={() => {
                              haptic("selection");
                              setExpandedId(isExpanded ? null : item.id);
                            }}
                            data-testid={`button-expand-${item.id}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                              {getTypeIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-foreground truncate" data-testid={`text-title-${item.id}`}>
                                  {item.title}
                                </p>
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                                </motion.div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-timestamp-${item.id}`}>
                                {timestamp}
                              </p>
                            </div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="px-4 pb-4 pt-0 border-t border-border/50 space-y-3"
                                  data-testid={`detail-view-${item.id}`}
                                >
                                  <div className="pt-3">
                                    {item.description && (
                                      <p className="text-sm text-muted-foreground">{item.description}</p>
                                    )}
                                    {item.amount != null && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Amount:</span>
                                        <span className="text-sm font-semibold text-foreground">
                                          ${parseFloat(item.amount).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-3">
                                      {new Date(item.createdAt!).toLocaleDateString("en-US", {
                                        weekday: "long",
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                      })}{" "}
                                      at{" "}
                                      {new Date(item.createdAt!).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </EnlighteningReveal>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}

        <div className="h-24 md:hidden" />
      </div>
    </div>
  );
}
