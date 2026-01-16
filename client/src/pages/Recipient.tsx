import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "wouter";
import { useState, useEffect } from "react";
import { TrendingUp, Heart, Flame, Calendar, Trophy, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";

function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1000;
    const start = 0;
    const diff = value - start;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}</span>;
}

export default function Recipient() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recipientName = decodeURIComponent(params.get("name") || "Mila");
  const totalValue = Number(params.get("value")) || 4250;
  const contributorCount = Number(params.get("contributors")) || 18;
  
  const [activeTab, setActiveTab] = useState<"today" | "progress" | "story">("today");

  const totalReceived = 3778;
  const timeAdded = totalValue - totalReceived;
  const daysInvested = 438;
  const currentStreak = 14;
  const milestonesEarned = 4;

  const milestones = [
    { id: "first_100", label: "First $100", reached: true, date: "Nov 2023", icon: "🎯" },
    { id: "first_500", label: "First $500", reached: true, date: "Jan 2024", icon: "⭐" },
    { id: "first_1k", label: "First $1,000", reached: true, date: "Mar 2024", icon: "🏆" },
    { id: "one_year", label: "One year invested", reached: true, date: "Oct 2024", icon: "📅" },
    { id: "first_dividend", label: "First dividend received", reached: false, icon: "💰" },
    { id: "first_5k", label: "First $5,000", reached: false, icon: "🚀" },
  ];

  const nextMilestone = milestones.find(m => !m.reached);

  const whatChanged = [
    { 
      type: "growth", 
      message: "Time gave your fund a boost today", 
      detail: "Staying invested let it grow without any new gifts. That's compounding at work.",
      time: "Today",
      amount: 47
    },
    { 
      type: "gift", 
      message: "Uncle Dave moved you closer to your next milestone", 
      detail: "People fuel the fund. Time makes it grow.",
      time: "2 days ago", 
      amount: 180 
    },
    { 
      type: "dividend", 
      message: "Disney shared some of their profits with you", 
      detail: "When you own a piece of a company, you sometimes get a share of what they earn. These little drops add up.",
      time: "1 week ago",
      amount: 3
    },
  ];

  const messages = [
    { from: "Uncle Dave", message: "So proud of you, kiddo! This is just the beginning.", amount: 180 },
    { from: "Grandma Ruth", message: "For your future, with all my love. Can't wait to see who you become.", amount: 500 },
    { from: "The Cohens", message: "Here's to many more milestones!", amount: 100 },
    { from: "Aunt Lisa", message: "Can't wait to see all you accomplish!", amount: 75 },
    { from: "The Goldbergs", message: "Wishing you the best!", amount: 50 },
  ];

  const supporters = [
    "Uncle Dave", "Grandma Ruth", "The Cohens", "Aunt Lisa", 
    "The Goldbergs", "Cousin Jake", "Mom & Dad", "Nana", 
    "The Petersons", "Aunt Maya"
  ];

  const holdings = [
    { name: "Disney", emoji: "🏰" },
    { name: "Apple", emoji: "🍎" },
    { name: "US Market", emoji: "📈" },
  ];

  const tabs = [
    { id: "today" as const, label: "Today" },
    { id: "progress" as const, label: "Progress" },
    { id: "story" as const, label: "Story" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" className="text-foreground" />
          <span className="text-xs text-muted-foreground">{recipientName}'s Fund</span>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Avatar and Name */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-3 h-16 w-16 rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground flex items-center justify-center text-2xl font-light shadow-lg"
          >
            {recipientName.charAt(0)}
          </motion.div>
          <h1 className="text-xl font-medium text-foreground">{recipientName}'s Fund</h1>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                activeTab === tab.id 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* TODAY TAB */}
          {activeTab === "today" && (
            <motion.div
              key="today"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Balance Card */}
              <div className="text-center p-6 rounded-2xl bg-card border border-border shadow-sm mb-6">
                <p className="text-4xl font-light text-foreground tracking-tight mb-1">
                  <AnimatedValue value={totalValue} />
                </p>
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm text-success font-medium">
                    +${timeAdded.toLocaleString()} from time
                  </span>
                </div>
              </div>

              {/* Next Milestone */}
              {nextMilestone && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-[hsl(var(--kora-gold))]/10 to-[hsl(var(--kora-gold))]/5 border border-[hsl(var(--kora-gold))]/20 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{nextMilestone.icon}</span>
                    <div>
                      <p className="text-xs text-[hsl(var(--kora-gold))] font-medium uppercase tracking-wider">Next milestone</p>
                      <p className="text-sm text-foreground font-medium">{nextMilestone.label}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* What You Own */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-foreground">What you own</h2>
                </div>
                <div className="flex gap-2">
                  {holdings.map((holding) => (
                    <div
                      key={holding.name}
                      className="flex-1 p-3 rounded-xl bg-card border border-border text-center"
                    >
                      <span className="text-xl mb-1 block">{holding.emoji}</span>
                      <p className="text-xs text-muted-foreground">{holding.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* What Changed */}
              <div>
                <h2 className="text-sm font-medium text-foreground mb-3">What changed</h2>
                <div className="space-y-3">
                  {whatChanged.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium text-foreground">{item.message}</p>
                        {item.amount && (
                          <span className="text-xs text-success font-medium shrink-0 ml-2 bg-success/10 px-2 py-0.5 rounded-full">+${item.amount}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{item.detail}</p>
                      <p className="text-[10px] text-muted-foreground">{item.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* PROGRESS TAB */}
          {activeTab === "progress" && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-card border border-border text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Calendar className="h-4 w-4 text-accent" />
                  </div>
                  <p className="text-2xl font-light text-foreground">{daysInvested}</p>
                  <p className="text-xs text-muted-foreground">Days invested</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame className="h-4 w-4 text-[hsl(var(--kora-gold))]" />
                  </div>
                  <p className="text-2xl font-light text-foreground">{currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Month streak</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Trophy className="h-4 w-4 text-[hsl(var(--kora-gold))]" />
                  </div>
                  <p className="text-2xl font-light text-foreground">{milestonesEarned}</p>
                  <p className="text-xs text-muted-foreground">Milestones</p>
                </div>
              </div>

              {/* Compounding Visual */}
              <div className="p-5 rounded-xl bg-card border border-border mb-6">
                <h3 className="text-sm font-medium text-foreground mb-4">How your fund grew</h3>
                <div className="flex items-end gap-4 h-32">
                  <div className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-border rounded-t-lg transition-all"
                      style={{ height: `${(totalReceived / totalValue) * 100}%` }}
                    />
                    <p className="text-lg font-medium text-foreground mt-2">${totalReceived.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">What people added</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-success rounded-t-lg transition-all"
                      style={{ height: `${(timeAdded / totalValue) * 100}%` }}
                    />
                    <p className="text-lg font-medium text-success mt-2">+${timeAdded.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">What time added</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Time is your superpower. The longer you stay invested, the more it grows.
                </p>
              </div>

              {/* Milestones */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Milestones</h3>
                <div className="relative">
                  <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />
                  <div className="space-y-3">
                    {milestones.map((milestone) => (
                      <div key={milestone.id} className="flex items-center gap-3 pl-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 text-sm ${
                          milestone.reached 
                            ? "bg-success/10 border-2 border-success" 
                            : "bg-muted border-2 border-border"
                        }`}>
                          {milestone.icon}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${milestone.reached ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {milestone.label}
                          </p>
                          {milestone.date && (
                            <p className="text-xs text-muted-foreground">{milestone.date}</p>
                          )}
                        </div>
                        {milestone.reached && (
                          <span className="text-xs text-success font-medium">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STORY TAB */}
          {activeTab === "story" && (
            <motion.div
              key="story"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* People in your corner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-medium text-foreground">{contributorCount} people in your corner</p>
                </div>
                <p className="text-xs text-muted-foreground">They believe in your future</p>
              </div>

              {/* Supporters */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-foreground mb-3">Your supporters</h3>
                <div className="flex flex-wrap gap-2">
                  {supporters.map((name) => (
                    <span 
                      key={name}
                      className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 text-sm"
                    >
                      <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {name.charAt(0)}
                      </span>
                      <span className="text-foreground">{name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Messages</h3>
                <div className="space-y-3">
                  {messages.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-sm text-foreground">{item.from}</p>
                        <span className="text-xs text-success font-medium">+${item.amount}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center pt-8 mt-8 border-t border-border"
        >
          <p className="text-xs text-muted-foreground mb-1">
            Stay invested. Let time do the work.
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Assets held by Apex Clearing, member FINRA/SIPC
          </p>
        </motion.div>
      </main>
    </div>
  );
}
