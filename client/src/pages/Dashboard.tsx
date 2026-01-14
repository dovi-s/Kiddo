import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useSearch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Pencil, Copy, QrCode, ExternalLink, Plus, User, Users, Archive, Eye, FileText, ChevronDown, ChevronUp, ChevronRight, Info, Sparkles, Trophy, Share2, TrendingUp, Clock, Gift, Shield } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { staggerContainer, fadeInUp, liftCard, gentleSpring, bouncySpring } from "@/lib/animations";
import { AchievementBadge, getDefaultAchievements } from "@/components/ui/achievements";
import { LiveContributorTicker, ContributorBubbles } from "@/components/ui/live-ticker";
import { ShareKit } from "@/components/ui/share-kit";

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

type FundStatus = "draft" | "pending" | "active" | "needs_action";

interface StoredFund {
  id: number;
  name: string;
  slug: string;
  accountType: string;
  status: FundStatus;
  balance: number;
  gain: number;
  gainPercent: number;
  contributors: number;
  projection: number;
  yearsLeft: number;
  isNew: boolean;
  events: { id: number; slug: string; title: string; raised: number; gifts: number; date?: string; active: boolean }[];
}

const loadStoredFunds = (): StoredFund[] => {
  try {
    const stored = localStorage.getItem("kora_funds");
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const saveStoredFunds = (funds: StoredFund[]) => {
  try {
    localStorage.setItem("kora_funds", JSON.stringify(funds));
  } catch {}
};

export default function Dashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || "Mila");
  const childrenParam = params.get("children");
  const isPersonal = accountType === "personal";
  const isNewFund = params.get("new") === "true";
  const newFundName = params.get("newFund");

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
  const [showThankYous, setShowThankYous] = useState(false);
  const [sentThankYous, setSentThankYous] = useState<string[]>([]);
  const [snoozedThankYous, setSnoozedThankYous] = useState<string[]>([]);
  const [expandedThankYou, setExpandedThankYou] = useState<string | null>(null);
  const [thankYouDrafts, setThankYouDrafts] = useState<Record<string, string>>({});
  const [showContributors, setShowContributors] = useState(false);
  const [expandedContributor, setExpandedContributor] = useState<string | null>(null);
  const [composingThankYou, setComposingThankYou] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number>(0);
  const [customMessage, setCustomMessage] = useState("");
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [showGainAsPercent, setShowGainAsPercent] = useState(false);
  const [showFundPreview, setShowFundPreview] = useState(false);
  const [showGiftRules, setShowGiftRules] = useState(false);
  const [showShareKit, setShowShareKit] = useState(false);

  const [funds, setFunds] = useState<StoredFund[]>(() => {
    const stored = loadStoredFunds();
    if (stored.length > 0) return stored;
    
    const childNames = childrenParam ? decodeURIComponent(childrenParam).split(",") : [profileName];
    const isNewAccount = isNewFund;
    
    if (isPersonal) {
      return [{
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
      }];
    }
    
    return childNames.map((name, index) => ({
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
  });

  useEffect(() => {
    if (newFundName && !funds.some(f => f.name.toLowerCase() === newFundName.toLowerCase())) {
      const newFund: StoredFund = {
        id: funds.length + 1,
        name: newFundName,
        slug: newFundName.toLowerCase().replace(/\s+/g, "-"),
        accountType: "UTMA",
        status: "draft",
        balance: 0,
        gain: 0,
        gainPercent: 0,
        contributors: 0,
        projection: 0,
        yearsLeft: 18,
        isNew: true,
        events: [
          { id: Date.now(), slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
        ]
      };
      const updatedFunds = [...funds, newFund];
      setFunds(updatedFunds);
      saveStoredFunds(updatedFunds);
      toast({ title: `${newFundName}'s fund created`, description: "Activate investing to start growing gifts" });
    }
  }, [newFundName]);

  useEffect(() => {
    if (funds.length > 0) {
      saveStoredFunds(funds);
    }
  }, [funds]);

  const isNewAccount = funds.every(f => f.isNew);
  
  const [fundName, setFundName] = useState(funds[0]?.name || profileName);
  const [fundSlugEdit, setFundSlugEdit] = useState((funds[0]?.slug || profileName).toLowerCase().replace(/\s+/g, "-"));
  const [eventEdits, setEventEdits] = useState<Record<number, { title: string; slug: string }>>({});
  const [selectedFundSlug, setSelectedFundSlug] = useState(funds[0]?.slug || profileName.toLowerCase().replace(/\s+/g, "-"));

  const fundSlug = selectedFundSlug;
  const momentLink = `kora.com/${fundSlug}`;

  const handleCopy = (link?: string) => {
    navigator.clipboard?.writeText(`https://${link || momentLink}`);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyClick = () => handleCopy();
  
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
      case "draft": return "bg-muted text-muted-foreground";
      case "pending": return "bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))]";
      case "active": return "bg-[hsl(var(--kora-evergreen)/0.15)] text-[hsl(var(--kora-evergreen))]";
      case "needs_action": return "bg-destructive/15 text-destructive";
    }
  };

  const portfolioValue = funds.reduce((sum, f) => sum + f.balance, 0);
  const marketChange = funds.reduce((sum, f) => sum + f.gain, 0);
  const totalReceived = portfolioValue - marketChange;
  const marketChangePercent = totalReceived > 0 ? ((marketChange / totalReceived) * 100).toFixed(1) : "0";
  const investedAmount = Math.round(portfolioValue * 0.85);
  const cashAmount = portfolioValue - investedAmount;
  const pendingAmount = isNewAccount ? 0 : 180;

  const holdings = isNewAccount ? [] : [
    { ticker: "VTI", name: "US Total Market ETF", shares: 12.4, value: 2125, gain: 245 },
    { ticker: "VXUS", name: "International ETF", shares: 8.2, value: 850, gain: 72 },
    { ticker: "DIS", name: "Disney", shares: 3.5, value: 425, gain: 38 },
    { ticker: "AAPL", name: "Apple", shares: 2.1, value: 400, gain: 85 },
  ];

  const portfolio = isNewAccount ? [] : [
    { name: "US Total Market", allocation: "50%", value: 2125 },
    { name: "International Developed", allocation: "20%", value: 850 },
    { name: "Bonds", allocation: "15%", value: 638 },
    { name: "Cash", allocation: "15%", value: 637 },
  ];

  const allContributions = isNewAccount ? [] : [
    { id: "gift_1", from: "Dave Chen", email: "dave@example.com", amount: 180, event: "5th Birthday", date: new Date(Date.now() - 2 * 60 * 60 * 1000), note: "So proud of you", status: "pending" as const },
    { id: "gift_2", from: "Ruth Stein", email: "ruth@example.com", amount: 500, event: "Open anytime", date: new Date(Date.now() - 24 * 60 * 60 * 1000), note: "With love", status: "invested" as const },
    { id: "gift_3", from: "Michael Park", email: "michael@example.com", amount: 100, event: "Open anytime", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), note: null, status: "invested" as const },
    { id: "gift_4", from: "Sarah Johnson", email: "sarah@example.com", amount: 250, event: "5th Birthday", date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), note: "Happy birthday sweetie!", status: "invested" as const },
    { id: "gift_5", from: "The Goldbergs", email: "goldberg@example.com", amount: 100, event: "5th Birthday", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), note: "Wishing you the best!", status: "invested" as const },
    { id: "gift_6", from: "Uncle James", email: "james@example.com", amount: 300, event: "Open anytime", date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), note: "For your future", status: "invested" as const },
    { id: "gift_7", from: "Aunt Lisa", email: "lisa@example.com", amount: 75, event: "Kindergarten", date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), note: "Can't wait to see all you accomplish!", status: "invested" as const },
    { id: "gift_8", from: "The Cohens", email: "cohens@example.com", amount: 200, event: "Open anytime", date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), note: "Here's to many more milestones!", status: "invested" as const },
    { id: "gift_9", from: "Grandma Helen", email: "helen@example.com", amount: 500, event: "5th Birthday", date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), note: "My beautiful grandchild", status: "invested" as const },
    { id: "gift_10", from: "Mom & Dad", email: "parents@example.com", amount: 1000, event: "Open anytime", date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), note: "Starting your journey", status: "invested" as const },
    { id: "gift_11", from: "Cousin Jake", email: "jake@example.com", amount: 50, event: "5th Birthday", date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), note: null, status: "invested" as const },
    { id: "gift_12", from: "The Petersons", email: "petersons@example.com", amount: 150, event: "Open anytime", date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), note: "Best wishes!", status: "invested" as const },
    { id: "gift_13", from: "Nana", email: "nana@example.com", amount: 250, event: "Kindergarten", date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), note: "So proud of you", status: "invested" as const },
    { id: "gift_14", from: "Friend from work", email: "work@example.com", amount: 100, event: "Open anytime", date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), note: "Congratulations!", status: "invested" as const },
    { id: "gift_15", from: "The Smiths", email: "smiths@example.com", amount: 75, event: "5th Birthday", date: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000), note: null, status: "invested" as const },
    { id: "gift_16", from: "Grandpa Joe", email: "joe@example.com", amount: 400, event: "Open anytime", date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), note: "For your college fund", status: "invested" as const },
    { id: "gift_17", from: "Aunt Maya", email: "maya@example.com", amount: 125, event: "Kindergarten", date: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000), note: "Love you!", status: "invested" as const },
    { id: "gift_18", from: "Family Friends", email: "friends@example.com", amount: 200, event: "Open anytime", date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), note: "Wishing you the best future", status: "invested" as const },
  ];

  const recentActivity = allContributions.slice(0, 3).map(c => ({
    ...c,
    time: c.date.getTime() > Date.now() - 3 * 60 * 60 * 1000 
      ? `${Math.round((Date.now() - c.date.getTime()) / (60 * 60 * 1000))} hours ago`
      : c.date.getTime() > Date.now() - 24 * 60 * 60 * 1000
        ? "Yesterday"
        : `${Math.round((Date.now() - c.date.getTime()) / (24 * 60 * 60 * 1000))} days ago`
  }));

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatRelativeTime = (date: Date) => {
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (hours < 1) return "Just now";
    if (hours < 2) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 14) return "Last week";
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return formatDate(date);
  };

  const thankYouTemplates = {
    heartfelt: (item: typeof recentActivity[0]) => {
      const firstName = item.from.split(" ")[0];
      return `Dear ${firstName}, thank you from the bottom of our hearts for your incredibly generous gift of $${item.amount}. It truly means the world to our family, and knowing that ${selectedFund.name} has people like you believing in their future fills us with joy. This gift will grow alongside ${selectedFund.name} for years to come. With love and gratitude.`;
    },
    simple: (item: typeof recentActivity[0]) => {
      const firstName = item.from.split(" ")[0];
      return `Thank you so much, ${firstName}! Your gift of $${item.amount} is so appreciated. We're excited to watch it grow for ${selectedFund.name}!`;
    },
    formal: (item: typeof recentActivity[0]) => {
      const firstName = item.from.split(" ")[0];
      return `Dear ${firstName}, thank you for your generous contribution of $${item.amount} to ${selectedFund.name}'s investment fund. Your thoughtful gift has been received and will be invested to help build their financial future. We sincerely appreciate your kindness and generosity.`;
    },
  };

  const getDefaultThankYou = (item: typeof recentActivity[0]) => {
    return thankYouTemplates.simple(item);
  };

  const pendingThankYous = recentActivity.filter(a => a.status === "invested" && !sentThankYous.includes(a.id) && !snoozedThankYous.includes(a.id)).length;
  const snoozedCount = recentActivity.filter(a => a.status === "invested" && snoozedThankYous.includes(a.id) && !sentThankYous.includes(a.id)).length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="text-primary" />
            {funds.length > 1 && (
              <select 
                value={selectedFundSlug}
                onChange={(e) => setSelectedFundSlug(e.target.value)}
                className="text-sm text-muted-foreground bg-transparent border-0 cursor-pointer hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-0"
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
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-1"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add fund</span>
            </button>
          </div>
          {/* Account access - icon on all viewports for minimal header */}
          <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
            <div className="w-8 h-8 rounded-full bg-muted hover:bg-border flex items-center justify-center text-muted-foreground transition-colors duration-200" data-testid="button-account">
              <User size={16} />
            </div>
          </Link>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        
        {/* Emotional Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 lg:mb-12"
        >
          <div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--kora-evergreen))] p-6 sm:p-8 lg:p-10">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4 sm:gap-6">
                {/* Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center text-[hsl(var(--kora-evergreen))] text-2xl sm:text-3xl font-medium shadow-lg">
                  {selectedFund.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">
                    {selectedFund.name}'s Future Fund
                  </h1>
                  <p className="text-white/70 text-sm sm:text-base mt-1">
                    {isPersonal 
                      ? "Building your financial future, one gift at a time"
                      : `${selectedFund.yearsLeft} years until ${selectedFund.name} turns 18`
                    }
                  </p>
                </div>
              </div>
              
              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowShareKit(true)}
                  data-testid="button-hero-share"
                  className="px-6 py-3 bg-white text-primary font-medium rounded-xl hover:bg-secondary transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <Share2 size={18} />
                  Share fund
                </button>
                <Link href="/event/create">
                  <button
                    data-testid="button-hero-create-event"
                    className="w-full sm:w-auto px-6 py-3 bg-white/20 text-white font-medium rounded-xl hover:bg-white/30 transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    New event
                  </button>
                </Link>
              </div>
            </div>
            
            {/* Trust badges */}
            <div className="relative z-10 mt-6 pt-6 border-t border-white/20 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--kora-gold))]"></span>
                Assets held by Apex Clearing
              </span>
              <span>SIPC protected up to $500k</span>
              <span>SEC registered</span>
            </div>
          </div>
        </motion.section>

        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-12">
          
          {/* Main column */}
          <div className="lg:col-span-2">
            
            {/* Financial Overview */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="mb-10 lg:mb-12"
            >
              {/* Status chip */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(selectedFund.status)}`}>
                  {getStatusLabel(selectedFund.status)}
                </span>
                {selectedFund.status === "pending" && (
                  <span className="text-xs text-muted-foreground">Usually under 2 minutes, sometimes up to 24 hours</span>
                )}
              </div>
              
              {selectedFund.status === "draft" ? (
                <>
                  {/* Draft state - premium activate prompt */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="bg-card border border-border rounded-2xl p-6 sm:p-8 mb-6"
                  >
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--kora-evergreen))] flex items-center justify-center">
                        <Shield size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">One more step</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {funds.length === 1 
                            ? `${funds[0].name}'s fund is ready. Activate investing to start receiving real gifts.`
                            : `${selectedFund.name}'s fund is ready. Activate investing to start receiving gifts.`
                          }
                        </p>
                      </div>
                    </div>
                    
                    <Link href={`/activate?type=${accountType}&children=${childrenParam || ""}`}>
                      <Button 
                        data-testid="button-activate-investing"
                        size="lg"
                        className="w-full h-14 text-base rounded-2xl bg-primary text-primary-foreground hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors duration-200"
                      >
                        Activate investing
                        <ChevronRight className="ml-2 w-5 h-5" />
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-4 text-center">Takes about 2 minutes. Identity verification required.</p>
                  </motion.div>
                  
                  <div className="p-4 rounded-xl bg-[hsl(var(--kora-gold)/0.1)] border border-[hsl(var(--kora-gold)/0.2)]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--kora-gold)/0.2)] flex items-center justify-center flex-shrink-0">
                        <Gift size={16} className="text-[hsl(var(--kora-gold))]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-0.5">Gift rules</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Contributors can pledge gifts now. Pledges convert to real gifts once you activate investing.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : selectedFund.status === "pending" ? (
                <>
                  {/* Pending verification state */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="bg-card border border-border rounded-2xl p-6 sm:p-8 mb-6"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--kora-gold))] flex items-center justify-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">Verifying your identity</h3>
                        <p className="text-sm text-muted-foreground">This usually takes under 2 minutes</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border">
                      <div className="flex -space-x-1">
                        <div className="w-2 h-2 rounded-full bg-[hsl(var(--kora-gold))] animate-pulse" />
                        <div className="w-2 h-2 rounded-full bg-[hsl(var(--kora-gold))] animate-pulse" style={{ animationDelay: "0.2s" }} />
                        <div className="w-2 h-2 rounded-full bg-[hsl(var(--kora-gold))] animate-pulse" style={{ animationDelay: "0.4s" }} />
                      </div>
                      <p className="text-xs text-muted-foreground">Verification in progress...</p>
                    </div>
                  </motion.div>
                  
                  <div className="p-4 rounded-xl bg-[hsl(var(--kora-gold)/0.1)] border border-[hsl(var(--kora-gold)/0.2)]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--kora-gold)/0.2)] flex items-center justify-center flex-shrink-0">
                        <Gift size={16} className="text-[hsl(var(--kora-gold))]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-0.5">Gift rules</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Gifts will be held as cash (Seed) until verification completes. They will auto-invest once your account is active.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : selectedFund.status === "needs_action" ? (
                <>
                  {/* Needs action state */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="bg-card border border-destructive/30 rounded-2xl p-6 sm:p-8 mb-6"
                  >
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-destructive flex items-center justify-center">
                        <Info size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">Additional info needed</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          We need a bit more information to verify your identity. This is common and usually takes just a minute.
                        </p>
                      </div>
                    </div>
                    
                    <Link href={`/activate?type=${accountType}&children=${childrenParam || ""}&retry=true`}>
                      <Button 
                        data-testid="button-retry-verification"
                        size="lg"
                        className="w-full h-14 text-base rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors duration-200"
                      >
                        Complete verification
                        <ChevronRight className="ml-2 w-5 h-5" />
                      </Button>
                    </Link>
                  </motion.div>
                  
                  <div className="p-4 rounded-xl bg-[hsl(var(--kora-gold)/0.1)] border border-[hsl(var(--kora-gold)/0.2)]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--kora-gold)/0.2)] flex items-center justify-center flex-shrink-0">
                        <Gift size={16} className="text-[hsl(var(--kora-gold))]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-0.5">Gift rules</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Gifts will be held as cash until verification is complete.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Active state - show metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    {/* Total Received - Clickable to show contributors */}
                    <motion.button 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.2 }}
                      onClick={() => setShowContributors(true)}
                      data-testid="button-show-contributors"
                      className="p-4 sm:p-5 rounded-xl bg-card border border-border hover:border-muted-foreground/30 transition-colors duration-200 text-left group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Gift size={14} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Received</p>
                        </div>
                        <ChevronRight size={14} className="text-border group-hover:text-muted-foreground transition-colors duration-200" />
                      </div>
                      <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                        <AnimatedValue value={totalReceived} />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground transition-colors duration-200">{selectedFund.contributors} contributors</p>
                    </motion.button>
                    
                    {/* Portfolio Value */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.2 }}
                      className="p-4 sm:p-5 rounded-xl bg-[hsl(var(--kora-evergreen))] text-white"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-white/70" />
                        <p className="text-xs text-white/70 uppercase tracking-wide">Value</p>
                      </div>
                      <p className="text-2xl sm:text-3xl font-semibold tracking-tight">
                        <AnimatedValue value={portfolioValue} />
                      </p>
                      <button 
                        onClick={() => setShowGainAsPercent(!showGainAsPercent)}
                        data-testid="button-toggle-gain-format"
                        className={`text-xs mt-1 ${marketChange >= 0 ? "text-[hsl(var(--kora-gold))]" : "text-red-400"} hover:underline cursor-pointer`}
                      >
                        {showGainAsPercent 
                          ? `${marketChange >= 0 ? "+" : ""}${marketChangePercent}%`
                          : `${marketChange >= 0 ? "+" : ""}$${Math.abs(marketChange).toLocaleString()}`
                        } growth
                      </button>
                    </motion.div>
                    
                    {/* Pending */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.2 }}
                      className="p-4 sm:p-5 rounded-xl bg-card border border-border"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={14} className="text-[hsl(var(--kora-gold))]" />
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
                      </div>
                      <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                        ${pendingAmount}
                      </p>
                      {pendingAmount > 0 && (
                        <p className="text-xs text-[hsl(var(--kora-gold))] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--kora-gold))] animate-pulse"></span>
                          Processing
                        </p>
                      )}
                      {pendingAmount === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">All settled</p>
                      )}
                    </motion.div>
                    
                    {/* Projection */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="p-4 sm:p-5 rounded-xl bg-success/10 border border-success/20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-success" />
                        <p className="text-xs text-success uppercase tracking-wide">
                          {isPersonal ? "In 20 yrs" : `At 18`}
                        </p>
                      </div>
                      <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                        ${selectedFund.projection.toLocaleString()}
                      </p>
                      <p className="text-xs text-success mt-1">7% annual return</p>
                    </motion.div>
                  </div>
                  
                  <button 
                    onClick={() => setShowGiftRules(!showGiftRules)}
                    className="w-full p-3 rounded-lg bg-muted/80 border border-border text-left hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Info size={12} />
                        How gifts work
                      </span>
                      {showGiftRules ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                    {showGiftRules && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {portfolioValue === 0 
                          ? "Share your link and contributions will automatically invest per your settings. Gifts typically settle in 1-2 business days."
                          : "Gifts are accepted and invested automatically when markets are open. Pending gifts invest at the next market open."
                        }
                      </p>
                    )}
                  </button>
                </>
              )}
            </motion.div>

            {/* Portfolio Preview - only show if has holdings */}
            {!isNewAccount && portfolio.length > 0 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                onClick={() => setShowPortfolio(true)}
                data-testid="button-portfolio"
                className="w-full mb-8 lg:mb-10 text-left group"
              >
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Allocation</p>
                <div className="flex h-2 lg:h-2.5 rounded-full overflow-hidden mb-2 bg-border">
                  <div className="bg-primary transition-all group-hover:opacity-90" style={{ width: "50%" }} title="Stocks 50%" />
                  <div className="bg-muted-foreground" style={{ width: "20%" }} title="International 20%" />
                  <div className="bg-muted-foreground/50" style={{ width: "15%" }} title="Bonds 15%" />
                  <div className="bg-border" style={{ width: "15%" }} title="Cash 15%" />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground group-hover:text-muted-foreground transition-colors">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"></span>Stocks 50%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground"></span>Int'l 20%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>Bonds 15%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border"></span>Cash 15%</span>
                </div>
              </motion.button>
            )}


            {/* Live Activity - Shows recent contributors */}
            {selectedFund?.status === "active" && selectedFund.contributors > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-8"
              >
                <LiveContributorTicker />
              </motion.div>
            )}

            {/* Milestones - All viewports */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8 p-5 rounded-xl bg-card border border-border"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-foreground">Milestones</p>
                <Trophy className="w-4 h-4 text-[hsl(var(--kora-gold))]" />
              </div>
              {(() => {
                const achievements = getDefaultAchievements(
                  selectedFund?.balance || 0,
                  selectedFund?.contributors || 0,
                  180
                );
                const unlockedCount = achievements.filter(a => a.unlocked).length;
                return (
                  <>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {achievements.slice(0, 6).map((achievement) => (
                        <AchievementBadge key={achievement.id} achievement={achievement} size="md" />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedFund?.status === "active" 
                        ? `${unlockedCount} of 6 milestones unlocked`
                        : "Activate investing to start unlocking milestones"}
                    </p>
                  </>
                );
              })()}
            </motion.div>

            {/* Events Section - Cleaner card-based design */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-10 lg:mb-12"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Events</h2>
                <Link href="/event/create">
                  <button 
                    data-testid="button-create-event"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted flex items-center gap-1"
                  >
                    <Plus size={12} />
                    New event
                  </button>
                </Link>
              </div>
              
              <div className="grid gap-3">
                {selectedFund?.events.map((event) => {
                  const eventData = eventEdits[event.id] || { title: event.title, slug: event.slug };
                  return (
                    <motion.div 
                      key={event.id}
                      whileHover={{ y: -2 }}
                      className="bg-white border border-border rounded-xl p-4 hover:border-muted-foreground/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${event.active ? 'bg-success' : 'bg-border'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{eventData.title}</p>
                            <p className="text-xs text-muted-foreground">kora.com/{fundSlug}/{eventData.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">${event.raised.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{event.gifts || 0} gifts</p>
                          </div>
                          <div className="flex items-center">
                            <button 
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(`kora.com/${fundSlug}/${eventData.slug}`); toast({ title: "Link copied" }); }}
                              className="p-2 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-lg transition-all"
                              data-testid={`button-share-event-${event.id}`}
                              title="Copy link"
                            >
                              <Copy size={14} />
                            </button>
                            <Link href={`/${fundSlug}/${eventData.slug}`}>
                              <button 
                                className="p-2 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-lg transition-all" 
                                title="View event"
                                data-testid={`button-view-event-${event.id}`}
                              >
                                <ExternalLink size={14} />
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Activity */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Recent Activity</h2>
              
              {recentActivity.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-8 text-center"
                >
                  <div>
                    <motion.div 
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="w-16 h-16 rounded-2xl bg-[hsl(var(--kora-evergreen))] mx-auto mb-5 flex items-center justify-center"
                    >
                      <Gift size={28} className="text-white" />
                    </motion.div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Ready to receive your first gift</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                      Share {selectedFund.name}'s fund with friends and family. Every gift grows over time.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button 
                        onClick={() => setShowShareKit(true)}
                        data-testid="button-empty-share"
                        className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors flex items-center justify-center gap-2"
                      >
                        <Share2 size={16} />
                        Share fund link
                      </button>
                      <button 
                        onClick={handleCopyClick}
                        className="px-5 py-2.5 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy size={16} />
                        Copy link
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {recentActivity.map((item, i) => {
                  const isExpanded = expandedActivity === item.id;
                  return (
                    <motion.div 
                      key={i}
                      variants={fadeInUp}
                      whileHover={{ scale: 1.01, y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      transition={gentleSpring}
                      className="bg-white border border-border rounded-xl overflow-hidden cursor-pointer hover:border-muted-foreground/30 hover:shadow-md"
                      onClick={() => setExpandedActivity(isExpanded ? null : item.id)}
                      data-testid={`activity-item-${item.id}`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-foreground">
                                <span className="font-medium">{item.from}</span>
                                <span className="text-muted-foreground mx-1.5">→</span>
                                <span>{item.event}</span>
                              </p>
                              {item.status === "pending" ? (
                                <motion.span 
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))] font-medium flex items-center gap-1"
                                  animate={{ opacity: [0.8, 1, 0.8] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <span className="w-1 h-1 rounded-full bg-[hsl(var(--kora-gold))]"></span>
                                  Pending
                                </motion.span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-medium">
                                  Invested
                                </span>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">"{item.note}"</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1.5">{item.time}</p>
                          </div>
                          <motion.p 
                            className="text-sm font-medium text-success shrink-0 ml-4"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.1 + 0.2 }}
                          >
                            +${item.amount}
                          </motion.p>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-0 border-t border-border">
                              <div className="pt-3 space-y-2">
                                {item.status === "pending" ? (
                                  <>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-muted-foreground">Payment received</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--kora-gold))] mt-1.5 shrink-0 animate-pulse"></div>
                                      <p className="text-xs text-muted-foreground">Will invest when US markets open (9:30am ET weekdays)</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-border mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-muted-foreground">Trade settles in 1-2 business days</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-muted-foreground">Payment received</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-muted-foreground">Trade executed at market open</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0"></div>
                                      <p className="text-xs text-muted-foreground">Settled · Bought 0.{Math.floor(item.amount / 5)} shares of VTI</p>
                                    </div>
                                  </>
                                )}
                                <p className="text-[10px] text-muted-foreground pt-2 border-t border-border mt-2">
                                  Assets held by Alpaca Securities LLC · SIPC protected
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
              )}
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
                className="p-5 rounded-lg bg-white border border-border"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-foreground">Share this fund</p>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setShowFundPreview(true)}
                      data-testid="button-preview-fund"
                      className="p-1.5 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded transition-colors"
                      title="Preview page"
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      onClick={() => setShowEditFund(true)}
                      data-testid="button-edit-share"
                      className="p-1.5 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="px-3 py-2.5 bg-muted rounded text-sm text-muted-foreground truncate">
                    {momentLink}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCopyClick}
                      data-testid="button-copy-desktop"
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors"
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <button 
                      onClick={() => setShowQR(true)}
                      data-testid="button-qr-desktop"
                      className="px-4 py-2.5 border border-border rounded text-sm hover:bg-muted transition-colors"
                    >
                      QR
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Quick Actions - State-driven primary CTA */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="p-5 rounded-lg bg-white border border-border"
              >
                <p className="text-sm font-medium text-foreground mb-4">Do next</p>
                <div className="space-y-2">
                  {/* Primary CTA - changes based on state */}
                  {pendingThankYous > 0 ? (
                    <button 
                      data-testid="button-thank-yous-primary"
                      onClick={() => setShowThankYous(true)}
                      className="w-full py-2.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors text-left px-3 flex items-center justify-between"
                    >
                      <span>Send thank-yous</span>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{pendingThankYous} pending</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleCopyClick}
                      data-testid="button-quick-share"
                      className="w-full py-2.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors text-left px-3"
                    >
                      Share fund link
                    </button>
                  )}
                  
                  {/* Secondary actions */}
                  {pendingThankYous > 0 && (
                    <button 
                      onClick={handleCopyClick}
                      data-testid="button-quick-share-secondary"
                      className="w-full py-2.5 border border-border rounded text-sm text-foreground hover:bg-muted transition-colors text-left px-3"
                    >
                      Share fund link
                    </button>
                  )}
                  <Link href="/event/create" className="block">
                    <button 
                      data-testid="button-new-event"
                      className="w-full py-2.5 border border-border rounded text-sm text-foreground hover:bg-muted transition-colors text-left px-3"
                    >
                      Create event page
                    </button>
                  </Link>
                  {pendingThankYous === 0 && (
                    <button 
                      data-testid="button-thank-yous"
                      onClick={() => setShowThankYous(true)}
                      className="w-full py-2.5 border border-border rounded text-sm text-foreground hover:bg-muted transition-colors text-left px-3"
                    >
                      Send thank-yous
                    </button>
                  )}
                  <Link href="/send" className="block">
                    <button 
                      data-testid="button-send-gift"
                      className="w-full py-2.5 border border-border rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left px-3"
                    >
                      Send a gift
                    </button>
                  </Link>
                </div>
              </motion.div>

              {/* Brokerage Footer */}
              <div className="text-xs text-muted-foreground text-center pt-4">
                <p>Brokerage services by Alpaca Securities LLC</p>
                <p>Member FINRA/SIPC</p>
                <button 
                  onClick={() => toast({ title: "Custody & Protection", description: "Your assets are held by Alpaca Securities LLC and protected by SIPC up to $500,000." })}
                  className="text-muted-foreground hover:text-foreground underline mt-1"
                >
                  Learn about custody + SIPC
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <div className="lg:hidden text-xs text-muted-foreground text-center mt-12 pb-8">
          <p>Brokerage services by Alpaca Securities LLC</p>
          <p>Member FINRA/SIPC</p>
          <button 
            onClick={() => toast({ title: "Custody & Protection", description: "Your assets are held by Alpaca Securities LLC and protected by SIPC up to $500,000." })}
            className="text-muted-foreground hover:text-foreground underline mt-1"
          >
            Learn about custody + SIPC
          </button>
        </div>
      </main>

      {/* Portfolio Modal */}
      <Dialog open={showPortfolio} onOpenChange={setShowPortfolio}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="font-medium">Where it's invested</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
              <div>
                <p className="text-sm text-muted-foreground">Invested</p>
                <p className="text-lg font-medium text-foreground">${investedAmount.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Cash</p>
                <p className="text-lg font-medium text-foreground">${cashAmount.toLocaleString()}</p>
              </div>
            </div>
            
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Holdings</p>
            <div className="space-y-3">
              {holdings.map((holding, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground bg-white px-2 py-1 rounded border border-border">{holding.ticker}</span>
                    <div>
                      <p className="text-sm text-foreground">{holding.name}</p>
                      <p className="text-xs text-muted-foreground">{holding.shares} shares</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">${holding.value.toLocaleString()}</p>
                    <p className="text-xs text-success">+${holding.gain}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground pt-4 mt-4 border-t border-border">
              Holdings are at the Fund level. Gifts from all events invest into the same account.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Modal - Fund */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs bg-white">
          <div className="flex flex-col items-center py-6">
            <div className="p-4 bg-white rounded-lg border border-border mb-4">
              <QRCodeSVG value={`https://${momentLink}`} size={180} level="H" />
            </div>
            <p className="text-xs text-muted-foreground text-center mb-1">{momentLink}</p>
            <p className="text-sm text-muted-foreground text-center">
              Scan to give
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Modal - Page */}
      <Dialog open={showPageQR !== null} onOpenChange={() => setShowPageQR(null)}>
        <DialogContent className="max-w-xs bg-white">
          <div className="flex flex-col items-center py-6">
            <div className="p-4 bg-white rounded-lg border border-border mb-4">
              <QRCodeSVG value={`https://${showPageQR}`} size={180} level="H" />
            </div>
            <p className="text-xs text-muted-foreground text-center mb-1">{showPageQR}</p>
            <p className="text-sm text-muted-foreground text-center">
              Scan to give
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fund Settings Panel */}
      <Dialog open={showEditFund} onOpenChange={setShowEditFund}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <DialogTitle className="font-medium text-foreground">Fund Settings</DialogTitle>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 bg-muted rounded">
                {isPersonal ? "Individual" : "UTMA"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Manage your fund and events</p>
          </div>

          <div className="p-5 border-b border-border space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Fund name</label>
              <input
                type="text"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                data-testid="input-fund-name"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-foreground focus:outline-none focus:border-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Fund URL</label>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground border-r border-border">kora.com/</span>
                <input
                  type="text"
                  value={fundSlugEdit}
                  onChange={(e) => setFundSlugEdit(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  data-testid="input-fund-slug"
                  className="flex-1 px-3 py-2.5 text-foreground focus:outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Your fund's shareable link — contributors can give anytime</p>
            </div>
          </div>

          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Events</label>
              <Link href="/event/create" onClick={() => setShowEditFund(false)}>
                <span className="text-xs text-muted-foreground hover:text-foreground transition-colors">+ Add event</span>
              </Link>
            </div>
            
            <div className="space-y-2">
              {funds[0]?.events.map((event) => {
                const eventData = eventEdits[event.id] || { title: event.title, slug: event.slug };
                return (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-muted rounded-lg group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${event.active ? 'bg-success' : 'bg-border'}`} />
                      <p className="text-sm text-foreground truncate">{eventData.title}</p>
                    </div>
                    <button 
                      onClick={() => setShowEditEvent(event.id)}
                      data-testid={`button-edit-modal-event-${event.id}`}
                      className="text-xs text-muted-foreground hover:text-muted-foreground shrink-0 transition-colors"
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
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Fund Modal */}
      <Dialog open={showAddFund} onOpenChange={setShowAddFund}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          <div className="p-5 border-b border-border">
            <DialogTitle className="font-medium text-foreground">Add a fund</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Each fund is a separate brokerage account</p>
          </div>
          
          <div className="p-5 space-y-3">
            <button
              onClick={() => {
                setShowAddFund(false);
                setShowAddChild(true);
              }}
              data-testid="button-add-child-fund"
              className="w-full p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 bg-white text-left transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-border flex items-center justify-center transition-colors">
                  <Users size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Add a child</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Open a custodial account (UTMA)</p>
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
                className="w-full p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 bg-white text-left transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-border flex items-center justify-center transition-colors">
                    <User size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Open a personal fund</p>
                    <p className="text-sm text-muted-foreground mt-0.5">For yourself (individual brokerage)</p>
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
          <div className="p-5 border-b border-border">
            <DialogTitle className="font-medium text-foreground">Add a child</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">We'll create a custodial account for them</p>
          </div>
          
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Child's first name</label>
              <input
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="e.g., Mila"
                data-testid="input-new-child-name"
                className="w-full px-4 py-3 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted-foreground"
              />
            </div>
          </div>

          <div className="p-5 border-t border-border">
            <button 
              onClick={() => {
                if (newChildName.trim()) {
                  const name = newChildName.trim();
                  if (funds.some(f => f.name.toLowerCase() === name.toLowerCase())) {
                    toast({ title: "Fund already exists", description: `You already have a fund for ${name}` });
                    return;
                  }
                  const newFund: StoredFund = {
                    id: Date.now(),
                    name: name,
                    slug: name.toLowerCase().replace(/\s+/g, "-"),
                    accountType: "UTMA",
                    status: "draft",
                    balance: 0,
                    gain: 0,
                    gainPercent: 0,
                    contributors: 0,
                    projection: 0,
                    yearsLeft: 18,
                    isNew: true,
                    events: [
                      { id: Date.now(), slug: "anytime", title: "Open anytime", raised: 0, gifts: 0, active: true },
                    ]
                  };
                  const updatedFunds = [...funds, newFund];
                  setFunds(updatedFunds);
                  saveStoredFunds(updatedFunds);
                  setSelectedFundSlug(newFund.slug);
                  setExpandedFund(newFund.id);
                  setShowAddChild(false);
                  setNewChildName("");
                  toast({ title: `${name}'s fund created`, description: "Activate investing to start growing gifts" });
                }
              }}
              disabled={!newChildName.trim()}
              data-testid="button-continue-add-child"
              className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors disabled:opacity-40"
            >
              Create fund
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
                <div className="p-5 border-b border-border">
                  <DialogTitle className="font-medium text-foreground">Edit Event</DialogTitle>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Event name</label>
                    <input
                      type="text"
                      value={eventData.title}
                      onChange={(e) => setEventEdits(prev => ({
                        ...prev,
                        [showEditEvent]: { ...eventData, title: e.target.value }
                      }))}
                      data-testid="input-event-title"
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-foreground focus:outline-none focus:border-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Event URL</label>
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground border-r border-border truncate">kora.com/{fundSlug}/</span>
                      <input
                        type="text"
                        value={eventData.slug}
                        onChange={(e) => setEventEdits(prev => ({
                          ...prev,
                          [showEditEvent]: { ...eventData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }
                        }))}
                        data-testid="input-event-url"
                        className="flex-1 px-3 py-2.5 text-foreground focus:outline-none min-w-0"
                      />
                    </div>
                  </div>
                  <Link href={`/edit/${fundSlug}/${eventData.slug}`} onClick={() => setShowEditEvent(null)}>
                    <button 
                      data-testid="button-full-editor"
                      className="w-full py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Open full editor
                    </button>
                  </Link>
                </div>
                <div className="p-5 border-t border-border">
                  <button 
                    onClick={() => setShowEditEvent(null)}
                    data-testid="button-save-event"
                    className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors"
                  >
                    Save
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Thank-Yous Modal */}
      <Dialog open={showThankYous} onOpenChange={(open) => {
        setShowThankYous(open);
        if (!open) setExpandedThankYou(null);
      }}>
        <DialogContent className="max-w-md bg-white p-0 gap-0">
          <div className="p-5 border-b border-border">
            <DialogTitle className="font-medium text-foreground">Send thank-yous</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingThankYous > 0 
                ? `${pendingThankYous} pending${snoozedCount > 0 ? ` • ${snoozedCount} for later` : ''}`
                : snoozedCount > 0 
                  ? `${snoozedCount} saved for later`
                  : "All caught up!"}
            </p>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {recentActivity
              .filter(a => a.status === "invested")
              .map((item, i) => {
                const isSent = sentThankYous.includes(item.id);
                const isSnoozed = snoozedThankYous.includes(item.id);
                const isExpanded = expandedThankYou === item.id;
                const draftMessage = thankYouDrafts[item.id] ?? getDefaultThankYou(item);
                
                return (
                  <div 
                    key={item.id} 
                    className={`border-b border-border last:border-0 ${isSent ? 'bg-success/10/50' : isSnoozed ? 'bg-muted' : ''}`}
                  >
                    <div 
                      className={`p-4 ${!isSent ? 'cursor-pointer hover:bg-muted' : ''} transition-colors`}
                      onClick={() => !isSent && setExpandedThankYou(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{item.from}</p>
                            {isSent && (
                              <span className="text-xs text-success bg-success/20 px-2 py-0.5 rounded-full">Sent</span>
                            )}
                            {isSnoozed && !isSent && (
                              <span className="text-xs text-muted-foreground bg-border px-2 py-0.5 rounded-full">Later</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">${item.amount} • {item.event}</p>
                          {item.note && (
                            <p className="text-sm text-muted-foreground mt-1 italic">"{item.note}"</p>
                          )}
                        </div>
                        {!isSent && (
                          <span className="text-xs text-muted-foreground">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && !isSent && (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setThankYouDrafts(prev => ({ ...prev, [item.id]: thankYouTemplates.simple(item) }));
                            }}
                            data-testid={`button-template-simple-${item.id}`}
                            className="px-3 py-1.5 text-xs border border-border rounded-full text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Simple
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setThankYouDrafts(prev => ({ ...prev, [item.id]: thankYouTemplates.heartfelt(item) }));
                            }}
                            data-testid={`button-template-heartfelt-${item.id}`}
                            className="px-3 py-1.5 text-xs border border-border rounded-full text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Heartfelt
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setThankYouDrafts(prev => ({ ...prev, [item.id]: thankYouTemplates.formal(item) }));
                            }}
                            data-testid={`button-template-formal-${item.id}`}
                            className="px-3 py-1.5 text-xs border border-border rounded-full text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Formal
                          </button>
                        </div>
                        <textarea
                          value={draftMessage}
                          onChange={(e) => setThankYouDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-full p-3 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted-foreground"
                          rows={4}
                          placeholder="Write your thank-you message..."
                          data-testid={`textarea-thankyou-${item.id}`}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSentThankYous(prev => [...prev, item.id]);
                              setSnoozedThankYous(prev => prev.filter(id => id !== item.id));
                              setExpandedThankYou(null);
                              toast({ title: `Thank-you sent to ${item.from}` });
                            }}
                            data-testid={`button-send-thanks-${item.id}`}
                            className="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors"
                          >
                            Send thank-you
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSnoozed) {
                                setSnoozedThankYous(prev => prev.filter(id => id !== item.id));
                              } else {
                                setSnoozedThankYous(prev => [...prev, item.id]);
                              }
                              setExpandedThankYou(null);
                            }}
                            data-testid={`button-snooze-thanks-${item.id}`}
                            className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-muted transition-colors"
                          >
                            {isSnoozed ? 'Restore' : 'Later'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="p-5 border-t border-border">
            <button 
              onClick={() => {
                setShowThankYous(false);
                setExpandedThankYou(null);
              }}
              data-testid="button-close-thankyous"
              className="w-full py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium Contributors Drawer - Full-screen immersive experience */}
      <AnimatePresence>
        {showContributors && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => { setShowContributors(false); setExpandedContributor(null); }}
              className="fixed inset-0 bg-primary/60 z-50"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] lg:inset-y-4 lg:right-4 lg:left-auto lg:w-[520px] lg:max-h-none lg:rounded-2xl overflow-hidden"
            >
              <div className="h-full bg-white rounded-t-3xl lg:rounded-2xl flex flex-col shadow-2xl">
                {/* Drag handle (mobile) */}
                <div className="lg:hidden flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-border" />
                </div>
                
                {/* Hero Section with gradient background */}
                <div className="relative overflow-hidden shrink-0">
                  {/* Gradient orbs */}
                  <div className="absolute inset-0 overflow-hidden">
                    <motion.div 
                      animate={{ 
                        x: [0, 20, 0],
                        y: [0, -10, 0],
                      }}
                      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                      className="hidden"
                    />
                    <motion.div
                      animate={{ 
                        x: [0, -15, 0],
                        y: [0, 15, 0],
                      }}
                      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                      className="hidden"
                    />
                  </div>
                  
                  <div className="relative z-10 p-6 pb-5">
                    {/* Close button */}
                    <button 
                      onClick={() => { setShowContributors(false); setExpandedContributor(null); }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white transition-all"
                      data-testid="button-close-contributors"
                    >
                      <ChevronDown size={18} />
                    </button>
                    
                    {/* Title */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <h2 className="text-2xl font-semibold text-foreground mb-1">Contributors</h2>
                      <p className="text-sm text-muted-foreground">Everyone who's invested in {selectedFund.name}'s future</p>
                    </motion.div>
                    
                    {/* Stats row */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="flex gap-4 mt-5"
                    >
                      <div className="flex-1 bg-card rounded-xl p-4 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Total Received</p>
                        <p className="text-2xl font-bold text-foreground">${allContributions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}</p>
                      </div>
                      <div className="flex-1 bg-card rounded-xl p-4 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Contributors</p>
                        <p className="text-2xl font-bold text-foreground">{allContributions.length}</p>
                      </div>
                      <div className="flex-1 bg-card rounded-xl p-4 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Need Thanks</p>
                        <p className="text-2xl font-bold text-[hsl(var(--kora-gold))]">{allContributions.filter(c => c.status === "invested" && !sentThankYous.includes(c.id)).length}</p>
                      </div>
                    </motion.div>
                    
                    {/* Contributor avatars row */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-2 mt-5"
                    >
                      <div className="flex -space-x-2">
                        {allContributions.slice(0, 6).map((c, i) => (
                          <motion.div
                            key={c.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.25 + i * 0.05, type: "spring" }}
                            className="w-8 h-8 rounded-full bg-muted border-2 border-white flex items-center justify-center text-xs font-medium text-muted-foreground"
                          >
                            {c.from.charAt(0)}
                          </motion.div>
                        ))}
                        {allContributions.length > 6 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5, type: "spring" }}
                            className="w-8 h-8 rounded-full bg-primary border-2 border-white flex items-center justify-center text-xs font-medium text-white shadow-sm"
                          >
                            +{allContributions.length - 6}
                          </motion.div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">Family & Friends</span>
                    </motion.div>
                  </div>
                </div>
                
                {/* Contributors list */}
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-3">
                    {allContributions.map((contribution, index) => {
                      const isThanked = sentThankYous.includes(contribution.id);
                      const isExpanded = expandedContributor === contribution.id;
                      const sharesAmount = (contribution.amount / 250).toFixed(2);
                      
                      return (
                        <motion.div 
                          key={contribution.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + index * 0.03 }}
                          className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md hover:border-muted-foreground/30 transition-all"
                        >
                          <button 
                            onClick={() => setExpandedContributor(isExpanded ? null : contribution.id)}
                            className="w-full p-4 text-left"
                            data-testid={`contributor-${contribution.id}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Avatar */}
                              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                                {contribution.from.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-foreground">{contribution.from}</p>
                                    {contribution.status === "pending" ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))] font-medium flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-[hsl(var(--kora-gold))] animate-pulse"></span>
                                        Pending
                                      </span>
                                    ) : isThanked ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                                        Thanked
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                        Send thanks
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-base font-bold text-success shrink-0">+${contribution.amount}</p>
                                </div>
                                
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <span>{formatRelativeTime(contribution.date)}</span>
                                  <span className="text-border">•</span>
                                  <span className="truncate">{contribution.event}</span>
                                </div>
                                
                                {contribution.note && (
                                  <p className="text-sm text-muted-foreground mt-2 bg-muted rounded-lg px-3 py-2 italic">
                                    "{contribution.note}"
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Expand indicator */}
                            <div className="flex items-center justify-center mt-3 pt-3 border-t border-border">
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-1 text-xs text-muted-foreground"
                              >
                                <span>{isExpanded ? "Hide" : "View"} details</span>
                                <ChevronDown size={14} />
                              </motion.div>
                            </div>
                          </button>
                          
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4">
                                  <div className="bg-muted rounded-xl p-4">
                                    {/* Transaction Timeline with vertical line */}
                                    <div className="relative">
                                      {/* Vertical connecting line */}
                                      <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-border" />
                                      
                                      <div className="space-y-4">
                                        {/* Payment received */}
                                        <motion.div 
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: 0.1 }}
                                          className="flex items-start gap-3 relative"
                                        >
                                          <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center shrink-0 z-10 shadow-sm ">
                                            <div className="w-2 h-2 rounded-full bg-white"></div>
                                          </div>
                                          <div className="flex-1 pt-0.5">
                                            <p className="text-sm font-medium text-foreground">Payment received</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(contribution.date)} at {formatTime(contribution.date)}</p>
                                          </div>
                                        </motion.div>
                                        
                                        {/* Trade executed */}
                                        <motion.div 
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: 0.15 }}
                                          className="flex items-start gap-3 relative"
                                        >
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm ${
                                            contribution.status === "pending" 
                                              ? "bg-[hsl(var(--kora-gold))] " 
                                              : "bg-success "
                                          }`}>
                                            {contribution.status === "pending" ? (
                                              <motion.div
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                                className="w-2 h-2 rounded-full bg-white"
                                              />
                                            ) : (
                                              <div className="w-2 h-2 rounded-full bg-white"></div>
                                            )}
                                          </div>
                                          <div className="flex-1 pt-0.5">
                                            <p className="text-sm font-medium text-foreground">
                                              {contribution.status === "pending" ? "Trade pending" : "Trade executed"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {contribution.status === "pending" 
                                                ? "Markets open 9:30am ET weekdays"
                                                : "Filled at market open"
                                              }
                                            </p>
                                          </div>
                                        </motion.div>
                                        
                                        {/* Settled */}
                                        <motion.div 
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: 0.2 }}
                                          className="flex items-start gap-3 relative"
                                        >
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm ${
                                            contribution.status === "pending" 
                                              ? "bg-border" 
                                              : "bg-success "
                                          }`}>
                                            <div className="w-2 h-2 rounded-full bg-white"></div>
                                          </div>
                                          <div className="flex-1 pt-0.5">
                                            <p className={`text-sm font-medium ${
                                              contribution.status === "pending" ? "text-muted-foreground" : "text-foreground"
                                            }`}>
                                              {contribution.status === "pending" 
                                                ? "Awaiting settlement"
                                                : `Settled · ${sharesAmount} shares of VTI`
                                              }
                                            </p>
                                            {contribution.status === "invested" && (
                                              <p className="text-xs text-muted-foreground">T+1 settlement complete</p>
                                            )}
                                          </div>
                                        </motion.div>
                                      </div>
                                    </div>
                                    
                                    {/* Custody info */}
                                    <motion.div 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 0.25 }}
                                      className="mt-4 pt-3 border-t border-border/70 flex items-start gap-2"
                                    >
                                      <Shield size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                                      <p className="text-xs text-muted-foreground leading-relaxed">
                                        Held by Alpaca Securities LLC · SIPC protected up to $500,000
                                      </p>
                                    </motion.div>
                                    
                                    {/* Thank you action for invested */}
                                    {contribution.status === "invested" && (
                                      <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="mt-4 pt-3 border-t border-border/70"
                                      >
                                        {isThanked ? (
                                          <motion.div 
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex items-center gap-2 text-success bg-success/10 rounded-xl p-3"
                                          >
                                            <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                              </svg>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Thank you sent!</p>
                                              <p className="text-xs text-success">{contribution.from.split(' ')[0]} will receive it shortly</p>
                                            </div>
                                          </motion.div>
                                        ) : composingThankYou === contribution.id ? (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4"
                                          >
                                            <p className="text-sm font-medium text-foreground">Choose a template</p>
                                            
                                            {/* Template options */}
                                            <div className="space-y-2">
                                              {[
                                                { id: 0, emoji: "💝", label: "Warm & Grateful", preview: `Thank you so much for your generous gift to ${selectedFund.name}! Your investment in their future means the world to us.` },
                                                { id: 1, emoji: "🌟", label: "Playful", preview: `${selectedFund.name} is going to do amazing things with your gift! Thank you for believing in their future!` },
                                                { id: 2, emoji: "🙏", label: "Heartfelt", preview: `We're deeply grateful for your kindness and generosity. This gift will help build ${selectedFund.name}'s future, one share at a time.` }
                                              ].map((template) => (
                                                <button
                                                  key={template.id}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedTemplate(template.id);
                                                    setCustomMessage(template.preview);
                                                  }}
                                                  className={`w-full p-3 rounded-xl text-left transition-all ${
                                                    selectedTemplate === template.id 
                                                      ? "bg-primary text-white ring-2 ring-primary ring-offset-2" 
                                                      : "bg-white border border-border hover:border-muted-foreground/30 text-foreground"
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <span>{template.emoji}</span>
                                                    <span className="text-sm font-medium">{template.label}</span>
                                                  </div>
                                                  <p className={`text-xs leading-relaxed line-clamp-2 ${
                                                    selectedTemplate === template.id ? "text-white/70" : "text-muted-foreground"
                                                  }`}>
                                                    {template.preview}
                                                  </p>
                                                </button>
                                              ))}
                                            </div>
                                            
                                            {/* Custom message area */}
                                            <div>
                                              <label className="text-xs text-muted-foreground mb-1.5 block">Personalize (optional)</label>
                                              <textarea
                                                value={customMessage}
                                                onChange={(e) => setCustomMessage(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="Add a personal touch..."
                                                rows={3}
                                                className="w-full px-3 py-2.5 text-sm bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted-foreground resize-none"
                                              />
                                            </div>
                                            
                                            {/* Delivery info */}
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg p-2.5">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                                <polyline points="22,6 12,13 2,6"></polyline>
                                              </svg>
                                              <span>Will be sent via email</span>
                                            </div>
                                            
                                            {/* Action buttons */}
                                            <div className="flex gap-2">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setComposingThankYou(null);
                                                  setCustomMessage("");
                                                  setSelectedTemplate(0);
                                                }}
                                                className="flex-1 py-2.5 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-border transition-colors"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSendingThankYou(true);
                                                  setTimeout(() => {
                                                    setSentThankYous(prev => [...prev, contribution.id]);
                                                    setComposingThankYou(null);
                                                    setCustomMessage("");
                                                    setSelectedTemplate(0);
                                                    setSendingThankYou(false);
                                                    toast({ 
                                                      title: "Thank you sent! 💌",
                                                      description: `${contribution.from.split(' ')[0]} will receive your message shortly.`
                                                    });
                                                  }, 800);
                                                }}
                                                disabled={sendingThankYou}
                                                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                              >
                                                {sendingThankYou ? (
                                                  <>
                                                    <motion.div
                                                      animate={{ rotate: 360 }}
                                                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                                    />
                                                    Sending...
                                                  </>
                                                ) : (
                                                  <>Send to {contribution.from.split(' ')[0]}</>
                                                )}
                                              </button>
                                            </div>
                                          </motion.div>
                                        ) : (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedTemplate(0);
                                              setCustomMessage(`Thank you so much for your generous gift to ${selectedFund.name}! Your investment in their future means the world to us.`);
                                              setComposingThankYou(contribution.id);
                                            }}
                                            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors duration-200 flex items-center justify-center gap-2"
                                          >
                                            <span>💌</span>
                                            Send thank you to {contribution.from.split(' ')[0]}
                                          </button>
                                        )}
                                      </motion.div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for mobile navigation */}
      <div className="h-20 lg:hidden" aria-hidden="true" />

      {/* Fund Preview Modal */}
      <Dialog open={showFundPreview} onOpenChange={setShowFundPreview}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] bg-white p-0 gap-0 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg text-xs text-muted-foreground">
                <Eye size={12} />
                <span>Preview</span>
              </div>
              <span className="text-sm text-muted-foreground truncate">kora.com/{selectedFundSlug}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/${selectedFundSlug}`}>
                <button 
                  onClick={() => setShowFundPreview(false)}
                  data-testid="button-view-live"
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-[hsl(var(--kora-evergreen-light))] transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Open
                </button>
              </Link>
              <button 
                onClick={() => {
                  setShowFundPreview(false);
                  setShowEditFund(true);
                }}
                data-testid="button-edit-from-preview"
                className="p-1.5 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded transition-colors"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
            </div>
          </div>
          
          {/* Iframe Container */}
          <div className="flex-1 bg-muted overflow-hidden">
            <iframe
              src={`/${selectedFundSlug}?preview=true`}
              className="w-full h-full border-0"
              title="Fund page preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium Share Kit */}
      <ShareKit
        fundName={selectedFund?.name || "Fund"}
        fundSlug={selectedFundSlug}
        recipientName={selectedFund?.name || "Fund"}
        isOpen={showShareKit}
        onClose={() => setShowShareKit(false)}
      />
    </div>
  );
}
