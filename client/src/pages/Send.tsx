import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

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

export default function Send() {
  const [step, setStep] = useState(0);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [secretPhrase, setSecretPhrase] = useState("");
  const [showExtraSecurity, setShowExtraSecurity] = useState(false);
  const [selectedStock, setSelectedStock] = useState<typeof STOCKS[0] | null>(null);
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"stock" | "cash">("stock");

  const filteredStocks = STOCKS.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shares = selectedStock ? (parseFloat(amount) / selectedStock.price) : 0;
  const futureValue = parseFloat(amount) * 2.5;

  const isValidEmail = recipientEmail.includes("@") && recipientEmail.includes(".");
  const isValidPhone = recipientPhone.replace(/\D/g, "").length >= 10;
  const hasSecretPhrase = secretPhrase.length >= 4;
  const canProceed = recipientName.trim() && isValidEmail;

  const isLargeAmount = parseFloat(amount) >= 500;

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length >= 6) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    }
    return digits;
  };

  const handleSend = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep(3);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Cancel</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-900">Send</span>
          </div>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          
          {step === 0 && (
            <motion.div 
              key="who"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold text-stone-900 mb-2">Who's receiving?</h1>
                <p className="text-stone-500">They'll get stock that can grow over time</p>
              </div>

              <div className="space-y-4 mb-6">
                <input 
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  data-testid="input-recipient-name"
                  className="w-full px-4 py-4 bg-white border border-stone-200 rounded-xl text-stone-900 text-lg focus:outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5 transition-all"
                  placeholder="Their name"
                />
                <div className="relative">
                  <input 
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    data-testid="input-recipient-email"
                    className="w-full px-4 py-4 pr-12 bg-white border border-stone-200 rounded-xl text-stone-900 text-lg focus:outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5 transition-all"
                    placeholder="Their email"
                  />
                  {isValidEmail && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    </motion.div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowExtraSecurity(!showExtraSecurity)}
                className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 rounded-xl mb-4 hover:bg-stone-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} className={showExtraSecurity || isValidPhone || hasSecretPhrase ? "text-emerald-600" : "text-stone-400"} />
                  <span className="text-sm text-stone-600">
                    {(isValidPhone || hasSecretPhrase) ? "Extra security added" : "Add extra security"}
                  </span>
                  {(isValidPhone || hasSecretPhrase) && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {[isValidPhone && "SMS", hasSecretPhrase && "Phrase"].filter(Boolean).join(" + ")}
                    </span>
                  )}
                </div>
                {showExtraSecurity ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
              </button>

              <AnimatePresence>
                {showExtraSecurity && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="space-y-3 p-4 bg-stone-50 rounded-xl border border-stone-100">
                      <div>
                        <label className="text-xs text-stone-500 mb-1.5 block">SMS verification</label>
                        <input 
                          type="tel"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(formatPhone(e.target.value))}
                          className="w-full px-3 py-3 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                          placeholder="Their phone (optional)"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-500 mb-1.5 block">Secret phrase</label>
                        <input 
                          type="text"
                          value={secretPhrase}
                          onChange={(e) => setSecretPhrase(e.target.value)}
                          className="w-full px-3 py-3 bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                          placeholder="Something only they would know"
                        />
                        <p className="text-xs text-stone-400 mt-1">They must enter this exactly to claim</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                onClick={() => setStep(1)}
                disabled={!canProceed}
                data-testid="button-continue-step0"
                className="w-full py-4 bg-stone-900 text-white rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors text-lg"
              >
                Continue
              </button>
              
              <p className="text-xs text-stone-400 mt-4 text-center flex items-center justify-center gap-1.5">
                <Lock size={11} />
                We'll verify it's really them before they can claim
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div 
              key="stock"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <button 
                onClick={() => setStep(0)}
                className="text-sm text-stone-500 hover:text-stone-900 mb-4 transition-colors"
              >
                ← Back
              </button>

              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm font-medium text-stone-600">
                  {recipientName.charAt(0).toUpperCase()}
                </div>
                <span className="text-stone-600">{recipientName}</span>
              </div>

              <h1 className="text-2xl font-semibold text-stone-900 mb-6">Pick a stock</h1>

              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5 mb-4"
              />

              <div className="space-y-2 mb-6 max-h-[50vh] overflow-auto">
                {filteredStocks.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => setSelectedStock(stock)}
                    data-testid={`stock-${stock.symbol}`}
                    className={`w-full p-4 text-left rounded-xl border transition-all ${
                      selectedStock?.symbol === stock.symbol
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className={`font-medium ${selectedStock?.symbol === stock.symbol ? "text-white" : "text-stone-900"}`}>{stock.name}</p>
                        <p className={`text-sm ${selectedStock?.symbol === stock.symbol ? "text-stone-300" : "text-stone-500"}`}>{stock.symbol}</p>
                      </div>
                      <p className={selectedStock?.symbol === stock.symbol ? "text-white" : "text-stone-600"}>${stock.price}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!selectedStock}
                className="w-full py-4 bg-stone-900 text-white rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors text-lg"
              >
                {selectedStock ? `Continue with ${selectedStock.name}` : "Select a stock"}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="amount"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <button 
                onClick={() => setStep(1)}
                className="text-sm text-stone-500 hover:text-stone-900 mb-4 transition-colors"
              >
                ← Back
              </button>

              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm font-medium text-stone-600">
                  {recipientName.charAt(0).toUpperCase()}
                </div>
                <span className="text-stone-600">{recipientName}</span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500">{selectedStock?.symbol}</span>
              </div>

              <h1 className="text-2xl font-semibold text-stone-900 mb-6">How much?</h1>

              <div className="relative mb-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-stone-300">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  data-testid="input-amount"
                  className="w-full pl-12 pr-4 py-5 text-4xl font-light bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5"
                />
              </div>
              <p className="text-sm text-stone-500 mb-6">
                ≈ {shares.toFixed(4)} shares
              </p>

              <div className="flex gap-2 mb-8">
                {["25", "50", "100", "250"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      amount === preset
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              <div className="p-5 bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-amber-400" />
                  <span className="text-sm text-stone-300">Growth projection</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-light">${futureValue.toFixed(0)}</p>
                    <p className="text-stone-400 text-sm">in 10 years</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-medium">+{Math.round((futureValue / parseFloat(amount || "1") - 1) * 100)}%</p>
                    <p className="text-stone-400 text-xs">est. growth</p>
                  </div>
                </div>
              </div>

              {isLargeAmount && !isValidPhone && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-6"
                >
                  <div className="flex items-start gap-3">
                    <Shield size={18} className="text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Add phone for extra security?</p>
                      <p className="text-xs text-amber-600 mb-3">For gifts over $500, we recommend SMS verification</p>
                      <button
                        onClick={() => { setStep(0); setShowExtraSecurity(true); }}
                        className="text-xs font-medium text-amber-700 hover:text-amber-900"
                      >
                        Add phone →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mb-4">
                <textarea 
                  placeholder="Add a note (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                />
              </div>

              <div className="p-4 bg-white border border-stone-200 rounded-xl mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-500">{selectedStock?.name}</span>
                  <span className="text-stone-900">${parseFloat(amount || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-500">Fee</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t border-stone-100">
                  <span className="text-stone-900">Total</span>
                  <span className="text-stone-900">${parseFloat(amount || "0").toFixed(2)}</span>
                </div>
              </div>

              <button 
                onClick={handleSend}
                disabled={isProcessing || parseFloat(amount) < 1}
                data-testid="button-send"
                className="w-full py-4 bg-stone-900 text-white rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors text-lg"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  `Send $${amount}`
                )}
              </button>
              
              <p className="text-xs text-stone-400 mt-3 text-center flex items-center justify-center gap-1.5">
                <Shield size={11} className="text-emerald-500" />
                {recipientName} must verify
                {isValidPhone ? " via SMS +" : " via"} email
                {hasSecretPhrase ? " + secret phrase" : ""} to claim
              </p>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 rounded-full bg-emerald-50 mx-auto flex items-center justify-center mb-6"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </motion.div>

              <h1 className="text-2xl font-semibold text-stone-900 mb-2">Sent!</h1>
              <p className="text-stone-500 mb-8">
                {recipientName} will get an email to claim their {selectedStock?.name} shares
              </p>

              <div className="p-5 bg-white border border-stone-200 rounded-2xl text-left mb-8 mx-auto max-w-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-lg font-medium text-stone-600">
                    {recipientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{recipientName}</p>
                    <p className="text-xs text-stone-500">{recipientEmail}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-stone-100">
                  <div>
                    <p className="text-sm text-stone-500">{selectedStock?.name}</p>
                    <p className="font-semibold text-stone-900">{shares.toFixed(4)} shares</p>
                  </div>
                  <p className="text-xl font-semibold text-stone-900">${amount}</p>
                </div>
                {message && (
                  <p className="text-sm text-stone-500 italic pt-3 mt-3 border-t border-stone-100">"{message}"</p>
                )}
              </div>

              <div className="space-y-3">
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
                    setShowExtraSecurity(false);
                  }}
                  className="w-full py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                >
                  Send another
                </button>
                <Link href="/dashboard">
                  <button className="w-full py-3 text-stone-500 hover:text-stone-700 transition-colors text-sm">
                    Back to dashboard
                  </button>
                </Link>
              </div>

              <p className="text-xs text-stone-400 mt-8">
                30 days to claim · Unclaimed gifts are refunded automatically
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
