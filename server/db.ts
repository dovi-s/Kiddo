import "./env";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Create a .env file (see .env.example) and add your Postgres connection string.",
  );
}

export const pool = new Pool({
  // Some managed providers append sslmode=require in the URL. In local/dev this can
  // override explicit ssl options and still trigger certificate-chain failures.
  // Normalize by removing sslmode from the URL and controlling TLS here.
  connectionString: (() => {
    try {
      const url = new URL(process.env.DATABASE_URL!);
      url.searchParams.delete("sslmode");
      return url.toString();
    } catch {
      return process.env.DATABASE_URL!;
    }
  })(),
  // Local dev often uses self-signed cert chains (proxy/local Postgres).
  // Keep production strict unless explicitly overridden.
  ssl:
    process.env.PGSSLMODE === "disable"
      ? false
      : process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized:
              process.env.PGSSLMODE !== "no-verify",
          }
        : { rejectUnauthorized: false },
  max: 20,
  // NOTE: node-postgres Pool does NOT honor `min` (it's a no-op here); the
  // pool only opens connections on demand and culls them after
  // idleTimeoutMillis. We keep connections warm explicitly below instead.
  min: 2,
  // Raised from 30s so warmed connections survive between sporadic demo
  // clicks; the keep-warm heartbeat below re-touches them well inside this.
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 5_000,
});

// Prevent process crashes on background connection errors (e.g.,
// intercepted TLS resets, pool idle timeouts, transient Supabase
// pooler drops). Downgraded to console.warn 2026-05-14 — these are
// normal background events, not alertable errors. The handler's
// primary job is to swallow the unhandled 'error' event so Node
// doesn't exit. Same pattern as the session pool handler in auth.ts.
pool.on("error", (error) => {
  console.warn("Postgres pool error (transient, suppressed to prevent process crash):", error?.message ?? error);
});
export const db = drizzle(pool, { schema });

// ── Keep the pool WARM ──────────────────────────────────────────────────────
// The DB is remote (Supabase pooler, ~97ms/round-trip), and the hot endpoints
// fire ~10-12 queries via Promise.all. Measured 2026-06-04: on a COLD pool
// (only the on-demand 2 connections), 10 parallel queries take ~1015ms —
// they SERIALIZE because the other 8 connections must each pay a TLS handshake
// to the remote pooler. On a WARM pool (connections already established) the
// same 10 run in ~225ms — genuinely parallel (4.5x). Because node-postgres
// ignores `min`, idle connections get culled after idleTimeoutMillis and the
// NEXT request burst pays the full cold penalty — which is exactly the
// demo-login experience (first click after the pool went idle).
//
// Fix: a lightweight heartbeat keeps WARM_POOL_SIZE connections established and
// idle-timer-reset, so a dashboard-summary / funds-list burst finds them ready
// and actually runs in parallel. Runs in the background (never on a request),
// unref'd so it never holds the process open. Skipped under tests.
const WARM_POOL_SIZE = Math.min(12, 20);
const POOL_WARM_INTERVAL_MS = 25_000; // < idleTimeoutMillis so warm conns persist
async function keepPoolWarm(): Promise<void> {
  try {
    // Firing WARM_POOL_SIZE trivial queries concurrently forces the pool to
    // open that many connections at once (if not already open) and resets
    // their idle timers. After release they sit warm in the idle pool.
    await Promise.all(Array.from({ length: WARM_POOL_SIZE }, () => pool.query("SELECT 1")));
  } catch {
    // Transient (a dropped pooler connection); pool.on('error') already
    // discards broken connections and the next heartbeat re-establishes.
  }
}
if (process.env.NODE_ENV !== "test" && process.env.DB_POOL_WARM !== "off") {
  void keepPoolWarm(); // warm immediately at startup (in the background)
  const warmTimer = setInterval(() => { void keepPoolWarm(); }, POOL_WARM_INTERVAL_MS);
  warmTimer.unref?.();
}
