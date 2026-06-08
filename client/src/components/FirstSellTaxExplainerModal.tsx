// First-sell tax explainer modal. Per AGE_18_HANDOFF_SPEC.md bucket 2.
//
// Fires once per kid-owner the first time they hit /api/holdings/sell.
// Server returns 409 "first_sell_tax_explainer_required" with the
// pre-computed realized gain, sale value, holding period, and a
// bracket-aware estimated tax. The modal renders that data + lets
// the user proceed (re-fires the request with confirmTaxExplainer:true)
// or cancel.
//
// Why a modal not a separate page: the user is already in the middle
// of a sell flow — bouncing them to /learn/tax would break the
// decision context. Keep them on the page, give them what they need
// to decide, then either let them through or back out.
//
// Subsequent sells skip this auto-popup. The explainer is still
// reachable from Settings → Tax for refreshers.

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt, TrendingDown, TrendingUp } from "lucide-react";

export type FirstSellTaxExplainerPayload = {
  ticker: string;
  sharesToSell: string;
  saleValue: string;
  costBasisSold: string;
  realizedGain: string;
  holdingPeriod: "long_term" | "short_term";
  estimatedTax: string;
  estimatedTaxRate: number;
  incomeBracket: string | null;
};

interface Props {
  payload: FirstSellTaxExplainerPayload | null;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function fmt(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export function FirstSellTaxExplainerModal({ payload, busy, onConfirm, onCancel }: Props) {
  if (!payload) return null;
  const realizedGain = parseFloat(payload.realizedGain);
  const estimatedTax = parseFloat(payload.estimatedTax);
  const isGain = realizedGain >= 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  const ratePct = (payload.estimatedTaxRate * 100).toFixed(0);
  const periodLabel = payload.holdingPeriod === "long_term" ? "Long-term" : "Short-term";

  return (
    <Dialog open={!!payload} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
            <Receipt size={14} className="text-primary" />
            <span>First sale, first tax moment</span>
          </div>
          <DialogTitle className="font-heading text-2xl">
            Here's what the IRS sees.
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
            <Row label="Selling" value={`${parseFloat(payload.sharesToSell).toFixed(4)} ${payload.ticker}`} />
            <Row label="Sale value" value={fmt(payload.saleValue)} />
            <Row label="Cost basis" value={fmt(payload.costBasisSold)} />
            <div className="border-t border-border pt-2 mt-2">
              <Row
                label="Realized gain"
                value={`${isGain ? "+" : ""}${fmt(realizedGain)}`}
                strong
                accent={isGain ? "positive" : "muted"}
                icon={<Icon size={14} />}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              {periodLabel} capital gains
            </p>
            <p className="text-sm text-foreground/70 leading-relaxed">
              {payload.holdingPeriod === "long_term"
                ? "You held this over a year, so the gain is taxed at long-term rates: 0%, 15%, or 20% depending on your income."
                : "You held this under a year, so the gain is taxed at ordinary income rates."}
            </p>
            <div className="pt-2 space-y-1">
              <Row
                label={`Estimated federal tax (${ratePct}% rate)`}
                value={fmt(estimatedTax)}
                strong
              />
              <p className="text-[11px] text-muted-foreground">
                {payload.incomeBracket
                  ? "Based on the income bracket you told us."
                  : "Based on an average. Set your income in Settings for a closer estimate."}
                {" "}State tax may add more.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            We send you a 1099 in January. It shows this sale and the exact numbers to put on your taxes.
          </p>
        </div>

        <DialogFooter className="gap-2 pt-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy} className="flex-1">
            Not yet
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="flex-1">
            {busy ? "Selling..." : "Continue with sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
  icon,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: "positive" | "muted";
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground/70">{label}</span>
      <span
        className={`flex items-center gap-1.5 tabular-nums ${
          strong ? "font-semibold" : ""
        } ${
          accent === "positive" ? "text-emerald-700" : "text-foreground"
        }`}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
