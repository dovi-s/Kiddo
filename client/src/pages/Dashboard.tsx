import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useSearch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Pencil, Copy, QrCode, ExternalLink, Plus, User, Users } from "lucide-react";

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
  const childrenParam = params.get("children");
  const isPersonal = accountType === "personal";

  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [expandedFund, setExpandedFund] = useState<number | null>(1);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showEditFund, setShowEditFund] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState<number | null>(null);
  const [showPageQR, setShowPageQR] = useState<string | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddFund, setShowAddFund] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  
  const isNewAccount = params.get("new") === "true";
  
  const [fundName, setFundName] = useState(profileName);
  const [fundSlugEdit, setFundSlugEdit] = useState(profileName.toLowerCase().replace(/\s+/g, "-"));
  const [eventEdits, setEventEdits] = useState<Record<number, { title: string; slug: string }>>({});
  const [selectedFundSlug, setSelectedFundSlug] = useState(profileName.toLowerCase().replace(/\s+/g, "-"));

  const fundSlug = selectedFundSlug;
  const momentLink = `kora.com/${fundSlug}`;

  const handleCopy = (link?: string) => {
    navigator.clipboard?.writeText(`https://${link || momentLink}`);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyClick = () => handleCopy();

  const childNames = childrenParam ? decodeURIComponent(childrenParam).split(",") : [profileName];
  
  type FundStatus = "draft" | "pending" | "active" | "needs_action";
  
  const funds = isPersonal ? [
    {
      id: 1,
      name: profileName,
      slug: profileName.toLowerCase().replace(/\s+/g, "-"),
      accountType: "Individual",
      status: (isNewAccount ? "draft" : "active") as FundStatus,
      balance: isNewAccount ? 0 : 4250,
      gain: isNewAccount ? 0 : 472,
      gainPercent: isNewAccount ? 0 : 12.5,
      contributors: isNewAccount ? 0 : 18,
      projection: isNewAccount ? 0 : 28400,
      yearsLeft: 20,
      isNew: isNewAccount,
      events: isNewAccount ? [
        { id: 1, slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
      ] : [
        { id: 1, slug: "anytime", title: "Open anytime", raised: 2180, gifts: 12, active: true },
        { id: 2, slug: "30th-birthday", title: "30th Birthday", raised: 1420, gifts: 8, date: "Dec 2025", active: false },
        { id: 3, slug: "mba-graduation", title: "MBA Graduation", raised: 650, gifts: 4, date: "May 2026", active: true },
      ]
    },
  ] : childNames.map((name, index) => ({
    id: index + 1,
    name: name.trim(),
    slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
    accountType: "UTMA",
    status: (isNewAccount ? "draft" : "active") as FundStatus,
    balance: isNewAccount ? 0 : (index === 0 ? 4250 : index === 1 ? 1820 : 650),
    gain: isNewAccount ? 0 : (index === 0 ? 472 : index === 1 ? 156 : 42),
    gainPercent: isNewAccount ? 0 : (index === 0 ? 12.5 : index === 1 ? 9.4 : 6.9),
    contributors: isNewAccount ? 0 : (index === 0 ? 18 : index === 1 ? 8 : 3),
    projection: isNewAccount ? 0 : (index === 0 ? 28400 : index === 1 ? 12200 : 4350),
    yearsLeft: index === 0 ? 14 : index === 1 ? 16 : 17,
    isNew: isNewAccount,
    events: isNewAccount ? [
      { id: index * 10 + 1, slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
    ] : (index === 0 ? [
      { id: 1, slug: "anytime", title: "Open anytime", raised: 2180, gifts: 12, active: true },
      { id: 2, slug: "5th-birthday", title: "5th Birthday", raised: 1420, gifts: 8, date: "Dec 2025", active: false },
      { id: 3, slug: "kindergarten-graduation", title: "Kindergarten", raised: 650, gifts: 4, date: "May 2026", active: true },
    ] : index === 1 ? [
      { id: 4, slug: "anytime", title: "Open anytime", raised: 1200, gifts: 6, active: true },
      { id: 5, slug: "3rd-birthday", title: "3rd Birthday", raised: 620, gifts: 4, date: "Mar 2025", active: true },
    ] : [
      { id: 6, slug: "anytime", title: "Open anytime", raised: 650, gifts: 3, active: true },
    ])
  }));
  
  const selectedFund = funds.find(f => f.slug === selectedFundSlug) || funds[0];
  
  const getStatusLabel = (status: FundStatus) => {
    switch (status) {
      case "draft": return "Not activated";
      case "pending": return "Verification pending";
      case "active": return "Active";
      case "needs_action": return "Needs attention";
    }
  };
  
  const getStatusColor = (status: FundStatus) => {
    switch (status) {
      case "draft": return "bg-stone-100 text-stone-600";
      case "pending": return "bg-amber-100 text-amber-700";
      case "active": return "bg-blue-100 text-blue-700";
      case "needs_action": return "bg-red-100 text-red-700";
    }
  };

  const portfolioValue = funds.reduce((sum, f) => sum + f.balance, 0);
  const marketChange = funds.reduce((sum, f) => sum + f.gain, 0);
  const totalReceived = portfolioValue - marketChange;
  const investedAmount = Math.round(portfolioValue * 0.85);
  const cashAmount = portfolioValue - investedAmount;
  const pendingAmount = isNewAccount ? 0 : 180;

  const holdings = [
    { ticker: "VTI", name: "US Total Market ETF", shares: 12.4, value: 2125, gain: 245 },
    { ticker: "VXUS", name: "International ETF", shares: 8.2, value: 850, gain: 72 },
    { ticker: "DIS", name: "Disney", shares: 3.5, value: 425, gain: 38 },
    { ticker: "AAPL", name: "Apple", shares: 2.1, value: 400, gain: 85 },
  ];

  const portfolio = [
    { name: "US Total Market", allocation: "50%", value: 2125 },
    { name: "International Developed", allocation: "20%", value: 850 },
    { name: "Bonds", allocation: "15%", value: 638 },
    { name: "Cash", allocation: "15%", value: 637 },
  ];

  const recentActivity = [
    { from: "Dave Chen", amount: 180, event: "5th Birthday", time: "2 hours ago", note: "So proud of you", status: "pending" as const },
    { from: "Ruth Stein", amount: 500, event: "Open anytime", time: "Yesterday", note: "With love", status: "invested" as const },
    { from: "Michael Park", amount: 100, event: "Open anytime", time: "3 days ago", note: null, status: "invested" as const },
  ];

  const pendingThankYous = recentActivity.filter(a => a.status === "invested").length;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                <path 
                  d="M8 6v20M8 16l10-10M8 16l10 10" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="text-stone-900"
                />
              </svg>
              <span className="font-medium text-stone-900 text-[15px]" style={{ letterSpacing: '0.04em' }}>kora</span>
            </Link>
            {funds.length > 1 && (
              <select 
                value={selectedFundSlug}
                onChange={(e) => setSelectedFundSlug(e.target.value)}
                className="text-sm text-stone-600 bg-transparent border-0 cursor-pointer hover:text-stone-900 transition-colors focus:outline-none focus:ring-0"
                data-testid="select-fund-switcher"
              >
                {funds.map(f => (
                  <option key={f.slug} value={f.slug}>{f.name}'s Fund</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowAddFund(true)}
              data-testid="button-add-fund"
              className="text-sm text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add fund</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/send">
              <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-send">Send a gift</span>
            </Link>
            <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
              <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-settings">Settings</span>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-12">
          
          {/* Main column */}
          <div className="lg:col-span-2">
            
            {/* Financial Overview */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-10 lg:mb-12"
            >
              {/* Status chip */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(selectedFund.status)}`}>
                  {getStatusLabel(selectedFund.status)}
                </span>
                {selectedFund.status === "pending" && (
                  <span className="text-xs text-stone-400">Usually under 2 minutes, sometimes up to 24 hours</span>
                )}
              </div>
              
              {selectedFund.status === "draft" ? (
                <>
                  {/* Draft state - show activate prompt */}
                  <p className="text-sm text-stone-500 mb-1">Portfolio value</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-stone-900 mb-3">
                    $0
                  </h1>
                  
                  <div className="p-4 rounded-xl bg-stone-100 border border-stone-200 mb-4">
                    <p className="text-sm text-stone-600 mb-3">
                      {funds.length === 1 
                        ? `${funds[0].name}'s fund is ready to share. Activate investing to accept gifts.`
                        : `${selectedFund.name}'s fund is ready to share. Activate investing to accept gifts.`
                      }
                    </p>
                    <Link href={`/activate?type=${accountType}&children=${childrenParam || ""}`}>
                      <Button 
                        data-testid="button-activate-investing"
                        className="bg-stone-900 text-white hover:bg-stone-800"
                      >
                        Activate investing
                      </Button>
                    </Link>
                    <p className="text-xs text-stone-400 mt-3">Takes about 2 minutes. Identity verification required.</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-700">
                      <strong>Gift rules:</strong> Contributors can pledge gifts now. Pledges convert to real gifts once you activate investing.
                    </p>
                  </div>
                </>
              ) : selectedFund.status === "pending" ? (
                <>
                  {/* Pending verification state */}
                  <p className="text-sm text-stone-500 mb-1">Portfolio value</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-stone-900 mb-3">
                    $0
                  </h1>
                  
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 mb-4">
                    <p className="text-xs text-amber-700">
                      <strong>Gift rules:</strong> Gifts will be held as cash (Seed) until verification completes. They will auto-invest once your account is active.
                    </p>
                  </div>
                  
                  <p className="text-sm text-stone-500">
                    We're verifying your identity. This usually takes under 2 minutes.
                  </p>
                </>
              ) : selectedFund.status === "needs_action" ? (
                <>
                  {/* Needs action state */}
                  <p className="text-sm text-stone-500 mb-1">Portfolio value</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-stone-900 mb-3">
                    $0
                  </h1>
                  
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 mb-4">
                    <p className="text-sm text-red-700 mb-3">
                      We need additional information to verify your identity. This is common and usually takes just a minute to resolve.
                    </p>
                    <Link href={`/activate?type=${accountType}&children=${childrenParam || ""}&retry=true`}>
                      <Button 
                        data-testid="button-retry-verification"
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        Complete verification
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-700">
                      <strong>Gift rules:</strong> Gifts will be held as cash until verification is complete.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Active state - show metrics */}
                  <div className="grid grid-cols-2 gap-6 sm:gap-8 mb-4">
                    <div>
                      <p className="text-sm text-stone-500 mb-1">Total received</p>
                      <p className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight text-stone-900">
                        <AnimatedValue value={totalReceived} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-stone-500 mb-1">Portfolio value</p>
                      <p className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight text-stone-900">
                        <AnimatedValue value={portfolioValue} />
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className={marketChange >= 0 ? "text-emerald-700" : "text-red-600"}>
                      {marketChange >= 0 ? "+" : ""}{marketChange.toLocaleString()} market change
                    </span>
                    {pendingAmount > 0 && (
                      <>
                        <span className="text-stone-300">|</span>
                        <span className="text-amber-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          ${pendingAmount} pending
                        </span>
                      </>
                    )}
                  </div>
                  
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 mt-4">
                    <p className="text-xs text-blue-700">
                      <strong>Gift rules:</strong> {portfolioValue === 0 
                        ? "Share your link and contributions will automatically invest per your settings."
                        : "Gifts are accepted and invested automatically when markets are open."
                      }
                    </p>
                  </div>
                </>
              )}
            </motion.div>

            {/* Portfolio Preview */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={() => setShowPortfolio(true)}
              data-testid="button-portfolio"
              className="w-full mb-8 lg:mb-10 text-left group"
            >
              <div className="flex h-2 lg:h-2.5 rounded-full overflow-hidden mb-2 bg-stone-200">
                <div className="bg-stone-900 transition-all group-hover:opacity-90" style={{ width: "50%" }} title="Stocks 50%" />
                <div className="bg-stone-600" style={{ width: "20%" }} title="International 20%" />
                <div className="bg-stone-400" style={{ width: "15%" }} title="Bonds 15%" />
                <div className="bg-stone-300" style={{ width: "15%" }} title="Cash 15%" />
              </div>
              <div className="flex gap-4 text-xs text-stone-400 group-hover:text-stone-500 transition-colors">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-900"></span>Stocks</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-600"></span>Int'l</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-400"></span>Bonds</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-300"></span>Cash</span>
              </div>
            </motion.button>

            {/* Share - Mobile only */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8 lg:hidden p-5 rounded-lg bg-white border border-stone-200"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-stone-500">Share your page</p>
                <button 
                  onClick={() => setShowEditFund(true)}
                  data-testid="button-edit-share-mobile"
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Edit
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-stone-50 rounded text-sm text-stone-600 truncate">
                  {momentLink}
                </div>
                <button 
                  onClick={handleCopyClick}
                  data-testid="button-copy-mobile"
                  className="px-4 py-2 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button 
                  onClick={() => setShowQR(true)}
                  data-testid="button-qr-mobile"
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
              className="mb-10 lg:mb-12"
            >
              {funds.map((fund) => (
                <div key={fund.id} className="mb-6">
                  
                  <div className="border border-stone-200 rounded-lg bg-white overflow-hidden">
                    <button
                      onClick={() => {
                        setExpandedFund(expandedFund === fund.id ? null : fund.id);
                        setSelectedFundSlug(fund.slug);
                      }}
                      data-testid={`button-expand-fund-${fund.id}`}
                      className="w-full p-4 sm:p-5 flex items-center gap-4 text-left hover:bg-stone-50 transition-colors group"
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-stone-900">{fund.name}'s Fund</p>
                          <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider px-1.5 py-0.5 bg-stone-100 rounded">
                            {fund.accountType}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 truncate">kora.com/{fund.slug}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-medium text-stone-900">${fund.balance.toLocaleString()}</p>
                        <p className="text-sm text-emerald-700">+{fund.gainPercent}%</p>
                      </div>
                    </button>

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
                            
                            <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 gap-3">
                              <div>
                                <p className="text-sm text-stone-500">
                                  <span className="text-stone-400">Projection:</span> {isPersonal ? "In 20 years" : `When ${fund.name} turns 18`}: <span className="font-medium text-stone-900">${fund.projection.toLocaleString()}</span>
                                </p>
                                <p className="text-xs text-stone-400">{fund.contributors} contributors</p>
                                <p className="text-[10px] text-stone-300 mt-1">Assumes 7% annual return. Not guaranteed.</p>
                              </div>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => setShowEditFund(true)}
                                  data-testid="button-edit-fund"
                                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  onClick={handleCopyClick}
                                  data-testid="button-copy-link"
                                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                                  title="Copy link"
                                >
                                  <Copy size={14} />
                                </button>
                                <button 
                                  onClick={() => setShowQR(true)}
                                  data-testid="button-show-qr"
                                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                                  title="QR code"
                                >
                                  <QrCode size={14} />
                                </button>
                                <Link href={`/${fundSlug}`}>
                                  <button 
                                    className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors" 
                                    title="View fund & events"
                                    data-testid="button-view-fund"
                                  >
                                    <ExternalLink size={14} />
                                  </button>
                                </Link>
                              </div>
                            </div>

                            <div className="px-4 sm:px-5 py-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Events</p>
                                <Link href="/moment/create" className="text-xs text-stone-500 hover:text-stone-900 transition-colors">
                                  + New event
                                </Link>
                              </div>
                              
                              <div className="space-y-0">
                                {fund.events.map((event, idx) => {
                                  const eventData = eventEdits[event.id] || { title: event.title, slug: event.slug };
                                  const isLast = idx === fund.events.length - 1;
                                  return (
                                    <div key={event.id} className="flex">
                                      <div className="w-6 flex flex-col items-center mr-2">
                                        <div className={`w-px bg-stone-200 ${idx === 0 ? 'h-3' : 'h-full'}`} />
                                        <div className="w-3 h-px bg-stone-200" style={{ marginTop: idx === 0 ? 0 : -12 }} />
                                        {!isLast && <div className="w-px bg-stone-200 flex-1" />}
                                      </div>
                                      
                                      <div className="flex-1 py-2 flex items-center justify-between group">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <div className={`h-2 w-2 rounded-full shrink-0 ${event.active ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                                          <div className="min-w-0">
                                            <p className="text-sm text-stone-900 truncate">{eventData.title}</p>
                                            <p className="text-xs text-stone-400 truncate">/{fundSlug}/{eventData.slug}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <p className="text-sm text-stone-600 mr-2">${event.raised.toLocaleString()}</p>
                                          <Link href={`/edit/${fundSlug}/${eventData.slug}`}>
                                            <button 
                                              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                                              title="Edit event"
                                              data-testid={`button-edit-event-${event.id}`}
                                            >
                                              <Pencil size={12} />
                                            </button>
                                          </Link>
                                          <button 
                                            onClick={() => { navigator.clipboard.writeText(`kora.com/${fundSlug}/${eventData.slug}`); toast({ title: "Link copied" }); }}
                                            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                                            title="Copy link"
                                            data-testid={`button-copy-event-${event.id}`}
                                          >
                                            <Copy size={12} />
                                          </button>
                                          <button 
                                            onClick={() => setShowPageQR(`kora.com/${fundSlug}/${eventData.slug}`)}
                                            className="hidden sm:block p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="QR code"
                                            data-testid={`button-qr-event-${event.id}`}
                                          >
                                            <QrCode size={12} />
                                          </button>
                                          <Link href={`/${fundSlug}/${eventData.slug}`}>
                                            <button 
                                              className="hidden sm:block p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded opacity-0 group-hover:opacity-100 transition-all" 
                                              title="View event"
                                              data-testid={`button-view-event-${event.id}`}
                                            >
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
                  <div key={i} className="flex items-start justify-between p-4 bg-white border border-stone-200 rounded-lg lg:border-0 lg:bg-transparent lg:p-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-stone-900">
                          <span className="font-medium">{item.from}</span>
                          <span className="text-stone-400 mx-1.5">→</span>
                          <span>{item.event}</span>
                        </p>
                        {item.status === "pending" ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                            Pending
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                            Invested
                          </span>
                        )}
                      </div>
                      {item.note && (
                        <p className="text-sm text-stone-500 mt-0.5 truncate">"{item.note}"</p>
                      )}
                      <p className="text-xs text-stone-400 mt-1">
                        {item.time}
                        {item.status === "pending" && " · Will invest when markets open"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-stone-900 shrink-0 ml-4">+${item.amount}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar - Desktop only */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              
              {/* Share Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="p-5 rounded-lg bg-white border border-stone-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-stone-900">Share your page</p>
                  <button 
                    onClick={() => setShowEditFund(true)}
                    data-testid="button-edit-share"
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Edit
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="px-3 py-2.5 bg-stone-50 rounded text-sm text-stone-600 truncate">
                    {momentLink}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCopyClick}
                      data-testid="button-copy-desktop"
                      className="flex-1 py-2.5 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors"
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <button 
                      onClick={() => setShowQR(true)}
                      data-testid="button-qr-desktop"
                      className="px-4 py-2.5 border border-stone-200 rounded text-sm hover:bg-stone-50 transition-colors"
                    >
                      QR
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="p-5 rounded-lg bg-white border border-stone-200"
              >
                <p className="text-sm font-medium text-stone-900 mb-4">Quick actions</p>
                <div className="space-y-2">
                  <button 
                    onClick={handleCopyClick}
                    data-testid="button-quick-share"
                    className="w-full py-2.5 bg-stone-900 text-stone-50 rounded text-sm font-medium hover:bg-stone-800 transition-colors text-left px-3"
                  >
                    Share link
                  </button>
                  <Link href="/moment/create" className="block">
                    <button 
                      data-testid="button-new-event"
                      className="w-full py-2.5 border border-stone-200 rounded text-sm text-stone-700 hover:bg-stone-50 transition-colors text-left px-3"
                    >
                      Create event page
                    </button>
                  </Link>
                  <button 
                    data-testid="button-thank-yous"
                    className="w-full py-2.5 border border-stone-200 rounded text-sm text-stone-700 hover:bg-stone-50 transition-colors text-left px-3 flex items-center justify-between"
                  >
                    <span>Send thank-yous</span>
                    {pendingThankYous > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendingThankYous} pending</span>
                    )}
                  </button>
                  <Link href="/send" className="block">
                    <button 
                      data-testid="button-send-gift"
                      className="w-full py-2.5 border border-stone-200 rounded text-sm text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-colors text-left px-3"
                    >
                      Send a gift
                    </button>
                  </Link>
                </div>
              </motion.div>

              {/* Brokerage Footer */}
              <p className="text-xs text-stone-400 text-center pt-4">
                Brokerage services by Alpaca Securities LLC<br />
                Member FINRA/SIPC
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <p className="lg:hidden text-xs text-stone-400 text-center mt-12 pb-8">
          Brokerage services by Alpaca Securities LLC<br />
          Member FINRA/SIPC
        </p>
      </main>

      {/* Portfolio Modal */}
      <Dialog open={showPortfolio} onOpenChange={setShowPortfolio}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="font-medium">Where it's invested</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
              <div>
                <p className="text-sm text-stone-500">Invested</p>
                <p className="text-lg font-medium text-stone-900">${investedAmount.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-stone-500">Cash</p>
                <p className="text-lg font-medium text-stone-900">${cashAmount.toLocaleString()}</p>
              </div>
            </div>
            
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Holdings</p>
            <div className="space-y-3">
              {holdings.map((holding, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-stone-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-stone-600 bg-white px-2 py-1 rounded border border-stone-200">{holding.ticker}</span>
                    <div>
                      <p className="text-sm text-stone-900">{holding.name}</p>
                      <p className="text-xs text-stone-400">{holding.shares} shares</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-stone-900">${holding.value.toLocaleString()}</p>
                    <p className="text-xs text-emerald-600">+${holding.gain}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-stone-400 pt-4 mt-4 border-t border-stone-100">
              Holdings are at the Fund level. Gifts from all events invest into the same account.
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

      {/* Fund Settings Panel */}
      <Dialog open={showEditFund} onOpenChange={setShowEditFund}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          
          <div className="p-5 border-b border-stone-100">
            <div className="flex items-center justify-between mb-1">
              <DialogTitle className="font-medium text-stone-900">Fund Settings</DialogTitle>
              <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider px-2 py-1 bg-stone-100 rounded">
                {isPersonal ? "Individual" : "UTMA"}
              </span>
            </div>
            <p className="text-sm text-stone-500">Manage your fund and events</p>
          </div>

          <div className="p-5 border-b border-stone-100 space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Fund name</label>
              <input
                type="text"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                data-testid="input-fund-name"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Fund URL</label>
              <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                <span className="px-3 py-2.5 bg-stone-50 text-sm text-stone-400 border-r border-stone-200">kora.com/</span>
                <input
                  type="text"
                  value={fundSlugEdit}
                  onChange={(e) => setFundSlugEdit(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  data-testid="input-fund-slug"
                  className="flex-1 px-3 py-2.5 text-stone-900 focus:outline-none"
                />
              </div>
              <p className="text-xs text-stone-400 mt-1.5">Your fund's shareable link — contributors can give anytime</p>
            </div>
          </div>

          <div className="p-5 border-b border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-stone-400 uppercase tracking-wider">Events</label>
              <Link href="/moment/create" onClick={() => setShowEditFund(false)}>
                <span className="text-xs text-stone-500 hover:text-stone-900 transition-colors">+ Add event</span>
              </Link>
            </div>
            
            <div className="space-y-2">
              {funds[0]?.events.map((event) => {
                const eventData = eventEdits[event.id] || { title: event.title, slug: event.slug };
                return (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${event.active ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      <p className="text-sm text-stone-900 truncate">{eventData.title}</p>
                    </div>
                    <button 
                      onClick={() => setShowEditEvent(event.id)}
                      data-testid={`button-edit-modal-event-${event.id}`}
                      className="text-xs text-stone-400 hover:text-stone-600 shrink-0 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5">
            <button 
              onClick={() => setShowEditFund(false)}
              data-testid="button-done"
              className="w-full py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Fund Modal */}
      <Dialog open={showAddFund} onOpenChange={setShowAddFund}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          <div className="p-5 border-b border-stone-100">
            <DialogTitle className="font-medium text-stone-900">Add a fund</DialogTitle>
            <p className="text-sm text-stone-500 mt-1">Each fund is a separate brokerage account</p>
          </div>
          
          <div className="p-5 space-y-3">
            <button
              onClick={() => {
                setShowAddFund(false);
                setShowAddChild(true);
              }}
              data-testid="button-add-child-fund"
              className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-300 bg-white text-left transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center transition-colors">
                  <Users size={18} className="text-stone-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-stone-900">Add a child</p>
                  <p className="text-sm text-stone-500 mt-0.5">Open a custodial account (UTMA)</p>
                </div>
              </div>
            </button>

            {!isPersonal && (
              <button
                onClick={() => {
                  setShowAddFund(false);
                  setLocation("/get-started?intent=personal");
                }}
                data-testid="button-add-personal-fund"
                className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-300 bg-white text-left transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center transition-colors">
                    <User size={18} className="text-stone-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-stone-900">Open a personal fund</p>
                    <p className="text-sm text-stone-500 mt-0.5">For yourself (individual brokerage)</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Child Modal */}
      <Dialog open={showAddChild} onOpenChange={setShowAddChild}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          <div className="p-5 border-b border-stone-100">
            <DialogTitle className="font-medium text-stone-900">Add a child</DialogTitle>
            <p className="text-sm text-stone-500 mt-1">We'll create a custodial account for them</p>
          </div>
          
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Child's first name</label>
              <input
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="e.g., Mila"
                data-testid="input-new-child-name"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
              />
            </div>
          </div>

          <div className="p-5 border-t border-stone-100">
            <button 
              onClick={() => {
                if (newChildName.trim()) {
                  const newChildren = childrenParam 
                    ? `${decodeURIComponent(childrenParam)},${newChildName.trim()}`
                    : newChildName.trim();
                  setShowAddChild(false);
                  setNewChildName("");
                  setLocation(`/onboard?type=child&name=${encodeURIComponent(newChildName.trim())}&email=user@example.com&children=${encodeURIComponent(newChildren)}`);
                }
              }}
              disabled={!newChildName.trim()}
              data-testid="button-continue-add-child"
              className="w-full py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Edit Modal */}
      <Dialog open={showEditEvent !== null} onOpenChange={() => setShowEditEvent(null)}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          {showEditEvent !== null && (() => {
            const event = funds[0]?.events.find(e => e.id === showEditEvent);
            if (!event) return null;
            const eventData = eventEdits[showEditEvent] || { title: event.title, slug: event.slug };
            
            return (
              <>
                <div className="p-5 border-b border-stone-100">
                  <DialogTitle className="font-medium text-stone-900">Edit Event</DialogTitle>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Event name</label>
                    <input
                      type="text"
                      value={eventData.title}
                      onChange={(e) => setEventEdits(prev => ({
                        ...prev,
                        [showEditEvent]: { ...eventData, title: e.target.value }
                      }))}
                      data-testid="input-event-title"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Event URL</label>
                    <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                      <span className="px-3 py-2.5 bg-stone-50 text-sm text-stone-400 border-r border-stone-200 truncate">kora.com/{fundSlug}/</span>
                      <input
                        type="text"
                        value={eventData.slug}
                        onChange={(e) => setEventEdits(prev => ({
                          ...prev,
                          [showEditEvent]: { ...eventData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }
                        }))}
                        data-testid="input-event-url"
                        className="flex-1 px-3 py-2.5 text-stone-900 focus:outline-none min-w-0"
                      />
                    </div>
                  </div>
                  <Link href={`/edit/${fundSlug}/${eventData.slug}`} onClick={() => setShowEditEvent(null)}>
                    <button 
                      data-testid="button-full-editor"
                      className="w-full py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      Open full editor
                    </button>
                  </Link>
                </div>
                <div className="p-5 border-t border-stone-100">
                  <button 
                    onClick={() => setShowEditEvent(null)}
                    data-testid="button-save-event"
                    className="w-full py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
