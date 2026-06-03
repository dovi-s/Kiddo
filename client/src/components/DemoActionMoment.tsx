// DemoActionMoment — converts the PEAK-INTENT moment in the demo.
//
// When a demo visitor completes a money-flow action (recurring, one-time, etc.)
// the demoSandbox returns a mock success without persisting — so the action
// visibly "does nothing." That dead-end happens at the single highest-intent
// point in the whole funnel: someone who just set up "$50/mo for Luke" is
// telling you they want to do this. Faking persistence (optimistic UI) is
// fragile and resets confusingly; instead we CATCH the intent — acknowledge
// what they did, be honest the demo stays pristine for the next visitor, and
// point them at starting a REAL fund.
//
// Discipline (same as DemoGiftMoment): demo accounts only, a client-side toast
// reusing the app's real toast UI, NO data mutation (so it never drifts the
// carefully reconciled balances/counts), honest framing.
//
// Extending to more actions: dispatch `kiddo:demo-action` with
// { action, amount?, childName? } from that action's success handler and add a
// COPY entry below. Currently wired: recurring (Dashboard auto-invest save).
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { haptic } from "@/lib/haptics";

type DemoActionDetail = { action: string; amount?: string | number; childName?: string };

const COPY: Record<string, (amt: string, child: string) => { title: string; description: string }> = {
  recurring: (amt, child) => ({
    title: `${amt ? `$${amt}/mo for ${child}` : "Recurring set up"} 🌱`,
    description:
      "This won't save here (the demo resets for each visitor), but that's exactly how you'd set it up for real.",
  }),
  // Future: one_time, sell, buy, gift — add a builder + dispatch from its handler.
};

export function DemoActionMoment() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isDemo = Boolean((user as any)?.isDemoAccount);

  useEffect(() => {
    if (!isDemo || typeof window === "undefined") return;
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<DemoActionDetail>).detail || ({} as DemoActionDetail);
      const builder = COPY[detail.action];
      if (!builder) return;
      const amt = String(detail.amount ?? "").replace(/[^0-9.]/g, "");
      const child = (detail.childName || "them").trim() || "them";
      const { title, description } = builder(amt, child);
      // Brief delay so this lands just AFTER the flow's own success beat, not on
      // top of it — and reads as a deliberate moment, not a stacked alert.
      window.setTimeout(() => {
        haptic("success");
        toast({
          title,
          description,
          duration: 11000, // a conversion beat needs time to read both lines + decide
          action: (
            <ToastAction
              altText="Start your own fund"
              onClick={() => { haptic("selection"); navigate("/get-started"); }}
            >
              Start your own →
            </ToastAction>
          ),
        });
      }, 700);
    };
    window.addEventListener("kiddo:demo-action", onAction as EventListener);
    return () => window.removeEventListener("kiddo:demo-action", onAction as EventListener);
  }, [isDemo, navigate]);

  return null;
}
