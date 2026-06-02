import { safeLocalSet } from "@/lib/local-cache";
// Dismissed-gift-toast set. Tracks which gift ids the parent has
// already dismissed (or let auto-dismiss) so the same toast doesn't
// pop up again on refresh, fund switch, new tab, or next session.
//
// Previous design (sessionStorage with a single string) had four
// holes:
//   1. Per-tab — dismissing in tab A didn't dismiss in tab B
//   2. Per-session — closing the browser lost the dismissal
//   3. Single-value — dismissing gift X then receiving gift Y
//      replaced X in storage, so switching funds and back made
//      X's toast re-surface
//   4. Auto-dismiss + manual dismiss + view-activity-dismiss all
//      wrote the same single key, with overlap edge cases
//
// New design: localStorage JSON array (Set semantically). Persists
// across sessions, shared across tabs (via the native storage
// event). Capped at 200 ids to bound growth — if a user manages
// to dismiss more than 200 distinct gifts, the oldest dismissals
// quietly fall off, which is acceptable because the toast itself
// is gated by the 24h-recent filter on the Dashboard.
//
// Storage key intentionally namespaced so a future generalized
// "dismissed toasts" system can pick a sibling key without
// collision.

const STORAGE_KEY = "kora:gift-toast-dismissed-ids";
const MAX_TRACKED = 200;

// Shared in-memory cache so consumers don't pay the JSON.parse
// cost on every check. Hydrated lazily; resync on storage events
// so cross-tab dismissals propagate.
let cache: Set<string> | null = null;

function loadFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function persist(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    // Cap at MAX_TRACKED to bound growth. Set iteration is insertion
    // order, so slicing tail-end keeps the most recent dismissals.
    const arr = Array.from(set);
    const trimmed = arr.length > MAX_TRACKED ? arr.slice(arr.length - MAX_TRACKED) : arr;
    safeLocalSet(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage quota exceeded or disabled — fail silently. The
    // worst case is a toast re-appearing on next refresh; not the
    // hill to die on.
  }
}

function ensureCache(): Set<string> {
  if (cache === null) {
    cache = loadFromStorage();
    // One-shot migration from the legacy sessionStorage single-value
    // key. If the user dismissed a gift in the old system, carry that
    // dismissal across into the new set so they don't see the toast
    // re-appear on their first post-fix load.
    if (typeof window !== "undefined") {
      try {
        const legacy = window.sessionStorage.getItem("kora:gift-toast-dismissed");
        if (legacy && !cache.has(legacy)) {
          cache.add(legacy);
          persist(cache);
        }
        // Don't bother removing the legacy key — sessionStorage
        // dies with the tab anyway, so cleanup is automatic.
      } catch {
        // ignore
      }
    }
  }
  return cache;
}

// Wire cross-tab sync. The `storage` event fires in OTHER tabs (not
// the one that wrote), so dismissing in tab A clears the cache in
// tab B on next read.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null; // force re-read on next access
    }
  });
}

export function isGiftToastDismissed(giftId: string | null | undefined): boolean {
  if (!giftId) return false;
  return ensureCache().has(String(giftId));
}

export function markGiftToastDismissed(giftId: string | null | undefined): void {
  if (!giftId) return;
  const set = ensureCache();
  if (set.has(String(giftId))) return; // no-op if already present
  set.add(String(giftId));
  persist(set);
}

// Diagnostic / testing helper — not used by the toast flow but
// available if a "show dismissed toasts again" debug menu ever
// lands.
export function clearAllDismissedGiftToasts(): void {
  cache = new Set();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
