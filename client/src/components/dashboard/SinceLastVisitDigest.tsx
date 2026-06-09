// "Since you were away" digest — the returning-user catch-up beat.
//
// A returning parent (or a kid logging in after years) gets the balance ROLL
// (the aggregate delta, felt) and the notification bell (the individual
// events). This bridges them: one warm line that QUANTIFIES and ATTRIBUTES the
// gap — "a $50 gift from Manny Delgado, $100 from you, plus $182 in market
// growth." It's the "here's everything you missed" moment, and it shines
// exactly in the high-activity return (founder ask 2026-06-05).
//
// Honesty + accuracy choices:
//  - We distinguish gifts FROM OTHERS (the warm surprise) from the parent's OWN
//    recurring auto-invest (`parentContributionId`) — so the viewing parent is
//    never counted as one of the "people" who gifted. (The notification bell
//    already filters the parent's recurring as noise; this matches it.)
//  - Honest direction: a market dip SNAPS (never a fake "up"); gated to a real
//    RETURN (marker > 24h old) AND something noteworthy (a gift, or a >0.5%
//    move) — not a same-day re-check with a trivial delta.
//  - growth = delta − (gifts in + your in); clamped at 0 so a down market never
//    shows negative "growth."
//
// Reference point: a per-fund `{ value, ts }` marker cached on each load. On the
// NEXT load we read the OLD marker (before the write effect updates it) and diff
// against live. DEMO synthesizes a ~6-days-ago return at the real recent gifts +
// a small synthetic growth, once per session (the demo clears its cache on
// login), so the beat is demonstrable. Dismissible via CollapseDismissSection.

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { CollapseDismissSection } from "@/components/dashboard/CollapseDismissSection";

const LASTSEEN_PREFIX = "kiddo.fund.lastSeen.v1:";
const DEMO_SHOWN_KEY = "kiddo.demo.awayDigest.shown.v1";
const MIN_AWAY_MS = 24 * 60 * 60 * 1000; // a real "while you were away", not a same-day re-check
const NOTEWORTHY_MOVE_FRAC = 0.005; // or a >0.5% balance move counts even without a gift
export const DEMO_AWAY_MS = 6 * 24 * 60 * 60 * 1000; // demo: pretend "6 days ago" (also drives the bell's demo catch-up window — see DemoGiftMoment)
const DEMO_SYNTH_GROWTH_RATE = 0.008; // demo: ~0.8% synthetic growth over the gap
// Hold the digest until the hero count-up cascade has settled, so the landing
// reads as a SEQUENCE (balance + projection roll in → THEN "while you were
// away") instead of everything arriving at once. The balance rolls ~0–1.2s and
// the projection ~1.45–2.65s after the data lands; ~2.9s drops the digest just
// after, mirroring the gift-beat timing (DemoGiftMoment SWITCH_DELAY_MS). Both
// the roll and this reveal are anchored to the same data-ready signal, so on a
// slow load they stay sequenced no matter how late the data arrives.
const DIGEST_REVEAL_DELAY_MS = 2_900;

type LastSeen = { value: number; ts: number };

export type SinceLastVisitGift = {
  amount?: number | string | null;
  netAmount?: number | string | null;
  createdAt?: string | null;
  settledAt?: string | null;
  senderName?: string | null;
  status?: string | null;
  // Present when the gift is the PARENT'S own scheduled auto-invest cycle — used
  // to keep the viewing parent out of the "from N people" count.
  parentContributionId?: string | null;
};

