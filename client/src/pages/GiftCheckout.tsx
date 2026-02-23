import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Lock, Shield, ChevronDown, Check, ArrowRight, Heart, Sparkles, TrendingUp, CreditCard, Building2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { GradientText, ThinkingOrb } from "@/components/ui/gemini";
import { Mascot } from "@/components/ui/mascot";
import { useQuery } from "@tanstack/react-query";

const AMOUNTS = [25, 50, 100, 250];

const STOCK_PICKS = [
  { symbol: "DIS", name: "Disney" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "RBLX", name: "Roblox" },
  { symbol: "SBUX", name: "Starbucks" },
  { symbol: "AMZN", name: "Amazon" },
];

type ExecutionModel = "auto" | "pick" | "family";
type PaymentMethod = "card" | "apple_pay" | "bank";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: typeof CreditCard; desc: string; feeLine: string }[] = [
  { id: "apple_pay", label: "Apple Pay / Google Pay", icon: Smartphone, desc: "One-tap checkout", feeLine: "~2.9% + $0.30" },
  { id: "card", label: "Credit or debit card", icon: CreditCard, desc: "Visa, Mastercard, Amex", feeLine: "~2.9% + $0.30" },
  { id: "bank", label: "Bank transfer (ACH)", icon: Building2, desc: "Lower fees, 3-5 days", feeLine: "0.8% (max $5)" },
];

interface FeeData {
  baseAmount: number;
  processingFee: number;
  koraFee: number;
  totalCharge: number;
  netToFund: number;
  hasEventPass: boolean;
  hasFamilyPlan: boolean;
}

interface PublicEventData {
  event: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    eventDate?: string;
    eventType?: string;
    goalAmount?: number;
    giftVolume?: number;
    giftCount?: number;
  };
  fund: {
    id: string;
    name: string;
    recipientFirstName?: string;
    accountType?: string;
  };
  giftCount: number;
}

function compoundGrowth(amount: number, rate: number, years: number) {
  return Math.round(amount * Math.pow(1 + rate, years));
}

