// Session-scoped "live" demo gifts — the gifts a prospect role-plays SENDING
// in the Rivera demo. They're surfaced as fresh "just now" entries in the
// Memory Book so the gifter loop is felt end-to-end (send it → watch it land),
// the emotional core of the product.
//
// Why sessionStorage and NOT the database: the demo is a SHARED account (every
// prospect views the same Rivera funds). Persisting a visitor's sent gift to
// the DB would let strangers pollute each other's view and invites abuse
// (arbitrary names/amounts on a public surface). Keeping it client-side and
// session-scoped means each prospect sees only their own sent gift, it never
// touches the shared demo, and it evaporates when the tab closes. Demo
// accounts only — callers gate on isDemoAccount.

import { useSyncExternalStore } from "react";
import type { Activity } from "@shared/schema";
import { gifterShortName } from "./gifter-name";

const KEY = "kiddo.demo.liveGifts.v1";
const MAX = 5; // keep only the most recent few so the timeline never floods

export type DemoLiveGift = {
  fundId: string;
  senderName: string;
  amount: string;
  ticker?: string;
  // "cash" = held as uninvested cash (a one-time "add cash"); anything else
  // (auto/pick/undefined) invests into a holding. Drives whether the gift lands
  // in a holding or in the cash bucket.
  executionModel?: string | null;
  message?: string;
  createdAt: string; // ISO
};

