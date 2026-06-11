// DemoGiftMoment — the live "a gift just came in" beat(s) in the Dunphy demo.
//
// Why it exists: the most emotional moment in the product is the parent seeing
// "Gloria added $75 to Haley's future." Reading about it isn't feeling it. The
// demo is the distribution/conversion surface (creator outreach links land
// here), so letting a prospect FEEL that beat is high-leverage — it's the
// "show, don't tell" of the gifter loop.
//
// ONE beat: LOOP CLOSURE (the earned one). If the prospect just role-played
// SENDING a gift (the demo gift checkout routes through server/demoSandbox.ts ->
// GiftSuccess?demo=1, which stashes what they sent in sessionStorage), then on
// returning to the dashboard they feel the parent-side arrival of the *exact*
// gift they just sent. They experience both sides of the loop, and the moment is
// EARNED by their own action.
//
// (A second "generic seeded beat" — an ambient, unprompted gift from Manny/Gloria
// that fired on a fund-switch or after a dwell — was REMOVED 2026-06-10. It was
// the one beat that animated a gift that never happened: the roll-in is real
// (cache -> live) and this beat is the prospect's own real send, but the ambient
// one invented an arrival. Mild theater in a brand whose moat is honesty, and it
// was the beat that collided with the opening roll/digest cascade. The "watch it
// land" moment is now earned-only; the dashboard's "give a gift, then watch it
// land" CTA carries the invitation. Some switch/dwell scaffolding for it remains
// below but is inert; a future pass can prune it.)
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
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { capFirst } from "@/lib/format-name";
import { haptic } from "@/lib/haptics";
import { markNotificationsReadAsOf, getLastReadAt } from "@/components/NotificationsPanel";
import { DEMO_AWAY_MS } from "@/components/dashboard/SinceLastVisitDigest";
import { STOCK_PICK_NAMES } from "@shared/stock-picks";

const PENDING_KEY = "kiddo.demo.pendingGift.v1";       // set by GiftSuccess after a demo send

// Loop closure (the only beat now). Lands the just-sent gift as its OWN beat
// AFTER the initial-landing cascade settles, not on top of it: the pre-cache
// returning-roll PLUS the since-last-visit digest (which reveals ~2.9s). At 3.0s
// the gift dropped on top of the digest (founder-reported collision, 2026-06-10:
// "gift from Manny same time as the roll"). 4.8s lands it ~1.5s after the digest
// settles, so the sequence reads roll, then digest, then gift, one beat at a time.
// Still filled time, not empty waiting: the cascade plays the whole while.
// Founder-tunable.
const JUST_SENT_DELAY_MS = 4_800;

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
      // Self-healing catch-up. The guard keys on the ACTUAL persisted read-state
      // (getLastReadAt), not just a sessionStorage flag. Why this matters: the
      // seeded backlog spans years; if lastReadAt is missing or ancient, EVERY
      // worn item counts as unread and the bell + Activity badges open at "9+"
      // (the anxiety-on-the-conversion-surface case this whole block exists to
      // prevent). The old flag-only guard skipped re-applying whenever the flag
      // was set on an earlier view but the persisted read-state was never
      // written / got cleared — leaving the badges stuck at 9+ despite "caught
      // up." Now: if lastReadAt is unset or older than the catch-up window, we
      // (re)stamp "caught up as of the digest window" (~6 days). The genuinely-
      // recent items the SinceLastVisitDigest summarizes (a fresh gift, a
      // co-parent who just joined) stay unread, so the bell is ACTIVE, not dead.
      // Idempotent + self-healing: the guard uses a STABLE staleness threshold
      // (30 days), while the stamp sets the 6-day window. So once we stamp
      // lastReadAt to ~now-6d (which is well inside 30d), the guard reads
      // "caught up" and skips on every later load — it never re-clobbers a
      // user's swipe-to-unread. It only (re)fires when lastReadAt is genuinely
      // unset (0) or ancient, i.e. exactly the "whole backlog unread → 9+" state.
      const STALE_MS = 30 * 24 * 60 * 60 * 1000;
      if (getLastReadAt() < Date.now() - STALE_MS) {
        markNotificationsReadAsOf(Date.now() - DEMO_AWAY_MS);
      }
    } catch {
      // storage blocked → skip; badges just open as before (no worse).
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
    // Beat 1 (loop closure) is the only beat now; it arms on landing and fires
    // after the initial-landing cascade (JUST_SENT_DELAY_MS).
    let fire: (() => void) | null = null;
    const delay = JUST_SENT_DELAY_MS;

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

    // --- Beat 2 (the ambient, unprompted seeded gift from Manny/Gloria) was
    // REMOVED 2026-06-10 (founder call). It was the only beat that animated a gift
    // that never happened: the roll-in is real (cache -> live) and beat 1 is the
    // prospect's OWN real send, but beat 2 invented an arrival. That is mild
    // theater in a product whose moat is honesty, and it was the beat that collided
    // with the opening roll/digest cascade. The "watch it land" moment is now
    // EARNED only: the prospect sends a gift (beat 1) and feels it land; the
    // dashboard's "give a gift, then watch it land ->" CTA carries the invitation.
    // With no just-sent gift to replay, there is nothing to fire. (Its switch/dwell
    // arming scaffolding was pruned in the same change.)
    if (!fire) return;
    const fireOnce = fire;

    const currentDelay = delay;
    let fired = false; // hard once-per-mount latch

    const clear = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // Beat 1 arms on landing and fires fireOnce after currentDelay, once. It pauses
    // while the tab is hidden so the "watch it land" beat plays to the prospect's
    // eyes, not a backgrounded tab; re-arms fresh when they return.
    const arm = () => {
      if (fired || timerRef.current != null) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (fired) return;
        fired = true;
        fireOnce();
      }, currentDelay);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") arm();
      else clear(); // tabbed away mid-countdown -> reset; re-arms on return
    };

    arm(); // arms beat 1 on landing
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, onDashboard, funds.length]);

  return null;
}
