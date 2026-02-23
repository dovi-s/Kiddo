import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Lock, Shield, Plus, Trash2, User, Users, Sparkles, TrendingUp, Heart, Gift, Star, ChevronRight, Wallet } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { useCreateFund } from "@/hooks/use-funds";
import { Mascot } from "@/components/ui/mascot";

type AccountType = "parent" | "adult" | null;

interface ChildProfile {
  id: string;
  name: string;
  relationship: string;
}

type Step = "hook" | "choose" | "personalize" | "projection" | "account" | "children" | "success";

const fadeSlide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.15 }
};

const staggerChildren = {
  animate: { transition: { staggerChildren: 0.05 } }
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.15 }
};

export default function GetStarted() {
  const [, setLocation] = useLocation();
  const createFundMutation = useCreateFund();
  const [step, setStep] = useState<Step>("hook");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [children, setChildren] = useState<ChildProfile[]>([
    { id: "1", name: "", relationship: "Parent" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectedAmount, setProjectedAmount] = useState(500);

  const projectedGrowth = Math.round(projectedAmount * Math.pow(1.07, 15));
  const fundName = recipientName || (accountType === "parent" ? "Your child" : "You");

  const addChild = () => {
    setChildren([...children, { 
      id: Date.now().toString(), 
      name: "", 
      relationship: "Parent" 
    }]);
  };

  const removeChild = (id: string) => {
    if (children.length > 1) {
      setChildren(children.filter(c => c.id !== id));
    }
  };

  const updateChild = (id: string, field: keyof ChildProfile, value: string) => {
    setChildren(children.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const canProceed = () => {
    if (step === "choose") return accountType !== null;
    if (step === "personalize") return recipientName.trim().length > 0;
    if (step === "account") return email && password.length >= 8;
    if (step === "children") return children.every(c => c.name.trim());
    return true;
  };

  const handleNext = () => {
    haptic('selection');
    if (step === "hook") setStep("choose");
    else if (step === "choose") setStep("personalize");
    else if (step === "personalize") setStep("projection");
    else if (step === "projection") setStep("account");
    else if (step === "account") {
      if (accountType === "parent") {
        if (recipientName) {
          setChildren([{ id: "1", name: recipientName, relationship: "Parent" }]);
        }
        setStep("children");
      } else {
        handleSubmit();
      }
    } else if (step === "children") {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    haptic('medium');
    setIsSubmitting(true);
    
    try {
      if (accountType === "parent") {
        const childrenToCreate = children.filter(c => c.name.trim());
        for (const child of childrenToCreate) {
          await createFundMutation.mutateAsync({
            name: child.name.trim(),
            slug: child.name.trim().toLowerCase().replace(/\s+/g, '-'),
            accountType: "UTMA",
            status: "draft",
          });
        }
      } else {
        await createFundMutation.mutateAsync({
          name: recipientName.trim() || "My Fund",
          slug: (recipientName.trim() || "my-fund").toLowerCase().replace(/\s+/g, '-'),
          accountType: "Individual",
          status: "draft",
        });
      }
      
      haptic('success');
      setStep("success");
    } catch (error) {
      console.error("Failed to create fund:", error);
      haptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    haptic('light');
    if (step === "choose") setStep("hook");
    else if (step === "personalize") setStep("choose");
    else if (step === "projection") setStep("personalize");
    else if (step === "account") setStep("projection");
    else if (step === "children") setStep("account");
  };

  const getProgress = () => {
    const parentSteps: Step[] = ["personalize", "projection", "account", "children"];
    const adultSteps: Step[] = ["personalize", "projection", "account"];
    const steps = accountType === "parent" ? parentSteps : adultSteps;
    const current = steps.indexOf(step);
    if (current === -1) return null;
    return { current: current + 1, total: steps.length };
  };

  const progress = getProgress();

  const PremiumHeader = ({ showBack = true }: { showBack?: boolean }) => (
    <header className="sticky top-0 z-40 bg-background pb-4">
      <div className="max-w-lg mx-auto px-4 pt-4 flex items-center justify-between">
        {showBack ? (
          <button 
            onClick={handleBack} 
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="w-10" />
        )}
        {progress && (
          <div className="flex gap-1.5">
            {Array.from({ length: progress.total }).map((_, i) => (
              <motion.div 
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, duration: 0.15 }}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i < progress.current 
                    ? "w-8 bg-primary" 
                    : "w-4 bg-border"
                }`} 
              />
            ))}
          </div>
        )}
        <div className="w-10" />
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        
        {/* HOOK - Premium welcome */}
        {step === "hook" && (
          <motion.div
            key="hook"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                className="relative z-10 text-center max-w-md"
              >
                <Logo size="lg" className="mx-auto mb-8 text-primary" />
                
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.2 }}
                  className="mb-8"
                >
                  <div className="w-28 h-28 mx-auto rounded-3xl bg-primary flex items-center justify-center shadow-lg">
                    <Gift className="w-14 h-14 text-primary-foreground" />
                  </div>
                </motion.div>

                <h1 className="text-3xl md:text-4xl font-semibold text-foreground mb-4 leading-tight">
                  Give something that<br />
                  <span className="text-[hsl(var(--kora-evergreen))]">grows with them</span>
                </h1>
                
                <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
                  Transform birthday money into real investments that compound over time.
                </p>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.2 }}
                  className="space-y-4"
                >
                  <Button
                    onClick={handleNext}
                    size="lg"
                    className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
                    data-testid="button-start"
                  >
                    Start in 2 minutes
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  
                  <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Shield size={14} />
                      <span>SIPC protected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock size={14} />
                      <span>Bank-level security</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>

            <div className="px-6 pb-8 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account? <Link href="/login"><span className="text-foreground underline">Sign in</span></Link>
              </p>
            </div>
          </motion.div>
        )}

        {/* CHOOSE - Who is this fund for? */}
        {step === "choose" && (
          <motion.div
            key="choose"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <PremiumHeader />

            <main className="flex-1 px-6 pb-12 max-w-lg mx-auto w-full">
              <div className="relative mb-8">
                <motion.div {...fadeUp} className="relative">
                  <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
                    Who is this fund for?
                  </h1>
                  <p className="text-muted-foreground">
                    Choose the account type that fits your situation
                  </p>
                </motion.div>
              </div>

              <motion.div 
                variants={staggerChildren}
                initial="initial"
                animate="animate"
                className="space-y-4"
              >
                <motion.button
                  variants={fadeUp}
                  onClick={() => setAccountType("parent")}
                  data-testid="option-parent"
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-150 ${
                    accountType === "parent"
                      ? "border-primary bg-card shadow-lg ring-4 ring-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150 ${
                      accountType === "parent" 
                        ? "bg-primary shadow-lg" 
                        : "bg-muted"
                    }`}>
                      <Users size={22} className={accountType === "parent" ? "text-primary-foreground" : "text-muted-foreground"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-lg mb-1">For my child</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        You manage everything. They get a custodial investment account that transfers at 18-21.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-success/10 text-success rounded-lg text-xs font-medium">Most popular</span>
                      </div>
                    </div>
                    {accountType === "parent" && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0"
                      >
                        <Check size={14} className="text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.button>

                <motion.button
                  variants={fadeUp}
                  onClick={() => setAccountType("adult")}
                  data-testid="option-adult"
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-150 ${
                    accountType === "adult"
                      ? "border-primary bg-card shadow-lg ring-4 ring-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150 ${
                      accountType === "adult" 
                        ? "bg-primary shadow-lg" 
                        : "bg-muted"
                    }`}>
                      <User size={22} className={accountType === "adult" ? "text-primary-foreground" : "text-muted-foreground"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-lg mb-1">For myself</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Personal investment fund. Perfect for weddings, graduations, or any milestone.
                      </p>
                    </div>
                    {accountType === "adult" && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0"
                      >
                        <Check size={14} className="text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.button>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.15 }}
                className="mt-8"
              >
                <Button
                  onClick={handleNext}
                  disabled={!accountType}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 shadow-lg"
                  data-testid="button-continue-choose"
                >
                  Continue
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                
                {accountType === "parent" && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-muted-foreground text-center mt-4"
                  >
                    You can add a personal fund for yourself later
                  </motion.p>
                )}
              </motion.div>
            </main>
          </motion.div>
        )}

        {/* PERSONALIZE - Name entry */}
        {step === "personalize" && (
          <motion.div
            key="personalize"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <PremiumHeader />

            <main className="flex-1 flex flex-col px-6 pb-12 max-w-lg mx-auto w-full">
              <div className="relative mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
                    accountType === "parent" 
                      ? "bg-[hsl(var(--kora-gold))]" 
                      : "bg-primary"
                  }`}
                >
                  {accountType === "parent" ? (
                    <Heart className="w-8 h-8 text-white" />
                  ) : (
                    <User className="w-8 h-8 text-primary-foreground" />
                  )}
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
                  {accountType === "parent" 
                    ? "What's your child's name?" 
                    : "What's your first name?"}
                </h1>
                <p className="text-muted-foreground">
                  {accountType === "parent"
                    ? "We'll create their personalized Future Fund"
                    : "We'll personalize your fund and shareable link"}
                </p>
              </div>

              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    onFocus={() => haptic('light')}
                    placeholder={accountType === "parent" ? "e.g., Mila" : "e.g., Sarah"}
                    autoFocus
                    data-testid="input-recipient-name"
                    className="w-full h-14 px-5 text-xl font-medium border-2 border-border/50 rounded-2xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-premium-sm transition-all duration-150 bg-card"
                  />
                </div>

                <AnimatePresence>
                  {recipientName && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mt-4 overflow-hidden"
                    >
                      <div className="p-4 rounded-2xl bg-success/10 border border-success/20">
                        <p className="text-sm text-[hsl(var(--kora-evergreen))]">
                          <span className="font-semibold">{recipientName}'s Future Fund</span> — {accountType === "parent" ? "their" : "your"} personalized investment account
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-auto pt-8">
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 shadow-lg"
                  data-testid="button-continue-personalize"
                >
                  Continue
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </main>
          </motion.div>
        )}

        {/* PROJECTION - Growth calculator */}
        {step === "projection" && (
          <motion.div
            key="projection"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <PremiumHeader />

            <main className="flex-1 flex flex-col px-6 pb-12 max-w-lg mx-auto w-full">
              <div className="relative mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-16 h-16 rounded-2xl bg-success flex items-center justify-center mb-6 shadow-lg"
                >
                  <TrendingUp className="w-8 h-8 text-success-foreground" />
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
                  Watch {fundName}'s future grow
                </h1>
                <p className="text-muted-foreground">
                  See how gifts compound into something meaningful
                </p>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.15 }}
                className="flex-1"
              >
                <div className="bg-card rounded-3xl p-6 shadow-lg border border-border mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-muted-foreground">Annual gifts</span>
                    <span className="font-serif text-2xl font-bold text-foreground">${projectedAmount}</span>
                  </div>
                  
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="100"
                    value={projectedAmount}
                    onChange={(e) => setProjectedAmount(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    data-testid="slider-projection"
                  />
                  
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>$100</span>
                    <span>$2,000</span>
                  </div>

                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">In 15 years</p>
                        <motion.p 
                          key={projectedGrowth}
                          initial={{ scale: 1.05 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.15 }}
                          className="font-serif text-4xl font-bold text-success"
                        >
                          ${projectedGrowth.toLocaleString()}
                        </motion.p>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 rounded-full text-success text-sm font-medium">
                          <TrendingUp size={14} />
                          {((projectedGrowth / (projectedAmount * 15) - 1) * 100).toFixed(0)}% growth
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted rounded-2xl border border-border">
                  <Sparkles className="w-5 h-5 text-[hsl(var(--kora-gold))] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Based on historical S&P 500 average returns of ~7% annually. Past performance doesn't guarantee future results.
                  </p>
                </div>
              </motion.div>

              <div className="mt-auto pt-8">
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
                  data-testid="button-continue-projection"
                >
                  Continue
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </main>
          </motion.div>
        )}

        {/* ACCOUNT - Create account */}
        {step === "account" && (
          <motion.div
            key="account"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <PremiumHeader />

            <main className="flex-1 flex flex-col px-6 pb-12 max-w-lg mx-auto w-full">
              <div className="relative mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 shadow-lg"
                >
                  <Wallet className="w-8 h-8 text-primary-foreground" />
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
                  Create your account
                </h1>
                <p className="text-muted-foreground">
                  {accountType === "parent" 
                    ? `You'll manage ${recipientName}'s fund from here`
                    : "Secure your fund with an account"}
                </p>
              </div>

              <motion.div 
                variants={staggerChildren}
                initial="initial"
                animate="animate"
                className="flex-1 space-y-5"
              >
                <motion.div variants={fadeUp}>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    data-testid="input-email"
                    className="w-full px-4 py-4 border-2 border-border rounded-2xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all duration-150 bg-card"
                  />
                </motion.div>

                <motion.div variants={fadeUp}>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    data-testid="input-password"
                    className="w-full px-4 py-4 border-2 border-border rounded-2xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all duration-150 bg-card"
                  />
                  <p className="text-xs text-muted-foreground mt-2">At least 8 characters</p>
                </motion.div>

                <motion.div variants={fadeUp} className="pt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Shield size={14} />
                    <span>SIPC protected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock size={14} />
                    <span>256-bit encryption</span>
                  </div>
                </motion.div>
              </motion.div>

              <div className="mt-auto pt-8">
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 shadow-lg"
                  data-testid="button-continue-account"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div 
                        className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full mr-2"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Creating account...
                    </>
                  ) : (
                    <>
                      {accountType === "adult" ? "Create my fund" : "Continue"}
                      {accountType === "adult" ? <Check className="ml-2 w-5 h-5" /> : <ArrowRight className="ml-2 w-5 h-5" />}
                    </>
                  )}
                </Button>
              </div>
            </main>
          </motion.div>
        )}

        {/* CHILDREN - Confirm child details (parent flow only) */}
        {step === "children" && (
          <motion.div
            key="children"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <PremiumHeader />

            <main className="flex-1 flex flex-col px-6 pb-12 max-w-lg mx-auto w-full">
              <div className="relative mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-16 h-16 rounded-2xl bg-[hsl(var(--kora-gold))] flex items-center justify-center mb-6 shadow-lg"
                >
                  <Heart className="w-8 h-8 text-white" />
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
                  Confirm the details
                </h1>
                <p className="text-muted-foreground">
                  You can add more children later from your dashboard
                </p>
              </div>

              <motion.div 
                variants={staggerChildren}
                initial="initial"
                animate="animate"
                className="flex-1 space-y-4"
              >
                {children.map((child, index) => (
                  <motion.div
                    key={child.id}
                    variants={fadeUp}
                    className="bg-card rounded-2xl border-2 border-border p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-foreground">
                        Child {index + 1}
                      </span>
                      {children.length > 1 && (
                        <button
                          onClick={() => removeChild(child.id)}
                          data-testid={`button-remove-child-${index}`}
                          className="text-muted-foreground hover:text-foreground p-1 transition-colors duration-150"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                          First name
                        </label>
                        <input
                          type="text"
                          value={child.name}
                          onChange={(e) => updateChild(child.id, "name", e.target.value)}
                          placeholder="e.g., Mila"
                          data-testid={`input-child-name-${index}`}
                          className="w-full px-4 py-3 border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all duration-150 bg-card"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                          Your relationship
                        </label>
                        <select
                          value={child.relationship}
                          onChange={(e) => updateChild(child.id, "relationship", e.target.value)}
                          data-testid={`select-relationship-${index}`}
                          className="w-full px-4 py-3 border-2 border-border rounded-xl text-foreground bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all duration-150"
                        >
                          <option value="Parent">Parent</option>
                          <option value="Legal guardian">Legal guardian</option>
                          <option value="Grandparent">Grandparent</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <motion.button
                  variants={fadeUp}
                  onClick={addChild}
                  data-testid="button-add-child"
                  className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-muted-foreground hover:border-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  <span>Add another child</span>
                </motion.button>
              </motion.div>

              <div className="mt-auto pt-8">
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 shadow-lg"
                  data-testid="button-create-fund"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div 
                        className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full mr-2"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Creating fund...
                    </>
                  ) : (
                    <>
                      Create {children.length > 1 ? `${children.length} funds` : `${children[0]?.name || "the"}'s fund`}
                      <Check className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
                  By continuing, you agree to Kora's Terms of Service and Privacy Policy
                </p>
              </div>
            </main>
          </motion.div>
        )}

        {/* SUCCESS */}
        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative"
          >
            <div className="relative z-10 text-center max-w-sm w-full">
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="mb-6 mx-auto"
              >
                <Mascot size="xl" className="mx-auto" context="getstarted-success" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.15 }}
                className="text-3xl font-semibold text-foreground mb-3"
              >
                {accountType === "parent" && children.length > 1 
                  ? "Funds created!" 
                  : `${recipientName}'s fund is ready!`}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.15 }}
                className="text-muted-foreground mb-10 leading-relaxed"
              >
                Share the link with family and friends to start receiving gifts that grow
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.15 }}
                className="space-y-3"
              >
                <Button
                  onClick={() => {
                    const childNames = children.map(c => c.name).join(",");
                    setLocation(`/activate?type=${accountType === "parent" ? "child" : "personal"}&children=${encodeURIComponent(childNames)}`);
                  }}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
                  data-testid="button-activate-investing"
                >
                  <Shield className="mr-2 w-5 h-5" />
                  Activate investing
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Quick verification (~2 min) so gifts become real investments
                </p>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-background text-xs text-muted-foreground">or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    const childNames = children.map(c => c.name).join(",");
                    setLocation(`/dashboard?type=${accountType === "parent" ? "child" : "personal"}&name=${encodeURIComponent(recipientName)}&children=${encodeURIComponent(childNames)}&new=true`);
                  }}
                  size="lg"
                  className="w-full h-12 text-base rounded-2xl"
                  data-testid="button-go-to-dashboard"
                >
                  Skip for now, go to dashboard
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  You can activate anytime from your dashboard
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
