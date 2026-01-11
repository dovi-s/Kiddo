import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Lock, Shield, Plus, Trash2, User, Users } from "lucide-react";
import { Logo } from "@/components/ui/logo";

type AccountType = "parent" | "adult" | null;

interface ChildProfile {
  id: string;
  name: string;
  relationship: string;
}

type Step = "choose" | "account" | "children" | "review";

export default function GetStarted() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("choose");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [children, setChildren] = useState<ChildProfile[]>([
    { id: "1", name: "", relationship: "Parent" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (step === "account") return email && password && firstName;
    if (step === "children") return children.every(c => c.name.trim());
    return true;
  };

  const handleNext = () => {
    if (step === "choose") {
      setStep("account");
    } else if (step === "account") {
      if (accountType === "parent") {
        setStep("children");
      } else {
        setStep("review");
      }
    } else if (step === "children") {
      setStep("review");
    } else if (step === "review") {
      setIsSubmitting(true);
      setTimeout(() => {
        const childNames = children.map(c => c.name).join(",");
        setLocation(`/onboard?type=${accountType === "parent" ? "child" : "personal"}&name=${encodeURIComponent(children[0]?.name || firstName)}&email=${encodeURIComponent(email)}&children=${encodeURIComponent(childNames)}`);
      }, 1000);
    }
  };

  const handleBack = () => {
    if (step === "account") setStep("choose");
    else if (step === "children") setStep("account");
    else if (step === "review") {
      if (accountType === "parent") setStep("children");
      else setStep("account");
    }
  };

  const stepNumber = step === "choose" ? 1 : step === "account" ? 2 : step === "children" ? 3 : accountType === "parent" ? 4 : 3;
  const totalSteps = accountType === "parent" ? 4 : 3;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-stone-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="md" className="text-stone-900" />
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <div className="flex items-center gap-1">
              <Lock size={12} />
              <span>Secure</span>
            </div>
            {step !== "choose" && (
              <span className="text-stone-300">Step {stepNumber} of {totalSteps}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        {step !== "choose" && (
          <div className="mb-8">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    i < stepNumber ? "bg-stone-900" : "bg-stone-200"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <h1 className="text-2xl font-semibold text-stone-900">
                  Get started with Kora
                </h1>
                <p className="text-stone-500">
                  Create an account to open investment funds and receive gifts
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setAccountType("parent")}
                  data-testid="option-parent"
                  className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                    accountType === "parent"
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      accountType === "parent" ? "bg-stone-900" : "bg-stone-100"
                    }`}>
                      <Users size={22} className={accountType === "parent" ? "text-white" : "text-stone-500"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-stone-900 text-lg">I'm a parent or guardian</p>
                      <p className="text-sm text-stone-500 mt-1">
                        Create custodial accounts for your children. Manage their funds and receive gifts on their behalf.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-stone-400">
                        <span className="px-2 py-0.5 bg-stone-100 rounded">UGMA/UTMA</span>
                        <span>Custodial accounts</span>
                      </div>
                    </div>
                    {accountType === "parent" && (
                      <div className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center">
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
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      accountType === "adult" ? "bg-stone-900" : "bg-stone-100"
                    }`}>
                      <User size={22} className={accountType === "adult" ? "text-white" : "text-stone-500"} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-stone-900 text-lg">I'm opening for myself</p>
                      <p className="text-sm text-stone-500 mt-1">
                        Create your own investment fund. Share it for graduations, weddings, or any life milestone.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-stone-400">
                        <span className="px-2 py-0.5 bg-stone-100 rounded">Individual</span>
                        <span>Personal brokerage</span>
                      </div>
                    </div>
                    {accountType === "adult" && (
                      <div className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              </div>

              <p className="text-center text-xs text-stone-400">
                Already have an account? <Link href="/login"><span className="text-stone-700 underline">Sign in</span></Link>
              </p>
            </motion.div>
          )}

          {step === "account" && (
            <motion.div
              key="account"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-stone-900">
                  Create your account
                </h1>
                <p className="text-stone-500">
                  {accountType === "parent" 
                    ? "You'll manage funds for your children from this account"
                    : "Start your investment journey"}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      First name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Sarah"
                      data-testid="input-first-name"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Last name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Chen"
                      data-testid="input-last-name"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    data-testid="input-email"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    data-testid="input-password"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                  />
                  <p className="text-xs text-stone-400 mt-1.5">At least 8 characters</p>
                </div>
              </div>
            </motion.div>
          )}

          {step === "children" && (
            <motion.div
              key="children"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-stone-900">
                  Add your children
                </h1>
                <p className="text-stone-500">
                  Create a fund for each child. You can add more later.
                </p>
              </div>

              <div className="space-y-4">
                {children.map((child, index) => (
                  <motion.div
                    key={child.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-stone-200 p-5"
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
                        <label className="block text-sm text-stone-600 mb-1.5">
                          Child's first name
                        </label>
                        <input
                          type="text"
                          value={child.name}
                          onChange={(e) => updateChild(child.id, "name", e.target.value)}
                          placeholder="Mila"
                          data-testid={`input-child-name-${index}`}
                          className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-stone-600 mb-1.5">
                          Your relationship
                        </label>
                        <select
                          value={child.relationship}
                          onChange={(e) => updateChild(child.id, "relationship", e.target.value)}
                          data-testid={`select-relationship-${index}`}
                          className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
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
                  className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  <span>Add another child</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-stone-900">
                  Review your account
                </h1>
                <p className="text-stone-500">
                  Almost there! Confirm your details.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
                <div className="p-5">
                  <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">Account holder</p>
                  <p className="font-medium text-stone-900">{firstName} {lastName}</p>
                  <p className="text-sm text-stone-500">{email}</p>
                </div>

                <div className="p-5">
                  <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">Account type</p>
                  <p className="font-medium text-stone-900">
                    {accountType === "parent" ? "Parent/Guardian" : "Individual"}
                  </p>
                  <p className="text-sm text-stone-500">
                    {accountType === "parent" 
                      ? "Managing custodial accounts for children"
                      : "Personal investment account"}
                  </p>
                </div>

                {accountType === "parent" && children.length > 0 && (
                  <div className="p-5">
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-3">
                      {children.length === 1 ? "Child" : `${children.length} Children`}
                    </p>
                    <div className="space-y-2">
                      {children.map((child) => (
                        <div key={child.id} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-sm font-medium text-stone-600">
                            {child.name.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">{child.name || "Unnamed"}</p>
                            <p className="text-xs text-stone-500">{child.relationship}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-5">
                  <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">Brokerage partner</p>
                  <p className="font-medium text-stone-900">Alpaca Securities LLC</p>
                  <p className="text-sm text-stone-500">Member FINRA/SIPC</p>
                </div>
              </div>

              <p className="text-xs text-stone-400 leading-relaxed">
                By continuing, you agree to Kora's Terms of Service, Privacy Policy, and the 
                Alpaca Securities Brokerage Agreement. {accountType === "parent" && "Custodial accounts are governed by UTMA regulations."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className="mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
            data-testid="button-continue"
            className="w-full py-4 bg-stone-900 text-white text-base font-medium rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating account...</span>
              </>
            ) : step === "review" ? (
              <>
                <span>Create account</span>
                <Check size={18} />
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </motion.div>

        <div className="flex items-center justify-center gap-4 text-xs text-stone-400 mt-6">
          <div className="flex items-center gap-1">
            <Shield size={12} />
            <span>SIPC protected</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock size={12} />
            <span>256-bit encryption</span>
          </div>
        </div>
      </main>
    </div>
  );
}
