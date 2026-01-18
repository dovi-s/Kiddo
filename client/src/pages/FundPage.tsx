import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Share2, QrCode, Gift, TrendingUp, Users, Calendar, ChevronRight, Shield, Clock, Star, Copy, Check, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staggerContainer, fadeInUp, liftCard, bouncySpring, gentleSpring } from "@/lib/animations";
import { ContributorBubbles, LiveContributorTicker } from "@/components/ui/live-ticker";
import { AchievementBadge, getDefaultAchievements } from "@/components/ui/achievements";
import { haptic } from "@/lib/haptics";

interface Milestone {
  id: string;
  label: string;
  amount: number;
  achieved: boolean;
  icon: string;
}

interface Contributor {
  id: string;
  name: string;
  amount: number;
  date: string;
  message?: string;
}

export default function FundPage() {
  const params = useParams<{ slug: string }>();
  const fundSlug = params.slug || "mila";
  const [copiedLink, setCopiedLink] = useState(false);
  
  const fundsData: Record<string, { 
    recipientName: string; 
    createdBy: string; 
    accountType: string; 
    totalRaised: number; 
    invested: number;
    pending: number;
    contributors: number; 
    daysActive: number;
    milestones: Milestone[];
    recentContributors: Contributor[];
    events: { slug: string; title: string; description: string; raised: number; gifts: number; active: boolean; date?: string }[] 
  }> = {
    "mila": {
      recipientName: "Mila",
      createdBy: "Sarah",
      accountType: "UTMA",
      totalRaised: 4250,
      invested: 3890,
      pending: 360,
      contributors: 18,
      daysActive: 847,
      milestones: [
        { id: "1", label: "First Gift", amount: 1, achieved: true, icon: "🎁" },
        { id: "2", label: "$100 Raised", amount: 100, achieved: true, icon: "💯" },
        { id: "3", label: "$500 Raised", amount: 500, achieved: true, icon: "🌟" },
        { id: "4", label: "$1,000 Raised", amount: 1000, achieved: true, icon: "🚀" },
        { id: "5", label: "$5,000 Raised", amount: 5000, achieved: false, icon: "🎯" },
        { id: "6", label: "$10,000 Raised", amount: 10000, achieved: false, icon: "👑" },
      ],
      recentContributors: [
        { id: "1", name: "Grandma Rose", amount: 500, date: "2 days ago", message: "For your future, sweetheart! 💕" },
        { id: "2", name: "Uncle David", amount: 100, date: "1 week ago", message: "Happy 5th birthday!" },
        { id: "3", name: "Aunt Maria", amount: 75, date: "1 week ago" },
        { id: "4", name: "The Johnson Family", amount: 150, date: "2 weeks ago", message: "Wishing Mila all the best!" },
        { id: "5", name: "Sarah's Coworkers", amount: 285, date: "3 weeks ago" },
      ],
      events: [
        { slug: "anytime", title: "Give anytime", description: "Contribute to their future, no occasion needed", raised: 2180, gifts: 12, active: true },
        { slug: "5th-birthday", title: "5th Birthday", description: "December 15, 2025", raised: 1420, gifts: 8, active: true, date: "Dec 15" },
        { slug: "kindergarten-graduation", title: "Kindergarten Graduation", description: "May 2026", raised: 650, gifts: 4, active: false },
      ]
    },
    "emma": {
      recipientName: "Emma",
      createdBy: "Michael",
      accountType: "UTMA",
      totalRaised: 2800,
      invested: 2450,
      pending: 350,
      contributors: 12,
      daysActive: 412,
      milestones: [
        { id: "1", label: "First Gift", amount: 1, achieved: true, icon: "🎁" },
        { id: "2", label: "$100 Raised", amount: 100, achieved: true, icon: "💯" },
        { id: "3", label: "$500 Raised", amount: 500, achieved: true, icon: "🌟" },
        { id: "4", label: "$1,000 Raised", amount: 1000, achieved: true, icon: "🚀" },
        { id: "5", label: "$5,000 Raised", amount: 5000, achieved: false, icon: "🎯" },
      ],
      recentContributors: [
        { id: "1", name: "Grandpa Joe", amount: 200, date: "3 days ago" },
        { id: "2", name: "Family Friends", amount: 150, date: "1 week ago" },
      ],
      events: [
        { slug: "anytime", title: "Give anytime", description: "Contribute to their future, no occasion needed", raised: 1200, gifts: 6, active: true },
        { slug: "1st-birthday", title: "1st Birthday", description: "March 8, 2026", raised: 1600, gifts: 6, active: true },
      ]
    }
  };

  const fund = fundsData[fundSlug] || {
    recipientName: fundSlug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    createdBy: "Parent",
    accountType: "UTMA",
    totalRaised: 0,
    invested: 0,
    pending: 0,
    contributors: 0,
    daysActive: 0,
    milestones: [],
    recentContributors: [],
    events: [
      { slug: "anytime", title: "Give anytime", description: "Contribute to their future, no occasion needed", raised: 0, gifts: 0, active: true },
    ]
  };
  
  const recipientName = fund.recipientName;
  const fundUrl = `${window.location.origin}/${fundSlug}`;
  
  const projectedValue = Math.round(fund.totalRaised * 4.6);
  const nextMilestone = fund.milestones.find(m => !m.achieved);
  const progress = nextMilestone ? (fund.totalRaised / nextMilestone.amount) * 100 : 100;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(fundUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card pb-24 md:pb-0">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Top nav */}
          <header className="flex items-center justify-between h-14">
            <button 
              onClick={() => window.history.back()}
              data-testid="button-back"
              className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
            >
              ← Back
            </button>
            <motion.button 
              onClick={handleCopyLink}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
              data-testid="button-share-fund"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[hsl(var(--kora-evergreen-light))]" /> : <Share2 className="w-4 h-4" />}
              {copiedLink ? "Copied!" : "Share"}
            </motion.button>
          </header>
          
          {/* Hero content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="py-12 md:py-16 text-center"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, ...bouncySpring }}
              className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-primary-foreground/20 to-primary-foreground/5 backdrop-blur border border-primary-foreground/20 flex items-center justify-center text-4xl md:text-5xl font-light mx-auto mb-6"
            >
              {recipientName.charAt(0)}
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-light mb-2">
              {recipientName}'s Future Fund
            </h1>
            <p className="text-primary-foreground/60">
              Created by {fund.createdBy} • {fund.daysActive} days growing
            </p>
            
            {/* Stats row */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center gap-8 md:gap-12 mt-8"
            >
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-light">${fund.totalRaised.toLocaleString()}</p>
                <p className="text-sm text-primary-foreground/60 mt-1">total raised</p>
              </div>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-light text-[hsl(var(--kora-evergreen-light))]">${projectedValue.toLocaleString()}</p>
                <p className="text-sm text-primary-foreground/60 mt-1">in 18 years*</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 -mt-6">
        
        {/* Quick Actions Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl shadow-xl border border-border p-6 mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={`/${fundSlug}/anytime`} className="flex-1">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="w-full h-14 text-base rounded-xl bg-primary hover:bg-primary/90" data-testid="button-give-now">
                  <Gift className="w-5 h-5 mr-2" />
                  Give to {recipientName}
                </Button>
              </motion.div>
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={handleCopyLink} className="h-14 px-6 rounded-xl" data-testid="button-copy-link">
                {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Desktop two-column layout */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          
          {/* Left column - Main content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Milestone Progress */}
            {nextMilestone && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-2xl border border-border p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Next milestone</h2>
                  <span className="text-2xl">{nextMilestone.icon}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress to {nextMilestone.label}</span>
                    <span className="font-medium text-foreground">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ${(nextMilestone.amount - fund.totalRaised).toLocaleString()} to go
                  </p>
                </div>
                
                {/* Milestone timeline */}
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
                    {fund.milestones.slice(0, 5).map((milestone, i) => (
                      <motion.div
                        key={milestone.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex flex-col items-center min-w-[60px]"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          milestone.achieved 
                            ? 'bg-success/10' 
                            : 'bg-muted grayscale opacity-50'
                        }`}>
                          {milestone.icon}
                        </div>
                        <span className={`text-[10px] mt-1 text-center ${
                          milestone.achieved ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          ${milestone.amount >= 1000 ? `${milestone.amount / 1000}k` : milestone.amount}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Events */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <h2 className="font-semibold text-foreground mb-4">Choose an event</h2>
              {fund.events.filter(e => e.active).map((event, i) => (
                <motion.div
                  key={event.slug}
                  variants={fadeInUp}
                  custom={i}
                  whileHover={{ y: -2, boxShadow: "0 8px 30px -10px rgba(0,0,0,0.1)" }}
                  transition={gentleSpring}
                >
                  <Link href={`/${fundSlug}/${event.slug}`}>
                    <div 
                      className="p-5 bg-card border border-border rounded-xl cursor-pointer group"
                      data-testid={`event-${event.slug}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground group-hover:text-foreground/80 transition-colors">
                              {event.title}
                            </p>
                            {event.date && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--kora-gold))]/10 text-[hsl(var(--kora-gold))]">
                                {event.date}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-border group-hover:text-muted-foreground group-hover:translate-x-1 transition-all" />
                      </div>
                      <div className="mt-3 pt-3 border-t border-border flex gap-6 text-sm">
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">${event.raised.toLocaleString()}</span> raised
                        </span>
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">{event.gifts}</span> gifts
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            {/* Contributor Wall */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-card rounded-2xl border border-border p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-foreground">People who believe in {recipientName}</h2>
                <span className="text-sm text-muted-foreground">{fund.contributors} contributors</span>
              </div>
              
              <motion.div 
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {fund.recentContributors.map((contributor, i) => (
                  <motion.div
                    key={contributor.id}
                    variants={fadeInUp}
                    custom={i}
                    className="flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-border flex items-center justify-center text-sm font-medium text-muted-foreground flex-shrink-0">
                      {contributor.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-foreground truncate">{contributor.name}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{contributor.date}</span>
                      </div>
                      {contributor.message && (
                        <p className="text-sm text-muted-foreground mt-0.5">"{contributor.message}"</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              
              {fund.contributors > fund.recentContributors.length && (
                <p className="text-sm text-muted-foreground text-center mt-6 pt-4 border-t border-border">
                  + {fund.contributors - fund.recentContributors.length} more people
                </p>
              )}
            </motion.div>
          </div>

          {/* Right column - Sidebar */}
          <div className="hidden lg:block space-y-6">
            
            {/* Live Activity */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <LiveContributorTicker />
            </motion.div>

            {/* Achievement Badges */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-gradient-to-br from-muted to-card rounded-2xl border border-border p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Milestones</h3>
                <Trophy className="w-4 h-4 text-[hsl(var(--kora-gold))]" />
              </div>
              <div className="flex flex-wrap gap-2">
                {getDefaultAchievements(fund.totalRaised, fund.contributors, fund.daysActive).slice(0, 4).map((achievement) => (
                  <AchievementBadge key={achievement.id} achievement={achievement} size="sm" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {getDefaultAchievements(fund.totalRaised, fund.contributors, fund.daysActive).filter(a => a.unlocked).length} of 6 unlocked
              </p>
            </motion.div>
            
            {/* Fund Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-card rounded-2xl border border-border p-6"
            >
              <h3 className="font-semibold text-foreground mb-4">Fund details</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invested</span>
                  <span className="font-medium text-foreground">${fund.invested.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium text-[hsl(var(--kora-gold))]">${fund.pending.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account type</span>
                  <span className="font-medium text-foreground">{fund.accountType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days active</span>
                  <span className="font-medium text-foreground">{fund.daysActive}</span>
                </div>
              </div>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-muted rounded-2xl border border-border p-6"
            >
              <h3 className="font-semibold text-foreground mb-4">Protected & secure</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">SIPC Protected</p>
                    <p className="text-muted-foreground">Up to $500,000 in coverage</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">100% Invested</p>
                    <p className="text-muted-foreground">Every gift grows over time</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Long-term Focus</p>
                    <p className="text-muted-foreground">Built for 18+ year horizons</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 pt-8 border-t border-border text-center"
        >
          <p className="text-xs text-muted-foreground">
            *Projected value assumes 7% annual returns. Past performance doesn't guarantee future results.<br />
            Brokerage services by Alpaca Securities LLC, Member FINRA/SIPC.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
