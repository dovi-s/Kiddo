import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Check, Lock, Shield } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboard() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  
  const hasValidParams = params.get("email") && params.get("name");
  
  useEffect(() => {
    if (!hasValidParams) {
      setLocation("/get-started");
    }
  }, [hasValidParams, setLocation]);
  
  const accountType = params.get("type") || "child";
  const profileName = params.get("name") || "";
  const email = params.get("email") || "";
  const childrenParam = params.get("children") || "";
  const isPersonal = accountType === "personal";
  
  const childrenNames = childrenParam ? childrenParam.split(",").map(n => n.trim()).filter(Boolean) : [profileName];
  const numChildren = isPersonal ? 0 : childrenNames.length;
  const totalSteps = isPersonal ? 2 : numChildren + 2;
  
  const [step, setStep] = useState(0);
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStepType = () => {
    if (isPersonal) {
      return step === 0 ? "identity" : "review";
    }
    if (step < numChildren) {
      return "child";
    }
    if (step === numChildren) {
      return "identity";
    }
    return "review";
  };

  const getCurrentChildName = () => {
    if (step < numChildren) {
      return childrenNames[step];
    }
    return "";
  };

  const handleNext = () => {
    if (step === totalSteps - 1) {
      setIsSubmitting(true);
      setTimeout(() => {
        const childrenQuery = childrenParam ? `&children=${encodeURIComponent(childrenParam)}` : "";
        setLocation(`/dashboard?type=${accountType}&name=${encodeURIComponent(childrenNames[0] || profileName)}${childrenQuery}&new=true`);
      }, 1500);
    } else {
      setStep(step + 1);
    }
  };

  const stepType = getStepType();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-stone-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-lg font-semibold tracking-tight text-stone-900">everleaf</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <div className="flex items-center gap-1">
              <Lock size={12} />
              <span>Secure</span>
            </div>
            <span className="text-stone-300">Step {step + 1} of {totalSteps}</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i <= step ? "bg-stone-900" : "bg-stone-200"
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {stepType === "child" && (
            <motion.div 
              key={`child-${step}`}
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-stone-200 text-stone-600 rounded-full">
                    Child {step + 1} of {numChildren}
                  </span>
                </div>
                <h1 className="text-2xl font-semibold text-stone-900">
                  Details for {getCurrentChildName()}
                </h1>
                <p className="text-stone-500">
                  Required to open their custodial account
                </p>
              </div>
              
              <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
                <div>
                  <Label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</Label>
                  <Input 
                    type="date" 
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                    data-testid={`input-child-dob-${step}`} 
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-stone-700 mb-1.5">Social Security Number</Label>
                  <Input 
                    placeholder="XXX-XX-XXXX" 
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                    data-testid={`input-child-ssn-${step}`} 
                  />
                  <p className="text-xs text-stone-400 mt-1.5 flex items-center gap-1">
                    <Lock size={10} /> Encrypted. Required by law.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {stepType === "identity" && (
            <motion.div 
              key="identity"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-stone-900">
                  Your identity
                </h1>
                <p className="text-stone-500">
                  Required by SEC regulations
                </p>
              </div>
              
              <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-100">
                  <p className="text-xs text-stone-400">Email</p>
                  <p className="font-medium text-stone-900">{email}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-stone-700 mb-1.5">Legal name</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      placeholder="First" 
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                      data-testid="input-first-name" 
                    />
                    <Input 
                      placeholder="Last" 
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                      data-testid="input-last-name" 
                    />
                  </div>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</Label>
                  <Input 
                    type="date" 
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                    data-testid="input-dob" 
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-stone-700 mb-1.5">Social Security Number</Label>
                  <Input 
                    placeholder="XXX-XX-XXXX" 
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                    data-testid="input-ssn" 
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-stone-700 mb-1.5">Address</Label>
                  <Input 
                    placeholder="Street address" 
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl mb-2" 
                    data-testid="input-address" 
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input 
                      placeholder="City" 
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                      data-testid="input-city" 
                    />
                    <Input 
                      placeholder="State" 
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                      data-testid="input-state" 
                    />
                    <Input 
                      placeholder="ZIP" 
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl" 
                      data-testid="input-zip" 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {stepType === "review" && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-stone-900">
                  Ready to open
                </h1>
                <p className="text-stone-500">
                  Review and confirm
                </p>
              </div>
              
              <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                  <p className="text-xs text-stone-400">Account type</p>
                  <p className="font-medium text-stone-900">
                    {isPersonal ? "Personal brokerage" : "Custodial (UTMA)"}
                  </p>
                </div>
                
                {!isPersonal && (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                    <p className="text-xs text-stone-400">
                      {numChildren === 1 ? "Beneficiary" : `Beneficiaries (${numChildren} accounts)`}
                    </p>
                    <div className="mt-1 space-y-1">
                      {childrenNames.map((name, i) => (
                        <p key={i} className="font-medium text-stone-900">{name}</p>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                  <p className="text-xs text-stone-400">Clearing & custody</p>
                  <p className="font-medium text-stone-900">Apex Clearing Corporation</p>
                  <p className="text-xs text-stone-400 mt-0.5">SIPC protected up to $500,000</p>
                </div>
              </div>

              <p className="text-xs text-stone-400">
                By continuing, you agree to the Apex Brokerage Agreement
                {!isPersonal && ", UTMA Custodial Disclosure"}, and Everleaf Terms of Service.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8">
          <Button 
            onClick={handleNext} 
            className="w-full py-6 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium"
            disabled={isSubmitting} 
            data-testid="button-next"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Opening accounts...
              </span>
            ) : step === totalSteps - 1 ? (
              <span className="flex items-center gap-2">
                Open {numChildren > 1 ? `${numChildren} accounts` : "account"} <Check size={18} />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue <ArrowRight size={18} />
              </span>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-stone-400 mt-8">
          <span className="flex items-center gap-1"><Shield size={12} /> SIPC insured</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Lock size={12} /> 256-bit encryption</span>
        </div>
      </main>
    </div>
  );
}
