import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import { GradientText } from "@/components/ui/gemini";
import { Star, Crown, Check, Gift, ArrowRight } from "lucide-react";
import { KORA_FAMILY_MONTHLY, KORA_STARTER_MONTHLY } from "@shared/monetization";

interface EventGateModalProps {
  open: boolean;
  onClose: () => void;
  showKiddoPlusOption?: boolean;
}

export function EventGateModal({ open, onClose, showKiddoPlusOption = true }: EventGateModalProps) {
  const [loading, setLoading] = useState<"starter" | "family" | null>(null);
  const { toast } = useToast();

  const parseCheckoutResponse = async (res: Response) => {
    const raw = await res.text();
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      const details = parsed?.details
        ? `\n${typeof parsed.details === "string" ? parsed.details : JSON.stringify(parsed.details)}`
        : "";
      return {
        url: parsed?.url as string | undefined,
        error: `${parsed?.error || parsed?.message || `HTTP ${res.status}`}${details}`,
      };
    } catch {
      return { url: undefined, error: raw || `HTTP ${res.status}` };
    }
  };

  const handleStarterPlan = async () => {
    setLoading("starter");
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/starter-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/events", cancelTo: "/events" }),
      });
      const data = await parseCheckoutResponse(res);
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Could not start checkout", description: data.error, variant: "destructive" });
        setLoading(null);
      }
    } catch (error) {
      toast({ title: "Could not start checkout", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
      setLoading(null);
    }
  };

  const handleFamilyPlan = async () => {
    setLoading("family");
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/family-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/events", cancelTo: "/events" }),
      });
      const data = await parseCheckoutResponse(res);
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Could not start checkout", description: data.error, variant: "destructive" });
        setLoading(null);
      }
    } catch (error) {
      toast({ title: "Could not start checkout", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent sheet className="sm:max-w-md p-0 gap-0 max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Create an Occasion</DialogTitle>
        <div className="p-6 pb-2 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Gift size={24} className="text-primary" />
          </div>
          <h2 className="mb-2 font-heading text-xl font-bold text-foreground">You already have an active occasion running.</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Free supports 1 active occasion at a time. Upgrade to run multiple occasions at once and remove platform fees on every gift.
          </p>
        </div>

        <div className="space-y-3 p-6">
          {showKiddoPlusOption ? (
            <button
              onClick={handleStarterPlan}
              disabled={loading !== null}
              className="group w-full rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/30"
              data-testid="button-gate-kora-plus"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Star size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading font-semibold text-foreground">
                      <GradientText>Kiddo+</GradientText>
                    </h3>
                    <span className="text-sm font-semibold text-foreground">{`$${KORA_STARTER_MONTHLY.toFixed(2)}/mo`}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    One child. Recurring investments and premium themes.
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check size={12} className="shrink-0 text-primary" />
                      Unlimited active occasions
                    </li>
                    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check size={12} className="shrink-0 text-primary" />
                      No platform fee on any gift
                    </li>
                    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check size={12} className="shrink-0 text-primary" />
                      Recurring investments and custom investment mix
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <span className="flex items-center gap-1 text-xs font-medium text-primary transition-all group-hover:gap-2">
                  {loading === "starter" ? "Redirecting..." : "Upgrade to Kiddo+"}
                  <ArrowRight size={12} />
                </span>
              </div>
            </button>
          ) : null}

          {showKiddoPlusOption ? (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          ) : null}

          <button
            onClick={handleFamilyPlan}
            disabled={loading !== null}
            className="group w-full rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 text-left transition-all hover:border-primary/40"
            data-testid="button-gate-family-plan"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Crown size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-semibold text-foreground">Kiddo Family</h3>
                  <span className="text-sm font-semibold text-foreground">{`$${KORA_FAMILY_MONTHLY.toFixed(2)}/mo`}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every child. Unlimited events. One price.
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check size={12} className="shrink-0 text-primary" />
                    Unlimited funds and unlimited active occasions
                  </li>
                  <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check size={12} className="shrink-0 text-primary" />
                    No platform fee on any gift, any fund
                  </li>
                  <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check size={12} className="shrink-0 text-primary" />
                    Recurring investments across all funds
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <span className="flex items-center gap-1 text-xs font-medium text-primary transition-all group-hover:gap-2">
                {loading === "family" ? "Redirecting..." : "Upgrade to Kiddo Family"}
                <ArrowRight size={12} />
              </span>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
