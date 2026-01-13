import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Lock, Shield, Plus, Trash2, User, Users, Sparkles, TrendingUp, Heart, Gift, Star, ChevronRight, Wallet } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

type AccountType = "parent" | "adult" | null;

interface ChildProfile {
  id: string;
  name: string;
  relationship: string;
}

type Step = "hook" | "choose" | "personalize" | "projection" | "account" | "children" | "success";

const fadeSlide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { type: "spring" as const, stiffness: 300, damping: 30 }
};

const staggerChildren = {
  animate: { transition: { staggerChildren: 0.1 } }
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

export default function GetStarted() {
  const [, setLocation] = useLocation();
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

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setStep("success");
      setIsSubmitting(false);
    }, 1500);
  };

  const handleBack = () => {
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
    <header className="sticky top-0 z-40 bg-gradient-to-b from-stone-50 via-stone-50/95 to-stone-50/0 pb-4">
      <div className="max-w-lg mx-auto px-4 pt-4 flex items-center justify-between">
        {showBack ? (
          <button 
            onClick={handleBack} 
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-700 hover:bg-white transition-all shadow-sm"
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
                transition={{ delay: i * 0.05 }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < progress.current 
                    ? "w-8 bg-stone-900" 
                    : "w-4 bg-stone-200"
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
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 overflow-hidden">
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
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-emerald-200/40 to-teal-100/30 rounded-full blur-3xl"
              />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-amber-100/40 to-orange-100/30 rounded-full blur-3xl"
              />
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="relative z-10 text-center max-w-md"
              >
                <Logo size="lg" className="mx-auto mb-8 text-stone-900" />
                
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
                  className="mb-8"
                >
                  <div className="w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-stone-900 to-stone-700 flex items-center justify-center shadow-2xl shadow-stone-900/30 ring-4 ring-white/50">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        repeatType: "reverse"
                      }}
                    >
                      <Gift className="w-14 h-14 text-white" />
                    </motion.div>
                  </div>
                </motion.div>

                <h1 className="text-3xl md:text-4xl font-semibold text-stone-900 mb-4 leading-tight">
                  Give something that<br />
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">grows with them</span>
                </h1>
                
                <p className="text-lg text-stone-500 mb-10 leading-relaxed">
                  Transform birthday money into real investments that compound over time.
                </p>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-4"
                >
                  <Button
                    onClick={handleNext}
                    size="lg"
                    className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 shadow-xl shadow-stone-900/20"
                    data-testid="button-start"
                  >
                    Start in 2 minutes
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  
                  <div className="flex items-center justify-center gap-6 text-xs text-stone-400">
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
              <p className="text-sm text-stone-400">
                Already have an account? <Link href="/login"><span className="text-stone-700 underline">Sign in</span></Link>
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
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.5 }}
                  className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-full blur-2xl"
                />
                <motion.div {...fadeUp} className="relative">
                  <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 mb-3">
                    Who is this fund for?
                  </h1>
                  <p className="text-stone-500">
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
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                    accountType === "parent"
                      ? "border-stone-900 bg-gradient-to-br from-white to-stone-50 shadow-lg ring-4 ring-stone-900/5"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      accountType === "parent" 
                        ? "bg-gradient-to-br from-stone-900 to-stone-700 shadow-lg" 
                        : "bg-stone-100"
                    }`}>
                      <Users size={22} className={accountType === "parent" ? "text-white" : "text-stone-500"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-stone-900 text-lg mb-1">For my child</p>
                      <p className="text-sm text-stone-500 leading-relaxed">
                        You manage everything. They get a custodial investment account that transfers at 18-21.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium">Most popular</span>
                      </div>
                    </div>
                    {accountType === "parent" && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center flex-shrink-0"
                      >
                        <Check size={14} className="text-white" />
                      </motion.div>
                    )}
                  </div>
                </motion.button>

                <motion.button
                  variants={fadeUp}
                  onClick={() => setAccountType("adult")}
                  data-testid="option-adult"
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                    accountType === "adult"
                      ? "border-stone-900 bg-gradient-to-br from-white to-stone-50 shadow-lg ring-4 ring-stone-900/5"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      accountType === "adult" 
                        ? "bg-gradient-to-br from-stone-900 to-stone-700 shadow-lg" 
                        : "bg-stone-100"
                    }`}>
                      <User size={22} className={accountType === "adult" ? "text-white" : "text-stone-500"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-stone-900 text-lg mb-1">For myself</p>
                      <p className="text-sm text-stone-500 leading-relaxed">
                        Personal investment fund. Perfect for weddings, graduations, or any milestone.
                      </p>
                    </div>
                    {accountType === "adult" && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center flex-shrink-0"
                      >
                        <Check size={14} className="text-white" />
                      </motion.div>
                    )}
                  </div>
                </motion.button>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <Button
                  onClick={handleNext}
                  disabled={!accountType}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 shadow-lg shadow-stone-900/10"
                  data-testid="button-continue-choose"
                >
                  Continue
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                
                {accountType === "parent" && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-stone-400 text-center mt-4"
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
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.5 }}
                  className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-pink-100 to-rose-50 rounded-full blur-2xl"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
                    accountType === "parent" 
                      ? "bg-gradient-to-br from-pink-400 to-rose-500" 
                      : "bg-gradient-to-br from-stone-700 to-stone-900"
                  }`}
                >
                  {accountType === "parent" ? (
                    <Heart className="w-8 h-8 text-white" />
                  ) : (
                    <User className="w-8 h-8 text-white" />
                  )}
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 mb-3">
                  {accountType === "parent" 
                    ? "What's your child's name?" 
                    : "What's your first name?"}
                </h1>
                <p className="text-stone-500">
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
                    placeholder={accountType === "parent" ? "e.g., Mila" : "e.g., Sarah"}
                    autoFocus
                    data-testid="input-recipient-name"
                    className="w-full px-5 py-4 text-xl font-medium border-2 border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition-all bg-white"
                  />
                </div>

                <AnimatePresence>
                  {recipientName && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="mt-4 overflow-hidden"
                    >
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                        <p className="text-sm text-emerald-800">
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
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 shadow-lg shadow-stone-900/10"
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
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.5 }}
                  className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-full blur-2xl"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-6 shadow-lg"
                >
                  <TrendingUp className="w-8 h-8 text-white" />
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 mb-3">
                  Watch {fundName}'s future grow
                </h1>
                <p className="text-stone-500">
                  See how gifts compound into something meaningful
                </p>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1"
              >
                <div className="bg-white rounded-3xl p-6 shadow-xl border border-stone-100 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-stone-500">Annual gifts</span>
                    <span className="text-2xl font-bold text-stone-900">${projectedAmount}</span>
                  </div>
                  
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="100"
                    value={projectedAmount}
                    onChange={(e) => setProjectedAmount(Number(e.target.value))}
                    className="w-full h-2 bg-stone-100 rounded-full appearance-none cursor-pointer accent-stone-900"
                    data-testid="slider-projection"
                  />
                  
                  <div className="flex justify-between text-xs text-stone-400 mt-2">
                    <span>$100</span>
                    <span>$2,000</span>
                  </div>

                  <div className="mt-8 pt-6 border-t border-stone-100">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-sm text-stone-500 mb-1">In 15 years</p>
                        <motion.p 
                          key={projectedGrowth}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className="text-4xl font-bold text-emerald-600"
                        >
                          ${projectedGrowth.toLocaleString()}
                        </motion.p>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium">
                          <TrendingUp size={14} />
                          {((projectedGrowth / (projectedAmount * 15) - 1) * 100).toFixed(0)}% growth
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-stone-600">
                    Based on historical S&P 500 average returns of ~7% annually. Past performance doesn't guarantee future results.
                  </p>
                </div>
              </motion.div>

              <div className="mt-auto pt-8">
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 shadow-lg shadow-stone-900/10"
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
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.5 }}
                  className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-100 to-indigo-50 rounded-full blur-2xl"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center mb-6 shadow-lg"
                >
                  <Wallet className="w-8 h-8 text-white" />
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 mb-3">
                  Create your account
                </h1>
                <p className="text-stone-500">
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
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    data-testid="input-email"
                    className="w-full px-4 py-4 border-2 border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition-all bg-white"
                  />
                </motion.div>

                <motion.div variants={fadeUp}>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    data-testid="input-password"
                    className="w-full px-4 py-4 border-2 border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition-all bg-white"
                  />
                  <p className="text-xs text-stone-400 mt-2">At least 8 characters</p>
                </motion.div>

                <motion.div variants={fadeUp} className="pt-4 flex items-center justify-center gap-6 text-xs text-stone-400">
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
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 shadow-lg shadow-stone-900/10"
                  data-testid="button-continue-account"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div 
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full mr-2"
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
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.5 }}
                  className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-pink-100 to-rose-50 rounded-full blur-2xl"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center mb-6 shadow-lg"
                >
                  <Heart className="w-8 h-8 text-white" />
                </motion.div>

                <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 mb-3">
                  Confirm the details
                </h1>
                <p className="text-stone-500">
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
                    className="bg-white rounded-2xl border-2 border-stone-200 p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-stone-700">
                        Child {index + 1}
                      </span>
                      {children.length > 1 && (
                        <button
                          onClick={() => removeChild(child.id)}
                          data-testid={`button-remove-child-${index}`}
                          className="text-stone-400 hover:text-stone-600 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-stone-600 mb-2">
                          First name
                        </label>
                        <input
                          type="text"
                          value={child.name}
                          onChange={(e) => updateChild(child.id, "name", e.target.value)}
                          placeholder="e.g., Mila"
                          data-testid={`input-child-name-${index}`}
                          className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition-all bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-stone-600 mb-2">
                          Your relationship
                        </label>
                        <select
                          value={child.relationship}
                          onChange={(e) => updateChild(child.id, "relationship", e.target.value)}
                          data-testid={`select-relationship-${index}`}
                          className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-900 bg-white focus:outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition-all"
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
                  className="w-full py-4 border-2 border-dashed border-stone-300 rounded-2xl text-stone-500 hover:border-stone-400 hover:text-stone-700 hover:bg-white/50 transition-all flex items-center justify-center gap-2"
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
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 shadow-lg shadow-stone-900/10"
                  data-testid="button-create-fund"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div 
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full mr-2"
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

                <p className="text-xs text-stone-400 text-center mt-4 leading-relaxed">
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
            className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative"
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.6 }}
              transition={{ delay: 0.1 }}
              className="absolute top-1/4 left-1/4 w-72 h-72 bg-gradient-to-br from-emerald-200/50 to-teal-100/40 rounded-full blur-3xl"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.6 }}
              transition={{ delay: 0.3 }}
              className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-amber-100/50 to-orange-100/40 rounded-full blur-3xl"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.3 }}
              transition={{ delay: 0.5 }}
              className="absolute top-1/2 right-1/3 w-48 h-48 bg-gradient-to-br from-pink-100/40 to-rose-100/30 rounded-full blur-3xl"
            />

            <div className="relative z-10 text-center max-w-sm w-full">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-emerald-500/30 ring-4 ring-white/80"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
                >
                  <Check className="w-14 h-14 text-white" strokeWidth={3} />
                </motion.div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-semibold text-stone-900 mb-3"
              >
                {accountType === "parent" && children.length > 1 
                  ? "Funds created!" 
                  : `${recipientName}'s fund is ready!`}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-stone-500 mb-10 leading-relaxed"
              >
                Share the link with family and friends to start receiving gifts that grow
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
              >
                <Button
                  onClick={() => {
                    const childNames = children.map(c => c.name).join(",");
                    setLocation(`/dashboard?type=${accountType === "parent" ? "child" : "personal"}&name=${encodeURIComponent(recipientName)}&children=${encodeURIComponent(childNames)}&new=true`);
                  }}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 shadow-xl shadow-stone-900/20"
                  data-testid="button-go-to-dashboard"
                >
                  Go to dashboard
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Button>

                <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const childNames = children.map(c => c.name).join(",");
                    setLocation(`/activate?type=${accountType === "parent" ? "child" : "personal"}&children=${encodeURIComponent(childNames)}`);
                  }}
                  data-testid="button-activate-investing"
                  className="w-full bg-gradient-to-br from-white to-stone-50 rounded-2xl p-5 border border-stone-200/80 shadow-lg backdrop-blur-sm hover:border-stone-300 hover:shadow-xl transition-all cursor-pointer text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                      <Shield size={18} className="text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-stone-900 mb-1">
                        Next: Activate investing
                      </p>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        Complete a quick verification (~2 min) to start receiving real investments
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-stone-400 mt-3 flex-shrink-0" />
                  </div>
                </motion.button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-xs text-stone-400 mt-8"
              >
                Until activated, gifts are held as pledges
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
