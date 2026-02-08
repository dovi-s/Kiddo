import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, TrendingUp, Gift as GiftIcon, Shield, Lock, ChevronRight, Plus } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Confetti } from "@/components/ui/confetti";
import { InvestmentReveal } from "@/components/ui/live-ticker";
import { haptic } from "@/lib/haptics";
import { ThinkingOrb } from "@/components/ui/gemini";

interface GiftData {
  id: string;
  claimToken: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  recipientName: string;
  assetType: "stock" | "cash";
  stockSymbol: string | null;
  stockName: string | null;
  shares: number | null;
  currentPrice: number | null;
  amount: number | null;
  message: string;
  status: "pending_claim" | "claimed" | "expired";
  createdAt: Date;
  expiresAt: Date;
}

const mockGift: GiftData = {
  id: "gift_abc123",
  claimToken: "abc123",
  senderName: "Sarah Chen",
  senderEmail: "sarah@example.com",
  recipientEmail: "you@example.com",
  recipientName: "Alex",
  assetType: "stock",
  stockSymbol: "AAPL",
  stockName: "Apple Inc.",
  shares: 2.5,
  currentPrice: 178.50,
  amount: null,
  message: "Happy graduation! Here's something to grow with you as you start this next chapter. So proud of you!",
  status: "pending_claim",
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
};

const mockFunds = [
  { id: "fund_1", name: "My Investment Fund", slug: "alex-fund", balance: 1250.00, created: "2024" },
];

type ClaimStep = "preview" | "auth" | "destination" | "success";

