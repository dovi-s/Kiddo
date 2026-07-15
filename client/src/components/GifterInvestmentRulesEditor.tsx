// GifterInvestmentRulesEditor — the fund-wide "how gifts get invested" editor.
//
// Extracted from Settings.tsx on 2026-07-05 so it can be reused OUTSIDE of
// Settings without duplicating a parallel picker. The first second home is the
// occasion-creation flow (CreateEventSheet): the "For you only · Gifts invested
// as {label}" card used to link to /settings?tab=gifts, which hard-navigated
// the user out of the middle of creating an occasion and lost their place.
// Now that card opens this same editor in a nested sheet, so the parent adjusts
// the default and pops right back to the preview with nothing lost.
//
// onSuccess is called with the saved values so a caller that shows a derived
// label (the occasion preview) can update instantly without waiting on a
// refetch. Settings passes refreshAll and simply ignores the argument.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { STOCK_PICKS as CANON_STOCK_PICKS } from "@shared/stock-picks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { demoBlocked } from "@/lib/demo-block";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";

const GIFTER_STOCK_OPTIONS = CANON_STOCK_PICKS.map((s) => ({ ticker: s.ticker, name: s.name }));

export type SavedGifterRules = {
  defaultMode: "managed" | "stock" | "cash";
  defaultTicker: string;
  allowGifterStockPick: boolean;
  allowGifterCashGift: boolean;
};

export function GifterInvestmentRulesEditor({
  fund,
  onSuccess,
}: {
  fund: any;
  onSuccess: (saved?: SavedGifterRules) => void;
}) {
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
  // Match the server defaults (server/fundInvestmentPreferences.ts DEFAULTS):
  // gifter stock-picks are allowed by default (the "Chosen with Love" magic,
  // and they land in a separate sleeve so they don't touch the managed mix);
  // cash gifts are NOT allowed by default (keep gifts auto-investing — the
  // "your gift bought shares" moment + no idle cash). These get reconciled with
  // saved prefs on load; initializing them to the true defaults avoids showing
  // the wrong state for a beat before the query resolves.
  const [allowGifterStockPick, setAllowGifterStockPick] = useState(true);
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
  // Warn on tab-close/refresh while a gift-settings change is staged but unsaved.
  useUnsavedGuard(hasChanged);

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
      if (demoBlocked(payload, toast)) return;
      haptic("success");
      toast({ title: "Gifting rules updated", description: "Future gifts will follow these defaults." });
      onSuccess({ defaultMode, defaultTicker, allowGifterStockPick, allowGifterCashGift });
    } catch {
      toast({ title: "Could not update gifting rules", description: "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Post-handoff owner has no "family" — it's just their own default.
  const rulesIsOwnerHeld = (fund as any)?.accessRole === "owner" && Boolean((fund as any)?.transferredAt);
  const familyDefaultLabel = rulesIsOwnerHeld ? "default" : "family default";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
        <p className="kiddo-section-label">Default path for new gifts</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Pick one {familyDefaultLabel} for most gifts. Stock picks or cash gifts need the overrides below.
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => { setDefaultMode("managed"); haptic("selection"); }}
          className={`w-full rounded-2xl border p-4 text-left transition-all kiddo-press ${defaultMode === "managed" ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
          data-testid="option-gifting-default-managed"
        >
          <p className="text-sm font-medium text-foreground">Managed mix</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Use your fund's investing style, like Growth Mix or Balanced Mix.</p>
        </button>
        <button
          type="button"
          onClick={() => { setDefaultMode("stock"); haptic("selection"); }}
          className={`w-full rounded-2xl border p-4 text-left transition-all kiddo-press ${defaultMode === "stock" ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
          data-testid="option-gifting-default-stock"
        >
          <p className="text-sm font-medium text-foreground">Specific stock</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Every gift follows one default stock unless a gifter override is allowed.</p>
        </button>
        <button
          type="button"
          onClick={() => { setDefaultMode("cash"); haptic("selection"); }}
          className={`w-full rounded-2xl border p-4 text-left transition-all kiddo-press ${defaultMode === "cash" ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
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
                className={`rounded-2xl border px-3 py-3 text-left transition-all kiddo-press ${defaultTicker === stock.ticker ? "border-primary bg-primary/5" : "border-[hsl(var(--kiddo-border))] bg-card hover:border-[hsl(var(--kiddo-border))]/80"}`}
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
            <p className="mt-0.5 text-xs text-muted-foreground">If off, gifts follow your {familyDefaultLabel}.</p>
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
          Use {familyDefaultLabel}
          {allowGifterStockPick ? " · Choose a stock" : ""}
          {allowGifterCashGift ? " · Let the family decide later" : ""}
        </p>
      </div>

      {/* Forward-only reassurance, mirroring the Settings strategy-change "What
          changes" disclosure — before you save, make it clear this only steers
          FUTURE gifts and never touches money already invested. Shows only when a
          change is actually staged (same gate as the Save button). */}
      {hasChanged && (
        <div className="rounded-xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.06)] p-3" data-testid="gifting-rules-change-note">
          <p className="text-2xs font-semibold uppercase tracking-wide text-[hsl(var(--kiddo-gold-ink))]">What changes</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            This sets how gifts are invested from here on. Anything already invested stays exactly as it is. Nothing is sold or moved.
          </p>
        </div>
      )}

      <Button onClick={handleSave} disabled={isLoading || saving || !hasChanged} className="w-full" data-testid="button-save-gifting-rules">
        {saving ? "Saving..." : "Save gifting rules"}
      </Button>
    </div>
  );
}
