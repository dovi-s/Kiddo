import { useState, useEffect } from "react";
import { StockLogo } from "@/components/ui/stock-logo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, CheckCircle2, Info, Clock, Zap, Banknote } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { recordDemoBuy } from "@/lib/demo-live-gifts";
import { STOCK_PICKS as CANON_STOCK_PICKS } from "@shared/stock-picks";
import { STRATEGY_LABEL, type StrategyKey } from "@/lib/strategy";
import { projectFundValue } from "@shared/projection";

// Derived from the canonical universe (shared/stock-picks.ts) — the cash-invest
// picker (adult / owner-mode) now reads the SAME list as the gift page, parent
// recurring/one-time, and onboarding. Was a hand-synced copy that had already
// drifted (Adobe/Comcast, no Tesla/Microsoft/McDonald's). Shape preserved
// ({ticker,name,emoji,tagline}).
const STOCK_CHOICES = CANON_STOCK_PICKS.map((s) => ({
  ticker: s.ticker, name: s.name, emoji: s.emoji, tagline: s.tagline,
}));

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function getDefaultLabel(prefs: any): string {
  if (!prefs) return "Fund default";
  if (prefs.defaultMode === "stock") {
    const stock = STOCK_CHOICES.find((s) => s.ticker === prefs.defaultTicker);
    return stock ? `${stock.name} (${stock.ticker})` : (prefs.defaultTicker || "Fund default");
  }
  if (prefs.defaultMode === "cash") return "Hold as cash";
  // Canonical strategy names (lib/strategy.ts) — "Mix" is load-bearing so
  // "Growth" the strategy never reads as "Growth" the gain. Was hand-typed as
  // "Growth index portfolio" / "Balanced portfolio" here, which also silently
  // mislabeled the conservative tier as growth.
  return STRATEGY_LABEL[prefs.managedStrategy as StrategyKey] ?? STRATEGY_LABEL.growth;
}

function isMarketOpen(): boolean {
  try {
    const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyTimeStr);
    const day = nyDate.getDay();
    if (day === 0 || day === 6) return false;
    const total = nyDate.getHours() * 60 + nyDate.getMinutes();
    return total >= 9 * 60 + 30 && total < 16 * 60;
  } catch {
    return false;
  }
}

export type CashContext = "kyc_pending" | "held_as_cash" | "sold_proceeds" | "gifts_settled";

interface InvestCashModalProps {
  open: boolean;
  onClose: () => void;
  cashAmount: number;
  childName: string;
  fundId: string;
  cashContext?: CashContext;
  initialTicker?: string;
  // Optional callbacks the Dashboard passes for fund context (used purely
  // to render fund-aware microcopy — projection blurbs, breakeven labels,
  // etc.) and a success hook fired after an invest action lands.
  fundAllTimeReturnPct?: number;
  fundMonthReturnPct?: number;
  fundAgeYears?: number;
  fundAverageGiftDate?: string;
  // Years until the child reaches majority, plus the age, so the invest
  // confirmation can show a forward "by the time {child} turns {age}" glimpse
  // (connects this contribution to the handoff). Optional — callers that omit
  // them simply don't render the glimpse.
  yearsToMajority?: number;
  majorityAge?: number;
  onSuccess?: () => void;
}

