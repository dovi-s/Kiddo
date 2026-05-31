import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, Info, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { useFunds } from "@/hooks/use-funds";
import { useAuth } from "@/hooks/use-auth";
import { getActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { prefetchDashboard, prefetchSettings, onIdle } from "@/lib/prefetch";
import { useCountUp } from "@/hooks/use-count-up";
import { toast } from "@/hooks/use-toast";
import type { Fund, Holding } from "@shared/schema";

// CSV-quoting helper. Wraps any cell containing a comma, double-quote,
// or newline in quotes, and escapes embedded quotes by doubling them.
// Identical to the Activity export pattern. Locked 2026-05-19 per the
// Five Towns CPA-readability audit — exports here go to CPAs preparing
// the kid's Schedule D and need to round-trip cleanly into Excel / TurboTax.
function csvCell(raw: unknown): string {
  const s = raw == null ? "" : String(raw);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadCsvFile(filename: string, rows: string[][]): void {
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  // BOM prefix so Excel opens UTF-8 numeric/currency columns correctly
  // on Windows. Without this, "$1,234.56" sometimes lands in the wrong
  // column on European Excel locales — CPAs working in non-US offices
  // hit this exact bug otherwise.
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  const { user } = useAuth();
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

  // Post-handoff owner: the UTMA terminated at the age of majority and this is
  // now the owner's own individual account. Kiddie tax, the custodian/beneficiary
  // split, age-of-majority, UTMA irrevocability, and "custodian controls until
  // they reach majority" all stop applying — gate every such surface below.
  const isOwnerMode = (activeFund as any)?.accessRole === "owner" && Boolean((activeFund as any)?.transferredAt);

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

  // Tax-year flow summary — the CPA-readable "year in numbers" block
  // that anchors the top of this page. One glance scans every money
  // movement for the year: deposits, withdrawals, realized gains,
  // estimated fees, year-start vs year-end value. Endpoint computes
  // server-side from gifts + transactions + fund_snapshots. Locked
  // 2026-05-19 per the Five Towns parent-side roadmap P1.
  type TaxYearSummary = {
    year: number;
    totalDepositsUsd: number;
    withdrawalsUsd: number;
    realizedGainsUsd: number;
    avgInvestedBalanceUsd: number;
    estimatedFeesUsd: number;
    yearStartValue: number | null;
    yearEndValue: number | null;
    snapshotCount: number;
  };
  const { data: yearSummary } = useQuery<TaxYearSummary>({
    queryKey: ["/api/funds", activeFund?.id, "tax-year-summary", yearFilter],
    queryFn: async () => {
      if (!activeFund?.id) {
        return {
          year: Number(yearFilter),
          totalDepositsUsd: 0,
          withdrawalsUsd: 0,
          realizedGainsUsd: 0,
          avgInvestedBalanceUsd: 0,
          estimatedFeesUsd: 0,
          yearStartValue: null,
          yearEndValue: null,
          snapshotCount: 0,
        } as TaxYearSummary;
      }
      const res = await fetch(
        `/api/funds/${activeFund.id}/tax-year-summary?year=${encodeURIComponent(yearFilter)}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        return {
          year: Number(yearFilter),
          totalDepositsUsd: 0,
          withdrawalsUsd: 0,
          realizedGainsUsd: 0,
          avgInvestedBalanceUsd: 0,
          estimatedFeesUsd: 0,
          yearStartValue: null,
          yearEndValue: null,
          snapshotCount: 0,
        } as TaxYearSummary;
      }
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

  // Year tabs span the standard 4-year tax-record window, but never reach back
  // before the year the fund was opened. A fund opened in 2026 has nothing to
  // show for 2023-2025; listing those years reads as "missing forms" when the
  // account simply didn't exist yet.
  const openYear = useMemo(() => {
    const created = (activeFund as any)?.createdAt;
    const d = created ? new Date(created) : null;
    return d && Number.isFinite(d.getTime()) ? d.getFullYear() : null;
  }, [activeFund]);
  const yearOptions = useMemo(() => {
    const floor = openYear != null ? Math.max(currentYear - 3, openYear) : currentYear - 3;
    const out: string[] = [];
    for (let y = currentYear; y >= floor; y -= 1) out.push(String(y));
    return out;
  }, [currentYear, openYear]);
  // Keep the selected year valid. Default is "last year" (you file the prior
  // year's return early in the current year), but a fund opened this year has
  // no prior year to show, and switching funds can leave the selection outside
  // the new fund's window — snap it back into range in both cases.
  useEffect(() => {
    if (!yearOptions.includes(yearFilter)) {
      setYearFilter(yearOptions.includes(String(currentYear - 1)) ? String(currentYear - 1) : yearOptions[0]);
    }
  }, [yearOptions, yearFilter, currentYear]);

  return (
    <div className="kiddo-app-page kiddo-print-friendly md:ml-[264px] pb-24 md:pb-8">
      <AppHeader />
      <div className="kiddo-canvas px-4 py-6 max-w-3xl space-y-5">
        {/* No in-content back link: the AppHeader renders a single context-aware
            Back arrow on fund sub-pages — now on DESKTOP too (it was mobile-only;
            fixed 2026-05-28, because the desktop sidebar's back is /account-scoped
            and never covered fund sub-pages like this one). One affordance, no
            duplicate chrome, and it returns to wherever you came from. */}
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Tax documents{!isOwnerMode && activeFund?.recipientFirstName ? ` · ${capFirst(activeFund.recipientFirstName)}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Cost basis, unrealized gains, and — once investing is live — the tax forms our broker-dealer partner issues for {isOwnerMode ? "your fund" : activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}'s fund` : "this fund"}.
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
                {isOwnerMode
                  ? "This is your own individual investment account. Numbers shown here are informational; realized gains are taxed at your own rate when positions are sold. Once investing is live, official tax forms (1099-DIV, 1099-B) are issued by our broker-dealer partner each January for the prior tax year. Consult a qualified CPA before filing."
                  : "UTMA accounts have unique tax implications including the kiddie tax. Numbers shown here are informational. Once investing is live, official tax forms (1099-DIV, 1099-B) are issued by our broker-dealer partner each January for the prior tax year. Consult a qualified CPA before filing."}
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
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tax year</span>
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
          {/* The year picker scopes only the per-year tax records (forms +
              summary + realized sales). The headline cost basis / value / gain
              and the positions table are ALWAYS current — they don't change by
              year — so say so, or clicking years reads as "nothing happened." */}
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Scopes the forms and the {yearFilter} summary below. Your cost basis, value, and positions are current — they don't change by year.
          </p>
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
                {/* "yet" only for the current/future year (a form is genuinely
                    still pending until January). For a closed past year, "yet"
                    wrongly implies a form is still coming — drop it. */}
                <p className="text-sm font-bold text-foreground">No tax forms for {yearFilter}{Number(yearFilter) >= currentYear ? " yet" : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Once investing is live, our broker-dealer partner issues 1099-DIV (dividends &amp; distributions) and 1099-B (sales) the January after each tax year. Funds open part-way through a year may have nothing to report until the following January. Forms appear here automatically — no email needed.
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
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="kiddo-section-label">Cost basis &amp; unrealized gains</p>
            {basisRows.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  haptic("selection");
                  const childFirst = activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}` : "fund";
                  const stamp = new Date().toISOString().slice(0, 10);
                  const headers = ["Ticker", "Position", "Shares", "Cost basis (USD)", "Current value (USD)", "Unrealized gain (USD)", "Unrealized gain (%)"];
                  const rows: string[][] = [
                    headers,
                    ...basisRows.map((r) => [
                      r.ticker,
                      r.name,
                      r.shares >= 1 ? r.shares.toFixed(2) : r.shares.toFixed(4),
                      r.costBasis.toFixed(2),
                      r.currentValue.toFixed(2),
                      r.gain.toFixed(2),
                      r.gainPct.toFixed(2),
                    ]),
                    [
                      "TOTAL",
                      "",
                      "",
                      totals.cost.toFixed(2),
                      totals.value.toFixed(2),
                      totals.gain.toFixed(2),
                      totals.cost > 0 ? ((totals.gain / totals.cost) * 100).toFixed(2) : "",
                    ],
                  ];
                  downloadCsvFile(`kiddo-cost-basis-${childFirst}-${stamp}.csv`, rows);
                  toast({ title: "CSV downloaded", description: "Open in Excel or share with your CPA." });
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline underline-offset-2"
                data-testid="button-export-cost-basis-csv"
                aria-label="Download cost basis CSV"
              >
                <Download size={12} />
                CSV
              </button>
            )}
          </div>
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
            Cost basis is the total you've invested in each position. Gains are <span className="font-semibold">unrealized</span> until positions are sold — no tax is owed on growth alone. Actual tax treatment depends on the holding period{isOwnerMode ? "." : " and the kiddie tax rules below."}
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
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="kiddo-section-label">Realized sales · {yearFilter}</p>
              <button
                type="button"
                onClick={() => {
                  haptic("selection");
                  const childFirst = activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}` : "fund";
                  const headers = ["Date", "Ticker", "Description", "Proceeds (USD)", "Cost basis (USD)", "Realized gain (USD)", "Holding period"];
                  const rows: string[][] = [
                    headers,
                    ...realizedSales.map((s) => [
                      s.completedAt ? new Date(s.completedAt).toLocaleDateString("en-US") : "",
                      s.ticker || "",
                      s.description || "",
                      s.proceeds.toFixed(2),
                      s.costBasisSold == null ? "" : s.costBasisSold.toFixed(2),
                      s.realizedGain == null ? "" : s.realizedGain.toFixed(2),
                      s.holdingPeriod === "short_term" ? "Short-term" : s.holdingPeriod === "long_term" ? "Long-term" : "",
                    ]),
                    [
                      `TOTAL ${yearFilter}`,
                      "",
                      "",
                      realizedProceeds.toFixed(2),
                      "",
                      realizedTotalGain.toFixed(2),
                      `Short-term: ${realizedShortTerm.toFixed(2)} · Long-term: ${realizedLongTerm.toFixed(2)}`,
                    ],
                  ];
                  downloadCsvFile(`kiddo-realized-sales-${childFirst}-${yearFilter}.csv`, rows);
                  toast({ title: "CSV downloaded", description: "Open in Excel or share with your CPA." });
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline underline-offset-2"
                data-testid="button-export-realized-csv"
                aria-label="Download realized sales CSV"
              >
                <Download size={12} />
                CSV
              </button>
            </div>
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
              Realized gains here are computed on an average-cost basis. Your broker's 1099-B may instead use FIFO or specific-lot identification, so these figures can differ; the 1099-B is the authoritative number to file from. Short-term sales (held under 1 year) are taxed as ordinary income; long-term sales (held 1 year or more) get preferred capital-gains rates. Compare the total against the kiddie-tax thresholds below.
            </p>
          </section>
        )}

        {/* Kiddie tax — universal explainer, useful regardless of broker
            integration state. Real IRS thresholds for the most recent
            published year. The "consult a CPA" note keeps us out of giving
            actual advice while still answering the most-asked UTMA question. */}
        {/* Kiddie tax applies only to minors — hidden for the post-handoff
            adult owner, whose realized gains are taxed at their own rate. */}
        {!isOwnerMode && (
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
        )}

        {/* Year-end summary — the single highest-impact CPA-readable
            artifact on this page. One glance shows every money flow
            for the year so the parent's CPA can reconcile against the
            eventual DriveWealth 1099 without digging through Activity.
            Renders only when there's at least one signal (deposits OR
            withdrawals OR realized gains OR estimated fees) — silent
            on a brand-new fund with no activity. Locked 2026-05-19
            per the Five Towns parent-side roadmap P1. */}
        {yearSummary && (
          yearSummary.totalDepositsUsd > 0 ||
          yearSummary.withdrawalsUsd > 0 ||
          Math.abs(yearSummary.realizedGainsUsd) > 0.01 ||
          yearSummary.estimatedFeesUsd > 0 ||
          (yearSummary.yearEndValue ?? 0) > 0
        ) && (
          <section>
            <p className="kiddo-section-label mb-2">{yearFilter} summary</p>
            <div className="kiddo-card p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Deposits</p>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground tabular-nums">
                    {fmt0(yearSummary.totalDepositsUsd)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">Gifts + contributions</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Withdrawals</p>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground tabular-nums">
                    {fmt0(yearSummary.withdrawalsUsd)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">{yearSummary.withdrawalsUsd > 0 ? "Cash out" : "None"}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Realized gains</p>
                  <p className={`mt-1 font-heading text-lg font-bold tabular-nums ${yearSummary.realizedGainsUsd >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-red-700"}`}>
                    {yearSummary.realizedGainsUsd >= 0 ? "+" : ""}{fmt0(yearSummary.realizedGainsUsd)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">From sales</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Fees (est.)</p>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground tabular-nums">
                    {fmt0(yearSummary.estimatedFeesUsd)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">$1/yr per $1,000 invested</p>
                </div>
              </div>
              {(yearSummary.yearStartValue != null || yearSummary.yearEndValue != null) && (
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 rounded-xl bg-[hsl(var(--kiddo-cream-dark)/0.4)] px-4 py-3 border-t border-[hsl(var(--kiddo-border))]">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Year start → year end</p>
                    <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                      {yearSummary.yearStartValue != null ? fmt0(yearSummary.yearStartValue) : "—"}
                      <span className="mx-2 text-muted-foreground/60">→</span>
                      {yearSummary.yearEndValue != null ? fmt0(yearSummary.yearEndValue) : "—"}
                    </p>
                  </div>
                  {yearSummary.yearStartValue != null && yearSummary.yearEndValue != null && (
                    (() => {
                      const delta = yearSummary.yearEndValue! - yearSummary.yearStartValue!;
                      const pct = yearSummary.yearStartValue! > 0 ? (delta / yearSummary.yearStartValue!) * 100 : null;
                      return (
                        <div className="text-right">
                          <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Net change</p>
                          <p className={`mt-1 text-sm font-bold tabular-nums ${delta >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-red-700"}`}>
                            {delta >= 0 ? "+" : ""}{fmt0(delta)}
                            {pct != null && (
                              <span className="ml-1.5 text-[11px] font-medium opacity-80">
                                ({delta >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground/80 leading-relaxed">
                Fees are estimated from the time-weighted average invested balance ($1/yr per $1,000 invested, or 0.10% annual). Once investing is live, realized gains and the broker-dealer-issued 1099 will be the authoritative numbers. Use this summary as the at-a-glance scan; reconcile against the per-sale and per-position tables below.
              </p>
            </div>
          </section>
        )}
        {/* Coherent empty state: when a selected year has no recorded activity,
            show the summary section with a clear "nothing recorded" line instead
            of silently vanishing — otherwise clicking through years feels broken
            (a summary appears for one year and disappears for the next). */}
        {yearSummary && !(
          yearSummary.totalDepositsUsd > 0 ||
          yearSummary.withdrawalsUsd > 0 ||
          Math.abs(yearSummary.realizedGainsUsd) > 0.01 ||
          yearSummary.estimatedFeesUsd > 0 ||
          (yearSummary.yearEndValue ?? 0) > 0
        ) && (
          <section>
            <p className="kiddo-section-label mb-2">{yearFilter} summary</p>
            <div className="kiddo-card p-5">
              <p className="text-sm text-muted-foreground">
                No deposits, sales, or fees recorded for {yearFilter}.
              </p>
            </div>
          </section>
        )}

        {/* Account particulars — the "this is officially constituted
            as follows" view. A sophisticated parent's CPA or estate
            attorney lands here at year-end and needs the legal frame
            in one glance: who is the custodian, who is the
            beneficiary, what's the governing state, when was the
            account opened, what's the irrevocability acknowledgment
            timestamp. Pulled from the existing schema columns; no
            new server contract. Locked 2026-05-19 per the Five Towns
            audit — these are the same facts a Schwab statement
            header carries on page 1. */}
        {activeFund && (
          <section>
            <p className="kiddo-section-label mb-2">Account particulars</p>
            <div className="kiddo-card p-5">
              <div className="grid sm:grid-cols-2 gap-3">
                {(() => {
                  const items: Array<{ label: string; value: string | null }> = [];
                  // Custodian — parent's full name. Post-handoff there is NO
                  // custodian (the owner holds the account themselves), so omit it.
                  const custodianName = [user?.firstName, (user as any)?.lastName].filter(Boolean).join(" ").trim();
                  if (!isOwnerMode) {
                    items.push({
                      label: "Custodian",
                      value: custodianName || (user as any)?.email || null,
                    });
                  }
                  // Beneficiary — kid's full name + birthdate when known.
                  const kidFirst = (activeFund as any).recipientFirstName || "";
                  const kidLast = (activeFund as any).recipientLastName || "";
                  const beneficiaryName = [capFirst(kidFirst), capFirst(kidLast)].filter(Boolean).join(" ").trim();
                  items.push({
                    label: isOwnerMode ? "Account owner" : "Beneficiary",
                    value: beneficiaryName || null,
                  });
                  // Beneficiary birthdate (UTMA majority math anchors on this).
                  const dob = (activeFund as any).recipientBirthdate;
                  const dobDate = dob ? new Date(dob) : null;
                  items.push({
                    label: isOwnerMode ? "Date of birth" : "Beneficiary date of birth",
                    value: dobDate && Number.isFinite(dobDate.getTime())
                      ? dobDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : null,
                  });
                  items.push({ label: "Account type", value: isOwnerMode ? "Personal (individual account)" : "UTMA (Uniform Transfers to Minors Act)" });
                  // State + majority age — governs which UTMA statute
                  // applies. State stored as 2-letter code; surfaced
                  // verbatim because parents recognize codes.
                  const state = (activeFund as any).recipientState || null;
                  const stateCode = state ? String(state).toUpperCase() : null;
                  if (!isOwnerMode) {
                    items.push({
                      label: "Governing state",
                      value: stateCode ? `${stateCode} (UTMA statute)` : null,
                    });
                  }
                  // The majority age is set by the GOVERNING STATE's UTMA
                  // statute (18 in most; 19 in AL/NE; 21 in MS/PA and others).
                  // Only assert a definitive age when the state is known —
                  // otherwise the 18 default is a guess presented as law on a
                  // tax/legal page. Per project_age_milestone_majorityage_footgun.
                  const ma = Number((activeFund as any).majorityAge) || 18;
                  if (!isOwnerMode) {
                    items.push({
                      label: "Age of majority",
                      value: stateCode
                        ? `${ma} (per ${stateCode} UTMA law)`
                        : "18 in most states; set your state to confirm",
                    });
                  }
                  // Fund open date.
                  const opened = (activeFund as any).createdAt;
                  const openedDate = opened ? new Date(opened) : null;
                  items.push({
                    label: "Account opened",
                    value: openedDate && Number.isFinite(openedDate.getTime())
                      ? openedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : null,
                  });
                  // UTMA irrevocability acknowledgment — legal moment
                  // when the parent accepted that the gift cannot be
                  // reclaimed. Important paper-trail item.
                  const acked = (activeFund as any).utmaAcknowledgedAt;
                  const ackedDate = acked ? new Date(acked) : null;
                  if (!isOwnerMode) {
                    items.push({
                      label: "UTMA irrevocability acknowledged",
                      value: ackedDate && Number.isFinite(ackedDate.getTime())
                        ? ackedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : null,
                    });
                  }
                  return items.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground break-words" data-testid={`particular-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                        {row.value ?? <span className="font-normal italic text-muted-foreground/70">Not set</span>}
                      </p>
                    </div>
                  ));
                })()}
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground/70 leading-relaxed">
                {isOwnerMode
                  ? "These details come from your account setup. Update them in Settings → Account if anything changes (a legal-name change, etc.)."
                  : <>These details come from your account setup. The custodian, beneficiary, state, and majority age all govern how UTMA tax rules apply to {activeFund.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}'s` : "this"} fund. Update them in Settings → Child if anything changes (a move to a new state, a legal-name change, etc.).</>}
              </p>
            </div>
          </section>
        )}

        {/* Custody & protection context block — answers "where is my
            money, who is DriveWealth, what is SIPC" before the
            sophisticated parent has to Google it themselves. Sized as
            a real section, not a footnote, because for a $50k+ UTMA
            this is the load-bearing trust question. Per the locked
            Five Towns persona audit 2026-05-19: a parent considering
            using Kiddo as primary custody (not just gifts) needs
            this. ShieldCheck icon + evergreen border so it reads as
            "this is reassurance, not a warning". */}
        <section>
          <p className="kiddo-section-label mb-2">Custody &amp; protection</p>
          <div className="kiddo-card p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.10)] flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} className="text-[hsl(var(--kiddo-evergreen))]" />
              </div>
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Our broker-dealer partner · Member FINRA / SIPC</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    When investing is live, {isOwnerMode ? "your account" : (activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}'s UTMA` : "your child's UTMA")} holds positions through our broker-dealer partner, a US broker-dealer registered with the SEC, regulated by FINRA, and a member of SIPC. Our broker-dealer partner provides custody for the assets; Kiddo provides the front-end, the gifting flow, and the Memory Book. This is the same custody pattern most consumer investing apps use.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.3)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">SIPC protection</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                      Up to $500,000 per account (including $250,000 for cash) against brokerage failure. Not protection against market losses.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.3)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Segregated accounts</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                      Once investing is live, customer assets are held separately from our broker-dealer partner's own funds under SEC Rule 15c3-3. The shares are {isOwnerMode ? "yours" : (activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}'s` : "the child's")}, not the broker's.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.3)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Account type</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                      {isOwnerMode
                        ? "Individual brokerage account held in your name. The UTMA ended at the age of majority — you own and control the account directly now."
                        : <>UTMA custodial account under your state's Uniform Transfers to Minors Act. Custodian (you) controls until {activeFund?.recipientFirstName ? capFirst(activeFund.recipientFirstName) : "the child"} reaches majority age in your state.</>}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.3)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Fees</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                      Kiddo's annual fee ($1 per $1,000 invested, about $10/yr on a $10,000 fund) applies to invested assets only, not on cash or pending gifts. Prorated daily, so you only pay for the days assets are invested. No trading commissions, no account fees.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  Once investing is live, tax forms (1099-DIV, 1099-B) are issued by our broker-dealer partner each January for the prior tax year. The cost basis shown above is computed by Kiddo from settled gift and contribution amounts; our broker-dealer partner issues the authoritative figures on the 1099-B. Verify your CPA reconciles both before filing.
                </p>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  More on SIPC at <a href="https://www.sipc.org" target="_blank" rel="noopener noreferrer" className="font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline">sipc.org</a>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
