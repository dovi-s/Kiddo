import "../server/env";
import { pool } from "../server/db";

// Wipes all `lifecycle_*` activity rows. These are pure UX nudges
// ("Event ready to share", "Re-engage your fund", "Follow up your shared
// event", etc.) emitted from referral-event signals — not load-bearing
// data. No money state, no balances, no holdings depend on them.
//
// Why scrub:
// Test funds that were created and abandoned accumulate the same 4-nudge
// bundle (event_ready_to_share_1h / event_created_no_share_24h /
// share_no_checkout_48h / no_gift_14d). With 6 dead funds × 4 nudges, the
// notifications panel becomes 24 stale rows of marketing noise drowning
// out real activity (gifts, milestones).
//
// Why safe:
// - The server's referral-event handler re-fires nudges on a cooldown
//   schedule based on CURRENT fund state. Scrubbing today doesn't lose
//   anything; any still-relevant nudge will reappear naturally.
// - The Activity feed already hides lifecycle_* via prefix-match, so
//   removing them only affects the Notifications panel + bell.
// - Audit trail for actual money movement (gift_received, gift_invested,
//   parent_contribution, withdrawal, etc.) is untouched.
async function main() {
  const countRes = await pool.query(
    `SELECT type, COUNT(*)::int AS n
     FROM activities
     WHERE type LIKE 'lifecycle\\_%' ESCAPE '\\'
     GROUP BY type
     ORDER BY n DESC`
  );
  if (countRes.rows.length === 0) {
    console.log("No lifecycle nudge rows found. Nothing to scrub.");
    process.exit(0);
  }
  console.log("Will delete:");
  let total = 0;
  for (const r of countRes.rows) {
    console.log(`  ${r.type.padEnd(40)} ${r.n}`);
    total += Number(r.n);
  }
  console.log(`Total: ${total} rows\n`);

  const del = await pool.query(
    `DELETE FROM activities
     WHERE type LIKE 'lifecycle\\_%' ESCAPE '\\'`
  );
  console.log(`Deleted ${del.rowCount} row(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Scrub failed:", err);
  process.exit(1);
});
