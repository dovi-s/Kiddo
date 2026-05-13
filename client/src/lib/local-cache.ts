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
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), value }));
  } catch {
    // Cache is a speed hint only. Live queries remain the source of truth.
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