function fmtMoney0(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function fmtShortDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function isAnonSender(name: string): boolean {
  const n = name.trim().toLowerCase();
  return !n || n === "anonymous" || /^someone who loves/i.test(n);
}

// "A, B, plus C." / "A, plus B." / "A."
function joinParts(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts.slice(0, -1).join(", ")}, plus ${parts[parts.length - 1]}.`;
}

export function SinceLastVisitDigest({
  fundId,
  currentValue,
  gifts,
  isDemoAccount,
  ready,
  subject = "Your fund",
}: {
  fundId: string | null;
  currentValue: number;
  gifts: SinceLastVisitGift[];
  isDemoAccount: boolean;
  // True once the gift list + value are fully loaded, so the digest appears
  // COMPLETE in one shot (no "$182 growth" → "$332 + 2 gifts" flicker).
  ready: boolean;
  // The headline subject — "Luke's fund" for a parent, "Your fund" for the
  // grown owner. Makes it a personal update, not a subjectless stat.
  subject?: string;
}) {
  // Read the OLD marker ONCE on mount, before the write effect updates it.
  const lastSeen = useMemo<LastSeen | null>(() => {
    if (!fundId) return null;
    return readLocalCache<LastSeen>(`${LASTSEEN_PREFIX}${fundId}`) ?? null;
  }, [fundId]);

  // Demo "show once per session" — read once on mount so latching it below
  // doesn't make the card vanish on a re-render.
  const demoAlreadyShown = useMemo(() => {
    if (!isDemoAccount) return false;
    try {
      return !!window.sessionStorage.getItem(DEMO_SHOWN_KEY);
    } catch {
      return false;
    }
  }, [isDemoAccount]);

  const [dismissed, setDismissed] = useState(false);

  // Update the marker for the NEXT visit (real accounts only — never poison the
  // demo's synthetic reference; only with a settled positive balance).
  useEffect(() => {
    if (!fundId || isDemoAccount || !(currentValue > 0)) return;
    try {
      writeLocalCache(`${LASTSEEN_PREFIX}${fundId}`, { value: currentValue, ts: Date.now() });
    } catch {
      /* best-effort */
    }
  }, [fundId, currentValue, isDemoAccount]);

  const digest = useMemo(() => {
    if (!ready || !(currentValue > 0)) return null;
    if (isDemoAccount && demoAlreadyShown) return null;

    const sinceTs = isDemoAccount ? Date.now() - DEMO_AWAY_MS : lastSeen?.ts ?? 0;
    if (!sinceTs) return null;
    if (!isDemoAccount && Date.now() - sinceTs < MIN_AWAY_MS) return null; // not a real return

    // Gifts that landed since the marker, split into FROM OTHERS vs the
    // parent's OWN auto-invest.
    const giftsSince = (gifts || []).filter((g) => {
      const status = String(g.status || "").toLowerCase();
      if (!["settled", "invested"].includes(status)) return false;
      const d = new Date(String(g.settledAt || g.createdAt || "")).getTime();
      return Number.isFinite(d) && d > sinceTs;
    });

    let othersSum = 0;
    let ownSum = 0;
    let otherGiftCount = 0;
    let otherAnon = 0;
    let singleOtherName = "";
    const otherNamed = new Set<string>();
    for (const g of giftsSince) {
      const amt = parseFloat(String(g.netAmount ?? g.amount ?? "0")) || 0;
      if (g.parentContributionId) {
        ownSum += amt; // the viewing parent's own recurring — not a "gift from someone"
        continue;
      }
      othersSum += amt;
      otherGiftCount += 1;
      const name = String(g.senderName || "").trim();
      if (isAnonSender(name)) otherAnon += 1;
      else {
        otherNamed.add(name.toLowerCase());
        singleOtherName = name;
      }
    }
    const otherGifterCount = otherNamed.size + otherAnon;

    let delta: number;
    let growth: number;
    if (isDemoAccount) {
      growth = currentValue * DEMO_SYNTH_GROWTH_RATE;
      delta = othersSum + ownSum + growth;
    } else {
      delta = currentValue - (lastSeen?.value ?? currentValue);
      if (delta < 1) return null; // nothing, or down — no fake "up"
      const noteworthy = giftsSince.length > 0 || delta >= currentValue * NOTEWORTHY_MOVE_FRAC;
      if (!noteworthy) return null;
      growth = Math.max(0, delta - othersSum - ownSum);
    }

    if (giftsSince.length === 0 && growth < 1) return null;
    return {
      sinceTs,
      delta,
      othersSum,
      otherGiftCount,
      otherGifterCount,
      // Single named gifter (for the warm "from {name}" phrasing); "someone"
      // when the lone other-gift is anonymous.
      singleOtherName: otherNamed.size === 1 ? singleOtherName : otherAnon === 1 ? "someone" : "",
      ownSum,
      growth,
    };
  }, [ready, isDemoAccount, demoAlreadyShown, lastSeen, currentValue, gifts]);

  // Hold the digest behind the hero roll cascade (see DIGEST_REVEAL_DELAY_MS).
  // DEMO ONLY — that's the surface where the "all at once" crush was reported
  // and the one we can tune against the seeded choreography. Real returning-
  // visitor behavior is left exactly as shipped (digest reveals immediately).
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!digest) return;
    if (!isDemoAccount) { setRevealed(true); return; }
    const t = window.setTimeout(() => setRevealed(true), DIGEST_REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [digest, isDemoAccount]);

  // Latch the demo once-per-session flag only once it's ACTUALLY shown (after
  // the reveal hold) — so a prospect who leaves during the hold still gets the
  // digest next visit instead of burning the once-per-session flag on a card
  // they never saw.
  useEffect(() => {
    if (isDemoAccount && digest && revealed) {
      try {
        window.sessionStorage.setItem(DEMO_SHOWN_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, [isDemoAccount, digest, revealed]);

  if (!digest || !revealed) return null;

  const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
  const parts: string[] = [];
  if (digest.otherGiftCount > 0) {
    if (digest.otherGifterCount === 1 && digest.singleOtherName) {
      parts.push(`a ${fmtMoney0(digest.othersSum)} gift from ${digest.singleOtherName}`);
    } else {
      parts.push(
        `${digest.otherGiftCount} ${digest.otherGiftCount === 1 ? "gift" : "gifts"} (${fmtMoney0(digest.othersSum)}) from ${people(digest.otherGifterCount)}`,
      );
    }
  }
  if (digest.ownSum >= 1) parts.push(`${fmtMoney0(digest.ownSum)} from you`);
  if (digest.growth >= 1) parts.push(`${fmtMoney0(digest.growth)} in market growth`);
  const body = joinParts(parts);

  return (
    <CollapseDismissSection
      open={!dismissed}
      // Swipe-to-dismiss, same gesture as CoparentAcceptedBanner (the X button
      // stays as the discoverable/a11y path). This banner looked dismissible but
      // wasn't swipeable — the infra was already here, just the callback wasn't
      // passed.
      onRequestDismiss={() => setDismissed(true)}
      className="mb-4 rounded-3xl border p-5 shadow-premium-sm sm:p-6"
      style={{
        borderColor: "hsl(var(--kiddo-evergreen) / 0.28)",
        background:
          "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 55%, hsl(var(--kiddo-evergreen) / 0.07) 100%)",
      }}
      data-testid="since-last-visit-digest"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="mb-1.5 text-[10px] font-bold uppercase"
            style={{ color: "hsl(var(--kiddo-evergreen))", letterSpacing: "0.14em" }}
          >
            While you were away
          </p>
          <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground leading-snug">
            {subject} is up {fmtMoney0(digest.delta)} since {fmtShortDate(digest.sinceTs)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 -mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-black/5 transition-colors"
          data-testid="since-last-visit-dismiss"
          aria-label="Dismiss the since-you-were-away summary"
        >
          <X size={16} />
        </button>
      </div>
    </CollapseDismissSection>
  );
}
