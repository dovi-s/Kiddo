import { useState, useEffect } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, QrCode, Copy, Check, ArrowRight, ExternalLink, TrendingUp, X, Sparkles, Crown, Users, Lock, ChevronRight, Gift, Heart, Star, Share2 } from "lucide-react";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

// Animated counter for that satisfying number reveal
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

  // States
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"free" | "plus" | "family">("free");
  const [selectedFund, setSelectedFund] = useState(0);

  const momentLink = `everleaf.com/m/${profileName.toLowerCase().replace(/\s+/g, "-")}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(`https://${momentLink}`);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with family and friends." });
    setTimeout(() => setCopied(false), 2000);
  };

  // Fund data
  const funds = [
    {
      id: 1,
      name: profileName,
      balance: 4250,
      gain: 472,
      gainPercent: 12.5,
      contributors: 18,
      recentGift: { from: "Grandma Ruth", amount: 500, time: "Yesterday" },
      projection: 28400, // at age 18
      yearsLeft: 14,
    },
    ...(currentPlan === "family" ? [{
      id: 2,
      name: "Maya",
      balance: 1850,
      gain: 142,
      gainPercent: 8.3,
      contributors: 6,
      recentGift: { from: "The Cohens", amount: 100, time: "2 days ago" },
      projection: 12800,
      yearsLeft: 16,
    }] : [])
  ];

  const activeFund = funds[selectedFund] || funds[0];
  const totalBalance = funds.reduce((sum, f) => sum + f.balance, 0);
  const totalGain = funds.reduce((sum, f) => sum + f.gain, 0);

  const recentActivity = [
    { type: "gift", from: "Uncle Dave", amount: 180, fund: profileName, time: "2h ago", message: "So proud of you!" },
    { type: "gift", from: "Grandma Ruth", amount: 500, fund: profileName, time: "Yesterday", message: "For your future ❤️" },
    { type: "milestone", text: "Fund passed $4,000", fund: profileName, time: "3 days ago" },
    ...(currentPlan === "family" ? [{ type: "gift", from: "The Cohens", amount: 100, fund: "Maya", time: "2 days ago", message: "Happy birthday!" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-emerald-50/30 dark:to-emerald-950/10">
      <Nav showDashboard accountType={accountType} profileName={profileName} />
      
      <main className="container mx-auto px-4 py-8 max-w-lg">
        
        {/* Hero: The Number That Matters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center pt-8 pb-12"
        >
          {/* Fund Switcher (if multiple) */}
          {funds.length > 1 && (
            <div className="flex justify-center gap-2 mb-6">
              {funds.map((fund, i) => (
                <button
                  key={fund.id}
                  onClick={() => setSelectedFund(i)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedFund === i 
                      ? "bg-foreground text-background" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {fund.name}
                </button>
              ))}
            </div>
          )}

          {/* The Big Number */}
          <motion.div
            key={activeFund.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-sm font-medium text-muted-foreground mb-3">
              {isPersonal ? "My Fund" : `${activeFund.name}'s Future`}
            </p>
            <h1 className="text-6xl md:text-7xl font-light tracking-tighter text-foreground mb-4">
              <AnimatedValue value={activeFund.balance} />
            </h1>
            
            {/* Growth Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30"
            >
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                +${activeFund.gain.toLocaleString()}
              </span>
              <span className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                all time
              </span>
            </motion.div>
          </motion.div>

          {/* Future Projection - The Emotional Hook */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white mx-auto max-w-sm"
          >
            <p className="text-slate-400 text-sm mb-1">
              {isPersonal ? "Projected in 20 years" : `When ${activeFund.name} turns 18`}
            </p>
            <p className="text-4xl font-light tracking-tight mb-2">
              ${activeFund.projection.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">
              Based on 7% annual growth · {activeFund.yearsLeft} years to go
            </p>
          </motion.div>
        </motion.div>

        {/* Quick Actions - Dead Simple */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-3 mb-10"
        >
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
              copied 
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" 
                : "bg-card border-transparent hover:border-foreground/10"
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

          <Link href={`/moment?name=${encodeURIComponent(activeFund.name)}`}>
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

        {/* Recent Activity - Stories, Not Data */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Recent</h2>
          </div>
          
          <div className="space-y-3">
            {recentActivity.slice(0, 4).map((activity, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="p-4 rounded-2xl bg-card border hover:shadow-md transition-all"
              >
                {activity.type === "gift" ? (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 flex items-center justify-center shrink-0">
                      <Heart className="h-5 w-5 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{activity.from}</p>
                        <span className="text-emerald-600 font-semibold">+${activity.amount}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{activity.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 flex items-center justify-center shrink-0">
                      <Star className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{activity.text}</p>
                      <p className="text-sm text-muted-foreground">Milestone reached 🎉</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* The Fund Card - Expandable */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-6"
        >
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            {funds.length > 1 ? "Your Funds" : "Fund Details"}
          </h2>
          
          <div className="space-y-3">
            {funds.map((fund, i) => (
              <motion.div
                key={fund.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedFund === i 
                    ? "border-foreground/20 bg-card shadow-lg" 
                    : "border-transparent bg-card hover:border-foreground/10"
                }`}
                onClick={() => setSelectedFund(i)}
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xl font-semibold text-white shadow-lg shadow-emerald-500/20">
                    {fund.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{fund.name}'s Fund</h3>
                    <p className="text-sm text-muted-foreground">{fund.contributors} contributors</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold">${fund.balance.toLocaleString()}</p>
                    <p className="text-sm text-emerald-600">+{fund.gainPercent}%</p>
                  </div>
                </div>
                
                {selectedFund === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 pt-4 border-t"
                  >
                    <Link href={`/moment?name=${encodeURIComponent(fund.name)}`}>
                      <Button variant="outline" className="w-full" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View giving page
                      </Button>
                    </Link>
                  </motion.div>
                )}
              </motion.div>
            ))}

            {/* Add Another Fund */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className={`p-5 rounded-2xl border-2 border-dashed transition-all ${
                currentPlan === "family" 
                  ? "hover:border-foreground/30 cursor-pointer hover:bg-muted/30" 
                  : "opacity-50"
              }`}
              onClick={() => currentPlan === "family" ? toast({ title: "Coming soon", description: "Multi-fund management is in development." }) : setShowUpgrade(true)}
            >
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl border-2 border-dashed flex items-center justify-center">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-muted-foreground">Add another fund</h3>
                  <p className="text-sm text-muted-foreground/70">For another child or recipient</p>
                </div>
                {currentPlan !== "family" && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Family
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Plan Upgrade Prompt (subtle) */}
        {currentPlan === "free" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <Card className="border-2 border-dashed hover:border-foreground/20 transition-all cursor-pointer" onClick={() => setShowUpgrade(true)}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/30 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Remove the 3% guest fee</p>
                    <p className="text-xs text-muted-foreground">Upgrade to Plus · $4/month</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Trust Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-12 pb-8 text-center"
        >
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Brokerage by Alpaca Securities LLC, member FINRA/SIPC. Your investments are protected up to $500,000.
          </p>
        </motion.div>
      </main>

      {/* QR Code Modal */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Share {activeFund.name}'s Fund</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="p-6 bg-white rounded-2xl shadow-lg mb-6">
              <QRCodeSVG value={`https://${momentLink}`} size={200} level="H" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Scan to give a gift that grows
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
              { id: "plus", name: "Plus", price: "$4/mo", desc: "Zero fees for contributors", icon: Crown, color: "amber" },
              { id: "family", name: "Family", price: "$9/mo", desc: "Multiple funds + zero fees", icon: Users, color: "violet" },
            ].map((plan) => (
              <button
                key={plan.id}
                onClick={() => { setCurrentPlan(plan.id as any); setShowUpgrade(false); toast({ title: `Upgraded to ${plan.name}!` }); }}
                className="w-full p-4 rounded-xl border-2 hover:border-foreground/30 transition-all text-left flex items-center gap-4"
              >
                <div className={`h-12 w-12 rounded-xl bg-${plan.color}-100 dark:bg-${plan.color}-900/30 flex items-center justify-center`}>
                  <plan.icon className={`h-6 w-6 text-${plan.color}-600`} />
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
