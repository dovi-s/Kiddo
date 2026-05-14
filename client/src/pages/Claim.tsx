import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, TrendingUp, Gift as GiftIcon, Shield, Lock, ChevronRight, Plus, Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
// Confetti import removed 2026-05-12 per feedback_animation_primitives.md
// locked rule: "Confetti at most on the at-18 ceremony moment, if at all.
// Not on first-gift, not on subscription upgrade, not on Memory Book
// milestones." Claim flow is a gift-claim success state — celebration tied
// to investment activity (the gift becomes invested in the fund), which
// sits in the same Robinhood-precedent regulatory zone the MA-AG consent
// order addressed. The InvestmentReveal below is the locked-discipline-
// appropriate confirmation pattern; no particle-confetti needed.
import { InvestmentReveal } from "@/components/ui/live-ticker";
import { haptic } from "@/lib/haptics";
import { useScrollResetOnChange } from "@/lib/scroll-to-element";
import { ThinkingOrb } from "@/components/ui/gemini";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";

interface PublicGiftData {
  id: string;
  senderName: string;
  amount: string;
  netAmount: string;
  message: string | null;
  executionModel: string | null;
  selectedTicker: string | null;
  status: string;
  createdAt: string;
  fundName: string;
  recipientFirstName: string | null;
}

type MarketQuoteResponse = {
  quotes: Array<{ symbol: string; price: number; isEstimate?: boolean }>;
};

type ClaimStep = "preview" | "auth" | "destination" | "success";
const MOTION_DUR = 0.2;
const PAGE_MAX = "max-w-2xl mx-auto px-4";
const PRIMARY_CTA = "w-full py-4 bg-primary text-primary-foreground text-base font-medium rounded-xl hover:bg-primary/90 transition-colors";

