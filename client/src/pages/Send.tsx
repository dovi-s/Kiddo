import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { ThinkingOrb } from "@/components/ui/gemini";
import { Mascot } from "@/components/ui/mascot";

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
    haptic('medium');
    setIsProcessing(true);
    setTimeout(() => {
      haptic('success');
      setStep(3);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 gemini-glass-nav">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Send</span>
          </div>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-6">
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
                <h1 className="text-2xl font-semibold text-foreground mb-2">Who's receiving?</h1>
                <p className="text-muted-foreground">They'll get stock that can grow over time</p>
              </div>

              <div className="space-y-4 mb-6">
                <input 
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  onFocus={() => haptic('light')}
                  data-testid="input-recipient-name"
                  className="w-full h-14 px-4 bg-card border-2 border-border/50 rounded-xl text-foreground text-lg focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-premium-sm transition-all duration-150"
                  placeholder="Their name"
                />
                <div className="relative">
                  <input 
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    data-testid="input-recipient-email"
                    className="w-full px-4 py-4 pr-12 bg-card border border-border rounded-xl text-foreground text-lg focus:outline-none focus:border-muted-foreground focus:ring-4 focus:ring-primary/5 transition-all"
                    placeholder="Their email"
                  />
                  {isValidEmail && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <CheckCircle2 size={20} className="text-success" />
                    </motion.div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowExtraSecurity(!showExtraSecurity)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-xl mb-4 hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} className={showExtraSecurity || isValidPhone || hasSecretPhrase ? "text-success" : "text-muted-foreground"} />
                  <span className="text-sm text-muted-foreground">
                    {(isValidPhone || hasSecretPhrase) ? "Extra security added" : "Add extra security"}
                  </span>
                  {(isValidPhone || hasSecretPhrase) && (
                    <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                      {[isValidPhone && "SMS", hasSecretPhrase && "Phrase"].filter(Boolean).join(" + ")}
                    </span>
                  )}
                </div>
                {showExtraSecurity ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showExtraSecurity && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="space-y-3 p-4 bg-muted rounded-xl border border-border">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">SMS verification</label>
                        <input 
                          type="tel"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(formatPhone(e.target.value))}
                          className="w-full px-3 py-3 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-muted-foreground"
                          placeholder="Their phone (optional)"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Secret phrase</label>
                        <input 
                          type="text"
                          value={secretPhrase}
                          onChange={(e) => setSecretPhrase(e.target.value)}
                          className="w-full px-3 py-3 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-muted-foreground"
                          placeholder="Something only they would know"
                        />
                        <p className="text-xs text-muted-foreground mt-1">They must enter this exactly to claim</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                onClick={() => setStep(1)}
                disabled={!canProceed}
                data-testid="button-continue-step0"
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors text-lg"
              >
                Continue
              </button>
              
              <p className="text-xs text-muted-foreground mt-4 text-center flex items-center justify-center gap-1.5">
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
                className="text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                ← Back
              </button>

              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                  {recipientName.charAt(0).toUpperCase()}
                </div>
                <span className="text-muted-foreground">{recipientName}</span>
              </div>

              <h1 className="text-2xl font-semibold text-foreground mb-6">Pick a stock</h1>

              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-muted-foreground focus:ring-4 focus:ring-primary/5 mb-4"
              />

              <div className="space-y-2 mb-6 max-h-[50vh] overflow-auto">
                {filteredStocks.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => setSelectedStock(stock)}
                    data-testid={`stock-${stock.symbol}`}
                    className={`w-full p-4 text-left rounded-xl border transition-all ${
                      selectedStock?.symbol === stock.symbol
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className={`font-medium ${selectedStock?.symbol === stock.symbol ? "text-primary-foreground" : "text-foreground"}`}>{stock.name}</p>
                        <p className={`text-sm ${selectedStock?.symbol === stock.symbol ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{stock.symbol}</p>
                      </div>
                      <p className={selectedStock?.symbol === stock.symbol ? "text-primary-foreground" : "text-muted-foreground"}>${stock.price}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!selectedStock}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors text-lg"
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
                className="text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                ← Back
              </button>

              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                  {recipientName.charAt(0).toUpperCase()}
                </div>
                <span className="text-muted-foreground">{recipientName}</span>
                <span className="text-border">·</span>
                <span className="text-muted-foreground">{selectedStock?.symbol}</span>
              </div>

              <h1 className="text-2xl font-semibold text-foreground mb-6">How much?</h1>

              <div className="relative mb-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-serif text-border">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  data-testid="input-amount"
                  className="w-full pl-12 pr-4 py-5 text-4xl font-serif font-light bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-muted-foreground focus:ring-4 focus:ring-primary/5"
                />
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                ≈ {shares.toFixed(4)} shares
              </p>

              <div className="flex gap-2 mb-8">
                {["25", "50", "100", "250"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      amount === preset
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              <div className="p-5 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-[hsl(var(--kora-gold))]" />
                  <span className="text-sm text-primary-foreground/70">Growth projection</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="font-serif text-3xl font-light">${futureValue.toFixed(0)}</p>
                    <p className="text-primary-foreground/60 text-sm">in 10 years</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[hsl(var(--kora-evergreen-light))] font-medium">+{Math.round((futureValue / parseFloat(amount || "1") - 1) * 100)}%</p>
                    <p className="text-primary-foreground/60 text-xs">est. growth</p>
                  </div>
                </div>
              </div>

              {isLargeAmount && !isValidPhone && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-[hsl(var(--kora-gold))]/10 border border-[hsl(var(--kora-gold))]/20 rounded-xl mb-6"
                >
                  <div className="flex items-start gap-3">
                    <Shield size={18} className="text-[hsl(var(--kora-gold))] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Add phone for extra security?</p>
                      <p className="text-xs text-muted-foreground mb-3">For gifts over $500, we recommend SMS verification</p>
                      <button
                        onClick={() => { setStep(0); setShowExtraSecurity(true); }}
                        className="text-xs font-medium text-[hsl(var(--kora-gold))] hover:text-[hsl(var(--kora-gold-light))]"
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
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-muted-foreground resize-none"
                />
              </div>

              <div className="p-4 bg-card border border-border rounded-xl mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{selectedStock?.name}</span>
                  <span className="text-foreground">${parseFloat(amount || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-success font-medium">Free</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">${parseFloat(amount || "0").toFixed(2)}</span>
                </div>
              </div>

              <button 
                onClick={handleSend}
                disabled={isProcessing || parseFloat(amount) < 1}
                data-testid="button-send"
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors text-lg"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <ThinkingOrb size={16} variant="processing" />
                    Sending...
                  </span>
                ) : (
                  `Send $${amount}`
                )}
              </button>
              
              <p className="text-xs text-muted-foreground mt-3 text-center flex items-center justify-center gap-1.5">
                <Shield size={11} className="text-success" />
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
                className="mx-auto mb-4"
              >
                <Mascot size="lg" className="mx-auto" context="send-success" />
              </motion.div>

              <h1 className="text-2xl font-semibold text-foreground mb-2">Sent!</h1>
              <p className="text-muted-foreground mb-8">
                {recipientName} will get an email to claim their {selectedStock?.name} shares
              </p>

              <div className="p-5 bg-card border border-border rounded-2xl text-left mb-8 mx-auto max-w-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-medium text-muted-foreground">
                    {recipientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{recipientName}</p>
                    <p className="text-xs text-muted-foreground">{recipientEmail}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedStock?.name}</p>
                    <p className="font-semibold text-foreground">{shares.toFixed(4)} shares</p>
                  </div>
                  <p className="text-xl font-semibold text-foreground">${amount}</p>
                </div>
                {message && (
                  <p className="text-sm text-muted-foreground italic pt-3 mt-3 border-t border-border">"{message}"</p>
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
                  className="w-full py-3 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                >
                  Send another
                </button>
                <Link href="/dashboard">
                  <button className="w-full py-3 text-muted-foreground hover:text-foreground transition-colors text-sm">
                    Back to dashboard
                  </button>
                </Link>
              </div>

              <p className="text-xs text-muted-foreground mt-8">
                30 days to claim · Unclaimed gifts are refunded automatically
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
