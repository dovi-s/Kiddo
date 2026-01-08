import { useState, useEffect } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, QrCode, Copy, MessageSquare, Check, ArrowRight, Settings, ExternalLink, TrendingUp, UserPlus, X, Download } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showQR, setShowQR] = useState(false);
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
            <div className="flex items-center gap-1">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-foreground/5"
                  onClick={() => setShowInvite(true)}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </motion.div>
              <Link href={`/settings?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
                <Button variant="ghost" size="icon" className="hover:bg-foreground/5">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
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
                      <Link href={`/onboard?type=${accountType}&name=${encodeURIComponent(profileName)}&email=${encodeURIComponent(userEmail)}`}>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button size="sm" onClick={() => setBrokerageOpen(true)}>
                            Continue <ArrowRight className="ml-2 h-3 w-3" />
                          </Button>
                        </motion.div>
                      </Link>
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
                  className="flex items-center justify-between p-5 border rounded-lg opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium text-muted-foreground">
                      3
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Create shareable page</p>
                      <p className="text-xs text-muted-foreground">For events or always-on</p>
                    </div>
                  </div>
                </motion.div>

                {/* Step 4 */}
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-between p-5 border rounded-lg opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium text-muted-foreground">
                      4
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Share with family</p>
                      <p className="text-xs text-muted-foreground">Send your link</p>
                    </div>
                  </div>
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
    </div>
  );
}
