import "../server/env";
import { pool } from "../server/db";

// Two-part fix for duplicate-ticker rows in the holdings table:
//
// 1. Merge any existing duplicates: collapse rows sharing (fund_id, ticker)
//    into a single row by summing shares + costBasis + currentValue +
//    gain, keeping the earliest row's id.
//
// 2. Add a unique constraint on (fund_id, ticker) so the bug class is
//    permanently closed. The webhook handlers already correctly upsert
//    via getHoldingByFundAndTicker — but two webhooks firing in rapid
//    succession could race past the existence check and double-insert.
//    The constraint forces the race to resolve at the DB level (one
//    INSERT wins, the loser hits a constraint violation and the upsert
//    path takes the UPDATE branch on retry).
async function main() {
  // ----- Step 1: merge duplicates -----
  const dups = await pool.query(`
    SELECT fund_id, ticker, COUNT(*) AS n
    FROM holdings
    GROUP BY fund_id, ticker
    HAVING COUNT(*) > 1
    ORDER BY fund_id, ticker
  `);

  if (dups.rows.length === 0) {
    console.log("No duplicate ticker rows found.");
  } else {
    console.log(`Found ${dups.rows.length} (fund_id, ticker) groups with duplicates:\n`);
  }

  for (const dup of dups.rows) {
    const fundId = dup.fund_id as string;
    const ticker = dup.ticker as string;
    console.log(`  ${ticker} on fund ${fundId} (${dup.n} rows):`);

    const rows = await pool.query(
      `SELECT id, shares, cost_basis, current_value, gain, created_at
       FROM holdings
       WHERE fund_id = $1 AND ticker = $2
       ORDER BY created_at ASC`,
      [fundId, ticker],
    );

    // Keep the earliest row, sum into it, delete the rest.
    const keeper = rows.rows[0];
    const sumShares = rows.rows.reduce((s, r) => s + parseFloat(String(r.shares || "0")), 0);
    const sumCostBasis = rows.rows.reduce((s, r) => s + parseFloat(String(r.cost_basis || "0")), 0);
    const sumCurrentValue = rows.rows.reduce((s, r) => s + parseFloat(String(r.current_value || "0")), 0);
    const sumGain = sumCurrentValue - sumCostBasis;

    await pool.query(
      `UPDATE holdings
       SET shares = $1, cost_basis = $2, current_value = $3, gain = $4, updated_at = NOW()
       WHERE id = $5`,
      [sumShares.toFixed(6), sumCostBasis.toFixed(2), sumCurrentValue.toFixed(2), sumGain.toFixed(2), keeper.id],
    );

    const idsToDelete = rows.rows.slice(1).map((r) => r.id);
    if (idsToDelete.length > 0) {
      await pool.query(`DELETE FROM holdings WHERE id = ANY($1::text[])`, [idsToDelete]);
    }

    console.log(`    merged → kept ${keeper.id}: ${sumShares.toFixed(4)} shares · cost $${sumCostBasis.toFixed(2)} · value $${sumCurrentValue.toFixed(2)} · gain ${sumGain >= 0 ? "+" : ""}$${sumGain.toFixed(2)}`);
    console.log(`    deleted ${idsToDelete.length} duplicate(s)`);
  }

  // ----- Step 2: add unique constraint -----
  const constraintCheck = await pool.query(
    `SELECT 1 FROM pg_constraint WHERE conname = 'holdings_fund_ticker_unique'`,
  );
  if (constraintCheck.rows.length > 0) {
    console.log("\nUnique constraint already in place. Done.");
  } else {
    console.log("\nAdding unique constraint on (fund_id, ticker)...");
    await pool.query(
      `ALTER TABLE holdings ADD CONSTRAINT holdings_fund_ticker_unique UNIQUE (fund_id, ticker)`,
    );
    console.log("Constraint added.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
