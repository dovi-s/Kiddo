import { useState, useEffect } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, QrCode, Copy, MessageSquare, Check, ArrowRight, Settings, ExternalLink, TrendingUp, UserPlus, X, Download, Sparkles, Crown, Users, Camera } from "lucide-react";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

const HOLDINGS = [
  { name: "Total Stock Market", ticker: "VTI", value: 2125, percent: 50, change: "+12.4%" },
  { name: "International", ticker: "VXUS", value: 850, percent: 20, change: "+8.2%" },
  { name: "Bonds", ticker: "BND", value: 637, percent: 15, change: "+2.1%" },
  { name: "Cash", ticker: "—", value: 638, percent: 15, change: "—" },
];

function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 800;
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

export default function Dashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || (accountType === "personal" ? "My Fund" : "Ari"));
  const userEmail = decodeURIComponent(params.get("email") || "you@example.com");
  const isPersonal = accountType === "personal";

  const [showFull, setShowFull] = useState(false);
  const [brokerageOpen, setBrokerageOpen] = useState(false);
  const [pageCreated, setPageCreated] = useState(false);
  const [linkShared, setLinkShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [eventStep, setEventStep] = useState(1);
  const [selectedEventType, setSelectedEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventPhoto, setEventPhoto] = useState("");
  const [showShareCard, setShowShareCard] = useState(false);
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"free" | "plus" | "family">("free");
  const [pageTitle, setPageTitle] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [thankYousSent, setThankYousSent] = useState(false);

  const inviteLink = "everleaf.com/invite/abc123";
  const momentLink = `https://everleaf.com/m/${encodeURIComponent(profileName.toLowerCase().replace(/\s+/g, "-"))}`;

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInviteCopy = () => {
    setInviteCopied(true);
    toast({ title: "Link copied", description: "Share it with someone planning a milestone." });
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const handleSendThankYous = () => {
    setThankYousSent(true);
    toast({ title: "Thank-yous sent", description: "Your contributors have been notified." });
  };

  const contributions = [
    { from: "Uncle Dave", amount: 180, message: "Congrats! So proud of you.", time: "2h ago" },
    { from: "Grandma Ruth", amount: 500, message: "For your future, with all my love.", time: "Yesterday" },
    { from: "The Cohens", amount: 100, message: "Here's to many more milestones!", time: "2 days ago" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Nav showDashboard accountType={accountType} profileName={profileName} />
      
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                {!showFull ? "Welcome" : isPersonal ? "My Fund" : `${profileName}'s Fund`}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {!showFull ? "Let's set up your account." : "18 contributors · Active"}
              </p>
            </div>
            {currentPlan === "free" ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setShowUpgrade(true)}
                >
                  <Crown className="h-3 w-3 mr-1" /> Upgrade
                </Button>
              </motion.div>
            ) : (
              <span className={`text-xs px-2 py-1 rounded-full ${
                currentPlan === "plus" 
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" 
                  : "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
              }`}>
                {currentPlan === "plus" ? "Plus" : "Family"}
              </span>
            )}
          </div>

          {/* Onboarding */}
          <AnimatePresence mode="wait">
            {!showFull && (
              <motion.div 
                key="onboarding"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Step 1 */}
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center justify-between p-5 border rounded-lg bg-foreground/[0.02]"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground line-through">Create profile</p>
                      <p className="text-xs text-muted-foreground">{isPersonal ? "Personal" : profileName}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Step 2 */}
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {!brokerageOpen ? (
                    <div className="flex items-center justify-between p-5 border-2 border-foreground rounded-lg group hover:bg-foreground/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full border-2 border-foreground flex items-center justify-center text-sm font-medium">
                          2
                        </div>
                        <div>
                          <p className="font-medium text-sm">Open investment account</p>
                          <p className="text-xs text-muted-foreground">SIPC protected · 2 minutes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-muted-foreground"
                          onClick={() => setBrokerageOpen(true)}
                        >
                          Later
                        </Button>
                        <Link href={`/onboard?type=${accountType}&name=${encodeURIComponent(profileName)}&email=${encodeURIComponent(userEmail)}`}>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button size="sm">
                              Continue <ArrowRight className="ml-2 h-3 w-3" />
                            </Button>
                          </motion.div>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-5 border rounded-lg bg-foreground/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground line-through">Investment account</p>
                          <p className="text-xs text-muted-foreground">Apex Clearing</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Step 3 */}
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {brokerageOpen && !pageCreated ? (
                    <div className="flex items-center justify-between p-5 border-2 border-foreground rounded-lg group hover:bg-foreground/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full border-2 border-foreground flex items-center justify-center text-sm font-medium">
                          3
                        </div>
                        <div>
                          <p className="font-medium text-sm">Create shareable page</p>
                          <p className="text-xs text-muted-foreground">For events or always-on</p>
                        </div>
                      </div>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button size="sm" onClick={() => setShowPageSetup(true)}>
                          Set up <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                      </motion.div>
                    </div>
                  ) : pageCreated ? (
                    <div className="flex items-center justify-between p-5 border rounded-lg bg-foreground/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground line-through">Create shareable page</p>
                          <p className="text-xs text-muted-foreground">everleaf.com/m/{profileName.toLowerCase().replace(/\s+/g, "-")}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-5 border rounded-lg opacity-60">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium text-muted-foreground">
                          3
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Create shareable page</p>
                          <p className="text-xs text-muted-foreground">For events or always-on</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Step 4 */}
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {pageCreated && !linkShared ? (
                    <div className="flex items-center justify-between p-5 border-2 border-foreground rounded-lg group hover:bg-foreground/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full border-2 border-foreground flex items-center justify-center text-sm font-medium">
                          4
                        </div>
                        <div>
                          <p className="font-medium text-sm">Share with family</p>
                          <p className="text-xs text-muted-foreground">Send your link</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button variant="outline" size="sm" onClick={() => setShowQR(true)}>
                            <QrCode className="h-3 w-3 mr-2" /> QR
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button size="sm" onClick={() => { handleCopy(); setLinkShared(true); }}>
                            <Copy className="h-3 w-3 mr-2" /> Copy link
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  ) : linkShared ? (
                    <div className="flex items-center justify-between p-5 border rounded-lg bg-foreground/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground line-through">Share with family</p>
                          <p className="text-xs text-muted-foreground">Link copied!</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowFull(true)}>
                        Go to dashboard <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-5 border rounded-lg opacity-60">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium text-muted-foreground">
                          4
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Share with family</p>
                          <p className="text-xs text-muted-foreground">Send your link</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="pt-6"
                >
                  <button 
                    onClick={() => setShowFull(true)}
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  >
                    Skip to dashboard
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Full Dashboard */}
          <AnimatePresence>
            {showFull && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8"
              >
                {/* Value */}
                <div className="text-center py-10">
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-5xl font-semibold text-foreground tracking-tight"
                  >
                    <AnimatedValue value={4250} />
                  </motion.p>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-2 mt-3"
                  >
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">+$472 (12.5%)</span>
                    <span className="text-sm text-muted-foreground">all time</span>
                  </motion.div>
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: ExternalLink, label: "Preview", href: `/moment?name=${encodeURIComponent(profileName)}` },
                    { icon: Copy, label: copied ? "Copied!" : "Copy link", onClick: handleCopy },
                    { icon: QrCode, label: "QR code", onClick: () => setShowQR(true) },
                  ].map((action, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {action.href ? (
                        <Link href={action.href}>
                          <Card className="border hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all cursor-pointer">
                            <CardContent className="p-4 text-center">
                              <action.icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm font-medium">{action.label}</p>
                            </CardContent>
                          </Card>
                        </Link>
                      ) : (
                        <Card 
                          className="border hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all cursor-pointer"
                          onClick={action.onClick}
                        >
                          <CardContent className="p-4 text-center">
                            <action.icon className={`h-5 w-5 mx-auto mb-2 ${action.label === "Copied!" ? "text-green-600" : "text-muted-foreground"}`} />
                            <p className="text-sm font-medium">{action.label}</p>
                          </CardContent>
                        </Card>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Fund with Event Pages */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  {/* Fund Card */}
                  <Card className="border overflow-hidden">
                    <CardContent className="p-0">
                      {/* Fund Header */}
                      <div className="p-4 border-b bg-foreground/[0.02]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                              {profileName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold">{profileName}'s Fund</p>
                              <p className="text-xs text-muted-foreground">18 contributors · $4,250 total</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold">$4,250</p>
                            <p className="text-xs text-emerald-600">+12.5%</p>
                          </div>
                        </div>
                      </div>

                      {/* Event Pages within this Fund */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event Pages</p>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowPageSetup(true)}>
                            <Plus className="h-3 w-3 mr-1" /> Add event
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {/* Always-on page */}
                          <Link href={`/moment?name=${encodeURIComponent(profileName)}`}>
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-foreground/[0.03] transition-colors cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Always Open</p>
                                  <p className="text-xs text-muted-foreground">$2,180 · 12 gifts</p>
                                </div>
                              </div>
                              <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Live</span>
                            </div>
                          </Link>

                          {/* Birthday event */}
                          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-foreground/[0.03] transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-sm">
                                🎂
                              </div>
                              <div>
                                <p className="text-sm font-medium">5th Birthday</p>
                                <p className="text-xs text-muted-foreground">$1,420 · 8 gifts · Dec 2025</p>
                              </div>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-foreground/10 text-muted-foreground">Closed</span>
                          </div>

                          {/* Upcoming event */}
                          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-foreground/[0.03] transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm">
                                🎓
                              </div>
                              <div>
                                <p className="text-sm font-medium">Kindergarten Graduation</p>
                                <p className="text-xs text-muted-foreground">$650 · 4 gifts · May 2026</p>
                              </div>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Upcoming</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Second Fund - Family plan only */}
                  {currentPlan === "family" && (
                    <Card className="border overflow-hidden mt-4">
                      <CardContent className="p-0">
                        <div className="p-4 border-b bg-foreground/[0.02]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-lg font-semibold text-violet-700 dark:text-violet-300">
                                M
                              </div>
                              <div>
                                <p className="font-semibold">Maya's Fund</p>
                                <p className="text-xs text-muted-foreground">6 contributors · $1,850 total</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold">$1,850</p>
                              <p className="text-xs text-emerald-600">+8.2%</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event Pages</p>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowPageSetup(true)}>
                              <Plus className="h-3 w-3 mr-1" /> Add event
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-foreground/[0.03] transition-colors cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Always Open</p>
                                  <p className="text-xs text-muted-foreground">$1,850 · 6 gifts</p>
                                </div>
                              </div>
                              <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Live</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Add Fund - Family plan */}
                  {currentPlan === "family" && (
                    <Card className="border border-dashed mt-4 hover:border-foreground/30 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
                        <span className="text-sm">Add another child's fund</span>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>

                {/* Holdings */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold tracking-tight">Holdings</h2>
                    <span className="text-xs text-muted-foreground">Future Fund · Auto-managed</span>
                  </div>
                  <Card className="border overflow-hidden">
                    <CardContent className="p-0 divide-y">
                      {HOLDINGS.map((h, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 + i * 0.05 }}
                          className="flex items-center justify-between p-4 hover:bg-foreground/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {h.percent}%
                            </div>
                            <div>
                              <p className="text-sm font-medium">{h.name}</p>
                              <p className="text-xs text-muted-foreground">{h.ticker}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">${h.value.toLocaleString()}</p>
                            <p className={`text-xs ${h.change !== "—" ? "text-green-600" : "text-muted-foreground"}`}>
                              {h.change}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Contributions */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold tracking-tight">Recent gifts</h2>
                    <Link href={`/moment?name=${encodeURIComponent(profileName)}`}>
                      <Button variant="ghost" size="sm" className="text-xs">View all</Button>
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {contributions.map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + i * 0.1 }}
                        whileHover={{ x: 2 }}
                      >
                        <Card className="border hover:border-foreground/20 transition-colors">
                          <CardContent className="p-4 flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-full bg-foreground/5 flex items-center justify-center text-sm font-medium shrink-0">
                                {c.from.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{c.from}</p>
                                  <span className="text-xs text-muted-foreground">{c.time}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">{c.message}</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold">${c.amount}</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Thank yous */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="border hover:border-foreground/20 transition-all">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{thankYousSent ? "Thank-yous sent" : "3 thank-yous ready"}</p>
                          <p className="text-xs text-muted-foreground">{thankYousSent ? "Your contributors have been notified" : "Drafts generated from messages"}</p>
                        </div>
                      </div>
                      {!thankYousSent && (
                        <Button variant="outline" size="sm" onClick={handleSendThankYous}>Send all</Button>
                      )}
                      {thankYousSent && <Check className="h-5 w-5 text-green-600" />}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Post thank-you invite prompt - only shows after sending */}
                <AnimatePresence>
                  {thankYousSent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="border border-dashed">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                                <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {isPersonal ? "Know someone who'd benefit from Everleaf?" : "Know someone planning a milestone?"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">Invite them to create a fund. You both get $10 in Everleaf credit.</p>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => setShowInvite(true)}
                            >
                              Invite
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Plan indicator & upgrade */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                >
                  <Card className="border border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            currentPlan === "free" ? "bg-foreground/5" : 
                            currentPlan === "plus" ? "bg-amber-100 dark:bg-amber-900/30" : 
                            "bg-violet-100 dark:bg-violet-900/30"
                          }`}>
                            {currentPlan === "free" && <Sparkles className="h-4 w-4 text-muted-foreground" />}
                            {currentPlan === "plus" && <Crown className="h-4 w-4 text-amber-600" />}
                            {currentPlan === "family" && <Users className="h-4 w-4 text-violet-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {currentPlan === "free" && "Free plan"}
                              {currentPlan === "plus" && "Plus plan"}
                              {currentPlan === "family" && "Family plan"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {currentPlan === "free" && "Guests pay ~3% fee"}
                              {currentPlan === "plus" && "Zero fees for guests"}
                              {currentPlan === "family" && "10 events/year · Zero fees"}
                            </p>
                          </div>
                        </div>
                        {currentPlan === "free" && (
                          <Button variant="outline" size="sm" onClick={() => setShowUpgrade(true)}>
                            Upgrade
                          </Button>
                        )}
                        {currentPlan !== "free" && (
                          <span className="text-xs text-muted-foreground">Active</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <p className="text-xs text-muted-foreground text-center pt-4">
                  Brokerage by [Broker-Dealer], Member FINRA/SIPC. Clearing by Apex.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Invite Modal */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isPersonal ? "Invite a friend" : "Invite a parent"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <p className="text-sm text-muted-foreground">
              {isPersonal 
                ? "Know someone who'd benefit from a long-term investment fund? Share Everleaf with them."
                : "Know someone planning a birthday, graduation, or milestone? Send them Everleaf."
              }
            </p>

            {/* Share link */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Your invite link</p>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-foreground/[0.03] border rounded-md text-sm font-mono truncate">
                  {inviteLink}
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    variant={inviteCopied ? "default" : "outline"} 
                    size="icon"
                    onClick={handleInviteCopy}
                  >
                    {inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* QR code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG 
                  value={`https://${inviteLink}`}
                  size={120}
                  level="M"
                />
              </div>
            </div>

            {/* Incentive */}
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
              <p className="text-sm text-emerald-800 dark:text-emerald-200 text-center">
                You both get <span className="font-semibold">$10 in Everleaf credit</span> when their fund receives its first gift.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal for sharing moment page */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight">Share</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <p className="text-sm text-muted-foreground text-center">
              Guests scan to give a gift
            </p>

            {/* QR code */}
            <div className="flex justify-center">
              <div className="p-6 bg-white rounded-xl border shadow-sm">
                <QRCodeSVG 
                  value={momentLink}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Link */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground break-all">{momentLink}</p>
            </div>

            {/* Hint */}
            <p className="text-xs text-muted-foreground text-center">
              Print for your party or share directly
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Creation Modal - Multi-step */}
      <Dialog open={showPageSetup} onOpenChange={(open) => { setShowPageSetup(open); if (!open) setEventStep(1); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step 1: Choose Event Type */}
            {eventStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6"
              >
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-xl font-semibold tracking-tight">What's the occasion?</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Pick an event type and we'll make it special
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "birthday", emoji: "🎂", label: "Birthday", color: "bg-pink-100 dark:bg-pink-900/30 hover:bg-pink-200 dark:hover:bg-pink-900/50 border-pink-200 dark:border-pink-800" },
                    { id: "graduation", emoji: "🎓", label: "Graduation", color: "bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800" },
                    { id: "bar_mitzvah", emoji: "✡️", label: "Bar/Bat Mitzvah", color: "bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800" },
                    { id: "wedding", emoji: "💒", label: "Wedding", color: "bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 border-rose-200 dark:border-rose-800" },
                    { id: "baby", emoji: "👶", label: "Baby Shower", color: "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 border-yellow-200 dark:border-yellow-800" },
                    { id: "baptism", emoji: "✝️", label: "Baptism", color: "bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/50 border-sky-200 dark:border-sky-800" },
                    { id: "quinceañera", emoji: "👑", label: "Quinceañera", color: "bg-fuchsia-100 dark:bg-fuchsia-900/30 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-900/50 border-fuchsia-200 dark:border-fuchsia-800" },
                    { id: "holiday", emoji: "🎄", label: "Holiday", color: "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 border-green-200 dark:border-green-800" },
                    { id: "other", emoji: "✨", label: "Other", color: "bg-foreground/5 hover:bg-foreground/10 border-foreground/10" },
                  ].map((event) => (
                    <motion.button
                      key={event.id}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setSelectedEventType(event.id); setEventStep(2); }}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${event.color} ${
                        selectedEventType === event.id ? "ring-2 ring-foreground ring-offset-2" : ""
                      }`}
                    >
                      <span className="text-2xl block mb-2">{event.emoji}</span>
                      <span className="text-xs font-medium">{event.label}</span>
                    </motion.button>
                  ))}
                </div>

                {currentPlan === "family" && (
                  <div className="mt-6 pt-6 border-t">
                    <button
                      onClick={() => { setEventStep(4); }}
                      className="w-full p-4 rounded-xl border-2 border-dashed hover:border-foreground/30 transition-colors text-center"
                    >
                      <Plus className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                      <span className="text-sm font-medium">Start a new fund for another child</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Customize Event */}
            {eventStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Header with theme color */}
                <div className={`p-6 pb-4 ${
                  selectedEventType === "birthday" ? "bg-gradient-to-br from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-900/10" :
                  selectedEventType === "graduation" ? "bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10" :
                  selectedEventType === "bar_mitzvah" ? "bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-900/10" :
                  selectedEventType === "wedding" ? "bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-900/10" :
                  selectedEventType === "baby" ? "bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10" :
                  selectedEventType === "baptism" ? "bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-900/30 dark:to-sky-900/10" :
                  selectedEventType === "quinceañera" ? "bg-gradient-to-br from-fuchsia-100 to-fuchsia-50 dark:from-fuchsia-900/30 dark:to-fuchsia-900/10" :
                  selectedEventType === "holiday" ? "bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/10" :
                  "bg-foreground/[0.03]"
                }`}>
                  <button 
                    onClick={() => setEventStep(1)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 flex items-center gap-1"
                  >
                    <ArrowRight className="h-3 w-3 rotate-180" /> Back
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">
                      {selectedEventType === "birthday" ? "🎂" :
                       selectedEventType === "graduation" ? "🎓" :
                       selectedEventType === "bar_mitzvah" ? "✡️" :
                       selectedEventType === "wedding" ? "💒" :
                       selectedEventType === "baby" ? "👶" :
                       selectedEventType === "baptism" ? "✝️" :
                       selectedEventType === "quinceañera" ? "👑" :
                       selectedEventType === "holiday" ? "🎄" : "✨"}
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold">
                        {selectedEventType === "birthday" ? "Birthday Party" :
                         selectedEventType === "graduation" ? "Graduation" :
                         selectedEventType === "bar_mitzvah" ? "Bar/Bat Mitzvah" :
                         selectedEventType === "wedding" ? "Wedding" :
                         selectedEventType === "baby" ? "Baby Shower" :
                         selectedEventType === "baptism" ? "Baptism" :
                         selectedEventType === "quinceañera" ? "Quinceañera" :
                         selectedEventType === "holiday" ? "Holiday Gift" : "Special Occasion"}
                      </h2>
                      <p className="text-sm text-muted-foreground">for {profileName}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-4 space-y-5">
                  {/* Event Title */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Event title</Label>
                    <Input 
                      placeholder={
                        selectedEventType === "birthday" ? `${profileName}'s 6th Birthday` :
                        selectedEventType === "graduation" ? `${profileName}'s Graduation` :
                        selectedEventType === "bar_mitzvah" ? `${profileName}'s Bar Mitzvah` :
                        selectedEventType === "wedding" ? `${profileName}'s Wedding` :
                        selectedEventType === "baby" ? `${profileName}'s Baby Shower` :
                        selectedEventType === "baptism" ? `${profileName}'s Baptism` :
                        selectedEventType === "quinceañera" ? `${profileName}'s Quinceañera` :
                        selectedEventType === "holiday" ? `${profileName}'s Holiday Fund` :
                        `${profileName}'s Special Day`
                      }
                      value={pageTitle}
                      onChange={(e) => setPageTitle(e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>

                  {/* Event Date */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Event date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input 
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Add a photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div 
                      className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-foreground/30 transition-colors"
                      onClick={() => {}}
                    >
                      {eventPhoto ? (
                        <div className="relative">
                          <img src={eventPhoto} alt="Event" className="w-full h-32 object-cover rounded-lg" />
                          <button 
                            className="absolute top-2 right-2 h-6 w-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                            onClick={(e) => { e.stopPropagation(); setEventPhoto(""); }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-full bg-foreground/5 flex items-center justify-center mx-auto mb-2">
                            <Camera className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">Drop a photo or click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">Makes your page feel personal</p>
                        </>
                      )}
                    </div>
                  </div>

                  <Button 
                    className="w-full h-12 text-base" 
                    onClick={() => setEventStep(3)}
                  >
                    Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Message & Finalize */}
            {eventStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6"
              >
                <button 
                  onClick={() => setEventStep(2)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 flex items-center gap-1"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" /> Back
                </button>

                <DialogHeader className="mb-6">
                  <DialogTitle className="text-xl font-semibold tracking-tight">Almost there!</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Add a welcome message for your guests
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                  {/* Welcome Message */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Message for guests</Label>
                    <Textarea 
                      placeholder={
                        selectedEventType === "birthday" ? `Join us in celebrating ${profileName}'s special day! Your gift will grow with them for years to come.` :
                        selectedEventType === "graduation" ? `${profileName} is graduating! Help launch their future with a gift that keeps growing.` :
                        selectedEventType === "bar_mitzvah" ? `Mazel tov! Celebrate ${profileName}'s milestone with a meaningful gift for their future.` :
                        selectedEventType === "wedding" ? `Celebrate our special day! Your gift will help us build our future together.` :
                        selectedEventType === "baby" ? `Welcome baby! Give a gift that grows with our little one.` :
                        `Thank you for being part of this special moment!`
                      }
                      value={pageMessage}
                      onChange={(e) => setPageMessage(e.target.value)}
                      className="min-h-[120px] resize-none text-base"
                    />
                  </div>

                  {/* Preview card */}
                  <div className="p-4 rounded-xl bg-foreground/[0.03] border">
                    <p className="text-xs text-muted-foreground mb-3">Preview</p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {selectedEventType === "birthday" ? "🎂" :
                         selectedEventType === "graduation" ? "🎓" :
                         selectedEventType === "bar_mitzvah" ? "✡️" :
                         selectedEventType === "wedding" ? "💒" :
                         selectedEventType === "baby" ? "👶" :
                         selectedEventType === "baptism" ? "✝️" :
                         selectedEventType === "quinceañera" ? "👑" :
                         selectedEventType === "holiday" ? "🎄" : "✨"}
                      </span>
                      <div>
                        <p className="font-semibold">{pageTitle || `${profileName}'s ${
                          selectedEventType === "birthday" ? "Birthday" :
                          selectedEventType === "graduation" ? "Graduation" :
                          selectedEventType === "bar_mitzvah" ? "Bar Mitzvah" :
                          selectedEventType === "wedding" ? "Wedding" :
                          selectedEventType === "baby" ? "Baby Shower" :
                          selectedEventType === "baptism" ? "Baptism" :
                          selectedEventType === "quinceañera" ? "Quinceañera" :
                          selectedEventType === "holiday" ? "Holiday Gift" : "Event"
                        }`}</p>
                        <p className="text-xs text-muted-foreground">everleaf.com/m/{profileName.toLowerCase().replace(/\s+/g, "-")}</p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-12 text-base" 
                    onClick={() => { 
                      setPageCreated(true); 
                      setShowPageSetup(false);
                      setEventStep(1);
                      setShowShareCard(true);
                    }}
                  >
                    Create event page
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: New Fund (Family plan) */}
            {eventStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6"
              >
                <button 
                  onClick={() => setEventStep(1)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 flex items-center gap-1"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" /> Back
                </button>

                <DialogHeader className="mb-6">
                  <DialogTitle className="text-xl font-semibold tracking-tight">Start a new fund</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Create a separate investment account for another child
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Child's first name</Label>
                    <Input 
                      placeholder="e.g., Maya, Noah, Sofia"
                      className="h-12 text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Date of birth</Label>
                    <Input 
                      type="date"
                      className="h-12"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30">
                    <p className="text-sm text-violet-800 dark:text-violet-200">
                      This creates a new investment account with its own holdings. You're on <span className="font-semibold">Family plan</span> so this is included!
                    </p>
                  </div>

                  <Button 
                    className="w-full h-12 text-base" 
                    onClick={() => { 
                      setShowPageSetup(false);
                      setEventStep(1);
                      toast({ 
                        title: "Fund created!", 
                        description: "New investment account is ready." 
                      });
                    }}
                  >
                    Create fund
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Beautiful Share Card Modal */}
      <Dialog open={showShareCard} onOpenChange={setShowShareCard}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="p-6 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-4"
            >
              <span className="text-4xl">🎉</span>
            </motion.div>
            <h2 className="text-xl font-semibold mb-2">Your event page is ready!</h2>
            <p className="text-sm text-muted-foreground mb-6">Share this beautiful card with friends and family</p>
          </div>

          {/* The Shareable Card */}
          <div className="px-6 pb-6">
            <div 
              id="share-card"
              className={`rounded-2xl overflow-hidden shadow-xl ${
                selectedEventType === "birthday" ? "bg-gradient-to-br from-pink-50 via-pink-100 to-rose-100" :
                selectedEventType === "graduation" ? "bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100" :
                selectedEventType === "bar_mitzvah" ? "bg-gradient-to-br from-indigo-50 via-indigo-100 to-violet-100" :
                selectedEventType === "wedding" ? "bg-gradient-to-br from-rose-50 via-rose-100 to-pink-100" :
                selectedEventType === "baby" ? "bg-gradient-to-br from-yellow-50 via-amber-100 to-orange-100" :
                selectedEventType === "baptism" ? "bg-gradient-to-br from-sky-50 via-sky-100 to-blue-100" :
                selectedEventType === "quinceañera" ? "bg-gradient-to-br from-fuchsia-50 via-fuchsia-100 to-purple-100" :
                selectedEventType === "holiday" ? "bg-gradient-to-br from-green-50 via-emerald-100 to-teal-100" :
                "bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100"
              }`}
            >
              {/* Card Header */}
              <div className="p-6 pb-4 text-center">
                <span className="text-5xl block mb-4">
                  {selectedEventType === "birthday" ? "🎂" :
                   selectedEventType === "graduation" ? "🎓" :
                   selectedEventType === "bar_mitzvah" ? "✡️" :
                   selectedEventType === "wedding" ? "💒" :
                   selectedEventType === "baby" ? "👶" :
                   selectedEventType === "baptism" ? "✝️" :
                   selectedEventType === "quinceañera" ? "👑" :
                   selectedEventType === "holiday" ? "🎄" : "✨"}
                </span>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">
                  {pageTitle || `${profileName}'s ${
                    selectedEventType === "birthday" ? "Birthday" :
                    selectedEventType === "graduation" ? "Graduation" :
                    selectedEventType === "bar_mitzvah" ? "Bar Mitzvah" :
                    selectedEventType === "wedding" ? "Wedding" :
                    selectedEventType === "baby" ? "Baby Shower" :
                    selectedEventType === "baptism" ? "Baptism" :
                    selectedEventType === "quinceañera" ? "Quinceañera" :
                    selectedEventType === "holiday" ? "Holiday Gift" : "Special Day"
                  }`}
                </h3>
                {eventDate && (
                  <p className="text-sm text-gray-600">{new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                )}
              </div>

              {/* QR Code Section */}
              <div className="px-6 pb-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-center mb-4">
                    <QRCodeSVG 
                      value={momentLink}
                      size={140}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-center text-sm font-medium text-gray-900 mb-1">
                    Scan to give a gift
                  </p>
                  <p className="text-center text-xs text-gray-500">
                    Your gift becomes a long-term investment
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">everleaf</span>
                  <span>·</span>
                  <span>Gifts that grow</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-0 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                className="flex-col h-auto py-3"
                onClick={() => {
                  navigator.clipboard.writeText(momentLink);
                  toast({ title: "Link copied!" });
                }}
              >
                <Copy className="h-4 w-4 mb-1" />
                <span className="text-xs">Copy Link</span>
              </Button>
              <Button 
                variant="outline" 
                className="flex-col h-auto py-3"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: pageTitle || `${profileName}'s Gift Fund`, url: momentLink });
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mb-1" />
                <span className="text-xs">Share</span>
              </Button>
              <Button 
                variant="outline" 
                className="flex-col h-auto py-3"
                onClick={() => window.print()}
              >
                <Download className="h-4 w-4 mb-1" />
                <span className="text-xs">Print</span>
              </Button>
            </div>
            <Button 
              className="w-full" 
              onClick={() => setShowShareCard(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight">Upgrade your plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Remove fees for your guests and unlock premium features.
            </p>

            {/* Plans */}
            <div className="space-y-3">
              {/* Plus */}
              <motion.div 
                whileHover={{ scale: 1.01 }}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  currentPlan === "plus" ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-foreground hover:bg-foreground/[0.02]"
                }`}
                onClick={() => { setCurrentPlan("plus"); setShowUpgrade(false); }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Plus</p>
                      <p className="text-xs text-muted-foreground mt-0.5">$99 per event</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">$99</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {["Zero fees for guests", "Premium thank-you cards", "Custom page branding", "Priority support"].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-amber-600" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Family */}
              <motion.div 
                whileHover={{ scale: 1.01 }}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  currentPlan === "family" ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20" : "border-muted hover:border-foreground/50 hover:bg-foreground/[0.02]"
                }`}
                onClick={() => { setCurrentPlan("family"); setShowUpgrade(false); }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Users className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Family</p>
                      <p className="text-xs text-muted-foreground mt-0.5">$199 per year</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">$199</p>
                    <p className="text-xs text-muted-foreground">/year</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {["Everything in Plus", "Up to 10 events per year", "Multiple children", "One unified dashboard", "Family analytics"].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-violet-600" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Current plan note */}
            {currentPlan === "free" && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Free plan: guests pay ~3% at checkout. You pay nothing.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
