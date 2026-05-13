import "../server/env";
import { pool } from "../server/db";

// Scrubs the phantom $100,000 RBLX sell activity row (test data) that's
// been inflating cost-basis math on Emma's fund. With the parent-relative
// growth display landing at the same time, this should be the last
// piece of weirdness on the dashboard's number consistency.
//
// Why safe:
// - Activities table is an audit log. Removing one row doesn't affect
//   holdings, gifts, balances, or any user-facing money state.
// - The holdings table independently tracks positions; if there's
//   actual phantom inventory there, it persists — but the math fixes
//   in dashboard-money-math + Dashboard already make growth display
//   parent-relative, so basis weirdness no longer surfaces.
// - Idempotent: hard-codes the row ID we just identified. Running
//   twice is a no-op.
async function main() {
  const targetId = "b8d0e872-d142-4424-9804-3e8d9a4a8200";
  const findRes = await pool.query(
    `SELECT id, type, title, amount, created_at
     FROM activities
     WHERE id = $1`,
    [targetId],
  );
  if (findRes.rows.length === 0) {
    console.log("Phantom RBLX row not found — already scrubbed or different ID. No action.");
    process.exit(0);
  }
  const row = findRes.rows[0];
  console.log("Found:", row);

  const del = await pool.query(`DELETE FROM activities WHERE id = $1`, [targetId]);
  console.log(`Deleted ${del.rowCount} row(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Scrub failed:", err);
  process.exit(1);
});
