import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Pencil, Copy, QrCode, ExternalLink } from "lucide-react";

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
  const [showEditFund, setShowEditFund] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState<number | null>(null);
  const [showPageQR, setShowPageQR] = useState<string | null>(null);
  
  // Editable state
  const [fundName, setFundName] = useState(profileName);
  const [fundSlugEdit, setFundSlugEdit] = useState(profileName.toLowerCase().replace(/\s+/g, "-"));
  const [eventEdits, setEventEdits] = useState<Record<number, { title: string; slug: string }>>({});

  const fundSlug = fundSlugEdit;
  const momentLink = `everleaf.com/${fundSlug}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(`https://${momentLink}`);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const funds = [
    {
      id: 1,
      name: fundName,
      accountType: isPersonal ? "Individual" : "UTMA",
      balance: 4250,
      gain: 472,
      gainPercent: 12.5,
      contributors: 18,
      projection: 28400,
      yearsLeft: 14,
      events: [
        { id: 1, slug: "anytime", title: "Open anytime", raised: 2180, gifts: 12, active: true },
        { id: 2, slug: isPersonal ? "30th-birthday" : "5th-birthday", title: isPersonal ? "30th Birthday" : "5th Birthday", raised: 1420, gifts: 8, date: "Dec 2025", active: false },
        { id: 3, slug: isPersonal ? "mba-graduation" : "kindergarten-graduation", title: isPersonal ? "MBA Graduation" : "Kindergarten", raised: 650, gifts: 4, date: "May 2026", active: true },
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
          <span className="text-sm font-medium tracking-tight text-stone-900">Everleaf</span>
          <div className="flex items-center gap-4">
            <Link href="/send">
              <span className="text-sm text-stone-500 hover:text-stone-900">Send stock</span>
            </Link>
            <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
              <span className="text-sm text-stone-500 hover:text-stone-900">Settings</span>
            </Link>
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-stone-500">Share your page</p>
            <button 
              onClick={() => setShowEditFund(true)}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Edit
            </button>
          </div>
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

        {/* Funds - Visual Hierarchy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          {funds.map((fund) => (
            <div key={fund.id} className="mb-6">
              
              {/* Fund Level */}
              <div className="border border-stone-200 rounded-lg bg-white overflow-hidden">
                <button
                  onClick={() => setExpandedFund(expandedFund === fund.id ? null : fund.id)}
                  className="w-full p-5 flex items-center gap-4 text-left hover:bg-stone-50 transition-colors group"
                >
                  <motion.div 
                    animate={{ rotate: expandedFund === fund.id ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-stone-400 group-hover:text-stone-600"
                  >
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M1.5 1L6.5 6L1.5 11" />
                    </svg>
                  </motion.div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-stone-900">{fund.name}'s Fund</p>
                      <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider px-1.5 py-0.5 bg-stone-100 rounded">
                        {fund.accountType}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">everleaf.com/{fundSlug}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-medium text-stone-900">${fund.balance.toLocaleString()}</p>
                    <p className="text-sm text-emerald-700">+{fund.gainPercent}%</p>
                  </div>
                </button>

                {/* Expanded Content */}
                <AnimatePresence>
                  {expandedFund === fund.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-stone-100">
                        
                        {/* Fund Info Row */}
                        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100">
                          <div>
                            <p className="text-sm text-stone-500">
                              {isPersonal ? "In 20 years" : `When ${fund.name} turns 18`}: <span className="font-medium text-stone-900">${fund.projection.toLocaleString()}</span>
                            </p>
                            <p className="text-xs text-stone-400">{fund.contributors} contributors</p>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => setShowEditFund(true)}
                              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              onClick={handleCopy}
                              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                              title="Copy link"
                            >
                              <Copy size={14} />
                            </button>
                            <button 
                              onClick={() => setShowQR(true)}
                              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                              title="QR code"
                            >
                              <QrCode size={14} />
                            </button>
                            <Link href={`/${fundSlug}`}>
                              <button className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors" title="View page">
                                <ExternalLink size={14} />
                              </button>
                            </Link>
                          </div>
                        </div>

                        {/* Pages within this Fund */}
                        <div className="px-5 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Pages</p>
                            <Link href="/moment/create" className="text-xs text-stone-500 hover:text-stone-900">
                              + New page
                            </Link>
                          </div>
                          
                          {/* Tree visualization */}
                          <div className="space-y-0">
                            {fund.events.map((event, idx) => {
                              const eventData = eventEdits[event.id] || { title: event.title, slug: event.slug };
                              const isLast = idx === fund.events.length - 1;
                              return (
                                <div key={event.id} className="flex">
                                  {/* Tree connector */}
                                  <div className="w-6 flex flex-col items-center mr-2">
                                    <div className={`w-px bg-stone-200 ${idx === 0 ? 'h-3' : 'h-full'}`} />
                                    <div className="w-3 h-px bg-stone-200" style={{ marginTop: idx === 0 ? 0 : -12 }} />
                                    {!isLast && <div className="w-px bg-stone-200 flex-1" />}
                                  </div>
                                  
                                  {/* Page item */}
                                  <div className="flex-1 py-2 flex items-center justify-between group">
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className={`h-2 w-2 rounded-full ${event.active ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                                      <div>
                                        <p className="text-sm text-stone-900">{eventData.title}</p>
                                        <p className="text-xs text-stone-400">/{fundSlug}/{eventData.slug}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <p className="text-sm text-stone-600 mr-2">${event.raised.toLocaleString()}</p>
                                      <Link href={`/edit/${fundSlug}/${eventData.slug}`}>
                                        <button 
                                          className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                          title="Edit page"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                      </Link>
                                      <button 
                                        onClick={() => { navigator.clipboard.writeText(`everleaf.com/${fundSlug}/${eventData.slug}`); toast({ title: "Link copied" }); }}
                                        className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                        title="Copy link"
                                      >
                                        <Copy size={12} />
                                      </button>
                                      <button 
                                        onClick={() => setShowPageQR(`everleaf.com/${fundSlug}/${eventData.slug}`)}
                                        className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                        title="QR code"
                                      >
                                        <QrCode size={12} />
                                      </button>
                                      <Link href={`/${fundSlug}/${eventData.slug}`}>
                                        <button className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded opacity-0 group-hover:opacity-100 transition-all" title="View page">
                                          <ExternalLink size={12} />
                                        </button>
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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

      {/* QR Modal - Fund */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs bg-white">
          <div className="flex flex-col items-center py-6">
            <div className="p-4 bg-white rounded-lg border border-stone-200 mb-4">
              <QRCodeSVG value={`https://${momentLink}`} size={180} level="H" />
            </div>
            <p className="text-xs text-stone-400 text-center mb-1">{momentLink}</p>
            <p className="text-sm text-stone-500 text-center">
              Scan to give
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Modal - Page */}
      <Dialog open={showPageQR !== null} onOpenChange={() => setShowPageQR(null)}>
        <DialogContent className="max-w-xs bg-white">
          <div className="flex flex-col items-center py-6">
            <div className="p-4 bg-white rounded-lg border border-stone-200 mb-4">
              <QRCodeSVG value={`https://${showPageQR}`} size={180} level="H" />
            </div>
            <p className="text-xs text-stone-400 text-center mb-1">{showPageQR}</p>
            <p className="text-sm text-stone-500 text-center">
              Scan to give
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Fund Modal */}
      <Dialog open={showEditFund} onOpenChange={setShowEditFund}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="font-medium">Edit fund</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm text-stone-500 mb-2">Fund name</label>
              <input
                type="text"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-500 mb-2">URL</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-stone-400">everleaf.com/</span>
                <input
                  type="text"
                  value={fundSlugEdit}
                  onChange={(e) => setFundSlugEdit(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="flex-1 px-2 py-2 border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>
            </div>
            <button 
              onClick={() => { setShowEditFund(false); toast({ title: "Changes saved" }); }}
              className="w-full py-2.5 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Modal */}
      <Dialog open={showEditEvent !== null} onOpenChange={() => setShowEditEvent(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="font-medium">Edit event</DialogTitle>
          </DialogHeader>
          {showEditEvent !== null && (
            <div className="py-4 space-y-4">
              {(() => {
                const event = funds[0]?.events.find(e => e.id === showEditEvent);
                const current = eventEdits[showEditEvent] || { title: event?.title || "", slug: event?.slug || "" };
                return (
                  <>
                    <div>
                      <label className="block text-sm text-stone-500 mb-2">Event name</label>
                      <input
                        type="text"
                        value={current.title}
                        onChange={(e) => setEventEdits(prev => ({ ...prev, [showEditEvent]: { ...current, title: e.target.value } }))}
                        className="w-full px-3 py-2 border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-stone-500 mb-2">URL</label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-stone-400 truncate">everleaf.com/{fundSlug}/</span>
                        <input
                          type="text"
                          value={current.slug}
                          onChange={(e) => setEventEdits(prev => ({ ...prev, [showEditEvent]: { ...current, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") } }))}
                          className="flex-1 px-2 py-2 border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => { setShowEditEvent(null); toast({ title: "Changes saved" }); }}
                      className="w-full py-2.5 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors"
                    >
                      Save
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
