import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import { GradientText } from "@/components/ui/gemini";
import { Star, Crown, Check, Gift, ArrowRight } from "lucide-react";

interface EventGateModalProps {
  open: boolean;
  onClose: () => void;
}

export function EventGateModal({ open, onClose }: EventGateModalProps) {
  const [loading, setLoading] = useState<"event-pass" | "family" | null>(null);
  const { toast } = useToast();

  const handleEventPass = async () => {
    setLoading("event-pass");
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/event-pass", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Could not start checkout", description: data.error || "Please try again", variant: "destructive" });
        setLoading(null);
      }
    } catch {
      toast({ title: "Could not start checkout", description: "Please try again", variant: "destructive" });
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
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Could not start checkout", description: data.error || "Please try again", variant: "destructive" });
        setLoading(null);
      }
    } catch {
      toast({ title: "Could not start checkout", description: "Please try again", variant: "destructive" });
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Create an Event</DialogTitle>
        <div className="p-6 pb-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Gift size={24} className="text-primary" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            Create a new event
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your free account includes one permanent gift page. To create events for birthdays, holidays, and more, choose an option below.
          </p>
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={handleEventPass}
            disabled={loading !== null}
            className="w-full p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/30 transition-all text-left group"
            data-testid="button-gate-event-pass"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Star size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-semibold text-foreground">
                    <GradientText>Event Pass</GradientText>
                  </h3>
                  <span className="text-sm font-semibold text-foreground">$99</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  One-time purchase for a single event
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Check size={12} className="text-primary shrink-0" />
                    Waives platform fee on up to $7,500 in gifts
                  </li>
                  <li className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Check size={12} className="text-primary shrink-0" />
                    Premium themes, goal cards, thank-you automation
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                {loading === "event-pass" ? "Redirecting..." : "Get Event Pass"}
                <ArrowRight size={12} />
              </span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={handleFamilyPlan}
            disabled={loading !== null}
            className="w-full p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 hover:border-primary/40 transition-all text-left group"
            data-testid="button-gate-family-plan"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Crown size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-semibold text-foreground">Family Plan</h3>
                  <span className="text-sm font-semibold text-foreground">$149/yr</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unlimited events, premium features, fee savings
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Check size={12} className="text-primary shrink-0" />
                    Unlimited premium event pages
                  </li>
                  <li className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Check size={12} className="text-primary shrink-0" />
                    Platform fee waived up to $15,000/year
                  </li>
                  <li className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Check size={12} className="text-primary shrink-0" />
                    Household dashboard and priority support
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                {loading === "family" ? "Redirecting..." : "Upgrade to Family"}
                <ArrowRight size={12} />
              </span>
            </div>
          </button>
        </div>

        <div className="px-6 pb-5">
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onClose}
            data-testid="button-gate-cancel"
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
