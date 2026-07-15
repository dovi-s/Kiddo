// RecurringEditSheet — full in-place edit/setup sheet for a recurring investment.
//
// Feature parity with the dashboard modal, so Activity's "Edit" opens THIS in
// place (no jump): amount + frequency, the "Where should it go?" destination
// picker (fund default with its live allocation, or pick a single stock), the
// at-majority projection, bank, and save. Self-contained — owns its state, fetches
// its own prefs/quotes, computes its own projection, and saves via the same
// endpoint the dashboard uses. Additive: the dashboards keep their modal until a
// later pass points them at this shared component too.

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Repeat, Building2 } from "lucide-react";
import { StockLogo } from "@/components/ui/stock-logo";
import { ManagedMixGlyph } from "@/components/ui/managed-mix-icon";
import { STRATEGY_LABEL } from "@/lib/strategy";
import { getAge18Transition } from "@/lib/age-transition";
import { projectFundValue } from "@shared/projection";
import { investingLiveCopy, PROJECTION_DISCLAIMER } from "@shared/legal-copy";
import { STOCK_PICKS } from "@shared/stock-picks";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { demoBlocked } from "@/lib/demo-block";
import { formatMoneyFriendly } from "@/lib/activity-helpers";

// Preset allocations shown under "Fund default" (mirrors the dashboard's table).
const MANAGED_STRATEGY_ALLOCATIONS: Record<string, Array<{ ticker: string; name: string; weight: number }>> = {
  growth: [
    { ticker: "VTI", name: "US Total Market", weight: 70 },
    { ticker: "VXUS", name: "International", weight: 30 },
  ],
  balanced: [
    { ticker: "VTI", name: "US Total Market", weight: 50 },
    { ticker: "VXUS", name: "International", weight: 25 },
    { ticker: "BND", name: "Bonds", weight: 25 },
  ],
  conservative: [
    { ticker: "VTI", name: "US Total Market", weight: 42 },
    { ticker: "VXUS", name: "International", weight: 18 },
    { ticker: "BND", name: "Bonds", weight: 40 },
  ],
};

const PICK_STOCKS = STOCK_PICKS.map((s: any) => ({
  symbol: String(s.symbol),
  name: String(s.name ?? s.symbol),
  tagline: typeof s.tagline === "string" ? s.tagline : undefined,
}));

type EditableContrib = {
  id: string;
  fundId?: string | null;
  amount: string | number;
  frequency: string;
  executionModel?: string | null;
  selectedTicker?: string | null;
  bankAccountId?: string | null;
};
type BankAccount = { id: string; bankName?: string | null; last4?: string | null; isDefault?: boolean; connectionStatus?: string | null };
type Step = "amount" | "target" | "bank";
type Exec = "auto" | "pick";

const FREQS = ["daily", "weekly", "monthly", "yearly"] as const;
type Freq = (typeof FREQS)[number];
const freqWord = (f: string) => (f === "daily" ? "day" : f === "weekly" ? "week" : f === "yearly" ? "year" : "month");
const freqTitle = (f: string) => (f === "daily" ? "Daily" : f === "weekly" ? "Weekly" : f === "yearly" ? "Yearly" : "Monthly");
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

