import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Leaf, DollarSign, Check, ArrowLeft, ChevronDown, Lock, Zap, Eye, EyeOff, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link, useSearch } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const AMOUNTS = ["25", "50", "100", "200"];

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 600;
    const start = display;
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

export default function Moment() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recipientName = decodeURIComponent(params.get("name") || "Ari");
  const eventTitle = decodeURIComponent(params.get("title") || `${recipientName}'s Fund`);

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("50");
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hideAmount, setHideAmount] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const finalAmount = customAmount || amount;
  const fee = (Number(finalAmount) * 0.03).toFixed(2);
  const total = (Number(finalAmount) + Number(fee)).toFixed(2);

  const projectedGrowth = Math.round(Number(finalAmount) * 3.2);

  const handleContinue = () => setStep(1);
  const handleConfirm = () => {
    setIsProcessing(true);
    setTimeout(() => {
      toast({ title: "Gift sent", description: `$${finalAmount} contributed to ${recipientName}'s fund.` });
      setStep(2);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/">
            <a className="flex items-center gap-2 text-foreground">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold tracking-tight">Everleaf</span>
            </a>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Secure</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-md">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="amount" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <div className="text-center mb-10">
                <motion.div 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="mx-auto mb-5 h-14 w-14 rounded-full bg-foreground text-background flex items-center justify-center text-xl font-semibold"
                >
                  {recipientName.charAt(0)}
                </motion.div>
                <h1 className="text-xl font-semibold text-foreground tracking-tight">{eventTitle}</h1>
                <p className="text-muted-foreground text-sm mt-1">A gift that grows over time.</p>
              </div>

              <Card className="border overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">Amount</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {AMOUNTS.map((val) => (
                        <motion.div key={val} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            variant={amount === val && !customAmount ? "default" : "outline"}
                            onClick={() => { setAmount(val); setCustomAmount(""); }}
                            className={`h-12 w-full font-medium transition-all duration-200 ${amount === val && !customAmount ? "" : "hover:border-foreground/40"}`}
                            data-testid={`button-amount-${val}`}
                          >
                            ${val}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                    <div className="relative group">
                      <DollarSign className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                      <Input
                        placeholder="Other amount"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        className="pl-9 h-12 transition-all focus:ring-2 focus:ring-foreground/10"
                        data-testid="input-custom-amount"
                      />
                    </div>
                  </div>

                  {/* Growth projection */}
                  <motion.div 
                    className="p-4 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-foreground/60" />
                        <span className="text-sm text-muted-foreground">In 18 years</span>
                      </div>
                      <span className="font-semibold text-foreground">
                        <AnimatedNumber value={projectedGrowth} prefix="$" />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Projected at 7% annual return</p>
                  </motion.div>

                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">Your name</Label>
                    <Input 
                      placeholder={isAnonymous ? "Anonymous" : "First and last"}
                      value={giverName} 
                      onChange={(e) => setGiverName(e.target.value)} 
                      className="h-12 transition-all focus:ring-2 focus:ring-foreground/10"
                      disabled={isAnonymous}
                      data-testid="input-giver-name"
                    />
                  </div>

                  {/* Privacy options */}
                  <div className="space-y-3 p-4 rounded-lg border bg-foreground/[0.02]">
                    <motion.div 
                      className="flex items-center justify-between"
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Give anonymously</p>
                          <p className="text-xs text-muted-foreground">Your name won't be shown</p>
                        </div>
                      </div>
                      <Switch 
                        checked={isAnonymous} 
                        onCheckedChange={setIsAnonymous}
                        data-testid="switch-anonymous"
                      />
                    </motion.div>
                    <motion.div 
                      className="flex items-center justify-between"
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex items-center gap-3">
                        {hideAmount ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="text-sm font-medium">Hide amount</p>
                          <p className="text-xs text-muted-foreground">Only the family sees how much</p>
                        </div>
                      </div>
                      <Switch 
                        checked={hideAmount} 
                        onCheckedChange={setHideAmount}
                        data-testid="switch-hide-amount"
                      />
                    </motion.div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">Message <span className="text-muted-foreground/60">(optional)</span></Label>
                    <Textarea 
                      placeholder={`A note for ${recipientName}...`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[80px] resize-none transition-all focus:ring-2 focus:ring-foreground/10"
                      data-testid="input-message"
                    />
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button className="w-full h-12 font-medium" onClick={handleContinue} data-testid="button-continue">
                      Continue
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>

              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    How it works
                    <motion.div animate={{ rotate: showDetails ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4" />
                    </motion.div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="border">
                      <CardContent className="p-5 space-y-4 text-sm">
                        <div className="space-y-3">
                          {[
                            { q: "Where does it go?", a: `Directly into ${recipientName}'s brokerage account. Invested the same day.` },
                            { q: "Who controls it?", a: `${recipientName}'s parent/guardian until they come of age (18-21 depending on state).` },
                            { q: "What are the fees?", a: "~3% at checkout covers payment processing. No hidden fees, no annual charges." },
                            { q: "Can I get a refund?", a: "Yes, before the funds are invested (same day). Not after." },
                          ].map((item, i) => (
                            <div key={i} className="pb-3 border-b last:border-0 last:pb-0">
                              <p className="font-medium text-foreground">{item.q}</p>
                              <p className="text-muted-foreground mt-0.5">{item.a}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground pt-2">
                          Brokerage services provided by [Broker-Dealer], Member FINRA/SIPC. Clearing and custody by Apex Clearing Corporation.
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <button onClick={() => setStep(0)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <h1 className="text-xl font-semibold text-foreground tracking-tight mb-6">Confirm</h1>

              <Card className="border">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b">
                      <span className="text-muted-foreground">Gift</span>
                      <span className="font-medium">${finalAmount}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b">
                      <span className="text-muted-foreground">Processing</span>
                      <span className="font-medium">${fee}</span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="font-medium">Total</span>
                      <span className="font-semibold text-lg">${total}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-6 p-5 rounded-lg border"
              >
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">To</p>
                    <p className="font-medium">{recipientName}'s Fund</p>
                  </div>
                  <div>
                      <p className="text-muted-foreground text-xs">From</p>
                      <p className="font-medium">{isAnonymous ? "Anonymous" : (giverName || "You")}</p>
                      {(isAnonymous || hideAmount) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {isAnonymous && hideAmount 
                            ? "Name and amount hidden from others"
                            : isAnonymous 
                              ? "Name hidden from others" 
                              : "Amount hidden from others"}
                        </p>
                      )}
                    </div>
                  {message && (
                    <div>
                      <p className="text-muted-foreground text-xs">Message</p>
                      <p className="font-medium">{message}</p>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="mt-6">
                <Button 
                  className="w-full h-12 font-medium" 
                  onClick={handleConfirm} 
                  disabled={isProcessing}
                  data-testid="button-confirm"
                >
                  {isProcessing ? (
                    <motion.div 
                      className="flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full"
                      />
                      Processing...
                    </motion.div>
                  ) : (
                    `Pay $${total}`
                  )}
                </Button>
              </motion.div>

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6">
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Encrypted</span>
                <span>•</span>
                <span>Apple Pay, cards, bank</span>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="done" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="text-center py-16"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="mx-auto h-16 w-16 rounded-full bg-foreground flex items-center justify-center mb-6"
              >
                <Check className="h-8 w-8 text-background" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">Gift sent</h1>
                <p className="text-muted-foreground mb-2">
                  ${finalAmount} is on its way to {recipientName}'s fund.
                </p>
                <p className="text-sm text-muted-foreground/70 mb-8">
                  Could grow to <AnimatedNumber value={projectedGrowth} prefix="$" /> in 18 years.
                </p>
                <Link href="/">
                  <Button variant="outline">Done</Button>
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
