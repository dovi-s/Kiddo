// "Since you were away" digest — the returning-user catch-up beat.
//
// A returning parent (or a kid logging in after years) gets the balance ROLL
// (the aggregate delta, felt) and the notification bell (the individual
// events). This bridges them: one line that QUANTIFIES and ATTRIBUTES the gap —
// "Up $341 since May 30 — 2 new gifts ($150) from 2 people, plus $191 in
// market growth." It's the "here's everything you missed" moment, and it shines
// exactly in the high-activity case (founder ask 2026-06-05).
//
// How the reference point works:
//  - We cache a per-fund `{ value, ts }` marker on every load. On the NEXT load
//    we read the OLD marker (before the write effect updates it) and diff
//    against live: delta = now − then; gifts-since = gifts dated after `ts`;
//    growth = delta − gifts.
//  - Gated so it's a RETURN, not a reload: real accounts need the marker to be
//    > 6h old AND a positive delta (a market dip snaps, never a fake "up").
//  - DEMO: synthesizes a ~6-days-ago return at the real recent gifts + a small
//    synthetic growth, shown once per session — so the beat is demonstrable
//    (the demo clears its cache on login, so there's never a real marker).
//
// Dismissible via the shared CollapseDismissSection (smooth collapse, no jump).

import { useEffect, useMemo, useState } from "react";
import { readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { CollapseDismissSection } from "@/components/dashboard/CollapseDismissSection";

const LASTSEEN_PREFIX = "kiddo.fund.lastSeen.v1:";
const DEMO_SHOWN_KEY = "kiddo.demo.awayDigest.shown.v1";
const MIN_AWAY_MS = 6 * 60 * 60 * 1000; // a real return, not a same-day reload
const DEMO_AWAY_MS = 6 * 24 * 60 * 60 * 1000; // demo: pretend "6 days ago"
const DEMO_SYNTH_GROWTH_RATE = 0.008; // demo: ~0.8% synthetic growth over the gap

type LastSeen = { value: number; ts: number };

export type SinceLastVisitGift = {
  amount?: number | string | null;
  netAmount?: number | string | null;
  createdAt?: string | null;
  settledAt?: string | null;
  senderName?: string | null;
  status?: string | null;
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

export function SinceLastVisitDigest({
  fundId,
  currentValue,
  gifts,
  isDemoAccount,
  ready,
}: {
  fundId: string | null;
  currentValue: number;
  gifts: SinceLastVisitGift[];
  isDemoAccount: boolean;
  // True once the gift list + value are fully loaded. Gating on it means the
  // digest appears COMPLETE in one shot (no "$182 growth" → "$332 + 2 gifts"
  // flicker as the gift list arrives a beat after the balance).
  ready: boolean;
}) {
  // Read the OLD marker ONCE on mount, before the write effect updates it.
  const lastSeen = useMemo<LastSeen | null>(() => {
    if (!fundId) return null;
    return readLocalCache<LastSeen>(`${LASTSEEN_PREFIX}${fundId}`) ?? null;
  }, [fundId]);

  // Demo "show once per session" — read the flag once on mount so setting it
  // below (during display) doesn't make the card vanish on a re-render.
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
  // demo's synthetic reference, and only with a settled positive balance).
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
    if (!isDemoAccount && Date.now() - sinceTs < MIN_AWAY_MS) return null; // a reload

    // Gifts that landed since the marker.
    const giftsSince = (gifts || []).filter((g) => {
      const status = String(g.status || "").toLowerCase();
      if (!["settled", "invested"].includes(status)) return false;
      const d = new Date(String(g.settledAt || g.createdAt || "")).getTime();
      return Number.isFinite(d) && d > sinceTs;
    });
    let giftsSum = 0;
    let anonCount = 0;
    const named = new Set<string>();
    for (const g of giftsSince) {
      giftsSum += parseFloat(String(g.netAmount ?? g.amount ?? "0")) || 0;
      const name = String(g.senderName || "").trim().toLowerCase();
      if (!name || name === "anonymous" || /^someone who loves/i.test(name)) anonCount += 1;
      else named.add(name);
    }
    const giftCount = giftsSince.length;
    const gifterCount = named.size + anonCount;

    let delta: number;
    let growth: number;
    if (isDemoAccount) {
      // Construct a sensible, always-positive breakdown from the real recent
      // gifts + a small synthetic growth.
      growth = currentValue * DEMO_SYNTH_GROWTH_RATE;
      delta = giftsSum + growth;
    } else {
      delta = currentValue - (lastSeen?.value ?? currentValue);
      if (delta < 1) return null; // nothing meaningful, or down (no fake "up")
      growth = Math.max(0, delta - giftsSum);
    }

    if (giftCount === 0 && growth < 1) return null;
    return { sinceTs, delta, giftsSum, giftCount, gifterCount, growth };
  }, [ready, isDemoAccount, demoAlreadyShown, lastSeen, currentValue, gifts]);

  // Latch the demo once-per-session flag once it's actually showing.
  useEffect(() => {
    if (isDemoAccount && digest) {
      try {
        window.sessionStorage.setItem(DEMO_SHOWN_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, [isDemoAccount, digest]);

  if (!digest) return null;

  const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
  const giftPart =
    digest.giftCount > 0
      ? `${digest.giftCount} new ${digest.giftCount === 1 ? "gift" : "gifts"} (${fmtMoney0(digest.giftsSum)}) from ${people(digest.gifterCount)}`
      : null;
  const growthPart = digest.growth >= 1 ? `${fmtMoney0(digest.growth)} in market growth` : null;
  const body =
    giftPart && growthPart
      ? `${giftPart}, plus ${growthPart}.`
      : giftPart
        ? `${giftPart}.`
        : `${growthPart}.`;

  return (
    <CollapseDismissSection
      open={!dismissed}
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
            Up {fmtMoney0(digest.delta)} since {fmtShortDate(digest.sinceTs)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="since-last-visit-dismiss"
          aria-label="Dismiss the since-you-were-away summary"
        >
          Dismiss
        </button>
      </div>
    </CollapseDismissSection>
  );
}
