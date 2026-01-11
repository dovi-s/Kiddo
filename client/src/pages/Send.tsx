import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, CheckCircle2, AlertCircle, Phone, Mail, Key, Eye, EyeOff, User, HelpCircle } from "lucide-react";

const STOCKS = [
  { symbol: "AAPL", name: "Apple", price: 178.50 },
  { symbol: "DIS", name: "Disney", price: 92.30 },
  { symbol: "TSLA", name: "Tesla", price: 248.75 },
  { symbol: "AMZN", name: "Amazon", price: 178.25 },
  { symbol: "GOOGL", name: "Google", price: 141.80 },
  { symbol: "MSFT", name: "Microsoft", price: 378.90 },
  { symbol: "NFLX", name: "Netflix", price: 628.50 },
  { symbol: "NVDA", name: "NVIDIA", price: 875.30 },
];

type VerificationMethod = "email" | "phone" | "secret" | "none";

export default function Send() {
  const [step, setStep] = useState(0);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [secretPhrase, setSecretPhrase] = useState("");
  const [showSecretPhrase, setShowSecretPhrase] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>("email");
  const [selectedStock, setSelectedStock] = useState<typeof STOCKS[0] | null>(null);
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"stock" | "cash">("stock");
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);

  const filteredStocks = STOCKS.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shares = selectedStock ? (parseFloat(amount) / selectedStock.price) : 0;
  const futureValue = parseFloat(amount) * 2.5;

  const isValidEmail = recipientEmail.includes("@") && recipientEmail.includes(".");
  const isValidPhone = recipientPhone.replace(/\D/g, "").length >= 10;
  const hasSecretPhrase = secretPhrase.length >= 4;

  const verificationStrength = () => {
    let score = 0;
    if (isValidEmail) score += 1;
    if (isValidPhone) score += 1;
    if (hasSecretPhrase) score += 2;
    return score;
  };

  const strengthLabel = () => {
    const score = verificationStrength();
    if (score >= 3) return { label: "Maximum", color: "text-emerald-600", bg: "bg-emerald-50" };
    if (score >= 2) return { label: "Strong", color: "text-blue-600", bg: "bg-blue-50" };
    if (score >= 1) return { label: "Basic", color: "text-amber-600", bg: "bg-amber-50" };
    return { label: "None", color: "text-stone-400", bg: "bg-stone-50" };
  };

  const canProceed = recipientName && isValidEmail;

  const handleSend = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep(3);
      setIsProcessing(false);
    }, 1500);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length >= 6) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    }
    return digits;
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-back">← Back</span>
          </Link>
          <span className="text-sm font-medium tracking-tight text-stone-900">Send stock</span>
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <Lock size={12} />
            <span>Secure</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          
          <div className="hidden lg:block lg:sticky lg:top-20">
            <div className="mb-8">
              <h1 className="text-3xl font-light text-stone-900 mb-3">Send stock to anyone</h1>
              <p className="text-lg text-stone-500 leading-relaxed">
                Better than cash. They'll own a piece of a real company that can grow over time.
              </p>
            </div>

            <div className="flex items-center gap-3 mb-10">
              {[
                { label: "Verify", step: 0 },
                { label: "Stock", step: 1 },
                { label: "Amount", step: 2 },
                { label: "Done", step: 3 },
              ].map((s, i) => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= s.step 
                      ? "bg-stone-900 text-white" 
                      : "bg-stone-200 text-stone-500"
                  }`}>
                    {step > s.step ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 3 && <div className={`w-8 h-px ${step > s.step ? "bg-stone-900" : "bg-stone-200"}`} />}
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm text-stone-500">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-stone-400" />
                <span>Multi-layer recipient verification</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>30 days to claim with verification</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>SIPC protected up to $500,000</span>
              </div>
            </div>
          </div>

          <div className="max-w-lg mx-auto lg:mx-0 lg:max-w-none">
            <AnimatePresence mode="wait">
              
              {step === 0 && (
                <motion.div 
                  key="who"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <h1 className="text-2xl font-light text-stone-900 mb-2 lg:hidden">Send stock to anyone</h1>
                    <p className="text-stone-500 mb-8 lg:hidden">Verify they're the right person before sending.</p>

                    <div className="hidden lg:flex items-center justify-between mb-6">
                      <h2 className="text-lg font-medium text-stone-900">Verify recipient</h2>
                      <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${strengthLabel().bg} ${strengthLabel().color}`}>
                        <Shield size={12} />
                        {strengthLabel().label} security
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Their name</label>
                        <div className="relative">
                          <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                          <input 
                            type="text"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            data-testid="input-recipient-name"
                            className="w-full pl-10 pr-4 py-3 lg:py-4 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/5"
                            placeholder="Full name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Their email <span className="text-stone-400">(required)</span></label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                          <input 
                            type="email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            data-testid="input-recipient-email"
                            className="w-full pl-10 pr-10 py-3 lg:py-4 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/5"
                            placeholder="email@example.com"
                          />
                          {isValidEmail && (
                            <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-1.5">They'll receive a verification code here</p>
                      </div>

                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Their phone <span className="text-stone-400">(recommended)</span></label>
                        <div className="relative">
                          <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                          <input 
                            type="tel"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(formatPhone(e.target.value))}
                            data-testid="input-recipient-phone"
                            className="w-full pl-10 pr-10 py-3 lg:py-4 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/5"
                            placeholder="(555) 000-0000"
                          />
                          {isValidPhone && (
                            <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-1.5">SMS verification adds an extra layer of security</p>
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-6 mb-6">
                      <button 
                        onClick={() => setShowVerificationDetails(!showVerificationDetails)}
                        className="flex items-center justify-between w-full text-left mb-4"
                      >
                        <div className="flex items-center gap-2">
                          <Key size={16} className="text-stone-500" />
                          <span className="text-sm font-medium text-stone-700">Secret phrase verification</span>
                          {hasSecretPhrase && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>}
                        </div>
                        <span className="text-xs text-stone-400">{showVerificationDetails ? "Hide" : "Show"}</span>
                      </button>

                      <AnimatePresence>
                        {showVerificationDetails && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-stone-50 rounded-lg border border-stone-100 mb-4">
                              <p className="text-sm text-stone-600 mb-3">
                                Set a phrase only the real recipient would know. They must enter it exactly to claim the gift.
                              </p>
                              <div className="space-y-3">
                                <div className="relative">
                                  <input 
                                    type={showSecretPhrase ? "text" : "password"}
                                    value={secretPhrase}
                                    onChange={(e) => setSecretPhrase(e.target.value)}
                                    data-testid="input-secret-phrase"
                                    className="w-full px-4 py-3 pr-10 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                                    placeholder="e.g., Our first pet's name, Where we met"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowSecretPhrase(!showSecretPhrase)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                  >
                                    {showSecretPhrase ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                                </div>
                                <p className="text-xs text-stone-400">
                                  Examples: "purple elephant", "grandma's kitchen", "2019 road trip"
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="p-4 bg-stone-900 text-white rounded-lg mb-6">
                      <div className="flex items-start gap-3">
                        <Shield size={20} className="text-stone-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm mb-1">How recipient verification works</p>
                          <ul className="text-xs text-stone-400 space-y-1">
                            <li>1. Recipient receives claim link via email</li>
                            {isValidPhone && <li>2. SMS code sent to verify phone number</li>}
                            {hasSecretPhrase && <li>{isValidPhone ? "3" : "2"}. Must enter your secret phrase exactly</li>}
                            <li>{hasSecretPhrase ? (isValidPhone ? "4" : "3") : (isValidPhone ? "3" : "2")}. Identity verified before shares transfer</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4 lg:hidden">
                      <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${strengthLabel().bg} ${strengthLabel().color}`}>
                        <Shield size={12} />
                        {strengthLabel().label} security
                      </div>
                    </div>

                    <button 
                      onClick={() => setStep(1)}
                      disabled={!canProceed}
                      data-testid="button-continue-step0"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
                    >
                      Continue
                    </button>
                    
                    <p className="text-xs text-stone-400 mt-4 text-center flex items-center justify-center gap-1.5">
                      <Lock size={12} />
                      {hasSecretPhrase ? "Protected by secret phrase + " : ""}
                      {isValidPhone ? "SMS + " : ""}email verification
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div 
                  key="stock"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button 
                    onClick={() => setStep(0)}
                    data-testid="button-back-step1"
                    className="text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors"
                  >
                    ← Back
                  </button>

                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-stone-500">Sending to</p>
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Verified
                      </span>
                    </div>
                    <p className="text-lg font-medium text-stone-900 mb-6">{recipientName}</p>

                    <h1 className="text-2xl font-light text-stone-900 mb-8">Pick a stock</h1>

                    <input
                      type="text"
                      placeholder="Search companies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-stock"
                      className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 mb-6"
                    />

                    <div className="space-y-2 mb-8 max-h-80 overflow-auto">
                      {filteredStocks.map((stock) => (
                        <button
                          key={stock.symbol}
                          onClick={() => setSelectedStock(stock)}
                          data-testid={`stock-${stock.symbol}`}
                          className={`w-full p-4 text-left rounded-lg border transition-all ${
                            selectedStock?.symbol === stock.symbol
                              ? "border-stone-900 bg-white ring-2 ring-stone-900/10"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-stone-900">{stock.name}</p>
                              <p className="text-sm text-stone-500">{stock.symbol}</p>
                            </div>
                            <p className="text-stone-600">${stock.price}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => setStep(2)}
                      disabled={!selectedStock}
                      data-testid="button-continue-step1"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
                    >
                      Continue with {selectedStock?.name || "..."}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="amount"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button 
                    onClick={() => setStep(1)}
                    data-testid="button-back-step2"
                    className="text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors"
                  >
                    ← Back
                  </button>

                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-stone-500">Sending {selectedStock?.name} to</p>
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        {recipientName}
                      </span>
                    </div>
                    <h1 className="text-2xl font-light text-stone-900 mb-8">How much?</h1>

                    <div className="mb-8">
                      <div className="relative mb-2">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-400">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                          data-testid="input-amount"
                          className="w-full pl-10 pr-4 py-4 lg:py-5 text-3xl font-light bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                        />
                      </div>
                      <p className="text-sm text-stone-500">
                        ≈ {shares.toFixed(4)} shares of {selectedStock?.symbol}
                      </p>
                    </div>

                    <div className="p-5 lg:p-6 bg-stone-900 text-stone-50 rounded-lg mb-6">
                      <div className="flex justify-between items-baseline">
                        <div>
                          <p className="text-stone-400 text-sm">Could become</p>
                          <p className="text-2xl lg:text-3xl font-light">${futureValue.toFixed(0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-stone-400 text-sm">in 10 years</p>
                          <p className="text-emerald-400 text-sm">+{Math.round((futureValue / parseFloat(amount || "1") - 1) * 100)}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm text-stone-500 mb-3">How should they receive it?</label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setDeliveryType("stock")}
                          data-testid="delivery-stock"
                          className={`w-full p-4 text-left rounded-lg border transition-all ${
                            deliveryType === "stock"
                              ? "border-stone-900 bg-white ring-2 ring-stone-900/10"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-stone-900">Buy {selectedStock?.symbol} shares</p>
                              <p className="text-sm text-stone-500">We'll purchase the stock immediately</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              deliveryType === "stock" ? "border-stone-900" : "border-stone-300"
                            }`}>
                              {deliveryType === "stock" && <div className="w-2 h-2 rounded-full bg-stone-900" />}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setDeliveryType("cash")}
                          data-testid="delivery-cash"
                          className={`w-full p-4 text-left rounded-lg border transition-all ${
                            deliveryType === "cash"
                              ? "border-stone-900 bg-white ring-2 ring-stone-900/10"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-stone-900">Send to cash balance</p>
                              <p className="text-sm text-stone-500">They choose what to invest in</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              deliveryType === "cash" ? "border-stone-900" : "border-stone-300"
                            }`}>
                              {deliveryType === "cash" && <div className="w-2 h-2 rounded-full bg-stone-900" />}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm text-stone-500 mb-2">Add a note (optional)</label>
                      <textarea 
                        placeholder="Why you're sending this..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        data-testid="input-message"
                        className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                      />
                    </div>

                    <div className="p-4 bg-white border border-stone-200 rounded-lg mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">
                          {deliveryType === "stock" 
                            ? `${selectedStock?.name} (${shares.toFixed(4)} shares)` 
                            : "Cash balance"}
                        </span>
                        <span className="text-stone-900">${parseFloat(amount || "0").toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Fee</span>
                        <span className="text-emerald-700">$0.00</span>
                      </div>
                      <div className="flex justify-between font-medium pt-2 border-t border-stone-100">
                        <span className="text-stone-900">Total</span>
                        <span className="text-stone-900">${parseFloat(amount || "0").toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 mb-6">
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <Shield size={14} className="text-emerald-600" />
                        <span>
                          {recipientName} must verify via
                          {isValidPhone ? " SMS +" : ""} email
                          {hasSecretPhrase ? " + secret phrase" : ""} to claim
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={handleSend}
                      disabled={isProcessing || parseFloat(amount) < 1}
                      data-testid="button-send"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
                    >
                      {isProcessing ? "Sending..." : `Send $${amount}`}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center pt-8 lg:pt-16"
                >
                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-8">
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="mb-8"
                    >
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-emerald-50 mx-auto flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-8 h-8 lg:w-10 lg:h-10 text-emerald-600" />
                      </div>
                      <h1 className="text-2xl lg:text-3xl font-light text-stone-900 mb-2">Sent securely</h1>
                      <p className="text-stone-500">
                        {recipientName} will receive an email with a secure claim link
                      </p>
                    </motion.div>

                    <div className="p-5 bg-white border border-stone-200 rounded-lg text-left mb-6 max-w-xs mx-auto">
                      <div className="flex justify-between mb-3">
                        <div>
                          {deliveryType === "stock" ? (
                            <>
                              <p className="font-medium text-stone-900">{shares.toFixed(4)} shares</p>
                              <p className="text-sm text-stone-500">{selectedStock?.name}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium text-stone-900">Cash balance</p>
                              <p className="text-sm text-stone-500">They choose their investment</p>
                            </>
                          )}
                        </div>
                        <p className="font-medium text-stone-900">${amount}</p>
                      </div>
                      <div className="text-sm text-stone-500 pt-3 border-t border-stone-100">
                        <p>To: {recipientName}</p>
                        {message && <p className="mt-1 italic">"{message}"</p>}
                      </div>
                    </div>

                    <div className="p-4 bg-stone-50 rounded-lg border border-stone-100 max-w-xs mx-auto mb-8">
                      <p className="text-xs font-medium text-stone-700 mb-2">Verification required to claim</p>
                      <div className="space-y-1.5 text-xs text-stone-500">
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-emerald-600" />
                          <span>Email verification code</span>
                        </div>
                        {isValidPhone && (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-emerald-600" />
                            <span>SMS verification code</span>
                          </div>
                        )}
                        {hasSecretPhrase && (
                          <div className="flex items-center gap-2">
                            <Key size={12} className="text-emerald-600" />
                            <span>Secret phrase match</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setStep(0);
                        setRecipientName("");
                        setRecipientEmail("");
                        setRecipientPhone("");
                        setSecretPhrase("");
                        setSelectedStock(null);
                        setAmount("50");
                        setMessage("");
                      }}
                      data-testid="button-send-another"
                      className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                    >
                      Send another
                    </button>

                    <p className="text-xs text-stone-400 mt-8">
                      30 days to claim · Unclaimed gifts are refunded
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
