import { useState, useEffect } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, QrCode, Copy, Check, TrendingUp, X, Sparkles, Crown, Users, Lock, ChevronRight, ChevronDown, Heart, Star, Share2, ExternalLink, Gift, PieChart } from "lucide-react";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}</span>;
}

export default function Dashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || "Mila");
  const isPersonal = accountType === "personal";

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"free" | "plus" | "family">("free");
  const [expandedFund, setExpandedFund] = useState<number | null>(0);
  const [showPortfolio, setShowPortfolio] = useState(false);

  const momentLink = `everleaf.com/m/${profileName.toLowerCase().replace(/\s+/g, "-")}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(`https://${momentLink}`);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  // Fund data with events inside
  const funds = [
    {
      id: 1,
      name: profileName,
      balance: 4250,
      gain: 472,
      gainPercent: 12.5,
      contributors: 18,
      projection: 28400,
      yearsLeft: 14,
      color: "from-emerald-400 to-emerald-600",
      shadowColor: "shadow-emerald-500/20",
      events: [
        { id: 1, type: "always", title: "Always Open", emoji: "✨", raised: 2180, gifts: 12, active: true },
        { id: 2, type: "birthday", title: isPersonal ? "30th Birthday" : "5th Birthday", emoji: "🎂", raised: 1420, gifts: 8, date: "Dec 2025", active: false },
        { id: 3, type: "graduation", title: isPersonal ? "MBA Graduation" : "Kindergarten Graduation", emoji: "🎓", raised: 650, gifts: 4, date: "May 2026", active: true },
      ]
    },
    ...(currentPlan === "family" ? [{
      id: 2,
      name: "Maya",
      balance: 1850,
      gain: 142,
      gainPercent: 8.3,
      contributors: 6,
      projection: 12800,
      yearsLeft: 16,
      color: "from-violet-400 to-violet-600",
      shadowColor: "shadow-violet-500/20",
      events: [
        { id: 1, type: "always", title: "Always Open", emoji: "✨", raised: 1200, gifts: 4, active: true },
        { id: 2, type: "birthday", title: "3rd Birthday", emoji: "🎂", raised: 650, gifts: 2, date: "Mar 2026", active: true },
      ]
    }] : [])
  ];

  const totalBalance = funds.reduce((sum, f) => sum + f.balance, 0);
  const totalGain = funds.reduce((sum, f) => sum + f.gain, 0);

  // Portfolio breakdown - where the money lives
  const portfolio = [
    { name: "US Stocks", ticker: "VTI", value: 2550, percent: 50, color: "bg-blue-500", desc: "Total US market" },
    { name: "International", ticker: "VXUS", value: 1020, percent: 20, color: "bg-emerald-500", desc: "Global markets" },
    { name: "Bonds", ticker: "BND", value: 765, percent: 15, color: "bg-amber-500", desc: "Stable income" },
    { name: "Cash", ticker: "—", value: 765, percent: 15, color: "bg-slate-300", desc: "Ready to invest" },
  ];

  const recentActivity = [
    { type: "gift", from: "Uncle Dave", amount: 180, fund: profileName, event: "5th Birthday", time: "2h ago", message: "So proud!" },
    { type: "gift", from: "Grandma Ruth", amount: 500, fund: profileName, event: "Always Open", time: "Yesterday", message: "Love you! ❤️" },
    { type: "milestone", text: "Fund passed $4,000!", fund: profileName, time: "3 days ago" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-emerald-50/30 dark:to-emerald-950/10">
      <Nav showDashboard accountType={accountType} profileName={profileName} />
      
      <main className="container mx-auto px-4 py-8 max-w-xl">
        
        {/* Hero: Total Across All Funds */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center pt-6 pb-10"
        >
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Balance</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-foreground mb-3">
            <AnimatedValue value={totalBalance} />
          </h1>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30"
          >
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              +${totalGain.toLocaleString()}
            </span>
            <span className="text-sm text-emerald-600/80">all time</span>
          </motion.div>

          {/* Where it's invested - Visual bar */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={() => setShowPortfolio(true)}
            className="mt-6 w-full max-w-xs mx-auto block"
          >
            <div className="flex h-3 rounded-full overflow-hidden mb-2">
              {portfolio.map((p, i) => (
                <motion.div 
                  key={i}
                  initial={{ width: 0 }}
                  animate={{ width: `${p.percent}%` }}
                  transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
                  className={`${p.color}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <PieChart className="h-3 w-3" />
              See where your money is invested
            </p>
          </motion.button>
        </motion.div>

        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
              copied ? "bg-emerald-50 border-emerald-200" : "bg-card border-transparent hover:border-foreground/10"
            }`}
          >
            {copied ? <Check className="h-6 w-6 text-emerald-600" /> : <Share2 className="h-6 w-6 text-foreground/70" />}
            <span className="text-xs font-medium">{copied ? "Copied!" : "Share"}</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowQR(true)}
            className="p-4 rounded-2xl bg-card border-2 border-transparent hover:border-foreground/10 transition-all flex flex-col items-center gap-2"
          >
            <QrCode className="h-6 w-6 text-foreground/70" />
            <span className="text-xs font-medium">QR Code</span>
          </motion.button>

          <Link href={`/moment?name=${encodeURIComponent(profileName)}`}>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="p-4 rounded-2xl bg-card border-2 border-transparent hover:border-foreground/10 transition-all flex flex-col items-center gap-2 h-full"
            >
              <ExternalLink className="h-6 w-6 text-foreground/70" />
              <span className="text-xs font-medium">Preview</span>
            </motion.div>
          </Link>
        </motion.div>

        {/* Funds with Events Inside */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Your Funds</h2>
          </div>
          
          <div className="space-y-4">
            {funds.map((fund, i) => (
              <motion.div
                key={fund.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="rounded-2xl border-2 bg-card overflow-hidden transition-all"
              >
                {/* Fund Header - Clickable */}
                <button
                  onClick={() => setExpandedFund(expandedFund === fund.id ? null : fund.id)}
                  className="w-full p-5 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${fund.color} flex items-center justify-center text-xl font-semibold text-white shadow-lg ${fund.shadowColor}`}>
                    {fund.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{fund.name}'s Fund</h3>
                    <p className="text-sm text-muted-foreground">{fund.contributors} contributors · {fund.events.length} events</p>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-xl font-semibold">${fund.balance.toLocaleString()}</p>
                    <p className="text-sm text-emerald-600 font-medium">+{fund.gainPercent}%</p>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedFund === fund.id ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                </button>

                {/* Expanded: Events + Actions */}
                <AnimatePresence>
                  {expandedFund === fund.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t">
                        {/* Future Projection */}
                        <div className="my-4 p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-slate-400 text-sm">{isPersonal ? "In 20 years" : `When ${fund.name} turns 18`}</p>
                              <p className="text-2xl font-light">${fund.projection.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-400 text-sm font-medium">
                                {Math.round((fund.projection / fund.balance) * 100 - 100)}% growth
                              </p>
                              <p className="text-slate-500 text-xs">{fund.yearsLeft} years</p>
                            </div>
                          </div>
                        </div>

                        {/* Events List */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground">Event Pages</p>
                            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Add event
                            </button>
                          </div>
                          <div className="space-y-2">
                            {fund.events.map((event) => (
                              <Link key={event.id} href={`/moment?name=${encodeURIComponent(fund.name)}&title=${encodeURIComponent(event.title)}`}>
                                <motion.div
                                  whileHover={{ x: 4 }}
                                  className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all flex items-center gap-3 cursor-pointer"
                                >
                                  <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-lg">
                                    {event.emoji}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{event.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      ${event.raised.toLocaleString()} · {event.gifts} gifts
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {event.date && <span className="text-xs text-muted-foreground">{event.date}</span>}
                                    {event.active && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                                  </div>
                                </motion.div>
                              </Link>
                            ))}
                          </div>
                        </div>

                        {/* Fund Actions */}
                        <div className="flex gap-2">
                          <Link href={`/moment?name=${encodeURIComponent(fund.name)}`} className="flex-1">
                            <Button variant="outline" className="w-full" size="sm">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View giving page
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" onClick={() => setShowQR(true)}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {/* Add Another Fund */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className={`p-5 rounded-2xl border-2 border-dashed transition-all flex items-center gap-4 ${
                currentPlan === "family" 
                  ? "hover:border-foreground/30 cursor-pointer hover:bg-muted/30" 
                  : "opacity-50"
              }`}
              onClick={() => currentPlan !== "family" && setShowUpgrade(true)}
            >
              <div className="h-14 w-14 rounded-2xl border-2 border-dashed flex items-center justify-center">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-muted-foreground">Add another fund</p>
                <p className="text-sm text-muted-foreground/70">For another child</p>
              </div>
              {currentPlan !== "family" && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Family
                </span>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold tracking-tight mb-4">Recent</h2>
          
          <div className="space-y-3">
            {recentActivity.map((activity, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="p-4 rounded-2xl bg-card border hover:shadow-md transition-all"
              >
                {activity.type === "gift" ? (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center shrink-0">
                      <Heart className="h-5 w-5 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{activity.from}</span>
                        <span className="text-emerald-600 font-semibold">+${activity.amount}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        to {activity.event} · "{activity.message}"
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center shrink-0">
                      <Star className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{activity.text}</p>
                      <p className="text-sm text-muted-foreground">Milestone 🎉</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Upgrade Prompt */}
        {currentPlan === "free" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <Card 
              className="border-2 border-dashed hover:border-foreground/20 transition-all cursor-pointer" 
              onClick={() => setShowUpgrade(true)}
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Remove contributor fees</p>
                    <p className="text-xs text-muted-foreground">Upgrade to Plus · $4/month</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Trust Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-xs text-muted-foreground text-center mt-10 pb-8"
        >
          Brokerage by Alpaca Securities LLC, member FINRA/SIPC
        </motion.p>
      </main>

      {/* Portfolio Modal */}
      <Dialog open={showPortfolio} onOpenChange={setShowPortfolio}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Where your money is invested</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {/* Visual Bar */}
            <div className="flex h-6 rounded-xl overflow-hidden mb-6">
              {portfolio.map((p, i) => (
                <div key={i} className={`${p.color}`} style={{ width: `${p.percent}%` }} />
              ))}
            </div>

            {/* Breakdown */}
            <div className="space-y-4">
              {portfolio.map((p, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`h-3 w-3 rounded-full ${p.color}`} />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{p.name}</span>
                      <span className="font-semibold">${p.value.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{p.desc}</span>
                      <span>{p.percent}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-center">
              Auto-managed for long-term growth. No action needed.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Share the link</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="p-6 bg-white rounded-2xl shadow-lg mb-6">
              <QRCodeSVG value={`https://${momentLink}`} size={200} level="H" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Scan to give a gift
            </p>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy link
              </Button>
              <Button className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upgrade your plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {[
              { id: "plus", name: "Plus", price: "$4/mo", desc: "Zero fees for contributors", icon: Crown, gradient: "from-amber-100 to-amber-50" },
              { id: "family", name: "Family", price: "$9/mo", desc: "Multiple funds + zero fees", icon: Users, gradient: "from-violet-100 to-violet-50" },
            ].map((plan) => (
              <button
                key={plan.id}
                onClick={() => { setCurrentPlan(plan.id as any); setShowUpgrade(false); toast({ title: `Upgraded to ${plan.name}!` }); }}
                className="w-full p-4 rounded-xl border-2 hover:border-foreground/30 transition-all text-left flex items-center gap-4"
              >
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                  <plan.icon className="h-6 w-6 text-foreground/70" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-sm text-muted-foreground">{plan.desc}</p>
                </div>
                <span className="font-semibold">{plan.price}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