export default function GiftCheckout() {
  const { fund: fundSlug, event: eventSlug } = useParams<{ fund: string; event?: string }>();
  const [, setLocation] = useLocation();

  const [selectedAmount, setSelectedAmount] = useState(50);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [executionModel, setExecutionModel] = useState<ExecutionModel>("auto");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [showExecution, setShowExecution] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("apple_pay");
  const [coverFees, setCoverFees] = useState(true);
  const [showFees, setShowFees] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeAmount = showCustom && customAmount ? parseFloat(customAmount) : selectedAmount;
  const isValidAmount = activeAmount >= 5;

  const { data: eventData, isLoading: eventLoading } = useQuery<PublicEventData>({
    queryKey: ["public-event", eventSlug, fundSlug],
    queryFn: async () => {
      if (eventSlug) {
        const res = await fetch(`/api/public/events/${eventSlug}`);
        if (!res.ok) throw new Error("Event not found");
        return res.json();
      }
      const res = await fetch(`/api/public/funds/${fundSlug}`);
      if (!res.ok) throw new Error("Fund not found");
      const fundData = await res.json();
      return {
        event: { id: "", name: "Gift anytime", giftCount: 0 },
        fund: fundData.fund,
        giftCount: 0,
      };
    },
    enabled: !!(eventSlug || fundSlug),
  });

  const recipientName = eventData?.fund?.recipientFirstName || fundSlug || "Recipient";
  const eventName = eventData?.event?.name || "";
  const eventType = eventData?.event?.eventType || "";
  const giftCount = eventData?.event?.giftCount ?? eventData?.giftCount ?? 0;
  const goalAmount = eventData?.event?.goalAmount;
  const giftVolume = eventData?.event?.giftVolume ?? 0;
  const fundId = eventData?.fund?.id;
  const eventId = eventData?.event?.id;

  const heading = (() => {
    if (eventName && eventName !== "Gift anytime") return eventName;
    if (eventType) {
      const typeLabels: Record<string, string> = {
        birthday: "Birthday",
        baby_shower: "Baby Shower",
        holiday: "Holiday",
        christmas: "Christmas",
        graduation: "Graduation",
        just_because: "Just Because",
        gift_anytime: "",
      };
      const label = typeLabels[eventType];
      if (!label) return `Gift to ${recipientName}`;
      return `${recipientName}'s ${label}`;
    }
    return `Gift to ${recipientName}`;
  })();

  const growthAmount = compoundGrowth(activeAmount, 0.07, 18);

  const { data: feeData } = useQuery<FeeData>({
    queryKey: ["fees", fundSlug, eventSlug, activeAmount, coverFees],
    queryFn: async () => {
      const res = await fetch("/api/stripe/calculate-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: activeAmount,
          coverFees,
          eventSlug,
          fundSlug,
        }),
      });
      if (!res.ok) throw new Error("Failed to calculate fees");
      return res.json();
    },
    enabled: isValidAmount,
    staleTime: 5000,
  });

  const estimatedProcessingFee = paymentMethod === "bank"
    ? Math.min(5, activeAmount * 0.008)
    : (activeAmount * 0.029 + 0.30);
  const processingFee = feeData?.processingFee ?? estimatedProcessingFee;
  const platformFee = feeData?.koraFee ?? Math.max(1, Math.min(10, activeAmount * 0.015));
  const totalCharge = feeData?.totalCharge ?? (coverFees ? activeAmount + processingFee + platformFee : activeAmount);
  const achSavings = (activeAmount * 0.029 + 0.30) - Math.min(5, activeAmount * 0.008);
  const feeWaived = feeData?.hasEventPass || feeData?.hasFamilyPlan;

  const canSubmit = isValidAmount && senderName.trim().length > 0;

  const handlePay = async () => {
    if (!canSubmit || !fundId) return;
    haptic("medium");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/stripe/checkout/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId,
          eventId: eventId || undefined,
          amount: activeAmount,
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim() || undefined,
          message: message.trim() || undefined,
          coverFees,
        }),
      });

      if (!res.ok) throw new Error("Checkout failed");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Payment error:", err);
      setIsSubmitting(false);
    }
  };

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ThinkingOrb size={48} variant="processing" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" className="text-primary" />
          <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-full" data-testid="badge-secure">
            <Lock size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Secure</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">

        <motion.section
          className="text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Mascot size="md" className="mx-auto mb-2 drop-shadow-md" context="checkout" />
          <h1 className="font-heading text-2xl font-bold text-foreground mb-1" data-testid="text-heading">
            {heading}
          </h1>
          {giftCount > 0 && (
            <p className="text-sm text-muted-foreground mb-3" data-testid="text-gift-count">
              {giftCount} {giftCount === 1 ? "person has" : "people have"} already given
            </p>
          )}

          {goalAmount && goalAmount > 0 && (
            <div className="mt-3 px-2" data-testid="progress-goal">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>${giftVolume.toLocaleString()} raised</span>
                <span>${goalAmount.toLocaleString()} goal</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (giftVolume / goalAmount) * 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {isValidAmount && (
            <motion.div
              className="mt-4 inline-flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={activeAmount}
              data-testid="text-growth-teaser"
            >
              <TrendingUp size={14} className="text-primary" />
              <span className="text-xs text-foreground">
                A ${activeAmount} gift today could grow to ${growthAmount} in 18 years
              </span>
            </motion.div>
          )}
        </motion.section>

        <motion.section
          className="bg-card rounded-2xl shadow-premium-sm p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <h2 className="font-heading text-lg font-semibold text-foreground mb-3" data-testid="text-amount-heading">
            Choose an amount
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {AMOUNTS.map((amt) => (
              <motion.button
                key={amt}
                whileTap={{ scale: 0.95 }}
                className={`h-12 rounded-xl font-semibold text-sm transition-colors ${
                  !showCustom && selectedAmount === amt
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
                onClick={() => {
                  haptic("selection");
                  setSelectedAmount(amt);
                  setShowCustom(false);
                  setCustomAmount("");
                }}
                data-testid={`button-amount-${amt}`}
              >
                ${amt}
              </motion.button>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            className={`w-full h-12 rounded-xl font-medium text-sm transition-colors ${
              showCustom
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
            onClick={() => {
              haptic("selection");
              setShowCustom(!showCustom);
            }}
            data-testid="button-amount-other"
          >
            Other
          </motion.button>

          <AnimatePresence>
            {showCustom && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="relative mt-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                  <input
                    type="number"
                    min="5"
                    step="1"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full h-12 pl-8 pr-4 rounded-xl bg-muted border border-border text-foreground text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                    data-testid="input-custom-amount"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.section
          className="bg-card rounded-2xl shadow-premium-sm overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <button
            className="w-full p-5 flex items-center justify-between"
            onClick={() => {
              haptic("light");
              setShowExecution(!showExecution);
            }}
            data-testid="button-toggle-execution"
          >
            <div className="text-left">
              <h2 className="font-heading text-lg font-semibold text-foreground">What should this gift buy?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {executionModel === "auto" && "A diversified mix (recommended)"}
                {executionModel === "pick" && (selectedStock ? `$${activeAmount} of ${STOCK_PICKS.find(s => s.symbol === selectedStock)?.name || selectedStock}` : "You choose a specific stock")}
                {executionModel === "family" && "The family will choose"}
              </p>
            </div>
            <motion.div
              animate={{ rotate: showExecution ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={20} className="text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showExecution && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-3">
                  <button
                    className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                      executionModel === "auto" ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => { haptic("selection"); setExecutionModel("auto"); setSelectedStock(null); }}
                    data-testid="button-exec-auto"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      executionModel === "auto" ? "border-primary" : "border-muted-foreground/40"
                    }`}>
                      {executionModel === "auto" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">Diversified mix</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">Recommended</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Your gift is automatically invested in a balanced mix of stocks. Great for long-term growth.</p>
                    </div>
                  </button>

                  <button
                    className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                      executionModel === "pick" ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => { haptic("selection"); setExecutionModel("pick"); }}
                    data-testid="button-exec-pick"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      executionModel === "pick" ? "border-primary" : "border-muted-foreground/40"
                    }`}>
                      {executionModel === "pick" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <span className="font-medium text-sm text-foreground">Pick a specific stock</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Want to give $50 of Disney or Apple? Choose a company you love.</p>
                    </div>
                  </button>

                  <AnimatePresence>
                    {executionModel === "pick" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 pt-1">
                          <div className="flex flex-wrap gap-2">
                            {STOCK_PICKS.map((stock) => (
                              <motion.button
                                key={stock.symbol}
                                whileTap={{ scale: 0.95 }}
                                className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                                  selectedStock === stock.symbol
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground hover:bg-muted/80"
                                }`}
                                onClick={() => {
                                  haptic("selection");
                                  setSelectedStock(stock.symbol === selectedStock ? null : stock.symbol);
                                }}
                                data-testid={`button-stock-${stock.symbol}`}
                              >
                                {stock.name} ({stock.symbol})
                              </motion.button>
                            ))}
                          </div>
                          {selectedStock && (
                            <p className="text-xs text-primary font-medium flex items-center gap-1">
                              <Check size={12} />
                              ${activeAmount} of {STOCK_PICKS.find(s => s.symbol === selectedStock)?.name} will be purchased for {recipientName}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                      executionModel === "family" ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => { haptic("selection"); setExecutionModel("family"); setSelectedStock(null); }}
                    data-testid="button-exec-family"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      executionModel === "family" ? "border-primary" : "border-muted-foreground/40"
                    }`}>
                      {executionModel === "family" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <span className="font-medium text-sm text-foreground">Let the family decide</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Your gift arrives as cash. The family picks what to invest in.</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.section
          className="bg-card rounded-2xl shadow-premium-sm p-5 space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="text-personal-heading">
            Personal touch
          </h2>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Your name *</label>
            <input
              type="text"
              placeholder="Your name"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-sender-name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email (for receipt)</label>
            <input
              type="email"
              placeholder="you@email.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-sender-email"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Add a personal message for their Memory Book
            </label>
            <textarea
              placeholder="Happy birthday! Wishing you the best..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-message"
            />
          </div>
        </motion.section>

        <motion.section
          className="bg-card rounded-2xl shadow-premium-sm p-5 space-y-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.18 }}
        >
          <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="text-payment-method-heading">
            How would you like to pay?
          </h2>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                    paymentMethod === method.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30"
                  }`}
                  onClick={() => {
                    haptic("selection");
                    setPaymentMethod(method.id);
                  }}
                  data-testid={`button-payment-${method.id}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    paymentMethod === method.id ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Icon size={18} className={paymentMethod === method.id ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium ${method.id === "bank" ? "text-green-600" : "text-muted-foreground"}`}>
                      {method.feeLine}
                    </span>
                    {method.id === "bank" && activeAmount >= 50 && (
                      <p className="text-[10px] text-green-600 mt-0.5">
                        Save ${achSavings > 0 ? achSavings.toFixed(2) : ((activeAmount * 0.029 + 0.30) - Math.min(5, activeAmount * 0.008)).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === method.id ? "border-primary" : "border-muted-foreground/30"
                  }`}>
                    {paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            You will choose your exact payment method on the secure checkout page. Estimated fees shown above.
          </p>
        </motion.section>

        <motion.section
          className="bg-card rounded-2xl shadow-premium-sm overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.22 }}
        >
          <button
            className="w-full p-5 flex items-center justify-between"
            onClick={() => {
              haptic("light");
              setShowFees(!showFees);
            }}
            data-testid="button-toggle-fees"
          >
            <div className="text-left">
              <h2 className="font-heading text-lg font-semibold text-foreground">Fee breakdown</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: ${totalCharge.toFixed(2)}
              </p>
            </div>
            <motion.div
              animate={{ rotate: showFees ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={20} className="text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showFees && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gift amount</span>
                      <span className="text-foreground font-medium">${activeAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Processing ({paymentMethod === "bank" ? "ACH" : paymentMethod === "apple_pay" ? "Apple/Google Pay" : "Card"})
                      </span>
                      <span className="text-foreground">${processingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kora platform fee</span>
                      {feeWaived ? (
                        <span className="text-green-600 font-medium">Waived</span>
                      ) : (
                        <span className="text-foreground">${platformFee.toFixed(2)}</span>
                      )}
                    </div>
                    {feeWaived && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check size={12} />
                        {feeData?.hasEventPass ? "Event Pass" : "Family Plan"} active - platform fee waived
                      </p>
                    )}
                    <div className="border-t border-border pt-2 flex justify-between font-semibold">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground">${totalCharge.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    className="w-full flex items-center justify-between py-3 px-3 rounded-xl bg-muted"
                    onClick={() => {
                      haptic("selection");
                      setCoverFees(!coverFees);
                    }}
                    data-testid="button-toggle-cover-fees"
                  >
                    <span className="text-sm text-foreground">
                      Cover the fees so 100% goes to {recipientName}'s fund
                    </span>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${
                      coverFees ? "bg-primary" : "bg-muted-foreground/30"
                    }`}>
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                        animate={{ left: coverFees ? 18 : 2 }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.section
          className="bg-card rounded-2xl shadow-premium-sm overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <button
            className="w-full p-5 flex items-center justify-between"
            onClick={() => {
              haptic("light");
              setShowEducation(!showEducation);
            }}
            data-testid="button-toggle-education"
          >
            <h2 className="font-heading text-lg font-semibold text-foreground text-left">What happens to my gift?</h2>
            <motion.div
              animate={{ rotate: showEducation ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={20} className="text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showEducation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-3">
                  <div className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                    {executionModel === "auto" && (
                      <p data-testid="text-education">
                        Your gift goes into {recipientName}'s investment fund and is automatically invested for them. No action needed from you or the family.
                      </p>
                    )}
                    {executionModel === "pick" && (
                      <p data-testid="text-education">
                        Your gift buys {selectedStock ? `${STOCK_PICKS.find(s => s.symbol === selectedStock)?.name || selectedStock} stock` : "the stock you choose"} for {recipientName}. Every dollar gets invested, even if the stock costs more than your gift amount.
                      </p>
                    )}
                    {executionModel === "family" && (
                      <p data-testid="text-education">
                        Your gift arrives as cash in {recipientName}'s fund. The family will decide when and what to invest in. This gives them full control.
                      </p>
                    )}
                    <p>All investments are protected up to $500,000 and held securely at a regulated brokerage. Once invested, gifts belong to the recipient.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            className={`w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-colors ${
              canSubmit
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            onClick={handlePay}
            disabled={!canSubmit || isSubmitting}
            data-testid="button-pay"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <ThinkingOrb size={20} variant="processing" />
                <span>Connecting to checkout...</span>
              </div>
            ) : (
              <>
                {paymentMethod === "apple_pay" ? <Smartphone size={16} /> : paymentMethod === "bank" ? <Building2 size={16} /> : <Lock size={16} />}
                <span>
                  {paymentMethod === "apple_pay"
                    ? `Pay $${isValidAmount ? totalCharge.toFixed(2) : "0.00"}`
                    : paymentMethod === "bank"
                    ? `Pay $${isValidAmount ? totalCharge.toFixed(2) : "0.00"} via bank`
                    : `Pay $${isValidAmount ? totalCharge.toFixed(2) : "0.00"} with card`}
                </span>
              </>
            )}
          </motion.button>

          {!senderName.trim() && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Enter your name above to continue
            </p>
          )}
        </motion.div>

        <motion.footer
          className="pt-4 pb-8 text-center space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Shield size={12} />
              <span>SIPC protected</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock size={12} />
              <span>Bank-level encryption</span>
            </div>
            <div className="flex items-center gap-1">
              <Check size={12} />
              <span>Fees shown clearly</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Investments are not FDIC insured and may lose value. Assets held by Alpaca Securities LLC, Member FINRA/SIPC.
          </p>
        </motion.footer>
      </main>
    </div>
  );
}
