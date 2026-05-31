import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { ACTIVE_FUND_CHANGE_EVENT, getActiveFundId, setActiveFundId } from "@/hooks/use-active-fund";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useCachedFirstNumber } from "@/hooks/use-cached-first-number";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StockLogo } from "@/components/ui/stock-logo";
import { AddFundSheet } from "@/components/AddFundSheet";
import { FirstSellTaxExplainerModal, type FirstSellTaxExplainerPayload } from "@/components/FirstSellTaxExplainerModal";
import { PlanBenefitsCard } from "@/components/PlanBenefitsCard";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { SuccessorCustodianCard } from "@/components/SuccessorCustodianCard";
import { ChildIdentityCard } from "@/components/ChildIdentityCard";
import { FundDetailsCard } from "@/components/FundDetailsCard";
import { InvitationsToYouCard } from "@/components/InvitationsToYouCard";
import { CloseFundCard } from "@/components/CloseFundCard";
import { LegalDocumentsCard } from "@/components/LegalDocumentsCard";
import { CoParentAccessCard } from "@/components/CoParentAccessCard";
import { KidsViewCard } from "@/components/KidsViewCard";
import { FundSettingsChildPanel } from "@/components/FundSettingsChildPanel";
import { toast } from "@/hooks/use-toast";
import {
  CreditCard, Shield, Eye, EyeOff, Check,
  ChevronRight, ChevronDown, Star, Lock, Crown, ArrowUpRight, Wallet, Plus, Minus, Loader2,
  Building2, Trash2, TrendingDown, ArrowDownToLine, X, PieChart, Users, UserPlus, Pencil, Share2, ExternalLink, Camera,
  Calendar as CalendarIcon, Mail,
} from "lucide-react";
import { EMAIL_PREFERENCE_CATEGORIES } from "@shared/emailPreferences";
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
import { getMajorityDate, getMajorityAgeForState, US_STATES } from "@shared/utma";
import { prefetchDashboard, prefetchMemoryBook, prefetchActivity, prefetchTaxDocuments, onIdle } from "@/lib/prefetch";
import { AppHeader } from "@/components/layout/AppHeader";
import { FundTabs } from "@/components/layout/FundTabs";
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

