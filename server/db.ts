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
  min: 2,
  idleTimeoutMillis: 30_000,
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
