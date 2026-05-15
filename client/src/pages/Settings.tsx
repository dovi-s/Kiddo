import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { ACTIVE_FUND_CHANGE_EVENT, getActiveFundId, setActiveFundId } from "@/hooks/use-active-fund";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useCachedFirstNumber } from "@/hooks/use-cached-first-number";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StockLogo } from "@/components/ui/stock-logo";
import { AddFundSheet } from "@/components/AddFundSheet";
import { FirstSellTaxExplainerModal, type FirstSellTaxExplainerPayload } from "@/components/FirstSellTaxExplainerModal";
import { PlanBenefitsCard } from "@/components/PlanBenefitsCard";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { toast } from "@/hooks/use-toast";
import {
  CreditCard, Shield, Eye, EyeOff, Check,
  ChevronRight, ChevronDown, Star, Lock, Crown, ArrowUpRight, Wallet, Plus, Loader2,
  Building2, Trash2, TrendingDown, ArrowDownToLine, X, PieChart, Users, UserPlus, Pencil, Share2, ExternalLink, Camera,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CollaboratorInviteModal } from "@/components/ui/plg-loops";
import { ShareModal, type SharePage } from "@/components/ui/share-modal";
import { SetupProgressNudge, TrustMicroStrip } from "@/components/ui/ux-foundations";
import { WhoControlsDrawer } from "@/components/ui/trust-elements";
import { buildSetupProgress } from "@/lib/setup-progress";
import { formatAgeTransitionDate, getAge18Transition } from "@/lib/age-transition";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { PRONOUN_OPTIONS } from "@/lib/pronouns";
import { toMonthlyEquivalent } from "@shared/recurring-math";
import { getMajorityDate } from "@shared/utma";
import { prefetchDashboard, prefetchMemoryBook, prefetchActivity, prefetchTaxDocuments, onIdle } from "@/lib/prefetch";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  KIDDO_LEGACY_YEARLY,
  KORA_FAMILY_MONTHLY,
  KORA_FAMILY_YEARLY,
  KORA_STARTER_MONTHLY,
  KORA_STARTER_YEARLY,
} from "@shared/monetization";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`kiddo-card ${className}`}>
      {children}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="pt-2 pb-1">
      <p className="kiddo-section-label px-1">
        {label}
      </p>
    </div>
  );
}

function getFundTotalValue(fund: { balance?: string; pendingBalance?: string; cashBalance?: string } | null | undefined) {
  return (
    parseFloat(fund?.balance || "0") +
    parseFloat(fund?.pendingBalance || "0") +
    parseFloat(fund?.cashBalance || "0")
  );
}

