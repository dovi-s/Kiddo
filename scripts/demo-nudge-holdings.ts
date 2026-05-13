import "../server/env";
import { pool } from "../server/db";

// One-shot demo: bumps a few of Emma's holdings' currentValue / gain so
// the parent can visually confirm the growth-pill styling renders. Test
// data shipped with cost-basis = current value to the cent, which trips
// the `Math.abs(hGain) > 0.01` threshold and hides the gain row on every
// row. After this script runs, three positions will show real movement
// (a green winner, a green steady, a red loser) — proving the styling
// works without changing any product code.
//
// Idempotent across runs (each row is updated absolutely, not relatively).
async function main() {
  // Target the Emma fund that has the holdings the parent is currently
  // looking at. Multiple Emma test funds exist; pick the one with the
  // most holdings (= the active one being demoed). Falls back to most
  // recent if there's a tie.
  const fundResult = await pool.query(`
    SELECT f.id, f.name, COUNT(h.id) AS holdings_count
    FROM funds f
    LEFT JOIN holdings h ON h.fund_id = f.id
    WHERE f.recipient_first_name = 'Emma'
    GROUP BY f.id
    ORDER BY COUNT(h.id) DESC, f.created_at DESC
    LIMIT 1
  `);
  if (fundResult.rows.length === 0) {
    console.log("No Emma fund found. Edit the script to target a different fund.");
    process.exit(0);
  }
  const fundId = fundResult.rows[0].id;
  console.log(`Targeting fund: ${fundResult.rows[0].name || "Emma's Fund"} (${fundId})\n`);

  type Nudge = { ticker: string; pct: number; label: string };
  const nudges: Nudge[] = [
    { ticker: "GOOGL", pct: +0.0512, label: "winner" },     // +5.12%
    { ticker: "DUOL",  pct: +0.0234, label: "steady up" },  // +2.34%
    { ticker: "NFLX",  pct: -0.0187, label: "loser" },      // -1.87%
    { ticker: "VTI",   pct: +0.0098, label: "managed up" }, // +0.98%
    { ticker: "BND",   pct: -0.0042, label: "managed flat-ish" }, // -0.42%
  ];

  for (const nudge of nudges) {
    const res = await pool.query(
      `SELECT id, ticker, cost_basis, current_value FROM holdings
       WHERE fund_id = $1 AND UPPER(ticker) = $2`,
      [fundId, nudge.ticker.toUpperCase()],
    );
    if (res.rows.length === 0) {
      console.log(`  skip ${nudge.ticker}: no holding row`);
      continue;
    }
    for (const row of res.rows) {
      const cost = parseFloat(String(row.cost_basis || "0"));
      if (cost <= 0) {
        console.log(`  skip ${nudge.ticker} ${row.id}: zero cost basis`);
        continue;
      }
      const newValue = cost * (1 + nudge.pct);
      const newGain = newValue - cost;
      await pool.query(
        `UPDATE holdings
         SET current_value = $1, gain = $2
         WHERE id = $3`,
        [newValue.toFixed(2), newGain.toFixed(2), row.id],
      );
      const dir = nudge.pct >= 0 ? "+" : "";
      console.log(`  nudged ${nudge.ticker.padEnd(6)} ${nudge.label.padEnd(20)} cost $${cost.toFixed(2)} → value $${newValue.toFixed(2)} (${dir}${(nudge.pct * 100).toFixed(2)}%)`);
    }
  }

  console.log("\nDone. Reload the dashboard — you should see green/red gain pills on the nudged rows.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Nudge failed:", err);
  process.exit(1);
});
