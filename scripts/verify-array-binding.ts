// Verify the corrected sql.join pattern works for the route's
// downstream queries. Same shape as the route runs.

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

(async () => {
  const fundIdsResult = await db.execute(sql`
    SELECT id FROM funds WHERE user_id = '36a1b3a0-db85-4cdc-9fc0-f8228d8314fb'
  `);
  const fundIds = (fundIdsResult.rows as any[]).map((r) => r.id);
  console.log(`Got ${fundIds.length} fund ids`);

  // The corrected pattern.
  const fundIdsSql = sql.join(
    fundIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const giftStatsRow = await db.execute(sql`
      SELECT
        COUNT(*)::int AS gift_count,
        COALESCE(SUM(CAST(amount AS numeric)), 0) AS gift_total
      FROM gifts
      WHERE fund_id IN (${fundIdsSql})
        AND created_at >= ${thirtyDaysAgo.toISOString()}
        AND status NOT IN ('failed', 'refunded', 'canceled')
    `);
    console.log("✅ gift stats with sql.join:", giftStatsRow.rows?.[0]);
  } catch (e: any) {
    console.log("❌ gift stats failed:", e.message);
  }

  try {
    const occasionsRow = await db.execute(sql`
      SELECT e.id, e.name, e.event_date
      FROM events e
      WHERE e.fund_id IN (${fundIdsSql})
        AND e.status = 'active'
        AND e.event_date IS NOT NULL
        AND e.event_date >= NOW()
        AND e.is_permanent = false
      ORDER BY e.event_date ASC
      LIMIT 5
    `);
    console.log(`✅ upcoming occasions with sql.join: ${occasionsRow.rows?.length} rows`);
  } catch (e: any) {
    console.log("❌ occasions failed:", e.message);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
