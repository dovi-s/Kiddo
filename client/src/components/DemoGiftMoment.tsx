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
import { markNotificationsReadAsOf } from "@/components/NotificationsPanel";
import { DEMO_AWAY_MS } from "@/components/dashboard/SinceLastVisitDigest";
import { STOCK_PICK_NAMES } from "@shared/stock-picks";

const PENDING_KEY = "kiddo.demo.pendingGift.v1";       // set by GiftSuccess after a demo send
const SESSION_KEY = "kiddo.demo.giftMoment.genericBeat.v1"; // generic beat: once per session (a fresh / incognito session resets it)
const CAUGHT_UP_KEY = "kiddo.demo.caughtUp.v2";        // demo opens caught-up-as-of-the-digest-window: once per session

// Generic beat on a fund-SWITCH. Timed to land the gift as its OWN beat, just
// AFTER the hero's roll cascade settles — not on top of it. On a switch the
// balance rolls ~0–1.2s, then the projection rolls ~1.35–2.55s (the deliberate
// balance→projection stagger). 2.8s drops the gift ~250ms after the projection
// settles, so the sequence reads balance → projection → gift, one beat at a
// time (the same one-thing-moving principle as the count-up stagger).
const SWITCH_DELAY_MS = 2_800;
const JUST_SENT_DELAY_MS = 3_000; // loop closure — they came back to feel it; don't make them wait

// Dwell fallback for the generic beat. The beat is normally switch-triggered,
// but a prospect who explores ONE fund and never switches would otherwise never
// see the signature "watch it land" moment. After ~25s of ACTIVE (tab-visible)
// dwell with no switch, let the gift arrive on the current fund. 25s is past the
// opening roll/digest crush (~4s) so it reads as unprompted, yet short enough to
// catch a typical demo session before the prospect leaves (60–120s would fire
// into an empty room for most). Resets — not accumulates — if the tab hides.
const DWELL_DELAY_MS = 25_000;
const DWELL_SETTLE_MS = 500; // small beat after dwell elapses (no fresh roll to wait on, unlike a switch)

// Per-child gift that matches the seeded personas, so the ambient beat reads
// real ("Gloria added $75 to Haley"). Falls back to a generic warm gifter.
const DEMO_GIFTS: Record<string, { sender: string; amount: string; ticker: string }> = {
  haley: { sender: "Gloria Pritchett", amount: "75", ticker: "DIS" },
  alex: { sender: "Jay Pritchett", amount: "250", ticker: "GOOGL" },
  luke: { sender: "Manny Delgado", amount: "50", ticker: "RBLX" },
};
// Where the gift goes, in friendly terms. Uses the CANONICAL curated-stock name
// map (STOCK_PICK_NAMES — all ~24 picks) so a loop-closure gift to ANY curated
// stock reads true ("Going into Nike"); the old local 5-ticker map fell back to
// a FALSE "the diversified mix" for the other 19. No specific ticker (managed
// mix / VTI) → the honest "the diversified mix."
const giftDestination = (ticker: string | null | undefined): string =>
  STOCK_PICK_NAMES[String(ticker || "").toUpperCase()] || "the diversified mix";