// Email preference center card. Renders a toggle row per category
// from shared/emailPreferences.ts. Reads + writes via /api/me/email-
// preferences. Optimistic updates: the toggle flips immediately on
// click and reverts only if the PATCH fails.
//
// Required / transactional emails (password reset, verification,
// new-device alert, large-gift alert, age-transition emails, gift
// receipts) are NOT listed here — they're security/legal and
// always send.
function EmailPreferenceCenterCard() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/email-preferences", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const raw = (data?.preferences || {}) as Record<string, boolean>;
        setPrefs(raw);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isEnabled = (key: string): boolean => prefs[key] !== false;

  const togglePreference = async (key: string, nextEnabled: boolean) => {
    const prior = prefs[key];
    // Optimistic update.
    setPrefs((p) => ({ ...p, [key]: nextEnabled }));
    setSaving(key);
    try {
      const res = await fetch("/api/me/email-preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { [key]: nextEnabled } }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      // Revert.
      setPrefs((p) => ({ ...p, [key]: prior as any }));
      toast({ title: "Could not save preference", description: "Try again.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <SectionCard>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] text-[hsl(var(--kiddo-evergreen))]">
            <Mail size={16} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Email preferences</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pick which optional emails you want from Kiddo. Security and account emails (password reset, verification, new-device alerts, gift receipts) always send.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading preferences…</p>
          ) : (
            EMAIL_PREFERENCE_CATEGORIES.map((cat) => (
              <NotificationSwitchRow
                key={cat.key}
                title={cat.label}
                body={cat.description}
                checked={isEnabled(cat.key)}
                onCheckedChange={(next) => void togglePreference(cat.key, next)}
                disabled={saving === cat.key}
                testId={`row-email-pref-${cat.key}`}
              />
            ))
          )}
        </div>
      </div>
    </SectionCard>
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
              <p className="text-[11px] text-muted-foreground">No holdings yet. Kiddo invests new gifts automatically based on your strategy.</p>
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
  // Post-handoff adult owner: the UTMA has terminated at majority, so the money is
  // theirs outright — the "for the child's benefit" custodial restriction no longer
  // applies, and the fund reads as "your fund", not "{child}'s fund". 2026-05-29.
  const isOwnerMode = (fund as any)?.accessRole === "owner" && Boolean((fund as any)?.transferredAt);

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
            <p className="text-sm text-muted-foreground">The money stays inside {isOwnerMode ? "your" : `${fund?.recipientFirstName || "your child"}'s`} fund after settlement.</p>
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
              {fund.accountType === "UTMA" && !isOwnerMode
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
              {(fund as any)?.accessRole === "owner" && (fund as any)?.transferredAt
                ? "This account is yours now. Move cash to your linked bank anytime; it usually lands in 1 to 2 business days."
                : "For a child's fund, money already belongs to the child. Moving cash to your bank should be for their benefit."}
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
            <p className="text-sm text-muted-foreground">Used for recurring investments, withdrawals, and keeping your fund moving. Kiddo never sees your login credentials.</p>
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
      { ticker: "VTI", name: "Total Market Stocks", weight: 62, color: "#4F46E5" },
      { ticker: "VXUS", name: "International Stocks", weight: 28, color: "#0EA5E9" },
      { ticker: "BND", name: "Bonds", weight: 10, color: "#10B981" },
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
      { ticker: "VTI", name: "Total Market Stocks", weight: 50, color: "#4F46E5" },
      { ticker: "VXUS", name: "International Stocks", weight: 25, color: "#0EA5E9" },
      { ticker: "BND", name: "Bonds", weight: 25, color: "#10B981" },
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
      { ticker: "VTI", name: "Total Market Stocks", weight: 42, color: "#4F46E5" },
      { ticker: "BND", name: "Bonds", weight: 40, color: "#10B981" },
      { ticker: "VXUS", name: "International Stocks", weight: 18, color: "#0EA5E9" },
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

// Family-default stock picker on Settings → Gifting Defaults.
// Synced 2026-05-25 with the server's canonical
// ADMIN_ASSET_UNIVERSE source='stock_pick' set (17 stocks). Prior
// list had only 4 — parents could only set their family default to
// Disney, Apple, Nike, or Amazon even though the gifter picker
// shows 17. Now matches what gifters see.
const GIFTER_STOCK_OPTIONS = [
  { ticker: "DIS", name: "Disney" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "NKE", name: "Nike" },
  { ticker: "SBUX", name: "Starbucks" },
  { ticker: "NFLX", name: "Netflix" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "GOOGL", name: "Google" },
  { ticker: "SPOT", name: "Spotify" },
  { ticker: "RBLX", name: "Roblox" },
  { ticker: "NTDOY", name: "Nintendo" },
  { ticker: "DUOL", name: "Duolingo" },
  { ticker: "DPZ", name: "Domino's" },
  { ticker: "CHWY", name: "Chewy" },
  { ticker: "ABNB", name: "Airbnb" },
  { ticker: "ADBE", name: "Adobe" },
  { ticker: "TGT", name: "Target" },
  { ticker: "CMCSA", name: "Comcast" },
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
  // Broad market-cap starting point (no pre-selected sector tilt). The user
  // edits this freely; VGT and other tickers remain available to add by choice.
  { ticker: "VTI", weight: 62 },
  { ticker: "VXUS", weight: 28 },
  { ticker: "BND", weight: 10 },
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
          <p className="text-sm font-medium text-foreground">Managed mix</p>
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
  // Post-handoff adult owner: suppress the age-to-majority recommendation +
  // child horizon. yearsTo18 clamps to 0 past the 18th birthday, which would
  // otherwise force "Recommended: Conservative — best for children approaching
  // 18" onto a grown owner whose real horizon is decades. Let them just pick.
  const seIsOwnerMode = (fund as any)?.accessRole === "owner" && Boolean((fund as any)?.transferredAt);
  const recommendedKey = seIsOwnerMode ? null : recommendedStrategyKey(yearsTo18);
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
        // Toast copy mirrors the pre-save framing in the gold ribbon
        // above the Save button:
        //   • When invested > 0 (parent has real holdings): existing
        //     holdings stay; only NEW gifts follow the new mix. Say
        //     so explicitly. A parent who just saved Conservative
        //     and didn't read the ribbon should still understand
        //     from the toast alone that their existing $1k doesn't
        //     rebalance.
        //   • When invested == 0 (brand-new fund): no money to
        //     misallocate; the simpler "now using X" framing is
        //     accurate.
        const strategyLabel = STRATEGIES.find((s) => s.key === selected)?.label || selected;
        if (investedValue > 0) {
          toast({
            title: "Strategy updated",
            description: `New gifts and recurring investments now follow the ${strategyLabel}. Existing holdings stay as they are.`,
          });
        } else {
          toast({
            title: "Strategy updated",
            description: `Your fund now uses the ${strategyLabel}.`,
          });
        }
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
                  {/* At-a-glance stocks/bonds split per option. The one
                      number a parent actually weighs when choosing a mix
                      (growth vs steadiness) — shown inline so every card
                      self-describes without scrolling to the "Where gifts
                      go" breakdown below, which only reflects the selected
                      option. Bonds = the fixed-income sleeve (BND/BNDX/AGG);
                      everything else is equities. Skipped for Custom (no
                      preset allocation until the parent builds one). */}
                  {strategy.allocations.length > 0 && (() => {
                    const BOND_TICKERS = new Set(["BND", "BNDX", "AGG"]);
                    const bonds = strategy.allocations.reduce(
                      (sum, a) => sum + (BOND_TICKERS.has(String(a.ticker).toUpperCase()) ? a.weight : 0),
                      0,
                    );
                    const stocks = Math.max(0, 100 - bonds);
                    return (
                      <p className="text-[11px] font-medium text-muted-foreground/80 mt-1 tabular-nums">
                        {stocks}% stocks · {bonds}% bonds
                      </p>
                    );
                  })()}
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
            // Owner mode: yearsTo18 clamps to 0, which would render a nonsensical
            // "1-month annualized" child-horizon projection for a grown owner. Skip it.
            if (!range || yearsTo18 == null || seIsOwnerMode) return null;
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
                    : `Over by ${(totalCustom - 100).toFixed(0)}%. Reduce somewhere.`}
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
  // (Child-photo upload state + ref + handler moved into
  // ChildIdentityCard on 2026-05-14 — Phase 2 sheet-extraction
  // chunk 2.)
const [editFundName, setEditFundName] = useState("");
  const [editRecipientName, setEditRecipientName] = useState("");
  // Recipient's last name was missing from the Edit Fund modal for
  // months (added 2026-05-19 per the data-quality audit). Older funds
  // created via the GetStarted onboarding path don't have a last name
  // on file because that flow didn't ask for one; the only way to add
  // a last name post-hoc was via direct DB edit. This input closes
  // that gap. Required-on-save would break legacy funds; left as
  // optional with a clear "legal record" footnote so parents who care
  // fill it in. AddFundSheet still REQUIRES it at fund creation; this
  // edit surface accepts blank only because the existing data may be
  // blank.
  const [editRecipientLastName, setEditRecipientLastName] = useState("");
  const [editRecipientBirthdate, setEditRecipientBirthdate] = useState("");
  const [editPronoun, setEditPronoun] = useState<string>("they");
  // State of residence drives the UTMA age of majority (and thus the handoff
  // date). Editable so a parent can fix a wrong/missing state; the server
  // recomputes majorityAge from it on save (PATCH /api/funds/:id).
  const [editRecipientState, setEditRecipientState] = useState("");
  const [savingFundEdit, setSavingFundEdit] = useState(false);
  const [selectedSettingsFundId, setSelectedSettingsFundId] = useState<string>(() => getActiveFundId() || "");
  const [settingsFundMenuOpen, setSettingsFundMenuOpen] = useState(false);
  const settingsFundMenuRef = useRef<HTMLDivElement | null>(null);
  // (coParentWallOpen state moved into CoParentAccessCard on
  // 2026-05-14 — Phase 2 sheet-extraction chunk 7.)
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

  // Bank accounts query. initialData + writeLocalCache + bumped
  // staleTime added 2026-05-20 because the previous setup (60s
  // staleTime, no initialData) caused the setup-progress checklist
  // in the right rail to briefly render 'Link withdrawals to
  // unlock full fund protection' on every Settings mount before
  // the network resolved and the row flipped to 'Full fund
  // protection is in place.' Same anti-pattern as CoParentAccess
  // (commit f347fe2), InvitationsToYouCard, PlanBenefitsCard,
  // MemoryBook fundEvents (commit 936ede9). User-reported:
  // 'this thing is still loading on settings page briefly even
  // though it was already done.'
  //
  // The 5-minute staleTime is fine because bank account state
  // changes only via explicit user action (linking / unlinking),
  // both of which invalidate the query.
  const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      writeLocalCache("kiddo.bank-accounts.v1", data);
      return data;
    },
    enabled: !!user,
    initialData: () => readLocalCache<any[]>("kiddo.bank-accounts.v1"),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  const primaryFund = (selectedSettingsFundId && funds.find((f: any) => String(f.id) === String(selectedSettingsFundId))) || funds[0];
  // Display-capitalized kid first name. Used everywhere primaryFund's
  // name is rendered to user-facing copy. Form/state usages (the
  // Edit-fund modal, editingFund, editRecipientName, raw `fund?.`
  // references inside per-fund closures) intentionally keep the raw
  // value so saving doesn't mutate the parent's stored casing.
  const recipientFirstNameDisplay = capFirst(primaryFund?.recipientFirstName);

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

  // (pendingInvitations query moved into InvitationsToYouCard on
  // 2026-05-14 — Phase 2 sheet-extraction chunk 4. The card was
  // the only consumer in Settings, so the query moved with it.)

  // (collaborators query moved into CoParentAccessCard on
  // 2026-05-14 — Phase 2 sheet-extraction chunk 7. The only
  // remaining Settings.tsx consumer was the co-parent card; the
  // CollaboratorInviteModal still gets fresh data via the same
  // query key after invite mutations because they share the
  // query cache.)

  // (kidViewSettings query moved into KidsViewCard on 2026-05-14
  // — Phase 2 sheet-extraction chunk 8.)

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
      const childName = recipientFirstNameDisplay || "this fund";
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
      const childName = recipientFirstNameDisplay || "This fund";
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
      label: `${recipientFirstNameDisplay || primaryFund.name}'s gift link`,
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
  }, [primaryFund?.slug, recipientFirstNameDisplay, primaryFund?.name, shareSummary?.giftCode?.code, shareSummary?.eventGiftCodes, shareSummary?.events]);

  // (Kid View state + handlers — copyingKidLink, showPinManager,
  // newPin, newPinHint, savingPin, the auto-open useEffect,
  // handleSavePin, handleCopyKidViewLink — all moved into
  // KidsViewCard on 2026-05-14 — Phase 2 sheet-extraction chunk 8.)

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
  // Optional churn-capture state (G3). Cleared whenever the dialog closes so a
  // reopened dialog starts blank. Sent with the cancel POST; never required.
  const [cancelReason, setCancelReason] = useState<string>("");
  const [likedMost, setLikedMost] = useState<string>("");
  useEffect(() => {
    if (!showCancelConfirm) { setCancelReason(""); setLikedMost(""); }
  }, [showCancelConfirm]);
  const [cancelStep, setCancelStep] = useState<"warn" | "confirm">("warn");
  // Successor custodian editor (Settings → Child tab). Pre-populated from
  // the fund record on expand; edits go through PATCH /api/funds/:id which
  // already writes the appropriate successor_custodian_* activity entry.
  // (Successor-custodian state moved into SuccessorCustodianCard on
  // 2026-05-14 — Phase 2 sheet-extraction chunk 1. See that file
  // for the editor/save/remove implementation.)
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
  const notificationMajorityAge = Number((selectedNotificationFund as any)?.majorityAge) || 18;
  const notificationAgeTransition = getAge18Transition(
    selectedNotificationFund?.recipientBirthdate,
    notificationMajorityAge,
  );
  // Title + body honor the fund's state-specific majority age. The
  // "Age-18 notification" / "control passes at adulthood" copy was
  // hardcoded — accurate for the 18-state default, wrong for any fund
  // in a 21-state or custom-25 statute. Audit 2026-05-25 caught.
  const age18NotificationTitle = `Age-${notificationMajorityAge} notification`;
  const age18NotificationBody = !notificationAgeTransition
    ? `Final thank-you note when control passes at ${notificationMajorityAge}. Add a birthdate first.`
    : notificationAgeTransition.stage === "adult"
      ? `Age-${notificationMajorityAge} handoff is ready now. Review transfer steps before sending this note.`
      : `Final thank-you note when control passes at ${notificationMajorityAge}. Planning anchor: ${formatAgeTransitionDate(notificationAgeTransition.eighteenthBirthday)}.`;
  // The active notification fund has already transferred to the owner → the
  // age-of-majority handoff note no longer applies (hide the row below).
  const notificationFundIsOwnerHeld =
    (selectedNotificationFund as any)?.accessRole === "owner" &&
    Boolean((selectedNotificationFund as any)?.transferredAt);
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
        body: JSON.stringify({
          ...(opts || {}),
          cancelReason: cancelReason || undefined,
          likedMost: likedMost.trim() || undefined,
        }),
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

  // (handleDeleteCollaborator moved into CoParentAccessCard on
  // 2026-05-14 — Phase 2 sheet-extraction chunk 7.)

  const openEditFundDialog = (fund: any) => {
    setEditingFund(fund);
    setEditFundName(fund?.name || "");
    setEditRecipientName(fund?.recipientFirstName || "");
    setEditRecipientLastName(fund?.recipientLastName || "");
    setEditPronoun(fund?.pronoun || "they");
    setEditRecipientState(fund?.recipientState || "");
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
        // Trim + send empty string as null so a parent can also CLEAR
        // a last name (rare but possible: typo correction, legal name
        // change). Server PATCH treats null as "remove existing value."
        const trimmedLast = editRecipientLastName.trim();
        payload.recipientLastName = trimmedLast.length > 0 ? trimmedLast : null;
        payload.recipientBirthdate = editRecipientBirthdate
          ? new Date(`${editRecipientBirthdate}T00:00:00.000Z`).toISOString()
          : null;
        payload.pronoun = editPronoun || "they";
        // Send the state; the server recomputes majorityAge from it (empty =>
        // null + federal default 18). Keeps state and majority age in lockstep.
        payload.recipientState = editRecipientState || null;
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
      // Added 2026-05-15 (Ring C of the managed-strategy audit). The
      // strategy editor's onSuccess routes through here. Dashboard hero,
      // chart, holdings, projection-at-65, and the custom-mix display
      // all derive from these two caches; without invalidating them,
      // a parent who saves Conservative in Settings sees Dashboard
      // still showing the old strategy until the next 30-60s
      // staletime window expires. The Dashboard's own quick-switch
      // nudge has always done this — refreshAll was the missing
      // mirror of that pattern.
      queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund.id, "dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund.id, "strategy"] });
    }
  };

  const isAnyFundDiscoverable = funds.some((f: any) => f.isDiscoverable);

  // (handleChildPhotoUpload moved into ChildIdentityCard on
  // 2026-05-14 — Phase 2 sheet-extraction chunk 2.)

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
      <AppHeader />
      <div className="kiddo-canvas px-4 py-6 space-y-6">
        {/* Fund switcher tabs for Settings — multi-fund parents need
            to switch which kid's settings they're editing without
            backtracking through Dashboard. Same component as the
            Dashboard's FundTabs (introduced 2026-05-26); renders
            nothing for single-fund parents. Audit 2026-05-26 caught
            the gap: the hero copy "tap the name to switch child"
            had no clear referent because there was no name-row to
            tap on Settings (the AppHeader dropdown was the implicit
            answer but discoverability was poor). With FundTabs
            rendered here, the copy now points at a visible row of
            tabs. */}
        <FundTabs funds={funds} activeFundId={selectedSettingsFundId} />

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
        {/* Demo accounts skip this whole setup block — the demo funds are
            fully established (gifts already flowing) and steps like "link
            withdrawals" can't be completed in the sandbox, so the nudge
            would be a dead-end nag. Mirrors the Dashboard's existing
            !isDemoAccount gate on the same nudge. Added 2026-05-26. */}
        {!(user as any)?.isDemoAccount && (setup.percent < 100 ? (
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
        ) : null)}

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
                  {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "This"} fund is closed
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

        {/* Settings hero strip — added 2026-05-25 to close the design-debt
            gap between Dashboard's rich hero ceremony and the secondary
            pages' "form-config" baseline. Settings doesn't need pyrotechnics
            (it's settings), but it does need a sense of place. The eyebrow
            + headline + 1-line context tells the parent WHERE they are and
            FOR WHICH FUND they're configuring — same anchoring discipline
            Apple's iOS Settings uses (clean rows + considered section
            headers). The fund-scope language ("Emma's fund" + Account
            settings link) was previously buried below the tab row; moved
            up so it reads as the page's intent statement, not a
            footnote. Quiet motion: fade-in from 6px down, no count-ups,
            no gradient — restrained register matches "settings" semantics.
            Only renders when there's a primaryFund (skips the no-fund
            empty state that's already handled upstream). */}
        {primaryFund && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="px-1"
            data-testid="settings-hero"
          >
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
              Settings
            </p>
            {/* Multi-fund parents get an in-place fund switcher on the
                headline. The per-fund tabs below (Child / Money / Gifts)
                silently scope to ONE child, so with several kids a bare
                "this fund" reads as ambiguous — "which one did it land
                on?" Naming the child AND making it a picker answers both
                "which fund am I editing" and "how do I switch" without
                leaving Settings. Single-fund parents keep the static
                headline; there's nothing to disambiguate. Reuses the
                pre-existing selectSettingsFund + settingsFundMenuOpen
                plumbing (state, ref, outside-click/Escape close). */}
            {funds.length > 1 ? (
              <div className="relative mt-1 w-fit" ref={settingsFundMenuRef}>
                <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground leading-tight">
                  <button
                    type="button"
                    onClick={() => { setSettingsFundMenuOpen((o) => !o); haptic("selection"); }}
                    className="group inline-flex items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-haspopup="listbox"
                    aria-expanded={settingsFundMenuOpen}
                    data-testid="settings-fund-switcher"
                  >
                    {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "This fund"}
                    <ChevronDown
                      size={20}
                      className={`shrink-0 text-muted-foreground transition-transform group-hover:text-foreground ${settingsFundMenuOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                </h1>
                {settingsFundMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Choose a fund to configure"
                    className="absolute left-0 z-20 mt-1.5 max-h-72 w-64 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-lg"
                    data-testid="settings-fund-dropdown"
                  >
                    {funds.map((f: any) => {
                      const selected = String(f.id) === String(primaryFund?.id);
                      const name = capFirst(f.recipientFirstName) || f.name || "Fund";
                      return (
                        <button
                          key={f.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => selectSettingsFund(f)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${selected ? "bg-[hsl(var(--kiddo-cream))]" : "hover:bg-muted/60"}`}
                          data-testid={`settings-fund-option-${f.id}`}
                        >
                          <span className="truncate text-sm font-semibold text-foreground">{name}'s fund</span>
                          {selected && <Check size={16} className="shrink-0 text-foreground" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground leading-tight">
                {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "Your fund"}
              </h1>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {funds.length > 1 ? (
                <>These settings apply only to {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "the fund above"}. Tap the tabs above to switch child.{" "}</>
              ) : (
                <>Changes apply to this fund.{" "}</>
              )}
              <Link href="/account" className="underline underline-offset-2 hover:text-foreground">
                Account settings →
              </Link>
            </p>
          </motion.div>
        )}

        <div className="space-y-2">
          <div className="kiddo-tab-row max-w-full overflow-x-auto" data-testid="settings-tabs" role="tablist" aria-label="Settings sections">
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
              { id: "child", label: ((primaryFund as any)?.accessRole === "owner" && Boolean((primaryFund as any)?.transferredAt)) ? "Account" : "Child" },
              { id: "gifts", label: "Gifts" },
              { id: "notifications", label: "Notifications" },
              { id: "money", label: "Money" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={settingsTab === tab.id}
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
          {/* Inline 'Changes apply to this fund · Account settings →'
              footnote moved into the Settings hero strip above 2026-05-25.
              Keeping the helper anchor in one place — having the same
              line ABOVE and BELOW the tab row was duplicative once the
              hero shipped. The hero strip's version is the single
              source of truth for the per-fund / account-global
              distinction. */}
        </div>

        {/* Tab-fade transitions added 2026-05-25. Each branch wraps in
            a motion.div keyed by the tab name so switching tabs reads
            as a soft fade-in, not an instant swap. No exit animation
            — only one branch can be active at a time so the previous
            unmounts immediately when the new one mounts; the entrance
            fade is what carries the "considered design" feeling. Quiet
            register: 280ms / 6px / out-expo. Matches the page-hero
            entrance timing for visual coherence. */}
        {settingsTab === "child" && primaryFund && (
          // The full Child-tab body now lives in FundSettingsChildPanel
          // (chunk 9). Same composition, same eight cards, same order.
          // The panel takes callbacks for the three modals Settings
          // still owns (Edit fund, Invite co-parent, Close fund) and
          // composes everything else internally. (The chunk 10
          // FundSettingsSheet that previously also mounted this panel
          // from Dashboard was removed 2026-05-15 — the Dashboard
          // entry-point card was redundant with the canonical /settings
          // nav entry, and the sheet's split-brain UX bounced every
          // write action back here anyway. Settings is now the single
          // mount point.)
          <motion.div
            key="settings-tab-child"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <FundSettingsChildPanel
              fund={primaryFund as any}
              user={user as any}
              userPlan={userPlan}
              kidViewQueryEnabled={settingsTab === "child"}
              onEditFund={() => setEditFundOpen(true)}
              onOpenInviteModal={() => setCollabModalOpen(true)}
              onOpenCloseDialog={() => setCloseFundOpen(true)}
            />
          </motion.div>
        )}

        {settingsTab === "gifts" && (
          <motion.div
            key="settings-tab-gifts"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
            data-testid="settings-gifts-panel"
          >
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
                {/* Visibility is a FIXED guarantee for a child's fund, not a
                    toggle. Minors' funds are never publicly discoverable
                    (Legal.tsx privacy section, Security.tsx, COPPA posture +
                    the design note's "for minors: never"). Adult-only
                    findability is a separate, not-yet-surfaced feature
                    (handleToggleDiscoverable); it is intentionally NOT exposed
                    here. Styled as an info panel (lock + one-line guarantee) to
                    match the gift-link box above, so it doesn't read as a
                    dormant/broken settings toggle. */}
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock size={14} className="text-muted-foreground" />
                      Visibility
                    </span>
                    <span className="text-sm font-semibold text-foreground">Link only · Private</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Only people you share the link with can reach this fund. {((primaryFund as any)?.accessRole === "owner" && Boolean((primaryFund as any)?.transferredAt)) ? "It is never publicly searchable." : "Funds for children are never publicly searchable."}
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* What gifters can do */}
            <SectionCard>
              <div className="p-5">
                <p className="kiddo-section-label mb-1">What people can do</p>
                <p className="text-[11px] text-muted-foreground mb-4">Choose how personal gifts can be for {recipientFirstNameDisplay || "your child"}.</p>
                {primaryFund ? (
                  <div data-testid="settings-gifts-gifter-rules-editor">
                    <GifterInvestmentRulesEditor fund={primaryFund} onSuccess={refreshAll} />
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {/* Gifter Memory Book moderation. Lives on the Gifts tab with the
                other gifter-content controls (gift-page visibility + "what
                people can do") rather than Notifications, because it gates what
                gifters may put in the Memory Book (a content control, not an
                email/reminder preference). Moved 2026-05-28. Header restyled to
                the kiddo-section-label convention so it reads native next to
                "Gift page" and "What people can do". */}
            <SectionCard>
              <div className="p-5">
                <p className="kiddo-section-label mb-1">Memory Book entries from gifters</p>
                <p className="text-[11px] text-muted-foreground mb-4">Default: instant. Your gift link is private, and you can delete any entry anytime.</p>
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
          </motion.div>
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
                        {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund is safe.` : "Your fund is safe."} Always.
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
                const planLabel = cardPlan === "starter" ? "Plus" : cardPlan === "family" ? "Family" : "Legacy";
                if (cardRank > currentRank) return `Upgrade to ${planLabel}`;
                // 'Switch to' -> 'Downgrade to' for lower-tier cards.
                // See parallel comment in Account.tsx ctaLabel for the
                // Apple-Settings register reasoning.
                return `Downgrade to ${planLabel}`;
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
                    {/* Bullets aligned with Pricing + Account 2026-05-20.
                        See twin comment on Account.tsx for the
                        clarity-audit reasoning. The drift was on
                        the Family bullet's parenthetical ("photos,
                        videos, voice") and the "with premium features
                        included" suffix — both wrongly implied
                        feature differentials where there are none.
                        Family vs Plus is SCOPE (multi-fund), not
                        feature additions. */}
                    {["Unlimited funds, every child", "Memory Book for every child", "Unlimited occasions", "Kid View for every child", "One view for every fund in your household"].map((item) => (
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
          <motion.div
            key="settings-tab-notifications"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
            data-testid="settings-notifications-panel"
          >
            <EmailPreferenceCenterCard />

            <SectionCard>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold))]">
                    <Star size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">{notificationFundIsOwnerHeld ? "Lifecycle emails" : "Parent lifecycle emails"}</h2>
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
                    body={`Lets you send warm ${notificationFundIsOwnerHeld ? "" : "parent-written "}updates. ${memoryBookSharesSent} of 4 used this year.`}
                    checked={notificationSettings.memoryBookSharing ?? true}
                    disabled={loadingGifterNotifications || updateGifterNotificationSettings.isPending}
                    onCheckedChange={(checked) => updateGifterNotificationSetting("memoryBookSharing", checked)}
                    meta="4 per year"
                    testId="row-gifter-memory-sharing"
                  />
                  {/* The age-of-majority handoff notification is meaningless on a
                      fund that has ALREADY transferred to the owner — the handoff
                      happened, there's no future "transfer note" to send. Hide it
                      in owner mode (it otherwise renders "Age-21 handoff is ready
                      now" to a grown owner who already owns the account). */}
                  {!notificationFundIsOwnerHeld && (
                    <NotificationSwitchRow
                      title={age18NotificationTitle}
                      body={age18NotificationBody}
                      checked={notificationSettings.age18Notification ?? true}
                      disabled={loadingGifterNotifications || updateGifterNotificationSettings.isPending}
                      onCheckedChange={(checked) => updateGifterNotificationSetting("age18Notification", checked)}
                      testId="row-gifter-age18-notification"
                    />
                  )}
                </div>
                <div className="hidden">
                  {[
                    ["Birthday reminders", `Annual reminder on ${recipientFirstNameDisplay || "your child"}'s birthday with a one-tap gift-back path.`],
                    ["Memory Book sharing", "Lets you send warm parent-written updates. 0 of 4 used this year."],
                    [age18NotificationTitle, age18NotificationBody],
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
          </motion.div>
        )}

        {settingsTab === "money" && (
          <motion.div
            key="settings-tab-money"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
            data-testid="settings-money-panel"
          >

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
                  Investment strategy{recipientFirstNameDisplay ? ` for ${recipientFirstNameDisplay}` : ""}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Where {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "the fund's"} gifts go by default. Gifters can still personalize if you let them.
                </p>
                {primaryFund ? (
                  <div className="mt-5" data-testid="settings-money-strategy-editor">
                    <StrategyEditor
                      fund={primaryFund}
                      // Custom mix is FREE for the post-handoff adult owner — no
                      // paywall on your own account. Matches the server's
                      // resolveAllowedFundStrategy owner exception + commit 96057c2
                      // / LIFECYCLE_MONETIZATION (subscription retires at majority;
                      // self-allocation is table-stakes). The plan gate still
                      // applies to parents managing a minor's fund.
                      canUseCustom={
                        (((primaryFund as any)?.accessRole === "owner") && Boolean((primaryFund as any)?.transferredAt)) ||
                        userPlan === "family" ||
                        hasStarterEntitlement(starterByFund[String(primaryFund.id)])
                      }
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
                          Set up automatic monthly contributions from the dashboard. {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The"} fund grows on its own rhythm.
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
                  {((primaryFund as any)?.accessRole === "owner" && Boolean((primaryFund as any)?.transferredAt)) ? (
                    <>Move cash from your fund to your bank. This is a deliberate action. The money is yours; selling investments to withdraw may have capital-gains tax implications.</>
                  ) : (
                    <>Move cash from {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "this fund"} to your bank. This is a deliberate action. Once invested, the money belongs to {recipientFirstNameDisplay || "the child"}, so withdrawals are distributions to them and may have tax implications.</>
                  )}
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
                      1099-DIV and 1099-B ship by January 31 every year. They appear here automatically. No email needed.
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
          </motion.div>
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
        <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl flex max-h-[90vh] flex-col">
          {/* Scrollable body — capped to 90vh with the action buttons pinned
              in a non-scrolling footer below, so on short/mobile viewports the
              disclosure scrolls and the confirm/cancel buttons stay reachable
              instead of being clipped off the bottom of the screen. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <DialogTitle className="font-heading text-xl font-bold text-foreground">
              Close {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "this"} fund
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The public gift link stops accepting new contributions. You can reopen anytime from this same page.
            </DialogDescription>

            {/* Pre-confirmation disclosure cards. Rewritten 2026-05-15
                to disclose every actual server-side effect of POST
                /api/funds/:id/close (server/routes.ts:6335). Previous
                copy hid two material behaviors: co-parent access
                revocation + pending-invite revocation. It also
                under-specified what gifters see at the closed public
                link and didn't mention the 0.10% AUM fee continuing
                to apply on invested balance. Per the kid-at-18 lens
                + the anti-dark-pattern locked principle, deletion-
                style destructive actions must be HONEST and
                SPECIFIC, not gentle and vague. */}
            <div className="mt-5 space-y-3">
              {(() => {
                const who = recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The kid's";
                // [bold lead, muted detail]. Lead carries the noun, detail the
                // consequence — so the parent scans the leads and reads detail
                // only where it matters. Reversibility stated once (the fund
                // bullet), not three times. Honest, no guilt copy — per
                // project_cancellation_dark_pattern_avoidance.md.
                const stays: [string, string][] = [
                  ["Memory Book entries.", `Notes, photos, videos, voice memos. ${who} keepsake.`],
                  ["Activity history.", "The full record and audit trail stay intact."],
                  ["Cash and invested holdings.", "Safe at our broker-dealer partner, with no auto-withdrawal."],
                  [`${who} View.`, "The PIN-protected view keeps working."],
                  ["The fund itself.", "Paused, never deleted. Reopen from this page anytime."],
                ];
                const stops: [string, string][] = [
                  ["The public gift link.", `Visitors see "This gift page is closed" with a friendly note.`],
                  ["Active recurring investments.", "These cancel. Re-create them when you reopen."],
                  ["Co-parent access.", "For everyone on the list, including pending invites. Re-invite on reopen."],
                  ["New occasions.", "Existing occasions pause with the fund; goal progress is preserved."],
                ];
                return (
                  <>
                    <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.22)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.14)]">
                          <Check className="h-3 w-3 text-[hsl(var(--kiddo-evergreen))]" />
                        </span>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--kiddo-evergreen))]">What stays</p>
                      </div>
                      <ul className="mt-3 space-y-2.5">
                        {stays.map(([lead, detail]) => (
                          <li key={lead} className="flex items-start gap-2.5 text-sm leading-snug">
                            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                            <span><span className="font-semibold text-foreground">{lead}</span> <span className="text-muted-foreground">{detail}</span></span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 border-t border-[hsl(var(--kiddo-evergreen)/0.15)] pt-2.5 text-xs leading-relaxed text-muted-foreground">
                        The annual fee ($1/yr per $1,000 invested) still applies to invested balance until you withdraw.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/10">
                          <Minus className="h-3 w-3 text-muted-foreground" />
                        </span>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">What stops</p>
                      </div>
                      <ul className="mt-3 space-y-2.5">
                        {stops.map(([lead, detail]) => (
                          <li key={lead} className="flex items-start gap-2.5 text-sm leading-snug">
                            <Minus className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                            <span><span className="font-semibold text-foreground">{lead}</span> <span className="text-muted-foreground">{detail}</span></span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 border-t border-border pt-2.5 text-xs italic leading-relaxed text-muted-foreground">
                        Gifts already paid but still settling (1–2 business days) still arrive in the fund. Closing doesn't claw them back.
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Want to withdraw cash first? Use Money → Take money out. It's a separate, deliberate action.
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Why are you closing? (optional)
              </label>
              <textarea
                value={closeFundReason}
                onChange={(e) => setCloseFundReason(e.target.value.slice(0, 200))}
                placeholder="Tell us what didn't work. Not shared, used for product analytics."
                rows={2}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[hsl(var(--kiddo-evergreen))] resize-none"
                data-testid="input-close-fund-reason"
              />
            </div>

          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
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
                      {/* Last name — added 2026-05-19 per the data-quality
                          audit. Was a real gap: AddFundSheet requires last
                          name at fund creation, but GetStarted onboarding
                          didn't ask for it, and this Edit Fund modal had no
                          field. Result: funds created via onboarding had no
                          way to gain a last name. Now editable here. Empty
                          string saves as null (lets parents also clear an
                          incorrect one). */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">Last name</label>
                        <input
                          type="text"
                          value={editRecipientLastName}
                          onChange={(e) => setEditRecipientLastName(e.target.value)}
                          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                          data-testid="input-edit-recipient-last-name"
                          autoComplete="family-name"
                        />
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Optional, but appears on tax documents and the brokerage account record when set.
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
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">State of residence</label>
                        <select
                          value={editRecipientState}
                          onChange={(e) => setEditRecipientState(e.target.value)}
                          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                          data-testid="select-edit-recipient-state"
                        >
                          <option value="">Not set (defaults to age 18)</option>
                          {US_STATES.map((s) => (
                            <option key={s.code} value={s.code}>{s.name}</option>
                          ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          {editRecipientState
                            ? `UTMA control transfers to ${childFirst || "them"} at age ${getMajorityAgeForState(editRecipientState)} in ${US_STATES.find((s) => s.code === editRecipientState)?.name || editRecipientState}.`
                            : "Sets the age of majority for the handoff. Without it we use 18 (the most common), which is wrong in states like PA, NY, and TX (21)."}
                        </p>
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
            <div className="flex-1 min-h-0 p-6 space-y-5 overflow-y-auto">
              {/* Hero. Reassurance first — the parent's first thought
                  opening this dialog is 'is my kid's money safe?' Answer
                  that before anything else. Then frame the billing
                  timeline calmly. Per the 2026-05-13 cancel-dialog rewrite
                  away from comparison-table register toward prose. */}
              <div className="space-y-2">
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "Your fund"} stays safe.
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

                {/* Gifter recurring — reassure it KEEPS running. It's the
                    gifter's own commitment on their own card; your plan change
                    doesn't stop it (only YOUR recurring pauses). */}
                {cancellationImpact && cancellationImpact.recurringGifts.length > 0 && (
                  <p>
                    The recurring gifts {cancellationImpact.recurringGifts.length === 1
                      ? cancellationImpact.recurringGifts[0].senderName
                      : `${cancellationImpact.recurringGifts.length} family members`} set up keep running. Those are on their own cards, so your plan change doesn't stop them.
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
            <div className="flex-1 min-h-0 p-6 space-y-5 overflow-y-auto">
              <div className="space-y-1">
                <h2 className="font-heading text-xl font-semibold text-foreground">Cancel {userPlan === "starter" ? "Kiddo+" : "Kiddo Family"}?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You'll move to Free
                  {subscription?.currentPeriodEnd ? ` on ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : " at the end of your billing period"}.
                  Your fund stays safe.
                </p>
              </div>

              {/* Optional churn capture (G3 / TACTICAL_RETENTION_SPEC.md). Two
                  optional questions, no save-gauntlet (honors
                  project_cancellation_dark_pattern_avoidance). "What did you like
                  most?" is the Nostalgia question — primarily a research signal;
                  both persist on Stripe's native cancellation_details. */}
              <div className="space-y-3 rounded-xl bg-muted/30 p-3.5">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground/80">
                    Mind sharing why? <span className="font-normal text-muted-foreground">(optional)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "too_expensive", label: "Too expensive" },
                      { value: "not_using", label: "Not using it" },
                      { value: "missing_features", label: "Missing a feature" },
                      { value: "confusing", label: "Too confusing" },
                      { value: "switched", label: "Using something else" },
                      { value: "other", label: "Other" },
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setCancelReason((cur) => (cur === r.value ? "" : r.value))}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          cancelReason === r.value
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`cancel-reason-${r.value}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="liked-most" className="block text-xs font-medium text-foreground/80">
                    What did you like most? <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="liked-most"
                    value={likedMost}
                    onChange={(e) => setLikedMost(e.target.value.slice(0, 300))}
                    rows={2}
                    placeholder="The thing you'd miss…"
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="input-liked-most"
                  />
                </div>
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
          recipientName={recipientFirstNameDisplay || primaryFund?.name || "your child"}
          giftCode={shareSummary?.giftCode ?? undefined}
          recipientIsOwner={Boolean((primaryFund as any)?.transferredAt)}
        />
      )}

      {/* Co-parent invite wall — moved into CoParentAccessCard on
          2026-05-14 (Phase 2 chunk 7) so its state lives next to
          its trigger. */}
    </div>
  );
}