export default function Claim() {
  const [step, setStep] = useState<ClaimStep>("preview");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [selectedFund, setSelectedFund] = useState<string | null>(null);
  const [createNewFund, setCreateNewFund] = useState(false);
  const [newFundName, setNewFundName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);

  const gift = mockGift;
  const giftValue = gift.assetType === "stock" 
    ? (gift.shares || 0) * (gift.currentPrice || 0)
    : gift.amount || 0;
  
  const projectedValue = Math.round(giftValue * 4.6);
  const daysUntilExpiry = Math.ceil((gift.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const handleClaim = () => {
    haptic('medium');
    setIsClaiming(true);
    setTimeout(() => {
      haptic('success');
      setStep("success");
      setIsClaiming(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="md" className="text-foreground" />
          {step !== "success" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock size={12} />
              <span>Secure claim</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 lg:py-12">
        <AnimatePresence mode="wait">
          {step === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <GiftIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
                  You've received a gift
                </h1>
                <p className="text-muted-foreground">
                  from <span className="font-medium text-foreground">{gift.senderName}</span>
                </p>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-6 lg:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {gift.assetType === "stock" ? "Stock gift" : "Cash gift"}
                      </p>
                      {gift.assetType === "stock" ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-semibold text-foreground">
                            {gift.shares} shares
                          </span>
                          <span className="text-lg text-muted-foreground">
                            of {gift.stockSymbol}
                          </span>
                        </div>
                      ) : (
                        <span className="text-3xl font-semibold text-foreground">
                          ${gift.amount?.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {gift.assetType === "stock" && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Current value</p>
                        <p className="text-xl font-medium text-foreground">
                          ${giftValue.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {gift.assetType === "stock" && (
                    <div className="bg-muted rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center text-sm font-bold text-foreground border border-border">
                          {gift.stockSymbol?.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{gift.stockName}</p>
                          <p className="text-sm text-muted-foreground">${gift.currentPrice?.toFixed(2)} per share</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {gift.message && (
                    <div className="border-t border-border pt-6">
                      <p className="text-sm text-muted-foreground mb-2">Personal message</p>
                      <p className="text-foreground leading-relaxed italic">
                        "{gift.message}"
                      </p>
                    </div>
                  )}

                  <div className="bg-muted rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Could grow to ${projectedValue.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Based on historical market performance over 18 years
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border p-6 lg:p-8 bg-muted/50">
                  <button
                    onClick={() => setStep("auth")}
                    data-testid="button-claim-gift"
                    className="w-full py-4 bg-primary text-primary-foreground text-base font-medium rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    Claim your gift
                    <ChevronRight size={18} />
                  </button>
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    Claim within {daysUntilExpiry} days · Protected by SIPC
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
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
          )}

          {step === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setStep("preview")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold text-foreground">
                  {authMode === "signup" ? "Create your account" : "Welcome back"}
                </h1>
                <p className="text-muted-foreground">
                  {authMode === "signup" 
                    ? "To claim your gift, create a free account"
                    : "Sign in to claim your gift"}
                </p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 space-y-6">
                <div className="flex rounded-lg bg-muted p-1">
                  <button
                    onClick={() => setAuthMode("signup")}
                    data-testid="tab-signup"
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      authMode === "signup" 
                        ? "bg-card text-foreground shadow-sm" 
                        : "text-muted-foreground"
                    }`}
                  >
                    New here
                  </button>
                  <button
                    onClick={() => setAuthMode("signin")}
                    data-testid="tab-signin"
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      authMode === "signin" 
                        ? "bg-card text-foreground shadow-sm" 
                        : "text-muted-foreground"
                    }`}
                  >
                    I have an account
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      data-testid="input-email"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === "signup" ? "Create a password" : "Enter your password"}
                      data-testid="input-password"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted-foreground"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setStep("destination")}
                  data-testid="button-continue-auth"
                  className="w-full py-4 bg-primary text-primary-foreground text-base font-medium rounded-xl hover:bg-primary/90 transition-colors"
                >
                  {authMode === "signup" ? "Create account" : "Sign in"}
                </button>

                {authMode === "signup" && (
                  <p className="text-xs text-muted-foreground text-center">
                    By creating an account, you agree to our Terms of Service and Privacy Policy
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {step === "destination" && (
            <motion.div
              key="destination"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setStep("auth")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold text-foreground">
                  Where should we deposit this?
                </h1>
                <p className="text-muted-foreground">
                  Choose an existing fund or create a new one
                </p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 space-y-4">
                {mockFunds.map((fund) => (
                  <button
                    key={fund.id}
                    onClick={() => {
                      setSelectedFund(fund.id);
                      setCreateNewFund(false);
                    }}
                    data-testid={`fund-option-${fund.id}`}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedFund === fund.id && !createNewFund
                        ? "border-primary bg-muted"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{fund.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Balance: ${fund.balance.toLocaleString()} · Since {fund.created}
                        </p>
                      </div>
                      {selectedFund === fund.id && !createNewFund && (
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => {
                    setCreateNewFund(true);
                    setSelectedFund(null);
                  }}
                  data-testid="button-create-new-fund"
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    createNewFund
                      ? "border-primary bg-muted"
                      : "border-dashed border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      createNewFund ? "bg-primary" : "bg-muted"
                    }`}>
                      <Plus size={20} className={createNewFund ? "text-primary-foreground" : "text-muted-foreground"} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Create new fund</p>
                      <p className="text-sm text-muted-foreground">Start a fresh investment fund</p>
                    </div>
                  </div>
                </button>

                {createNewFund && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-4"
                  >
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Fund name
                    </label>
                    <input
                      type="text"
                      value={newFundName}
                      onChange={(e) => setNewFundName(e.target.value)}
                      placeholder="e.g., My Future Fund"
                      data-testid="input-fund-name"
                      className="w-full px-4 py-3 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted-foreground"
                    />
                  </motion.div>
                )}
              </div>

              <div className="bg-muted rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">You're claiming</p>
                  <p className="font-medium text-foreground">
                    {gift.assetType === "stock" 
                      ? `${gift.shares} shares of ${gift.stockSymbol}`
                      : `$${gift.amount?.toFixed(2)}`
                    }
                  </p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  ${giftValue.toFixed(2)}
                </p>
              </div>

              <button
                onClick={handleClaim}
                disabled={isClaiming || (!selectedFund && !createNewFund) || (createNewFund && !newFundName)}
                data-testid="button-confirm-claim"
                className="w-full py-4 bg-primary text-primary-foreground text-base font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isClaiming ? (
                  <>
                    <ThinkingOrb size={16} variant="processing" />
                    <span>Claiming...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm and claim</span>
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 py-8"
            >
              <Confetti isActive={true} />
              
              {/* Cinematic Investment Reveal */}
              <InvestmentReveal 
                amount={giftValue}
                stockSymbol={gift.stockSymbol || "VTI"}
                stockName={gift.stockName || "Total US Market"}
                shares={String(gift.shares || (giftValue / 268.45).toFixed(4))}
              />

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
                  Gift claimed!
                </h1>
                <p className="text-muted-foreground">
                  {gift.assetType === "stock" 
                    ? `${gift.shares} shares of ${gift.stockSymbol} have been added to your fund`
                    : `$${gift.amount?.toFixed(2)} has been added to your fund`
                  }
                </p>
              </motion.div>

              <div className="bg-card rounded-2xl border border-border p-6 max-w-sm mx-auto">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Asset</span>
                    <span className="font-medium text-foreground">
                      {gift.assetType === "stock" ? gift.stockSymbol : "Cash"}
                    </span>
                  </div>
                  {gift.assetType === "stock" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shares</span>
                      <span className="font-medium text-foreground">{gift.shares}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value</span>
                    <span className="font-medium text-foreground">${giftValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From</span>
                    <span className="font-medium text-foreground">{gift.senderName}</span>
                  </div>
                  <div className="border-t border-border pt-4 flex justify-between">
                    <span className="text-muted-foreground">Deposited to</span>
                    <span className="font-medium text-foreground">
                      {createNewFund ? newFundName : mockFunds.find(f => f.id === selectedFund)?.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-muted rounded-xl p-4 max-w-sm mx-auto">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      Projected to grow to ${projectedValue.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Over 18 years based on historical returns
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3 max-w-sm mx-auto">
                <Link href="/dashboard">
                  <button
                    data-testid="button-go-dashboard"
                    className="w-full py-4 bg-primary text-primary-foreground text-base font-medium rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    Go to dashboard
                  </button>
                </Link>
                <Link href="/">
                  <button
                    data-testid="button-return-home"
                    className="w-full py-3 text-muted-foreground text-sm hover:text-foreground transition-colors"
                  >
                    Return home
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
