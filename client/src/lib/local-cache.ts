const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

type CacheEnvelope<T> = {
  savedAt: string;
  value: T;
};

export const LOCAL_CACHE_KEYS = {
  authUser: "kiddo.auth.user.v1",
  funds: "kiddo.dashboard.funds.v1",
  events: "kiddo.events.v1",
  giftCodes: "kiddo.gift-codes.v1",
  subscription: "kiddo.subscription.v1",
  activities: "kiddo.activities.v1",
} as const;

export function readLocalCache<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    const savedAt = parsed?.savedAt ? new Date(parsed.savedAt).getTime() : NaN;
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > ttlMs) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    return parsed.value;
  } catch {
    return undefined;
  }
}

export function writeLocalCache(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  // Route through safeLocalSet so the cache write path self-heals on a full
  // store (evict rebuildable keys + retry) instead of silently giving up.
  // writeLocalCache runs on nearly every page, so this is what frees a wedged
  // localStorage early, regardless of which page the user landed on. Cache is a
  // speed hint only — live queries remain the source of truth.
  safeLocalSet(key, JSON.stringify({ savedAt: new Date().toISOString(), value }));
}

// Best-effort localStorage write that SELF-HEALS on quota exhaustion. An
// unguarded setItem against a full store throws QuotaExceededError, and when a
// caller didn't wrap it that uncaught throw crashes the page — which is exactly
// how a 1-byte lifecycle-signal flag ("1") took down the whole dashboard
// ("Setting the value of 'kora_signal_no_gift_14d_…' exceeded the quota").
// On quota error we evict our OWN disposable keys — the kiddo.* speed caches
// (rebuildable from live queries) and the kora* signal flags / latches /
// dismissals — then retry once. Returns whether the value was ultimately
// stored; callers can ignore the result. The contract is: NEVER throw.
export function safeLocalSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  const ls = window.localStorage;
  try {
    ls.setItem(key, value);
    return true;
  } catch {
    try {
      for (let i = ls.length - 1; i >= 0; i -= 1) {
        const k = ls.key(i);
        if (k && k !== key && (k.startsWith("kiddo.") || k.startsWith("kora"))) {
          ls.removeItem(k);
        }
      }
      ls.setItem(key, value);
      return true;
    } catch {
      return false; // give up silently — a cache/flag write must never crash the app
    }
  }
}

export function removeLocalCache(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function removeLocalCachePrefix(prefix: string) {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures.
  }
}
