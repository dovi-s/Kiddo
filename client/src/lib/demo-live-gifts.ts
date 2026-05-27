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
