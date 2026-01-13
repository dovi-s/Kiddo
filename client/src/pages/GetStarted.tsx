import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Lock, Shield, Plus, Trash2, User, Users, Sparkles, TrendingUp, Heart, Gift, Star, Play, ChevronRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

type AccountType = "parent" | "adult" | null;

interface ChildProfile {
  id: string;
  name: string;
  relationship: string;
}

type Step = "hook" | "proof" | "personalize" | "projection" | "choose" | "account" | "children" | "success";

const testimonials = [
  { name: "Sarah M.", role: "Mom of 2", quote: "My daughter's fund grew 340% by the time she turned 18. Best decision we ever made.", avatar: "S" },
  { name: "James L.", role: "Grandfather", quote: "Instead of toys they forget, I give shares they'll thank me for.", avatar: "J" },
  { name: "Emily R.", role: "New mom", quote: "Setup took 2 minutes. Now every birthday and holiday means something.", avatar: "E" },
];

const fadeSlide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { type: "spring" as const, stiffness: 300, damping: 30 }
};

export default function GetStarted() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("hook");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [childName, setChildName] = useState("");
  const [children, setChildren] = useState<ChildProfile[]>([
    { id: "1", name: "", relationship: "Parent" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [projectedAmount, setProjectedAmount] = useState(500);

  useEffect(() => {
    if (step === "proof") {
      const interval = setInterval(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const growth18 = Math.round(projectedAmount * Math.pow(1.07, 18));

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
    if (step === "personalize") return childName.trim().length > 0;
    if (step === "choose") return accountType !== null;
    if (step === "account") return email && password && firstName;
    if (step === "children") return children.every(c => c.name.trim());
    return true;
  };

  const handleNext = () => {
    if (step === "hook") setStep("proof");
    else if (step === "proof") setStep("personalize");
    else if (step === "personalize") setStep("projection");
    else if (step === "projection") setStep("choose");
    else if (step === "choose") setStep("account");
    else if (step === "account") {
      if (accountType === "parent") {
        if (childName) {
          setChildren([{ id: "1", name: childName, relationship: "Parent" }]);
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
    if (step === "proof") setStep("hook");
    else if (step === "personalize") setStep("proof");
    else if (step === "projection") setStep("personalize");
    else if (step === "choose") setStep("projection");
    else if (step === "account") setStep("choose");
    else if (step === "children") setStep("account");
  };

  const getStepNumber = () => {
    const steps: Step[] = ["hook", "proof", "personalize", "projection", "choose", "account", "children"];
    return steps.indexOf(step) + 1;
  };

  const totalSteps = accountType === "parent" ? 7 : 6;

  return (
    <div className="min-h-screen bg-stone-50 overflow-hidden">
      <AnimatePresence mode="wait">
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
                  <div className="w-32 h-32 mx-auto rounded-3xl bg-gradient-to-br from-stone-900 to-stone-700 flex items-center justify-center shadow-2xl shadow-stone-900/30">
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
                      <Gift className="w-16 h-16 text-white" />
                    </motion.div>
                  </div>
                </motion.div>

                <h1 className="text-3xl md:text-4xl font-semibold text-stone-900 mb-4 leading-tight">
                  Give something that<br />
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">grows with them</span>
                </h1>
                
                <p className="text-lg text-stone-500 mb-8 leading-relaxed">
                  Transform birthday money into real investments. Watch $100 become $340 by the time they're 18.
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

        {step === "proof" && (
          <motion.div
            key="proof"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <header className="sticky top-0 z-40 bg-stone-50/95 backdrop-blur-sm border-b border-stone-100">
              <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-700">
                  <ArrowLeft size={20} />
                </button>
                <Logo size="sm" className="text-stone-900" />
                <div className="w-5" />
              </div>
            </header>

            <main className="flex-1 flex flex-col justify-center px-6 py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
              >
                <div className="flex items-center justify-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-stone-500">Trusted by 10,000+ families</p>
              </motion.div>

              <div className="relative h-48 mb-12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTestimonial}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0"
                  >
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-stone-100 text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center text-2xl font-medium text-stone-600 mx-auto mb-4">
                        {testimonials[currentTestimonial].avatar}
                      </div>
                      <p className="text-lg text-stone-700 mb-4 leading-relaxed">
                        "{testimonials[currentTestimonial].quote}"
                      </p>
                      <p className="text-sm font-medium text-stone-900">{testimonials[currentTestimonial].name}</p>
                      <p className="text-xs text-stone-400">{testimonials[currentTestimonial].role}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex justify-center gap-2 mb-8">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentTestimonial(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentTestimonial ? "bg-stone-900 w-6" : "bg-stone-300"
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={handleNext}
                size="lg"
                className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800"
                data-testid="button-continue-proof"
              >
                Continue
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </main>
          </motion.div>
        )}

        {step === "personalize" && (
          <motion.div
            key="personalize"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <header className="sticky top-0 z-40 bg-stone-50/95 backdrop-blur-sm border-b border-stone-100">
              <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-700">
                  <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className={`w-8 h-1 rounded-full ${i <= 2 ? "bg-stone-900" : "bg-stone-200"}`} />
                  ))}
                </div>
                <div className="w-5" />
              </div>
            </header>

            <main className="flex-1 flex flex-col justify-center px-6 py-12 max-w-lg mx-auto w-full">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center mx-auto mb-8"
              >
                <Heart className="w-10 h-10 text-rose-500" />
              </motion.div>

              <h1 className="text-2xl font-semibold text-stone-900 text-center mb-3">
                Who is this fund for?
              </h1>
              <p className="text-stone-500 text-center mb-8">
                We'll personalize everything for them
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Their first name
                  </label>
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="e.g., Mila"
                    autoFocus
                    data-testid="input-child-name"
                    className="w-full px-5 py-4 text-lg border-2 border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-stone-900 transition-colors"
                  />
                </div>

                {childName && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100"
                  >
                    <p className="text-sm text-emerald-800">
                      <span className="font-medium">{childName}'s Future Fund</span> will be their personalized investment account
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="mt-auto pt-8">
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50"
                  data-testid="button-continue-personalize"
                >
                  Continue
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </main>
          </motion.div>
        )}

        {step === "projection" && (
          <motion.div
            key="projection"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <header className="sticky top-0 z-40 bg-stone-50/95 backdrop-blur-sm border-b border-stone-100">
              <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-700">
                  <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className={`w-8 h-1 rounded-full ${i <= 3 ? "bg-stone-900" : "bg-stone-200"}`} />
                  ))}
                </div>
                <div className="w-5" />
              </div>
            </header>

            <main className="flex-1 flex flex-col justify-center px-6 py-12 max-w-lg mx-auto w-full">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-8"
              >
                <TrendingUp className="w-10 h-10 text-emerald-600" />
              </motion.div>

              <h1 className="text-2xl font-semibold text-stone-900 text-center mb-3">
                Watch {childName || "their"} future grow
              </h1>
              <p className="text-stone-500 text-center mb-8">
                See how gifts compound over time
              </p>

              <div className="bg-white rounded-3xl p-6 shadow-lg border border-stone-100 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-stone-500">Annual gift total</span>
                  <span className="text-2xl font-semibold text-stone-900">${projectedAmount}</span>
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
                      <p className="text-sm text-stone-500 mb-1">At age 18</p>
                      <motion.p 
                        key={growth18}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        className="text-4xl font-semibold text-emerald-600"
                      >
                        ${growth18.toLocaleString()}
                      </motion.p>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium">
                        <TrendingUp size={14} />
                        {((growth18 / projectedAmount - 1) * 100).toFixed(0)}% growth
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
                  <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-stone-600">
                    Based on historical S&P 500 average returns of ~7% annually. Past performance doesn't guarantee future results.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleNext}
                size="lg"
                className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800"
                data-testid="button-continue-projection"
              >
                Create {childName}'s fund
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </main>
          </motion.div>
        )}

        {step === "choose" && (
          <motion.div
            key="choose"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <header className="sticky top-0 z-40 bg-stone-50/95 backdrop-blur-sm border-b border-stone-100">
              <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-700">
                  <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className={`w-8 h-1 rounded-full ${i <= 4 ? "bg-stone-900" : "bg-stone-200"}`} />
                  ))}
                </div>
                <div className="w-5" />
              </div>
            </header>

            <main className="flex-1 px-6 py-10 max-w-lg mx-auto w-full">
              <h1 className="text-2xl font-semibold text-stone-900 text-center mb-3">
                How will you manage the fund?
              </h1>
              <p className="text-stone-500 text-center mb-8">
                Choose the account type that fits your situation
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => setAccountType("parent")}
                  data-testid="option-parent"
                  className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                    accountType === "parent"
                      ? "border-stone-900 bg-white shadow-lg"
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      accountType === "parent" ? "bg-stone-900" : "bg-stone-100"
                    }`}>
                      <Users size={24} className={accountType === "parent" ? "text-white" : "text-stone-500"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-stone-900 text-lg mb-1">I'm a parent or guardian</p>
                      <p className="text-sm text-stone-500 leading-relaxed">
                        Create a custodial account for {childName || "your child"}. You manage it until they're 18-21.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium">Recommended</span>
                        <span className="text-xs text-stone-400">UTMA/UGMA</span>
                      </div>
                    </div>
                    {accountType === "parent" && (
                      <div className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setAccountType("adult")}
                  data-testid="option-adult"
                  className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                    accountType === "adult"
                      ? "border-stone-900 bg-white shadow-lg"
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      accountType === "adult" ? "bg-stone-900" : "bg-stone-100"
                    }`}>
                      <User size={24} className={accountType === "adult" ? "text-white" : "text-stone-500"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-stone-900 text-lg mb-1">I'm creating for myself</p>
                      <p className="text-sm text-stone-500 leading-relaxed">
                        Personal investment account. Perfect for graduations, weddings, or any milestone.
                      </p>
                      <div className="mt-3">
                        <span className="text-xs text-stone-400">Individual brokerage</span>
                      </div>
                    </div>
                    {accountType === "adult" && (
                      <div className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              </div>

              <div className="mt-8">
                <Button
                  onClick={handleNext}
                  disabled={!accountType}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50"
                  data-testid="button-continue-choose"
                >
                  Continue
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </main>
          </motion.div>
        )}

        {step === "account" && (
          <motion.div
            key="account"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <header className="sticky top-0 z-40 bg-stone-50/95 backdrop-blur-sm border-b border-stone-100">
              <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-700">
                  <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className={`w-8 h-1 rounded-full ${i <= 5 ? "bg-stone-900" : "bg-stone-200"}`} />
                  ))}
                </div>
                <div className="w-5" />
              </div>
            </header>

            <main className="flex-1 px-6 py-10 max-w-lg mx-auto w-full">
              <h1 className="text-2xl font-semibold text-stone-900 mb-2">
                Create your account
              </h1>
              <p className="text-stone-500 mb-8">
                {accountType === "parent" 
                  ? `You'll manage ${childName}'s fund from here`
                  : "Start your investment journey"}
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Your first name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sarah"
                    data-testid="input-first-name"
                    className="w-full px-4 py-4 border-2 border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    data-testid="input-email"
                    className="w-full px-4 py-4 border-2 border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    data-testid="input-password"
                    className="w-full px-4 py-4 border-2 border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
                  />
                  <p className="text-xs text-stone-400 mt-2">At least 8 characters</p>
                </div>

                <div className="pt-4 flex items-center gap-3 text-xs text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <Shield size={14} />
                    <span>SIPC protected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock size={14} />
                    <span>256-bit encryption</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50"
                  data-testid="button-continue-account"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      {accountType === "adult" ? "Create my fund" : "Continue"}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>
              </div>
            </main>
          </motion.div>
        )}

        {step === "children" && (
          <motion.div
            key="children"
            {...fadeSlide}
            className="min-h-screen flex flex-col"
          >
            <header className="sticky top-0 z-40 bg-stone-50/95 backdrop-blur-sm border-b border-stone-100">
              <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-700">
                  <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6].map((i) => (
                    <div key={i} className={`w-6 h-1 rounded-full ${i <= 6 ? "bg-stone-900" : "bg-stone-200"}`} />
                  ))}
                </div>
                <div className="w-5" />
              </div>
            </header>

            <main className="flex-1 px-6 py-10 max-w-lg mx-auto w-full">
              <h1 className="text-2xl font-semibold text-stone-900 mb-2">
                Confirm the details
              </h1>
              <p className="text-stone-500 mb-8">
                You can add more children later
              </p>

              <div className="space-y-4">
                {children.map((child, index) => (
                  <motion.div
                    key={child.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border-2 border-stone-200 p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-stone-700">
                        Child {index + 1}
                      </span>
                      {children.length > 1 && (
                        <button
                          onClick={() => removeChild(child.id)}
                          data-testid={`button-remove-child-${index}`}
                          className="text-stone-400 hover:text-stone-600"
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
                          placeholder="Mila"
                          data-testid={`input-child-name-${index}`}
                          className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
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
                          className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-900 bg-white focus:outline-none focus:border-stone-900 transition-colors"
                        >
                          <option value="Parent">Parent</option>
                          <option value="Legal guardian">Legal guardian</option>
                          <option value="Grandparent">Grandparent</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <button
                  onClick={addChild}
                  data-testid="button-add-child"
                  className="w-full py-4 border-2 border-dashed border-stone-300 rounded-2xl text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  <span>Add another child</span>
                </button>
              </div>

              <div className="mt-8">
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  size="lg"
                  className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50"
                  data-testid="button-create-fund"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Creating fund...
                    </>
                  ) : (
                    <>
                      Create {children.length > 1 ? `${children.length} funds` : `${children[0]?.name || "the"} fund`}
                      <Check className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-stone-400 text-center mt-6 leading-relaxed">
                By creating an account, you agree to Kora's Terms of Service and Privacy Policy.
              </p>
            </main>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-b from-emerald-50 to-stone-50"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mb-8 shadow-xl shadow-emerald-500/30"
            >
              <Check className="w-12 h-12 text-white" strokeWidth={3} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-semibold text-stone-900 text-center mb-3"
            >
              {children.length > 1 ? "Funds created!" : `${children[0]?.name || firstName}'s fund is ready!`}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-stone-500 text-center mb-8 max-w-sm"
            >
              Share the link with family and friends to start receiving gifts that grow
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="w-full max-w-sm space-y-4"
            >
              <Button
                onClick={() => {
                  const childNames = children.map(c => c.name).join(",");
                  setLocation(`/dashboard?type=${accountType === "parent" ? "child" : "personal"}&name=${encodeURIComponent(children[0]?.name || firstName)}&children=${encodeURIComponent(childNames)}&new=true`);
                }}
                size="lg"
                className="w-full h-14 text-base rounded-2xl bg-stone-900 hover:bg-stone-800"
                data-testid="button-go-to-dashboard"
              >
                Go to dashboard
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>

              <div className="bg-white rounded-2xl p-4 border border-stone-200 text-center">
                <p className="text-sm text-stone-600 mb-2">
                  <span className="font-medium">Next step:</span> Activate investing to start receiving real investments
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
                  <Shield size={12} />
                  <span>KYC verification takes ~2 minutes</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
