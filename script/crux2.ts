// Crux 2 — does the gifting loop actually compound?
//
// The single most important pre-model question (PRICING_MODEL_OPTIONS.md,
// GROWTH_PLAN.md): of funded kids, what share get a 2nd gift from a DISTINCT
// 3rd person without a reminder, how many dollars per fund, how many gifters.
// If the loop compounds, the whole thesis holds; if it doesn't, pricing is
// irrelevant.
//
// Run: `npm run analytics:crux2`   (read-only; safe to run anytime)
//
// IMPORTANT (2026-07-14): this excludes synthetic accounts (QA/test/visual/demo
// seed) so the number is REAL signal, not seed artifacts. Pre-launch the DB is
// 100% synthetic, so this correctly reports "no real signal yet." The moment
// real families exist, this is the one command that answers the gate. Tune
// SYNTHETIC_EMAIL_SQL below as new test patterns appear.

import "../server/env";
import { pool } from "../server/db";

// Emails treated as NOT-real (QA harness, visual-test, demo seed, obvious junk).
// A single SQL predicate reused across queries. Edit here as patterns evolve.
const SYNTHETIC_EMAIL_SQL = `(
  u.email ILIKE '%@example.com'
  OR u.email ILIKE '%@riverafamily.com'
  OR u.email ILIKE '%@test.com'
  OR u.email ILIKE 'qa\\_%'
  OR u.email ILIKE 'kiddo\\_visual%'
  OR u.email ILIKE 'flow\\_%'
  OR u.email ILIKE 'test%'
  OR u.email ILIKE 'newtest%'
  OR u.email ILIKE 'pref\\_%'
  OR u.email IN ('123@123.com','a@a.com','hh@hh.com','111@111111.com','john@doe.com','joey@joey.com','acdc@gmail.com')
)`;

const q = async (sql: string) => (await pool.query(sql)).rows;

async function main() {
  const [tot] = await q(`
    SELECT
      (SELECT count(*) FROM users) AS users_total,
      (SELECT count(*) FROM users u WHERE ${SYNTHETIC_EMAIL_SQL}) AS users_synthetic,
      (SELECT count(*) FROM funds) AS funds_total
  `);
  const realUsers = Number(tot.users_total) - Number(tot.users_synthetic);
  console.log(`\nAccounts: ${tot.users_total} total, ${tot.users_synthetic} synthetic (QA/test/demo), ${realUsers} real.`);

  // Real fund owners (so you can eyeball what's counted / refine the filter).
  const owners = await q(`
    SELECT u.email, count(f.id) AS funds
    FROM funds f JOIN users u ON u.id = f.user_id
    WHERE NOT ${SYNTHETIC_EMAIL_SQL}
    GROUP BY u.email ORDER BY count(f.id) DESC LIMIT 30
  `);
  console.log(`Real fund owners (${owners.length}): ${owners.length ? owners.map((o: any) => `${o.email}(${o.funds})`).join(", ") : "none"}`);

  // Crux 2 metrics on REAL funds only. "External gifter" = a gift whose sender
  // is not the fund owner (self-funding does not count as loop spread).
  const [c] = await q(`
    WITH per_fund AS (
      SELECT f.id AS fund_id,
             count(g.id) AS gift_count,
             count(DISTINCT coalesce(g.sender_email, g.sender_name)
                   ) FILTER (WHERE coalesce(g.sender_email,'~') <> coalesce(u.email,'~')
                   ) AS ext_gifters,
             coalesce(sum(g.amount::numeric), 0) AS total_amount
      FROM funds f
      JOIN users u ON u.id = f.user_id
      LEFT JOIN gifts g ON g.fund_id = f.id
      WHERE NOT ${SYNTHETIC_EMAIL_SQL}
      GROUP BY f.id, u.email
    )
    SELECT
      count(*)                                  AS real_funds,
      count(*) FILTER (WHERE gift_count > 0)     AS funded,
      count(*) FILTER (WHERE ext_gifters >= 1)   AS with_1plus_ext_gifter,
      count(*) FILTER (WHERE ext_gifters >= 2)   AS with_2plus_ext_gifters,
      round((avg(gift_count)  FILTER (WHERE gift_count > 0))::numeric, 2) AS avg_gifts_per_funded,
      round((avg(ext_gifters) FILTER (WHERE gift_count > 0))::numeric, 2) AS avg_ext_gifters,
      round((avg(total_amount) FILTER (WHERE gift_count > 0))::numeric, 2) AS avg_dollars_per_funded,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount)
            FILTER (WHERE gift_count > 0))::numeric, 2)    AS median_dollars_per_funded
    FROM per_fund
  `);

  const funded = Number(c.funded);
  console.log("\n=== CRUX 2: does the loop compound? (real funds only) ===");
  if (funded === 0) {
    console.log("NO REAL SIGNAL YET. No funded real-user funds — the loop has not");
    console.log("been tested by real families. Crux 2 is unanswerable until launch;");
    console.log("the honest soft-launch + EarlyBird capture ARE the experiment.");
  } else {
    if (funded < 5) {
      console.log(`WARNING: only ${funded} funded real fund(s), and they likely include`);
      console.log(`the founder's own / associate test accounts. Too few for real signal —`);
      console.log(`treat the numbers below as a plumbing check, not a Crux 2 answer.\n`);
    }
    const spread = ((Number(c.with_2plus_ext_gifters) / funded) * 100).toFixed(1);
    console.log(`Funded real funds:                 ${funded}`);
    console.log(`  with 1+ external gifter:         ${c.with_1plus_ext_gifter}`);
    console.log(`  with 2+ external gifters:        ${c.with_2plus_ext_gifters}  <-- the loop-spread signal (${spread}%)`);
    console.log(`Avg gifts per funded fund:         ${c.avg_gifts_per_funded}`);
    console.log(`Avg distinct external gifters:     ${c.avg_ext_gifters}`);
    console.log(`Median $ per funded fund:          $${c.median_dollars_per_funded}`);
    console.log(`Avg $ per funded fund:             $${c.avg_dollars_per_funded}`);
    console.log(`\nRead: "loop compounds" = a healthy share reach 2+ distinct gifters`);
    console.log(`without prompting. Compare the 2+-gifter % over time as the true gate.`);
  }
  console.log("");
}

main()
  .catch((e) => { console.error("crux2 error:", (e as Error).message); process.exitCode = 1; })
  .finally(() => pool.end());
