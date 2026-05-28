// Durable, cross-instance rate limiter backed by Postgres (fixed-window
// counter), with an in-memory fallback so it NEVER blocks the request path on
// a DB hiccup (fail-open). The previous in-memory Map limiter only protected a
// single process — under a multi-instance deploy each replica kept its own
// window, so the effective cap was N× the intended limit.
//
// Fixed-window semantics: bucket = floor(now / windowMs) * windowMs. This is
// slightly more permissive than the old sliding window at bucket boundaries
// (up to ~2× for one window), an acceptable trade for a shared, atomic counter
// on these low-QPS sensitive endpoints (auth / checkout / webhook / kid-view).
//
// Backing table: migration 0037_rate_limit_counters. If it's missing or the DB
// is unavailable, every call transparently falls back to the in-memory path so
// limiting still works on a single instance and auth/checkout never lock up.

import { db } from "./db";
import { sql } from "drizzle-orm";

type MemBucket = { windowStart: number; count: number };
const memStore = new Map<string, MemBucket>(); // fallback only

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = 0;

// Throttled best-effort sweep of expired buckets. Never throws.
async function cleanupStale(maxWindowMs: number, now: number): Promise<void> {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  try {
    const cutoff = now - maxWindowMs;
    await db.execute(sql`DELETE FROM rate_limit_counters WHERE window_start < ${cutoff}`);
  } catch {
    // best-effort only
  }
}

function checkMemory(key: string, max: number, windowMs: number, now: number): boolean {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const cur = memStore.get(key);
  if (!cur || cur.windowStart !== windowStart) {
    memStore.set(key, { windowStart, count: 1 });
    // Opportunistic prune so the fallback map can't grow unbounded.
    if (memStore.size > 10000) {
      for (const [k, v] of Array.from(memStore.entries())) {
        if (v.windowStart !== windowStart) memStore.delete(k);
      }
    }
    return true;
  }
  cur.count += 1;
  return cur.count <= max;
}

// Returns true when the request is ALLOWED, false when it should be rate-
// limited (429). Fails open (returns true) only via the in-memory fallback —
// i.e. it still enforces per-process limits even when the DB is down.
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  try {
    const result = await db.execute(sql`
      INSERT INTO rate_limit_counters (key, window_start, count)
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT (key, window_start)
      DO UPDATE SET count = rate_limit_counters.count + 1
      RETURNING count
    `);
    const row: any = (result.rows || [])[0];
    const count = Number(row?.count ?? 1);
    void cleanupStale(windowMs, now);
    return count <= max;
  } catch {
    // Table missing / DB unavailable → in-memory fallback so a DB blip never
    // locks users out of auth/checkout.
    return checkMemory(key, max, windowMs, now);
  }
}
