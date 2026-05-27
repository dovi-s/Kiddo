// DemoGiftMoment — the live "a gift just came in" beat(s) in the Dunphy demo.
//
// Why it exists: the most emotional moment in the product is the parent seeing
// "Gloria added $75 to Haley's future." Reading about it isn't feeling it. The
// demo is the distribution/conversion surface (creator outreach links land
// here), so letting a prospect FEEL that beat is high-leverage — it's the
// "show, don't tell" of the gifter loop.
//
// Two beats, in priority order:
//   1. LOOP CLOSURE (the strong one): if the prospect just role-played SENDING
//      a gift (the demo gift checkout routes through server/demoSandbox.ts →
//      GiftSuccess?demo=1, which stashes what they sent in sessionStorage),
//      then on returning to the dashboard they feel the parent-side arrival of
//      the *exact* gift they just sent. They experience both sides of the loop.
//   2. GENERIC SEEDED BEAT (the ambient one): absent a just-sent gift, ~15s
//      after they settle on the dashboard, one warm seeded gift arrives so a
//      passive browser still feels the moment once.
//
// Discipline (what keeps it magic, not slop):
//   • The generic beat fires ONCE per browser session — not a stream of fake
//     gifts (a notification slot-machine would violate the calm register).
//   • Demo accounts only (user.isDemoAccount); a no-op for everyone else.
//   • NO data mutation — a client-side toast reusing the app's real toast UI,
//     so it never drifts the (carefully reconciled) fund balance/counts.
//   • Honest — it's inside the clearly-"illustrative" Dunphy demo; the
//     loop-closure beat mirrors the gift the prospect literally just sent, and
//     the generic beat mirrors a real seeded gifter/amount for the active child.
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";
import { getActiveFundId } from "@/hooks/use-active-fund";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { capFirst } from "@/lib/format-name";
import { haptic } from "@/lib/haptics";

const SESSION_KEY = "kiddo.demo.giftMoment.shown.v1"; // generic beat: once per session
const PENDING_KEY = "kiddo.demo.pendingGift.v1";       // set by GiftSuccess after a demo send
const DELAY_MS = 15_000;          // generic beat — after they settle in
const JUST_SENT_DELAY_MS = 3_000; // loop closure — they came back to feel it; don't make them wait

// Per-child gift that matches the seeded personas, so the ambient beat reads
// real ("Gloria added $75 to Haley"). Falls back to a generic warm gifter.
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

    const clear = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // --- Beat 1: loop closure. Did the prospect just role-play SENDING a gift?
    // Replay it as the parent-side arrival of the exact gift they sent. The
    // PENDING_KEY is consumed when the timer fires (not on read), so a bounce
    // away before it fires simply re-arms on return, and it can't double-fire.
    let pending: any = null;
    try {
      const raw = window.sessionStorage.getItem(PENDING_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch { pending = null; }

    if (pending && pending.fundId) {
      const fund = (funds.find((f) => f.id === pending.fundId) ?? funds[0]) as any;
      if (fund) {
        const child = capFirst(String(fund.recipientFirstName || "")) || "your child";
        const senderRaw = String(pending.senderName || "").trim();
        const sender = senderRaw && senderRaw.toLowerCase() !== "someone" ? senderRaw : "Someone";
        const amount = String(pending.amount || "").replace(/[^0-9.]/g, "") || "0";
        const where = TICKER_NAME[String(pending.ticker || "").toUpperCase()] || "the diversified mix";
        const isRecurring = !!pending.isRecurring;
        timerRef.current = window.setTimeout(() => {
          try { window.sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
          haptic("success");
          toast({
            title: isRecurring
              ? `${sender}'s monthly gift to ${child} is on its way 🌱`
              : `${sender} added $${amount} to ${child}'s future 🌱`,
            description: `Going into ${where} — the gift you just sent is landing in ${child}'s Memory Book.`,
            duration: 9000, // a delight beat needs time to read both lines + tap View
            action: (
              <ToastAction
                altText={`View ${child}'s Memory Book`}
                onClick={() => { haptic("selection"); navigate(`/memory/${fund.id}`); }}
              >
                View
              </ToastAction>
            ),
          });
        }, JUST_SENT_DELAY_MS);
        return clear;
      }
    }

    // --- Beat 2: generic seeded beat. Once per session, ~15s after they settle.
    // sessionStorage (set only when the timer fires) is the once-per-session
    // guard, so a bounce away before it fires re-arms on return.
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
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, onDashboard, funds.length]);

  return null;
}
