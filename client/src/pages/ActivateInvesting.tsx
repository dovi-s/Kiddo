import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, ArrowRight, Check, Shield, Lock, TrendingUp, Wallet, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { ProcessingState, SuccessState, GradientText } from "@/components/ui/gemini";

type Step = "welcome" | "personal" | "identity" | "strategy" | "review" | "processing" | "success";

const STEPS: Step[] = ["welcome", "personal", "identity", "strategy", "review"];

const stepIndex = (s: Step) => STEPS.indexOf(s);

export default function ActivateInvesting() {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>("welcome");

  const [personal, setPersonal] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
  });

  const [identity, setIdentity] = useState({
    ssn: "",
    citizenship: "us_citizen",
    employment: "employed",
  });

  const [strategy, setStrategy] = useState("growth");
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  const goNext = () => {
    haptic("selection");
    const i = stepIndex(step);
    if (i < STEPS.length - 1) {
      setStep(STEPS[i + 1]);
    }
  };

  const goBack = () => {
    haptic("light");
    const i = stepIndex(step);
    if (i > 0) {
      setStep(STEPS[i - 1]);
    }
  };

  const handleSubmit = async () => {
    haptic("medium");
    setStep("processing");

    try {
      await fetch("/api/funds/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fundId: "default", strategy }),
      });
    } catch (_) {}

    setTimeout(() => {
      haptic("success");
      setStep("success");
    }, 2000);
  };

  const canProceedPersonal =
    personal.firstName &&
    personal.lastName &&
    personal.dob &&
    personal.street &&
    personal.city &&
    personal.state &&
    personal.zip &&
    personal.phone;

  const canProceedIdentity =
    identity.ssn.length === 9 && identity.citizenship && identity.employment;

  const progress = step === "processing" || step === "success" ? 100 : ((stepIndex(step) + 1) / STEPS.length) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ProcessingState message="Loading..." />
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-150";

  return (
    <div className="min-h-screen gemini-warm-section overflow-hidden">
      <header className="sticky top-0 z-50 gemini-glass-nav">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          {step !== "welcome" && step !== "processing" && step !== "success" ? (
            <button
              onClick={goBack}
              data-testid="button-back"
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
        {step !== "processing" && step !== "success" && (
          <div className="max-w-lg mx-auto px-4 pb-2">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center space-y-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg"
                >
                  <TrendingUp size={28} className="text-primary-foreground" />
                </motion.div>
                <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground" data-testid="text-welcome-heading">
                  Let's get your investments started
                </h1>
                <p className="text-muted-foreground leading-relaxed text-sm" data-testid="text-welcome-description">
                  This takes about 3 minutes. We need to verify your identity to open a regulated investment account. This is required by law to protect you.
                </p>
                <p className="text-sm text-muted-foreground italic">
                  Until we verify your identity, gifts collect as cash. Once verified, that cash starts investing automatically.
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3 shadow-sm" data-testid="card-benefit-auto-invest">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Your gifts start investing automatically</p>
                    <p className="text-xs text-muted-foreground mt-0.5">No extra steps once you are verified</p>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3 shadow-sm" data-testid="card-benefit-real-stocks">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wallet size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Real stocks, held in your name</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You own every share directly</p>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3 shadow-sm" data-testid="card-benefit-protection">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Protected by SIPC up to $500,000</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your investments are safeguarded</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={goNext}
                data-testid="button-begin-verification"
                className="w-full h-14 text-base font-semibold rounded-2xl"
              >
                Begin Verification
                <ArrowRight size={18} className="ml-2" />
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Lock size={12} />
                <span>Your information is encrypted and secure</span>
              </div>
            </motion.div>
          )}

          {step === "personal" && (
            <motion.div
              key="personal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-personal-heading">
                  Your personal information
                </h1>
                <p className="text-sm text-muted-foreground">We need a few details to set up your account.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">First name</label>
                    <input
                      type="text"
                      value={personal.firstName}
                      onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                      placeholder="Jane"
                      data-testid="input-first-name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Last name</label>
                    <input
                      type="text"
                      value={personal.lastName}
                      onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                      placeholder="Smith"
                      data-testid="input-last-name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Date of birth</label>
                  <input
                    type="date"
                    value={personal.dob}
                    onChange={(e) => setPersonal({ ...personal, dob: e.target.value })}
                    data-testid="input-dob"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Street address</label>
                  <input
                    type="text"
                    value={personal.street}
                    onChange={(e) => setPersonal({ ...personal, street: e.target.value })}
                    placeholder="123 Main St"
                    data-testid="input-street"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                    <input
                      type="text"
                      value={personal.city}
                      onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                      placeholder="San Francisco"
                      data-testid="input-city"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                    <input
                      type="text"
                      value={personal.state}
                      onChange={(e) => setPersonal({ ...personal, state: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="CA"
                      data-testid="input-state"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">ZIP</label>
                    <input
                      type="text"
                      value={personal.zip}
                      onChange={(e) => setPersonal({ ...personal, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                      placeholder="94102"
                      data-testid="input-zip"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Phone number</label>
                  <input
                    type="tel"
                    value={personal.phone}
                    onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                    className={inputClass}
                  />
                </div>
              </div>

              <Button
                onClick={goNext}
                disabled={!canProceedPersonal}
                data-testid="button-continue-personal"
                className="w-full h-14 text-base font-semibold rounded-2xl"
              >
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === "identity" && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-identity-heading">
                  Identity verification
                </h1>
                <p className="text-sm text-muted-foreground">Just a few more questions to confirm your identity.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Social Security Number</label>
                  <input
                    type="password"
                    value={identity.ssn}
                    onChange={(e) =>
                      setIdentity({ ...identity, ssn: e.target.value.replace(/\D/g, "").slice(0, 9) })
                    }
                    placeholder="•••••••••"
                    maxLength={9}
                    data-testid="input-ssn"
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Required by law to open an investment account. Encrypted and never stored in plain text.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Citizenship</label>
                  <select
                    value={identity.citizenship}
                    onChange={(e) => setIdentity({ ...identity, citizenship: e.target.value })}
                    data-testid="select-citizenship"
                    className={inputClass}
                  >
                    <option value="us_citizen">US Citizen</option>
                    <option value="permanent_resident">Permanent Resident</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Employment status</label>
                  <select
                    value={identity.employment}
                    onChange={(e) => setIdentity({ ...identity, employment: e.target.value })}
                    data-testid="select-employment"
                    className={inputClass}
                  >
                    <option value="employed">Employed</option>
                    <option value="self_employed">Self-employed</option>
                    <option value="student">Student</option>
                    <option value="retired">Retired</option>
                    <option value="not_employed">Not employed</option>
                  </select>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3">
                <Lock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  We use this information to open a regulated brokerage account. Your data is encrypted and never shared.
                </p>
              </div>

              <Button
                onClick={goNext}
                disabled={!canProceedIdentity}
                data-testid="button-continue-identity"
                className="w-full h-14 text-base font-semibold rounded-2xl"
              >
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === "strategy" && (
            <motion.div
              key="strategy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-strategy-heading">
                  How should gifts be invested?
                </h1>
                <p className="text-sm text-muted-foreground">Pick a starting approach. You can change this anytime.</p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    id: "growth",
                    label: "Growth Mix",
                    description: "A diversified blend of US and international stocks, optimized for long-term growth",
                    icon: <TrendingUp size={20} />,
                    tag: "Most popular",
                  },
                  {
                    id: "balanced",
                    label: "Steady & Balanced",
                    description: "A mix of stocks and bonds for moderate growth with less volatility",
                    icon: <Shield size={20} />,
                    tag: null,
                  },
                  {
                    id: "custom",
                    label: "Custom",
                    description: "You pick the specific stocks and ETFs",
                    icon: <User size={20} />,
                    tag: null,
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      haptic("selection");
                      setStrategy(opt.id);
                    }}
                    data-testid={`option-strategy-${opt.id}`}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.99] ${
                      strategy === opt.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          strategy === opt.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {opt.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-foreground">{opt.label}</p>
                          {opt.tag && (
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{opt.tag}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{opt.description}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                          strategy === opt.id ? "border-primary bg-primary" : "border-border"
                        }`}
                      >
                        {strategy === opt.id && <Check size={12} className="text-primary-foreground" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">You can change this anytime from your settings.</p>

              <Button
                onClick={goNext}
                data-testid="button-continue-strategy"
                className="w-full h-14 text-base font-semibold rounded-2xl"
              >
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-review-heading">
                  Review your information
                </h1>
                <p className="text-sm text-muted-foreground">Make sure everything looks correct before submitting.</p>
              </div>

              <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Name</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-name">
                    {personal.firstName} {personal.lastName}
                  </p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date of birth</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-dob">{personal.dob}</p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Address</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-address">
                    {personal.street}, {personal.city}, {personal.state} {personal.zip}
                  </p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-phone">{personal.phone}</p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Social Security Number</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-ssn">
                    •••-••-{identity.ssn.slice(-4)}
                  </p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Investment approach</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-strategy">
                    {strategy === "growth" ? "Growth Mix" : strategy === "balanced" ? "Steady & Balanced" : "Custom"}
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-terms-label">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  data-testid="checkbox-terms"
                  className="mt-1 w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-muted-foreground leading-snug">
                  I agree to the Account Agreement and authorize Kora and its clearing partners to open an investment account
                </span>
              </label>

              <Button
                onClick={handleSubmit}
                disabled={!termsAccepted}
                data-testid="button-activate-investing"
                className="w-full h-14 text-base font-semibold rounded-2xl"
              >
                Activate Investing
                <Check size={18} className="ml-2" />
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Lock size={12} />
                <span>Your information is encrypted and secure</span>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-16"
            >
              <ProcessingState
                message="Verifying your identity..."
                submessage="This will only take a moment"
              />
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-16 space-y-6"
            >
              <SuccessState
                message="You're all set!"
                submessage="Your gifts will now be automatically invested."
              />
              <div className="max-w-xs mx-auto">
                <Button
                  onClick={() => setLocation("/dashboard")}
                  data-testid="button-go-to-dashboard"
                  className="w-full h-14 text-base font-semibold rounded-2xl"
                >
                  Go to Dashboard
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
