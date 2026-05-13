// Feature flags — runtime-toggleable booleans + JSON values, queryable from
// anywhere in the server with isFeatureEnabled() / getFeatureValue(). Backed
// by the feature_flags table, with a small in-memory cache (5s TTL) so we can
// gate hot paths without per-call DB hits.
//
// Usage:
//   if (await isFeatureEnabled('whisper_transcription', false)) { ... }
//   const themeJson = await getFeatureValue('marketing_banner_v2', null);
//
// Default-safe by design: when a flag row doesn't exist, the caller's default
// wins. So a feature you forgot to insert into the table never fires.
//
// Admin manages flags via Config tab → /api/admin/feature-flags endpoints.
// Every change is audit-logged and stamped with updatedBy / updatedAt.

import { db } from "./db";
import { sql } from "drizzle-orm";

type CacheEntry = {
  enabled: boolean;
  value: any;
  expiresAt: number;
};

const CACHE_TTL_MS = 5000;
const cache = new Map<string, CacheEntry>();

async function loadFlag(key: string): Promise<{ enabled: boolean; value: any } | null> {
  const row = await db.execute(sql`
    SELECT enabled, value FROM feature_flags WHERE key = ${key} LIMIT 1
  `);
  const r = (row.rows || [])[0] as any;
  if (!r) return null;
  return { enabled: Boolean(r.enabled), value: r.value };
}

async function getCached(key: string): Promise<{ enabled: boolean; value: any } | null> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { enabled: cached.enabled, value: cached.value };
  }
  const fresh = await loadFlag(key).catch(() => null);
  if (fresh === null) {
    cache.set(key, { enabled: false, value: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }
  cache.set(key, { ...fresh, expiresAt: Date.now() + CACHE_TTL_MS });
  return fresh;
}

export async function isFeatureEnabled(key: string, defaultValue = false): Promise<boolean> {
  const flag = await getCached(key);
  if (flag === null) return defaultValue;
  return flag.enabled;
}

export async function getFeatureValue<T = any>(key: string, defaultValue: T): Promise<T> {
  const flag = await getCached(key);
  if (flag === null) return defaultValue;
  return (flag.value ?? defaultValue) as T;
}

// Invalidate the cache for a single flag (called after admin writes). Avoids
// the 5-second wait between toggle and effect for the editing admin.
export function invalidateFlagCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

// Canonical flags the codebase knows about. Used by the admin UI to suggest
// existing flags and as documentation. Adding a new flag? Add it here so it
// shows up in the admin dropdown even before any DB row exists.
export const KNOWN_FLAGS: Array<{ key: string; description: string; defaultValue: boolean | object }> = [
  { key: "whisper_transcription", description: "Auto-transcribe voice notes via OpenAI Whisper. Requires OPENAI_API_KEY.", defaultValue: false },
  { key: "physical_memory_book", description: "Show the 'Physical Memory Book (coming soon)' card on Age18Plan.", defaultValue: true },
  { key: "kiddo_card", description: "Show the 'Kiddo Card (coming soon)' card on Age18Plan.", defaultValue: true },
  { key: "mobile_push_enabled", description: "Master switch for mobile push notifications. Disable to dampen during outages.", defaultValue: true },
];
