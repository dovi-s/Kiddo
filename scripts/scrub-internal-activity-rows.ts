import "../server/env";
import { pool } from "../server/db";

// Clears internal-only activity rows that were leaking into the parent's
// Activity feed before the client-side suppression landed. These are pure
// CTA-funnel analytics written by `logMonetizationActivity` with the
// hardcoded title "Monetization trigger event":
//   - type = 'monetization_trigger_event'  (legacy literal, may not exist)
//   - type LIKE 'upgrade\_%'                (current naming — upgrade_viewed,
//                                             upgrade_landed, upgrade_dismissed,
//                                             upgrade_clicked, etc.)
// They were never user-meaningful — the client now hides them, but with rows
// still in the DB the Activity GET endpoint keeps shipping them across the
// wire. Wiping them is safe: there's no foreign key from any user-facing
// surface that depends on these rows.
async function main() {
  const countRes = await pool.query(
    `SELECT type, COUNT(*)::int AS n
     FROM activities
     WHERE type = 'monetization_trigger_event' OR type LIKE 'upgrade\\_%' ESCAPE '\\'
     GROUP BY type
     ORDER BY n DESC`
  );
  if (countRes.rows.length === 0) {
    console.log("No internal-only activity rows found. Nothing to scrub.");
    process.exit(0);
  }
  console.log("Will delete:");
  let total = 0;
  for (const r of countRes.rows) {
    console.log(`  ${r.type.padEnd(30)} ${r.n}`);
    total += Number(r.n);
  }
  console.log(`Total: ${total} rows\n`);

  const del = await pool.query(
    `DELETE FROM activities
     WHERE type = 'monetization_trigger_event' OR type LIKE 'upgrade\\_%' ESCAPE '\\'`
  );
  console.log(`Deleted ${del.rowCount} row(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Scrub failed:", err);
  process.exit(1);
});