export function RecurringEditSheet({
  open,
  onClose,
  contrib,
  fund,
  childFirstName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contrib: EditableContrib | null;
  fund?: any;
  childFirstName?: string | null;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const fundId = (contrib?.fundId ?? fund?.id) as string | undefined;
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("25");
  const [frequency, setFrequency] = useState<Freq>("monthly");
  const [executionModel, setExecutionModel] = useState<Exec>("auto");
  const [ticker, setTicker] = useState("");
  const [bankId, setBankId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && contrib) {
      setStep("amount");
      setAmount(String(contrib.amount ?? "25"));
      setFrequency((FREQS.includes(contrib.frequency as Freq) ? contrib.frequency : "monthly") as Freq);
      setExecutionModel((contrib.executionModel as Exec) === "pick" ? "pick" : "auto");
      setTicker(contrib.selectedTicker ? String(contrib.selectedTicker).toUpperCase() : "");
      setBankId(contrib.bankAccountId || "");
    }
  }, [open, contrib]);

  const { data: banks = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: async () => { const r = await fetch("/api/bank-accounts", { credentials: "include" }); return r.ok ? r.json() : []; },
    enabled: open,
  });
  const { data: investPrefs } = useQuery<any>({
    queryKey: ["/api/funds", fundId, "investment-preferences"],
    queryFn: async () => { const r = await fetch(`/api/funds/${fundId}/investment-preferences`, { credentials: "include" }); return r.ok ? r.json() : null; },
    enabled: open && !!fundId,
  });

  const strategyKey = String(investPrefs?.managedStrategy ?? fund?.investmentStrategy ?? "growth").toLowerCase();
  const allocations = MANAGED_STRATEGY_ALLOCATIONS[strategyKey] ?? MANAGED_STRATEGY_ALLOCATIONS.growth;
  const majorityAge = Number(fund?.majorityAge) || 18;

  const amtNum = parseFloat(amount || "0");
  const hasEdits = !contrib || (
    amtNum !== parseFloat(String(contrib.amount || "0")) ||
    frequency !== contrib.frequency ||
    executionModel !== ((contrib.executionModel as Exec) === "pick" ? "pick" : "auto") ||
    (ticker || "") !== (contrib.selectedTicker ? String(contrib.selectedTicker).toUpperCase() : "") ||
    (bankId || "") !== (contrib.bankAccountId || "")
  );

  // At-majority projection (best-effort — hidden if we can't date the child).
  const projection = useMemo(() => {
    if (!(amtNum >= 5)) return null;
    const t = getAge18Transition(fund?.recipientBirthdate, majorityAge);
    const years = t?.daysUntil18 ? Math.max(0, t.daysUntil18 / 365.25) : null;
    if (!years || years <= 0) return null;
    const periodsPerYear = frequency === "daily" ? 365 : frequency === "weekly" ? 52 : frequency === "yearly" ? 1 : 12;
    const monthly = amtNum * (periodsPerYear / 12);
    const fv = projectFundValue({ startingValue: 0, monthlyContribution: monthly, yearsAhead: years });
    const daysPerCycle = frequency === "weekly" ? 7 : frequency === "monthly" ? 30 : frequency === "yearly" ? 365 : 1;
    return { fv, daily: amtNum / daysPerCycle };
  }, [amtNum, frequency, fund, majorityAge]);

  const destLabel = executionModel === "pick" && ticker
    ? (PICK_STOCKS.find((s) => s.symbol === ticker)?.name ?? ticker)
    : `${childFirstName ? `${childFirstName}'s ` : ""}${STRATEGY_LABEL[strategyKey as keyof typeof STRATEGY_LABEL] ?? "Growth Mix"}`;
  const fmt0 = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));

  async function handleSave() {
    if (!contrib || saving) return;
    if (isNaN(amtNum) || amtNum < 5) { toast({ title: "Enter a valid amount", description: "Minimum $5 per deposit.", variant: "destructive" }); return; }
    if (executionModel === "pick" && !ticker) { toast({ title: "Pick a stock", description: "Choose a company or switch to the fund default.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const selectedBank = banks.find((b) => b.id === bankId) || banks.find((b) => b.isDefault && (b.connectionStatus || "active") === "active") || banks.find((b) => (b.connectionStatus || "active") === "active") || banks[0];
      const res = await fetch(`/api/parent-contributions/${contrib.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amtNum, frequency, bankAccountId: selectedBank?.id, executionModel, selectedTicker: executionModel === "pick" ? ticker : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save recurring investment.");
      if (demoBlocked(data, toast)) { onClose(); return; }
      await queryClient.invalidateQueries({ queryKey: ["/api/me/scheduled"] });
      if (fundId) await queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "parent-contributions"] });
      onSaved?.();
      haptic("success");
      toast({ title: "Recurring investment updated" });
      onClose();
    } catch (error) {
      toast({ title: "Could not save", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const possessive = childFirstName ? `${childFirstName}${childFirstName.endsWith("s") ? "'" : "'s"} fund` : "This fund";
  const StratIcon = ManagedMixGlyph; // managed-mix "basket" mark (single source: managed-mix-icon.tsx)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent sheet className="sm:max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Edit recurring investment</DialogTitle>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-0 shrink-0">
          {(["amount", "target", "bank"] as const).map((s) => (
            <div key={s} className={`h-2 rounded-full transition-all duration-300 ${s === step ? "w-7 bg-[hsl(var(--kiddo-evergreen))]" : "w-2 bg-[hsl(var(--kiddo-evergreen)/0.18)]"}`} />
          ))}
        </div>

        <div className="px-6 pt-4 shrink-0 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.09)] px-3 py-1 text-2xs font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">
            <Repeat size={11} strokeWidth={2.5} /> Recurring
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-2xs font-bold uppercase tracking-[0.08em] text-foreground/75">{possessive}</span>
        </div>

        <div className="p-6 pt-3 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* ── STEP 1: amount + frequency ─────────────────────────────── */}
          {step === "amount" && (
            <>
              {contrib && (
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">Edit your recurring investment</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">{`Currently ${formatMoneyFriendly(parseFloat(String(contrib.amount || "0")))}/${freqWord(String(contrib.frequency))}. Adjust below.`}</p>
                </div>
              )}

              {/* Destination indicator */}
              <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--kiddo-border))] bg-muted/30 px-3.5 py-2.5">
                {executionModel === "pick" && ticker ? (
                  <StockLogo ticker={ticker} size={26} />
                ) : (
                  <div className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[hsl(var(--kiddo-evergreen)/0.12)]"><StratIcon size={15} className="text-[hsl(var(--kiddo-evergreen))]" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">{investingLiveCopy("Each deposit invests in", "Each deposit will invest in")}</p>
                  <p className="text-sm font-semibold text-foreground truncate">{destLabel}</p>
                </div>
                <button type="button" onClick={() => setStep("target")} className="shrink-0 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline" data-testid="button-recurring-edit-change-destination">Change</button>
              </div>

              {/* Amount register */}
              <div className="space-y-3">
                <div className="flex items-end justify-center gap-1.5 pt-2 pb-1">
                  <span className="text-3xl font-semibold text-muted-foreground/55 leading-none pb-1.5">$</span>
                  <input
                    type="number" min="5" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" inputMode="decimal"
                    aria-label="Amount per deposit in dollars"
                    className="font-bold text-foreground text-center tracking-tight focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ fontSize: "3.4rem", lineHeight: 1.05, width: `${Math.max(1.5, String(amount || "25").length + 0.3)}ch`, border: "none", outline: "none", boxShadow: "none", background: "transparent", padding: 0 }}
                    data-testid="input-recurring-edit-amount"
                  />
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  {[10, 25, 50, 100].map((amt) => (
                    <button key={amt} type="button" onClick={() => setAmount(String(amt))} className={`text-[13px] font-semibold px-4 py-1.5 rounded-full border transition-colors ${amount === String(amt) ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>${amt}</button>
                  ))}
                </div>
                <div className="flex rounded-full border border-border p-1">
                  {FREQS.map((f) => (
                    <button key={f} type="button" onClick={() => setFrequency(f)} className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${frequency === f ? "bg-[hsl(var(--kiddo-evergreen))] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`} data-testid={`button-recurring-edit-freq-${f}`}>{freqTitle(f)}</button>
                  ))}
                </div>
                <p className="text-center text-2xs text-muted-foreground">$5 minimum per deposit</p>
              </div>

              {/* Projection */}
              {projection && (
                <div className="rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.05)] border border-[hsl(var(--kiddo-evergreen)/0.15)] p-3 space-y-1">
                  {frequency !== "daily" && (
                    <p className="text-2xs uppercase tracking-[0.12em] font-bold text-muted-foreground/70">That's about <span className="text-foreground">${projection.daily.toFixed(2)}/day</span></p>
                  )}
                  <p className="text-sm text-[hsl(var(--kiddo-evergreen))]">{formatMoneyFriendly(amtNum)}/{freqWord(frequency)}{childFirstName ? ` into ${childFirstName}'s fund` : ""}</p>
                  <p className="text-xs text-[hsl(var(--kiddo-evergreen)/0.85)] leading-relaxed">About {fmt0(projection.fv)} by {childFirstName ? `${childFirstName}'s` : "their"} {ordinal(majorityAge)} birthday<span className="text-[hsl(var(--kiddo-evergreen)/0.55)]">*</span></p>
                  <p className="text-3xs text-[hsl(var(--kiddo-evergreen)/0.45)] leading-snug pt-0.5">*{PROJECTION_DISCLAIMER}</p>
                </div>
              )}

              <Button className="w-full rounded-full" disabled={!amount || amtNum < 5} onClick={() => setStep("target")} data-testid="button-recurring-edit-continue">Continue</Button>
            </>
          )}

          {/* ── STEP 2: destination ────────────────────────────────────── */}
          {step === "target" && (
            <>
              <div>
                <h2 className="font-heading text-xl font-semibold text-foreground">Where should it go?</h2>
                <p className="mt-2 text-sm text-muted-foreground">Each deposit goes into what you choose. You can change this anytime.</p>
              </div>

              <div className="space-y-2">
                {/* Fund default (managed) */}
                <button type="button" onClick={() => { setExecutionModel("auto"); setTicker(""); }} className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${executionModel === "auto" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><StratIcon size={18} className="text-[hsl(var(--primary))]" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Fund default</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{strategyKey === "balanced" ? "Balanced stock and bond mix" : strategyKey === "conservative" ? "Capital preservation mix" : strategyKey === "custom" ? "Your custom ETF mix" : "Diversified growth portfolio"}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${executionModel === "auto" ? "border-primary bg-primary" : "border-border"}`} />
                </button>

                {executionModel === "auto" && strategyKey !== "custom" && (
                  <div className="ml-4 pl-3.5 pr-2 py-2.5 border-l-2 border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.04)] rounded-r-lg space-y-2.5">
                    <div className="flex items-center gap-2"><StratIcon size={16} className="text-[hsl(var(--kiddo-evergreen))]" /><p className="text-sm font-semibold text-foreground">{STRATEGY_LABEL[strategyKey as keyof typeof STRATEGY_LABEL] ?? "Growth Mix"}</p></div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {allocations.map((a) => (
                        <div key={a.ticker} className="flex items-center gap-2 rounded-lg bg-background/70 border border-border/50 px-2.5 py-1.5">
                          <StockLogo ticker={a.ticker} size={20} />
                          <div className="min-w-0"><p className="text-3xs font-bold text-foreground">{a.ticker} <span className="text-[hsl(var(--kiddo-evergreen))]">{a.weight}%</span></p><p className="text-4xs text-muted-foreground leading-tight truncate">{a.name}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pick a stock */}
                <button type="button" onClick={() => { setExecutionModel("pick"); if (!ticker) setTicker("AAPL"); }} className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${executionModel === "pick" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="hsl(var(--primary))" strokeWidth="1.5"/><circle cx="10" cy="10" r="4" stroke="hsl(var(--primary))" strokeWidth="1.5"/><circle cx="10" cy="10" r="1.5" fill="hsl(var(--primary))"/></svg></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground">Pick a stock</p><p className="text-xs text-muted-foreground mt-0.5">Every deposit buys shares in one company</p></div>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${executionModel === "pick" ? "border-primary bg-primary" : "border-border"}`} />
                </button>
              </div>

              {executionModel === "pick" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Choose a company</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PICK_STOCKS.map((s) => (
                      <button key={s.symbol} type="button" onClick={() => setTicker(s.symbol)} className={`rounded-xl border p-3 text-left transition-colors ${ticker === s.symbol ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`} data-testid={`button-recurring-edit-stock-${s.symbol}`}>
                        <div className="flex items-center gap-2"><StockLogo ticker={s.symbol} size={22} /><div className="min-w-0"><p className="text-sm font-bold text-foreground truncate">{s.symbol}</p><p className="text-2xs text-muted-foreground truncate">{s.name}</p></div></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setStep("amount")}>Back</Button>
                <Button className="flex-1 rounded-full" disabled={executionModel === "pick" && !ticker} onClick={() => setStep("bank")} data-testid="button-recurring-edit-target-continue">Continue</Button>
              </div>
            </>
          )}

          {/* ── STEP 3: bank + save ────────────────────────────────────── */}
          {step === "bank" && (
            <>
              <div>
                <h2 className="font-heading text-xl font-semibold text-foreground">Which account?</h2>
                <p className="mt-2 text-sm text-muted-foreground">Each deposit is charged here.</p>
              </div>
              <div className="space-y-2">
                {banks.length === 0 && <p className="text-sm text-muted-foreground">No linked account found. Add one from the dashboard to change the source.</p>}
                {banks.map((b) => (
                  <button key={b.id} type="button" onClick={() => setBankId(b.id)} className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${(bankId || banks.find((x) => x.isDefault)?.id || banks[0]?.id) === b.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`} data-testid={`button-recurring-edit-bank-${b.id}`}>
                    <Building2 size={16} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{b.bankName || "Bank"} {b.last4 ? `····${b.last4}` : ""}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setStep("target")} disabled={saving}>Back</Button>
                <Button className="flex-1 rounded-full bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white" disabled={saving || (!!contrib && !hasEdits) || amtNum < 5} onClick={handleSave} data-testid="button-recurring-edit-save">
                  {saving ? "Saving..." : contrib ? (hasEdits ? "Save changes" : "No changes yet") : "Start investing"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
