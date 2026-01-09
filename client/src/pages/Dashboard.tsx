import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [expandedFund, setExpandedFund] = useState<number | null>(0);
  const [showPortfolio, setShowPortfolio] = useState(false);

  const momentLink = `everleaf.com/m/${profileName.toLowerCase().replace(/\s+/g, "-")}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(`https://${momentLink}`);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

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
      events: [
        { id: 1, title: "Open anytime", raised: 2180, gifts: 12, active: true },
        { id: 2, title: isPersonal ? "30th Birthday" : "5th Birthday", raised: 1420, gifts: 8, date: "Dec 2025", active: false },
        { id: 3, title: isPersonal ? "MBA Graduation" : "Kindergarten", raised: 650, gifts: 4, date: "May 2026", active: true },
      ]
    },
  ];

  const totalBalance = funds.reduce((sum, f) => sum + f.balance, 0);
  const totalGain = funds.reduce((sum, f) => sum + f.gain, 0);

  const portfolio = [
    { name: "US Total Market", allocation: "50%", value: 2125 },
    { name: "International Developed", allocation: "20%", value: 850 },
    { name: "Bonds", allocation: "15%", value: 638 },
    { name: "Cash", allocation: "15%", value: 637 },
  ];

  const recentActivity = [
    { from: "Dave Chen", amount: 180, event: "5th Birthday", time: "2 hours ago", note: "So proud of you" },
    { from: "Ruth Stein", amount: 500, event: "Open anytime", time: "Yesterday", note: "With love" },
    { from: "Michael Park", amount: 100, event: "Open anytime", time: "3 days ago", note: null },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm font-medium tracking-tight text-stone-900">Everleaf</span>
          </Link>
          <div className="flex items-center gap-4">
            <button className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
              Settings
            </button>
            <div className="h-7 w-7 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-xs font-medium">
              {profileName.charAt(0)}
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-6 py-10">
        
        {/* The Number */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <p className="text-sm text-stone-500 mb-1">Total balance</p>
          <h1 className="text-5xl font-light tracking-tight text-stone-900 mb-2">
            <AnimatedValue value={totalBalance} />
          </h1>
          <p className="text-sm">
            <span className="text-emerald-700">+${totalGain.toLocaleString()}</span>
            <span className="text-stone-400 ml-1.5">all time</span>
          </p>
        </motion.div>

        {/* Portfolio Preview */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => setShowPortfolio(true)}
          className="w-full mb-10 text-left group"
        >
          <div className="flex h-1.5 rounded-full overflow-hidden mb-3 bg-stone-200">
            <div className="bg-stone-900" style={{ width: "50%" }} />
            <div className="bg-stone-600" style={{ width: "20%" }} />
            <div className="bg-stone-400" style={{ width: "15%" }} />
            <div className="bg-stone-300" style={{ width: "15%" }} />
          </div>
          <p className="text-xs text-stone-400 group-hover:text-stone-600 transition-colors">
            Where it's invested →
          </p>
        </motion.button>

        {/* Share */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-12 p-5 rounded-lg bg-white border border-stone-200"
        >
          <p className="text-sm text-stone-500 mb-3">Share your page</p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 bg-stone-50 rounded text-sm text-stone-600 truncate">
              {momentLink}
            </div>
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button 
              onClick={() => setShowQR(true)}
              className="px-3 py-2 border border-stone-200 rounded text-sm hover:bg-stone-50 transition-colors"
            >
              QR
            </button>
          </div>
        </motion.div>

        {/* Funds */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wider">Funds</h2>
          </div>
          
          {funds.map((fund) => (
            <div key={fund.id} className="border border-stone-200 rounded-lg bg-white overflow-hidden">
              
              {/* Fund Header */}
              <button
                onClick={() => setExpandedFund(expandedFund === fund.id ? null : fund.id)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-stone-900">{fund.name}'s Fund</p>
                  <p className="text-sm text-stone-500">{fund.contributors} contributors</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-medium text-stone-900">${fund.balance.toLocaleString()}</p>
                  <p className="text-sm text-emerald-700">+{fund.gainPercent}%</p>
                </div>
              </button>

              {/* Expanded */}
              <AnimatePresence>
                {expandedFund === fund.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-stone-100">
                      
                      {/* Projection */}
                      <div className="py-4 border-b border-stone-100">
                        <p className="text-sm text-stone-500 mb-1">
                          {isPersonal ? "In 20 years" : `When ${fund.name} turns 18`}
                        </p>
                        <p className="text-2xl font-light text-stone-900">
                          ${fund.projection.toLocaleString()}
                        </p>
                        <p className="text-xs text-stone-400 mt-1">
                          Projected at 7% annual return
                        </p>
                      </div>

                      {/* Event Pages */}
                      <div className="py-4">
                        <div className="flex items-baseline justify-between mb-3">
                          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Event Pages</p>
                          <Link href="/moment/create" className="text-xs text-stone-500 hover:text-stone-900">
                            + Add
                          </Link>
                        </div>
                        <div className="space-y-1">
                          {fund.events.map((event) => (
                            <Link key={event.id} href={`/moment?name=${encodeURIComponent(fund.name)}&title=${encodeURIComponent(event.title)}`}>
                              <div className="p-3 -mx-2 rounded hover:bg-stone-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                  {event.active && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  )}
                                  {!event.active && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                                  )}
                                  <div>
                                    <p className="text-sm text-stone-900">{event.title}</p>
                                    {event.date && <p className="text-xs text-stone-400">{event.date}</p>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-stone-600">${event.raised.toLocaleString()}</p>
                                  <p className="text-xs text-stone-400">{event.gifts} gifts</p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 flex gap-2">
                        <Link href={`/moment?name=${encodeURIComponent(fund.name)}`} className="flex-1">
                          <button className="w-full py-2.5 text-sm font-medium text-stone-900 border border-stone-200 rounded hover:bg-stone-50 transition-colors">
                            View page
                          </button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>

        {/* Activity */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4">Recent Activity</h2>
          
          <div className="space-y-4">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-stone-900">
                    <span className="font-medium">{item.from}</span>
                    <span className="text-stone-400 mx-1.5">→</span>
                    <span>{item.event}</span>
                  </p>
                  {item.note && (
                    <p className="text-sm text-stone-500 mt-0.5">"{item.note}"</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1">{item.time}</p>
                </div>
                <p className="text-sm font-medium text-stone-900">+${item.amount}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-xs text-stone-400 text-center mt-16 pb-8">
          Brokerage services by Alpaca Securities LLC<br />
          Member FINRA/SIPC
        </p>
      </main>

      {/* Portfolio Modal */}
      <Dialog open={showPortfolio} onOpenChange={setShowPortfolio}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="font-medium">Portfolio allocation</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {portfolio.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-900">{item.name}</p>
                  <p className="text-xs text-stone-400">{item.allocation}</p>
                </div>
                <p className="text-sm font-medium text-stone-900">${item.value.toLocaleString()}</p>
              </div>
            ))}
            <p className="text-xs text-stone-400 pt-4 border-t border-stone-100">
              Automatically rebalanced. Managed for long-term growth.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs bg-white">
          <div className="flex flex-col items-center py-6">
            <div className="p-4 bg-white rounded-lg border border-stone-200 mb-4">
              <QRCodeSVG value={`https://${momentLink}`} size={180} level="H" />
            </div>
            <p className="text-sm text-stone-500 text-center">
              Scan to give
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
