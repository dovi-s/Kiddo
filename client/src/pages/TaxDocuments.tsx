import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Info } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { useFunds } from "@/hooks/use-funds";
import { getActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { prefetchDashboard, prefetchSettings, onIdle } from "@/lib/prefetch";
import { useCountUp } from "@/hooks/use-count-up";
import type { Fund, Holding } from "@shared/schema";

// Honest tax documents page. Two truths drive the design:
//   1. DriveWealth is scaffolded, not wired — there are no real 1099-DIV /
//      1099-B forms being issued. Pretending otherwise with mock documents
//      would be misleading at best, fraudulent at worst.
//   2. Cost basis IS real — every settled gift writes to the holdings table
//      with cost_basis and current_value. So we can show parents their actual
//      unrealized gains today, which is the SECOND most-asked tax question
//      for UTMA parents (first being "how do I file?" — covered by the
//      kiddie tax explainer).
// When DriveWealth wires up, real 1099 rows will slot in next to the empty
// state — no rebuild needed.

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// Kiddie tax thresholds adjust annually for inflation. These are the IRS-
// published numbers for the most recent published year. Source: Rev. Proc.
// inflation adjustments. Update yearly when the IRS publishes new figures —
// or read live from a server-side config when one exists.
const KIDDIE_TAX_2025 = {
  year: 2025,
  taxFreeUpTo: 1350,           // 2025 standard deduction for unearned income
  childRateUpTo: 2700,         // 2× the standard deduction (next tier)
};

export default function TaxDocuments() {
  const queryClient = useQueryClient();
  const { data: funds = [] } = useFunds();
  // Active fund is held in component state so the page reacts to fund
  // switches via the AppHeader. Was reading getActiveFundId() inline on
  // every render — that pulls fresh from localStorage but doesn't trigger
  // a re-render when the user changes funds in the header (localStorage
  // writes don't auto-rerender React). Same parallel bug Projection.tsx
  // had; same listener-based fix.
  const [storedFundId, setStoredFundId] = useState<string>(() => getActiveFundId());
  useEffect(() => {
    const handler = (e: Event) => {
      const newId = (e as CustomEvent<{ id: string }>).detail?.id;
      if (newId && typeof newId === "string") setStoredFundId(newId);
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear - 1));

  // Idle-prefetch likely back-destinations. The "Back to settings" button is
  // the most common exit, so warm Settings. Dashboard too — parents often
  // navigate sidebar-back rather than using the in-page back button.
  useEffect(() => {
    const cancel = onIdle(() => {
      prefetchDashboard(queryClient, storedFundId);
      prefetchSettings(queryClient);
    });
    return cancel;
  }, [queryClient, storedFundId]);

  // Page is fund-scoped — same pattern as Memory Book / Dashboard. The active
  // fund comes from the sidebar/dashboard switcher (single source of truth);
  // we don't add a redundant picker here. Falls back to the first fund if no
  // active is stored. If the parent has zero funds, render the empty state.
  const activeFund = useMemo<Fund | null>(() => {
    if (funds.length === 0) return null;
    if (storedFundId) {
      const match = funds.find((f) => f.id === storedFundId);
      if (match) return match;
    }
    return funds[0];
  }, [funds, storedFundId]);

  const { data: activeHoldings = [], isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ["/api/funds", activeFund?.id, "holdings"],
    queryFn: async () => {
      if (!activeFund?.id) return [];
      const res = await fetch(`/api/funds/${activeFund.id}/holdings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFund?.id,
    staleTime: 60_000,
  });

  // Realized sales for the selected tax year. The endpoint returns
  // per-sale rows (proceeds, costBasisSold, realizedGain,
  // holdingPeriod) plus year totals split by short-term vs long-term.
  // Pre-migration-0013 sales have NULL realizedGain and surface as
  // "—" — we don't backfill historic sales because reconstructing
  // cost basis at sell time isn't reliable.
  type RealizedSale = {
    id: string;
    ticker: string | null;
    description: string;
    proceeds: number;
    costBasisSold: number | null;
    realizedGain: number | null;
    holdingPeriod: "short_term" | "long_term" | null;
    completedAt: string | null;
  };
  type RealizedSalesResponse = {
    year: number;
    sales: RealizedSale[];
    totals: {
      shortTermGain: string;
      longTermGain: string;
      totalRealizedGain: string;
      totalProceeds: string;
      count: number;
    };
  };
  const { data: realizedData } = useQuery<RealizedSalesResponse>({
    queryKey: ["/api/funds", activeFund?.id, "realized-sales", yearFilter],
    queryFn: async () => {
      if (!activeFund?.id) {
        return {
          year: Number(yearFilter),
          sales: [],
          totals: { shortTermGain: "0", longTermGain: "0", totalRealizedGain: "0", totalProceeds: "0", count: 0 },
        } as RealizedSalesResponse;
      }
      const res = await fetch(
        `/api/funds/${activeFund.id}/realized-sales?year=${encodeURIComponent(yearFilter)}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        return {
          year: Number(yearFilter),
          sales: [],
          totals: { shortTermGain: "0", longTermGain: "0", totalRealizedGain: "0", totalProceeds: "0", count: 0 },
        } as RealizedSalesResponse;
      }
      return res.json();
    },
    enabled: !!activeFund?.id,
    staleTime: 60_000,
  });
  const realizedSales = realizedData?.sales ?? [];
  const realizedTotals = realizedData?.totals;

  // Count-up on the realized-sales totals — same treatment as the
  // unrealized triplet above. The three numbers (short-term + long-
  // term + proceeds) anchor the tax-year summary; they should
  // settle in rather than flash. Anchoring "from" at 0 for the
  // gains, just like the unrealized gain card.
  const realizedShortTerm = realizedTotals ? parseFloat(realizedTotals.shortTermGain) : 0;
  const realizedLongTerm = realizedTotals ? parseFloat(realizedTotals.longTermGain) : 0;
  const realizedProceeds = realizedTotals ? parseFloat(realizedTotals.totalProceeds) : 0;
  const realizedTotalGain = realizedTotals ? parseFloat(realizedTotals.totalRealizedGain) : 0;
  const { value: animatedShortTerm, isAnimating: shortTermAnimating } = useCountUp({
    from: 0,
    to: realizedShortTerm,
    duration: 900,
    enabled: Math.abs(realizedShortTerm) > 0.01,
  });
  const { value: animatedLongTerm, isAnimating: longTermAnimating } = useCountUp({
    from: 0,
    to: realizedLongTerm,
    duration: 900,
    enabled: Math.abs(realizedLongTerm) > 0.01,
  });
  const { value: animatedProceeds, isAnimating: proceedsAnimating } = useCountUp({
    from: realizedProceeds * 0.95,
    to: realizedProceeds,
    duration: 900,
    enabled: realizedProceeds > 0,
  });
  const { value: animatedTotalRealized, isAnimating: totalRealizedAnimating } = useCountUp({
    from: 0,
    to: realizedTotalGain,
    duration: 900,
    enabled: Math.abs(realizedTotalGain) > 0.01,
  });

  // Flatten holdings into per-row tax math (cost basis, value, unrealized).
  const basisRows = useMemo(() => {
    const rows: Array<{
      ticker: string;
      name: string;
      shares: number;
      costBasis: number;
      currentValue: number;
      gain: number;
      gainPct: number;
    }> = [];
    for (const h of activeHoldings) {
      const shares = parseFloat(String(h.shares ?? "0"));
      if (shares <= 0.000001) continue;
      const costBasis = parseFloat(String(h.costBasis ?? "0"));
      const currentValue = parseFloat(String(h.currentValue ?? "0"));
      const gain = currentValue - costBasis;
      const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
      rows.push({
        ticker: String(h.ticker || "").toUpperCase(),
        name: String(h.name || h.ticker || "").trim(),
        shares,
        costBasis,
        currentValue,
        gain,
        gainPct,
      });
    }
    return rows.sort((a, b) => b.currentValue - a.currentValue);
  }, [activeHoldings]);

  const totals = useMemo(() => {
    return basisRows.reduce(
      (acc, r) => ({
        cost: acc.cost + r.costBasis,
        value: acc.value + r.currentValue,
        gain: acc.gain + r.gain,
      }),
      { cost: 0, value: 0, gain: 0 },
    );
  }, [basisRows]);

  // Count-up on the three top-level totals. Same vocabulary as the
  // Dashboard hero + FundsOverview aggregate — these are the
  // numbers the parent scans first on entry, and they should feel
  // like they're settling in rather than flashing static. useCountUp
  // (not useCachedFirstNumber here) because Tax Documents is a
  // landing surface not a polled-live surface — cold-mount animation
  // is the whole job, no need for the cross-poll seed behavior.
  const { value: animatedCost, isAnimating: costAnimating } = useCountUp({
    from: totals.cost * 0.95,
    to: totals.cost,
    duration: 900,
    enabled: totals.cost > 0,
  });
  const { value: animatedValue, isAnimating: valueAnimating } = useCountUp({
    from: totals.value * 0.95,
    to: totals.value,
    duration: 900,
    enabled: totals.value > 0,
  });
  // Gain animates from 0 so a positive number reads as "growth
  // appearing" rather than "settling down to a smaller number."
  // For a negative gain (loss), useCountUp will count from below;
  // we anchor "from" at min(0, gain) for the same reason.
  const { value: animatedGain, isAnimating: gainAnimating } = useCountUp({
    from: 0,
    to: totals.gain,
    duration: 900,
    enabled: Math.abs(totals.gain) > 0.01,
  });

  const yearOptions = useMemo(() => {
    const out: string[] = [];
    for (let y = currentYear; y >= currentYear - 3; y -= 1) out.push(String(y));
    return out;
  }, [currentYear]);

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
      <AppHeader />
      <div className="kiddo-canvas px-4 py-6 max-w-3xl space-y-5">
        {/* In-content "Back to settings" link removed 2026-05-11.
            TaxDocuments is Tier-1 fund-scoped per page-scope.ts;
            AppHeader + DesktopSidebar + MobileNav already provide global
            nav. Apple-Settings register has no in-page back chrome. */}

        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Tax documents{activeFund?.recipientFirstName ? ` · ${capFirst(activeFund.recipientFirstName)}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Cost basis, unrealized gains, and the tax forms DriveWealth issues for {activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}'s fund` : "this fund"}.
            {funds.length > 1 && " Switch funds from the sidebar."}
          </p>
        </div>

        {/* Disclaimer — UTMA tax surface needs this load-bearing. Gold register
            so it reads as "important context" not "scary warning". */}
        <div className="rounded-2xl border border-[hsl(var(--kiddo-gold)/0.4)] bg-[hsl(var(--kiddo-gold)/0.06)] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[hsl(var(--kiddo-gold))]" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Tax information is not tax advice.</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                UTMA accounts have unique tax implications including the kiddie tax. Numbers shown here are informational. Official tax forms (1099-DIV, 1099-B) are issued by DriveWealth, LLC each January for the prior tax year. Consult a qualified CPA before filing.
              </p>
            </div>
          </div>
        </div>

        {/* Summary — three-stat row. Same data the parent sees on dashboard,
            framed in tax language (cost basis vs. current value vs. unrealized
            gain). Only render when there's actual money invested. */}
        {basisRows.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="kiddo-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Cost basis</p>
              <p
                className="mt-1 font-heading text-lg font-bold text-foreground tabular-nums"
                aria-live={costAnimating ? "off" : "polite"}
                aria-label={fmt0(totals.cost)}
              >{fmt0(animatedCost)}</p>
            </div>
            <div className="kiddo-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Current value</p>
              <p
                className="mt-1 font-heading text-lg font-bold text-foreground tabular-nums"
                aria-live={valueAnimating ? "off" : "polite"}
                aria-label={fmt0(totals.value)}
              >{fmt0(animatedValue)}</p>
            </div>
            <div className="kiddo-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Unrealized {totals.gain >= 0 ? "gain" : "loss"}</p>
              <p
                className={`mt-1 font-heading text-lg font-bold tabular-nums ${totals.gain >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-red-700"}`}
                aria-live={gainAnimating ? "off" : "polite"}
                aria-label={`${totals.gain >= 0 ? "+" : ""}${fmt0(totals.gain)}`}
              >
                {totals.gain >= 0 ? "+" : ""}{fmt0(animatedGain)}
              </p>
            </div>
          </div>
        )}

        {/* Year filter only — fund scope is set by the sidebar's active-fund
            switcher (same pattern as Memory Book / Dashboard). One source of
            truth for "which fund am I looking at"; no redundant in-page picker. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.5)] p-0.5">
            {yearOptions.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => { haptic("selection"); setYearFilter(y); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  yearFilter === y ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
                data-testid={`button-tax-year-${y}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Documents — honest empty state. No fake 1099s. The moment DW wires
            up and starts issuing forms, real rows will slot in here without a
            rebuild — same card, just iterating a real array. */}
        <section>
          <p className="kiddo-section-label mb-2">Forms · {yearFilter}</p>
          <div className="kiddo-card p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--kiddo-cream-dark)/0.5)] flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">No tax forms for {yearFilter} yet</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  DriveWealth issues 1099-DIV (dividends &amp; distributions) and 1099-B (sales) the January after each tax year. Funds open part-way through a year may have nothing to report until the following January. Forms appear here automatically — no email needed.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 max-w-md">
                  <div className="rounded-lg border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.3)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">1099-DIV</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">Dividends &amp; distributions paid out during the year.</p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.3)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">1099-B</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">Proceeds from any sales or exchanges. None to report unless positions were sold.</p>
                  </div>
                </div>
                {/* Plain-English explainer link — surfaced even in the
                    empty-state so first-time kid-owners can prep before
                    January. Per AGE_18_HANDOFF_SPEC.md bucket 3. */}
                <div className="mt-3">
                  <a
                    href="/tax-documents/explainer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-2"
                  >
                    What these forms mean, in plain English
                    <span aria-hidden>→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cost basis — REAL data. Per-row breakdown, then totals row at the
            bottom. The "fund" column only renders when filter === "all" so
            single-fund views aren't cluttered with a redundant column. */}
        <section>
          <p className="kiddo-section-label mb-2">Cost basis &amp; unrealized gains</p>
          {holdingsLoading ? (
            <div className="kiddo-card p-5 text-sm text-muted-foreground">Loading positions…</div>
          ) : basisRows.length === 0 ? (
            <div className="kiddo-card p-5 text-sm text-muted-foreground">
              No invested positions yet. Cost basis will appear here once gifts settle into stocks.
            </div>
          ) : (
            <div className="kiddo-card overflow-hidden">
              <div className="hidden md:grid md:grid-cols-[80px_1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5 bg-[hsl(var(--kiddo-cream-dark)/0.4)] border-b border-[hsl(var(--kiddo-border))]">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ticker</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Position</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground text-right">Shares</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground text-right">Cost basis</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground text-right">Value</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground text-right">Unrealized</div>
              </div>
              {basisRows.map((r, i) => (
                <div
                  key={r.ticker}
                  className={`grid grid-cols-[1fr_auto] md:grid-cols-[80px_1fr_auto_auto_auto_auto] gap-3 px-4 py-3 ${i < basisRows.length - 1 ? "border-b border-[hsl(var(--kiddo-border-light))]" : ""}`}
                >
                  <div className="hidden md:flex items-center">
                    <span className="text-[11px] font-bold text-[hsl(var(--kiddo-gold-ink))] bg-[hsl(var(--kiddo-gold)/0.10)] px-2 py-0.5 rounded">{r.ticker}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="md:hidden flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-[hsl(var(--kiddo-gold-ink))] bg-[hsl(var(--kiddo-gold)/0.10)] px-2 py-0.5 rounded">{r.ticker}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                    <div className="md:hidden grid grid-cols-3 gap-2 mt-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Shares</p>
                        <p className="text-foreground tabular-nums">{r.shares >= 1 ? r.shares.toFixed(2) : r.shares.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost</p>
                        <p className="text-foreground tabular-nums">{fmt(r.costBasis)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Value</p>
                        <p className="text-foreground tabular-nums">{fmt(r.currentValue)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block text-sm text-muted-foreground tabular-nums text-right self-center">
                    {r.shares >= 1 ? r.shares.toFixed(2) : r.shares.toFixed(4)}
                  </div>
                  <div className="hidden md:block text-sm text-foreground tabular-nums text-right self-center">{fmt(r.costBasis)}</div>
                  <div className="hidden md:block text-sm text-foreground tabular-nums text-right self-center">{fmt(r.currentValue)}</div>
                  <div className="text-right self-center">
                    <p className={`text-sm font-bold tabular-nums ${r.gain >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-red-700"}`}>
                      {r.gain >= 0 ? "+" : ""}{fmt(r.gain)}
                    </p>
                    <p className={`text-[10.5px] tabular-nums ${r.gain >= 0 ? "text-[hsl(var(--kiddo-evergreen)/0.7)]" : "text-red-700/70"}`}>
                      {r.gain >= 0 ? "+" : ""}{r.gainPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[80px_1fr_auto_auto_auto_auto] gap-3 px-4 py-3 bg-[hsl(var(--kiddo-evergreen)/0.06)] border-t border-[hsl(var(--kiddo-evergreen)/0.18)]">
                <div className="hidden md:block" />
                <div className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">Total</div>
                <div className="hidden md:block" />
                <div className="hidden md:block text-sm font-bold text-[hsl(var(--kiddo-evergreen))] tabular-nums text-right">{fmt(totals.cost)}</div>
                <div className="hidden md:block text-sm font-bold text-[hsl(var(--kiddo-evergreen))] tabular-nums text-right">{fmt(totals.value)}</div>
                <div className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))] tabular-nums text-right">
                  {totals.gain >= 0 ? "+" : ""}{fmt(totals.gain)}
                </div>
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
            Cost basis is calculated using the average-cost method. Gains are <span className="font-semibold">unrealized</span> until positions are sold — no tax is owed on growth alone. Actual tax treatment depends on the holding period and the kiddie tax rules below.
          </p>
        </section>

        {/* Realized sales for the selected tax year. Distinct from the
            unrealized section above — these ARE the gains that trigger
            kiddie-tax computation, and the rows here will line up with
            DriveWealth's 1099-B when that's wired. Empty state is the
            common case (most users don't sell). Short-term + long-term
            totals split out because the tax treatment is different
            (short-term = ordinary income; long-term = preferred rates).
            See project_realized_gain_architecture for the data flow. */}
        {realizedSales.length > 0 && realizedTotals && (
          <section>
            <p className="kiddo-section-label mb-2">Realized sales · {yearFilter}</p>
            <div className="kiddo-card overflow-hidden">
              {/* Year totals across the top — short-term + long-term
                  split is the load-bearing piece since the tax rate
                  difference is what the kiddie-tax section below
                  references. Total proceeds matches what would show
                  on a 1099-B Box 1d. */}
              <div className="grid grid-cols-3 gap-2.5 p-4 bg-[hsl(var(--kiddo-cream-dark)/0.4)] border-b border-[hsl(var(--kiddo-border))]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Short-term gain</p>
                  <p
                    className={`mt-1 font-heading text-lg font-bold tabular-nums ${
                      realizedShortTerm >= 0
                        ? "text-[hsl(var(--kiddo-evergreen))]"
                        : "text-red-700"
                    }`}
                    aria-live={shortTermAnimating ? "off" : "polite"}
                    aria-label={`${realizedShortTerm >= 0 ? "+" : ""}${fmt(realizedShortTerm)}`}
                  >
                    {realizedShortTerm >= 0 ? "+" : ""}
                    {fmt(animatedShortTerm)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Held &lt; 1 year</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Long-term gain</p>
                  <p
                    className={`mt-1 font-heading text-lg font-bold tabular-nums ${
                      realizedLongTerm >= 0
                        ? "text-[hsl(var(--kiddo-evergreen))]"
                        : "text-red-700"
                    }`}
                    aria-live={longTermAnimating ? "off" : "polite"}
                    aria-label={`${realizedLongTerm >= 0 ? "+" : ""}${fmt(realizedLongTerm)}`}
                  >
                    {realizedLongTerm >= 0 ? "+" : ""}
                    {fmt(animatedLongTerm)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Held ≥ 1 year</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total proceeds</p>
                  <p
                    className="mt-1 font-heading text-lg font-bold text-foreground tabular-nums"
                    aria-live={proceedsAnimating ? "off" : "polite"}
                    aria-label={fmt(realizedProceeds)}
                  >{fmt(animatedProceeds)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{realizedTotals.count} {realizedTotals.count === 1 ? "sale" : "sales"}</p>
                </div>
              </div>

              {/* Per-sale rows. Same desktop/mobile responsive pattern
                  as the cost-basis table above. Pre-migration sales
                  surface NULL realizedGain as "—" so the user knows
                  the data exists but isn't computed for that row. */}
              <div className="hidden md:grid md:grid-cols-[80px_1fr_auto_auto_auto_110px] gap-3 px-4 py-2.5 bg-[hsl(var(--kiddo-cream-dark)/0.2)] border-b border-[hsl(var(--kiddo-border))]">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ticker</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Date</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground text-right">Proceeds</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground text-right">Cost basis</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground text-right">Realized</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Holding</div>
              </div>
              {realizedSales.map((s, i) => {
                const date = s.completedAt
                  ? new Date(s.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";
                const gainStr = s.realizedGain == null
                  ? "—"
                  : `${s.realizedGain >= 0 ? "+" : ""}${fmt(s.realizedGain)}`;
                const gainTone = s.realizedGain == null
                  ? "text-muted-foreground"
                  : s.realizedGain >= 0
                    ? "text-[hsl(var(--kiddo-evergreen))]"
                    : "text-red-700";
                const periodLabel = s.holdingPeriod === "short_term"
                  ? "Short-term"
                  : s.holdingPeriod === "long_term"
                    ? "Long-term"
                    : "—";
                return (
                  <div
                    key={s.id}
                    className={`grid grid-cols-[1fr_auto] md:grid-cols-[80px_1fr_auto_auto_auto_110px] gap-3 px-4 py-3 ${
                      i < realizedSales.length - 1 ? "border-b border-[hsl(var(--kiddo-border-light))]" : ""
                    }`}
                    data-testid={`realized-sale-${s.id}`}
                  >
                    <div className="hidden md:flex items-center">
                      <span className="text-[11px] font-bold text-[hsl(var(--kiddo-gold-ink))] bg-[hsl(var(--kiddo-gold)/0.10)] px-2 py-0.5 rounded">
                        {s.ticker || "—"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="md:hidden flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-[hsl(var(--kiddo-gold-ink))] bg-[hsl(var(--kiddo-gold)/0.10)] px-2 py-0.5 rounded">
                          {s.ticker || "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{periodLabel}</span>
                      </div>
                      <p className="text-sm text-foreground">{date}</p>
                      <div className="md:hidden grid grid-cols-3 gap-2 mt-2 text-[11px]">
                        <div>
                          <p className="text-muted-foreground">Proceeds</p>
                          <p className="text-foreground tabular-nums">{fmt(s.proceeds)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cost</p>
                          <p className="text-foreground tabular-nums">{s.costBasisSold == null ? "—" : fmt(s.costBasisSold)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Realized</p>
                          <p className={`font-bold tabular-nums ${gainTone}`}>{gainStr}</p>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:block text-sm text-foreground tabular-nums text-right self-center">{fmt(s.proceeds)}</div>
                    <div className="hidden md:block text-sm text-foreground tabular-nums text-right self-center">
                      {s.costBasisSold == null ? "—" : fmt(s.costBasisSold)}
                    </div>
                    <div className={`hidden md:block text-sm font-bold tabular-nums text-right self-center ${gainTone}`}>{gainStr}</div>
                    <div className="hidden md:block text-[11px] text-muted-foreground self-center">{periodLabel}</div>
                  </div>
                );
              })}
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[80px_1fr_auto_auto_auto_110px] gap-3 px-4 py-3 bg-[hsl(var(--kiddo-evergreen)/0.06)] border-t border-[hsl(var(--kiddo-evergreen)/0.18)]">
                <div className="hidden md:block" />
                <div className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">Total realized · {yearFilter}</div>
                <div className="hidden md:block" />
                <div className="hidden md:block" />
                <div
                  className={`text-sm font-bold tabular-nums text-right ${
                    realizedTotalGain >= 0
                      ? "text-[hsl(var(--kiddo-evergreen))]"
                      : "text-red-700"
                  }`}
                  aria-live={totalRealizedAnimating ? "off" : "polite"}
                  aria-label={`${realizedTotalGain >= 0 ? "+" : ""}${fmt(realizedTotalGain)}`}
                >
                  {realizedTotalGain >= 0 ? "+" : ""}
                  {fmt(animatedTotalRealized)}
                </div>
                <div className="hidden md:block" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
              Realized gains are computed using the average-cost method. Short-term sales (held under 1 year) are taxed as ordinary income; long-term sales (held 1 year or more) get preferred capital-gains rates. Compare the total against the kiddie-tax thresholds below.
            </p>
          </section>
        )}

        {/* Kiddie tax — universal explainer, useful regardless of broker
            integration state. Real IRS thresholds for the most recent
            published year. The "consult a CPA" note keeps us out of giving
            actual advice while still answering the most-asked UTMA question. */}
        <section>
          <p className="kiddo-section-label mb-2">Understanding the kiddie tax</p>
          <div className="kiddo-card p-5">
            <p className="text-sm text-foreground leading-relaxed">
              For children under 19 (or full-time students under 24), <span className="font-semibold">unearned income</span> above the IRS thresholds is taxed at the parent's rate, not the child's. Only applies when positions are sold and gains are realized — growth alone isn't taxable.
            </p>
            <div className="mt-4 rounded-xl bg-[hsl(var(--kiddo-cream-dark)/0.4)] p-4 space-y-2.5">
              <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[hsl(var(--kiddo-border-light))]">
                <span className="text-xs font-bold tabular-nums text-foreground">$0 – {fmt0(KIDDIE_TAX_2025.taxFreeUpTo)}</span>
                <span className="text-xs text-muted-foreground text-right">Tax-free (standard deduction)</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[hsl(var(--kiddo-border-light))]">
                <span className="text-xs font-bold tabular-nums text-foreground">{fmt0(KIDDIE_TAX_2025.taxFreeUpTo)} – {fmt0(KIDDIE_TAX_2025.childRateUpTo)}</span>
                <span className="text-xs text-muted-foreground text-right">Taxed at the child's rate (typically 0% or 10%)</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold tabular-nums text-foreground">{fmt0(KIDDIE_TAX_2025.childRateUpTo)}+</span>
                <span className="text-xs text-muted-foreground text-right">Taxed at the parent's marginal rate</span>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground/80 leading-relaxed">
              <Info size={11} className="mt-0.5 flex-shrink-0" />
              <span>{KIDDIE_TAX_2025.year} thresholds. The IRS adjusts these for inflation each year. This is general information about the rules, not tax advice. Consult a qualified CPA before filing.</span>
            </p>
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
          Investments held by DriveWealth, LLC, Member FINRA/SIPC. Tax forms are issued by DriveWealth.
        </p>
      </div>
    </div>
  );
}
