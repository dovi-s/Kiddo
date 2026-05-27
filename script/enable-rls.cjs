/* eslint-disable no-console */
// Enable Row-Level Security on every public table. Idempotent + dynamic:
// it only touches tables where RLS is currently OFF, so it's safe to run
// any time.
//
// WHY THIS EXISTS (and must be re-run):
// - Kiddo's app accesses Postgres ONLY server-side, as the `postgres` role
//   (table owner + rolbypassrls). RLS therefore does NOT affect the app —
//   the server bypasses it. What RLS closes is the Supabase anon/PostgREST
//   API, which would otherwise expose every public table (users incl.
//   password hashes + kycData, funds incl. child PII/SSN-last4, gifts,
//   bank_accounts, sessions, ...) to anyone with the project's anon key.
//   See the Supabase Security Advisor `rls_disabled_in_public` /
//   `sensitive_columns_exposed` alerts.
// - `drizzle-kit push` does NOT manage RLS. So every NEW table added via the
//   schema defaults to RLS-OFF and silently re-opens the hole.
//
// THEREFORE: run this AFTER any schema change that adds tables, and as part
// of fresh-DB / restore setup. `npm run db:secure`.
//
// We use ENABLE (not FORCE) on purpose: the owner/bypassrls server role
// stays unaffected; anon/authenticated (PostgREST) get default-deny because
// there are no policies — which is exactly right, since the app never uses
// the anon API for these tables. If you ever DO use the Supabase client for
// a table, add explicit policies for it.
require("dotenv").config({ path: ".env" });
const pg = require("pg");
const { Pool } = pg;

function getConnectionString() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) throw new Error("DATABASE_URL is missing from .env");
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); return u.toString(); } catch { return raw; }
}

async function main() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  const c = await pool.connect();
  try {
    const off = (await c.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false ORDER BY tablename`
    )).rows.map((r) => r.tablename);

    if (off.length === 0) {
      console.log("RLS already enabled on all public tables. Nothing to do.");
      return;
    }

    console.log(`Enabling RLS on ${off.length} table(s): ${off.join(", ")}`);
    for (const t of off) {
      await c.query(`ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY`);
    }

    const stillOff = (await c.query(
      `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND rowsecurity=false`
    )).rows[0].n;
    console.log(`Done. Public tables with RLS still OFF: ${stillOff} (want 0).`);
    if (stillOff !== 0) process.exitCode = 1;
  } finally {
    c.release();
    await pool.end().catch(() => undefined);
  }
}

void main();
