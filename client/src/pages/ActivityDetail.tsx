import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, TrendingUp, Clock, Check, Share2, MessageCircle, Calendar, DollarSign, User, Sparkles, AlertCircle, ShieldCheck, Banknote, CreditCard, PartyPopper, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/layout/PageTransition";
import { Nav } from "@/components/layout/Nav";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@shared/schema";

type ActivityWithFund = Activity & { fundName: string | null; recipientFirstName: string | null };

async function fetchActivity(id: string): Promise<ActivityWithFund> {
  const response = await fetch(`/api/activities/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function normalizeType(type?: string | null): string {
  return (type || "event_update").toString();
}

function formatAmount(amount?: string | number | null): string | null {
  if (amount == null) return null;
  const parsed = typeof amount === "number" ? amount : Number.parseFloat(String(amount));
  if (!Number.isFinite(parsed)) return null;
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTypeConfig(type: string) {
  switch (type) {
    case "gift_received":
      return { icon: Gift, bg: "bg-[hsl(var(--kora-gold)/0.15)]", color: "text-[hsl(var(--kora-gold))]", label: "Gift Received" };
    case "auto_invest":
      return { icon: TrendingUp, bg: "bg-[hsl(var(--kora-evergreen)/0.15)]", color: "text-[hsl(var(--kora-evergreen))]", label: "Investment" };
    case "kyc_approved":
      return { icon: ShieldCheck, bg: "bg-green-100", color: "text-green-600", label: "Identity Verified" };
    case "sell":
      return { icon: Banknote, bg: "bg-orange-100", color: "text-orange-600", label: "Sold" };
    case "withdrawal":
      return { icon: DollarSign, bg: "bg-blue-100", color: "text-blue-600", label: "Withdrawal" };
    case "bank_linked":
      return { icon: CreditCard, bg: "bg-indigo-100", color: "text-indigo-600", label: "Bank Linked" };
    case "subscription_started":
      return { icon: Sparkles, bg: "bg-purple-100", color: "text-purple-600", label: "Subscription Started" };
    case "event_pass_purchased":
      return { icon: PartyPopper, bg: "bg-pink-100", color: "text-pink-600", label: "Premium Event Coverage" };
    case "subscription_canceled":
      return { icon: XCircle, bg: "bg-red-100", color: "text-red-500", label: "Subscription Canceled" };
    case "payment_failed":
      return { icon: AlertCircle, bg: "bg-red-100", color: "text-red-500", label: "Payment Failed" };
    default:
      return { icon: Clock, bg: "bg-muted", color: "text-muted-foreground", label: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) };
  }
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: activity, isLoading, error } = useQuery<ActivityWithFund>({
    queryKey: ["/api/activities", id],
    queryFn: () => fetchActivity(id!),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <Nav />
          <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-6">
            <div className="space-y-6">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          </main>
        </div>
      </PageTransition>
    );
  }

  if (error || !activity) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <Nav />
          <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-12 text-center">
            <p className="text-muted-foreground" data-testid="text-activity-not-found">Activity not found</p>
            <Link href="/activity">
              <Button variant="outline" className="mt-4" data-testid="button-back-to-activity">Back to Activity</Button>
            </Link>
          </main>
        </div>
      </PageTransition>
    );
  }

  const normalizedType = normalizeType(activity.type);
  const typeConfig = getTypeConfig(normalizedType);
  const TypeIcon = typeConfig.icon;
  const fundDisplayName = activity.fundName || capFirst(activity.recipientFirstName) || "Fund";
  const amountLabel = formatAmount(activity.amount as any);
  const metadataLabel =
    typeof activity.metadata === "string"
      ? activity.metadata
      : activity.metadata
        ? JSON.stringify(activity.metadata)
        : "";

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Nav />
        
        <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-6">
          <motion.button
            onClick={() => { haptic('light'); setLocation("/activity"); }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-muted-foreground mb-6 touch-target transition-all duration-150 active:scale-95"
            data-testid="button-back"
          >
            <ArrowLeft size={20} />
            <span>Activity</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-premium-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl ${typeConfig.bg} flex items-center justify-center`}>
                  <TypeIcon size={24} className={typeConfig.color} />
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-semibold text-foreground" data-testid="text-activity-title">{activity.title || "Fund update"}</h1>
                  <p className="text-muted-foreground mt-1" data-testid="text-activity-description">{activity.description || "No additional details."}</p>
                </div>
              </div>

              {amountLabel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.040 }}
                  className="text-center py-6 border-y border-border"
                >
                  <p className="font-serif text-4xl font-bold text-foreground" data-testid="text-activity-amount">
                    ${amountLabel}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeConfig.bg} ${typeConfig.color} flex items-center gap-1.5`}>
                      <TypeIcon size={14} />
                      {typeConfig.label}
                    </span>
                  </div>
                </motion.div>
              )}

              <div className="space-y-4 mt-6">
                {activity.fundId && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <DollarSign size={18} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fund</p>
                      <p className="font-medium text-foreground" data-testid="text-activity-fund">{fundDisplayName}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Calendar size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium text-foreground" data-testid="text-activity-date">{formatDate(activity.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <TypeIcon size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium text-foreground" data-testid="text-activity-type">{typeConfig.label}</p>
                  </div>
                </div>
              </div>
            </div>

            {metadataLabel && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.060 }}
                className="bg-[hsl(var(--kora-gold)/0.08)] border border-[hsl(var(--kora-gold)/0.2)] rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle size={16} className="text-[hsl(var(--kora-gold-ink))]" />
                  <p className="text-sm font-medium text-[hsl(var(--kora-gold-ink))]">Details</p>
                </div>
                <p className="text-foreground leading-relaxed" data-testid="text-activity-metadata">{metadataLabel}</p>
              </motion.div>
            )}

            {normalizedType === "gift_received" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.120 }}
              >
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl"
                  onClick={() => {
                    navigator.share?.({
                      title: `Gift received for ${fundDisplayName}!`,
                      text: activity.description || `A gift was received for ${fundDisplayName}.`
                    }).catch(() => {});
                  }}
                  data-testid="button-share-gift"
                >
                  <Share2 size={18} className="mr-2" />
                  Share this gift
                </Button>
              </motion.div>
            )}
          </motion.div>
        </main>

        <div className="h-24 md:hidden" />
      </div>
    </PageTransition>
  );
}
