// Smoke-test the realized-sales endpoint logic directly against DB.
// Verifies the schema is correct + query shape works.

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

(async () => {
  const fundId = process.argv[2] || "599261de-154d-4233-8e0a-d5c8073dd89e"; // Emma's fund
  const year = Number(process.argv[3] || new Date().getFullYear());

  console.log(`Realized sales for fund ${fundId} in ${year}\n`);

  const startIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)).toISOString();

  const rows = await db.execute(sql`
    SELECT id, description, amount, realized_gain, cost_basis_sold,
           holding_period, completed_at, created_at
    FROM transactions
    WHERE fund_id = ${fundId}
      AND type = 'sell'
      AND status = 'completed'
      AND COALESCE(completed_at, created_at) >= ${startIso}
      AND COALESCE(completed_at, created_at) < ${endIso}
    ORDER BY COALESCE(completed_at, created_at) DESC
  `);
  const sales = (rows.rows as any[]) || [];

  console.log(`Found ${sales.length} sale${sales.length === 1 ? "" : "s"}:`);
  for (const s of sales) {
    const desc = String(s.description || "").slice(0, 60);
    console.log(
      `  ${s.completed_at?.toISOString?.()?.slice(0, 10) || s.created_at?.toISOString?.()?.slice(0, 10)} | $${s.amount} | realized=${s.realized_gain ?? "NULL"} | basis=${s.cost_basis_sold ?? "NULL"} | period=${s.holding_period ?? "NULL"} | ${desc}`,
    );
  }

  // Confirm schema columns exist
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='transactions'
      AND column_name IN ('realized_gain','cost_basis_sold','holding_period')
  `);
  console.log(`\nSchema present: ${(cols.rows as any[]).map((r) => r.column_name).join(", ")}`);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
