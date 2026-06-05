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
//   2. GENERIC SEEDED BEAT (the ambient one): absent a just-sent gift, one warm
//      seeded gift arrives so the prospect feels the moment once. It fires ONLY
//      on their FIRST FUND-SWITCH (~2.8s after the new fund's balance roll
//      lands) — the "land = the balance rolls in, switch = a gift rolls in"
//      choreography (founder 2026-06-04: "Luke no gift in, then Alex yes gift
//      in"). The fund they LAND on never shows a gift; the gift is the reward
//      for exploring, and it fires exactly once.
//
// Discipline (what keeps it magic, not slop):
//   • The generic beat fires ONCE PER SESSION — not per fund, not a stream
//     ("it shouldn't happen more than once for the same user — confusing
//     otherwise"). A fresh / incognito session resets it, so the demo can be
//     re-experienced clean.
//   • Demo accounts only (user.isDemoAccount); a no-op for everyone else.
//   • NO data mutation beyond the recorded session gift — a client-side toast
//     reusing the app's real toast UI, so it never drifts the (carefully
//     reconciled) fund balance/counts.
//   • Honest — it's inside the clearly-"illustrative" Dunphy demo; the
//     loop-closure beat mirrors the gift the prospect literally just sent, and
//     the generic beat mirrors a real seeded gifter/amount for the active child.
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";
import { getActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { capFirst } from "@/lib/format-name";
import { haptic } from "@/lib/haptics";
import { recordDemoLiveGift } from "@/lib/demo-live-gifts";

const PENDING_KEY = "kiddo.demo.pendingGift.v1";       // set by GiftSuccess after a demo send
const SESSION_KEY = "kiddo.demo.giftMoment.genericBeat.v1"; // generic beat: once per session (a fresh / incognito session resets it)

// Generic beat on a fund-SWITCH. Timed to land the gift as its OWN beat, just
// AFTER the hero's roll cascade settles — not on top of it. On a switch the
// balance rolls ~0–1.2s, then the projection rolls ~1.35–2.55s (the deliberate
// balance→projection stagger). 2.8s drops the gift ~250ms after the projection
// settles, so the sequence reads balance → projection → gift, one beat at a
// time (the same one-thing-moving principle as the count-up stagger).
const SWITCH_DELAY_MS = 2_800;
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

    // Build the beat to fire — loop-closure if the prospect just role-played
    // sending a gift, else the once-per-session generic beat — as a single
    // `fire()` thunk. We then arm it behind a visibility gate (below) so the
    // beat plays to the prospect's EYES, not to a backgrounded tab. (Gift
    // arrival is the product's signature "watch it land" moment; a fixed timer
    // that elapses while they've tabbed away — then marks itself shown — is
    // exactly how that moment gets silently missed.)
    let fire: (() => void) | null = null;
    let delay = SWITCH_DELAY_MS;
    // True only for the generic seeded beat (beat 2) — the SWITCH-triggered one.
    // The loop-closure beat (beat 1) stays bound to the exact gift just sent and
    // arms on landing instead.
    let isGenericBeat = false;

    // --- Beat 1: loop closure. Did the prospect just role-play SENDING a gift?
    // Replay it as the parent-side arrival of the exact gift they sent. The
    // PENDING_KEY is consumed when the beat fires (not on read), so a bounce
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
        delay = JUST_SENT_DELAY_MS;
        fire = () => {
          try { window.sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
          haptic("success");
          toast({
            variant: "gift", // warm, branded delight treatment — not a system card
            title: isRecurring
              ? `${sender}'s monthly gift to ${child} is on its way`
              : `${sender} added $${amount} to ${child}'s future`,
            description: `Going into ${where}. The gift you just sent is landing in ${child}'s Memory Book.`,
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
          // No presentational hero-roll hack needed: the gift was recorded into
          // the overlay by GiftSuccess, so it lands in a holding → the hero's
          // invested total rises → the count-up rolls it (real + sticky) → and
          // it's in the Activity feed, bell, and Memory Book. One recorded fact,
          // reflected everywhere.
        };
      }
    }

    // --- Beat 2: generic seeded beat. ONCE PER SESSION, fired ONLY on the first
    // fund-switch (never on the landing fund). sessionStorage (set only when the
    // beat fires) is the once-per-session guard, so a bounce away before it
    // fires re-arms on return, and a fresh / incognito session resets it.
    if (!fire) {
      try {
        if (window.sessionStorage.getItem(SESSION_KEY)) return; // already shown this session
      } catch {
        return; // sessionStorage blocked → skip rather than risk repeating
      }

      isGenericBeat = true;
      // The active fund is resolved at FIRE time, so the gift lands on the fund
      // the prospect just SWITCHED to — Jay's $250 on Alex, Manny's $50 on Luke.
      fire = () => {
        try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
        const activeId = getActiveFundId();
        const fund = (funds.find((f) => f.id === activeId) ?? funds[0]) as any;
        if (!fund) return;
        const childRaw = String(fund.recipientFirstName || "");
        const child = capFirst(childRaw) || "your child";
        const g = DEMO_GIFTS[childRaw.toLowerCase()] || { sender: "Cameron Tucker", amount: "100", ticker: "DIS" };
        const where = TICKER_NAME[g.ticker] || "the diversified mix";
        // Record a REAL session gift (Stage 1 of the demo sandbox), so the
        // ambient beat genuinely lands a gift_received row in the Activity feed,
        // lights the notification bell, appears in the Memory Book, and ticks the
        // useFunds-backed surfaces (/funds total, header). Once-per-session so
        // the demo never floods with fake gifts.
        recordDemoLiveGift({ fundId: fund.id, senderName: g.sender, amount: g.amount, ticker: g.ticker });
        haptic("success");
        toast({
          variant: "gift", // warm, branded delight treatment — not a system card
          title: `${g.sender} added $${g.amount} to ${child}'s future`,
          description: `Going into ${where}. A new moment in ${child}'s Memory Book.`,
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
        // The recorded gift lands in a holding, so the hero's invested total
        // rises and the count-up rolls it (real + sticky) — no presentational
        // hero-roll hack needed.
      };
    }

    if (!fire) return;
    const fireOnce = fire;

    // currentDelay is the beat's base (3s loop-closure / 2.8s generic switch).
    let currentDelay = delay;
    let lastFundId = getActiveFundId();
    // Hard once-per-mount latch on top of the SESSION_KEY guard (which only runs
    // at setup): without it, a second fund-switch could re-arm and fire again.
    let fired = false;
    // The generic beat is SWITCH-triggered: it must NOT arm on the landing fund
    // (founder: "Luke no gift, then Alex gift"). It only becomes armable once a
    // real fund-switch has happened. Beat 1 (loop-closure) is unaffected — it
    // arms on landing as usual.
    let switchArmed = false;

    const clear = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const arm = () => {
      if (fired || timerRef.current != null) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (isGenericBeat && !switchArmed) return; // generic beat waits for a switch
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (fired) return;
        fired = true;
        fireOnce();
      }, currentDelay);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") arm();
      else clear(); // tabbed away mid-countdown → reset; re-arms fresh on return
    };

    // Fund-switch handler — the heart of "land = roll, switch = gift". On a REAL
    // switch (id changed, not the initial fund-set), arm the generic beat for
    // the fund just opened and fire it ~2.8s later, after that fund's balance
    // roll has landed. The id-changed guard means landing only plays the balance
    // roll; the gift is the reward for exploring. Once `fired`, later switches
    // do nothing (once per session). Loop-closure (beat 1) is exempt.
    const onFundChange = (e: Event) => {
      if (!isGenericBeat || fired) return;
      const id = (e as CustomEvent)?.detail?.id ?? getActiveFundId();
      if (!id || id === lastFundId) return;
      lastFundId = id;
      switchArmed = true; // a real switch happened — the gift may now land
      currentDelay = SWITCH_DELAY_MS;
      clear();
      arm();
    };

    arm(); // no-op for the generic beat until a switch; arms beat 1 on landing
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, onFundChange);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, onFundChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, onDashboard, funds.length]);

  return null;
}
