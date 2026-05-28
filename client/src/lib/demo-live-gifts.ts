// Session-scoped "live" demo gifts — the gifts a prospect role-plays SENDING
// in the Dunphy demo. They're surfaced as fresh "just now" entries in the
// Memory Book so the gifter loop is felt end-to-end (send it → watch it land),
// the emotional core of the product.
//
// Why sessionStorage and NOT the database: the demo is a SHARED account (every
// prospect views the same Dunphy funds). Persisting a visitor's sent gift to
// the DB would let strangers pollute each other's view and invites abuse
// (arbitrary names/amounts on a public surface). Keeping it client-side and
// session-scoped means each prospect sees only their own sent gift, it never
// touches the shared demo, and it evaporates when the tab closes. Demo
// accounts only — callers gate on isDemoAccount.

const KEY = "kiddo.demo.liveGifts.v1";
const MAX = 5; // keep only the most recent few so the timeline never floods

export type DemoLiveGift = {
  fundId: string;
  senderName: string;
  amount: string;
  ticker?: string;
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
  } catch {
    /* sessionStorage blocked — the loop just won't show the live entry, no harm */
  }
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