export function InvestCashModal({
  open,
  onClose,
  cashAmount,
  childName,
  fundId,
  cashContext = "gifts_settled",
  initialTicker,
  fundAllTimeReturnPct: _fundAllTimeReturnPct,
  fundMonthReturnPct: _fundMonthReturnPct,
  fundAgeYears: _fundAgeYears,
  fundAverageGiftDate: _fundAverageGiftDate,
  yearsToMajority,
  majorityAge,
  onSuccess,
}: InvestCashModalProps) {
  const { user } = useAuth();
  const isDemoAccount = Boolean((user as any)?.isDemoAccount);
  const [step, setStep] = useState<"choose" | "confirm" | "done">("choose");
  const [investMode, setInvestMode] = useState<"default" | "stock" | "keep" | "withdraw">("default");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [investAmount, setInvestAmount] = useState("");
  const [investing, setInvesting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  const activeBanks = bankAccounts.filter((b: any) => (b.connectionStatus || "active") === "active");

  const { data: prefs, refetch: refetchPrefs } = useQuery<any>({
    queryKey: ["/api/funds", fundId, "investment-preferences"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/investment-preferences`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open && !!fundId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) {
      setStep("choose");
      setInvestMode(initialTicker ? "stock" : "default");
      setSelectedTicker(initialTicker || "");
      setSelectedBankId("");
      setInvestAmount(cashAmount > 0 ? cashAmount.toFixed(2) : "");
    }
  }, [cashAmount, initialTicker, open]);

  const contextMessages: Record<CashContext, string> = {
    kyc_pending: "Verification is complete. You can invest some, all, or none of this cash.",
    held_as_cash: `This fund holds gifts as cash until you choose what to invest.`,
    sold_proceeds: `These are the proceeds from a recent stock sale, ready to reinvest.`,
    gifts_settled: `${childName}'s settled gifts are ready when you are.`,
  };

  const selectedStockName = STOCK_CHOICES.find((s) => s.ticker === selectedTicker)?.name || selectedTicker;
  const normalizedInvestAmount = Number(investAmount.replace(/[^0-9.]/g, ""));
  const amountToInvest = Number.isFinite(normalizedInvestAmount) ? normalizedInvestAmount : 0;
  const roundedAmountToInvest = Math.round(amountToInvest * 100) / 100;
  const remainingCash = Math.max(0, cashAmount - roundedAmountToInvest);
  const amountInvalid = investMode !== "keep" && (roundedAmountToInvest <= 0 || roundedAmountToInvest > cashAmount);
  const quickAmounts = Array.from(new Set([
    Math.min(25, cashAmount),
    Math.min(100, cashAmount),
    Math.round((cashAmount / 2) * 100) / 100,
    cashAmount,
  ].filter((value) => value > 0))).sort((a, b) => a - b);

  const confirmDescription =
    investMode === "stock"
      ? `Buying ${selectedStockName} (${selectedTicker}) for ${childName}`
      : `Using ${childName}'s fund default: ${prefs ? getDefaultLabel(prefs) : "fund strategy"}`;

  const marketOpen = isMarketOpen();
  const executionNote = marketOpen
    ? "Markets are open. This executes at the current price."
    : "Will execute at the next market open (weekdays, 9:30am ET).";

  const handleConfirm = async () => {
    setInvesting(true);
    haptic("medium");
    try {
      const body: any = {};
      body.amount = roundedAmountToInvest.toFixed(2);
      if (investMode === "stock" && selectedTicker) body.ticker = selectedTicker;
      const res = await fetch(`/api/funds/${fundId}/auto-invest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        setStep("done");
        // Demo: record the buy so it reflects — the holding grows, the cash
        // drops by the same amount (invested↑ + cash↓ = same hero total), and an
        // "Invested $X" row shows in Activity. The sandbox mocks the POST, so the
        // refetch alone would drop it. Only the invest modes move cash into a
        // holding ("keep" is a no-op; "withdraw" leaves the fund entirely).
        if (isDemoAccount && (investMode === "default" || investMode === "stock")) {
          recordDemoBuy({
            fundId,
            ticker: investMode === "stock" ? selectedTicker : "",
            amount: roundedAmountToInvest.toFixed(2),
          });
        }
        void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "holdings"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
        onSuccess?.();
      } else {
        haptic("error");
        toast({
          title: "Could not invest",
          description: data?.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      haptic("error");
      toast({ title: "Could not invest", description: "Please try again.", variant: "destructive" });
    } finally {
      setInvesting(false);
    }
  };

  const handleToggleAutoInvest = async (enabled: boolean) => {
    setSavingToggle(true);
    try {
      const res = await fetch(`/api/funds/${fundId}/investment-preferences`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoInvestEnabled: enabled }),
      });
      if (res.ok) {
        await refetchPrefs();
        toast({
          title: enabled ? "Investing future gifts automatically" : "Future gifts will sit as cash",
          description: enabled
            ? "Future cash will invest automatically per the fund default."
            : "Cash will sit until you manually invest it.",
        });
      }
    } finally {
      setSavingToggle(false);
    }
  };

  const handleWithdraw = async () => {
    const bankId = selectedBankId || activeBanks[0]?.id;
    if (!bankId) return;
    setWithdrawing(true);
    haptic("medium");
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId, amount: roundedAmountToInvest.toFixed(2), bankAccountId: bankId }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        setStep("done");
        void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      } else {
        haptic("error");
        toast({ title: "Could not withdraw", description: data?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      haptic("error");
      toast({ title: "Could not withdraw", description: "Please try again.", variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="font-heading text-xl font-semibold">
            {step === "done" ? "All set" : "Put cash to work"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 space-y-5 overflow-y-auto flex-1 min-h-0">
          {step === "choose" && (
            <>
              {/* Cash amount + context */}
              <div className="rounded-2xl bg-[hsl(var(--kiddo-cream))] border border-[hsl(var(--kiddo-gold)/0.28)] p-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Ready when you are</p>
                <p className="text-3xl font-bold text-foreground font-heading">{formatCurrency(cashAmount)}</p>
                <p className="text-sm text-muted-foreground">{contextMessages[cashContext]}</p>
                {!marketOpen && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock size={12} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Markets closed. Executes at next open.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="invest-cash-amount" className="text-sm font-semibold text-foreground">How much should move today?</label>
                  <span className="text-xs text-muted-foreground">{formatCurrency(cashAmount)} available</span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
                  <input
                    id="invest-cash-amount"
                    value={investAmount}
                    onChange={(event) => setInvestAmount(event.target.value)}
                    inputMode="decimal"
                    className="h-12 w-full rounded-2xl border border-border bg-background pl-8 pr-4 text-base font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    data-testid="input-invest-cash-amount"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setInvestAmount(amount.toFixed(2))}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {amount === cashAmount ? "All cash" : formatCurrency(amount)}
                    </button>
                  ))}
                </div>
                {amountInvalid ? (
                  <p className="text-xs font-medium text-red-600">Enter an amount between $0.01 and {formatCurrency(cashAmount)}.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {remainingCash > 0.009
                      ? `${formatCurrency(remainingCash)} will stay as cash for later.`
                      : "This invests the full available cash balance."}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Where should this amount go?</p>

                {/* No "Recommended" badge — even nudging toward the fund's own
                    default counts as steering an investment choice, and the
                    self-directed posture keeps every menu neutral. The card is
                    already listed first and pre-selected; that's enough. */}
                <OptionCard
                  selected={investMode === "default"}
                  onClick={() => setInvestMode("default")}
                  title={`Use ${childName}'s fund default`}
                  description={prefs ? getDefaultLabel(prefs) : "Loading..."}
                />

                <OptionCard
                  selected={investMode === "stock"}
                  onClick={() => setInvestMode("stock")}
                  title="Pick one company"
                  description="Only the amount above goes into this choice"
                />

                {investMode === "stock" && (
                  <div className="grid grid-cols-2 gap-2 px-1">
                    {STOCK_CHOICES.map((stock) => {
                      const isSelected = selectedTicker === stock.ticker;
                      return (
                        <button
                          key={stock.ticker}
                          type="button"
                          onClick={() => setSelectedTicker(stock.ticker)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            isSelected
                              ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)]"
                              : "border-border hover:border-[hsl(var(--kiddo-evergreen)/0.4)] bg-background"
                          }`}
                        >
                          <StockLogo ticker={stock.ticker} size={32} className="mb-1.5" />
                          <p className="text-sm font-semibold text-foreground leading-tight">{stock.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{stock.tagline}</p>
                          {/* Only the SELECTED pick shows the amount, and it's the
                              ACTION ("goes here"), not "invested" (done) — this was
                              rendering "$X invested" on all 24 rows, implying $X was
                              already in each. */}
                          {isSelected && amountToInvest > 0 && (
                            <p className="text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] mt-1.5">
                              {formatCurrency(amountToInvest)} goes here
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <OptionCard
                  selected={investMode === "keep"}
                  onClick={() => setInvestMode("keep")}
                  title="Keep as cash for now"
                  description="Make no investment today"
                  variant="muted"
                />

                {investMode === "keep" && (
                  <div className="mx-1 rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Cash sitting in a child fund usually earns very little interest. Investing can make more sense for long-term goals, as long as you understand market risk.
                    </p>
                  </div>
                )}

                <OptionCard
                  selected={investMode === "withdraw"}
                  onClick={() => setInvestMode("withdraw")}
                  title="Withdraw to bank"
                  description={activeBanks.length > 0 ? `Send to your connected bank · 1–3 business days` : "No bank connected. Add one in Settings."}
                  variant="muted"
                />

                {investMode === "withdraw" && activeBanks.length > 1 && (
                  <div className="mx-1 space-y-2">
                    {activeBanks.map((bank: any) => {
                      const isSelected = selectedBankId ? selectedBankId === bank.id : bank === activeBanks[0];
                      return (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => setSelectedBankId(bank.id)}
                          className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-all flex items-center gap-3 ${
                            isSelected ? "border-primary bg-primary/6" : "border-border hover:border-primary/40 bg-background"
                          }`}
                        >
                          <Banknote size={15} className="shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{bank.bankName}</p>
                            <p className="text-xs text-muted-foreground">···· {bank.accountLast4}</p>
                          </div>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {investMode === "withdraw" && activeBanks.length === 0 && (
                  <div className="mx-1 rounded-xl bg-muted/40 border border-border p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Connect a bank account in Settings to enable withdrawals.
                    </p>
                  </div>
                )}
              </div>

              <Button
                className="w-full h-12 rounded-xl font-semibold"
                disabled={
                  (investMode !== "keep" && investMode !== "withdraw" && amountInvalid) ||
                  (investMode === "stock" && !selectedTicker) ||
                  (investMode === "withdraw" && activeBanks.length === 0)
                }
                onClick={() => {
                  if (investMode === "keep") { onClose(); return; }
                  if (investMode === "withdraw") { setStep("confirm"); haptic("light"); return; }
                  setStep("confirm");
                  haptic("light");
                }}
              >
                {investMode === "keep" ? "Keep as cash" : investMode === "withdraw" ? "Review withdrawal" : "Review investment"}
              </Button>
            </>
          )}

          {step === "confirm" && (
            <>
              {investMode === "withdraw" ? (() => {
                const bank = activeBanks.find((b: any) => b.id === (selectedBankId || activeBanks[0]?.id));
                return (
                  <>
                    <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Banknote size={18} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">
                            Withdraw {formatCurrency(roundedAmountToInvest)}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {bank ? `To ${bank.bankName} ···· ${bank.accountLast4}` : "To your connected bank"}
                          </p>
                          {remainingCash > 0.009 && (
                            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(remainingCash)} stays in {childName}'s fund.</p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-border pt-3 flex items-start gap-1.5">
                        <Info size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">Funds arrive in 1–3 business days via ACH transfer.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setStep("choose"); haptic("light"); }}>
                        Back
                      </Button>
                      <Button className="flex-1 h-12 rounded-xl font-semibold" disabled={withdrawing} onClick={handleWithdraw}>
                        {withdrawing
                          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : "Confirm withdrawal"}
                      </Button>
                    </div>
                  </>
                );
              })() : (
                <>
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <TrendingUp size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">
                          Investing {formatCurrency(roundedAmountToInvest)} for {childName}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{confirmDescription}</p>
                        {remainingCash > 0.009 ? (
                          <p className="text-xs text-muted-foreground mt-1">{formatCurrency(remainingCash)} stays as cash.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="border-t border-border pt-3 flex items-start gap-1.5">
                      <Info size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">{executionNote}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setStep("choose"); haptic("light"); }}>
                      Back
                    </Button>
                    <Button className="flex-1 h-12 rounded-xl font-semibold bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white" disabled={investing} onClick={handleConfirm}>
                      {investing
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : `Invest for ${childName}`}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {step === "done" && (
            <>
              <div className="text-center py-3 space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <div>
                  {investMode === "withdraw" ? (
                    <>
                      <p className="text-lg font-semibold text-foreground">
                        {formatCurrency(roundedAmountToInvest)} on its way
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your withdrawal is processing and should arrive in 1–3 business days.
                        {remainingCash > 0.009 ? ` ${formatCurrency(remainingCash)} remains in ${childName}'s fund.` : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-foreground">
                        {formatCurrency(roundedAmountToInvest)} is being invested
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {investMode === "stock" && selectedTicker
                          ? `${childName}'s cash is buying ${selectedStockName} (${selectedTicker}).${marketOpen ? " It will appear in Holdings shortly." : " It will execute at the next market open and appear in Holdings."}`
                          : `${childName}'s fund is back to work.${marketOpen ? " It will appear in Holdings shortly." : " It will execute at the next market open and appear in Holdings."}`}
                        {remainingCash > 0.009 ? ` ${formatCurrency(remainingCash)} remains available as cash.` : ""}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Forward glimpse — ties this contribution to the handoff (the
                  keystone moment). Honest: "could be about", the SAME canonical
                  projectFundValue math as the dashboard's "on track for" number,
                  projecting a single lump with NO assumed further contributions,
                  whole dollars (no false precision). Only for a real investment
                  (not hold-as-cash or withdraw) with a real horizon to majority. */}
              {(investMode === "default" || investMode === "stock") &&
                typeof yearsToMajority === "number" &&
                yearsToMajority >= 1 &&
                roundedAmountToInvest > 0 &&
                (() => {
                  const future = projectFundValue({
                    startingValue: roundedAmountToInvest,
                    monthlyContribution: 0,
                    yearsAhead: yearsToMajority,
                  });
                  if (future <= roundedAmountToInvest) return null;
                  const fmt0 = (v: number) =>
                    new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(v);
                  return (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-2.5">
                      <span className="text-base leading-none mt-0.5" aria-hidden>🌱</span>
                      <p className="text-sm text-foreground leading-relaxed">
                        Left to grow, this {formatCurrency(roundedAmountToInvest)} could be about{" "}
                        <span className="font-semibold">{fmt0(future)}</span> by the time {childName} turns {majorityAge ?? 18}.
                      </p>
                    </div>
                  );
                })()}

              {/* Auto-invest toggle - only shown after investing, not withdrawing */}
              {investMode !== "withdraw" && prefs !== null && prefs !== undefined && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Zap size={16} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Invest future gifts automatically</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {prefs?.autoInvestEnabled
                            ? "On. Future gifts invest automatically per the fund default."
                            : "Off. Cash will sit until you manually invest it."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={savingToggle}
                      onClick={() => handleToggleAutoInvest(!prefs?.autoInvestEnabled)}
                      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                        prefs?.autoInvestEnabled ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        prefs?.autoInvestEnabled ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                </div>
              )}

              <Button className="w-full h-12 rounded-xl font-semibold" onClick={onClose}>
                Done
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  description,
  badge,
  variant = "default",
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  badge?: string;
  variant?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3.5 transition-all ${
        selected
          ? "border-primary bg-primary/6 shadow-sm"
          : "border-border hover:border-primary/40 bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
          }`}>
            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${variant === "muted" ? "text-muted-foreground" : "text-foreground"}`}>
              {title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {badge && (
          <span className="shrink-0 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}
