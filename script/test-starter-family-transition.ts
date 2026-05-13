/* eslint-disable no-console */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

function asInt(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const strict = process.env.STRICT_STARTER_FAMILY === "1";
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  });

  try {
    const familyRes = await pool.query(`
      SELECT
        user_id,
        status,
        current_period_end,
        canceled_at
      FROM subscriptions
      WHERE plan = 'family'
      ORDER BY updated_at DESC
    `);
    const familyRows = familyRes.rows || [];

    const overlapRes = await pool.query(`
      WITH fam AS (
        SELECT DISTINCT user_id
        FROM subscriptions
        WHERE plan = 'family'
          AND status IN ('active', 'grace')
      )
      SELECT
        fm.user_id,
        fm.fund_id,
        fm.status,
        fm.current_period_end,
        fm.canceled_at,
        fm.updated_at
      FROM fund_memberships fm
      JOIN fam f ON f.user_id = fm.user_id
      WHERE fm.plan = 'starter'
        AND fm.status IN ('active', 'grace')
      ORDER BY fm.updated_at DESC
    `);
    const overlapRows = overlapRes.rows || [];

    const canceledRes = await pool.query(`
      WITH fam AS (
        SELECT DISTINCT user_id
        FROM subscriptions
        WHERE plan = 'family'
      )
      SELECT
        fm.user_id,
        COUNT(*) FILTER (WHERE fm.plan = 'starter')::int AS starter_total,
        COUNT(*) FILTER (
          WHERE fm.plan = 'starter'
            AND fm.status = 'canceled'
            AND (fm.current_period_end IS NOT NULL OR fm.canceled_at IS NOT NULL)
        )::int AS starter_canceled_with_dates
      FROM fund_memberships fm
      JOIN fam f ON f.user_id = fm.user_id
      GROUP BY fm.user_id
      ORDER BY fm.user_id
    `);
    const canceledRows = canceledRes.rows || [];

    const summary = {
      strict,
      familySubscriptions: familyRows.length,
      activeFamily: asInt(
        familyRows.filter((r) => String(r.status || "").toLowerCase() === "active" || String(r.status || "").toLowerCase() === "grace").length,
      ),
      activeStarterOverlaps: overlapRows.length,
      starterRowsForFamilyUsers: canceledRows.reduce((sum: number, r: any) => sum + asInt(r.starter_total), 0),
      starterCanceledWithDates: canceledRows.reduce((sum: number, r: any) => sum + asInt(r.starter_canceled_with_dates), 0),
    };

    console.log("Starter -> Family transition diagnostics");
    console.log(JSON.stringify({ summary, overlapRows, canceledRows }, null, 2));

    if (overlapRows.length > 0) {
      console.error("Found active Starter overlaps while Family is active.");
      process.exit(1);
    }
    if (strict && summary.familySubscriptions === 0) {
      console.error("Strict mode: no Family subscriptions found to validate transition behavior.");
      process.exit(1);
    }

    console.log("Starter -> Family overlap checks passed.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Starter/Family transition test failed:", err?.message || err);
  process.exit(1);
});