function NotificationSwitchRow({
  title,
  body,
  checked,
  onCheckedChange,
  disabled = false,
  meta,
  testId,
}: {
  title: string;
  body: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  meta?: string;
  testId?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${
        checked
          ? "border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.045)]"
          : "border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.46)]"
      }`}
      data-testid={testId}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-foreground">{title}</p>
          {meta && (
            <span className="rounded-full bg-[hsl(var(--kiddo-gold)/0.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-gold-ink))]">
              {meta}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[hsl(var(--kiddo-evergreen))]"
        data-testid={testId ? `${testId}-switch` : undefined}
      />
    </div>
  );
}

function hasStarterEntitlement(membership: any): boolean {
  if (!membership) return false;
  if (membership.status === "active") return true;
  if (membership.status === "canceled" && membership.currentPeriodEnd) {
    return new Date(membership.currentPeriodEnd).getTime() > Date.now();
  }
  return false;
}

function getFundCoverageStatus(
  fundId: string,
  userPlan: "free" | "starter" | "family" | "legacy",
  starterByFund: Record<string, any>,
): { label: string; tone: "free" | "starter" | "family" } {
  if (userPlan === "family" || userPlan === "legacy") {
    return { label: "Covered by Kiddo Family", tone: "family" };
  }
  if (hasStarterEntitlement(starterByFund[String(fundId)])) {
    return { label: "Covered by Kiddo+", tone: "starter" };
  }
  return { label: "Free", tone: "free" };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function FundDetailsSnapshot({
  fund,
  compact = false,
}: {
  fund: any;
  compact?: boolean;
}) {
  const { data, isLoading } = useQuery<{
    holdings: any[];
    gifts: any[];
    events: any[];
  }>({
    queryKey: ["/settings/fund-details", fund?.id],
    queryFn: async () => {
      const [holdingsRes, giftsRes, eventsRes] = await Promise.all([
        fetch(`/api/funds/${fund.id}/holdings`, { credentials: "include" }),
        fetch(`/api/funds/${fund.id}/gifts`, { credentials: "include" }),
        fetch(`/api/funds/${fund.id}/events`, { credentials: "include" }),
      ]);
      const [holdings, gifts, events] = await Promise.all([
        holdingsRes.ok ? holdingsRes.json() : [],
        giftsRes.ok ? giftsRes.json() : [],
        eventsRes.ok ? eventsRes.json() : [],
      ]);
      return { holdings, gifts, events };
    },
    enabled: !!fund?.id,
    staleTime: 1000 * 60,
  });

  if (!fund?.id) return null;

  const holdings = data?.holdings || [];
  const gifts = data?.gifts || [];
  const events = data?.events || [];

  const investedValue = holdings.reduce((sum: number, h: any) => sum + parseFloat(h.currentValue || "0"), 0);
  const costBasis = holdings.reduce((sum: number, h: any) => sum + parseFloat(h.costBasis || "0"), 0);
  const pendingCash = parseFloat(fund?.pendingBalance || "0");
  const cashSettling = parseFloat((fund as any)?.cashBalance || "0");
  const totalValue = investedValue + pendingCash + cashSettling;
  const gain = investedValue - costBasis;
  const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
  const giftCount = gifts.length;
  const giftsNet = gifts.reduce((sum: number, g: any) => {
    const candidate = g?.netAmount ?? g?.amount ?? "0";
    return sum + parseFloat(String(candidate || "0"));
  }, 0);
  const activeEvents = events.filter((e: any) => e.status === "active").length;
  const topHoldings = [...holdings]
    .sort((a: any, b: any) => parseFloat(b.currentValue || "0") - parseFloat(a.currentValue || "0"))
    .slice(0, compact ? 2 : 4);

  return (
    <div className={`rounded-xl border border-border/50 bg-muted/20 ${compact ? "p-3" : "p-4"}`} data-testid={`fund-details-snapshot-${fund.id}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-foreground">Fund details</p>
        <span className="text-[11px] text-muted-foreground">
          {fund.investmentStrategy === "balanced"
            ? "Steady & Balanced"
            : fund.investmentStrategy === "conservative"
              ? "Conservative Mix"
              : fund.investmentStrategy === "custom"
                ? "Custom ETF Mix"
                : "Growth Mix"}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading details...</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-background border border-border/40 p-2">
              <p className="text-muted-foreground">Total value</p>
              <p className="text-foreground font-semibold">{formatUsd(totalValue)}</p>
            </div>
            <div className="rounded-lg bg-background border border-border/40 p-2">
              <p className="text-muted-foreground">Invested</p>
              <p className="text-foreground font-semibold">{formatUsd(investedValue)}</p>
            </div>
            <div className="rounded-lg bg-background border border-border/40 p-2">
              <p className="text-muted-foreground">Gifts pending</p>
              <p className="text-foreground font-semibold">{formatUsd(pendingCash)}</p>
            </div>
            {cashSettling > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                <p className="text-amber-700">Cash settling</p>
                <p className="text-amber-900 font-semibold">{formatUsd(cashSettling)}</p>
              </div>
            )}
            <div className="rounded-lg bg-background border border-border/40 p-2">
              <p className="text-muted-foreground">Unrealized</p>
              <p className={`font-semibold ${gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {gain >= 0 ? "+" : ""}{formatUsd(gain)} {costBasis > 0 ? `(${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%)` : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-background border border-border/40 p-2">
              <p className="text-muted-foreground">Positions</p>
              <p className="text-foreground font-semibold">{holdings.length}</p>
            </div>
            <div className="rounded-lg bg-background border border-border/40 p-2">
              <p className="text-muted-foreground">Gifts</p>
              <p className="text-foreground font-semibold">{giftCount}</p>
            </div>
            <div className="rounded-lg bg-background border border-border/40 p-2">
              <p className="text-muted-foreground">Active events</p>
              <p className="text-foreground font-semibold">{activeEvents}</p>
            </div>
          </div>

          <div className="rounded-lg bg-background border border-border/40 p-2">
            <p className="text-[11px] text-muted-foreground">
              Net gifted into this fund: <span className="text-foreground font-semibold">{formatUsd(giftsNet)}</span>
            </p>
          </div>

          <div className="rounded-lg bg-background border border-border/40 p-2">
            <p className="text-[11px] text-muted-foreground mb-1">What this fund owns</p>
            {/* Three-state ladder: loading → skeleton rows, loaded-empty →
                honest empty-state copy, loaded-with-data → the list. The
                skeleton uses the same row geometry (ticker on left, value
                right) so the swap to live data feels like a fill rather
                than a relayout. Matches the Dashboard discipline. */}
            {isLoading && topHoldings.length === 0 ? (
              <div className="space-y-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="inline-block h-2.5 w-16 rounded bg-muted/50" />
                    <span className="inline-block h-2.5 w-12 rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            ) : topHoldings.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No holdings yet. New gifts will auto-invest based on strategy.</p>
            ) : (
              <div className="space-y-1">
                {topHoldings.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground">{h.ticker || h.name}</span>
                    <span className="text-muted-foreground">{formatUsd(parseFloat(h.currentValue || "0"))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FundAgeTransitionSnapshot({ fund }: { fund: any }) {
  // State-aware majority age + ordinal. The copy below derives "turns {N}"
  // and the eyebrow "Age-{N} handoff" from the fund's actual setting,
  // not hardcoded 18. See project_state_majority_age_sweep.md.
  const fundMajorityAge = Number(fund?.majorityAge) || 18;
  const transition = getAge18Transition(fund?.recipientBirthdate, fundMajorityAge);

  if (!fund || !(fund.accountType === "UTMA" || !fund.accountType)) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3" data-testid={`fund-age-transition-${fund.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">Age-{fundMajorityAge} handoff</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {transition
              ? `${fund.recipientFirstName || "Your child"} turns ${fundMajorityAge} on ${formatAgeTransitionDate(transition.eighteenthBirthday)}. That date is the planning anchor. Legal control transfers at the age of majority for your state, usually 18 or 21.`
              : `Add a birthdate so this fund has a clear age-${fundMajorityAge} planning anchor. The legal handoff still happens at the age of majority for your state, usually 18 or 21.`}
          </p>
        </div>
        {transition ? (
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-medium ${
              transition.stage === "imminent"
                ? "bg-amber-100 text-amber-800"
                : transition.stage === "approaching"
                  ? "bg-blue-100 text-blue-700"
                  : transition.stage === "adult"
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
            }`}
            data-testid={`text-fund-age18-countdown-${fund.id}`}
          >
            {transition.countdownLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Nothing is sold automatically. The investments stay where they are unless the new owner later chooses to sell, withdraw, or transfer them.
        </p>
        <div className="flex items-center gap-3">
          <Link href={`/transition/fund/${fund.id}`} className="text-[11px] text-primary hover:underline" data-testid={`link-fund-age18-manage-${fund.id}`}>
            Manage handoff
          </Link>
          <Link href="/faq" className="text-[11px] text-primary hover:underline" data-testid={`link-fund-age18-faq-${fund.id}`}>
            Read the FAQ
          </Link>
          <WhoControlsDrawer />
        </div>
      </div>
    </div>
  );
}

function SellHoldingSheet({ open, onClose, holding, fund, onSuccess }: {
  open: boolean;
  onClose: () => void;
  holding: any;
  fund: any;
  onSuccess: () => void;
}) {
  const [selling, setSelling] = useState(false);
  const [sellAll, setSellAll] = useState(true);
  const [customShares, setCustomShares] = useState("");
  // First-sell tax explainer state. Mirrors Dashboard.tsx's pattern.
  // Per AGE_18_HANDOFF_SPEC.md bucket 2.
  const [sellTaxExplainer, setSellTaxExplainer] = useState<FirstSellTaxExplainerPayload | null>(null);

  const handleSell = async (opts: { confirmTaxExplainer?: boolean } = {}) => {
    setSelling(true);
    haptic("medium");
    try {
      const res = await fetch("/api/holdings/sell", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: holding.id,
          fundId: fund.id,
          shares: sellAll ? undefined : customShares,
          ...(opts.confirmTaxExplainer ? { confirmTaxExplainer: true } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        toast({ title: `${holding.ticker} moved to cash`, description: `$${data.saleValue} will settle inside the fund.` });
        setSellTaxExplainer(null);
        onSuccess();
        onClose();
      } else if (res.status === 409 && data.error === "first_sell_tax_explainer_required") {
        haptic("selection");
        setSellTaxExplainer(data as FirstSellTaxExplainerPayload);
      } else {
        toast({ title: "Could not sell", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not sell", description: "Please try again", variant: "destructive" });
    } finally {
      setSelling(false);
    }
  };

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Move {holding.ticker} to cash</DialogTitle>
        <div className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <TrendingDown size={24} className="text-primary" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-foreground">Move {holding.ticker} to cash</h2>
            <p className="text-sm text-muted-foreground">The money stays inside {fund?.recipientFirstName || "your child"}'s fund after settlement.</p>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shares owned</span>
              <span className="font-medium">{parseFloat(holding.shares).toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current value</span>
              <span className="font-medium">${parseFloat(holding.currentValue).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gain/Loss</span>
              <span className={`font-medium ${parseFloat(holding.gain) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {parseFloat(holding.gain) >= 0 ? "+" : ""}${parseFloat(holding.gain).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setSellAll(true); haptic("selection"); }}
              className={`w-full p-3 rounded-xl border-2 text-left transition-all ${sellAll ? "border-primary bg-primary/5" : "border-border"}`}
              data-testid="option-sell-all"
            >
              <p className="text-sm font-medium">Move all to cash</p>
              <p className="text-xs text-muted-foreground mt-0.5">Move {parseFloat(holding.shares).toFixed(4)} shares for about ${parseFloat(holding.currentValue).toFixed(2)}</p>
            </button>
            <button
              onClick={() => { setSellAll(false); haptic("selection"); }}
              className={`w-full p-3 rounded-xl border-2 text-left transition-all ${!sellAll ? "border-primary bg-primary/5" : "border-border"}`}
              data-testid="option-sell-partial"
            >
              <p className="text-sm font-medium">Move part of it</p>
              {!sellAll && (
                <input
                  type="number"
                  step="0.0001"
                  max={holding.shares}
                  value={customShares}
                  onChange={(e) => setCustomShares(e.target.value)}
                  placeholder="Shares to move"
                  className="mt-2 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-sell-shares"
                  autoFocus
                />
              )}
            </button>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200/50 p-3">
            <p className="text-xs text-amber-800">
              {fund.accountType === "UTMA"
                ? "For a child's fund, cash must still be used for the child's benefit."
                : "Cash becomes available in your fund after settlement, usually 1 to 2 business days."}
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl border border-blue-200/50 p-3">
            <p className="text-xs font-medium text-blue-900 mb-1">Tax note: cost basis</p>
            <p className="text-xs text-blue-800">
              Moving an investment to cash can create tax reporting. Kiddo will keep the activity visible, but a tax professional can help with personal guidance.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-cancel-sell">
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white"
              disabled={selling || (!sellAll && (!customShares || parseFloat(customShares) <= 0))}
              onClick={() => handleSell()}
              data-testid="button-confirm-sell"
            >
              {selling && <Loader2 size={16} className="mr-2 animate-spin" />}
              Move to cash
            </Button>
          </div>
        </div>
      </DialogContent>
      {/* First-sell tax explainer overlay — same modal Dashboard uses.
          Renders inside the Dialog so it overlays the parent sell sheet.
          Per AGE_18_HANDOFF_SPEC.md bucket 2. */}
      <FirstSellTaxExplainerModal
        payload={sellTaxExplainer}
        busy={selling}
        onCancel={() => setSellTaxExplainer(null)}
        onConfirm={() => handleSell({ confirmTaxExplainer: true })}
      />
    </Dialog>
  );
}

function WithdrawSheet({ open, onClose, fund, bankAccounts, bankAccountsLoading = false, onSuccess }: {
  open: boolean;
  onClose: () => void;
  fund: any;
  bankAccounts: any[];
  // Optional — when true, the bank-list section renders skeleton rows
  // instead of the "No bank accounts linked" empty state. Lets the
  // sheet open while accounts are still fetching without flashing the
  // empty-state copy.
  bankAccountsLoading?: boolean;
  onSuccess: () => void;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [liquidating, setLiquidating] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState(bankAccounts[0]?.id || "");
  const [confirmLiquidate, setConfirmLiquidate] = useState(false);

  useEffect(() => {
    if (bankAccounts.length > 0 && !selectedBank) {
      setSelectedBank(bankAccounts[0].id);
    }
  }, [bankAccounts]);

  // Cash sleeve = settled cash held in the fund (from sold holdings + uninvested gifts).
  // pendingBalance is gifts still settling and is NOT eligible for withdrawal.
  const availableCash = fund ? parseFloat(String(fund.cashBalance || "0")) : 0;
  const investedBalance = fund ? parseFloat(String(fund.balance || "0")) : 0;
  const hasInvested = investedBalance > 0;

  const respondToToast = (delivered: boolean, amt: string) => {
    haptic("success");
    if (delivered) {
      toast({ title: "Cash is on its way", description: `$${amt} will arrive in 1 to 3 business days` });
    } else {
      toast({
        title: "Withdrawal queued",
        description: `$${amt} queued for transfer. Our team completes withdrawals manually during early access.`,
      });
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    haptic("medium");
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: fund.id,
          amount: amount,
          bankAccountId: selectedBank,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        respondToToast(Boolean(data.delivered), data.amount);
        onSuccess();
        onClose();
      } else if (res.status === 409 && data.error === "first_withdrawal_cooldown") {
        // First-large-withdrawal cooldown for kid-owners post-handoff.
        // Per AGE_18_HANDOFF_SPEC.md bucket 2. Server has stamped
        // cooldownStartedAt; client surfaces the timeline so the kid
        // knows exactly when to come back. Calm tone (not destructive)
        // because this is product behavior, not an error.
        const endsAt = data.cooldownEndsAt ? new Date(data.cooldownEndsAt) : null;
        const endsLabel = endsAt
          ? endsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })
          : "tomorrow";
        toast({
          title: "First big withdrawal. 24-hour wait.",
          description: `${data.message || "We hold for 24 hours so you can sleep on it."} Try again ${endsLabel}.`,
        });
      } else {
        // "[Child]'s fund is safe" first — failure during a money-movement attempt is
        // exactly when a parent's first thought is "did my kid's money disappear?"
        // The reassurance is the title, the technical context goes in the description.
        toast({
          title: fund?.recipientFirstName ? `${fund.recipientFirstName}'s fund is safe` : "Your fund is safe",
          description: data.error || "We couldn't move that to your bank just now. Try again in a moment.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: fund?.recipientFirstName ? `${fund.recipientFirstName}'s fund is safe` : "Your fund is safe",
        description: "We couldn't move that to your bank just now. Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  // "Sell everything and send to bank" — one action that liquidates all holdings
  // AND chains a withdrawal of the full cash balance to the selected bank account.
  const handleLiquidateAll = async () => {
    if (!selectedBank) return;
    setLiquidating(true);
    haptic("medium");
    try {
      const res = await fetch(`/api/funds/${fund.id}/liquidate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId: selectedBank }),
      });
      const data = await res.json();
      if (res.ok) {
        const wd = data.withdrawal;
        if (wd) {
          respondToToast(Boolean(wd.delivered), wd.amount);
        } else {
          haptic("success");
          toast({ title: "Holdings sold", description: `Sold ${data.soldCount} holding${data.soldCount === 1 ? "" : "s"} for $${data.totalSaleValue}.` });
        }
        onSuccess();
        onClose();
        setConfirmLiquidate(false);
      } else {
        toast({
          title: fund?.recipientFirstName ? `${fund.recipientFirstName}'s fund is safe` : "Your fund is safe",
          description: data.error || "We couldn't sell and send right now. Holdings are untouched. Try again in a moment.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: fund?.recipientFirstName ? `${fund.recipientFirstName}'s fund is safe` : "Your fund is safe",
        description: "We couldn't sell and send right now. Holdings are untouched. Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLiquidating(false);
    }
  };

  if (!fund) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Taking money out</DialogTitle>
        <div className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <ArrowDownToLine size={24} className="text-primary" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-foreground">Taking money out</h2>
            <p className="text-sm text-muted-foreground">Available: ${availableCash.toFixed(2)}</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs leading-relaxed text-amber-800">
              For a child's fund, money already belongs to the child. Moving cash to your bank should be for their benefit.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  max={availableCash}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-withdraw-amount"
                />
              </div>
              <button
                onClick={() => setAmount(availableCash.toFixed(2))}
                className="text-xs text-primary mt-1 hover:underline"
                data-testid="button-withdraw-max"
              >
                Send all available cash
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">To bank account</label>
              {/* Loading → skeleton bank rows. Empty → the honest "no
                  accounts yet" line. Loaded → the picker. The skeleton
                  preserves the row height + icon column so the layout
                  doesn't shift when the data lands. */}
              {bankAccountsLoading && bankAccounts.length === 0 ? (
                <div className="space-y-2" aria-hidden="true">
                  {[0, 1].map((i) => (
                    <div key={i} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-border/60">
                      <div className="w-4 h-4 rounded bg-muted/50" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 rounded bg-muted/50" />
                        <div className="h-2.5 w-20 rounded bg-muted/30" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : bankAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bank accounts linked. Add one below.</p>
              ) : (
                <div className="space-y-2">
                  {bankAccounts.map((ba) => (
                    <button
                      key={ba.id}
                      onClick={() => { setSelectedBank(ba.id); haptic("selection"); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedBank === ba.id ? "border-primary bg-primary/5" : "border-border"}`}
                      data-testid={`option-bank-${ba.id}`}
                    >
                      <Building2 size={16} className="text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ba.bankName}</p>
                        <p className="text-xs text-muted-foreground">{ba.accountType} ****{ba.accountLast4}</p>
                      </div>
                      {selectedBank === ba.id && <Check size={16} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-cancel-withdraw">
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={withdrawing || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableCash || !selectedBank}
              onClick={handleWithdraw}
              data-testid="button-confirm-withdraw"
            >
              {withdrawing && <Loader2 size={16} className="mr-2 animate-spin" />}
              Take money out
            </Button>
          </div>

          {/* Sell-everything-and-send shortcut. Only relevant when there ARE holdings to sell. */}
          {hasInvested && (
            <div className="border-t border-border/60 pt-4">
              {!confirmLiquidate ? (
                <button
                  type="button"
                  onClick={() => { haptic("light"); setConfirmLiquidate(true); }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  disabled={!selectedBank}
                  data-testid="button-liquidate-all"
                >
                  Sell everything (${investedBalance.toFixed(2)}) and send to bank →
                </button>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900">Close out the whole fund?</p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    We'll sell all holdings and send the full balance (~${(availableCash + investedBalance).toFixed(2)}) to {bankAccounts.find(b => b.id === selectedBank)?.bankName || "your bank"}.
                    Cash settles in 1 to 2 business days. This may have tax implications.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setConfirmLiquidate(false)}
                      disabled={liquidating}
                      data-testid="button-cancel-liquidate"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleLiquidateAll}
                      disabled={liquidating || !selectedBank}
                      data-testid="button-confirm-liquidate"
                    >
                      {liquidating && <Loader2 size={14} className="mr-2 animate-spin" />}
                      Yes, sell and send
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
            During early access, our team completes withdrawals manually. You'll see the activity in your feed and a confirmation email when funds arrive.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkBankSheet({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [connectingPlaid, setConnectingPlaid] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [routingLast4, setRoutingLast4] = useState("");
  const [accountType, setAccountType] = useState("checking");

  const handlePlaidStart = async () => {
    setConnectingPlaid(true);
    haptic("medium");
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not start bank connection.");
      if (!data?.configured) {
        toast({
          title: "Plaid is not configured here",
          description: data?.message || "Use manual bank entry for local testing.",
        });
        return;
      }
      toast({
        title: "Plaid session ready",
        description: "Connect Plaid Link on the client with the returned link token.",
      });
    } catch (error) {
      toast({
        title: "Could not start bank connection",
        description: error instanceof Error ? error.message : "Please try manual entry.",
        variant: "destructive",
      });
    } finally {
      setConnectingPlaid(false);
    }
  };

  const handleLink = async () => {
    setLinking(true);
    haptic("medium");
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountLast4, routingLast4, accountType }),
      });
      if (res.ok) {
        haptic("success");
        toast({ title: "Bank account linked" });
        setBankName("");
        setAccountLast4("");
        setRoutingLast4("");
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        toast({ title: "Could not link account", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not link account", description: "Please try again", variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Link Bank Account</DialogTitle>
        <div className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Building2 size={24} className="text-primary" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-foreground">Connect your bank</h2>
            <p className="text-sm text-muted-foreground">Used for auto-invest, withdrawals, and keeping Emma's fund moving. Kiddo never sees your login credentials.</p>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Lock size={16} className="mt-0.5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Fastest with Plaid</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Plaid securely connects your bank, verifies account details, and supports the balance checks Kiddo needs before recurring pulls.
                </p>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handlePlaidStart}
              disabled={connectingPlaid}
              data-testid="button-connect-plaid"
            >
              {connectingPlaid && <Loader2 size={16} className="mr-2 animate-spin" />}
              Connect with Plaid
            </Button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="h-px flex-1 bg-border" />
            <span className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Manual fallback</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bank name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Chase, Wells Fargo, etc."
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="input-bank-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Account last 4</label>
                <input
                  type="text"
                  value={accountLast4}
                  onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-account-last4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Routing last 4</label>
                <input
                  type="text"
                  value={routingLast4}
                  onChange={(e) => setRoutingLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="5678"
                  maxLength={4}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-routing-last4"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Account type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="select-account-type"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl border border-border/50 p-3">
            <div className="flex items-start gap-2">
              <Lock size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Manual entry is here as a fallback for unsupported banks. Use Plaid when it is available.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-cancel-link-bank">
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={linking || !bankName || accountLast4.length !== 4}
              onClick={handleLink}
              data-testid="button-confirm-link-bank"
            >
              {linking && <Loader2 size={16} className="mr-2 animate-spin" />}
              Save fallback account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hypothetical annualized expected return (mean) and annualized volatility (sigma) for each
// strategy. Numbers are calibrated against widely-cited historical equity/bond return ranges
// for the underlying asset classes:
//   - Equity-heavy mixes (Growth): ~7% mean, ~16% sigma
//   - Balanced (~65/35): ~6% mean, ~12% sigma
//   - Conservative (~50/40): ~5% mean, ~9% sigma
// Used to derive the dynamic n-year low/avg/high projection range. The displayed range
// converges to the mean over longer horizons (sigma / sqrt(years)). Always paired with
// the standard "past performance does not guarantee future results" disclaimer.
// Canonical strategy emojis (per project locked emoji map):
//   📈 Growth · 🌿 Balanced · ⚖️ Conservative · 🎯 Custom
// Surface the emoji on each card title for instant differentiation
// (matches the chip on the holdings header, the StrategyIcon on the
// recurring schedule cards, and the per-strategy register elsewhere).
const STRATEGIES = [
  {
    key: "growth",
    emoji: "📈",
    label: "Growth Mix",
    description: "Long-term growth with broad diversification",
    bestFor: "Best for children with 10+ years to go.",
    minYearsTo18: 10,
    expectedMean: 0.07,
    expectedSigma: 0.16,
    allocations: [
      { ticker: "VTI", name: "Total Market Stocks", weight: 50, color: "#4F46E5" },
      { ticker: "VXUS", name: "International Stocks", weight: 25, color: "#0EA5E9" },
      { ticker: "BND", name: "Bonds", weight: 15, color: "#10B981" },
      { ticker: "VGT", name: "Tech Stocks", weight: 10, color: "#F59E0B" },
    ],
  },
  {
    key: "balanced",
    emoji: "🌿",
    label: "Balanced Mix",
    description: "Growth with stability · more bonds to soften ups and downs.",
    bestFor: "Best for children with 5–10 years to go.",
    minYearsTo18: 5,
    expectedMean: 0.06,
    expectedSigma: 0.12,
    allocations: [
      { ticker: "VTI", name: "Total Market Stocks", weight: 35, color: "#4F46E5" },
      { ticker: "VXUS", name: "International Stocks", weight: 15, color: "#0EA5E9" },
      { ticker: "BND", name: "Bonds", weight: 35, color: "#10B981" },
      { ticker: "VGT", name: "Tech Stocks", weight: 15, color: "#F59E0B" },
    ],
  },
  {
    key: "conservative",
    emoji: "⚖️",
    label: "Conservative Mix",
    description: "Capital preservation tilt · protect what's there as 18 approaches.",
    bestFor: "Best for children approaching 18.",
    minYearsTo18: 0,
    expectedMean: 0.05,
    expectedSigma: 0.09,
    allocations: [
      { ticker: "VTI", name: "Total Market Stocks", weight: 30, color: "#4F46E5" },
      { ticker: "BND", name: "Bonds", weight: 40, color: "#10B981" },
      { ticker: "VXUS", name: "International Stocks", weight: 20, color: "#0EA5E9" },
      { ticker: "VGT", name: "Tech Stocks", weight: 10, color: "#F59E0B" },
    ],
  },
  {
    key: "custom",
    emoji: "🎯",
    label: "Custom ETF Mix",
    // Explicit "ETFs only" framing — addresses the architectural-rule
    // confusion ("can I add stocks to this?"). Pairs with the
    // server-side ETF allowlist (CUSTOM_STRATEGY_ALLOWED_TICKERS) so
    // both copy and code say the same thing: managed mix never
    // contains individual stocks; those live in Chosen with Love.
    description: "Pick your own ETF mix. Individual stocks live in Chosen with Love.",
    bestFor: undefined,
    minYearsTo18: undefined,
    expectedMean: undefined,
    expectedSigma: undefined,
    allocations: [],
    gated: true,
  },
];

// Compute the dynamic low/avg/high range for a strategy over `years` time horizon.
// Uses the rule that the standard deviation of an n-year annualized return scales as
// sigma / sqrt(n). Output is rounded percentages. Returns null when inputs aren't usable.
function projectionRangeForStrategy(
  s: { expectedMean?: number; expectedSigma?: number } | undefined,
  years: number | null,
): { low: number; avg: number; high: number } | null {
  if (!s || s.expectedMean == null || s.expectedSigma == null || years == null) return null;
  if (!Number.isFinite(years) || years <= 0) return null;
  const mean = s.expectedMean;
  // Two regimes, two formulas. The display label switches between
  // "{months}-month return" (sub-year) and "{N}-year annualized" (multi-year),
  // and the math has to match what the label actually means.
  //
  // Sub-year ("{months}-month return" — total return over the period):
  //   period_mean = annualized_mean × years
  //   period_sigma = annualized_sigma × sqrt(years)   ← variance scales with t
  //
  // Multi-year ("{N}-year annualized" — annualized return with reduced
  // observation uncertainty):
  //   ann_mean = annualized_mean
  //   ann_sigma = annualized_sigma / sqrt(years)      ← uncertainty shrinks with t
  //
  // The previous version used the multi-year formula for sub-year cases too,
  // which inflated the displayed sigma (e.g. for Conservative at 8 months,
  // it showed −6% to +16% labeled as "8-month return" when the real period
  // total is closer to −4% to +11%). Caught when a parent saw the misleading
  // range and asked whether it was actually Conservative-shaped.
  if (years >= 1) {
    const annSigma = s.expectedSigma / Math.sqrt(years);
    return {
      low: Math.round((mean - annSigma) * 1000) / 10,
      avg: Math.round(mean * 1000) / 10,
      high: Math.round((mean + annSigma) * 1000) / 10,
    };
  }
  const periodMean = mean * years;
  const periodSigma = s.expectedSigma * Math.sqrt(years);
  return {
    low: Math.round((periodMean - periodSigma) * 1000) / 10,
    avg: Math.round(periodMean * 1000) / 10,
    high: Math.round((periodMean + periodSigma) * 1000) / 10,
  };
}

// Maps years-until-18 to the recommended preset key. The picker uses this to highlight
// one preset with a "Recommended for {child}" badge based on the child's actual age.
// Suggestion only — parent always overrides with no friction.
function recommendedStrategyKey(yearsTo18: number | null): string | null {
  if (yearsTo18 == null || !Number.isFinite(yearsTo18)) return null;
  if (yearsTo18 >= 10) return "growth";
  if (yearsTo18 >= 5) return "balanced";
  if (yearsTo18 >= 0) return "conservative";
  return null;
}

const GIFTER_STOCK_OPTIONS = [
  { ticker: "DIS", name: "Disney" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "NKE", name: "Nike" },
  { ticker: "AMZN", name: "Amazon" },
];

// Managed-mix custom allocations are ETFs only. Individual stocks live in
// the gifter pick list ("Chosen with Love"), never in the managed mix.
// Colors match the strategy-card palette in STRATEGIES above (VTI, VXUS,
// BND, VGT) and extend the palette for the additional optional tickers
// so the stacked-mix visualization stays consistent across the screen.
const CUSTOM_ALLOCATION_OPTIONS = [
  { ticker: "VTI",  name: "Total Market Stocks", color: "#4F46E5" },
  { ticker: "VXUS", name: "International Stocks", color: "#0EA5E9" },
  { ticker: "BND",  name: "Bonds",                color: "#10B981" },
  { ticker: "VGT",  name: "Tech ETF",             color: "#F59E0B" },
  { ticker: "VUG",  name: "Growth ETF",           color: "#A855F7" },
  { ticker: "VYM",  name: "Dividend ETF",         color: "#EC4899" },
  { ticker: "SCHD", name: "Dividend Growth",      color: "#14B8A6" },
  { ticker: "QQQ",  name: "Nasdaq 100",           color: "#EF4444" },
] as const;

const DEFAULT_CUSTOM_ALLOCATION_ROWS = [
  { ticker: "VTI", weight: 50 },
  { ticker: "VXUS", weight: 25 },
  { ticker: "BND", weight: 15 },
  { ticker: "VGT", weight: 10 },
];

const MAX_CUSTOM_HOLDINGS = 10;

function GifterInvestmentRulesEditor({ fund, onSuccess }: { fund: any; onSuccess: () => void }) {
  const { data, isLoading } = useQuery<{
    defaultMode: "managed" | "stock" | "cash";
    managedStrategy: "growth" | "balanced" | "custom";
    defaultTicker: string;
    allowGifterStockPick: boolean;
    allowGifterCashGift: boolean;
  }>({
    queryKey: ["/api/funds", fund.id, "investment-preferences"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fund.id}/investment-preferences`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load investment preferences");
      return res.json();
    },
    enabled: !!fund?.id,
    staleTime: 1000 * 30,
  });

  const [defaultMode, setDefaultMode] = useState<"managed" | "stock" | "cash">("managed");
  const [defaultTicker, setDefaultTicker] = useState("DIS");
  const [allowGifterStockPick, setAllowGifterStockPick] = useState(false);
  const [allowGifterCashGift, setAllowGifterCashGift] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDefaultMode(data.defaultMode || "managed");
    setDefaultTicker(data.defaultTicker || "DIS");
    setAllowGifterStockPick(Boolean(data.allowGifterStockPick));
    setAllowGifterCashGift(Boolean(data.allowGifterCashGift));
  }, [data]);

  const hasChanged =
    defaultMode !== (data?.defaultMode || "managed") ||
    defaultTicker !== (data?.defaultTicker || "DIS") ||
    allowGifterStockPick !== Boolean(data?.allowGifterStockPick) ||
    allowGifterCashGift !== Boolean(data?.allowGifterCashGift);

  const handleSave = async () => {
    setSaving(true);
    haptic("medium");
    try {
      const res = await fetch(`/api/funds/${fund.id}/investment-preferences`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultMode,
          defaultTicker,
          allowGifterStockPick,
          allowGifterCashGift,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Could not update gifting rules", description: payload.error || "Please try again", variant: "destructive" });
        return;
      }
      haptic("success");
      toast({ title: "Gifting rules updated", description: "Future gifts will follow these defaults." });
      onSuccess();
    } catch {
      toast({ title: "Could not update gifting rules", description: "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
        <p className="kiddo-section-label">Default path for new gifts</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Pick one family default. Most gifts follow this. Gifter stock picks or cash gifts only happen if you allow those overrides below.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          If a gifter chooses a stock, it applies only to that gift. Your family default stays the same for future gifts.
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => { setDefaultMode("managed"); haptic("selection"); }}
          className={`w-full rounded-2xl border p-4 text-left transition-all ${defaultMode === "managed" ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
          data-testid="option-gifting-default-managed"
        >
          <p className="text-sm font-medium text-foreground">Managed auto-invest</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Use your fund's investing style, like Growth Mix or Steady & Balanced.</p>
        </button>
        <button
          type="button"
          onClick={() => { setDefaultMode("stock"); haptic("selection"); }}
          className={`w-full rounded-2xl border p-4 text-left transition-all ${defaultMode === "stock" ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
          data-testid="option-gifting-default-stock"
        >
          <p className="text-sm font-medium text-foreground">Specific stock</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Every gift follows one default stock unless a gifter override is allowed.</p>
        </button>
        <button
          type="button"
          onClick={() => { setDefaultMode("cash"); haptic("selection"); }}
          className={`w-full rounded-2xl border p-4 text-left transition-all ${defaultMode === "cash" ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
          data-testid="option-gifting-default-cash"
        >
          <p className="text-sm font-medium text-foreground">Cash until invested</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Gifts land as cash and you decide when to invest later.</p>
        </button>
      </div>

      {defaultMode === "stock" && (
        <div className="space-y-2">
          <p className="kiddo-section-label">Family default</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {GIFTER_STOCK_OPTIONS.map((stock) => (
              <button
                key={stock.ticker}
                type="button"
                onClick={() => { setDefaultTicker(stock.ticker); haptic("selection"); }}
                className={`rounded-2xl border px-3 py-3 text-left transition-all ${defaultTicker === stock.ticker ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
                data-testid={`option-gifting-default-ticker-${stock.ticker}`}
              >
                <p className="text-sm font-medium text-foreground">{stock.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stock.ticker}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Allow people to choose a stock</p>
            <p className="mt-0.5 text-xs text-muted-foreground">If off, gifts follow your family default.</p>
          </div>
          <Switch checked={allowGifterStockPick} onCheckedChange={setAllowGifterStockPick} data-testid="switch-allow-gifter-stock-pick" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Allow people to send to cash instead</p>
            <p className="mt-0.5 text-xs text-muted-foreground">If off, people cannot send a gift to cash unless cash is your default.</p>
          </div>
          <Switch checked={allowGifterCashGift} onCheckedChange={setAllowGifterCashGift} data-testid="switch-allow-gifter-cash" />
        </div>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
        <p className="kiddo-section-label">What people will see</p>
        <p className="mt-2 text-sm text-foreground">
          Use family default
          {allowGifterStockPick ? " · Choose a stock" : ""}
          {allowGifterCashGift ? " · Let the family decide later" : ""}
        </p>
      </div>

      <Button onClick={handleSave} disabled={isLoading || saving || !hasChanged} className="w-full" data-testid="button-save-gifting-rules">
        {saving ? "Saving..." : "Save gifting rules"}
      </Button>
    </div>
  );
}

function StrategyEditor({ fund, canUseCustom, onSuccess }: { fund: any; canUseCustom: boolean; onSuccess: () => void }) {
  const rawCurrentStrategy = fund.investmentStrategy || "growth";
  const currentStrategy = rawCurrentStrategy === "auto_invest" ? "growth" : rawCurrentStrategy;
  const [selected, setSelected] = useState(currentStrategy);

  // Holdings drive the "today vs target" drift display so the parent can see
  // how the actual portfolio compares to the strategy. Soft rebalancing means
  // switching strategy doesn't sell holdings — it just steers future gifts.
  const { data: strategyHoldings = [] } = useQuery<any[]>({
    queryKey: ["/api/funds", fund?.id, "holdings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fund.id}/holdings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fund?.id,
    staleTime: 60_000,
  });
  // activeStrategy lifted up here (was at ~line 1430) so the managed-mix
  // computations below can reference its allocations to know which tickers
  // belong to the managed mix vs chosen-with-love.
  const activeStrategy = STRATEGIES.find(s => s.key === selected) || STRATEGIES[0];
  // Whole-fund invested total — every holding (managed-mix ETFs + chosen-with-love
  // individual stocks). Used for the "Emma's Mix is X% of total fund" context line.
  const investedValue = strategyHoldings.reduce(
    (sum: number, h: any) => sum + parseFloat(h?.currentValue || "0"),
    0,
  );
  // Managed-mix-only subset. Used as the denominator for the "Today vs target"
  // drift math, because strategy target weights (e.g. BND 40%) are designed
  // to sum to 100% within the managed mix, NOT within the whole fund. Mixing
  // a "% of whole fund" current with a "% of managed-mix subset" target is a
  // category error — it's what produced the misleading "−34 pts off" headline
  // when the real managed-mix drift was ~20 pts. Membership in the managed mix
  // is determined by membership in the active strategy's target basket
  // (computed in the consumer below as `targetMap`).
  const managedMixTargetTickers = new Set(
    activeStrategy.allocations.map((a) => String(a.ticker).toUpperCase()),
  );
  const managedMixInvestedValue = strategyHoldings.reduce(
    (sum: number, h: any) => {
      const t = String(h?.ticker || "").toUpperCase();
      if (!managedMixTargetTickers.has(t)) return sum;
      return sum + parseFloat(h?.currentValue || "0");
    },
    0,
  );
  const currentAllocPct: Record<string, number> = (() => {
    if (managedMixInvestedValue <= 0) return {};
    const out: Record<string, number> = {};
    for (const h of strategyHoldings) {
      const t = String(h?.ticker || "").toUpperCase();
      if (!t) continue;
      // Only include managed-mix tickers in the percentage map. Chosen-with-love
      // positions (GOOGL, AAPL, DUOL, etc.) aren't part of the managed mix and
      // shouldn't appear in the rebalance view — they have no targets and
      // aren't subject to contribution-based rebalancing.
      if (!managedMixTargetTickers.has(t)) continue;
      const v = parseFloat(h?.currentValue || "0");
      if (!Number.isFinite(v) || v <= 0) continue;
      out[t] = (out[t] || 0) + (v / managedMixInvestedValue) * 100;
    }
    return out;
  })();
  // Managed-mix share of the whole fund. Surfaced as a small context line at
  // the top of the "Today vs target" card so the parent understands what
  // portion of Emma's fund this view is about.
  const managedMixShareOfFund = investedValue > 0
    ? Math.round((managedMixInvestedValue / investedValue) * 100)
    : 0;

  // Compute years-until-18 from the recipient's birthdate, then surface the
  // age-appropriate strategy as "Recommended for {child}". Suggestion only — parent overrides.
  const yearsTo18 = ((): number | null => {
    const raw = (fund as any)?.recipientBirthdate;
    if (!raw) return null;
    const bd = new Date(raw);
    if (isNaN(bd.getTime())) return null;
    const eighteenth = new Date(bd);
    eighteenth.setFullYear(eighteenth.getFullYear() + 18);
    const ms = eighteenth.getTime() - Date.now();
    return ms > 0 ? ms / (365.25 * 24 * 60 * 60 * 1000) : 0;
  })();
  const recommendedKey = recommendedStrategyKey(yearsTo18);
  const childName = (fund as any)?.recipientFirstName || null;
  const [customRows, setCustomRows] = useState<Array<{ ticker: string; weight: number }>>(DEFAULT_CUSTOM_ALLOCATION_ROWS);
  const [initialCustomRows, setInitialCustomRows] = useState<Array<{ ticker: string; weight: number }>>(DEFAULT_CUSTOM_ALLOCATION_ROWS);
  const [saving, setSaving] = useState(false);
  // Drives the FeatureWallModal that opens when a free user taps
  // the locked Custom strategy. Previously the tap was a dead
  // button (the onClick early-returned on isLocked) so the parent
  // got no feedback — they didn't know WHAT the lock meant or
  // how to unlock it. Now the modal explains Plus + offers the
  // one-tap upgrade path. Per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md.
  const [customGateWallOpen, setCustomGateWallOpen] = useState(false);
  // Brief inline caption surfaced after the auto-adjust-on-add path
  // re-balances from the largest holding. Without this hint the
  // parent sees VTI silently drop from 50% to 40% when they add VUG
  // and could read it as a bug. The caption names the ticker that
  // gave up weight, fades after 3 seconds, and only fires on the
  // total===100 branch (the other branches don't touch existing
  // weights so there's nothing to surface).
  const [autoAdjustHint, setAutoAdjustHint] = useState<{ takenFrom: string; amount: number } | null>(null);
  useEffect(() => {
    if (!autoAdjustHint) return;
    const timer = setTimeout(() => setAutoAdjustHint(null), 3000);
    return () => clearTimeout(timer);
  }, [autoAdjustHint]);
  const serializeCustomRows = (rows: Array<{ ticker: string; weight: number }>) =>
    rows
      .filter((row) => row.ticker)
      .map((row) => `${row.ticker}:${Math.round(Number(row.weight) || 0)}`)
      .join("|");
  const customChanged = serializeCustomRows(customRows) !== serializeCustomRows(initialCustomRows);
  const hasChanged = selected !== (currentStrategy === "auto_invest" ? "growth" : currentStrategy) || (selected === "custom" && customChanged);
  const totalCustom = customRows.reduce((sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0), 0);
  const customTickerSet = new Set(customRows.map((row) => row.ticker).filter(Boolean));
  const customHasDuplicates = customTickerSet.size !== customRows.filter((row) => row.ticker).length;
  // Strict 100% enforcement. Previously: save allowed any total > 0 and
  // the server silently normalized — that was a foot-gun. A parent
  // entering 50+30+20+10 = 110 expects the entered numbers to be
  // preserved; the server's normalize-to-100 turned them into
  // 45.4/27.3/18.2/9.1, which is not what they typed. Now the save is
  // disabled until total is exactly 100, with clear hints inline.
  const customValid = totalCustom === 100 && !customHasDuplicates && customRows.every((row) => row.ticker);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`/api/funds/${fund.id}/strategy`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (canceled) return;
        const strategy = data?.strategy || "growth";
        setSelected(strategy);
        if (strategy === "custom" && data?.customAllocations) {
          const normalized = Object.entries(data.customAllocations)
            .map(([ticker, weight]) => ({
              ticker,
              weight: Math.round(Number(weight || 0) * 100),
            }))
            .filter((row) => row.ticker && row.weight >= 0)
            .sort((a, b) => b.weight - a.weight);
          if (normalized.length > 0) {
            setCustomRows(normalized);
            setInitialCustomRows(normalized);
          }
        }
      } catch {
        // non-blocking
      }
    })();
    return () => {
      canceled = true;
    };
  }, [fund.id]);

  const handleSave = async () => {
    setSaving(true);
    haptic("medium");
    try {
      const res = await fetch(`/api/funds/${fund.id}/strategy`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy: selected,
          customAllocations: selected === "custom"
            ? Object.fromEntries(
                customRows
                  .filter((row) => row.ticker)
                  .map((row) => [row.ticker, row.weight]),
              )
            : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        if (selected === "custom") {
          setInitialCustomRows(customRows);
        }
        toast({ title: "Strategy updated", description: `Your fund now uses the ${STRATEGIES.find(s => s.key === selected)?.label} strategy.` });
        onSuccess();
      } else {
        toast({ title: "Could not update strategy", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not update strategy", description: "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remainingCustomOptions = CUSTOM_ALLOCATION_OPTIONS.filter(
    (option) => !customRows.some((row) => row.ticker === option.ticker),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {STRATEGIES.map((strategy) => {
          const isLocked = strategy.gated && !canUseCustom;
          return (
            <button
              key={strategy.key}
              onClick={() => {
                if (isLocked) {
                  // Tap on locked Custom now opens the FeatureWallModal
                  // instead of silently returning. Parent gets a clear
                  // explanation of what Custom unlocks + one-tap
                  // upgrade. Per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md
                  // ("contextual feature walls convert at 3-8x the
                  // rate of generic 'see pricing' links").
                  haptic("light");
                  setCustomGateWallOpen(true);
                  return;
                }
                setSelected(strategy.key);
                haptic("selection");
              }}
              disabled={false}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${
                selected === strategy.key
                  ? "border-primary bg-primary/5"
                  : isLocked
                  ? "border-border/30 opacity-60 cursor-not-allowed"
                  : "border-[hsl(var(--kiddo-border))] hover:border-[hsl(var(--kiddo-border))]/80 bg-card"
              }`}
              data-testid={`option-strategy-${strategy.key}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
                    {/* Canonical strategy emoji — matches the locked map
                        (📈 Growth · 🌿 Balanced · ⚖️ Conservative · 🎯
                        Custom). Helps the eye distinguish options at a
                        glance instead of having to read each label. */}
                    {strategy.emoji && (
                      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>{strategy.emoji}</span>
                    )}
                    {strategy.label}
                    {/* "Currently active" pill — only appears on the
                        strategy that's actually saved to the fund. Lets
                        the parent see at a glance which one is live RIGHT
                        NOW, distinct from the "selected" border state
                        which only reflects what they're about to commit. */}
                    {currentStrategy === strategy.key && (
                      <span className="rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-[hsl(var(--kiddo-evergreen))]">
                        ✓ Active
                      </span>
                    )}
                    {/* "Plus" gate pill — visible-at-a-glance signal
                        that this strategy is locked behind Kiddo+. The
                        opacity-60 + cursor-not-allowed visual cue was
                        previously the only signal; a parent had to TAP
                        to discover it was gated. The pill makes the
                        gate explicit so the lock is read before the
                        tap. Same gold-tinted register as upgrade
                        accents elsewhere on the page (matches the
                        FeatureWallModal's tier-label visual). */}
                    {isLocked && (
                      <span className="rounded-full bg-[hsl(var(--kiddo-gold)/0.15)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-[hsl(var(--kiddo-gold-ink))] inline-flex items-center gap-1">
                        🔒 Plus
                      </span>
                    )}
                    {/* Stronger "Recommended for Emma" badge — gold/cream
                        warmth (vs the previous evergreen which competed
                        with Active), bigger type, slightly more padding.
                        Only appears on the age-band-matched preset, so
                        it's a single quiet recommendation per render. */}
                    {recommendedKey === strategy.key && (
                      <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ background: "hsl(43, 75%, 55%, 0.16)", color: "hsl(43, 55%, 30%)" }}>
                        ★ Recommended{childName ? ` for ${childName}` : ""}
                      </span>
                    )}
                    {isLocked && <Lock size={12} className="text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{strategy.description}</p>
                  {strategy.bestFor && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{strategy.bestFor}</p>
                  )}
                </div>
                {selected === strategy.key && <Check size={16} className="text-primary flex-shrink-0" />}
              </div>
              {isLocked && (
                <p className="text-[11px] text-muted-foreground mt-1">Requires Kiddo+ or Family</p>
              )}
            </button>
          );
        })}
      </div>

      {activeStrategy.allocations.length > 0 && (
        <div className="space-y-3">
          <p className="kiddo-section-label">Where gifts go</p>
          <div className="flex h-3 rounded-full overflow-hidden">
            {activeStrategy.allocations.map((a) => (
              <div
                key={a.ticker}
                style={{ width: `${a.weight}%`, backgroundColor: a.color }}
                className="transition-all duration-300"
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {activeStrategy.allocations.map((a) => (
              <div key={a.ticker} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{a.ticker} <span className="text-muted-foreground font-normal">{a.weight}%</span></p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.name}</p>
                </div>
              </div>
            ))}
          </div>

          {managedMixInvestedValue > 0 && (() => {
            const targetMap: Record<string, number> = {};
            for (const a of activeStrategy.allocations) {
              targetMap[String(a.ticker).toUpperCase()] = (targetMap[String(a.ticker).toUpperCase()] || 0) + a.weight;
            }
            // Iterate ONLY over managed-mix target tickers. Previously we
            // unioned with current-holdings tickers, which dragged
            // chosen-with-love positions (GOOGL, AAPL, DUOL, etc.) into the
            // rebalance view with target=0 and large positive drift — a
            // conceptual error since chosen-with-love stocks aren't part of
            // the managed-mix's contribution-based rebalancing. Per
            // project_setup_aha_habit_per_surface and the locked architecture,
            // managed mix and chosen-with-love are two separate buckets with
            // two different stories. This view is for the managed-mix story.
            const rows = Object.keys(targetMap).map((t) => {
              const target = targetMap[t];
              const current = currentAllocPct[t] ?? 0;
              return { ticker: t, target, current, diff: current - target };
            }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
            const maxDriftPts = rows.reduce((m, r) => Math.max(m, Math.abs(r.diff)), 0);
            const inLine = maxDriftPts <= 3;
            const childPossessive = childName ? `${childName}'s mix` : "Managed mix";
            return (
              <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="kiddo-section-label">
                    Today vs target
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {inLine ? "On target" : `${maxDriftPts.toFixed(0)} pts off`}
                  </span>
                </div>
                {/* Context line: which slice of the fund this drift view is
                    about. The "% of total fund" framing is important because
                    the managed-mix percentages below sum to 100% within the
                    managed-mix subset (NOT within the whole fund), so the
                    parent needs to know they're looking at the managed-mix
                    story, not their whole portfolio. */}
                {investedValue > 0 && managedMixShareOfFund > 0 && managedMixShareOfFund < 100 && (
                  <p className="text-[10px] text-muted-foreground/75 leading-snug -mt-1">
                    {childPossessive} is {managedMixShareOfFund}% of the whole fund. The other {100 - managedMixShareOfFund}% is in Chosen with Love (no targets).
                  </p>
                )}
                <div className="space-y-1.5">
                  {rows.map((r) => {
                    const sign = r.diff > 0.5 ? "+" : r.diff < -0.5 ? "-" : "";
                    const driftAbs = Math.abs(r.diff);
                    const driftLabel = driftAbs < 0.5 ? "on target" : `${sign}${driftAbs.toFixed(0)} pts`;
                    const driftColor =
                      driftAbs < 0.5
                        ? "text-muted-foreground"
                        : r.diff > 0
                          ? "text-[hsl(var(--kiddo-evergreen))]"
                          : "text-amber-700";
                    return (
                      <div key={r.ticker} className="grid grid-cols-[44px_1fr_auto] items-center gap-2 text-[11px]">
                        <span className="font-semibold text-foreground tabular-nums">{r.ticker}</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-foreground tabular-nums">{r.current.toFixed(0)}%</span>
                          <span className="text-muted-foreground/60">→</span>
                          <span className="text-muted-foreground tabular-nums">{r.target.toFixed(0)}%</span>
                        </div>
                        <span className={`tabular-nums ${driftColor}`}>{driftLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                  {inLine
                    ? `${childPossessive} matches the target today.`
                    : "We don't sell to rebalance. Every sale is a taxable event. Future ETF gifts are weighted toward the underweight side here until the mix lands on target. (Chosen with Love stocks are separate and aren't rebalanced.)"}
                </p>
              </div>
            );
          })()}

          {/* Hypothetical projection range, calibrated to the child's actual time horizon
              (sigma scales by 1/sqrt(years)). Always paired with the standard disclaimer. */}
          {(() => {
            const range = projectionRangeForStrategy(activeStrategy as any, yearsTo18);
            if (!range || yearsTo18 == null) return null;
            const horizonLabel = yearsTo18 < 1 ? `${Math.max(1, Math.round(yearsTo18 * 12))}-month` : `${Math.round(yearsTo18)}-year`;
            const horizonText = yearsTo18 < 1 ? horizonLabel : `${horizonLabel} annualized`;
            const fmt = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
            return (
              <div className="rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.04)] border border-[hsl(var(--kiddo-border))] p-4 space-y-2">
                <p className="kiddo-section-label">
                  Projected {horizonText} return{childName ? ` for ${childName}` : ""}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Low</p>
                    <p className={`font-heading text-base font-bold tabular-nums ${range.low < 0 ? "text-red-600" : "text-foreground"}`}>{fmt(range.low)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Average</p>
                    <p className="font-heading text-base font-bold tabular-nums text-[hsl(var(--kiddo-evergreen))]">{fmt(range.avg)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">High</p>
                    <p className="font-heading text-base font-bold tabular-nums text-foreground">{fmt(range.high)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  Projections are hypothetical and based on historical market data. Past performance does not guarantee future results. Investing involves risk. But so does a gift card.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {selected === "custom" && canUseCustom && (
        <div className="space-y-3">
          <p className="kiddo-section-label">Custom ETF mix</p>
          {/* Section-level explanation — once. The "ETFs only" framing
              previously appeared four times on this screen (header, badge,
              two body sentences). Once is enough; the constraint is also
              enforced server-side via CUSTOM_STRATEGY_ALLOWED_TICKERS,
              so copy and code agree. Individual stocks live in Chosen
              with Love (one-time contributions or recurring picks). */}
          <p className="text-[11.5px] text-muted-foreground/85 leading-relaxed -mt-1">
            Pick the ETFs and weights for {fund?.recipientFirstName ? `${fund.recipientFirstName}'s` : "your child's"} managed mix.
            Up to {MAX_CUSTOM_HOLDINGS} holdings. Want a specific stock like Apple or Disney instead? That goes in <span className="font-semibold">Chosen with Love</span>.
          </p>

          {/* Stacked-mix visualization. Same shape as the live-fund
              allocation pie / strategy-card mini-bars, kept consistent
              across the screen. Each segment is a holding, colored by
              the CUSTOM_ALLOCATION_OPTIONS color map, width
              proportional to its weight. Holdings at 0% don't render
              (they're not in the mix yet). The bar is the single
              best at-a-glance signal for whether the mix totals 100%:
              if it's full, you're at 100; if it's short, the empty
              space tells you exactly how much is missing. Numbers
              alone (50+25+15+10=?) require mental math; the bar
              doesn't. */}
          {(() => {
            const segments: Array<{ ticker: string; weight: number; color: string }> = [];
            for (const row of customRows) {
              const opt = CUSTOM_ALLOCATION_OPTIONS.find((o) => o.ticker === row.ticker);
              if (opt && row.weight > 0) {
                segments.push({ ticker: row.ticker, weight: row.weight, color: opt.color });
              }
            }
            const renderedTotal = Math.min(100, totalCustom);
            return (
              <div className="space-y-1.5">
                <div
                  className="relative h-6 w-full overflow-hidden rounded-full border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream))]"
                  role="img"
                  aria-label={`Mix total ${totalCustom}%`}
                  data-testid="custom-mix-stacked-bar"
                >
                  <div className="absolute inset-0 flex">
                    {segments.map((seg, i) => (
                      <div
                        key={`${seg.ticker}-${i}`}
                        title={`${seg.ticker} · ${seg.weight}%`}
                        style={{
                          width: `${(seg.weight / 100) * 100}%`,
                          background: seg.color,
                        }}
                      />
                    ))}
                    {/* Fill the remainder when total < 100. Visible empty
                        space communicates "this much is missing." */}
                    {renderedTotal < 100 && (
                      <div
                        style={{ width: `${100 - renderedTotal}%` }}
                        className="bg-transparent"
                      />
                    )}
                  </div>
                  {/* Overflow indicator: when total > 100, show a thin
                      red stripe at the right edge as a visual warning.
                      Real fix is the save-button gate + the total
                      hint below, but a glance-level signal helps. */}
                  {totalCustom > 100 && (
                    <div className="absolute inset-y-0 right-0 w-1 bg-red-500" aria-hidden />
                  )}
                </div>
              </div>
            );
          })()}

          <div className="space-y-2">
            {customRows.map((row, index) => {
              const currentOption = CUSTOM_ALLOCATION_OPTIONS.find((option) => option.ticker === row.ticker);
              const selectableOptions = [
                ...(currentOption ? [currentOption] : []),
                ...remainingCustomOptions,
              ];
              return (
                <div key={`${row.ticker}-${index}`} className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Holding {index + 1}</p>
                    {customRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          haptic("selection");
                          // Auto-redistribute on remove: hand the removed
                          // weight back to the remaining holdings,
                          // proportional to their existing weights. So
                          // removing BND (15%) from 50/25/15/10 returns
                          // to the largest first, keeping the mix at
                          // 100% without forcing the parent to manually
                          // re-balance. Edge case: if all remaining are
                          // 0, distribute evenly. Always rounded to
                          // whole percents; any rounding leftover goes
                          // to the largest remaining holding so the
                          // total stays exactly 100.
                          setCustomRows((prev) => {
                            const removed = prev[index];
                            const remaining = prev.filter((_, i) => i !== index);
                            if (remaining.length === 0) return remaining;
                            const removedWeight = Number.isFinite(removed?.weight) ? removed.weight : 0;
                            if (removedWeight <= 0) return remaining;
                            const remainingTotal = remaining.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
                            const adjusted = remaining.map((r) => {
                              const share = remainingTotal > 0
                                ? (r.weight / remainingTotal) * removedWeight
                                : removedWeight / remaining.length;
                              return { ...r, weight: r.weight + Math.round(share) };
                            });
                            // Reconcile rounding so total is exactly 100.
                            const adjustedTotal = adjusted.reduce((s, r) => s + r.weight, 0);
                            const delta = (prev.reduce((s, r) => s + r.weight, 0)) - adjustedTotal;
                            if (delta !== 0 && adjusted.length > 0) {
                              const largestIdx = adjusted.reduce((mi, r, i) => r.weight > adjusted[mi].weight ? i : mi, 0);
                              adjusted[largestIdx] = { ...adjusted[largestIdx], weight: Math.max(0, adjusted[largestIdx].weight + delta) };
                            }
                            return adjusted;
                          });
                        }}
                        className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                        data-testid={`button-remove-custom-holding-${index}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {/* Logo + select + weight, all in one row. Logo is the
                      brand-identification visual (Vanguard for VTI/VXUS/BND/
                      VGT/VUG/VYM, BlackRock for SCHD, Invesco for QQQ).
                      Same StockLogo used on every other ticker-rendering
                      surface across the parent app — keeps the visual
                      vocabulary consistent. The native <select> can't
                      contain a logo, so the logo lives outside it as a
                      leading visual that updates as the dropdown changes. */}
                  <div className="grid grid-cols-[28px_minmax(0,1fr)_92px] gap-2 items-center">
                    <StockLogo ticker={row.ticker} size={28} />
                    <select
                      value={row.ticker}
                      onChange={(e) => {
                        const nextTicker = e.target.value;
                        setCustomRows((prev) =>
                          prev.map((entry, rowIndex) =>
                            rowIndex === index ? { ...entry, ticker: nextTicker } : entry,
                          ),
                        );
                      }}
                      className="h-10 rounded-md border border-border px-2 text-sm bg-background"
                      data-testid={`select-custom-holding-${index}`}
                    >
                      {selectableOptions.map((option) => (
                        <option key={option.ticker} value={option.ticker}>
                          {option.ticker} · {option.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={row.weight}
                        onChange={(e) => {
                          const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                          setCustomRows((prev) =>
                            prev.map((entry, rowIndex) =>
                              rowIndex === index ? { ...entry, weight: next } : entry,
                            ),
                          );
                        }}
                        className="w-full h-10 rounded-md border border-border px-2 text-sm bg-background"
                        data-testid={`input-custom-holding-weight-${index}`}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {customRows.length < MAX_CUSTOM_HOLDINGS && remainingCustomOptions.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const nextOption = remainingCustomOptions[0];
                  if (!nextOption) return;
                  haptic("selection");
                  // Auto-adjust on add. Previous behavior: append at 0%
                  // weight. That made adding a holding meaningless — the
                  // parent had to manually re-do math (subtract from
                  // existing holdings, give to the new one, ensure
                  // total stays 100). Now: take from the largest
                  // existing holding, give to the new one. Default
                  // take = 10% (or the gap to 100% if the mix is
                  // currently below 100%, whichever is smaller). The
                  // largest holding's input visibly updates so the
                  // parent can see exactly what was moved.
                  //
                  // Logic:
                  //   - If current total < 100: new holding gets the
                  //     gap, capped at 25% (so a single add doesn't
                  //     dominate). Existing holdings unchanged.
                  //   - If current total == 100: take 10% from the
                  //     largest (clamped to half its current value
                  //     so the largest doesn't drop to 0). The new
                  //     holding gets that amount.
                  //   - If current total > 100: degenerate state;
                  //     append at 0% and let the parent rebalance
                  //     manually. The save button is already
                  //     disabled in this case so the visual hint
                  //     directs them to fix the total before
                  //     adding more.
                  setCustomRows((prev) => {
                    const total = prev.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
                    if (total < 100) {
                      const gap = 100 - total;
                      const newWeight = Math.min(gap, 25);
                      return [...prev, { ticker: nextOption.ticker, weight: newWeight }];
                    }
                    if (total === 100 && prev.length > 0) {
                      const largestIdx = prev.reduce((mi, r, i) => r.weight > prev[mi].weight ? i : mi, 0);
                      const largestWeight = prev[largestIdx].weight;
                      const take = Math.min(10, Math.max(1, Math.floor(largestWeight / 2)));
                      const next = prev.map((r, i) =>
                        i === largestIdx ? { ...r, weight: r.weight - take } : r,
                      );
                      // Surface a brief caption so the parent sees what
                      // moved. Without this, the largest weight silently
                      // dropping looks like a bug. The hint auto-fades
                      // in 3 seconds via the useEffect above.
                      setAutoAdjustHint({ takenFrom: prev[largestIdx].ticker, amount: take });
                      return [...next, { ticker: nextOption.ticker, weight: take }];
                    }
                    return [...prev, { ticker: nextOption.ticker, weight: 0 }];
                  });
                }}
                data-testid="button-add-custom-holding"
              >
                Add another holding
              </Button>
            )}
            {/* Escape hatch when the mix is messy. Splits 100% evenly
                across all current holdings, rounded to whole percents
                (rounding leftover goes to the first holding). Quick
                "I gave up dialing this in" rescue without forcing the
                parent to delete and re-add everything. */}
            {customRows.length > 1 && totalCustom !== 100 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  haptic("selection");
                  setCustomRows((prev) => {
                    if (prev.length === 0) return prev;
                    const base = Math.floor(100 / prev.length);
                    const leftover = 100 - (base * prev.length);
                    return prev.map((r, i) => ({ ...r, weight: base + (i === 0 ? leftover : 0) }));
                  });
                }}
                data-testid="button-balance-evenly"
              >
                Balance evenly
              </Button>
            )}
          </div>

          {/* Auto-adjust transparency caption. Surfaces briefly (3s)
              after the add-handler's "take from largest" path fires
              so the parent sees exactly which holding gave up weight.
              Without this caption, the parent watches VTI silently
              drop from 50% to 40% when they add VUG and could
              reasonably read it as a bug. Calm informational tone;
              auto-fades via the useEffect on autoAdjustHint. */}
          {autoAdjustHint && (
            <div
              className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-3 py-2 text-[11px] text-[hsl(var(--kiddo-evergreen))]"
              data-testid="custom-mix-auto-adjust-hint"
              aria-live="polite"
            >
              Adjusted from {autoAdjustHint.takenFrom} (−{autoAdjustHint.amount}%) to make room for the new holding.
            </div>
          )}

          {/* Total line. Concrete + color-coded. Replaces the previous
              "we normalize these weights automatically when saved" hint,
              which was misleading — parents typing 50+30+20+10=110
              expected those numbers preserved, but the server quietly
              normalized to 45.5/27.3/18.2/9.1. Now the save button is
              disabled until the total is exactly 100, with explicit
              guidance on how to get there. */}
          <div
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
              customHasDuplicates
                ? "border border-red-200 bg-red-50 text-red-700"
                : totalCustom === 100
                  ? "border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.06)] text-[hsl(var(--kiddo-evergreen))]"
                  : "border border-amber-200 bg-amber-50 text-amber-900"
            }`}
            data-testid="custom-mix-total"
          >
            <span className="font-semibold tabular-nums">Total: {totalCustom.toFixed(0)}%</span>
            <span>
              {customHasDuplicates
                ? "Each holding must be unique"
                : totalCustom === 100
                  ? "Ready to save"
                  : totalCustom < 100
                    ? `Need ${(100 - totalCustom).toFixed(0)}% more to save`
                    : `Over by ${(totalCustom - 100).toFixed(0)}% — reduce somewhere`}
            </span>
          </div>
        </div>
      )}

      {hasChanged && selected !== currentStrategy && investedValue > 0 && (() => {
        const prevStrategy = STRATEGIES.find((s) => s.key === currentStrategy);
        const nextStrategy = STRATEGIES.find((s) => s.key === selected);
        const newLabel = nextStrategy?.label || "the new mix";
        const formattedInvested = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(investedValue);
        const who = childName || "your child";
        return (
          <div
            className="rounded-xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.06)] p-3 space-y-2"
            data-testid="strategy-switch-disclosure"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--kiddo-gold-ink))]">
              What changes
            </p>
            {/* Mutation clarity — locked rule per feedback_mutation_clarity.
                Parent surfaces show before → after on portfolio mutations.
                Mirrors the Activity-feed pattern at fund_strategy_changed
                (Activity.tsx ~line 2509) so the same diff shape appears at
                BOTH the commit moment (here) AND the historical record
                (there). Gold-bordered ribbon already signals "you're about
                to change something"; the diff makes the change explicit. */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-background border border-border/70 px-2.5 py-0.5 text-muted-foreground">
                <span aria-hidden>{prevStrategy?.emoji || "•"}</span>
                <span className="font-semibold">{prevStrategy?.label || "Current"}</span>
              </span>
              <span className="text-muted-foreground/60" aria-hidden>→</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--kiddo-gold)/0.12)] border border-[hsl(var(--kiddo-gold)/0.35)] px-2.5 py-0.5 text-[hsl(var(--kiddo-gold-ink))]">
                <span aria-hidden>{nextStrategy?.emoji || "•"}</span>
                <span className="font-bold">{newLabel}</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-foreground">
              {who}'s existing {formattedInvested} stays invested as it is. New gifts and recurring investments will follow the {newLabel} from now on.
            </p>
            {/* Em-dash removed (feedback_no_emdash). Orphan-holding consequence
                added: previously the copy implied existing positions stay
                untouched, but a parent reading it could reasonably wonder
                whether their VGT (say) keeps growing as new money arrives.
                It doesn't — new money flows into the new mix only. The
                orphan position holds steady at its current value, never
                added to and never sold. Worth saying explicitly so the
                parent isn't surprised three months later. */}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              We don't sell holdings to switch. Every sale would be a taxable event for {who}. Holdings that aren't in the new mix stay where they are. We won't add to them or sell them. The new mix drifts toward target as fresh gifts arrive.
            </p>
          </div>
        );
      })()}

      {hasChanged && (
        <Button
          className="w-full"
          disabled={saving || (selected === "custom" && !customValid)}
          onClick={handleSave}
          data-testid="button-save-strategy"
        >
          {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
          {selected !== currentStrategy && investedValue > 0
            ? `Switch future gifts to ${STRATEGIES.find((s) => s.key === selected)?.label || "this mix"}`
            : "Save Strategy"}
        </Button>
      )}

      {/* Locked-Custom upgrade wall. Opens when a free user taps the
          Custom strategy option (which is gated on Plus / Family /
          Legacy). Per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md the
          interruption point is the moment of felt-need — the parent
          just tried to use Custom and got blocked. Modal explains
          what they're unlocking + one-tap upgrade. fundId is
          passed in the upgradePath so the Stripe checkout fires
          for THIS specific fund. */}
      <FeatureWallModal
        open={customGateWallOpen}
        onClose={() => setCustomGateWallOpen(false)}
        featureId="custom_fund_mix"
        requiredTier="plus"
        title="Custom fund mix is a Kiddo+ feature."
        body={`Pick the ETFs and weights for ${fund?.recipientFirstName ? `${fund.recipientFirstName}'s` : "your child's"} managed mix. Choose your own blend instead of one of the three preset strategies. Plus also unlocks recurring investments, photo/video Memory Book entries, and co-parent access.`}
        upgradePath={fund?.id ? `/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fund.id)}` : "/account?tab=plan"}
      />
    </div>
  );
}

// Tax section for kid-owners (post age-18 handoff). Per
// AGE_18_HANDOFF_SPEC.md bucket 3 — completes the "I have a job"
// toggle wiring beyond the walkthrough screen 4, surfaces the
// estimated-income bracket as updatable, and offers the Roth IRA
// waiting-list opt-in. Hidden entirely for parents (the section
// only fetches when isKidOwner = true).
function KidOwnerTaxSection() {
  type TaxProfile = {
    isKidOwner: boolean;
    hasEarnedIncome: boolean;
    estimatedIncomeBracket: string | null;
    firstSellCompletedAt: string | null;
    rothIraInterestAt: string | null;
  };
  const [, navigate] = useLocation();
  const { data, refetch } = useQuery<TaxProfile>({
    queryKey: ["/api/me/tax-profile"],
    queryFn: async () => {
      const res = await fetch("/api/me/tax-profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tax profile");
      return res.json();
    },
  });
  const [busy, setBusy] = useState(false);

  if (!data || !data.isKidOwner) return null;

  const updateEarnedIncome = async (hasIncome: boolean, bracket: string | null) => {
    setBusy(true);
    try {
      await fetch("/api/users/me/earned-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hasEarnedIncome: hasIncome,
          estimatedIncomeBracket: bracket,
        }),
      });
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  const toggleRothInterest = async () => {
    setBusy(true);
    try {
      const next = !data.rothIraInterestAt;
      await fetch("/api/users/me/roth-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ interested: next }),
      });
      await refetch();
      toast({
        title: next ? "You're on the list" : "Removed from waiting list",
        description: next
          ? "We'll email you when Roth IRA contributions are available in Kiddo."
          : "You can opt back in any time.",
      });
    } finally {
      setBusy(false);
    }
  };

  const bracket = data.estimatedIncomeBracket;
  const hasIncome = data.hasEarnedIncome;

  return (
    <>
      <SectionDivider label="Tax" />

      <SectionCard>
        <div className="p-5 space-y-3">
          <div>
            <p className="text-sm font-bold text-foreground">Do you have a job?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We use this to estimate taxes when you sell and to enable Roth IRA features later.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => updateEarnedIncome(true, bracket)}
              className={`rounded-xl border-2 py-2 px-3 text-sm font-medium transition-colors ${
                hasIncome
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-foreground/70 hover:border-foreground/30"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => updateEarnedIncome(false, null)}
              className={`rounded-xl border-2 py-2 px-3 text-sm font-medium transition-colors ${
                !hasIncome
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-foreground/70 hover:border-foreground/30"
              }`}
            >
              Not yet
            </button>
          </div>
          {hasIncome && (
            <div className="pt-2 space-y-2">
              <p className="text-xs text-muted-foreground">Roughly your yearly income:</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "0_45", label: "Under $45k" },
                  { val: "45_100", label: "$45k to $100k" },
                  { val: "100_plus", label: "Over $100k" },
                ].map((b) => (
                  <button
                    key={b.val}
                    type="button"
                    disabled={busy}
                    onClick={() => updateEarnedIncome(true, b.val)}
                    className={`rounded-xl border-2 py-2 px-2 text-xs font-medium transition-colors ${
                      bracket === b.val
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-foreground/70 hover:border-foreground/30"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {hasIncome && (
        <SectionCard>
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Roth IRA setup</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every dollar you earn at a job, you can put up to that much into a Roth IRA.
                  Growth comes out tax-free at 59.5. We're working on adding this to Kiddo.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={toggleRothInterest}
                className={`shrink-0 rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${
                  data.rothIraInterestAt
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground/70 hover:border-foreground/30"
                }`}
              >
                {data.rothIraInterestAt ? "On list" : "Notify me"}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="p-5 space-y-2">
          <p className="text-sm font-bold text-foreground">Tax documents</p>
          <p className="text-xs text-muted-foreground">
            Your 1099 forms and a plain-English explainer of what they mean.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => navigate("/tax-documents")}
          >
            Open tax docs
          </Button>
        </div>
      </SectionCard>
    </>
  );
}

export default function Settings() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const VALID_TABS = ["child", "gifts", "membership", "notifications", "money"] as const;
  const [settingsTab, setSettingsTab] = useState<"child" | "gifts" | "membership" | "notifications" | "money">(() => {
    const tab = new URLSearchParams(search || "").get("tab");
    return (VALID_TABS as readonly string[]).includes(tab ?? "") ? (tab as any) : "child";
  });
  const [addFundOpen, setAddFundOpen] = useState(false);
  const [sellHoldingOpen, setSellHoldingOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any>(null);
  const [selectedFundForAction, setSelectedFundForAction] = useState<any>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [linkBankOpen, setLinkBankOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [collabFundId, setCollabFundId] = useState<string>("");
  const [editFundOpen, setEditFundOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<any>(null);
  const [uploadingChildPhoto, setUploadingChildPhoto] = useState(false);
  const childPhotoInputRef = useRef<HTMLInputElement>(null);
const [editFundName, setEditFundName] = useState("");
  const [editRecipientName, setEditRecipientName] = useState("");
  const [editRecipientBirthdate, setEditRecipientBirthdate] = useState("");
  const [editPronoun, setEditPronoun] = useState<string>("they");
  const [savingFundEdit, setSavingFundEdit] = useState(false);
  const [selectedSettingsFundId, setSelectedSettingsFundId] = useState<string>(() => getActiveFundId() || "");
  const [settingsFundMenuOpen, setSettingsFundMenuOpen] = useState(false);
  const settingsFundMenuRef = useRef<HTMLDivElement | null>(null);
  // Co-parent invite FeatureWallModal — fires when a free user
  // taps Invite. The invite section's Plus-gate explainer card
  // (rendered below the section header) is kept on purpose; the
  // wall fires only as a deliberate tap-driven interaction so
  // free users who just want to read the explainer don't get a
  // modal in their face on every Settings load.
  const [coParentWallOpen, setCoParentWallOpen] = useState(false);
  const [parentLifecycleSettings, setParentLifecycleSettings] = useState<{
    activationNudges: boolean;
    milestoneEmails: boolean;
    birthdayDormantReminders: boolean;
  }>(() => {
    const defaults = {
      activationNudges: true,
      milestoneEmails: true,
      birthdayDormantReminders: true,
    };
    if (typeof window === "undefined") return defaults;
    try {
      return { ...defaults, ...JSON.parse(window.localStorage.getItem("kiddo-parent-lifecycle-settings") || "{}") };
    } catch {
      return defaults;
    }
  });

  const queryClient = useQueryClient();

  // Idle-time prefetch of next-likely pages so Settings → Dashboard /
  // Memory Book / Activity render from cache. Symmetric with Dashboard,
  // MemoryBook, and Activity. Uses the stored active fund id for the
  // fund-scoped queries.
  useEffect(() => {
    if (authLoading || !user) return;
    const activeFundId = getActiveFundId();
    const cancel = onIdle(() => {
      prefetchDashboard(queryClient, activeFundId);
      if (activeFundId) prefetchMemoryBook(queryClient, activeFundId);
      prefetchActivity(queryClient, 50);
    });
    return cancel;
  }, [authLoading, user, queryClient]);

  const { data: funds = [] } = useQuery<any[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      writeLocalCache(LOCAL_CACHE_KEYS.funds, data);
      return data;
    },
    enabled: !!user,
    initialData: () => readLocalCache<any[]>(LOCAL_CACHE_KEYS.funds),
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  const { data: kycData } = useQuery<any>({
    queryKey: ["/api/user/kyc-status"],
    queryFn: async () => {
      const res = await fetch("/api/user/kyc-status", { credentials: "include" });
      if (!res.ok) return { kycStatus: "none" };
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const primaryFund = (selectedSettingsFundId && funds.find((f: any) => String(f.id) === String(selectedSettingsFundId))) || funds[0];

  const { data: holdingsData = [] } = useQuery<any[]>({
    queryKey: ["/api/funds", primaryFund?.id, "holdings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${primaryFund.id}/holdings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!primaryFund,
    staleTime: 60_000,
  });

  // Invitations TO this user — funds where someone else has invited
  // them to co-parent / view. Separate from the `collaborators` query
  // above, which is the inverse (invites the current user has SENT).
  const { data: pendingInvitations = [] } = useQuery<any[]>({
    queryKey: ["/api/me/invitations"],
    queryFn: async () => {
      const res = await fetch(`/api/me/invitations`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: collaborators = [] } = useQuery<any[]>({
    queryKey: ["/api/funds", primaryFund?.id, "collaborators"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${primaryFund.id}/collaborators`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!primaryFund,
    staleTime: 60_000,
  });

  const { data: kidViewSettings, refetch: refetchKidViewSettings } = useQuery<any>({
    queryKey: ["/api/funds", primaryFund?.id, "kid-view-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${primaryFund.id}/kid-view-settings`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!primaryFund && settingsTab === "child",
    staleTime: 30_000,
  });

  // Close-fund + reopen state. Modal-driven, optional reason captured
  // for the audit trail (never required to close — anti-dark-pattern).
  // See policies/cancellation_dark_pattern_avoidance + the close-fund
  // memory file for the standing principles.
  const [closeFundOpen, setCloseFundOpen] = useState(false);
  const [closeFundReason, setCloseFundReason] = useState("");
  const [closingFund, setClosingFund] = useState(false);
  const [reopeningFund, setReopeningFund] = useState(false);

  const handleCloseFund = async () => {
    if (!primaryFund?.id) return;
    setClosingFund(true);
    try {
      const res = await fetch(`/api/funds/${primaryFund.id}/close`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: closeFundReason.trim() || null }),
      });
      if (!res.ok) throw new Error("close failed");
      const data = await res.json().catch(() => ({}));
      haptic("success");
      const childName = primaryFund.recipientFirstName || "this fund";
      toast({
        title: `${childName}'s fund is closed`,
        description: data.canceledContribCount > 0
          ? `Recurring investments canceled (${data.canceledContribCount}). Memory Book is preserved. Reopen anytime.`
          : "Memory Book is preserved. Reopen anytime.",
      });
      setCloseFundOpen(false);
      setCloseFundReason("");
      await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    } catch {
      haptic("error");
      toast({ title: "Couldn't close fund", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setClosingFund(false);
    }
  };

  const handleReopenFund = async () => {
    if (!primaryFund?.id) return;
    setReopeningFund(true);
    try {
      const res = await fetch(`/api/funds/${primaryFund.id}/reopen`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("reopen failed");
      haptic("success");
      const childName = primaryFund.recipientFirstName || "This fund";
      toast({ title: `${childName}'s fund is back`, description: "The gift link is live again." });
      await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    } catch {
      haptic("error");
      toast({ title: "Couldn't reopen fund", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setReopeningFund(false);
    }
  };

  const fundIsClosed = String((primaryFund as any)?.status || "").toLowerCase() === "closed";

  // Recurring investments for the Money tab summary card. Endpoint
  // returns 403 when user is on the Free plan (no recurring privileges)
  // — that's fine, the .catch makes it return [] and the summary card
  // renders the empty/upsell state. See Settings audit notes for why
  // this surface exists in Money tab even though the canonical
  // management UI lives on the Dashboard.
  const { data: recurringContributions = [] } = useQuery<Array<{ id: string; amount: string; frequency: string; status: string; nextRunDate?: string | null }>>({
    queryKey: ["/api/funds", primaryFund?.id, "parent-contributions"],
    queryFn: async () => {
      if (!primaryFund?.id) return [];
      const res = await fetch(`/api/funds/${primaryFund.id}/parent-contributions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!primaryFund?.id && settingsTab === "money",
    staleTime: 30_000,
  });

  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { data: shareSummary } = useQuery<any>({
    queryKey: ["/api/funds", primaryFund?.id, "dashboard-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${primaryFund.id}/dashboard-summary`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!primaryFund?.id,
    staleTime: 30_000,
  });

  const sharePages: SharePage[] = useMemo(() => {
    if (!primaryFund?.slug) return [];
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const giftCode = shareSummary?.giftCode?.code as string | undefined;
    const eventCodes = (shareSummary?.eventGiftCodes ?? {}) as Record<string, { code?: string }>;
    const events: any[] = Array.isArray(shareSummary?.events) ? shareSummary.events : [];
    const pages: SharePage[] = [{
      label: `${primaryFund.recipientFirstName || primaryFund.name}'s gift link`,
      description: "Always-on gift link",
      url: `${origin}/${primaryFund.slug}`,
      giftCode,
      isPermanent: true,
    }];
    for (const event of events) {
      if (!event?.slug) continue;
      if (event.isPermanent) continue;
      if (String(event.status || "active") !== "active") continue;
      pages.push({
        label: event.name,
        url: `${origin}/${primaryFund.slug}/${event.slug}`,
        giftCode: eventCodes[event.id]?.code,
        themeId: (event as any).theme || undefined,
      });
    }
    return pages;
  }, [primaryFund?.slug, primaryFund?.recipientFirstName, primaryFund?.name, shareSummary?.giftCode?.code, shareSummary?.eventGiftCodes, shareSummary?.events]);

  const [copyingKidLink, setCopyingKidLink] = useState(false);
  const [showPinManager, setShowPinManager] = useState(false);

  useEffect(() => {
    if (kidViewSettings && !kidViewSettings.hasPin) {
      setShowPinManager(true);
    }
  }, [kidViewSettings]);
  const [newPin, setNewPin] = useState("");
  const [newPinHint, setNewPinHint] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const handleSavePin = async () => {
    if (!primaryFund?.id) return;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({ title: "PIN must be exactly 4 digits", variant: "destructive" });
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch(`/api/funds/${primaryFund.id}/kid-view-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: true, pin: newPin, pinHint: newPinHint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save PIN.");
      haptic("success");
      toast({ title: "PIN saved", description: "Kid's View is active with the new PIN." });
      setNewPin("");
      setNewPinHint("");
      setShowPinManager(false);
      void refetchKidViewSettings();
    } catch (err: any) {
      haptic("error");
      toast({ title: "Could not save PIN", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingPin(false);
    }
  };

  const handleCopyKidViewLink = async () => {
    if (!primaryFund?.id) return;
    setCopyingKidLink(true);
    try {
      const res = await fetch(`/api/funds/${primaryFund.id}/kid-view-link`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Kid View is not set up yet.");
      await navigator.clipboard.writeText(data.shareLink);
      haptic("success");
      toast({ title: "Kid View link copied!", description: "Share this link and PIN with your child." });
      void refetchKidViewSettings();
    } catch (err: any) {
      haptic("error");
      toast({ title: "Could not copy link", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setCopyingKidLink(false);
    }
  };

  const { data: subscription } = useSubscription();
  // Gifter notifications query follows the global active fund via the
  // existing `selectedSettingsFundId` state — that one is initialized from
  // `getActiveFundId()` and listens for `ACTIVE_FUND_CHANGE_EVENT`, so
  // switching funds in AppHeader's picker reaches this section without a
  // separate selector. Previously this used a duplicate
  // `selectedNotificationFundId` state that defaulted to `funds[0]`,
  // which silently pinned the gifter-subscribers card to the wrong
  // fund — `0 people opted in` when subscribers actually existed on the
  // user's active fund. (Same anti-pattern we removed from the
  // Notifications panel chip strip.)
  const { data: gifterNotifications, isLoading: loadingGifterNotifications } = useQuery<any>({
    queryKey: ["/api/funds", selectedSettingsFundId, "gifter-notifications"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${selectedSettingsFundId}/gifter-notifications`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load gifter notifications");
      return res.json();
    },
    enabled: !!selectedSettingsFundId,
  });
  const updateGifterNotificationSettings = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const res = await fetch(`/api/funds/${selectedSettingsFundId}/gifter-notifications/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save settings");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Your gifter notification preferences were updated." });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds", selectedSettingsFundId, "gifter-notifications"] });
    },
    onError: (error: any) => {
      toast({ title: "Could not save settings", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  // Memory Book moderation toggle. Off by default everywhere; the parent opts
  // in if they want gifter-submitted entries to land as 'pending_review'
  // instead of going live in the Memory Book immediately. The product
  // philosophy is that the loop should NOT require approval — the gift link
  // is private, the parent already has DELETE on every entry — but the
  // toggle gives the small slice of parents who want extra control a knob.
  const updateMemoryModeration = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!primaryFund?.id) throw new Error("Pick a fund first.");
      const res = await fetch(`/api/funds/${primaryFund.id}/memory-moderation`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save setting");
      return data;
    },
    // Optimistic update — the toggle should feel instant. Previously
    // the visible state waited for the server roundtrip + the funds
    // query refetch, which introduced a noticeable delay (sometimes
    // >1s). Now we flip the cache immediately and only roll back on
    // server failure. Same pattern other toggles in this file use.
    onMutate: async (enabled: boolean) => {
      if (!primaryFund?.id) return { previous: null };
      await queryClient.cancelQueries({ queryKey: ["/api/funds"] });
      const previous = queryClient.getQueryData<any[]>(["/api/funds"]);
      if (Array.isArray(previous)) {
        queryClient.setQueryData(
          ["/api/funds"],
          previous.map((f) => (f.id === primaryFund.id ? { ...f, gifterMemoryModeration: enabled } : f)),
        );
      }
      return { previous };
    },
    onSuccess: (_data, enabled) => {
      // Pill toast per feedback_toast_pattern_locked.md — "Saved"
      // pill (1200ms, dark, rounded-full) for confirmation toasts
      // where the title alone says the result clearly. The settings
      // panel body text right next to the toggle already explains
      // what each mode means, so a description on the toast would
      // just restate what the user can already see.
      toast({
        title: enabled ? "Approval mode on" : "Approval mode off",
        variant: "saved",
        duration: 1200,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund?.id, "memory"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund?.id, "memory", "pending"] });
    },
    onError: (error: any, _enabled, context: any) => {
      // Roll back optimistic update.
      if (context?.previous) {
        queryClient.setQueryData(["/api/funds"], context.previous);
      }
      toast({ title: "Could not save setting", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });
  const [upgrading, setUpgrading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelingOverlaps, setCancelingOverlaps] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelStep, setCancelStep] = useState<"warn" | "confirm">("warn");
  // Successor custodian editor (Settings → Child tab). Pre-populated from
  // the fund record on expand; edits go through PATCH /api/funds/:id which
  // already writes the appropriate successor_custodian_* activity entry.
  const [successorEditOpen, setSuccessorEditOpen] = useState(false);
  const [successorName, setSuccessorName] = useState("");
  const [successorEmail, setSuccessorEmail] = useState("");
  const [successorRelation, setSuccessorRelation] = useState("");
  const [savingSuccessor, setSavingSuccessor] = useState(false);
  // Personalized cancellation impact — fetched only when the cancel modal is open so we
  // don't pay for the calculation on every Settings load.
  const { data: cancellationImpact } = useQuery<{
    subscribedSince: string | null;
    growthSinceSubscribed: number;
    funds: Array<{ id: string; recipientFirstName: string | null; name: string }>;
    parentContributions: Array<{ id: string; childName: string; amount: number; frequency: string; monthlyEquivalent: number; executionModel: string | null; selectedTicker: string | null }>;
    parentContributionsMonthlyTotal: number;
    recurringGifts: Array<{ id: string; childName: string; senderName: string; amount: number; frequency: string; monthlyEquivalent: number; occasionType: string | null }>;
    recurringGiftsMonthlyTotal: number;
  }>({
    queryKey: ["cancellation-impact"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/cancellation-impact", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load impact");
      return res.json();
    },
    // Fetch when the modal is open (impact preview) OR when the user is in the canceling
    // window (post-cancel banner needs the same data to enumerate what's paused).
    enabled: showCancelConfirm || (subscription?.status === "canceled"),
    staleTime: 30_000,
  });
  const [selectedStarterFundId, setSelectedStarterFundId] = useState<string>("");
  const [selectedStarterManageFundId, setSelectedStarterManageFundId] = useState<string>("");
  const [syncingBilling, setSyncingBilling] = useState(false);
  const hasAutoUpgradeTriggered = useRef(false);
  const [billingReturnNotice, setBillingReturnNotice] = useState<{
    type: "success" | "canceled";
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    const tab = new URLSearchParams(search || "").get("tab");
    if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
      setSettingsTab(tab as any);
    }
  }, [search]);

  // Phase 1c IA redirect: the Settings membership tab is no longer the
  // primary surface for plan management — Account is. When a user
  // lands on the membership tab WITHOUT actionable query params (i.e.
  // intentional navigation, not a Stripe return or deep-link from an
  // in-app upgrade CTA), redirect them to /account?tab=plan so they
  // arrive at the canonical home. Actionable params (?success=,
  // ?canceled=, ?upgrade=, ?action=) keep the user on the Settings
  // membership tab so the existing handlers (Stripe-return notice,
  // upgrade auto-trigger, cancel modal auto-open) fire correctly. Phase
  // 1c-B (future) will update server-side Stripe success URLs to point
  // at /account?tab=plan directly, at which point the actionable-params
  // guard can be loosened further and the membership tab JSX can be
  // deleted entirely. See feedback_ia_who_vs_how_principle.md.
  const hasMembershipRedirectFired = useRef(false);
  useEffect(() => {
    if (hasMembershipRedirectFired.current) return;
    if (settingsTab !== "membership") return;
    const params = new URLSearchParams(window.location.search || "");
    const hasActionableParam =
      params.has("success") ||
      params.has("canceled") ||
      params.has("upgrade") ||
      params.has("action");
    if (hasActionableParam) return;
    hasMembershipRedirectFired.current = true;
    navigate("/account?tab=plan");
  }, [settingsTab, navigate]);

  useEffect(() => {
    let canceledEffect = false;
    const params = new URLSearchParams(search || "");
    const success = params.get("success");
    const canceled = params.get("canceled");
    const fundIdFromSuccess = params.get("fundId");
    if (!success && !canceled) return;

    const run = async () => {
      try {
        if (success === "starter" || success === "family") {
          setSyncingBilling(true);
          try {
            await fetch("/api/subscription/sync-stripe", {
              method: "POST",
              credentials: "include",
            });
          } catch {
            // Best effort only; we'll still invalidate and refresh local data.
          }
        }

        if (canceledEffect) return;
        if (success === "starter") {
          const fundName = funds.find((f: any) => String(f.id) === String(fundIdFromSuccess))?.name;
          setBillingReturnNotice({
            type: "success",
            title: "Kiddo+ activated",
            description: fundName
              ? `Kiddo+ is now active for ${fundName}.`
              : "Kiddo+ is now active for your selected fund.",
          });
          toast({
            title: "Kiddo+ activated",
            description: fundName
              ? `Kiddo+ is now active for ${fundName}.`
              : "Kiddo+ is now active for your selected fund.",
          });
        } else if (success === "family") {
          setBillingReturnNotice({
            type: "success",
            title: "Kiddo Family activated",
            description: "Your account is now on Kiddo Family.",
          });
          toast({ title: "Kiddo Family activated", description: "Your account is now on Kiddo Family." });
        } else if (canceled === "true") {
          setBillingReturnNotice({
            type: "canceled",
            title: "Checkout canceled",
            description: "No changes were made to your plan.",
          });
          toast({ title: "Checkout canceled", description: "No changes were made to your plan." });
        }
      } finally {
        if (!canceledEffect) {
          void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          setSyncingBilling(false);

          params.delete("success");
          params.delete("canceled");
          params.delete("fundId");
          const nextQuery = params.toString();
          const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
          window.history.replaceState({}, "", nextUrl);
        }
      }
    };
    void run();

    return () => {
      canceledEffect = true;
    };
  }, [search, queryClient, funds]);

  useEffect(() => {
    if (!selectedStarterFundId && funds.length > 0) {
      setSelectedStarterFundId(String(funds[0].id));
    }
  }, [funds, selectedStarterFundId]);

  // (Removed: a useEffect that defaulted `selectedNotificationFundId` to
  // `funds[0].id`. That selector is now `selectedSettingsFundId`, which
  // already initializes from the global active fund and listens for
  // changes — so the gifter-subscribers card always reflects the same
  // fund the rest of the app is showing.)

  if (authLoading) {
    return (
      <div className="kiddo-app-page md:ml-[264px] flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  const isFamilySubCanceled = (subscription?.plan === "family" || subscription?.plan === "legacy") && subscription?.status === "canceled";
  const userPlan: "free" | "starter" | "family" | "legacy" = (subscription?.effectivePlan || "free") as
    | "free"
    | "starter"
    | "family"
    | "legacy";
  const starterByFund = (subscription?.starterByFund || {}) as Record<string, any>;
  const starterEligibleFunds = funds.filter((fund: any) => hasStarterEntitlement(starterByFund[String(fund.id)]));
  const hasStarterOverlap = (userPlan === "family" || userPlan === "legacy") && starterEligibleFunds.length > 0;
  const recommendationState = subscription?.recommendationState || "free";
  const planScopeChip =
    userPlan === "legacy"
      ? `Legacy applies to all funds (${funds.length})`
      : userPlan === "family"
        ? `Family applies to all funds (${funds.length})`
      : starterEligibleFunds.length > 0
        ? `Kiddo+ active on ${starterEligibleFunds.length} fund${starterEligibleFunds.length === 1 ? "" : "s"}`
        : "Funds are currently on Free rules";
  const selectedStarterMembership = selectedStarterManageFundId
    ? starterByFund[String(selectedStarterManageFundId)]
    : null;
  const selectedStarterIsCanceled =
    selectedStarterMembership?.status === "canceled" &&
    hasStarterEntitlement(selectedStarterMembership);
  const kycCompleted = kycData?.kycStatus === "approved";
  const hasBank = bankAccounts.length > 0;
  const setup = buildSetupProgress({
    fund: primaryFund || null,
    hasBank,
    hasProfile: Boolean(user?.firstName?.trim()),
  });
  const primaryFundValue = getFundTotalValue(primaryFund);
  const cachedPrimaryFundValue = useMemo(() => {
    const cachedFunds = readLocalCache<any[]>(LOCAL_CACHE_KEYS.funds) || [];
    const cachedFund =
      (selectedSettingsFundId && cachedFunds.find((fund: any) => String(fund.id) === String(selectedSettingsFundId))) ||
      cachedFunds[0];
    return cachedFund ? getFundTotalValue(cachedFund) : null;
  }, [selectedSettingsFundId]);
  const { displayValue: displayPrimaryFundValue } = useCachedFirstNumber({
    seedValue: cachedPrimaryFundValue,
    liveValue: primaryFundValue,
  });
  const selectedNotificationFund =
    (selectedSettingsFundId && funds.find((f: any) => String(f.id) === String(selectedSettingsFundId))) ||
    primaryFund;
  const notificationChildName = gifterNotifications?.childName || selectedNotificationFund?.recipientFirstName || "your child";
  const notificationSettings = gifterNotifications?.settings || {};
  const memoryBookSharesSent = Number(notificationSettings?.memoryBookSharesSentThisYear || 0);
  const notificationAgeTransition = getAge18Transition(
    selectedNotificationFund?.recipientBirthdate,
    Number((selectedNotificationFund as any)?.majorityAge) || 18,
  );
  const age18NotificationBody = !notificationAgeTransition
    ? "Final thank-you note when control passes at adulthood. Add a birthdate first."
    : notificationAgeTransition.stage === "adult"
      ? "Age-18 handoff is ready now. Review transfer steps before sending this note."
      : `Final thank-you note when control passes at adulthood. Planning anchor: ${formatAgeTransitionDate(notificationAgeTransition.eighteenthBirthday)}.`;
  const getFundValue = (fund: any) =>
    parseFloat(fund?.balance || "0") +
    parseFloat(fund?.pendingBalance || "0") +
    parseFloat(fund?.cashBalance || "0");
  const selectSettingsFund = (fund: any) => {
    setSelectedSettingsFundId(String(fund.id));
    setActiveFundId(String(fund.id));
    setSettingsFundMenuOpen(false);
    haptic("selection");
  };
  const updateParentLifecycleSetting = (key: keyof typeof parentLifecycleSettings, value: boolean) => {
    setParentLifecycleSettings((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem("kiddo-parent-lifecycle-settings", JSON.stringify(next));
      return next;
    });
  };
  const updateGifterNotificationSetting = (
    key: "birthdayReminders" | "memoryBookSharing" | "age18Notification" | "giftConfirmations",
    value: boolean,
  ) => {
    updateGifterNotificationSettings.mutate({ [key]: value });
  };
  const isUTMAFund = (fund: any) => String(fund?.accountType || "").toUpperCase() === "UTMA";
  const canBuyStarterForSelectedFund =
    !!selectedStarterFundId && !hasStarterEntitlement(starterByFund[String(selectedStarterFundId)]);

  useEffect(() => {
    if (funds.length === 0) return;
    const stored = selectedSettingsFundId || getActiveFundId();
    const nextFund = funds.find((f: any) => String(f.id) === String(stored)) || funds[0];
    if (!nextFund?.id) return;
    if (String(nextFund.id) !== selectedSettingsFundId) {
      setSelectedSettingsFundId(String(nextFund.id));
    }
    if (getActiveFundId() !== String(nextFund.id)) {
      setActiveFundId(String(nextFund.id));
    }
  }, [funds, selectedSettingsFundId]);

  useEffect(() => {
    const handleActiveFundChange = (event: globalThis.Event) => {
      const id = String((event as globalThis.CustomEvent<{ id?: string }>).detail?.id || getActiveFundId() || "");
      if (id) setSelectedSettingsFundId((current) => (current === id ? current : id));
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handleActiveFundChange);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handleActiveFundChange);
  }, []);

  useEffect(() => {
    if (!settingsFundMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!settingsFundMenuRef.current?.contains(event.target as Node)) {
        setSettingsFundMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsFundMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsFundMenuOpen]);

  useEffect(() => {
    if (starterEligibleFunds.length === 0) {
      if (selectedStarterManageFundId) setSelectedStarterManageFundId("");
      return;
    }
    const hasCurrent = starterEligibleFunds.some((f: any) => String(f.id) === String(selectedStarterManageFundId));
    if (!hasCurrent) {
      setSelectedStarterManageFundId(String(starterEligibleFunds[0].id));
    }
  }, [starterEligibleFunds, selectedStarterManageFundId]);

  const handleUpgradeFamily = async () => {
    setUpgrading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/family-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || `HTTP ${res.status}` };
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        const details = data?.details
          ? `\n${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}`
          : "";
        const fallback = res.ok ? "Could not start checkout" : `HTTP ${res.status}`;
        toast({ title: "Something went wrong", description: `${data.error || fallback}${details}`, variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  const handleUpgradeLegacy = async () => {
    setUpgrading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/legacy-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || `HTTP ${res.status}` };
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        const details = data?.details
          ? `\n${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}`
          : "";
        const fallback = res.ok ? "Could not start checkout" : `HTTP ${res.status}`;
        toast({ title: "Something went wrong", description: `${data.error || fallback}${details}`, variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  const handleUpgradeStarter = async (fundId?: string) => {
    const targetFundId = String(fundId || selectedStarterFundId || "");
    if (!targetFundId) {
      toast({ title: "Choose a fund first", description: "Kiddo+ applies to one specific fund.", variant: "destructive" });
      return;
    }
    setUpgrading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/starter-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId: targetFundId }),
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || `HTTP ${res.status}` };
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        const details = data?.details
          ? `\n${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}`
          : "";
        const fallback = res.ok ? "Could not start checkout" : `HTTP ${res.status}`;
        toast({ title: "Something went wrong", description: `${data.error || fallback}${details}`, variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  // Auto-trigger Stripe checkout when redirected here with ?upgrade=family or ?upgrade=starter&fundId=...
  useEffect(() => {
    if (hasAutoUpgradeTriggered.current) return;
    if (authLoading || !user) return;
    const params = new URLSearchParams(search || "");
    const upgrade = params.get("upgrade");
    if (!upgrade) return;
    hasAutoUpgradeTriggered.current = true;
    const fundIdParam = params.get("fundId") || "";
    params.delete("upgrade");
    params.delete("fundId");
    const nextQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    if (upgrade === "family") {
      void handleUpgradeFamily();
    } else if (upgrade === "legacy") {
      void handleUpgradeLegacy();
    } else if ((upgrade === "starter" || upgrade === "plus") && fundIdParam) {
      // `plus` aliases `starter` defensively. `starter` is the internal
      // plan name; `plus` is the user-facing one. MemoryMediaPicker and
      // any future feature-wall surface using the user-facing name now
      // routes correctly. Without the alias, `upgrade=plus` was a silent
      // dead-end: the URL landed on the membership tab but never fired
      // the Stripe checkout. See IN_APP_UPGRADE_FEATURE_WALL_SPEC.md.
      void handleUpgradeStarter(fundIdParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, user, authLoading]);

  // Auto-open the cancel-confirm modal when redirected here with
  // ?action=cancel. Added 2026-05-14 to support the inline "Cancel
  // plan" button on the Account plan-and-billing tab — per the
  // WHO/HOW IA principle, Account is the primary home of plan
  // management, but the cancellation-impact preview modal is genuinely
  // complex (itemizes what pauses, downgrade-tier dialog, two-step
  // warn → confirm) and lives here in Settings. Routing here with
  // ?action=cancel auto-opens that modal so the parent never sees
  // the Settings membership-tab chrome as an intermediate step.
  // The membership tab is selected as a side-effect because the
  // cancel modal is rendered inside this page; landing on a different
  // tab first would flash unrelated content while the modal opens.
  const hasAutoCancelTriggered = useRef(false);
  useEffect(() => {
    if (hasAutoCancelTriggered.current) return;
    if (authLoading || !user) return;
    const params = new URLSearchParams(search || "");
    const action = params.get("action");
    if (action !== "cancel") return;
    if (userPlan === "free") return; // No-op for free users.
    hasAutoCancelTriggered.current = true;
    params.delete("action");
    const nextQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    setSettingsTab("membership");
    setCancelStep("warn");
    setShowCancelConfirm(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, user, authLoading, userPlan]);

  const handleCancelSubscription = async (opts?: { plan?: "starter" | "family"; fundId?: string }) => {
    setCanceling(true);
    haptic("medium");
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts || {}),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        const until = data?.activeUntil ? new Date(data.activeUntil).toLocaleDateString() : null;
        const planLabel = data?.plan === "starter" ? "Kiddo+" : data?.plan === "family" ? "Kiddo Family" : "Your plan";
        toast({
          title: data?.alreadyCanceled ? `${planLabel} already canceling` : `${planLabel} canceled`,
          description: until ? `${planLabel} remains active until ${until}` : "Your cancellation has been scheduled.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        setShowCancelConfirm(false);
      } else {
        toast({ title: "Could not cancel", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not cancel", description: "Please try again", variant: "destructive" });
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivateSubscription = async (opts?: { plan?: "starter" | "family"; fundId?: string }) => {
    setReactivating(true);
    haptic("medium");
    try {
      const res = await fetch("/api/subscription/reactivate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts || {}),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        toast({ title: "Subscription reactivated", description: "Your plan is active again" });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      } else if (res.status === 410 && data.expired) {
        // Sub fully expired - start a new checkout instead
        toast({ title: "Subscription expired", description: "Starting a new checkout for you..." });
        if (opts?.plan === "starter" && opts?.fundId) {
          await handleUpgradeStarter(opts.fundId);
        } else {
          await handleUpgradeFamily();
        }
      } else {
        toast({ title: "Could not reactivate", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not reactivate", description: "Please try again", variant: "destructive" });
    } finally {
      setReactivating(false);
    }
  };

  const handleOpenBillingPortal = async (opts?: { plan?: "starter" | "family"; fundId?: string }) => {
    setOpeningPortal(true);
    haptic("medium");
    try {
      const res = await fetch("/api/subscription/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts || {}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Could not open billing portal", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not open billing portal", description: "Please try again", variant: "destructive" });
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleSyncBillingStatus = async () => {
    setSyncingBilling(true);
    try {
      const res = await fetch("/api/subscription/sync-stripe", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Could not refresh billing",
          description: data?.error || "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Billing refreshed", description: "Latest Stripe status synced." });
      void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    } catch {
      toast({
        title: "Could not refresh billing",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncingBilling(false);
    }
  };

  const handleCancelStarterOverlaps = async () => {
    setCancelingOverlaps(true);
    try {
      const res = await fetch("/api/subscription/cancel-starter-overlaps", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
        title: "Could not update Kiddo+ overlaps",
        description: data?.error || "Please try again.",
        variant: "destructive",
      });
        return;
      }
      toast({
        title: "Kiddo+ overlaps updated",
        description:
          Number(data?.canceledCount || 0) > 0
            ? `${Number(data.canceledCount)} Kiddo+ plan${Number(data.canceledCount) === 1 ? "" : "s"} scheduled to cancel.`
            : "No active overlapping Kiddo+ plans were found.",
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    } catch {
      toast({
        title: "Could not update starter overlaps",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancelingOverlaps(false);
    }
  };

  const eventsWithPasses = funds.flatMap((f: any) =>
    (f.events || []).filter((e: any) => e.hasEventPass)
  );

  const handleToggleDiscoverable = async (fundId: string, newValue: boolean) => {
    haptic("selection");
    const targetFund = funds.find((f: any) => String(f.id) === String(fundId));
    if (targetFund && isUTMAFund(targetFund) && newValue) {
      toast({
        title: "Children's funds stay private",
        description: "A child's fund is private by default and opens only through its gift link.",
      });
      return;
    }
    try {
      const res = await fetch(`/api/funds/${fundId}/privacy`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDiscoverable: newValue }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({} as any));
        queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        if (body?.forcedPrivate) {
          toast({
            title: "Children's funds stay private",
            description: "A child's fund is private by default and opens only through its gift link.",
          });
          return;
        }
        toast({ title: newValue ? "Fund is now discoverable" : "Fund is now private" });
      } else {
        const err = await res.json().catch(() => ({} as any));
        toast({
          title: "Could not update privacy",
          description: err?.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Could not update privacy", variant: "destructive" });
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    haptic("medium");
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
        toast({ title: "Bank account removed" });
      }
    } catch {
      toast({ title: "Could not remove account", variant: "destructive" });
    }
  };

  const handleSetDefaultBankAccount = async (id: string) => {
    haptic("selection");
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update default bank.");
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Default bank updated" });
    } catch (error) {
      toast({
        title: "Could not update bank",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCollaborator = async (fundId: string, collabId: string) => {
    haptic("medium");
    try {
      const res = await fetch(`/api/funds/${fundId}/collaborators/${collabId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "collaborators"] });
        toast({ title: "Collaborator removed" });
      } else {
        const data = await res.json();
        toast({ title: "Could not remove", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not remove", description: "Please try again", variant: "destructive" });
    }
  };

  const openEditFundDialog = (fund: any) => {
    setEditingFund(fund);
    setEditFundName(fund?.name || "");
    setEditRecipientName(fund?.recipientFirstName || "");
    setEditPronoun(fund?.pronoun || "they");
    const birth = fund?.recipientBirthdate ? new Date(fund.recipientBirthdate) : null;
    if (birth && !Number.isNaN(birth.getTime())) {
      setEditRecipientBirthdate(birth.toISOString().slice(0, 10));
    } else {
      setEditRecipientBirthdate("");
    }
    setEditFundOpen(true);
    haptic("selection");
  };

  useEffect(() => {
    const params = new URLSearchParams(search || "");
    const editFundId = params.get("editFund");
    if (!editFundId || funds.length === 0) return;

    const targetFund = funds.find((f: any) => String(f.id) === String(editFundId));
    if (targetFund) {
      openEditFundDialog(targetFund);
    }

    params.delete("editFund");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [search, funds]);

  const handleSaveFundEdit = async () => {
    if (!editingFund?.id) return;
    const name = editFundName.trim();
    if (!name) {
      toast({ title: "Fund name required", description: "Please enter a fund name.", variant: "destructive" });
      return;
    }

    setSavingFundEdit(true);
    haptic("medium");
    try {
      const payload: Record<string, any> = { name };
      if (isUTMAFund(editingFund)) {
        payload.recipientFirstName = editRecipientName.trim();
        payload.recipientBirthdate = editRecipientBirthdate
          ? new Date(`${editRecipientBirthdate}T00:00:00.000Z`).toISOString()
          : null;
        payload.pronoun = editPronoun || "they";
      }

      const res = await fetch(`/api/funds/${editingFund.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Could not update fund", description: data?.error || "Please try again", variant: "destructive" });
        return;
      }

      setEditFundOpen(false);
      setEditingFund(null);
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      toast({ title: "Fund updated", description: "Your fund details were saved." });
      haptic("success");
    } catch {
      toast({ title: "Could not update fund", description: "Please try again", variant: "destructive" });
    } finally {
      setSavingFundEdit(false);
    }
  };

  const handleSendCollabInvite = async (email: string, role: string) => {
    const fundId = collabFundId || primaryFund?.id;
    if (!fundId) return;
    try {
      const res = await fetch(`/api/funds/${fundId}/collaborators`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (res.ok) {
        haptic("success");
        toast({ title: "Invite sent!", description: `${email} has been invited as ${role}` });
        queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "collaborators"] });
      } else {
        const data = await res.json();
        toast({ title: "Could not send invite", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not send invite", description: "Please try again", variant: "destructive" });
    }
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
    if (primaryFund) {
      queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund.id, "holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund.id, "collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund.id, "investment-preferences"] });
    }
  };

  const isAnyFundDiscoverable = funds.some((f: any) => f.isDiscoverable);

  const handleChildPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !primaryFund) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please choose an image under 5MB.", variant: "destructive" });
      return;
    }
    setUploadingChildPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await fetch(`/api/funds/${primaryFund.id}/child-photo`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
          queryClient.setQueryData(["/api/funds"], (old: any[]) =>
            (old || []).map((f: any) => f.id === primaryFund.id ? { ...f, childPhotoUrl: payload.url } : f)
          );
          haptic("success");
          toast({ title: "Photo updated" });
        } else {
          toast({ title: "Could not update photo", description: payload?.error || "Please try a smaller image.", variant: "destructive" });
        }
        setUploadingChildPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Could not update photo", variant: "destructive" });
      setUploadingChildPhoto(false);
    }
  };

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
      <AppHeader />
      <div className="kiddo-canvas px-4 py-6 space-y-6">

        {/* In-content back link removed 2026-05-11. Settings is Tier-1
            fund-scoped per page-scope.ts; AppHeader (logo + fund switcher
            + profile) + DesktopSidebar + MobileNav already provide global
            nav. The Apple-Settings register locked in
            project_settings_v2_register.md has no in-page back chrome —
            you use the system chrome to leave. The smart ?from= query
            param routing here was residual and competed with the
            AppHeader's affordances. */}

        {billingReturnNotice && (
          <div
            className={`rounded-2xl border p-4 shadow-premium-sm ${
              billingReturnNotice.type === "success"
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
            data-testid="card-billing-return-notice"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${billingReturnNotice.type === "success" ? "text-green-800" : "text-amber-800"}`}>
                  {billingReturnNotice.title}
                </p>
                <p className={`mt-1 text-sm ${billingReturnNotice.type === "success" ? "text-green-700" : "text-amber-700"}`}>
                  {billingReturnNotice.description}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setBillingReturnNotice(null)}
                data-testid="button-dismiss-billing-return-notice"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Three states for the top-of-Settings banner:
            1. Setup incomplete → SetupProgressNudge (finish the few things)
            2. Setup complete + no gifts yet → "Your fund is ready" banner
               (the prompt to share so the first gift can land)
            3. Setup complete + at least one gift → nothing
               (the prompt's job is done; don't keep nagging the parent
               about something that already happened). The Dashboard
               carries the canonical share entry; Settings doesn't need
               to be a redundant share entry once gifts are flowing. */}
        {setup.percent < 100 ? (
          <SetupProgressNudge
            title="Finish the few things behind the gift link"
            subtitle="This is the quiet setup that lets gifts move cleanly."
            percent={setup.percent}
            items={setup.steps.map((s) => ({ label: s.label, done: s.done }))}
            collapsible
            defaultExpanded={false}
            ctaLabel={
              setup.nextAction === "create_fund"
                ? "Create fund"
                : setup.nextAction === "add_recipient"
                  ? "Add recipient details"
                  : setup.nextAction === "activate_investing"
                    ? "Activate investing"
                    : setup.nextAction === "link_bank"
                      ? "Link bank account"
                      : setup.nextAction === "complete_profile"
                        ? "Add your name and photo"
                        : "Review funds"
            }
            onCta={() => {
              if (setup.nextAction === "create_fund") { setAddFundOpen(true); return; }
              if (setup.nextAction === "add_recipient") {
                toast({ title: "Add recipient details", description: "Go to the Child tab to add name and birthdate." });
                setSettingsTab("child");
                return;
              }
              if (setup.nextAction === "activate_investing") { navigate("/activate"); return; }
              if (setup.nextAction === "link_bank") { setLinkBankOpen(true); return; }
              if (setup.nextAction === "complete_profile") { navigate("/account"); return; }
              navigate("/dashboard");
            }}
            ctaTestId="button-settings-setup-cta"
          />
        ) : (shareSummary?.gifts?.length ?? 0) === 0 ? (
          <SectionCard className="bg-[hsl(var(--kiddo-evergreen)/0.06)] border-[hsl(var(--kiddo-evergreen)/0.18)]">
            <div className="p-5">
              <p className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">Your fund is ready.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Share it to receive your first gift.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="kiddo-gold-button rounded-xl gap-1.5"
                  onClick={() => {
                    if (!primaryFund?.slug || sharePages.length === 0) return;
                    haptic("medium");
                    setShareModalOpen(true);
                  }}
                  data-testid="button-settings-share-gift-link"
                >
                  <Share2 size={14} /> Share
                </Button>
                {primaryFund?.slug && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5"
                    onClick={() => window.open(`/${primaryFund.slug}`, "_blank")}
                    data-testid="button-settings-preview-gift-page"
                  >
                    Preview gift page
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>
        ) : null}

        {/* Closed-fund banner — calm, action-bearing. Renders at the top
            of Settings whenever the active fund is closed. Single button
            to reopen; no urgency, no guilt copy, no countdown. The
            corresponding read-only banner on Dashboard is the gifter's
            and the parent's day-one signal that the fund is paused. */}
        {fundIsClosed && primaryFund ? (
          <SectionCard className="border-amber-200 bg-amber-50/60">
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  {primaryFund.recipientFirstName ? `${primaryFund.recipientFirstName}'s` : "This"} fund is closed
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Memory Book and history are preserved. The gift link is paused. Reopen any time.
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 rounded-xl"
                onClick={handleReopenFund}
                disabled={reopeningFund}
                data-testid="button-reopen-fund"
              >
                {reopeningFund ? "Reopening..." : "Reopen fund"}
              </Button>
            </div>
          </SectionCard>
        ) : null}

        <div className="space-y-2">
          <div className="kiddo-tab-row max-w-full overflow-x-auto" data-testid="settings-tabs">
            {/* "Membership" tab removed from the in-app navigation
                on 2026-05-14 per the WHO/HOW IA Phase 1c. Account is
                now the primary home for plan management; users who
                tap their avatar -> Account -> Plan & billing land on
                the right surface. The "membership" tab still exists
                as a settingsTab value and renders if deep-linked into
                with actionable query params (?success=, ?canceled=,
                ?upgrade=, ?action=) — that handles Stripe webhook
                returns and any in-flight in-app CTAs that still point
                at /settings?tab=membership. Without actionable params,
                a redirect useEffect bounces the user to
                /account?tab=plan. Phase 1c-B (future) will update
                Stripe success URLs server-side to point at Account
                directly, then this entire membership tab JSX can be
                deleted. */}
            {[
              { id: "child", label: "Child" },
              { id: "gifts", label: "Gifts" },
              { id: "notifications", label: "Notifications" },
              { id: "money", label: "Money" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="kiddo-tab-item whitespace-nowrap"
                data-active={settingsTab === tab.id ? "true" : "false"}
                data-testid={`settings-tab-${tab.id}`}
                onClick={() => {
                  setSettingsTab(tab.id as typeof settingsTab);
                  haptic("selection");
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground px-0.5">
            Changes here apply to {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s fund` : "this fund"} only.{" "}
            <Link href="/account" className="underline underline-offset-2 hover:text-foreground">Account settings →</Link>
          </p>
        </div>

        {settingsTab === "child" && (
          <div className="space-y-4" data-testid="settings-child-panel">
            {/* Child identity card */}
            <SectionCard>
              <div className="p-5">
                <p className="kiddo-section-label mb-4">Child</p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => childPhotoInputRef.current?.click()}
                    disabled={uploadingChildPhoto}
                    className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden group"
                    data-testid="button-change-child-photo"
                  >
                    {primaryFund?.childPhotoUrl ? (
                      <img src={primaryFund.childPhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--kiddo-evergreen))] text-2xl font-bold text-white shadow-[inset_0_-8px_16px_rgba(0,0,0,0.14)]">
                        {(primaryFund?.recipientFirstName || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      {uploadingChildPhoto
                        ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                        : <Camera size={18} className="text-white" />}
                    </div>
                  </button>
                  <input ref={childPhotoInputRef} type="file" accept="image/*" onChange={handleChildPhotoUpload} className="hidden" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-foreground">
                      {primaryFund?.recipientFirstName || <span className="text-muted-foreground">No name added yet</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {primaryFund?.recipientBirthdate
                        ? new Date(primaryFund.recipientBirthdate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : "No birthdate added"}
                    </p>
                    {/* "Growing for [child] since [Month YYYY]" — the one warm
                        line in the Child identity card. Restrained, factual,
                        sprout-voice. Single line, no chrome around it.
                        Renders only when fund has a real createdAt; no fallback
                        for funds with no creation date (shouldn't happen in
                        practice — defensive). */}
                    {(() => {
                      const created = primaryFund?.createdAt ? new Date(primaryFund.createdAt) : null;
                      if (!created || isNaN(created.getTime())) return null;
                      const monthYear = created.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                      const childName = primaryFund?.recipientFirstName?.trim();
                      const line = childName
                        ? `Growing for ${childName} since ${monthYear}`
                        : `Growing since ${monthYear}`;
                      return (
                        <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-fund-growing-since">
                          {line}
                        </p>
                      );
                    })()}
                    <button
                      type="button"
                      className="mt-2 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]"
                      onClick={() => setEditFundOpen(true)}
                      data-testid="button-edit-child-details"
                    >
                      Edit child details
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Kid's View */}
            <SectionCard>
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s View` : "Kid's View"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {kidViewSettings?.enabled && kidViewSettings?.hasPin
                      ? "Active · PIN protected"
                      : "Not set up yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {kidViewSettings?.enabled && kidViewSettings?.hasPin ? (
                    <>
                      <button
                        type="button"
                        disabled={copyingKidLink}
                        onClick={handleCopyKidViewLink}
                        className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-75 transition-opacity px-3 py-1.5 rounded-lg border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.06)]"
                      >
                        {copyingKidLink ? "Copying..." : "Copy link"}
                      </button>
                      {kidViewSettings?.shareLink && (
                        <>
                          <a
                            href={`mailto:?subject=${encodeURIComponent(`${primaryFund?.recipientFirstName || "Your child"}'s Kiddo fund`)}&body=${encodeURIComponent(`Here's your fund link: ${kidViewSettings.shareLink}\n\nYou'll need the PIN to get in.`)}`}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border"
                          >
                            Email
                          </a>
                          <a
                            href={kidViewSettings.shareLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border"
                          >
                            Open
                          </a>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => { setShowPinManager((v) => !v); setNewPin(""); setNewPinHint(""); haptic("selection"); }}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border"
                      >
                        {showPinManager ? "Cancel" : "Edit PIN"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowPinManager(true); haptic("selection"); }}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Set up →
                    </button>
                  )}
                </div>
              </div>

              {showPinManager && (
                <div className="border-t border-[hsl(var(--kiddo-border))] px-4 py-4 space-y-3">
                  {kidViewSettings?.enabled && kidViewSettings?.hasPin && kidViewSettings?.pinHint && (
                    <p className="text-xs text-muted-foreground">
                      Current hint: <span className="font-semibold text-foreground">{kidViewSettings.pinHint}</span>
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      {kidViewSettings?.hasPin ? "New PIN (4 digits)" : "Set a PIN (4 digits)"}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="e.g. 1234"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-mono tracking-widest"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Hint (optional)</label>
                    <input
                      type="text"
                      value={newPinHint}
                      onChange={(e) => setNewPinHint(e.target.value.slice(0, 60))}
                      placeholder="e.g. your birthday month and day"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    />
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    disabled={savingPin || newPin.length !== 4}
                    onClick={handleSavePin}
                  >
                    {savingPin ? "Saving..." : kidViewSettings?.hasPin ? "Update PIN" : "Enable Kid's View"}
                  </Button>
                </div>
              )}
            </SectionCard>

            {/* Invitations sent TO this user. Renders only when there's
                at least one pending row. Apple-Settings register — calm
                informational card, clear "open invitation" CTA that lands
                on the public accept page (same surface a fresh email
                recipient would see, so the experience is uniform whether
                they followed the email or discovered the invite here). */}
            {pendingInvitations.length > 0 && (
              <SectionCard>
                <div className="p-5">
                  <h2 className="text-base font-bold text-foreground mb-1">Invitations to you</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    You've been invited to {pendingInvitations.length === 1 ? "a fund" : `${pendingInvitations.length} funds`} by other parents.
                  </p>
                  <div className="space-y-3">
                    {pendingInvitations.map((inv: any) => {
                      const childName = inv.childFirstName || "their child";
                      const inviter = inv.inviterFirstName || "A parent";
                      const roleLabel = inv.role === "co-admin" ? "Co-parent" : "Viewer";
                      return (
                        <div
                          key={inv.token}
                          className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4"
                          data-testid={`row-pending-invitation-${inv.token}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-foreground">
                                {inviter} invited you to {childName}'s fund
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {roleLabel} role · Pending
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="shrink-0 rounded-xl"
                              onClick={() => { navigate(`/invitations/${inv.token}`); haptic("selection"); }}
                              data-testid={`button-open-invitation-${inv.token}`}
                            >
                              Open invitation
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Co-parent access */}
            {(() => {
              // Plus, Family, and Legacy all unlock co-parent invites. The
              // pricing rationale (per memory): Plus is feature-gated per
              // fund, Family is Plus across multiple funds. Co-parent
              // access is a per-fund feature, so Plus is the natural floor.
              const canInvite = userPlan === "starter" || userPlan === "family" || userPlan === "legacy";
              const childName = primaryFund?.recipientFirstName;
              const ownerName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "You";
              const ownerInitial = (user?.firstName || user?.email || "U").slice(0, 1).toUpperCase();

              const VIEWER_PERMS  = ["View balance", "View activity", "See Memory Book"];
              const ADMIN_PERMS   = ["View balance", "View activity", "See Memory Book", "Create events", "Edit settings"];
              const DENIED_VIEWER = ["Create events", "Edit settings"];

              return (
                <SectionCard>
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div>
                        <h2 className="text-base font-bold text-foreground">Co-parent access</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Share {childName ? `${childName}'s` : "this"} fund with a partner or guardian.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0 rounded-xl gap-1.5"
                        onClick={() => {
                          haptic("light");
                          // Free users: open the FeatureWallModal so the
                          // tap lands on a clear "this is Plus" moment
                          // with one-tap upgrade. Was previously a hard
                          // `disabled={!canInvite}` which left the free
                          // user with a dead button and no path forward
                          // (the gray Plus-gate explainer below was the
                          // only signal — easy to miss above the fold).
                          // Plus/Family/Legacy: open the real invite
                          // modal as before.
                          if (canInvite) {
                            setCollabModalOpen(true);
                          } else {
                            setCoParentWallOpen(true);
                          }
                        }}
                        data-testid="button-invite-coparent"
                      >
                        <UserPlus size={13} />
                        Invite
                      </Button>
                    </div>

                    {/* How it works - shown only when no collaborators yet */}
                    {collaborators.length === 0 && (
                      <div className="mb-5 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-gradient-to-br from-[hsl(var(--kiddo-evergreen)/0.05)] to-[hsl(var(--kiddo-cream-dark)/0.4)] p-4">
                        <p className="kiddo-section-label mb-3">How co-parent access works</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { emoji: "🔑", title: "You stay in control", body: "You are the legal custodian. They have no legal claim." },
                            { emoji: "👁", title: "Choose their role", body: "Viewer or Co-Admin. You decide what they can see and do." },
                            { emoji: "🚫", title: "Revoke anytime", body: "Remove access instantly. Their session ends immediately." },
                          ].map((item) => (
                            <div key={item.title} className="rounded-xl bg-card p-3">
                              <p className="text-lg mb-1.5">{item.emoji}</p>
                              <p className="text-[11.5px] font-bold text-foreground mb-0.5">{item.title}</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Access list */}
                    {collaborators.length > 0 && (
                      <div className="mb-5">
                        <p className="kiddo-section-label mb-3">Access list</p>
                        <div className="space-y-3">
                          {collaborators.map((collab: any) => {
                            const isAdmin = collab.role === "co-admin";
                            const granted = isAdmin ? ADMIN_PERMS : VIEWER_PERMS;
                            const denied = isAdmin ? [] : DENIED_VIEWER;
                            const invitedDate = collab.invitedAt
                              ? new Date(collab.invitedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : null;
                            return (
                              <div key={collab.id} className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-cream-dark))] border border-[hsl(var(--kiddo-border))] text-sm font-bold text-foreground">
                                    {(collab.email || "?").slice(0, 1).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                      <p className="text-sm font-bold text-foreground truncate">{collab.email}</p>
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${
                                        collab.status === "accepted"
                                          ? "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]"
                                          : "bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold-ink))]"
                                      }`}>
                                        {collab.status === "accepted" ? "active" : "pending"}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {collab.status === "accepted"
                                        ? `${isAdmin ? "Co-Admin" : "Viewer"} · Accepted`
                                        : invitedDate
                                          ? `Invited ${invitedDate} · Awaiting acceptance`
                                          : "Awaiting acceptance"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCollaborator(primaryFund!.id, collab.id)}
                                    className="shrink-0 rounded-full border border-[hsl(var(--kiddo-border))] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors"
                                    data-testid={`button-revoke-collab-${collab.id}`}
                                  >
                                    Revoke
                                  </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {granted.map((p) => (
                                    <span key={p} className="rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[hsl(var(--kiddo-evergreen))]">
                                      ✓ {p}
                                    </span>
                                  ))}
                                  {denied.map((p) => (
                                    <span key={p} className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground/60">
                                      ✗ {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Your access */}
                    <div className={collaborators.length > 0 ? "" : "mt-1"}>
                      <p className="kiddo-section-label mb-3">Your access</p>
                      <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">
                          {user?.profileImageUrl
                            ? <img src={user.profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            : ownerInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{ownerName}</p>
                          <p className="text-xs text-muted-foreground">Primary custodian · Full control</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--kiddo-evergreen))]">
                          Primary
                        </span>
                      </div>
                    </div>

                    {/* Plan gate. Free users see the feature explainer
                        cards above (kept on purpose — it teaches what
                        co-parent access actually does, which the
                        previous "Upgrade to share fund access" copy
                        glossed over). The CTA was also softened from
                        "See plans" to a direct primary upgrade button
                        because the explainer above already does the
                        education job; the gate's job is just to close
                        the loop with one tap. */}
                    {!canInvite && (
                      <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                        <p className="text-sm font-semibold text-foreground">Invite a co-parent with Kiddo+</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          $4.99/month or $39/year. A partner or guardian sees the fund's growth, the Memory Book, and recent gifts. Their notes show up on the kid's timeline alongside yours.
                        </p>
                        <Button
                          size="sm"
                          className="mt-3 rounded-xl"
                          onClick={() => {
                            haptic("selection");
                            // Route to Account "Plan & billing" tab per
                            // the WHO/HOW IA Phase 1c. Includes the
                            // current fund id so the Plus upgrade
                            // auto-trigger fires for THIS fund directly.
                            const fundId = primaryFund?.id;
                            navigate(fundId
                              ? `/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fundId)}`
                              : "/account?tab=plan");
                          }}
                          data-testid="button-coparent-upgrade"
                        >
                          Upgrade to Kiddo+
                        </Button>
                      </div>
                    )}
                  </div>
                </SectionCard>
              );
            })()}

            {/* Fund details */}
            <SectionCard>
              <div className="divide-y divide-[hsl(var(--kiddo-border))]">
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm text-muted-foreground">Fund name</span>
                  <span className="text-sm font-semibold text-foreground truncate max-w-[60%] text-right">{primaryFund?.name || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm text-muted-foreground">Account type</span>
                  <span className="text-sm font-semibold text-foreground">{primaryFund?.accountType === "personal" ? "Personal" : "UTMA"}</span>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`text-sm font-semibold ${primaryFund?.status === "active" ? "text-green-700" : "text-muted-foreground"}`}>
                    {primaryFund?.status === "active" ? "Active" : primaryFund?.status || "-"}
                  </span>
                </div>
                {/* Transfer date — when the fund's UTMA custody legally hands
                    off to the kid. Computed from the fund's locked majorityAge
                    + the child's birthdate via the canonical helper. Renders
                    only for UTMA funds with a real birthdate (personal funds
                    don't have a transfer date; missing birthdate means the
                    date can't be computed yet). The warm "Transfers to
                    [child]" framing turns a UTMA legal detail into a parent-
                    visible reality without verbose explanation. The full
                    age-18 plan UX lives elsewhere; this is the calm utility-
                    surface acknowledgment. */}
                {(() => {
                  const isUtma = !primaryFund?.accountType || String(primaryFund.accountType).toUpperCase() === "UTMA";
                  if (!isUtma) return null;
                  const transferDate = primaryFund?.recipientBirthdate
                    ? getMajorityDate(primaryFund.recipientBirthdate, (primaryFund as any).majorityAge ?? null)
                    : null;
                  if (!transferDate || isNaN(transferDate.getTime())) return null;
                  const childName = primaryFund?.recipientFirstName?.trim();
                  return (
                    <div className="flex items-center justify-between gap-4 p-4" data-testid="row-fund-transfer-date">
                      <span className="text-sm text-muted-foreground">
                        Transfers to {childName || "your child"}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {transferDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  );
                })()}
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setEditFundOpen(true)}
                  data-testid="button-edit-fund-child-tab"
                >
                  <span className="text-sm text-muted-foreground">Edit fund</span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              </div>
            </SectionCard>

            {/* Successor custodian — UTMA's "what happens if you die before
                the kid turns 18" slot. Schema, PATCH endpoint, and activity
                logging all already exist (the AddFundSheet flow at fund
                creation populates these). Was missing the Settings-side
                edit surface — a parent whose chosen successor moves away,
                divorces, or dies needed a way to update. This is that. */}
            {primaryFund && (() => {
              const currentName = String((primaryFund as any).successorCustodianName || "").trim();
              const currentEmail = String((primaryFund as any).successorCustodianEmail || "").trim();
              const currentRelation = String((primaryFund as any).successorCustodianRelation || "").trim();
              const childFirst = primaryFund.recipientFirstName || "your child";
              // State-specific majority age for "before {child} turns {N}" copy.
              const primaryMajorityAge = Number((primaryFund as any)?.majorityAge) || 18;

              const openEditor = () => {
                haptic("light");
                setSuccessorName(currentName);
                setSuccessorEmail(currentEmail);
                setSuccessorRelation(currentRelation);
                setSuccessorEditOpen(true);
              };

              const handleSave = async () => {
                if (!primaryFund?.id) return;
                const trimmedName = successorName.trim();
                if (!trimmedName) {
                  toast({ title: "Name required", description: "Add a name for the successor custodian.", variant: "destructive" });
                  return;
                }
                setSavingSuccessor(true);
                try {
                  const res = await fetch(`/api/funds/${primaryFund.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      successorCustodianName: trimmedName,
                      successorCustodianEmail: successorEmail.trim() || null,
                      successorCustodianRelation: successorRelation.trim() || null,
                      // Stamp the added-at on a NEW designation; preserve the original
                      // stamp on edits so the legal trail tracks first-set, not most-recent-edit.
                      ...(currentName ? {} : { successorCustodianAddedAt: new Date().toISOString() }),
                    }),
                  });
                  if (!res.ok) throw new Error("save failed");
                  haptic("success");
                  toast({ title: currentName ? "Successor updated" : "Successor saved", description: `${trimmedName} will step in if anything happens to you.` });
                  setSuccessorEditOpen(false);
                  await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
                } catch {
                  haptic("error");
                  toast({ title: "Couldn't save", description: "Try again in a moment.", variant: "destructive" });
                } finally {
                  setSavingSuccessor(false);
                }
              };

              const handleRemove = async () => {
                if (!primaryFund?.id) return;
                setSavingSuccessor(true);
                try {
                  const res = await fetch(`/api/funds/${primaryFund.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      successorCustodianName: null,
                      successorCustodianEmail: null,
                      successorCustodianRelation: null,
                    }),
                  });
                  if (!res.ok) throw new Error("remove failed");
                  haptic("success");
                  toast({ title: "Successor removed" });
                  setSuccessorEditOpen(false);
                  await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
                } catch {
                  haptic("error");
                  toast({ title: "Couldn't remove", description: "Try again in a moment.", variant: "destructive" });
                } finally {
                  setSavingSuccessor(false);
                }
              };

              return (
                <SectionCard>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">Successor custodian</p>
                        {currentName ? (
                          <>
                            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                              {currentName} will step in if anything happens to you before {childFirst} turns {primaryMajorityAge}.
                            </p>
                            {(currentEmail || currentRelation) && (
                              <p className="mt-0.5 text-xs text-muted-foreground/70">
                                {[currentRelation, currentEmail].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            Name someone to manage {childFirst}'s fund if anything happens to you before {childFirst} turns {primaryMajorityAge}.
                          </p>
                        )}
                      </div>
                      {!successorEditOpen && (
                        <button
                          type="button"
                          onClick={openEditor}
                          className="shrink-0 rounded-lg border border-[hsl(var(--kiddo-border))] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
                          data-testid="button-edit-successor"
                        >
                          {currentName ? "Edit" : "Add"}
                        </button>
                      )}
                    </div>

                    {successorEditOpen && (
                      <div className="mt-4 space-y-3 rounded-xl bg-muted/30 p-4">
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</label>
                          <input
                            type="text"
                            value={successorName}
                            onChange={(e) => setSuccessorName(e.target.value)}
                            placeholder="Full name"
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            data-testid="input-successor-name"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email <span className="font-normal normal-case text-muted-foreground/60">(optional)</span></label>
                          <input
                            type="email"
                            value={successorEmail}
                            onChange={(e) => setSuccessorEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            data-testid="input-successor-email"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Relationship <span className="font-normal normal-case text-muted-foreground/60">(optional)</span></label>
                          <input
                            type="text"
                            value={successorRelation}
                            onChange={(e) => setSuccessorRelation(e.target.value)}
                            placeholder="e.g. Sibling, parent, godparent"
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            data-testid="input-successor-relation"
                          />
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                          This designation lives in your account record. It does not replace your will. Update your will to formally name this person as successor custodian under your state's UTMA statute.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={handleSave}
                            disabled={savingSuccessor || !successorName.trim()}
                            data-testid="button-save-successor"
                          >
                            {savingSuccessor ? "Saving..." : currentName ? "Update" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => setSuccessorEditOpen(false)}
                            disabled={savingSuccessor}
                          >
                            Cancel
                          </Button>
                          {currentName && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto rounded-full text-muted-foreground hover:text-red-600"
                              onClick={handleRemove}
                              disabled={savingSuccessor}
                              data-testid="button-remove-successor"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              );
            })()}

            {/* Legal + documents */}
            <SectionCard>
              <div className="divide-y divide-[hsl(var(--kiddo-border))]">
                <Link
                  href="/tax-documents"
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors"
                  onMouseEnter={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
                  onTouchStart={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
                  onFocus={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
                >
                  <span className="text-sm text-muted-foreground">Tax documents</span>
                  <span className="text-sm font-semibold text-foreground">View</span>
                </Link>
                <Link href="/legal" className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <span className="text-sm text-muted-foreground">Legal</span>
                  <span className="text-sm font-semibold text-foreground">Disclosures</span>
                </Link>
              </div>
            </SectionCard>

            {/* ── Close this fund ── */}
            {/* Relocated 2026-05-14 from the membership tab to here per
                the WHO/HOW information-architecture principle: close-
                this-fund is a per-fund action (it changes one fund's
                state, not the user's identity or billing), so it
                belongs in a fund-scoped tab, not in membership which
                is account-scoped. Placed at the bottom of the child
                tab per the standard UX convention that destructive
                actions live at the bottom (keeps them out of
                accidental-tap reach but findable when the parent
                goes looking). The close action itself is unchanged.
                Designed against project_cancellation_dark_pattern_
                avoidance.md AND project_close_fund_design_lens.md
                (locked memory). The close action is reversible.
                Memory Book + audit logs stay intact. Cash stays in
                the fund (separate withdrawal flow). Recurring
                investments cancel. No guilt copy. */}
            {primaryFund && !fundIsClosed && (
              <SectionCard className="border-border/60">
                <div className="p-5">
                  <h2 className="text-base font-bold text-foreground">Close this fund</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Stop accepting gifts to {primaryFund.recipientFirstName ? `${primaryFund.recipientFirstName}'s` : "this"} fund. The Memory Book and history stay intact, and you can reopen anytime.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl"
                    onClick={() => { haptic("light"); setCloseFundOpen(true); }}
                    data-testid="button-open-close-fund"
                  >
                    Close fund
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {settingsTab === "gifts" && (
          <div className="space-y-4" data-testid="settings-gifts-panel">
            {/* Gift page group */}
            <SectionCard>
              <div className="p-5">
                <p className="kiddo-section-label mb-1">Gift page</p>
                <p className="text-[11px] text-muted-foreground mb-4">How your fund looks and who can find it.</p>
                {primaryFund?.slug && (
                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3 flex items-center gap-2 mb-4">
                    <span className="text-xs text-muted-foreground truncate flex-1">{window.location.origin}/{primaryFund.slug}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-75 shrink-0"
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${primaryFund.slug}`); toast({ title: "Gift link copied!" }); }}
                    >
                      Copy
                    </button>
                  </div>
                )}
                <div className="divide-y divide-[hsl(var(--kiddo-border))] rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between gap-4 p-4 bg-background">
                    <span className="text-sm text-muted-foreground">Visibility</span>
                    <span className="text-sm font-semibold text-foreground">Link only · Private</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* What gifters can do */}
            <SectionCard>
              <div className="p-5">
                <p className="kiddo-section-label mb-1">What people can do</p>
                <p className="text-[11px] text-muted-foreground mb-4">Choose how personal gifts can be for {primaryFund?.recipientFirstName || "your child"}.</p>
                {primaryFund ? (
                  <div data-testid="settings-gifts-gifter-rules-editor">
                    <GifterInvestmentRulesEditor fund={primaryFund} onSuccess={refreshAll} />
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </div>
        )}

        {settingsTab === "membership" && (
          <div className="space-y-4" data-testid="settings-membership-panel">

            {/* ── Active paid plan status ── */}
            {userPlan !== "free" && subscription?.status !== "canceled" && (
              <>
              <SectionCard className="border-[hsl(var(--kiddo-evergreen)/0.22)] bg-[hsl(var(--kiddo-evergreen)/0.055)]">
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen))] text-white">
                      <Check size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">
                        {userPlan === "starter" ? "Kiddo+" : userPlan === "legacy" ? "Kiddo Legacy" : "Kiddo Family"} · Active
                      </p>
                      {subscription?.currentPeriodEnd && (
                        <p className="mt-0.5 text-xs text-[hsl(var(--kiddo-evergreen)/0.7)]">
                          Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7 px-3"
                      onClick={() => handleOpenBillingPortal()}
                      disabled={openingPortal}
                      data-testid="button-manage-billing"
                    >
                      {openingPortal ? "Opening..." : "Manage billing"}
                    </Button>
                    {/* Cancel sits next to Manage billing as a peer button —
                        promoted from a muted 11px link to the same size +
                        weight. Apple-Settings register: cancel is a normal
                        action, not a confession. The destructive text color
                        is the only visual cue that this ends the plan. */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7 px-3 text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
                      onClick={() => { setCancelStep("warn"); setShowCancelConfirm(true); }}
                      data-testid="button-open-cancel-confirm"
                    >
                      Cancel plan
                    </Button>
                  </div>
                </div>
              </SectionCard>
              {/* Plan Benefits card — the "what you're paying for" surface.
                  Calm, always-visible, lists what the user has access to +
                  shows real usage stats + one soft "haven't tried" nudge.
                  Per the 2026-05-13 plan-benefits audit. */}
              <PlanBenefitsCard plan={userPlan as "starter" | "family" | "legacy"} />
              </>
            )}

            {/* -- Canceling state - plan active until period end -- */}
            {subscription?.status === "canceled" && userPlan !== "free" && subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd).getTime() > Date.now() && (
              <SectionCard className="border-amber-200 bg-amber-50">
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-base font-semibold text-amber-900">
                        {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s fund is safe.` : "Your fund is safe."} Always.
                      </p>
                      <p className="mt-1 text-xs text-amber-900/80">
                        {userPlan === "starter" ? "Kiddo+" : "Kiddo Family"} ends {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.
                        Gifts still work. You can change your mind right now.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-xl"
                      disabled={reactivating}
                      onClick={() => handleReactivateSubscription({ plan: userPlan === "starter" ? "starter" : "family" })}
                      data-testid="button-reactivate-plan"
                    >
                      {reactivating ? "Reactivating..." : "Keep my plan"}
                    </Button>
                  </div>

                  {/* What's paused — itemized, so the parent sees what they're walking away from */}
                  {cancellationImpact && (cancellationImpact.parentContributions.length > 0 || cancellationImpact.recurringGifts.length > 0) && (
                    <div className="rounded-lg border border-amber-200/60 bg-white/60 p-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/70">What pauses when {userPlan === "starter" ? "Kiddo+" : "Kiddo Family"} ends</p>
                      {cancellationImpact.parentContributions.map(c => (
                        <p key={c.id} className="text-xs text-amber-900 leading-relaxed">
                          ⏸ {c.childName}'s recurring investment{c.executionModel === "pick" && c.selectedTicker ? ` to ${c.selectedTicker}` : ""}, ${c.amount.toFixed(2)}/{c.frequency}
                        </p>
                      ))}
                      {cancellationImpact.recurringGifts.map(rg => (
                        <p key={rg.id} className="text-xs text-amber-900 leading-relaxed">
                          ⏸ {rg.senderName}'s gift reminder for {rg.childName}, ${rg.amount.toFixed(2)} every {rg.frequency === "yearly" ? "year" : rg.frequency === "quarterly" ? "3 months" : "month"}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* -- Free plan state - always shown on free, also shown post-cancel after expiry -- */}
            {userPlan === "free" && (
              <SectionCard className="bg-[hsl(var(--kiddo-evergreen)/0.06)]">
                <div className="flex items-start gap-3 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.15)] text-[hsl(var(--kiddo-evergreen))]">
                    <Check size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Free Plan · Active</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      One child fund, a gift link, Memory Book basics. The door to the full experience is always open.
                    </p>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Membership cards — badges + buttons are now state-aware
                based on userPlan. Was previously a static layout that:
                  (1) showed "Recommended" on Kiddo+ regardless of
                      whether the user already had Plus / Family / Legacy
                      (a downgrade recommendation for paying users), and
                  (2) had no clear "Current plan" indicator on the active
                      tier (the only signal was the heading at the top of
                      the page).
                Now: the user's active tier shows a "Current plan" badge
                + a disabled CTA, and the "Recommended" badge only appears
                on the next-tier-up upgrade path. Same cards, same data,
                just contextual. */}
            {(() => {
              const isStarterCurrent = userPlan === "starter";
              const isFamilyCurrent = userPlan === "family";
              const isLegacyCurrent = userPlan === "legacy";
              // Tier-aware CTA labels — was unconditionally "Upgrade to X"
              // even when X was a lower tier than the user's current plan
              // (a Family customer saw "Upgrade to Plus" on the Plus card,
              // which is a downgrade direction; "Upgrade" was a lie).
              // Now: "Upgrade" only when the card's tier is HIGHER than
              // current; "Switch" when it's LOWER (calmer + honest about
              // direction); "Current plan" when it matches.
              const planRank = (p: typeof userPlan): number =>
                p === "legacy" ? 3 : p === "family" ? 2 : p === "starter" ? 1 : 0;
              const currentRank = planRank(userPlan);
              const ctaLabel = (cardPlan: "starter" | "family" | "legacy") => {
                if (cardPlan === userPlan) return "Current plan";
                const cardRank = planRank(cardPlan);
                if (cardRank > currentRank) return `Upgrade to ${cardPlan === "starter" ? "Plus" : cardPlan === "family" ? "Family" : "Legacy"}`;
                return `Switch to ${cardPlan === "starter" ? "Plus" : cardPlan === "family" ? "Family" : "Legacy"}`;
              };
              // For lower-tier cards, surface a calm "Included in {currentPlan}"
              // line so the parent isn't confused why we're showing them
              // features they already have. Empty string when card is the
              // current plan or higher (renderer skips when empty).
              const includedHint = (cardPlan: "starter" | "family" | "legacy") => {
                if (cardPlan === userPlan) return "";
                if (planRank(cardPlan) >= currentRank) return "";
                const currentLabel = userPlan === "family" ? "Kiddo Family" : userPlan === "legacy" ? "Kiddo Legacy" : "your plan";
                return `Included in ${currentLabel}`;
              };
              // Recommended path: free → Plus, Plus → Family.
              // Family + Legacy users get no recommendation (Family is the
              // top tier currently exposed in marketing; Legacy is the
              // top-of-top for existing subscribers).
              // 2026-05-12: Legacy pulled from public pricing surfaces
              // (project_acorns_bundle_inflation_pattern.md). Card only
              // renders for existing Legacy subscribers as "Current plan";
              // never shown as an upgrade destination from Family.
              const recommendedPlan: "starter" | "family" | null =
                userPlan === "free" ? "starter"
                : userPlan === "starter" ? "family"
                : null;
              const starterBadge =
                isStarterCurrent ? { label: "Current plan", tone: "current" as const }
                : recommendedPlan === "starter" ? { label: "Recommended", tone: "gold" as const }
                : null;
              const familyBadge =
                isFamilyCurrent ? { label: "Current plan", tone: "current" as const }
                : recommendedPlan === "family" ? { label: "Recommended", tone: "gold" as const }
                : { label: "Best for families", tone: "evergreen" as const };
              // Legacy card only renders when isLegacyCurrent (existing
              // subscribers); badge is always "Current plan" for those users.
              // No "Recommended" path lands on Legacy any more (Family is the
              // top tier on the public upgrade ladder).
              const legacyBadge = isLegacyCurrent
                ? { label: "Current plan", tone: "current" as const }
                : null;
              const badgeClass = (tone: "current" | "gold" | "evergreen") =>
                tone === "current"
                  ? "rounded-full bg-[hsl(var(--kiddo-evergreen))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
                  : tone === "gold"
                    ? "rounded-full bg-[hsl(var(--kiddo-gold))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
                    : "rounded-full bg-[hsl(var(--kiddo-evergreen))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white";
              return (
            <div className={`grid gap-4 ${isLegacyCurrent ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
              <SectionCard className={`relative border-2 ${isStarterCurrent ? "border-[hsl(var(--kiddo-evergreen))]" : "border-[hsl(var(--kiddo-gold))]"} shadow-[0_2px_8px_rgba(26,23,16,0.10),0_8px_24px_rgba(26,23,16,0.08)]`}>
                {starterBadge && (
                  <div className={`absolute left-5 top-0 -translate-y-1/2 ${badgeClass(starterBadge.tone)}`}>
                    {starterBadge.label}
                  </div>
                )}
                <div className="p-5 pt-6">
                  <h2 className="font-heading text-xl font-bold text-foreground">Kiddo+</h2>
                  <p className="mt-3 text-2xl font-bold leading-none text-[hsl(var(--kiddo-gold-ink))]">
                    ${KORA_STARTER_MONTHLY.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">or ${KORA_STARTER_YEARLY}/year</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">For one child, done right. Make this feel real every month.</p>
                  <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                    {/* Plus upgrade-card bullets. Synced 2026-05-14 to
                        match Pricing.tsx leading constraint so existing
                        users considering upgrade see the single-fund
                        limit the same way prospects do. Compact list
                        is intentional (Settings is upgrade-trigger
                        surface, not marketing); leading bullet sets
                        the right expectation before the parent
                        commits. */}
                    {["One child fund. Move to Family if you add a second.", "Recurring investments for one child fund", "Add your own photos, videos, and voice to Memory Book entries", "Custom fund mix (pick your own stocks)", "Co-parent access and priority support"].map((item) => (
                      <p key={item} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-gold-ink))]" />{item}</p>
                    ))}
                  </div>
                  {includedHint("starter") && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-[hsl(var(--kiddo-evergreen))]">
                      <Check size={10} />
                      {includedHint("starter")}
                    </p>
                  )}
                  <Button
                    className="mt-5 w-full rounded-xl"
                    onClick={() => handleUpgradeStarter(selectedStarterFundId)}
                    disabled={upgrading || isStarterCurrent}
                    data-testid="button-upgrade-starter-compact"
                  >
                    {ctaLabel("starter")}
                  </Button>
                </div>
              </SectionCard>

              <div
                className={`relative overflow-hidden rounded-2xl ${isFamilyCurrent ? "border-2 border-[hsl(var(--kiddo-evergreen))]" : "border border-[hsl(var(--kiddo-evergreen)/0.22)]"} bg-[linear-gradient(145deg,hsl(var(--kiddo-evergreen))_0%,hsl(153_48%_11%)_100%)] text-white shadow-[0_2px_8px_rgba(26,23,16,0.10),0_18px_38px_rgba(27,58,45,0.20)]`}
                data-testid="card-kiddo-family"
              >
                {familyBadge && (
                  <div className={`absolute right-4 top-4 rounded-full ${familyBadge.tone === "current" ? "bg-white text-[hsl(var(--kiddo-evergreen))]" : "border border-white/12 bg-white/10 text-white/80"} px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]`}>
                    {familyBadge.label}
                  </div>
                )}
                <div className="relative p-5 pt-8">
                  <h2 className="font-heading text-xl font-bold text-[hsl(var(--kiddo-cream))]">Kiddo Family</h2>
                  <p className="mt-3 text-2xl font-bold leading-none text-[hsl(var(--kiddo-gold-light))]">
                    ${KORA_FAMILY_MONTHLY.toFixed(2)}<span className="text-sm font-normal text-white/50">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-white/45">or ${KORA_FAMILY_YEARLY}/year</p>
                  <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--kiddo-cream)/0.78)]">For your family, long term. Manage everything in one place.</p>
                  <div className="mt-5 space-y-2 text-sm text-[hsl(var(--kiddo-cream)/0.84)]">
                    {/* Family-plan features chip list — audited 2026-05-12 to
                        match the cleaned Pricing.tsx list. Kept "Family-wide
                        occasion tools" → "Unlimited events with premium
                        features included" rename. Other bullet cleanup done
                        on Pricing.tsx (deleted padding, kept scale-clarifiers).
                        See project_acorns_bundle_inflation_pattern.md. */}
                    {/* Family upgrade-card bullets. Synced 2026-05-14
                        to add the Memory Book authoring differential,
                        which is the key Plus-vs-Family upgrade lever
                        per the locked Memory Book tier policy (parent-
                        authored media unlocks at Plus; multi-child
                        parent-authored media is the Family delta).
                        Without this bullet, the Settings upgrade card
                        underrepresented the actual feature gain. */}
                    {["Unlimited funds, every child", "Memory Book authoring for every child (photos, videos, voice)", "Unlimited occasions with premium features included", "Kid View for every child", "One view for every fund in your household"].map((item) => (
                      <p key={item} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-gold-light))]" />{item}</p>
                    ))}
                  </div>
                  {includedHint("family") && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-[hsl(var(--kiddo-cream))]">
                      <Check size={10} />
                      {includedHint("family")}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="mt-5 w-full rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white disabled:opacity-50"
                    onClick={handleUpgradeFamily}
                    disabled={upgrading || isFamilyCurrent}
                    data-testid="button-upgrade-family-compact"
                  >
                    {ctaLabel("family")}
                  </Button>
                </div>
              </div>

              {/* Legacy tier card — only renders for existing Legacy
                  subscribers so they see "Current plan" + honest bullet
                  list. Pulled from non-Legacy users 2026-05-12 because the
                  full bullet list contained 3 features that don't exist in
                  code (advanced projections, annual family report, premium
                  timeline export) — exactly the Acorns-Gold bundle-inflation
                  pattern locked discipline refuses. Honest bullets shown
                  here (Everything in Family + 2 Occasion credits + AUM).
                  See project_acorns_bundle_inflation_pattern.md for the
                  re-introduction conditions (when Legacy can come back to
                  public marketing). */}
              {isLegacyCurrent && (
                <SectionCard className="relative border-2 border-[hsl(var(--kiddo-evergreen))]">
                  {legacyBadge && (
                    <div className={`absolute left-5 top-0 -translate-y-1/2 ${badgeClass(legacyBadge.tone)}`}>
                      {legacyBadge.label}
                    </div>
                  )}
                  <div className="p-5 pt-6">
                    <h2 className="font-heading text-xl font-bold text-foreground">Kiddo Legacy</h2>
                    <p className="mt-3 text-2xl font-bold leading-none text-[hsl(var(--kiddo-evergreen))]">
                      ${KIDDO_LEGACY_YEARLY}<span className="text-sm font-normal text-muted-foreground">/yr</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">annual only</p>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">For families taking this seriously. Plan this properly, long term.</p>
                    <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                      {["Everything in Family", "2 Occasion credits per year"].map((item) => (
                        <p key={item} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />{item}</p>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-5 w-full rounded-xl border-[hsl(var(--kiddo-evergreen)/0.30)] text-[hsl(var(--kiddo-evergreen))]"
                      disabled
                      data-testid="button-upgrade-legacy-compact"
                    >
                      Current plan
                    </Button>
                  </div>
                </SectionCard>
              )}
            </div>
              );
            })()}

            {/* "Kiddo Occasions $7.99" card removed 2026-05-13 (Path A
                from the Occasions audit). The dormant one-time upgrade
                product was retired in favor of subscription-only pricing.
                The Account.tsx equivalent was removed in commit bb67f5c;
                this Settings.tsx copy was missed in that pass and is
                cleaned up here. Per MEMORY's Kiddo Occasions section. */}

            {/* Close-this-fund used to render here. Relocated to the
                child tab on 2026-05-14 per the WHO/HOW information-
                architecture principle (membership = account-level;
                close-this-fund = per-fund; therefore lives in the
                fund-scoped tab, not the account-scoped tab). The
                close behavior itself is unchanged. See the new
                location at the bottom of the "child" tab. */}
          </div>
        )}

        {settingsTab === "notifications" && (
          <div className="space-y-4" data-testid="settings-notifications-panel">
            <SectionCard>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold))]">
                    <Star size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Parent lifecycle emails</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Kiddo sends a lightweight series so important moments do not rely on memory alone.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <NotificationSwitchRow
                    title="Activation nudges"
                    body="Follow-ups on days 1, 3, and 7 after fund creation."
                    checked={parentLifecycleSettings.activationNudges}
                    onCheckedChange={(checked) => updateParentLifecycleSetting("activationNudges", checked)}
                    testId="row-parent-activation-nudges"
                  />
                  <NotificationSwitchRow
                    title="Milestone emails"
                    body="When the first gift lands and when a fund crosses $100, $500, and $1,000."
                    checked={parentLifecycleSettings.milestoneEmails}
                    onCheckedChange={(checked) => updateParentLifecycleSetting("milestoneEmails", checked)}
                    testId="row-parent-milestone-emails"
                  />
                  <NotificationSwitchRow
                    title="Birthday and dormant reminders"
                    body="Before a birthday and after a long quiet stretch."
                    checked={parentLifecycleSettings.birthdayDormantReminders}
                    onCheckedChange={(checked) => updateParentLifecycleSetting("birthdayDormantReminders", checked)}
                    testId="row-parent-birthday-dormant"
                  />
                </div>
                <div className="hidden">
                  {[
                    ["Activation nudges", "Follow-ups on days 1, 3, and 7 after fund creation."],
                    ["Milestone emails", "When the first gift lands and when a fund crosses $100, $500, and $1,000."],
                    ["Birthday & dormant reminders", "Before a birthday and after a long quiet stretch."],
                  ].map(([title, body]) => (
                    <div key={title} className="flex gap-3">
                      <span className="mt-0.5 text-[hsl(var(--kiddo-gold))]">✦</span>
                      <div>
                        <p className="text-sm font-bold text-foreground">{title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="p-5">
                <h2 className="text-base font-bold text-foreground">Notifications for people who gifted</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Control whether opted-in people receive reminders and updates for {notificationChildName}'s fund.
                </p>
                <div className="mt-5 space-y-3">
                  <NotificationSwitchRow
                    title="Gift confirmations"
                    body="People receive a receipt and a note when their gift is invested."
                    checked={notificationSettings.giftConfirmations ?? true}
                    disabled={loadingGifterNotifications || updateGifterNotificationSettings.isPending}
                    onCheckedChange={(checked) => updateGifterNotificationSetting("giftConfirmations", checked)}
                    testId="row-gifter-gift-confirmations"
                  />
                  <NotificationSwitchRow
                    title="Birthday reminders"
                    body={`Annual reminder on ${notificationChildName}'s birthday with a one-tap gift-back path.`}
                    checked={notificationSettings.birthdayReminders ?? true}
                    disabled={loadingGifterNotifications || updateGifterNotificationSettings.isPending}
                    onCheckedChange={(checked) => updateGifterNotificationSetting("birthdayReminders", checked)}
                    testId="row-gifter-birthday-reminders"
                  />
                  <NotificationSwitchRow
                    title="Memory Book sharing"
                    body={`Lets you send warm parent-written updates. ${memoryBookSharesSent} of 4 used this year.`}
                    checked={notificationSettings.memoryBookSharing ?? true}
                    disabled={loadingGifterNotifications || updateGifterNotificationSettings.isPending}
                    onCheckedChange={(checked) => updateGifterNotificationSetting("memoryBookSharing", checked)}
                    meta="4 per year"
                    testId="row-gifter-memory-sharing"
                  />
                  <NotificationSwitchRow
                    title="Age-18 notification"
                    body={age18NotificationBody}
                    checked={notificationSettings.age18Notification ?? true}
                    disabled={loadingGifterNotifications || updateGifterNotificationSettings.isPending}
                    onCheckedChange={(checked) => updateGifterNotificationSetting("age18Notification", checked)}
                    testId="row-gifter-age18-notification"
                  />
                </div>
                <div className="hidden">
                  {[
                    ["Birthday reminders", `Annual reminder on ${primaryFund?.recipientFirstName || "your child"}'s birthday with a one-tap gift-back path.`],
                    ["Memory Book sharing", "Lets you send warm parent-written updates. 0 of 4 used this year."],
                    ["Age-18 notification", `Final thank-you note when control passes at adulthood. Planning anchor: ${primaryFund?.recipientBirthdate ? new Date(primaryFund.recipientBirthdate).toLocaleDateString("en-US") : "add a birthdate first"}.`],
                  ].map(([title, body]) => (
                    <div key={title} className="py-4 first:pt-0 last:pb-0">
                      <p className="text-sm font-bold text-foreground">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="p-5">
                <div className="mb-3">
                  <h2 className="text-base font-bold text-foreground">Memory Book entries from gifters</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Default: instant. Your gift link is private, and you can delete any entry anytime.
                  </p>
                </div>
                <NotificationSwitchRow
                  title="Require my approval first"
                  body="When on, gifter notes, photos, video, and voice land in a pending tray on your Memory Book until you approve them. Most parents leave this off so notes appear in real time as gifters add them."
                  checked={Boolean((primaryFund as any)?.gifterMemoryModeration)}
                  disabled={!primaryFund?.id || updateMemoryModeration.isPending}
                  onCheckedChange={(checked) => updateMemoryModeration.mutate(checked)}
                  testId="row-memory-moderation"
                />
              </div>
            </SectionCard>

            <SectionCard>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Gifter subscribers</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {gifterNotifications?.optedInCount || 0} {(gifterNotifications?.optedInCount || 0) === 1 ? "person" : "people"} opted in to receive notifications
                    </p>
                  </div>
                  {gifterNotifications?.nextBirthdayLabel && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Birthday</p>
                      <p className="text-xs font-semibold text-foreground">{gifterNotifications.nextBirthdayLabel}</p>
                    </div>
                  )}
                </div>
                {loadingGifterNotifications ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />)}
                  </div>
                ) : (() => {
                  const namedSubscribers = (gifterNotifications?.subscribers || []).filter((s: any) => !s.unsubscribed);
                  const anonymousActiveCount = Number(gifterNotifications?.anonymousActiveCount || 0);
                  const totalActiveCount = namedSubscribers.length + anonymousActiveCount;
                  if (totalActiveCount === 0) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        People who check the "keep me updated" box when they give will appear here.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {namedSubscribers.slice(0, 6).map((s: any) => (
                        <div key={s.email} className="flex items-center gap-3 rounded-xl bg-[hsl(var(--kiddo-surface))] border border-[hsl(var(--kiddo-border)/0.6)] px-3 py-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] text-xs font-bold select-none">
                            {(s.name || s.email).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{s.name || s.email}</p>
                            <p className="text-[11px] text-muted-foreground">{s.contributionCount} {s.contributionCount === 1 ? "gift" : "gifts"} · {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(s.totalContributed / 100)}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground shrink-0">
                            {s.lastGiftAt ? new Date(s.lastGiftAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </p>
                        </div>
                      ))}
                      {namedSubscribers.length > 6 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{namedSubscribers.length - 6} more named
                        </p>
                      )}
                      {/* Anonymous subscribers — count only, never names
                          or emails. The system has these to send
                          notifications, but the parent surface keeps the
                          gifter's anonymous promise. Per
                          feedback_anonymous_as_explicit_flag.md sub-rule
                          on extending the privacy promise to adjacent
                          affordances. */}
                      {anonymousActiveCount > 0 && (
                        <div className="flex items-center gap-3 rounded-xl bg-muted/30 border border-[hsl(var(--kiddo-border)/0.4)] px-3 py-2.5" data-testid="anonymous-subscribers-row">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold select-none">?</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {anonymousActiveCount} anonymous {anonymousActiveCount === 1 ? "subscriber" : "subscribers"}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Receive milestone updates. Names hidden because they gifted anonymously.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </SectionCard>

            <SectionCard>
              <div className="p-5">
                <h2 className="text-base font-bold text-foreground">Need help instead?</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  If a gift is missing, identity verification failed, or a link is acting strange, reach out directly and we will help you sort it out fast.
                </p>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.location.assign("mailto:support@kiddofund.com")} data-testid="button-settings-contact-support-compact">
                  Contact support
                </Button>
              </div>
            </SectionCard>
          </div>
        )}

        {settingsTab === "money" && (
          <div className="space-y-4" data-testid="settings-money-panel">

            {/* ── Investing group ── */}
            <p className="kiddo-section-label">Investing</p>

            <SectionCard>
              <div className="flex items-start gap-3 p-5">
                <Check size={18} className={`mt-0.5 ${kycCompleted ? "text-green-600" : "text-amber-500"}`} />
                <div>
                  <p className="text-sm font-bold text-foreground">{kycCompleted ? "Investing is active" : "Activate investing"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {kycCompleted ? "Identity verified. Your funds are investing automatically." : "Until we verify your identity, gifts collect as cash."}
                  </p>
                  {!kycCompleted && (
                    <Button size="sm" className="mt-3 rounded-xl" onClick={() => navigate("/activate")} data-testid="button-activate-investing-money-tab">
                      Activate investing
                    </Button>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="p-5">
                <h2 className="text-base font-bold text-foreground">
                  Investment strategy{primaryFund?.recipientFirstName ? ` for ${primaryFund.recipientFirstName}` : ""}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Where {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s` : "the fund's"} gifts go by default. Gifters can still personalize if you let them.
                </p>
                {primaryFund ? (
                  <div className="mt-5" data-testid="settings-money-strategy-editor">
                    <StrategyEditor
                      fund={primaryFund}
                      canUseCustom={userPlan === "family" || hasStarterEntitlement(starterByFund[String(primaryFund.id)])}
                      onSuccess={refreshAll}
                    />
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {/* "Gifter choices" section removed from the Money tab — the
                identical GifterInvestmentRulesEditor was rendering both here
                AND in the Gifts tab (Settings.tsx:3588 "What people can do"
                section). Same controls in two tabs meant changing them in
                one place was the same as changing in the other, with no
                downstream difference. The Gifts tab is the canonical home
                because these rules govern how the public gift page behaves —
                that's where the "Gift page" / link / visibility controls
                already live. Money tab stays focused on investing strategy
                + bank + withdrawals. */}

            {/* ── Recurring investments summary ── */}
            {/* Read-only summary that closes the parent-mental-model gap:
                "where do I see my recurring investments" should be answered
                in Settings → Money. The canonical management UI lives on the
                Dashboard (per the locked memory: recurring section ref +
                inline list view), so this card surfaces the count + monthly
                total + a link back. Deep-link scroll on the Dashboard side
                is a follow-up — see project_deep_link_scroll_pattern.md
                for the canonical pattern when wired. */}
            {(() => {
              const activeRecurring = (recurringContributions || []).filter((c) => String(c.status || "").toLowerCase() === "active");
              const totalMonthly = activeRecurring.reduce((sum, c) => sum + toMonthlyEquivalent(parseFloat(String(c.amount || "0")), c.frequency), 0);
              const nextRunDates = activeRecurring
                .map((c) => c.nextRunDate ? new Date(c.nextRunDate) : null)
                .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()))
                .sort((a, b) => a.getTime() - b.getTime());
              const nextRun = nextRunDates[0] || null;
              return (
                <SectionCard>
                  <div className="p-5">
                    <h2 className="text-base font-bold text-foreground">Recurring investments</h2>
                    {activeRecurring.length === 0 ? (
                      <>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          Set up automatic monthly contributions from the dashboard. {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s` : "The"} fund grows on its own rhythm.
                        </p>
                        <Link href="/dashboard">
                          <Button variant="outline" size="sm" className="mt-4 rounded-xl" data-testid="link-recurring-dashboard-empty">
                            Manage on dashboard
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {activeRecurring.length} active {activeRecurring.length === 1 ? "schedule" : "schedules"} · {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalMonthly)}/month
                          {nextRun ? ` · next runs ${nextRun.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}
                        </p>
                        <Link href="/dashboard">
                          <Button variant="outline" size="sm" className="mt-4 rounded-xl" data-testid="link-recurring-dashboard">
                            Manage on dashboard
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                </SectionCard>
              );
            })()}

            {/* ── Bank & withdrawals group ── */}
            <p className="kiddo-section-label pt-2">Bank & withdrawals</p>

            <SectionCard>
              <div className="p-5">
                <h2 className="text-base font-bold text-foreground">Linked bank</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {bankAccounts.length === 0 ? "No bank accounts linked yet." : `${bankAccounts.length} bank account${bankAccounts.length === 1 ? "" : "s"} linked.`}
                </p>
                <p className={`mt-1 text-sm font-semibold ${bankAccounts.length > 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-[hsl(var(--kiddo-gold-ink))]"}`}>
                  {bankAccounts.length > 0 ? "Withdrawals are connected." : "Link withdrawals to unlock full fund protection."}
                </p>
                {bankAccounts.length > 0 && (
                  <div className="mt-4 space-y-2" data-testid="settings-money-bank-list">
                    {bankAccounts.map((account: any) => (
                      <div key={account.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-4" data-testid={`settings-money-bank-${account.id}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.08)] text-[hsl(var(--kiddo-evergreen))]">
                            <Building2 size={17} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">{account.bankName || account.institutionName || "Linked bank"}</p>
                            <p className="text-xs text-muted-foreground">{account.accountType || "Account"} ending in {account.accountLast4 || account.lastFour || "----"}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDeleteBankAccount(account.id)}
                          data-testid={`button-remove-bank-${account.id}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => { setLinkBankOpen(true); haptic("selection"); }} data-testid="button-link-bank-compact">
                  {bankAccounts.length > 0 ? "Add another bank" : "Link bank account"}
                </Button>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Cash from sold investments can move to your linked bank after settlement. Usually 1-3 business days. Kiddo does not charge withdrawal fees.
                </p>
              </div>
            </SectionCard>

            {/* Taking money out — the single, deliberate home for withdrawal.
                Kept in Settings (not Dashboard) on purpose: withdrawal is irreversible,
                has tax implications, and shouldn't be one tap from the balance. */}
            <SectionCard>
              <div className="p-5">
                <h2 className="text-base font-bold text-foreground">Taking money out</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Move cash from {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s fund` : "this fund"} to your bank.
                  This is a deliberate action — once invested, the money belongs to {primaryFund?.recipientFirstName || "the child"},
                  so withdrawals are distributions to them and may have tax implications.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl"
                  onClick={() => { setWithdrawOpen(true); haptic("selection"); }}
                  disabled={!primaryFund || bankAccounts.length === 0}
                  data-testid="button-open-withdraw"
                >
                  Take money out
                </Button>
                {bankAccounts.length === 0 && (
                  <p className="mt-3 text-[11px] text-muted-foreground/70">
                    Link a bank account above first.
                  </p>
                )}
              </div>
            </SectionCard>

            {/* ── Tax & documents group ── */}
            {/* Promoted from the Child tab's Legal+documents subsection.
                Tax docs are time-sensitive financial documents (1099-DIV
                + 1099-B ship by January 31 every year per
                project_tax_document_timing_discipline.md), so they earn
                their own group in the Money tab where the parent expects
                financial-document concerns to live. The Child-tab link
                stays as a legal-trail entry point — same destination,
                different framing. */}
            <p className="kiddo-section-label pt-2">Tax & documents</p>

            <SectionCard>
              <div className="divide-y divide-[hsl(var(--kiddo-border))]">
                <Link
                  href="/tax-documents"
                  className="flex items-start justify-between gap-4 p-4 hover:bg-muted/30 transition-colors"
                  onMouseEnter={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
                  onTouchStart={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
                  onFocus={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
                  data-testid="link-tax-documents-money"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">Tax documents</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      1099-DIV and 1099-B ship by January 31 every year. They appear here automatically — no email needed.
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground">View</span>
                </Link>
              </div>
            </SectionCard>

            {/* Kid-owner tax section — hidden for parents. Self-mounts
                only when GET /api/me/tax-profile returns isKidOwner=true.
                Per AGE_18_HANDOFF_SPEC.md bucket 3. */}
            <KidOwnerTaxSection />
          </div>
        )}

        <TrustMicroStrip />

      </div>

      <AddFundSheet
        open={addFundOpen}
        onClose={() => setAddFundOpen(false)}
        onSuccess={() => {
          navigate("/dashboard");
        }}
      />

      <SellHoldingSheet
        open={sellHoldingOpen}
        onClose={() => { setSellHoldingOpen(false); setSelectedHolding(null); }}
        holding={selectedHolding}
        fund={selectedFundForAction}
        onSuccess={refreshAll}
      />

      <WithdrawSheet
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        fund={selectedFundForAction || primaryFund}
        bankAccounts={bankAccounts}
        bankAccountsLoading={bankAccountsLoading}
        onSuccess={refreshAll}
      />

      <LinkBankSheet
        open={linkBankOpen}
        onClose={() => setLinkBankOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] })}
      />

      <CollaboratorInviteModal
        isOpen={collabModalOpen}
        onClose={() => setCollabModalOpen(false)}
        fundName={primaryFund?.name || "your fund"}
        onSendInvite={handleSendCollabInvite}
      />

      {/* Close-fund modal — anti-dark-pattern register. Honest body, no
          guilt copy ("are you sure you'll lose..."), no retention puzzle,
          single confirm button. Optional reason field for product
          analytics; never required. Per
          project_cancellation_dark_pattern_avoidance.md +
          project_close_fund_design_lens.md. */}
      <Dialog open={closeFundOpen} onOpenChange={(o) => { if (!o) setCloseFundOpen(false); }}>
        <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="p-6">
            <DialogTitle className="font-heading text-xl font-bold text-foreground">
              Close {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s` : "this"} fund
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The gift link will stop accepting new contributions. You can reopen the fund any time.
            </DialogDescription>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">What stays</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  <li>· Memory Book entries (notes, photos, videos, voice memos)</li>
                  <li>· Activity history and audit trail</li>
                  <li>· Cash and invested holdings (no auto-withdrawal)</li>
                  <li>· The fund itself — closure is reversible</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">What stops</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  <li>· Public gift link refuses new contributions</li>
                  <li>· Active recurring investments are canceled</li>
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Want to take cash out? Use Money → Take money out. That's a separate, deliberate action.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Why are you closing? (optional)
              </label>
              <textarea
                value={closeFundReason}
                onChange={(e) => setCloseFundReason(e.target.value.slice(0, 200))}
                placeholder="Optional — helps us improve the product."
                rows={2}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[hsl(var(--kiddo-evergreen))] resize-none"
                data-testid="input-close-fund-reason"
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => { setCloseFundOpen(false); setCloseFundReason(""); }}
                disabled={closingFund}
                data-testid="button-cancel-close-fund"
              >
                Keep fund open
              </Button>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={handleCloseFund}
                disabled={closingFund}
                data-testid="button-confirm-close-fund"
              >
                {closingFund ? "Closing..." : "Close fund"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editFundOpen} onOpenChange={(o) => { if (!o) setEditFundOpen(false); }}>
        <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
          {(() => {
            // Title + subtitle adapt to who the fund belongs to. UTMA funds
            // get the child's name in the heading because this surface is
            // about a real specific person — Apple-Settings-with-warmth, not
            // a form-builder dialog. Personal funds keep the simpler "Edit
            // fund" framing because there's no recipient to address.
            const isUtma = isUTMAFund(editingFund);
            const childFirst = editingFund?.recipientFirstName?.trim() || "";
            // Two possessive forms — sentence-leading ("Emma's"/"Their") and
            // mid-sentence ("Emma's"/"their"). Capitalization matters: a
            // single forced .toLowerCase() turned "Emma's" into "emma's"
            // mid-sentence, which read as a typo.
            const possessiveMid = childFirst ? `${childFirst}'s` : "their";
            const title = isUtma
              ? (childFirst ? `Edit ${childFirst}'s details` : "Edit child's details")
              : "Edit fund";
            const subtitle = isUtma
              ? `Keep ${possessiveMid} details up to date. The first name and birthdate flow to tax documents and the brokerage account.`
              : "Update the basic details for this fund.";
            return (
              <>
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <div className="p-6 space-y-4">
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Fund name</label>
                    <input
                      type="text"
                      value={editFundName}
                      onChange={(e) => setEditFundName(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                      data-testid="input-edit-fund-name"
                    />
                  </div>

                  {isUtma && (
                    <>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">First name</label>
                        <input
                          type="text"
                          value={editRecipientName}
                          onChange={(e) => setEditRecipientName(e.target.value)}
                          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                          data-testid="input-edit-recipient-name"
                        />
                        {/* Quiet legal-record footnote — parents need to
                            know a name edit isn't cosmetic. UTMA brokerage
                            accounts and 1099s carry whatever's saved here. */}
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Use {possessiveMid} legal first name. This appears on the brokerage account and tax documents.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Date of birth</label>
                        {/* Modern shadcn calendar in a popover. Replaces
                            the native <input type="date"> for the same
                            reason as ActivateInvesting — consistent
                            cross-browser, matches the Kiddo design
                            system, year+month dropdowns make scrubbing
                            18 years of months instant. UTMA constraint
                            limits the upper bound: a child must be
                            under 18 at fund creation. Lower bound at
                            18 years ago covers every still-eligible
                            kid. Default month opens at ~5 years ago
                            (typical fund age) when no value is set. */}
                        {(() => {
                          const today = new Date();
                          const earliestDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                          const defaultFocusMonth = new Date(today.getFullYear() - 5, today.getMonth());
                          const dobDate = editRecipientBirthdate ? new Date(editRecipientBirthdate + "T12:00:00") : undefined;
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  data-testid="input-edit-recipient-birthdate"
                                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm flex items-center justify-between text-left"
                                >
                                  <span className={dobDate ? "text-foreground" : "text-muted-foreground/50"}>
                                    {dobDate
                                      ? dobDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                                      : "mm/dd/yyyy"}
                                  </span>
                                  <CalendarIcon size={14} className="shrink-0 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  captionLayout="dropdown"
                                  selected={dobDate}
                                  onSelect={(date) => {
                                    if (!date) return;
                                    const y = date.getFullYear();
                                    const m = String(date.getMonth() + 1).padStart(2, "0");
                                    const d = String(date.getDate()).padStart(2, "0");
                                    setEditRecipientBirthdate(`${y}-${m}-${d}`);
                                  }}
                                  fromYear={earliestDate.getFullYear()}
                                  toYear={today.getFullYear()}
                                  defaultMonth={dobDate || defaultFocusMonth}
                                  disabled={{ after: today, before: earliestDate }}
                                />
                              </PopoverContent>
                            </Popover>
                          );
                        })()}
                        {/* Birthdate isn't cosmetic either — it's the
                            anchor for the age-of-majority transfer date.
                            A parent fixing a typo should know that. */}
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Sets when the fund transfers to {childFirst || "them"} at the state's age of majority.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Pronouns</label>
                        <div className="flex gap-2">
                          {PRONOUN_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setEditPronoun(opt.value)}
                              className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-all ${
                                editPronoun === opt.value
                                  ? "border-primary bg-primary/5 text-foreground"
                                  : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40"
                              }`}
                              data-testid={`button-pronoun-${opt.value}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {editingFund && (
                    <FundDetailsSnapshot fund={editingFund} compact />
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEditFundOpen(false)}
                      data-testid="button-cancel-edit-fund"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSaveFundEdit}
                      disabled={savingFundEdit}
                      data-testid="button-save-edit-fund"
                    >
                      {savingFundEdit && <Loader2 size={14} className="mr-2 animate-spin" />}
                      Save changes
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelConfirm} onOpenChange={(o) => { if (!o && !canceling) { setShowCancelConfirm(false); setCancelStep("warn"); } }}>
        {/* Cancel-plan dialog. max-h + flex column on the outer
            DialogContent so the inner content can scroll when it
            exceeds the viewport. 90dvh (dynamic viewport height)
            handles mobile browser chrome correctly — vh would leave
            content under the address bar on iOS Safari.
            overflow-hidden stays on the outer so the rounded-2xl
            clip works at the corners. */}
        <DialogContent className="max-w-md w-[95vw] max-h-[90dvh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Cancel plan</DialogTitle>

          {cancelStep === "warn" ? (
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Hero. Reassurance first — the parent's first thought
                  opening this dialog is 'is my kid's money safe?' Answer
                  that before anything else. Then frame the billing
                  timeline calmly. Per the 2026-05-13 cancel-dialog rewrite
                  away from comparison-table register toward prose. */}
              <div className="space-y-2">
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s fund` : "Your fund"} stays safe.
                </h2>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {userPlan === "starter" ? "Kiddo+" : userPlan === "legacy" ? "Kiddo Legacy" : "Kiddo Family"} is paid through{" "}
                  {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "the end of your billing period"}.
                  After that, the plan moves to Free and your money keeps working. Still invested, still growing, gifts arriving the same way they always have.
                  {cancellationImpact && cancellationImpact.growthSinceSubscribed > 0.01 && (
                    <>
                      {" "}Your {cancellationImpact.funds.length === 1 ? "fund has" : "funds have"} grown ${cancellationImpact.growthSinceSubscribed.toFixed(0)} since you subscribed; that growth stays.
                    </>
                  )}
                </p>
              </div>

              {/* What changes — prose, not bullets. The same information
                  the previous comparison-table panel carried, woven into
                  conversational paragraphs. Personalization happens
                  inline so the sentence reads as written-by-Kiddo rather
                  than templated. Per the 2026-05-13 rewrite. */}
              <div className="space-y-3 text-sm text-foreground/80 leading-relaxed">
                <p className="font-semibold text-foreground">A few things change when you cancel:</p>

                {/* Recurring investments — folded into prose when 1-3
                    schedules; collapsed to a summary line when more.
                    Reads like a sentence, not a checklist. */}
                {cancellationImpact && cancellationImpact.parentContributions.length > 0 && (() => {
                  const contribs = cancellationImpact.parentContributions;
                  const monthlyTotal = cancellationImpact.parentContributionsMonthlyTotal;
                  if (contribs.length <= 3) {
                    const items = contribs.map((c, i) => {
                      const destLabel = c.executionModel === "pick" && c.selectedTicker
                        ? `${c.childName}'s ${c.selectedTicker} pick`
                        : `${c.childName}'s mix`;
                      const freq = c.frequency === "weekly" ? "/wk" : c.frequency === "yearly" ? "/yr" : "/mo";
                      return `$${c.amount.toFixed(0)}${freq} into ${destLabel}`;
                    });
                    const joined = items.length === 1
                      ? items[0]
                      : items.length === 2
                        ? `${items[0]} and ${items[1]}`
                        : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
                    return (
                      <p>
                        Your recurring investments pause: {joined}.
                        {monthlyTotal > 0 ? ` That's $${monthlyTotal.toFixed(0)}/month of automatic growth that stops until you turn the plan back on.` : ""}
                      </p>
                    );
                  }
                  return (
                    <p>
                      Your {contribs.length} recurring investments pause.
                      {monthlyTotal > 0 ? ` That's $${monthlyTotal.toFixed(0)}/month of automatic growth that stops until you turn the plan back on.` : ""}
                    </p>
                  );
                })()}

                {/* Gifter reminder schedules — only mentioned when present. */}
                {cancellationImpact && cancellationImpact.recurringGifts.length > 0 && (
                  <p>
                    Gift reminders going out to {cancellationImpact.recurringGifts.length === 1
                      ? cancellationImpact.recurringGifts[0].senderName
                      : `${cancellationImpact.recurringGifts.length} family members`} pause. They'll stop getting the email nudge.
                  </p>
                )}

                {/* Plan features that lock. Plus vs Family branch handled
                    via inline prose. Existing media + entries STAY — call
                    that out explicitly because parents otherwise worry
                    they'll lose what they've already added. */}
                {userPlan === "starter" ? (
                  <p>
                    Adding new photos, videos, and voice to Memory Book entries pauses. Every photo, voice memo, and parent-authored entry already there stays. Recurring investments and co-parent invites also pause.
                  </p>
                ) : (
                  <p>
                    Adding new photos, videos, and voice to Memory Book entries pauses across every child's fund. Everything you've already added stays. Recurring investments and co-parent invites pause too. The household overview becomes read-only, and funds beyond your first become view-only.
                  </p>
                )}
              </div>

              {/* Two-button stack: "Keep my plan" remains the primary action
                  (most parents who open this dialog accidentally tap close
                  or keep). The continue-to-cancel option is now a normal
                  text button — no more "I understand" prefix (subtly
                  accusatory, borrowed from Big Tech consent flows). Apple
                  Settings register: cancel is a normal action. */}
              <div className="space-y-2">
                <Button
                  className="w-full rounded-xl"
                  onClick={() => setShowCancelConfirm(false)}
                  data-testid="button-keep-plan"
                >
                  Keep my plan
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  onClick={() => setCancelStep("confirm")}
                  data-testid="button-proceed-to-cancel"
                >
                  Continue to cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="space-y-1">
                <h2 className="font-heading text-xl font-semibold text-foreground">Cancel {userPlan === "starter" ? "Kiddo+" : "Kiddo Family"}?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You'll move to Free
                  {subscription?.currentPeriodEnd ? ` on ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : " at the end of your billing period"}.
                  Your fund stays safe.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCancelStep("warn")} disabled={canceling}>
                  Go back
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-white"
                  disabled={canceling}
                  onClick={() => handleCancelSubscription({ plan: userPlan === "starter" ? "starter" : "family" })}
                  data-testid="button-confirm-cancel"
                >
                  {canceling ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Canceling...</> : "Yes, cancel"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {sharePages.length > 0 && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          pages={sharePages}
          recipientName={primaryFund?.recipientFirstName || primaryFund?.name || "your child"}
          giftCode={shareSummary?.giftCode ?? undefined}
        />
      )}

      {/* Co-parent invite wall — fires when a free user taps Invite
          on the Co-parent access card. fundId routed through so the
          Plus upgrade fires on the right fund (Plus is per-fund). */}
      <FeatureWallModal
        open={coParentWallOpen}
        onClose={() => setCoParentWallOpen(false)}
        featureId="co_parent_access"
        requiredTier="plus"
        title="Co-parent access is a Kiddo+ feature."
        body={`Invite a partner or guardian to see ${primaryFund?.recipientFirstName ? `${primaryFund.recipientFirstName}'s` : "your child's"} fund. They get viewer or co-admin access; their notes land in the Memory Book alongside yours; you can revoke anytime. You stay the legal custodian — they have no legal claim.`}
        upgradePath={primaryFund?.id ? `/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(primaryFund.id)}` : "/account?tab=plan"}
      />
    </div>
  );
}
