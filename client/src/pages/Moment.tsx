import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Lock, ArrowLeft, Heart, Sparkles, Gift, Check, CreditCard, Smartphone } from "lucide-react";
import { Link, useSearch } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/logo";

const AMOUNTS = [25, 50, 100, 250];

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 800;
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
  const recipientName = decodeURIComponent(params.get("name") || "Mila");
  const eventTitle = decodeURIComponent(params.get("title") || "");

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"apple" | "card">("apple");

  const finalAmount = customAmount ? parseInt(customAmount) : amount;
  const fee = Math.round(finalAmount * 0.03 * 100) / 100;
  const total = (finalAmount + fee).toFixed(2);
  const projectedGrowth = Math.round(finalAmount * 4.6); // ~18 years at 7%

  const handleGive = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep(2);
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-background to-background dark:from-slate-950/20">
      {/* Header */}
      <header className="p-4 sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto flex justify-between items-center max-w-lg">
          <Logo size="md" className="text-foreground" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
            <Lock className="h-3 w-3" />
            <span>Secure</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <AnimatePresence mode="wait">
          
          {/* Step 0: Amount Selection */}
          {step === 0 && (
            <motion.div 
              key="amount"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              {/* Recipient Hero */}
              <div className="text-center mb-10">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-3xl font-semibold shadow-xl shadow-slate-500/25"
                >
                  {recipientName.charAt(0)}
                </motion.div>
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-2"
                >
                  Give to {recipientName}
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-muted-foreground"
                >
                  {eventTitle || "A gift that grows with them"}
                </motion.p>
              </div>

              {/* Amount Selection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-0 shadow-xl shadow-black/5 overflow-hidden">
                  <CardContent className="p-6 space-y-6">
                    
                    {/* Preset Amounts */}
                    <div>
                      <Label className="text-sm text-muted-foreground mb-3 block">Choose amount</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {AMOUNTS.map((val) => (
                          <motion.button
                            key={val}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => { setAmount(val); setCustomAmount(""); }}
                            className={`h-14 rounded-xl font-semibold text-lg transition-all ${
                              amount === val && !customAmount
                                ? "bg-foreground text-background shadow-lg"
                                : "bg-muted/50 text-foreground hover:bg-muted"
                            }`}
                          >
                            ${val}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Amount */}
                    <div>
                      <Label className="text-sm text-muted-foreground mb-2 block">Or enter custom</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Other"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                          className="h-14 pl-10 text-xl font-medium border-2 focus:border-foreground"
                        />
                      </div>
                    </div>

                    {/* Future Value - The Magic */}
                    <motion.div 
                      layout
                      className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">This could become</p>
                          <p className="text-3xl font-light tracking-tight">
                            <AnimatedNumber value={projectedGrowth} prefix="$" />
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400 text-sm">in 18 years</p>
                          <p className="text-emerald-400 text-sm font-medium">+{Math.round((projectedGrowth / finalAmount - 1) * 100)}% growth</p>
                        </div>
                      </div>
                    </motion.div>

                    {/* Continue Button */}
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button 
                        className="w-full h-14 text-lg font-semibold rounded-xl"
                        onClick={() => setStep(1)}
                        disabled={finalAmount < 5}
                      >
                        Continue
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Trust Elements */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 text-center"
              >
                <p className="text-xs text-muted-foreground">
                  Invested same-day · Protected by SIPC up to $500,000
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* Step 1: Details & Payment */}
          {step === 1 && (
            <motion.div 
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              {/* Back Button */}
              <button 
                onClick={() => setStep(0)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              {/* Summary Header */}
              <div className="text-center mb-8">
                <p className="text-muted-foreground mb-1">Giving to {recipientName}</p>
                <p className="text-4xl font-light tracking-tight">${finalAmount}</p>
              </div>

              <Card className="border-0 shadow-xl shadow-black/5 overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  
                  {/* Your Name */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Your name</Label>
                    <Input 
                      placeholder="First and last"
                      value={giverName}
                      onChange={(e) => setGiverName(e.target.value)}
                      className="h-12 border-2 focus:border-foreground"
                      disabled={isAnonymous}
                    />
                    <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-muted/30">
                      <span className="text-sm">Give anonymously</span>
                      <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Message for {recipientName} <span className="text-muted-foreground/50">(optional)</span>
                    </Label>
                    <Textarea 
                      placeholder={`Write something they'll read in the future...`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[100px] border-2 focus:border-foreground resize-none"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-3 block">Pay with</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod("apple")}
                        className={`p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                          paymentMethod === "apple" 
                            ? "border-foreground bg-foreground/5" 
                            : "border-muted hover:border-foreground/30"
                        }`}
                      >
                        <Smartphone className="h-5 w-5" />
                        <span className="font-medium">Apple Pay</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod("card")}
                        className={`p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                          paymentMethod === "card" 
                            ? "border-foreground bg-foreground/5" 
                            : "border-muted hover:border-foreground/30"
                        }`}
                      >
                        <CreditCard className="h-5 w-5" />
                        <span className="font-medium">Card</span>
                      </button>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gift amount</span>
                      <span>${finalAmount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Processing (3%)</span>
                      <span>${fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Total</span>
                      <span>${total}</span>
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button 
                      className="w-full h-14 text-lg font-semibold rounded-xl bg-foreground hover:bg-foreground/90"
                      onClick={handleGive}
                      disabled={isProcessing || (!giverName && !isAnonymous)}
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="h-5 w-5 border-2 border-background/30 border-t-background rounded-full"
                          />
                          Processing...
                        </span>
                      ) : (
                        `Give $${total}`
                      )}
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center mt-4">
                100% goes to {recipientName}'s investment account
              </p>
            </motion.div>
          )}

          {/* Step 2: Success! */}
          {step === 2 && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center pt-12"
            >
              {/* Celebration Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto mb-8 h-24 w-24 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-xl shadow-slate-500/30"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  <Check className="h-12 w-12 text-white" strokeWidth={3} />
                </motion.div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-semibold tracking-tight mb-3"
              >
                Gift sent!
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-muted-foreground mb-8"
              >
                ${finalAmount} is on its way to {recipientName}'s fund
              </motion.p>

              {/* Future Value Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-0 shadow-xl shadow-black/5 overflow-hidden max-w-sm mx-auto">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xl font-semibold text-white">
                        {recipientName.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{recipientName}'s Fund</p>
                        <p className="text-sm text-muted-foreground">Your gift is growing</p>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-slate-400 text-sm">Your ${finalAmount} could become</p>
                          <p className="text-2xl font-light">${projectedGrowth.toLocaleString()}</p>
                        </div>
                        <p className="text-emerald-400 text-sm">in 18 years</p>
                      </div>
                    </div>

                    {message && (
                      <div className="mt-4 p-4 rounded-xl bg-muted/30">
                        <p className="text-sm text-muted-foreground mb-1">Your message</p>
                        <p className="text-sm font-medium">"{message}"</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Share */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-8"
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Know others who'd want to give?
                </p>
                <Button variant="outline" className="rounded-xl">
                  Share {recipientName}'s fund
                </Button>
              </motion.div>

              {/* Create Your Own */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-12 p-6 rounded-2xl bg-muted/30"
              >
                <Gift className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium mb-2">Create a fund for someone you love</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Takes 2 minutes. Free to start.
                </p>
                <Link href="/get-started">
                  <Button>Create a fund</Button>
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
