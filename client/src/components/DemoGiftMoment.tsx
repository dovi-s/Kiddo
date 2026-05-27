// DemoGiftMoment — the one live "a gift just came in" beat in the Dunphy demo.
//
// Why it exists: the most emotional moment in the product is the parent seeing
// "Gloria added $75 to Haley's future." Reading about it isn't feeling it. The
// demo is the distribution/conversion surface (creator outreach links land
// here), so letting a prospect FEEL that beat once is high-leverage — it's the
// "show, don't tell" of the gifter loop.
//
// Discipline (what keeps it magic, not slop):
//   • ONCE per browser session — not a stream of fake gifts (a notification
//     slot-machine would violate the calm register; the restraint is the point).
//   • ~15s after the parent lands on their dashboard — long enough to orient,
//     so it lands as a delightful surprise, not an on-load pop.
//   • Demo accounts only (user.isDemoAccount); a no-op for everyone else.
//   • NO data mutation — a client-side toast reusing the app's real toast UI,
//     so it never drifts the (carefully reconciled) fund balance/counts.
//   • Honest — it's inside the clearly-"illustrative" Dunphy demo, and it
//     mirrors a real seeded gifter/amount for the active child, so it reads true.
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";
import { getActiveFundId } from "@/hooks/use-active-fund";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { capFirst } from "@/lib/format-name";
import { haptic } from "@/lib/haptics";

const SESSION_KEY = "kiddo.demo.giftMoment.shown.v1";
const DELAY_MS = 15_000;

// Per-child gift that matches the seeded personas, so the beat reads real
// ("Gloria added $75 to Haley"). Falls back to a generic warm gifter.
const DEMO_GIFTS: Record<string, { sender: string; amount: string; ticker: string }> = {
  haley: { sender: "Gloria Pritchett", amount: "75", ticker: "DIS" },
  alex: { sender: "Jay Pritchett", amount: "250", ticker: "GOOGL" },
  luke: { sender: "Manny Delgado", amount: "50", ticker: "RBLX" },
};
const TICKER_NAME: Record<string, string> = {
  DIS: "Disney", GOOGL: "Google", RBLX: "Roblox", AAPL: "Apple", VTI: "the diversified mix",
};

export function DemoGiftMoment() {
  const { user } = useAuth();
  const { data: funds = [] } = useFunds();
  const [location, navigate] = useLocation();
  const timerRef = useRef<number | null>(null);

  const isDemo = Boolean((user as any)?.isDemoAccount);
  const onDashboard = location === "/dashboard" || location === "/";

  useEffect(() => {
    if (!isDemo || !onDashboard) return;
    if (typeof window === "undefined" || funds.length === 0) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return; // already shown this session
    } catch {
      return; // sessionStorage blocked → skip rather than risk repeating
    }

    const activeId = getActiveFundId();
    const fund = (funds.find((f) => f.id === activeId) ?? funds[0]) as any;
    if (!fund) return;
    const childRaw = String(fund.recipientFirstName || "");
    const child = capFirst(childRaw) || "your child";
    const g = DEMO_GIFTS[childRaw.toLowerCase()] || { sender: "Cameron Tucker", amount: "100", ticker: "DIS" };
    const where = TICKER_NAME[g.ticker] || "the diversified mix";

    // Fire ~15s after the parent settles on the dashboard. If they wander off
    // (e.g. tap "View gifter page") and come back before it fired, the timer
    // simply re-arms — sessionStorage, set on fire, is the once-per-session
    // guard, so it still shows exactly once per visit, never more.
    timerRef.current = window.setTimeout(() => {
      try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      haptic("success");
      toast({
        title: `${g.sender} added $${g.amount} to ${child}'s future 🌱`,
        description: `Going into ${where} — a new moment in ${child}'s Memory Book.`,
        duration: 9000, // a delight beat needs time to read both lines + tap View (vs the 4.5s default)
        action: (
          <ToastAction
            altText={`View ${child}'s Memory Book`}
            onClick={() => { haptic("selection"); navigate(`/memory/${fund.id}`); }}
          >
            View
          </ToastAction>
        ),
      });
    }, DELAY_MS);
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, onDashboard, funds.length]);

  return null;
}