function readRaw(): DemoLiveGift[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Record a just-sent demo gift (newest first, capped). No-op off-window. */
export function recordDemoLiveGift(g: Omit<DemoLiveGift, "createdAt"> & { createdAt?: string }): void {
  if (typeof window === "undefined" || !g.fundId) return;
  try {
    const entry: DemoLiveGift = { ...g, createdAt: g.createdAt || new Date().toISOString() };
    const next = [entry, ...readRaw()].slice(0, MAX);
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
    // Notify React surfaces so an in-place record (the ambient demo beat fires
    // while the prospect is sitting on the dashboard — no navigation remounts
    // the hooks) reflects immediately across the Activity feed, bell, and the
    // useFunds-backed surfaces, instead of waiting for a refetch/remount.
    emitOverlayChange();
  } catch {
    /* sessionStorage blocked — the loop just won't show the live entry, no harm */
  }
}

// --- Reactive overlay store --------------------------------------------------
// The overlay lives in sessionStorage, but React surfaces need to RE-READ it
// the instant a gift is recorded in-place. A tiny version counter + subscriber
// set drives that: useFunds / useActivities add useDemoOverlayVersion() to
// their merge deps and re-derive when it bumps. (useSyncExternalStore pattern,
// no external deps; sessionStorage is per-tab so no cross-tab signaling.)
let overlayVersion = 0;
const overlayListeners = new Set<() => void>();
function emitOverlayChange(): void {
  overlayVersion += 1;
  overlayListeners.forEach((l) => {
    try { l(); } catch { /* a bad subscriber must not block the others */ }
  });
}
function subscribeOverlay(cb: () => void): () => void {
  overlayListeners.add(cb);
  return () => { overlayListeners.delete(cb); };
}
function getOverlayVersion(): number {
  return overlayVersion;
}

/**
 * React hook: a number that changes whenever the demo overlay is written. Add
 * it to a useMemo's deps to re-run a merge when a demo gift is recorded
 * in-place. Stable 0 on the server / before any write.
 */
export function useDemoOverlayVersion(): number {
  return useSyncExternalStore(subscribeOverlay, getOverlayVersion, () => 0);
}

/** Live gifts for one fund, newest first. Returns [] unless `enabled` (demo). */
export function readDemoLiveGiftsForFund(fundId: string | null | undefined, enabled: boolean): DemoLiveGift[] {
  if (!enabled || !fundId) return [];
  return readRaw().filter((g) => g.fundId === fundId);
}

type FundBalanceLike = {
  id: string;
  pendingBalance?: string | null;
  contributorCount?: number | null;
};

/**
 * Merge session-scoped live demo gifts into the funds list so a just-sent gift
 * VISIBLY lands on the parent dashboard (not only in the Memory Book): the
 * gift amount is added to the fund's pendingBalance (the dashboard hero total
 * and the all-funds total both add pendingBalance, so the headline number
 * ticks up) and contributorCount bumps. Returns NEW fund objects so it never
 * mutates the TanStack query cache. No-op unless `enabled` (demo accounts only)
 * and only for funds that have matching live gifts. Mirrors the Memory Book
 * consumption in MemoryBook.tsx so both sides of the loop land consistently.
 */
export function applyDemoLiveGiftsToFunds<T extends FundBalanceLike>(funds: T[], enabled: boolean): T[] {
  if (!enabled) return funds;
  const live = readRaw();
  if (live.length === 0) return funds;
  return funds.map((fund) => {
    const forFund = live.filter((g) => g.fundId === fund.id);
    if (forFund.length === 0) return fund;
    const added = forFund.reduce(
      (sum, g) => sum + (parseFloat(String(g.amount).replace(/[^0-9.]/g, "")) || 0),
      0,
    );
    if (added <= 0) return fund;
    const prevPending = parseFloat(String(fund.pendingBalance ?? "0")) || 0;
    return {
      ...fund,
      pendingBalance: (prevPending + added).toFixed(2),
      contributorCount: (Number(fund.contributorCount ?? 0) || 0) + forFund.length,
    };
  });
}

// --- Activity-feed + notification-bell overlay -------------------------------
// Surface each recorded live gift as a synthetic `gift_received` activity row.
// ONE merge point feeds BOTH the Activity page and the notifications bell
// (NotificationsPanel reads the same useActivities query), and a fresh row's
// recent createdAt makes the bell badge light up — so a demo gift "lands"
// everywhere a real one would. `gift_received` is the canonical inbound type:
// it gets the gift emoji + green tone, is NOT bell-noise, survives the
// gift-pair dedupe (it's the kept half), and deep-links to the Memory Book,
// where the same gift already shows via readDemoLiveGiftsForFund. No-op off
// demo, and the rows are never written to the localStorage activity cache
// (they're a render-time overlay, same discipline as applyDemoLiveGiftsToFunds).
function liveGiftToActivity(g: DemoLiveGift): Activity {
  const amt = (parseFloat(String(g.amount).replace(/[^0-9.]/g, "")) || 0).toFixed(2);
  const who = gifterShortName(g.senderName) || g.senderName || "someone";
  const where = g.ticker ? ` into ${g.ticker}` : "";
  return {
    // Deterministic from stored data so the id is STABLE across re-derives —
    // notification read/unread tracking keys off it, so a regenerated id would
    // make a dismissed gift pop back as unread.
    id: `demo-gift-${g.fundId}-${g.createdAt}`,
    userId: "demo",
    fundId: g.fundId,
    type: "gift_received",
    title: `Gift from ${who}`,
    description: (g.message && g.message.trim()) || `$${amt}${where}`,
    amount: amt,
    metadata: JSON.stringify({ demo: true }),
    createdAt: new Date(g.createdAt),
  };
}

/**
 * Prepend session-scoped live demo gifts as `gift_received` rows so they show
 * in the Activity feed + notifications bell. Newest-first. No-op unless
 * `enabled` (demo accounts only). `fundId` scopes to one fund's gifts when
 * provided (matches the fund-scoped activity queries); pass null/undefined for
 * the cross-fund feed. Returns a new array — never mutates the query cache.
 */
export function applyDemoLiveGiftsToActivities(
  activities: Activity[],
  enabled: boolean,
  fundId?: string | null,
): Activity[] {
  if (!enabled) return activities;
  const live = readRaw().filter((g) => !fundId || g.fundId === fundId);
  if (live.length === 0) return activities;
  const overlay = live
    .map(liveGiftToActivity)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  return [...overlay, ...activities];
}

// --- Holdings overlay (the hero + "What X owns" reconciliation) ---------------
// Land each session gift INSIDE a holding so the Dashboard hero (which sums
// holdings.currentValue) AND the "What X owns" card (same source) move together
// — they're not allowed to disagree (Dashboard.tsx guards that explicitly). The
// gift lands as a CONTRIBUTION at the current price, not a phantom market gain:
// currentValue + costBasis + shares all rise by the same dollars, so `gain`
// (= value − basis) is unchanged. It goes into the holding it "went into" (the
// gift's ticker), else the diversified mix (VTI), else the largest position.
// Founder decision 2026-06-03: a landed demo gift reads as invested, not as
// "cash waiting." No-op off demo / no gifts; returns new objects (never mutates
// the query cache).
type HoldingLike = {
  ticker?: string | null;
  shares?: string | null;
  costBasis?: string | null;
  currentValue?: string | null;
  gain?: string | null;
};
export function applyDemoLiveGiftsToHoldings<T extends HoldingLike>(
  holdings: T[],
  enabled: boolean,
  fundId?: string | null,
): T[] {
  if (!enabled || !Array.isArray(holdings) || holdings.length === 0) return holdings;
  const live = readRaw().filter((g) => !fundId || g.fundId === fundId);
  if (live.length === 0) return holdings;

  const tickerOf = (h: HoldingLike) => String(h.ticker || "").toUpperCase();
  const valOf = (h: HoldingLike) => parseFloat(String(h.currentValue ?? "0")) || 0;
  const result = holdings.map((h) => ({ ...h }));

  for (const g of live) {
    const amt = parseFloat(String(g.amount).replace(/[^0-9.]/g, "")) || 0;
    if (amt <= 0) continue;
    // A "cash" gift (one-time add-cash) stays as cash — it credits cashBalance
    // via readDemoCashDelta instead of bumping a holding.
    if (String(g.executionModel || "").toLowerCase() === "cash") continue;
    const want = String(g.ticker || "").toUpperCase();

    let idx = want ? result.findIndex((h) => tickerOf(h) === want) : -1;
    if (idx < 0) idx = result.findIndex((h) => tickerOf(h) === "VTI");
    if (idx < 0) {
      idx = result.reduce((best, h, i, arr) => (valOf(h) > valOf(arr[best]) ? i : best), 0);
    }

    const h = result[idx] as HoldingLike;
    const prevValue = valOf(h);
    const prevShares = parseFloat(String(h.shares ?? "0")) || 0;
    const prevBasis = parseFloat(String(h.costBasis ?? "0")) || 0;
    // Shares added at the current price so price/share is preserved.
    const addedShares = prevValue > 0 ? (amt * prevShares) / prevValue : 0;
    h.currentValue = (prevValue + amt).toFixed(2);
    h.costBasis = (prevBasis + amt).toFixed(2);
    if (h.shares != null) h.shares = String(prevShares + addedShares);
    // `gain` is intentionally NOT touched — a contribution adds no gain.
  }
  return result;
}

// --- Recurring-schedule overlay (Stage 2a) -----------------------------------
// When a demo visitor sets up a recurring investment, the sandbox mocks the POST
// so the refetched schedule never includes it ("I set it up and nothing
// happened"). We record it here and merge it into the parent-contributions list
// so it shows as an active schedule — bumping the recurring chip's count + total
// and adding a row. Setup adds NO money now (a schedule is future-dated), so
// there's no balance/holdings change — just the schedule. Per-tab, demo-only.
const RECURRING_KEY = "kiddo.demo.recurring.v1";
const RECURRING_MAX = 4;

export type DemoRecurring = {
  fundId: string;
  userId: string; // the real current-user id — the recurring chip filters on it
  amount: string;
  frequency: string; // "monthly" | "weekly"
  executionModel?: string | null;
  selectedTicker?: string | null;
  createdAt: string;
};

function readRawRecurring(): DemoRecurring[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(RECURRING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Record a just-set-up demo recurring schedule (newest first, capped). */
export function recordDemoRecurring(r: Omit<DemoRecurring, "createdAt"> & { createdAt?: string }): void {
  if (typeof window === "undefined" || !r.fundId) return;
  try {
    const entry: DemoRecurring = { ...r, createdAt: r.createdAt || new Date().toISOString() };
    const next = [entry, ...readRawRecurring()].slice(0, RECURRING_MAX);
    window.sessionStorage.setItem(RECURRING_KEY, JSON.stringify(next));
    emitOverlayChange();
  } catch {
    /* sessionStorage blocked — the schedule just won't show, no harm */
  }
}

function recurringToContribution(r: DemoRecurring): Record<string, unknown> {
  const amt = (parseFloat(String(r.amount).replace(/[^0-9.]/g, "")) || 0).toFixed(2);
  const created = new Date(r.createdAt);
  const next = new Date(created);
  if (String(r.frequency).toLowerCase() === "weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return {
    id: `demo-recurring-${r.fundId}-${r.createdAt}`,
    fundId: r.fundId,
    userId: r.userId,
    bankAccountId: null,
    amount: amt,
    frequency: r.frequency || "monthly",
    status: "active",
    pauseReason: null,
    pausedAt: null,
    nextRunDate: next.toISOString(),
    lastRunDate: null,
    totalContributed: "0",
    executionModel: r.executionModel || "auto",
    selectedTicker: r.selectedTicker || null,
    createdAt: r.createdAt,
  };
}

/**
 * Append recorded demo recurring schedules to the parent-contributions list so
 * they render as active. APPENDED (not prepended) so the first seeded "active"
 * row stays the canonical `activeAutoInvest` (which feeds the projection) — the
 * demo schedule is additive (bumps the count + monthly total + adds a row).
 * No-op unless `enabled` (demo) and scoped to `fundId`.
 */
export function applyDemoRecurringToContributions<T>(
  contributions: T[],
  enabled: boolean,
  fundId?: string | null,
): T[] {
  if (!enabled) return contributions;
  const live = readRawRecurring().filter((r) => !fundId || r.fundId === fundId);
  if (live.length === 0) return contributions;
  const overlay = live.map(recurringToContribution) as unknown as T[];
  return [...contributions, ...overlay];
}

// --- Sell overlay (Stage 2c) -------------------------------------------------
// Selling MOVES money (invested → cash); it doesn't add or destroy any, so the
// hero total must stay constant. A correct demo sell therefore does TWO things
// in lockstep: reduce the sold holding (shares + value + basis, pro-rata) AND
// credit the proceeds to cash (readDemoCashDelta, added to the Dashboard's
// cashBalance). invested↓ + cash↑ = same total. Per-tab, demo-only.
const SELL_KEY = "kiddo.demo.sells.v1";
const SELL_MAX = 8;

export type DemoSell = {
  fundId: string;
  ticker: string;
  shares: string;   // shares sold
  proceeds: string; // dollars moved to cash
  createdAt: string;
};

function readRawSells(): DemoSell[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(SELL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Record a just-executed demo sell (newest first, capped). */
export function recordDemoSell(s: Omit<DemoSell, "createdAt"> & { createdAt?: string }): void {
  if (typeof window === "undefined" || !s.fundId || !s.ticker) return;
  try {
    const entry: DemoSell = { ...s, createdAt: s.createdAt || new Date().toISOString() };
    const next = [entry, ...readRawSells()].slice(0, SELL_MAX);
    window.sessionStorage.setItem(SELL_KEY, JSON.stringify(next));
    emitOverlayChange();
  } catch {
    /* sessionStorage blocked — the sell just won't reflect, no harm */
  }
}

/** Reduce sold holdings pro-rata (shares + value + basis + gain). No-op off demo. */
export function applyDemoSellsToHoldings<T extends HoldingLike>(
  holdings: T[],
  enabled: boolean,
  fundId?: string | null,
): T[] {
  if (!enabled || !Array.isArray(holdings) || holdings.length === 0) return holdings;
  const live = readRawSells().filter((s) => !fundId || s.fundId === fundId);
  if (live.length === 0) return holdings;

  const result = holdings.map((h) => ({ ...h }));
  for (const s of live) {
    const sold = parseFloat(String(s.shares).replace(/[^0-9.]/g, "")) || 0;
    if (sold <= 0) continue;
    const want = String(s.ticker || "").toUpperCase();
    const idx = result.findIndex((h) => String(h.ticker || "").toUpperCase() === want);
    if (idx < 0) continue;
    const h = result[idx] as HoldingLike;
    const prevShares = parseFloat(String(h.shares ?? "0")) || 0;
    if (prevShares <= 0) continue;
    const frac = Math.min(1, sold / prevShares); // fraction of the position liquidated
    const prevValue = parseFloat(String(h.currentValue ?? "0")) || 0;
    const prevBasis = parseFloat(String(h.costBasis ?? "0")) || 0;
    h.shares = String(Math.max(0, prevShares - sold));
    h.currentValue = (prevValue * (1 - frac)).toFixed(2);
    h.costBasis = (prevBasis * (1 - frac)).toFixed(2);
    // gain = value − basis; both scaled by the same fraction, so gain scales too.
    if (h.gain != null) h.gain = (parseFloat(String(h.currentValue)) - parseFloat(String(h.costBasis))).toFixed(2);
  }
  return result;
}

/**
 * Net demo cash change for a fund, added to the Dashboard's cashBalance:
 * sells credit cash (+proceeds), buys debit it (−amount). invested + cash stays
 * conserved across both moves, so the hero total never drifts.
 */
export function readDemoCashDelta(fundId: string | null | undefined, enabled: boolean): number {
  if (!enabled || !fundId) return 0;
  const fromSells = readRawSells()
    .filter((s) => s.fundId === fundId)
    .reduce((sum, s) => sum + (parseFloat(String(s.proceeds).replace(/[^0-9.]/g, "")) || 0), 0);
  const fromBuys = readRawBuys()
    .filter((b) => b.fundId === fundId)
    .reduce((sum, b) => sum + (parseFloat(String(b.amount).replace(/[^0-9.]/g, "")) || 0), 0);
  // "cash" gifts (one-time add-cash) land here instead of a holding.
  const fromCashGifts = readRaw()
    .filter((g) => g.fundId === fundId && String(g.executionModel || "").toLowerCase() === "cash")
    .reduce((sum, g) => sum + (parseFloat(String(g.amount).replace(/[^0-9.]/g, "")) || 0), 0);
  return fromSells + fromCashGifts - fromBuys;
}

function sellToActivity(s: DemoSell): Activity {
  const proceeds = (parseFloat(String(s.proceeds).replace(/[^0-9.]/g, "")) || 0).toFixed(2);
  const sh = parseFloat(String(s.shares).replace(/[^0-9.]/g, "")) || 0;
  return {
    id: `demo-sell-${s.fundId}-${s.createdAt}`,
    userId: "demo",
    fundId: s.fundId,
    type: "sell",
    title: `Moved ${s.ticker} to cash`,
    description: `Sold ${sh.toFixed(4).replace(/\.?0+$/, "")} ${s.ticker} shares · $${proceeds} to cash`,
    amount: proceeds,
    metadata: JSON.stringify({ demo: true }),
    createdAt: new Date(s.createdAt),
  };
}

/** Prepend demo sells as `sell` activity rows (Activity feed + bell). */
export function applyDemoSellsToActivities(
  activities: Activity[],
  enabled: boolean,
  fundId?: string | null,
): Activity[] {
  if (!enabled) return activities;
  const live = readRawSells().filter((s) => !fundId || s.fundId === fundId);
  if (live.length === 0) return activities;
  const overlay = live
    .map(sellToActivity)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  return [...overlay, ...activities];
}

// --- Buy / invest-cash overlay (Stage 2c) ------------------------------------
// Investing waiting cash MOVES money (cash → invested): cash↓ + holding↑ = same
// hero total. The holding bump is identical to a gift landing (contribution at
// current price); the difference is the cash side (readDemoCashDelta subtracts
// buys). Per-tab, demo-only.
const BUY_KEY = "kiddo.demo.buys.v1";
const BUY_MAX = 8;

export type DemoBuy = {
  fundId: string;
  ticker: string; // "" → the diversified mix (VTI)
  amount: string;
  createdAt: string;
};

function readRawBuys(): DemoBuy[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(BUY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Record a just-executed demo buy (invest cash). */
export function recordDemoBuy(b: Omit<DemoBuy, "createdAt"> & { createdAt?: string }): void {
  if (typeof window === "undefined" || !b.fundId) return;
  try {
    const entry: DemoBuy = { ...b, createdAt: b.createdAt || new Date().toISOString() };
    const next = [entry, ...readRawBuys()].slice(0, BUY_MAX);
    window.sessionStorage.setItem(BUY_KEY, JSON.stringify(next));
    emitOverlayChange();
  } catch {
    /* sessionStorage blocked — the buy just won't reflect, no harm */
  }
}

/** Bump bought holdings (contribution at current price). No-op off demo. */
export function applyDemoBuysToHoldings<T extends HoldingLike>(
  holdings: T[],
  enabled: boolean,
  fundId?: string | null,
): T[] {
  if (!enabled || !Array.isArray(holdings) || holdings.length === 0) return holdings;
  const live = readRawBuys().filter((b) => !fundId || b.fundId === fundId);
  if (live.length === 0) return holdings;

  const tickerOf = (h: HoldingLike) => String(h.ticker || "").toUpperCase();
  const valOf = (h: HoldingLike) => parseFloat(String(h.currentValue ?? "0")) || 0;
  const result = holdings.map((h) => ({ ...h }));

  for (const b of live) {
    const amt = parseFloat(String(b.amount).replace(/[^0-9.]/g, "")) || 0;
    if (amt <= 0) continue;
    const want = String(b.ticker || "").toUpperCase();
    let idx = want ? result.findIndex((h) => tickerOf(h) === want) : -1;
    if (idx < 0) idx = result.findIndex((h) => tickerOf(h) === "VTI");
    if (idx < 0) idx = result.reduce((best, h, i, arr) => (valOf(h) > valOf(arr[best]) ? i : best), 0);
    const h = result[idx] as HoldingLike;
    if (!h) continue;
    const prevValue = valOf(h);
    const prevShares = parseFloat(String(h.shares ?? "0")) || 0;
    const prevBasis = parseFloat(String(h.costBasis ?? "0")) || 0;
    const addedShares = prevValue > 0 ? (amt * prevShares) / prevValue : 0;
    h.currentValue = (prevValue + amt).toFixed(2);
    h.costBasis = (prevBasis + amt).toFixed(2);
    if (h.shares != null) h.shares = String(prevShares + addedShares);
    if (h.gain != null) h.gain = (parseFloat(String(h.currentValue)) - parseFloat(String(h.costBasis))).toFixed(2);
  }
  return result;
}

function buyToActivity(b: DemoBuy): Activity {
  const amt = (parseFloat(String(b.amount).replace(/[^0-9.]/g, "")) || 0).toFixed(2);
  const where = b.ticker ? b.ticker : "the diversified mix";
  return {
    id: `demo-buy-${b.fundId}-${b.createdAt}`,
    userId: "demo",
    fundId: b.fundId,
    // The product's canonical "invested waiting cash" type. Shows in the
    // Activity ledger; bell-excluded (routine), same as the real product.
    type: "cash_invested",
    title: `Invested $${amt}`,
    description: `Moved $${amt} of cash into ${where}`,
    amount: amt,
    metadata: JSON.stringify({ demo: true }),
    createdAt: new Date(b.createdAt),
  };
}

/** Prepend demo buys as `cash_invested` activity rows (Activity feed). */
export function applyDemoBuysToActivities(
  activities: Activity[],
  enabled: boolean,
  fundId?: string | null,
): Activity[] {
  if (!enabled) return activities;
  const live = readRawBuys().filter((b) => !fundId || b.fundId === fundId);
  if (live.length === 0) return activities;
  const overlay = live
    .map(buyToActivity)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  return [...overlay, ...activities];
}
