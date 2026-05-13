import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

(async () => {
  // Inspect events and gifts column lists.
  const eventsCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
    ORDER BY ordinal_position
  `);
  console.log("events columns:");
  console.log((eventsCols.rows as any[]).map((r) => r.column_name).join(", "));

  const giftsCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gifts'
    ORDER BY ordinal_position
  `);
  console.log("\ngifts columns:");
  console.log((giftsCols.rows as any[]).map((r) => r.column_name).join(", "));

  // Probe the exact queries the route runs.
  const userId = "36a1b3a0-db85-4cdc-9fc0-f8228d8314fb";
  const fundIdsResult = await db.execute(sql`
    SELECT id FROM funds WHERE user_id = ${userId}
  `);
  const fundIds = (fundIdsResult.rows as any[]).map((r) => r.id);
  console.log(`\nfundIds count: ${fundIds.length}`);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAhead = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  console.log("\n--- Probing each route query ---\n");

  try {
    await db.execute(sql`
      SELECT COUNT(*)::int AS gift_count,
             COALESCE(SUM(CAST(amount AS numeric)), 0) AS gift_total
      FROM gifts
      WHERE fund_id = ANY(${fundIds}::varchar[])
        AND created_at >= ${thirtyDaysAgo.toISOString()}
        AND status NOT IN ('failed', 'refunded', 'canceled')
    `);
    console.log("✅ gift stats query OK");
  } catch (e: any) {
    console.log(`❌ gift stats query FAILED: ${e.message}`);
  }

  try {
    await db.execute(sql`
      SELECT COUNT(DISTINCT LOWER(sender_email))::int AS unique_gifter_count
      FROM gifts
      WHERE fund_id = ANY(${fundIds}::varchar[])
        AND sender_email IS NOT NULL AND sender_email <> ''
        AND status NOT IN ('failed', 'refunded', 'canceled')
    `);
    console.log("✅ unique gifters query OK");
  } catch (e: any) {
    console.log(`❌ unique gifters query FAILED: ${e.message}`);
  }

  try {
    await db.execute(sql`
      SELECT COUNT(*)::int AS contrib_count,
             COALESCE(SUM(CAST(amount AS numeric)), 0) AS contrib_total
      FROM gifts
      WHERE fund_id = ANY(${fundIds}::varchar[])
        AND created_at >= ${thirtyDaysAgo.toISOString()}
        AND sender_email IS NOT NULL
        AND LOWER(sender_email) = LOWER(${"dovisherman@gmail.com"})
        AND status NOT IN ('failed', 'refunded', 'canceled')
    `);
    console.log("✅ contrib stats query OK");
  } catch (e: any) {
    console.log(`❌ contrib stats query FAILED: ${e.message}`);
  }

  try {
    await db.execute(sql`
      SELECT e.id, e.fund_id, e.name, e.event_date, e.event_type,
             f.recipient_first_name AS recipient_first_name
      FROM events e
      LEFT JOIN funds f ON f.id = e.fund_id
      WHERE e.fund_id = ANY(${fundIds}::varchar[])
        AND e.status = 'active'
        AND e.event_date IS NOT NULL
        AND e.event_date >= NOW()
        AND e.event_date <= ${ninetyDaysAhead.toISOString()}
        AND e.is_permanent = false
      ORDER BY e.event_date ASC
      LIMIT 5
    `);
    console.log("✅ upcoming occasions query OK");
  } catch (e: any) {
    console.log(`❌ upcoming occasions query FAILED: ${e.message}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
