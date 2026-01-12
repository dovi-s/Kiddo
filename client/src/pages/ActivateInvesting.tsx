import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Shield, Lock } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const updateFundStatus = (status: "active" | "pending") => {
  try {
    const stored = localStorage.getItem("kora_funds");
    if (stored) {
      const funds = JSON.parse(stored);
      const updated = funds.map((f: any) => ({
        ...f,
        status: f.status === "draft" ? status : f.status,
        balance: status === "active" && f.balance === 0 ? 0 : f.balance,
      }));
      localStorage.setItem("kora_funds", JSON.stringify(updated));
    }
  } catch {}
};

const getFundNames = (): string[] => {
  try {
    const stored = localStorage.getItem("kora_funds");
    if (stored) {
      const funds = JSON.parse(stored);
      return funds.filter((f: any) => f.status === "draft" || f.status === "pending" || f.status === "active").map((f: any) => f.name);
    }
  } catch {}
  return [];
};

type Step = "intro" | "brokerage" | "identity" | "child" | "agreements" | "processing" | "complete";

export default function ActivateInvesting() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const childrenParam = params.get("children");
  const urlChildNames = childrenParam ? decodeURIComponent(childrenParam).split(",") : [];
  const isPersonal = accountType === "personal";
  
  const [activatedFundNames, setActivatedFundNames] = useState<string[]>([]);
  
  useEffect(() => {
    const names = getFundNames();
    if (names.length > 0) {
      setActivatedFundNames(names);
    } else if (urlChildNames.length > 0) {
      setActivatedFundNames(urlChildNames);
    }
  }, []);
  
  const childNames = activatedFundNames.length > 0 ? activatedFundNames : urlChildNames;
  
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
      setStep("processing");
      updateFundStatus("pending");
      setTimeout(() => {
        updateFundStatus("active");
        setStep("complete");
      }, 2500);
    }
  };

  const handleBack = () => {
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

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          {step !== "intro" && step !== "brokerage" && step !== "processing" && step !== "complete" ? (
            <button onClick={handleBack} className="text-stone-500 hover:text-stone-900 transition-colors">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div />
          )}
          <Logo size="sm" className="text-stone-900" linkTo={null} />
          <div className="w-5" />
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
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                  <Shield size={28} className="text-stone-600" />
                </div>
                <h1 className="text-2xl font-medium text-stone-900 mb-2">Activate investing</h1>
                <p className="text-stone-500">Complete identity verification to start accepting gifts and investing.</p>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-stone-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">Your information</p>
                    <p className="text-sm text-stone-500">Name, date of birth, address, and SSN</p>
                  </div>
                </div>
                {!isPersonal && childNames.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-stone-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">Child information</p>
                      <p className="text-sm text-stone-500">
                        {childNames.length === 1 ? `Details for ${childNames[0]}'s custodial account` : `Details for ${childNames.length} custodial accounts`}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-stone-600">{!isPersonal && childNames.length > 0 ? "3" : "2"}</span>
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">Review and accept</p>
                    <p className="text-sm text-stone-500">Brokerage agreement and disclosures</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-400 justify-center">
                <Lock size={12} />
                <span>Your information is encrypted and secure</span>
              </div>

              <Button 
                onClick={handleNext}
                data-testid="button-start-kyc"
                className="w-full bg-stone-900 text-white hover:bg-stone-800"
              >
                Continue
              </Button>

              <p className="text-xs text-stone-400 text-center">
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
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <h1 className="text-xl font-medium text-stone-900 mb-2">Where will your assets live?</h1>
                <p className="text-sm text-stone-500">Choose how your investment account is set up</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setBrokerageChoice("embedded")}
                  data-testid="option-embedded-brokerage"
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                    brokerageChoice === "embedded"
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      brokerageChoice === "embedded" ? "border-stone-900 bg-stone-900" : "border-stone-300"
                    }`}>
                      {brokerageChoice === "embedded" && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-stone-900">Kora investing account</p>
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Recommended</span>
                      </div>
                      <p className="text-sm text-stone-500">
                        A brokerage account is opened for this fund. Gifts are invested automatically.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  disabled
                  data-testid="option-external-brokerage"
                  className="w-full p-5 rounded-xl border-2 border-stone-100 bg-stone-50 text-left opacity-60 cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-stone-200 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-stone-400">Connect existing brokerage</p>
                        <span className="text-xs px-2 py-0.5 bg-stone-200 text-stone-500 rounded-full">Coming soon</span>
                      </div>
                      <p className="text-sm text-stone-400">
                        Link your Schwab, Fidelity, or other brokerage account.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-sm text-blue-800 font-medium mb-1">What is a Kora investing account?</p>
                <p className="text-xs text-blue-700">
                  Your funds are held by Apex Clearing Corporation, a licensed broker-dealer and member of FINRA/SIPC. 
                  Kora handles the experience; Apex handles the assets.
                </p>
              </div>

              <Button 
                onClick={handleNext}
                data-testid="button-continue-brokerage"
                className="w-full bg-stone-900 text-white hover:bg-stone-800"
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
              className="space-y-6"
            >
              <div>
                <h1 className="text-xl font-medium text-stone-900 mb-1">Your information</h1>
                <p className="text-sm text-stone-500">Required for identity verification</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Legal first name</label>
                    <input
                      type="text"
                      value={adultInfo.legalFirstName}
                      onChange={(e) => setAdultInfo({ ...adultInfo, legalFirstName: e.target.value })}
                      data-testid="input-legal-first-name"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Legal last name</label>
                    <input
                      type="text"
                      value={adultInfo.legalLastName}
                      onChange={(e) => setAdultInfo({ ...adultInfo, legalLastName: e.target.value })}
                      data-testid="input-legal-last-name"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
                    <input
                      type="date"
                      value={adultInfo.dob}
                      onChange={(e) => setAdultInfo({ ...adultInfo, dob: e.target.value })}
                      data-testid="input-dob"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">SSN</label>
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
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Street address</label>
                  <input
                    type="text"
                    value={adultInfo.address}
                    onChange={(e) => setAdultInfo({ ...adultInfo, address: e.target.value })}
                    data-testid="input-address"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                  />
                </div>

                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">City</label>
                    <input
                      type="text"
                      value={adultInfo.city}
                      onChange={(e) => setAdultInfo({ ...adultInfo, city: e.target.value })}
                      data-testid="input-city"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">State</label>
                    <input
                      type="text"
                      value={adultInfo.state}
                      onChange={(e) => setAdultInfo({ ...adultInfo, state: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="CA"
                      data-testid="input-state"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">ZIP</label>
                    <input
                      type="text"
                      value={adultInfo.zip}
                      onChange={(e) => setAdultInfo({ ...adultInfo, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                      data-testid="input-zip"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Phone number</label>
                  <input
                    type="tel"
                    value={adultInfo.phone}
                    onChange={(e) => setAdultInfo({ ...adultInfo, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Citizenship</label>
                    <select
                      value={adultInfo.citizenship}
                      onChange={(e) => setAdultInfo({ ...adultInfo, citizenship: e.target.value })}
                      data-testid="select-citizenship"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 bg-white"
                    >
                      <option value="us">U.S. Citizen</option>
                      <option value="resident">Permanent Resident</option>
                      <option value="visa">Visa Holder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Employment</label>
                    <select
                      value={adultInfo.employment}
                      onChange={(e) => setAdultInfo({ ...adultInfo, employment: e.target.value })}
                      data-testid="select-employment"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 bg-white"
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
                className="w-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40"
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
              className="space-y-6"
            >
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">
                  Child {currentChildIndex + 1} of {childNames.length}
                </p>
                <h1 className="text-xl font-medium text-stone-900 mb-1">{childNames[currentChildIndex]}'s information</h1>
                <p className="text-sm text-stone-500">Required for the custodial account</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Legal first name</label>
                    <input
                      type="text"
                      value={childInfo[currentChildIndex]?.legalFirstName || childNames[currentChildIndex]}
                      onChange={(e) => setChildInfo({
                        ...childInfo,
                        [currentChildIndex]: { ...childInfo[currentChildIndex], legalFirstName: e.target.value }
                      })}
                      data-testid="input-child-first-name"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Legal last name</label>
                    <input
                      type="text"
                      value={childInfo[currentChildIndex]?.legalLastName || ""}
                      onChange={(e) => setChildInfo({
                        ...childInfo,
                        [currentChildIndex]: { ...childInfo[currentChildIndex], legalLastName: e.target.value }
                      })}
                      data-testid="input-child-last-name"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
                    <input
                      type="date"
                      value={childInfo[currentChildIndex]?.dob || ""}
                      onChange={(e) => setChildInfo({
                        ...childInfo,
                        [currentChildIndex]: { ...childInfo[currentChildIndex], dob: e.target.value }
                      })}
                      data-testid="input-child-dob"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">SSN</label>
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
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Your relationship</label>
                  <select
                    value={childInfo[currentChildIndex]?.relationship || ""}
                    onChange={(e) => setChildInfo({
                      ...childInfo,
                      [currentChildIndex]: { ...childInfo[currentChildIndex], relationship: e.target.value }
                    })}
                    data-testid="select-relationship"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 bg-white"
                  >
                    <option value="">Select relationship</option>
                    <option value="parent">Parent</option>
                    <option value="grandparent">Grandparent</option>
                    <option value="guardian">Legal Guardian</option>
                  </select>
                </div>

                <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
                  <p className="text-xs text-stone-500">
                    As the custodian, you will manage this account until {childNames[currentChildIndex]} reaches the age of majority (18-21, depending on state).
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="button-continue-child"
                className="w-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40"
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
              className="space-y-6"
            >
              <div>
                <h1 className="text-xl font-medium text-stone-900 mb-1">Review and accept</h1>
                <p className="text-sm text-stone-500">Please review and agree to the following</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 rounded-xl border border-stone-200 bg-white cursor-pointer hover:border-stone-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={agreements.customerAgreement}
                    onChange={(e) => setAgreements({ ...agreements, customerAgreement: e.target.checked })}
                    data-testid="checkbox-customer-agreement"
                    className="mt-0.5 w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <p className="font-medium text-stone-900">Customer Agreement</p>
                    <p className="text-sm text-stone-500">I have read and agree to the Brokerage Customer Agreement</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl border border-stone-200 bg-white cursor-pointer hover:border-stone-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={agreements.privacy}
                    onChange={(e) => setAgreements({ ...agreements, privacy: e.target.checked })}
                    data-testid="checkbox-privacy"
                    className="mt-0.5 w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <p className="font-medium text-stone-900">Privacy Policy</p>
                    <p className="text-sm text-stone-500">I have read and agree to the Privacy Policy</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl border border-stone-200 bg-white cursor-pointer hover:border-stone-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={agreements.disclosures}
                    onChange={(e) => setAgreements({ ...agreements, disclosures: e.target.checked })}
                    data-testid="checkbox-disclosures"
                    className="mt-0.5 w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <p className="font-medium text-stone-900">Disclosures</p>
                    <p className="text-sm text-stone-500">I acknowledge the investment risks and fee disclosures</p>
                  </div>
                </label>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <p className="text-xs text-stone-500 mb-1">Brokerage services provided by</p>
                <p className="text-sm font-medium text-stone-700">Apex Clearing Corporation</p>
                <p className="text-xs text-stone-400">Member FINRA/SIPC</p>
              </div>

              <Button 
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="button-agree-continue"
                className="w-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40"
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
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full"
                />
              </div>
              <h2 className="text-lg font-medium text-stone-900 mb-2">Verifying your identity</h2>
              <p className="text-sm text-stone-500">This usually takes under 2 minutes...</p>
            </motion.div>
          )}

          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6"
              >
                <Check size={28} className="text-emerald-600" />
              </motion.div>
              <h2 className="text-xl font-medium text-stone-900 mb-2">You're all set!</h2>
              <p className="text-stone-500 mb-8">
                {isPersonal 
                  ? "Your fund is now active and ready to receive gifts."
                  : childNames.length === 0
                    ? "Your fund is now active and ready to receive gifts."
                    : childNames.length === 1 
                      ? `${childNames[0]}'s fund is now active and ready to receive gifts.`
                      : `All ${childNames.length} funds are now active and ready to receive gifts.`
                }
              </p>

              <div className="space-y-3 max-w-xs mx-auto">
                <p className="text-xs text-stone-400 mb-4">What would you like to do next?</p>
                
                <Button 
                  onClick={() => setLocation("/event/create")}
                  data-testid="button-create-event"
                  className="w-full bg-stone-900 text-white hover:bg-stone-800"
                >
                  Create an event page
                </Button>
                
                <Button 
                  onClick={() => {
                    const fundSlug = childNames[0]?.toLowerCase().replace(/\s+/g, "-") || "fund";
                    navigator.clipboard.writeText(`kora.com/${fundSlug}`);
                  }}
                  data-testid="button-share-fund"
                  variant="outline"
                  className="w-full"
                >
                  Share fund link
                </Button>
                
                <button 
                  onClick={() => setLocation(`/dashboard?type=${accountType}&children=${childrenParam || ""}`)}
                  data-testid="button-go-to-dashboard"
                  className="text-sm text-stone-500 hover:text-stone-900 transition-colors mt-4"
                >
                  Go to dashboard →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-stone-300 text-center mt-8">
          Test mode - No data is stored
        </p>
      </main>
    </div>
  );
}
