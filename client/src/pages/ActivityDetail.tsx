import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, TrendingUp, Clock, Check, Share2, MessageCircle, Calendar, DollarSign, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/layout/PageTransition";
import { Nav } from "@/components/layout/Nav";
import { haptic } from "@/lib/haptics";

const ACTIVITY_DATA: Record<string, {
  id: string;
  type: "gift" | "investment" | "milestone";
  title: string;
  description: string;
  amount?: number;
  from?: string;
  fundName: string;
  status: "pending" | "invested" | "completed";
  date: Date;
  message?: string;
  investedIn?: { ticker: string; name: string; shares: string }[];
}> = {
  "1": {
    id: "1",
    type: "gift",
    title: "Gift received",
    description: "Sarah Johnson sent $100",
    amount: 100,
    from: "Sarah Johnson",
    fundName: "Mila",
    status: "invested",
    date: new Date(Date.now() - 30 * 60 * 1000),
    message: "Happy birthday sweetheart! Can't wait to watch this grow with you. Love, Aunt Sarah 💕",
    investedIn: [
      { ticker: "VTI", name: "Vanguard Total Stock Market", shares: "0.42" },
      { ticker: "VXUS", name: "Vanguard Total International", shares: "0.18" }
    ]
  },
  "2": {
    id: "2",
    type: "investment",
    title: "Investment completed",
    description: "$250 invested in Growth Portfolio",
    amount: 250,
    fundName: "Mila",
    status: "completed",
    date: new Date(Date.now() - 2 * 60 * 60 * 1000),
    investedIn: [
      { ticker: "VTI", name: "Vanguard Total Stock Market", shares: "1.05" },
      { ticker: "VXUS", name: "Vanguard Total International", shares: "0.45" }
    ]
  },
  "3": {
    id: "3",
    type: "gift",
    title: "Gift received",
    description: "Michael Chen sent $50",
    amount: 50,
    from: "Michael Chen",
    fundName: "Mila",
    status: "pending",
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    message: "A little something for her future!"
  },
  "4": {
    id: "4",
    type: "milestone",
    title: "Milestone reached",
    description: "First $500 invested",
    fundName: "Mila",
    status: "completed",
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  "5": {
    id: "5",
    type: "gift",
    title: "Gift received",
    description: "Grandma Rose sent $200",
    amount: 200,
    from: "Grandma Rose",
    fundName: "Mila",
    status: "invested",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    message: "For my little sunshine. May this help you reach all your dreams. 🌻",
    investedIn: [
      { ticker: "VTI", name: "Vanguard Total Stock Market", shares: "0.84" }
    ]
  }
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  const activity = ACTIVITY_DATA[id || "1"];
  
  if (!activity) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <Nav />
          <main className="max-w-lg mx-auto px-4 py-12 text-center">
            <p className="text-muted-foreground">Activity not found</p>
            <Link href="/activity">
              <Button variant="outline" className="mt-4">Back to Activity</Button>
            </Link>
          </main>
        </div>
      </PageTransition>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return { 
          bg: "bg-[hsl(var(--kora-gold)/0.15)]", 
          text: "text-[hsl(var(--kora-gold))]",
          icon: Clock,
          label: "Pending"
        };
      case "invested":
        return { 
          bg: "bg-[hsl(var(--kora-evergreen)/0.15)]", 
          text: "text-[hsl(var(--kora-evergreen))]",
          icon: TrendingUp,
          label: "Invested"
        };
      default:
        return { 
          bg: "bg-success/15", 
          text: "text-success",
          icon: Check,
          label: "Completed"
        };
    }
  };

  const statusConfig = getStatusConfig(activity.status);
  const StatusIcon = statusConfig.icon;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Nav />
        
        <main className="max-w-lg mx-auto px-4 py-6">
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
                <div className={`w-14 h-14 rounded-2xl ${activity.type === "gift" ? "bg-[hsl(var(--kora-gold)/0.15)]" : activity.type === "milestone" ? "bg-purple-100" : "bg-[hsl(var(--kora-evergreen)/0.15)]"} flex items-center justify-center`}>
                  {activity.type === "gift" && <Gift size={24} className="text-[hsl(var(--kora-gold))]" />}
                  {activity.type === "investment" && <TrendingUp size={24} className="text-[hsl(var(--kora-evergreen))]" />}
                  {activity.type === "milestone" && <Sparkles size={24} className="text-purple-600" />}
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-semibold text-foreground">{activity.title}</h1>
                  <p className="text-muted-foreground mt-1">{activity.description}</p>
                </div>
              </div>

              {activity.amount && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-center py-6 border-y border-border"
                >
                  <p className="text-4xl font-bold text-foreground">${activity.amount}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text} flex items-center gap-1.5`}>
                      <StatusIcon size={14} />
                      {statusConfig.label}
                    </span>
                  </div>
                </motion.div>
              )}

              <div className="space-y-4 mt-6">
                {activity.from && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User size={18} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">From</p>
                      <p className="font-medium text-foreground">{activity.from}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <DollarSign size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fund</p>
                    <p className="font-medium text-foreground">{activity.fundName}'s Future Fund</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Calendar size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium text-foreground">{formatDate(activity.date)}</p>
                  </div>
                </div>
              </div>
            </div>

            {activity.message && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-[hsl(var(--kora-gold)/0.08)] border border-[hsl(var(--kora-gold)/0.2)] rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle size={16} className="text-[hsl(var(--kora-gold))]" />
                  <p className="text-sm font-medium text-[hsl(var(--kora-gold))]">Gift message</p>
                </div>
                <p className="text-foreground leading-relaxed">"{activity.message}"</p>
              </motion.div>
            )}

            {activity.investedIn && activity.investedIn.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-border rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-[hsl(var(--kora-evergreen))]" />
                  <p className="font-medium text-foreground">Invested in</p>
                </div>
                <div className="space-y-3">
                  {activity.investedIn.map((holding, i) => (
                    <motion.div
                      key={holding.ticker}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground border border-border">
                          {holding.ticker}
                        </span>
                        <span className="text-sm text-foreground">{holding.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{holding.shares} shares</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activity.type === "gift" && activity.status === "invested" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl"
                  onClick={() => {
                    navigator.share?.({
                      title: `${activity.from} gifted to ${activity.fundName}'s Future Fund!`,
                      text: `${activity.from} just sent $${activity.amount} to grow ${activity.fundName}'s future.`
                    }).catch(() => {});
                  }}
                  data-testid="button-share-gift"
                >
                  <Share2 size={18} className="mr-2" />
                  Share this gift
                </Button>
              </motion.div>
            )}

            {activity.status === "pending" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center py-4"
              >
                <p className="text-sm text-muted-foreground">
                  This gift will be invested at the next market open (9:30 AM ET)
                </p>
              </motion.div>
            )}
          </motion.div>
        </main>

        <div className="h-24 md:hidden" />
      </div>
    </PageTransition>
  );
}
