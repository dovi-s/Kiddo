// "Since you were away" digest — the returning-user catch-up beat.
//
// A returning parent (or a kid logging in after years) gets the balance ROLL
// (the aggregate delta, felt) and the notification bell (the individual
// events). This bridges them: one warm line that QUANTIFIES and ATTRIBUTES the
// gap — "a $50 gift from Leo Rivera, $100 from you, plus $182 in market
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
// Per-fund, session-persistent DISMISSAL. The digest behaves like the co-parent
// banner: it persists across navigating away and back, and only leaves when the
// viewer swipes / X's it -- PER FUND, so dismissing Theo's recap never touches
// Nora's. (Replaces a single shared `dismissed` flag that leaked across kids AND
// a GLOBAL demo "shown once" key that let only the first kid viewed in a session
// ever show the digest.) Demo dismissals stay under the kiddo.demo.* namespace so
// the demo's cache reset still clears them.
const AWAY_DISMISSED_REAL_PREFIX = "kiddo.fund.awayDismissed.v1:";
const AWAY_DISMISSED_DEMO_PREFIX = "kiddo.demo.awayDigest.dismissed.v1:";
function awayDismissKey(fundId: string, isDemo: boolean): string {
  return `${isDemo ? AWAY_DISMISSED_DEMO_PREFIX : AWAY_DISMISSED_REAL_PREFIX}${fundId}`;
}
function readAwayDismissed(fundId: string | null, isDemo: boolean): boolean {
  if (!fundId) return false;
  try {
    return !!window.sessionStorage.getItem(awayDismissKey(fundId, isDemo));
  } catch {
    return false;
  }
}
function writeAwayDismissed(fundId: string | null, isDemo: boolean): void {
  if (!fundId) return;
  try {
    window.sessionStorage.setItem(awayDismissKey(fundId, isDemo), "1");
  } catch {
    /* ignore */
  }
}
// Per-SESSION frozen baseline. "While you were away" must mean "since your last
// SESSION", not "since your first-ever visit". The persisted lastSeen marker
// advances once per session (at the first view of a fund this session); the
// value it HAD at that moment is frozen here in sessionStorage and drives the
// digest for the whole session. That gives both properties at once:
//   - across sessions: next session diffs from THIS session's start → true
//     "since last visit" (the window never drifts to an ever-growing "since
//     [first-ever date]" for a viewer who never taps dismiss);
//   - within a session: navigating away and back re-reads the SAME frozen
//     baseline, so the recap persists instead of vanishing on revisit.
// Real accounts only — the demo uses a synthetic 6-days-ago reference.
const SESSION_BASELINE_PREFIX = "kiddo.fund.awayBaseline.session.v1:";
function readSessionBaseline(fundId: string): LastSeen | null {
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_BASELINE_PREFIX}${fundId}`);
    return raw ? (JSON.parse(raw) as LastSeen) : null;
  } catch {
    return null;
  }
}
function writeSessionBaseline(fundId: string, baseline: LastSeen): void {
  try {
    window.sessionStorage.setItem(`${SESSION_BASELINE_PREFIX}${fundId}`, JSON.stringify(baseline));
  } catch {
    /* ignore */
  }
}
const MIN_AWAY_MS = 24 * 60 * 60 * 1000; // a real "while you were away", not a same-day re-check
const NOTEWORTHY_MOVE_FRAC = 0.005; // or a >0.5% balance move counts even without a gift
export const DEMO_AWAY_MS = 6 * 24 * 60 * 60 * 1000; // demo: pretend "6 days ago" (also drives the bell's demo catch-up window — see DemoGiftMoment)
const DEMO_SYNTH_GROWTH_RATE = 0.008; // demo: ~0.8% synthetic growth over the gap
// Standalone DEFAULT hold before the digest reveals, so it lands as a SEQUENCE
// (balance + projection roll in → THEN "while you were away") instead of on top
// of the roll. Callers that own a hero-roll cascade should pass `revealDelayMs`
// derived from THEIR timeline (DashboardLab does — its rolls and this reveal
// share one data-ready anchor, so they stay sequenced no matter how late data
// arrives). This default covers surfaces without their own cascade.
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
  revealDelayMs = DIGEST_REVEAL_DELAY_MS,
  revealed: revealedProp,
  viewerIsContributor = true,
}: {
  fundId: string | null;
  currentValue: number;
  gifts: SinceLastVisitGift[];
  isDemoAccount: boolean;
  // True once the gift list + value are fully loaded, so the digest appears
  // COMPLETE in one shot (no "$182 growth" → "$332 + 2 gifts" flicker).
  ready: boolean;
  // The headline subject — "Theo's fund" for a parent, "Your fund" for the
  // grown owner. Makes it a personal update, not a subjectless stat.
  subject?: string;
  // Whether the VIEWER is the person whose recurring auto-invest (the
  // `parentContributionId` rows) this is. Only the pre-handoff owner parent set
  // up that schedule, so only they get the warm "from you" credit. A co-parent
  // (co-admin) viewing the OTHER parent's recurring, or the post-handoff kid
  // viewing a parent's historical contributions, must NOT be told it was "you" —
  // that's a mis-attribution, and the brand's trust is the moat. They get a
  // neutral, true label instead. Defaults true so standalone callers (owner
  // surfaces) keep the personal voice.
  viewerIsContributor?: boolean;
  // How long after `digest` is ready to hold before revealing — used only when
  // the caller does NOT drive the reveal itself. Defaults to the standalone
  // DIGEST_REVEAL_DELAY_MS.
  revealDelayMs?: number;
  // PARENT-DRIVEN reveal. When provided, the parent owns timing (e.g. DashboardLab
  // anchors it to the hero roll's ACTUAL start, so the digest can't land mid-roll
  // on a slow machine). When omitted, the internal revealDelayMs timer is used.
  revealed?: boolean;
}) {
  // The reference the digest diffs against: the per-session frozen baseline if
  // it exists, else the persisted marker (last session). Per fund — recomputes
  // when fundId changes (the component persists across fund switches). The
  // establish effect below freezes the session baseline and advances the
  // persisted marker on the first view of a fund each session; until then this
  // falls back to the persisted marker, which IS the right value (last
  // session's), so the digest is correct even before the effect runs. Always
  // null for the demo (it uses a synthetic 6-days-ago reference instead).
  const sessionBaseline = useMemo<LastSeen | null>(() => {
    if (isDemoAccount || !fundId) return null;
    const frozen = readSessionBaseline(fundId);
    if (frozen) return frozen;
    try {
      return readLocalCache<LastSeen>(`${LASTSEEN_PREFIX}${fundId}`) ?? null;
    } catch {
      return null;
    }
  }, [isDemoAccount, fundId]);

  // Per-fund dismissal. The component instance PERSISTS across fund switches (no
  // remount), so this must key off fundId -- a single boolean would leak one
  // kid's dismissal onto another. dismissTick just forces a re-read after a write.
  const [dismissTick, setDismissTick] = useState(0);
  const dismissed = useMemo(
    () => readAwayDismissed(fundId, isDemoAccount),
    [fundId, isDemoAccount, dismissTick],
  );
  const handleDismiss = () => {
    writeAwayDismissed(fundId, isDemoAccount);
    // Advance the real-account baseline so this recap won't reappear and the next
    // away-period diffs from here. (Demo uses a synthetic reference -- no marker.)
    if (fundId && !isDemoAccount && currentValue > 0) {
      try {
        writeLocalCache(`${LASTSEEN_PREFIX}${fundId}`, { value: currentValue, ts: Date.now() });
      } catch {
        /* best-effort */
      }
    }
    setDismissTick((t) => t + 1);
  };

  // On the FIRST view of a fund each session, freeze the current persisted marker
  // (last session's reference) as the session baseline, then advance the
  // persisted marker to NOW so the NEXT session diffs from here — true "since
  // last visit" with no ever-growing window, while away-and-back THIS session
  // re-reads the frozen baseline so the recap persists. Guarded on a settled
  // positive value so a partial mid-load total never poisons the marker (the next
  // session must never roll up from a value the fund was never at). Runs once per
  // session per fund; later views find the freeze and skip. Dismiss still
  // advances the persisted marker too (handleDismiss), so a dismisser's next
  // session diffs from the dismiss moment — either path is honest "since last".
  useEffect(() => {
    if (isDemoAccount || !fundId || !ready || !(currentValue > 0)) return;
    if (readSessionBaseline(fundId)) return; // already established this session
    let persisted: LastSeen | null = null;
    try {
      persisted = readLocalCache<LastSeen>(`${LASTSEEN_PREFIX}${fundId}`) ?? null;
    } catch {
      /* best-effort */
    }
    // First-ever visit (no persisted marker) → baseline is "now", so nothing
    // reads as "away" this session; the next session diffs from this first view.
    const baseline: LastSeen = persisted ?? { value: currentValue, ts: Date.now() };
    writeSessionBaseline(fundId, baseline);
    try {
      writeLocalCache(`${LASTSEEN_PREFIX}${fundId}`, { value: currentValue, ts: Date.now() });
    } catch {
      /* best-effort */
    }
  }, [isDemoAccount, fundId, ready, currentValue]);

  const digest = useMemo(() => {
    if (!ready || !(currentValue > 0)) return null;

    const sinceTs = isDemoAccount ? Date.now() - DEMO_AWAY_MS : sessionBaseline?.ts ?? 0;
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
      delta = currentValue - (sessionBaseline?.value ?? currentValue);
      if (delta < 1) return null; // nothing, or down — no fake "up"
      // Honesty: if a market dip means the gifts alone EXCEED the total gain, the
      // "up $X" headline would read as less than the gift we'd credit — the parts
      // wouldn't reconcile to the total. Suppress rather than show a recap that
      // doesn't add up (the notification bell still surfaces the individual gift).
      if (othersSum + ownSum > delta + 1) return null;
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
  }, [ready, isDemoAccount, sessionBaseline, currentValue, gifts]);

  // Hold the digest behind the hero roll cascade (see DIGEST_REVEAL_DELAY_MS) so
  // the landing reads as a sequence (balance + projection roll in -> THEN "while
  // you were away") instead of landing on top of the roll. Applies EVERYWHERE,
  // not just the demo: a real returning visitor with a noteworthy move also
  // watches the hero roll, and the digest is a "welcome back" recap that belongs
  // after it settles. The digest only renders on a meaningful return (24h+ and a
  // noteworthy delta), so the ~2.9s settle-beat never gates a non-event.
  // When the parent drives the reveal (`revealedProp` !== undefined), use it
  // verbatim — the parent anchors timing to the hero roll. Otherwise fall back to
  // the internal hold timer.
  const parentDriven = revealedProp !== undefined;
  const [internalRevealed, setInternalRevealed] = useState(false);
  useEffect(() => {
    if (parentDriven || !digest) return;
    const t = window.setTimeout(() => setInternalRevealed(true), revealDelayMs);
    return () => window.clearTimeout(t);
  }, [parentDriven, digest, revealDelayMs]);
  const revealed = parentDriven ? Boolean(revealedProp) : internalRevealed;

  // (The old once-per-session demo latch is gone: dismissal is now per-fund and
  // persistent, so each kid's recap shows until the viewer dismisses it — and a
  // prospect who never dismisses it sees it again on the next visit.)

  if (!digest || !revealed) return null;

  const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
  const parts: string[] = [];
  if (digest.otherGiftCount > 0) {
    if (digest.otherGifterCount === 1 && digest.singleOtherName) {
      parts.push(
        digest.otherGiftCount === 1
          ? `a ${fmtMoney0(digest.othersSum)} gift from ${digest.singleOtherName}`
          : `${fmtMoney0(digest.othersSum)} from ${digest.singleOtherName} (${digest.otherGiftCount} gifts)`,
      );
    } else {
      parts.push(
        `${digest.otherGiftCount} ${digest.otherGiftCount === 1 ? "gift" : "gifts"} (${fmtMoney0(digest.othersSum)}) from ${people(digest.otherGifterCount)}`,
      );
    }
  }
  if (digest.ownSum >= 1) {
    // "from you" only when the viewer actually made these recurring
    // contributions (the pre-handoff owner). For a co-parent or the
    // post-handoff kid it wasn't them — label it truthfully, never falsely "you".
    parts.push(viewerIsContributor
      ? `${fmtMoney0(digest.ownSum)} from you`
      : `${fmtMoney0(digest.ownSum)} in recurring investments`);
  }
  if (digest.growth >= 1) parts.push(`${fmtMoney0(digest.growth)} in market growth`);
  const body = joinParts(parts);

  return (
    <CollapseDismissSection
      open={!dismissed}
      // Grow in (height 0 -> auto) rather than snap: the digest reveals AFTER
      // the hero roll settles and sits above it, so a height-grow eases the hero
      // down instead of shoving it a card-height at once.
      enterCollapsed
      // Swipe-to-dismiss, same gesture as CoparentAcceptedBanner (the X button
      // stays as the discoverable/a11y path). This banner looked dismissible but
      // wasn't swipeable — the infra was already here, just the callback wasn't
      // passed.
      onRequestDismiss={handleDismiss}
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
            className="mb-1.5 text-3xs font-bold uppercase"
            style={{ color: "hsl(var(--kiddo-evergreen))", letterSpacing: "0.14em" }}
          >
            While you were away
          </p>
          <h2 className="font-heading text-[clamp(15px,4.3vw,20px)] font-semibold text-foreground leading-snug">
            {subject} is up {fmtMoney0(digest.delta)} since {fmtShortDate(digest.sinceTs)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
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
