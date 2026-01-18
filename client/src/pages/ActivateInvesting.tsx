import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Shield, Lock } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { useFunds } from "@/hooks/use-funds";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Step = "intro" | "brokerage" | "identity" | "child" | "agreements" | "processing" | "complete";

export default function ActivateInvesting() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const fundSlug = params.get("fund");
  const queryClient = useQueryClient();
  
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  
  const targetFund = fundSlug 
    ? funds.find(f => f.slug === fundSlug)
    : funds.find(f => f.status === "draft");
  
  const accountType = targetFund?.accountType === "Individual" ? "personal" : "child";
  const isPersonal = accountType === "personal";
  
  const childNames = targetFund && targetFund.accountType === "UTMA" ? [targetFund.name] : [];
  
  const activateFundMutation = useMutation({
    mutationFn: async (fundId: string) => {
      const response = await fetch(`/api/funds/${fundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "active" }),
      });
      if (!response.ok) throw new Error("Failed to activate fund");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    },
  });
  
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("intro");
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  
  const [adultInfo, setAdultInfo] = useState({
    legalFirstName: "",
    legalLastName: "",
    dob: "",
    ssn: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    citizenship: "us",
    employment: "employed",
    phone: "",
  });
  
  const [childInfo, setChildInfo] = useState<Record<number, {
    legalFirstName: string;
    legalLastName: string;
    dob: string;
    ssn: string;
    relationship: string;
  }>>({});
  
  const [agreements, setAgreements] = useState({
    customerAgreement: false,
    privacy: false,
    disclosures: false,
  });

  const [brokerageChoice, setBrokerageChoice] = useState<"embedded" | "external">("embedded");

  const handleNext = () => {
    haptic('selection');
    if (step === "intro") {
      setStep("brokerage");
    } else if (step === "brokerage") {
      setStep("identity");
    } else if (step === "identity") {
      if (!isPersonal && childNames.length > 0) {
        setStep("child");
        setCurrentChildIndex(0);
      } else {
        setStep("agreements");
      }
    } else if (step === "child") {
      if (currentChildIndex < childNames.length - 1) {
        setCurrentChildIndex(currentChildIndex + 1);
      } else {
        setStep("agreements");
      }
    } else if (step === "agreements") {
      haptic('medium');
      setStep("processing");
      if (targetFund) {
        activateFundMutation.mutate(targetFund.id, {
          onSuccess: () => {
            haptic('success');
            setStep("complete");
          },
          onError: () => {
            haptic('error');
            setStep("complete");
          },
        });
      } else {
        setTimeout(() => {
          haptic('success');
          setStep("complete");
        }, 2500);
      }
    }
  };

  const handleBack = () => {
    haptic('light');
    if (step === "brokerage") {
      setStep("intro");
    } else if (step === "identity") {
      setStep("brokerage");
    } else if (step === "child") {
      if (currentChildIndex > 0) {
        setCurrentChildIndex(currentChildIndex - 1);
      } else {
        setStep("identity");
      }
    } else if (step === "agreements") {
      if (!isPersonal && childNames.length > 0) {
        setStep("child");
        setCurrentChildIndex(childNames.length - 1);
      } else {
        setStep("identity");
      }
    }
  };

  const canProceed = () => {
    if (step === "identity") {
      return adultInfo.legalFirstName && adultInfo.legalLastName && adultInfo.dob && 
             adultInfo.ssn.length >= 4 && adultInfo.address && adultInfo.city && 
             adultInfo.state && adultInfo.zip && adultInfo.phone;
    }
    if (step === "child") {
      const info = childInfo[currentChildIndex];
      return info?.legalFirstName && info?.legalLastName && info?.dob && 
             info?.ssn?.length >= 4 && info?.relationship;
    }
    if (step === "agreements") {
      return agreements.customerAgreement && agreements.privacy && agreements.disclosures;
    }
    return true;
  };

  const maskSSN = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 4) return digits;
    return "•".repeat(digits.length - 4) + digits.slice(-4);
  };

  if (fundsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <header className="sticky top-0 z-50 bg-background pb-2">
        <div className="max-w-xl mx-auto px-4 pt-4 h-14 flex items-center justify-between">
          {step !== "intro" && step !== "brokerage" && step !== "processing" && step !== "complete" ? (
            <button 
              onClick={handleBack} 
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <Logo size="sm" className="text-primary" linkTo={null} />
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-6 relative"
            >
              <div className="text-center mb-8 relative">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-lg"
                >
                  <Shield size={36} className="text-primary-foreground" />
                </motion.div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">Activate investing</h1>
                <p className="text-muted-foreground leading-relaxed">Complete identity verification to start accepting gifts and investing.</p>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.15 }}
                className="bg-card rounded-2xl border border-border/50 p-6 space-y-5 shadow-premium-sm relative"
              >
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-xs font-bold text-primary-foreground">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Your information</p>
                    <p className="text-sm text-muted-foreground">Name, date of birth, address, and SSN</p>
                  </div>
                </div>
                {!isPersonal && childNames.length > 0 && (
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
                      <span className="text-xs font-bold text-primary-foreground">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Child information</p>
                      <p className="text-sm text-muted-foreground">
                        {childNames.length === 1 ? `Details for ${childNames[0]}'s custodial account` : `Details for ${childNames.length} custodial accounts`}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-xs font-bold text-primary-foreground">{!isPersonal && childNames.length > 0 ? "3" : "2"}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Review and accept</p>
                    <p className="text-sm text-muted-foreground">Brokerage agreement and disclosures</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.15 }}
                className="flex items-center gap-2 text-xs text-muted-foreground justify-center"
              >
                <Lock size={12} />
                <span>Your information is encrypted and secure</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.15 }}
              >
                <Button 
                  onClick={handleNext}
                  data-testid="button-start-kyc"
                  className="w-full h-14 text-base font-semibold rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-premium transition-all duration-150 active:scale-[0.98]"
                >
                  Continue
                </Button>
              </motion.div>

              <p className="text-xs text-muted-foreground text-center">
                Brokerage services provided by Apex Clearing Corporation, member FINRA/SIPC
              </p>
            </motion.div>
          )}

          {step === "brokerage" && (
            <motion.div
              key="brokerage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <h1 className="text-xl font-medium text-foreground mb-2">Where will your assets live?</h1>
                <p className="text-sm text-muted-foreground">Choose how your investment account is set up</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { haptic('selection'); setBrokerageChoice("embedded"); }}
                  data-testid="option-embedded-brokerage"
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-150 active:scale-[0.99] shadow-premium-sm ${
                    brokerageChoice === "embedded"
                      ? "border-primary bg-muted"
                      : "border-border hover:border-muted-foreground/30 bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      brokerageChoice === "embedded" ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {brokerageChoice === "embedded" && <Check size={12} className="text-primary-foreground" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">Kora investing account</p>
                        <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">Recommended</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        A brokerage account is opened for this fund. Gifts are invested automatically.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  disabled
                  data-testid="option-external-brokerage"
                  className="w-full p-5 rounded-xl border-2 border-border bg-muted text-left opacity-60 cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-border mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-muted-foreground">Connect existing brokerage</p>
                        <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">Coming soon</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Link your Schwab, Fidelity, or other brokerage account.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm text-foreground font-medium mb-1">What is a Kora investing account?</p>
                <p className="text-xs text-muted-foreground">
                  Your funds are held by Apex Clearing Corporation, a licensed broker-dealer and member of FINRA/SIPC. 
                  Kora handles the experience; Apex handles the assets.
                </p>
              </div>

              <Button 
                onClick={handleNext}
                data-testid="button-continue-brokerage"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </Button>
            </motion.div>
          )}

          {step === "identity" && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-xl font-medium text-foreground mb-1">Your information</h1>
                <p className="text-sm text-muted-foreground">Required for identity verification</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Legal first name</label>
                    <input
                      type="text"
                      value={adultInfo.legalFirstName}
                      onChange={(e) => setAdultInfo({ ...adultInfo, legalFirstName: e.target.value })}
                      data-testid="input-legal-first-name"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Legal last name</label>
                    <input
                      type="text"
                      value={adultInfo.legalLastName}
                      onChange={(e) => setAdultInfo({ ...adultInfo, legalLastName: e.target.value })}
                      data-testid="input-legal-last-name"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Date of birth</label>
                    <input
                      type="date"
                      value={adultInfo.dob}
                      onChange={(e) => setAdultInfo({ ...adultInfo, dob: e.target.value })}
                      data-testid="input-dob"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">SSN</label>
                    <input
                      type="text"
                      value={maskSSN(adultInfo.ssn)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9•]/g, "");
                        if (raw.includes("•")) {
                          const newDigits = raw.replace(/•/g, "");
                          setAdultInfo({ ...adultInfo, ssn: adultInfo.ssn + newDigits });
                        } else {
                          setAdultInfo({ ...adultInfo, ssn: raw });
                        }
                      }}
                      placeholder="•••••1234"
                      data-testid="input-ssn"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Street address</label>
                  <input
                    type="text"
                    value={adultInfo.address}
                    onChange={(e) => setAdultInfo({ ...adultInfo, address: e.target.value })}
                    data-testid="input-address"
                    className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                  />
                </div>

                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                    <input
                      type="text"
                      value={adultInfo.city}
                      onChange={(e) => setAdultInfo({ ...adultInfo, city: e.target.value })}
                      data-testid="input-city"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                    <input
                      type="text"
                      value={adultInfo.state}
                      onChange={(e) => setAdultInfo({ ...adultInfo, state: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="CA"
                      data-testid="input-state"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">ZIP</label>
                    <input
                      type="text"
                      value={adultInfo.zip}
                      onChange={(e) => setAdultInfo({ ...adultInfo, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                      data-testid="input-zip"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Phone number</label>
                  <input
                    type="tel"
                    value={adultInfo.phone}
                    onChange={(e) => setAdultInfo({ ...adultInfo, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                    className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Citizenship</label>
                    <select
                      value={adultInfo.citizenship}
                      onChange={(e) => setAdultInfo({ ...adultInfo, citizenship: e.target.value })}
                      data-testid="select-citizenship"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 bg-card transition-all duration-150"
                    >
                      <option value="us">U.S. Citizen</option>
                      <option value="resident">Permanent Resident</option>
                      <option value="visa">Visa Holder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Employment</label>
                    <select
                      value={adultInfo.employment}
                      onChange={(e) => setAdultInfo({ ...adultInfo, employment: e.target.value })}
                      data-testid="select-employment"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 bg-card transition-all duration-150"
                    >
                      <option value="employed">Employed</option>
                      <option value="self-employed">Self-Employed</option>
                      <option value="unemployed">Not Employed</option>
                      <option value="retired">Retired</option>
                      <option value="student">Student</option>
                    </select>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="button-continue-identity"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Continue
              </Button>
            </motion.div>
          )}

          {step === "child" && (
            <motion.div
              key={`child-${currentChildIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Child {currentChildIndex + 1} of {childNames.length}
                </p>
                <h1 className="text-xl font-medium text-foreground mb-1">{childNames[currentChildIndex]}'s information</h1>
                <p className="text-sm text-muted-foreground">Required for the custodial account</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Legal first name</label>
                    <input
                      type="text"
                      value={childInfo[currentChildIndex]?.legalFirstName || childNames[currentChildIndex]}
                      onChange={(e) => setChildInfo({
                        ...childInfo,
                        [currentChildIndex]: { ...childInfo[currentChildIndex], legalFirstName: e.target.value }
                      })}
                      data-testid="input-child-first-name"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Legal last name</label>
                    <input
                      type="text"
                      value={childInfo[currentChildIndex]?.legalLastName || ""}
                      onChange={(e) => setChildInfo({
                        ...childInfo,
                        [currentChildIndex]: { ...childInfo[currentChildIndex], legalLastName: e.target.value }
                      })}
                      data-testid="input-child-last-name"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Date of birth</label>
                    <input
                      type="date"
                      value={childInfo[currentChildIndex]?.dob || ""}
                      onChange={(e) => setChildInfo({
                        ...childInfo,
                        [currentChildIndex]: { ...childInfo[currentChildIndex], dob: e.target.value }
                      })}
                      data-testid="input-child-dob"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">SSN</label>
                    <input
                      type="text"
                      value={maskSSN(childInfo[currentChildIndex]?.ssn || "")}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9•]/g, "");
                        const current = childInfo[currentChildIndex]?.ssn || "";
                        if (raw.includes("•")) {
                          const newDigits = raw.replace(/•/g, "");
                          setChildInfo({
                            ...childInfo,
                            [currentChildIndex]: { ...childInfo[currentChildIndex], ssn: current + newDigits }
                          });
                        } else {
                          setChildInfo({
                            ...childInfo,
                            [currentChildIndex]: { ...childInfo[currentChildIndex], ssn: raw }
                          });
                        }
                      }}
                      placeholder="•••••1234"
                      data-testid="input-child-ssn"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all duration-150"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Your relationship</label>
                  <Select
                    value={childInfo[currentChildIndex]?.relationship || ""}
                    onValueChange={(value) => setChildInfo({
                      ...childInfo,
                      [currentChildIndex]: { ...childInfo[currentChildIndex], relationship: value }
                    })}
                  >
                    <SelectTrigger 
                      data-testid="select-relationship"
                      className="w-full h-12 px-4 border border-border rounded-xl text-foreground bg-card"
                    >
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="grandparent">Grandparent</SelectItem>
                      <SelectItem value="guardian">Legal Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 rounded-lg bg-muted border border-border">
                  <p className="text-xs text-muted-foreground">
                    As the custodian, you will manage this account until {childNames[currentChildIndex]} reaches the age of majority (18-21, depending on state).
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="button-continue-child"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {currentChildIndex < childNames.length - 1 ? "Next child" : "Continue"}
              </Button>
            </motion.div>
          )}

          {step === "agreements" && (
            <motion.div
              key="agreements"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-xl font-medium text-foreground mb-1">Review and accept</h1>
                <p className="text-sm text-muted-foreground">Please review and agree to the following</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:border-muted-foreground/30 transition-colors duration-150">
                  <input
                    type="checkbox"
                    checked={agreements.customerAgreement}
                    onChange={(e) => setAgreements({ ...agreements, customerAgreement: e.target.checked })}
                    data-testid="checkbox-customer-agreement"
                    className="mt-0.5 w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-foreground">Customer Agreement</p>
                    <p className="text-sm text-muted-foreground">I have read and agree to the Brokerage Customer Agreement</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:border-muted-foreground/30 transition-colors duration-150">
                  <input
                    type="checkbox"
                    checked={agreements.privacy}
                    onChange={(e) => setAgreements({ ...agreements, privacy: e.target.checked })}
                    data-testid="checkbox-privacy"
                    className="mt-0.5 w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-foreground">Privacy Policy</p>
                    <p className="text-sm text-muted-foreground">I have read and agree to the Privacy Policy</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:border-muted-foreground/30 transition-colors duration-150">
                  <input
                    type="checkbox"
                    checked={agreements.disclosures}
                    onChange={(e) => setAgreements({ ...agreements, disclosures: e.target.checked })}
                    data-testid="checkbox-disclosures"
                    className="mt-0.5 w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-foreground">Disclosures</p>
                    <p className="text-sm text-muted-foreground">I acknowledge the investment risks and fee disclosures</p>
                  </div>
                </label>
              </div>

              <div className="p-4 rounded-xl bg-muted border border-border text-center">
                <p className="text-xs text-muted-foreground mb-1">Brokerage services provided by</p>
                <p className="text-sm font-medium text-foreground">Apex Clearing Corporation</p>
                <p className="text-xs text-muted-foreground">Member FINRA/SIPC</p>
              </div>

              <Button 
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="button-agree-continue"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                I agree - Activate investing
              </Button>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="min-h-[60vh] flex flex-col items-center justify-center relative"
            >
              <div className="relative z-10 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-8 shadow-lg"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  />
                </motion.div>
                <h2 className="text-2xl font-semibold text-foreground mb-3">Verifying your identity</h2>
                <p className="text-muted-foreground">This usually takes under 2 minutes...</p>
              </div>
            </motion.div>
          )}

          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="min-h-[60vh] flex flex-col items-center justify-center relative"
            >
              <div className="relative z-10 text-center max-w-sm w-full">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-28 h-28 rounded-full bg-success flex items-center justify-center mb-8 mx-auto shadow-lg"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.15 }}
                  >
                    <Check className="w-14 h-14 text-success-foreground" strokeWidth={3} />
                  </motion.div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.15 }}
                  className="text-3xl font-semibold text-foreground mb-3"
                >
                  You're all set!
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.15 }}
                  className="text-muted-foreground mb-10 leading-relaxed"
                >
                  {isPersonal 
                    ? "Your fund is now active and ready to receive gifts."
                    : childNames.length === 0
                      ? "Your fund is now active and ready to receive gifts."
                      : childNames.length === 1 
                        ? `${childNames[0]}'s fund is now active and ready to receive gifts.`
                        : `All ${childNames.length} funds are now active and ready to receive gifts.`
                  }
                </motion.p>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.15 }}
                  className="space-y-4"
                >
                  <Button 
                    onClick={() => setLocation(targetFund ? `/dashboard?fund=${targetFund.slug}` : "/dashboard")}
                    data-testid="button-go-to-dashboard"
                    size="lg"
                    className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
                  >
                    Go to dashboard
                  </Button>
                  
                  <Button 
                    onClick={() => setLocation("/event/create")}
                    data-testid="button-create-event"
                    variant="outline"
                    size="lg"
                    className="w-full h-12 rounded-2xl border-border"
                  >
                    Create an event page
                  </Button>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.15 }}
                  className="text-xs text-muted-foreground mt-8"
                >
                  Gifts you receive will now be invested automatically
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-muted-foreground/50 text-center mt-8">
          Test mode - No data is stored
        </p>
      </main>
    </div>
  );
}