export default function Claim() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ClaimStep>("preview");
  useScrollResetOnChange(step);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [selectedFund, setSelectedFund] = useState<string | null>(null);
  const [createNewFund, setCreateNewFund] = useState(false);
  const [newFundName, setNewFundName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [claimedFundName, setClaimedFundName] = useState("");

  const { user, isAuthenticated, login, register, isLoggingIn, isRegistering, loginError, registerError } = useAuth();
  const { data: userFunds = [] } = useFunds();

  const { data: gift, isLoading: isLoadingGift, error: giftError } = useQuery<PublicGiftData>({
    queryKey: ["/api/public/gifts", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/gifts/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gift not found");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const giftTicker = gift?.selectedTicker?.trim().toUpperCase() || "";
  const giftQuoteSymbol = giftTicker || (gift ? "VTI" : "");
  const { data: marketQuoteData } = useQuery<MarketQuoteResponse>({
    queryKey: ["market-quotes", giftQuoteSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(giftQuoteSymbol)}`);
      if (!res.ok) throw new Error("Could not load quote estimate");
      return res.json();
    },
    enabled: !!giftQuoteSymbol,
    staleTime: 60_000,
  });
  const giftQuote = marketQuoteData?.quotes?.find((quote) => quote.symbol === giftQuoteSymbol);

  const claimMutation = useMutation({
    mutationFn: async (data: { fundId?: string; newFundName?: string }) => {
      const res = await fetch(`/api/gifts/${token}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to claim gift");
      }
      return res.json();
    },
    onSuccess: (data) => {
      haptic('success');
      setClaimedFundName(data.fundName || newFundName || "Your fund");
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    },
  });

  const giftValue = gift ? parseFloat(gift.netAmount) : 0;
  const giftAmount = gift ? parseFloat(gift.amount) : 0;
  const giftEstimatedPrice = giftQuote?.price || 100;
  const giftEstimatedShares = giftQuoteSymbol ? (giftValue / giftEstimatedPrice).toFixed(4) : "";
  const projectedValue = Math.round(giftValue * 4.6);
  const claimStepOrder: ClaimStep[] = ["preview", "auth", "destination"];
  const claimStepIndex = claimStepOrder.indexOf(step);

  const handleAuth = async () => {
    try {
      if (authMode === "signup") {
        await register({ email, password });
      } else {
        await login({ email, password });
      }
      haptic('medium');
      await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      setStep("destination");
    } catch {
      // errors are displayed via loginError / registerError
    }
  };

  const handleClaim = () => {
    haptic('medium');
    if (createNewFund && newFundName) {
      claimMutation.mutate({ newFundName });
    } else if (selectedFund) {
      claimMutation.mutate({ fundId: selectedFund });
    }
  };

  const handleClaimButtonClick = () => {
    if (isAuthenticated) {
      setStep("destination");
    } else {
      setStep("auth");
    }
  };

  if (isLoadingGift) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (giftError || !gift) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 gemini-glass-nav">
          <div className={`${PAGE_MAX} h-14 flex items-center`}>
            <Logo size="md" className="text-foreground" />
          </div>
        </header>
        <main className={`${PAGE_MAX} py-16 text-center space-y-4`}>
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <GiftIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-gift-not-found">Gift not found</h1>
          <p className="text-muted-foreground">
            This gift link may be invalid or has already been claimed.
          </p>
          <Link href="/">
            <button data-testid="button-go-home" className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
              Go home
            </button>
          </Link>
        </main>
      </div>
    );
  }

  const isAlreadyClaimed = gift.status === 'settled' || gift.status === 'claimed';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 gemini-glass-nav">
        <div className={`${PAGE_MAX} h-14 flex items-center justify-between`}>
          <Logo size="md" className="text-foreground" />
          {step !== "success" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock size={12} />
              <span>Secure claim</span>
            </div>
          )}
        </div>
        {step !== "success" && claimStepIndex >= 0 && (
          <div className={`${PAGE_MAX} pb-2`}>
            <p className="text-center text-xs text-muted-foreground">
              Step {claimStepIndex + 1} of {claimStepOrder.length}
            </p>
          </div>
        )}
      </header>

      <main className={`${PAGE_MAX} py-8 lg:py-12`}>
        <AnimatePresence mode="wait">
          {step === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <GiftIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-semibold text-foreground" data-testid="text-gift-heading">
                  {isAlreadyClaimed ? "This gift has been claimed" : "You've received a gift"}
                </h1>
                <p className="text-muted-foreground">
                  from <span className="font-medium text-foreground" data-testid="text-sender-name">{gift.senderName}</span>
                </p>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-6 lg:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Cash gift</p>
                      <span className="font-serif text-3xl font-semibold text-foreground" data-testid="text-gift-amount">
                        ${giftAmount.toFixed(2)}
                      </span>
                    </div>
                    {giftValue !== giftAmount && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Net amount</p>
                        <p className="text-xl font-medium text-foreground" data-testid="text-net-amount">
                          ${giftValue.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {gift.message && (
                    <div className="border-t border-border pt-6">
                      <p className="text-sm text-muted-foreground mb-2">Personal message</p>
                      <p className="text-foreground leading-relaxed italic" data-testid="text-gift-message">
                        "{gift.message}"
                      </p>
                    </div>
                  )}

                  {!isAlreadyClaimed && (
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
                  )}
                </div>

                {!isAlreadyClaimed && (
                  <div className="border-t border-border p-6 lg:p-8 bg-muted/50">
                    <button
                      onClick={handleClaimButtonClick}
                      data-testid="button-claim-gift"
                      className={`${PRIMARY_CTA} flex items-center justify-center gap-2`}
                    >
                      Claim your gift
                      <ChevronRight size={18} />
                    </button>
                    <p className="text-center text-xs text-muted-foreground mt-4">
                      Protected by SIPC
                    </p>
                  </div>
                )}

                {isAlreadyClaimed && (
                  <div className="border-t border-border p-6 lg:p-8 bg-muted/50 text-center">
                    <p className="text-muted-foreground" data-testid="text-already-claimed">This gift has already been claimed.</p>
                  </div>
                )}
              </div>

              <TrustMicroStrip />
            </motion.div>
          )}

          {step === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
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

                {(authMode === "signin" ? loginError : registerError) && (
                  <p className="text-sm text-red-500" data-testid="text-auth-error">
                    {authMode === "signin" ? loginError : registerError}
                  </p>
                )}

                <button
                  onClick={handleAuth}
                  disabled={isLoggingIn || isRegistering || !email || !password}
                  data-testid="button-continue-auth"
                  className={`${PRIMARY_CTA} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  {(isLoggingIn || isRegistering) ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{authMode === "signup" ? "Creating account..." : "Signing in..."}</span>
                    </>
                  ) : (
                    authMode === "signup" ? "Create account" : "Sign in"
                  )}
                </button>

                {authMode === "signup" && (
                  <p className="text-xs text-muted-foreground text-center">
                    By creating an account, you agree to our Terms of Service and Privacy Policy
                  </p>
                )}
              </div>
              <TrustMicroStrip />
            </motion.div>
          )}

          {step === "destination" && (
            <motion.div
              key="destination"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-6"
            >
              <button
                onClick={() => setStep(isAuthenticated ? "preview" : "auth")}
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
                {userFunds.map((fund) => (
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
                          Balance: ${parseFloat(fund.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      <p className="text-sm text-muted-foreground">Start a new fund</p>
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
                  <p className="font-medium text-foreground" data-testid="text-claiming-amount">
                    ${giftAmount.toFixed(2)} gift from {gift.senderName}
                  </p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  ${giftValue.toFixed(2)}
                </p>
              </div>

              {claimMutation.error && (
                <p className="text-sm text-red-500 text-center" data-testid="text-claim-error">
                  {claimMutation.error.message}
                </p>
              )}

              <button
                onClick={handleClaim}
                disabled={claimMutation.isPending || (!selectedFund && !createNewFund) || (createNewFund && !newFundName)}
                data-testid="button-confirm-claim"
                className={`${PRIMARY_CTA} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {claimMutation.isPending ? (
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
              <TrustMicroStrip />
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 py-8"
            >
              <InvestmentReveal
                amount={giftValue}
                stockSymbol={gift.selectedTicker || "VTI"}
                stockName={gift.selectedTicker ? `${gift.selectedTicker} Stock` : "Total US Market"}
                shares={giftEstimatedShares}
              />
              <p className="-mt-5 text-xs text-muted-foreground">
                Estimated at ${giftEstimatedPrice.toLocaleString()}/share. Final shares may change when the claim executes.
              </p>

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <h1 className="text-2xl lg:text-3xl font-semibold text-foreground" data-testid="text-claim-success">
                  Gift claimed!
                </h1>
                <p className="text-muted-foreground">
                  ${giftValue.toFixed(2)} has been added to your fund
                </p>
              </motion.div>

              <div className="bg-card rounded-2xl border border-border p-6 max-w-sm mx-auto">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium text-foreground" data-testid="text-success-amount">
                      ${giftAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net value</span>
                    <span className="font-medium text-foreground">
                      ${giftValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From</span>
                    <span className="font-medium text-foreground" data-testid="text-success-sender">{gift.senderName}</span>
                  </div>
                  <div className="border-t border-border pt-4 flex justify-between">
                    <span className="text-muted-foreground">Deposited to</span>
                    <span className="font-medium text-foreground" data-testid="text-success-fund">
                      {claimedFundName}
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