// Gift amount, currency-formatted: "$50", "$1,500", "$75.50" — never a raw
// "$1500" or an ugly "$50.00". Matters for the loop-closure beat, where the
// prospect picks the amount.
const fmtGiftAmount = (raw: string | number): string => {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

export function DemoGiftMoment() {
  const { user } = useAuth();
  const { data: funds = [] } = useFunds();
  const [location, navigate] = useLocation();
  const timerRef = useRef<number | null>(null);

  const isDemo = Boolean((user as any)?.isDemoAccount);

  // Demo opens CAUGHT UP — but NOT empty. A fresh viewer has no notification
  // read-state, so all 8 years of seeded activity count as unread and the bell +
  // Activity badges open at "9+/9+" — anxiety on the conversion surface. But a
  // worn, active account shouldn't open with a DEAD bell either: there should be
  // a genuine, account-true notification waiting — a recent gift, a co-parent who
  // just joined, an upcoming occasion (founder 2026-06-08). So instead of marking
  // EVERYTHING read, we stamp "caught up as of the digest's window" (~6 days):
  // the years-old backlog reads as seen, while the genuinely-recent items — the
  // SAME ones the SinceLastVisitDigest summarizes (e.g. Luke: a gift from Manny;
  // Alex: a gift from Jay + "Co-parent joined") — stay unread. Bounded (~1–2 per
  // fund after the bell's noise filter), true to each worn fund, and the live gift
  // THIS component lands below adds to it. Once-per-session so reading them sticks;
  // a fresh / incognito session re-experiences it. Real accounts untouched
  // (isDemo-gated).
  useEffect(() => {
    if (!isDemo || typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(CAUGHT_UP_KEY)) return;
      markNotificationsReadAsOf(Date.now() - DEMO_AWAY_MS);
      window.sessionStorage.setItem(CAUGHT_UP_KEY, "1");
    } catch {
      // sessionStorage blocked → skip; badges just open as before (no worse).
    }
  }, [isDemo]);
  // Includes /design-lab so the redesign surface gets the same live-gift beat as
  // /dashboard (it's being groomed to replace it). Without this, /design-lab had
  // no "watch it land" moment AND no gift-triggered hero roll. The only navigate()
  // is on a toast tap, so firing here never yanks the viewer off the page.
  const onDashboard = location === "/dashboard" || location === "/" || location === "/design-lab";

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
        const where = giftDestination(pending.ticker);
        const isRecurring = !!pending.isRecurring;
        delay = JUST_SENT_DELAY_MS;
        fire = () => {
          try { window.sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
          haptic("success");
          toast({
            variant: "gift", // warm, branded delight treatment — not a system card
            title: isRecurring
              ? `${sender}'s monthly gift to ${child} is on its way`
              : `${sender} added $${fmtGiftAmount(amount)} to ${child}'s future`,
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
        // Never land a simulated gift on a previous owner's keepsake view. Their
        // post-handoff window is frozen at the handoff; a fake "new gift" toast
        // both breaks that freeze and surfaces activity on the now-adult's private
        // fund. (The owner — the now-adult — still gets the beat on their own view.)
        if (fund.accessRole === 'previous_owner') return;
        const childRaw = String(fund.recipientFirstName || "");
        const child = capFirst(childRaw) || "your child";
        const g = DEMO_GIFTS[childRaw.toLowerCase()] || { sender: "Cameron Tucker", amount: "100", ticker: "DIS" };
        const where = giftDestination(g.ticker);
        // Record a REAL session gift (Stage 1 of the demo sandbox), so the
        // ambient beat genuinely lands a gift_received row in the Activity feed,
        // lights the notification bell, appears in the Memory Book, and ticks the
        // useFunds-backed surfaces (/funds total, header). Once-per-session so
        // the demo never floods with fake gifts.
        recordDemoLiveGift({ fundId: fund.id, senderName: g.sender, amount: g.amount, ticker: g.ticker });
        haptic("success");
        toast({
          variant: "gift", // warm, branded delight treatment — not a system card
          title: `${g.sender} added $${fmtGiftAmount(g.amount)} to ${child}'s future`,
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
    let dwellTimer: number | null = null;

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
    const clearDwell = () => {
      if (dwellTimer != null) { window.clearTimeout(dwellTimer); dwellTimer = null; }
    };
    // No-switch dwell fallback (generic beat only): flip the same `switchArmed`
    // gate the switch handler uses after ~25s of visible dwell, then fire
    // promptly. Whichever happens first — a switch or the dwell — wins, and
    // once-per-session still holds (fireOnce sets SESSION_KEY). Unlike a switch,
    // this can land on the LANDING fund; that's intended (25s in is well past the
    // opening crush, so it reads as "a gift just arrived," not "my click did it").
    const armDwell = () => {
      if (!isGenericBeat || switchArmed || fired || dwellTimer != null) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      dwellTimer = window.setTimeout(() => {
        dwellTimer = null;
        if (fired || switchArmed) return;
        switchArmed = true;
        currentDelay = DWELL_SETTLE_MS;
        arm();
      }, DWELL_DELAY_MS);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") { arm(); armDwell(); }
      else { clear(); clearDwell(); } // tabbed away mid-countdown → reset; re-arms fresh on return
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
      clearDwell(); // a switch takes over from the dwell fallback
      clear();
      arm();
    };

    arm(); // no-op for the generic beat until a switch; arms beat 1 on landing
    armDwell(); // start the no-switch dwell fallback for the generic beat
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, onFundChange);
    return () => {
      clear();
      clearDwell();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, onFundChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, onDashboard, funds.length]);

  return null;
}
