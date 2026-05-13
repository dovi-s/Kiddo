import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

(async () => {
  console.log("Adding realized_gain column...");
  await db.execute(sql`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS realized_gain decimal(12,2)
  `);

  console.log("Adding cost_basis_sold column...");
  await db.execute(sql`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS cost_basis_sold decimal(12,2)
  `);

  console.log("Adding holding_period column...");
  await db.execute(sql`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS holding_period text
  `);

  console.log("Creating (fund_id, completed_at) index...");
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS transactions_fund_id_completed_at_idx
      ON transactions (fund_id, completed_at)
  `);

  const check = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'transactions'
      AND column_name IN ('realized_gain', 'cost_basis_sold', 'holding_period')
    ORDER BY column_name
  `);
  console.log("Columns present:", (check.rows as any[]).map((r) => r.column_name).join(", "));
  process.exit(0);
})().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
