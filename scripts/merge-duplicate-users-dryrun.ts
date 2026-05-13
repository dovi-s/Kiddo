// One-shot CLI dry-run for merge-duplicate-users. Same logic as the
// admin endpoint at POST /api/admin/maintenance/merge-duplicate-users
// but read-only against the DB so it doesn't need a session cookie.
//
// Run:
//   npx tsx scripts/merge-duplicate-users-dryrun.ts
//
// Output: per duplicate group, what the canonical row would be and
// which secondary rows would be absorbed. Nothing is mutated.

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
};

async function main() {
  console.log("[merge-duplicate-users dry-run] starting...\n");

  // Find every email that's tied to 2+ user rows (case-insensitive).
  const dupEmailsResult = await db.execute(sql`
    SELECT LOWER(email) AS email, COUNT(*)::int AS n
    FROM users
    WHERE email IS NOT NULL AND email <> ''
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
    ORDER BY n DESC, LOWER(email) ASC
  `);

  const dupEmails = (dupEmailsResult.rows as Array<{ email: string; n: number }>) || [];

  if (dupEmails.length === 0) {
    console.log("✅ No duplicate user rows. Nothing to merge.");
    console.log("\nYou can safely add the case-insensitive UNIQUE index now if it isn't already there:");
    console.log("  CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique");
    console.log("  ON users (LOWER(email)) WHERE email IS NOT NULL;\n");
    process.exit(0);
  }

  console.log(`Found ${dupEmails.length} email${dupEmails.length === 1 ? "" : "s"} with duplicate user rows.\n`);

  let totalToAbsorb = 0;

  for (const { email, n } of dupEmails) {
    console.log(`📧 ${email}  (${n} rows)`);

    // Pull all candidate rows for this email and their fund counts.
    const candidatesResult = await db.execute(sql`
      SELECT u.id, u.email, u.created_at,
             COALESCE((SELECT COUNT(*) FROM funds f WHERE f.user_id = u.id), 0)::int AS fund_count
      FROM users u
      WHERE LOWER(u.email) = ${email}
      ORDER BY fund_count DESC, u.created_at ASC
    `);

    const candidates =
      (candidatesResult.rows as Array<UserRow & { fund_count: number }>) || [];

    if (candidates.length === 0) {
      console.log("   (no rows returned — skipping)\n");
      continue;
    }

    const canonical = candidates[0];
    const absorbed = candidates.slice(1);
    totalToAbsorb += absorbed.length;

    console.log(`   ✅ Canonical: ${canonical.id} (${canonical.fund_count} fund${canonical.fund_count === 1 ? "" : "s"}, created ${new Date(canonical.created_at).toISOString().slice(0, 10)})`);

    for (const dup of absorbed) {
      console.log(`   ⤵️  Absorb:    ${dup.id} (${dup.fund_count} fund${dup.fund_count === 1 ? "" : "s"}, created ${new Date(dup.created_at).toISOString().slice(0, 10)})`);
    }
    console.log("");
  }

  console.log(`Summary: ${totalToAbsorb} user row${totalToAbsorb === 1 ? "" : "s"} would be absorbed into ${dupEmails.length} canonical row${dupEmails.length === 1 ? "" : "s"}.\n`);
  console.log("To execute the merge:");
  console.log("  POST /api/admin/maintenance/merge-duplicate-users");
  console.log('  body: { "dryRun": false }');
  console.log("");
  console.log("(needs a super-admin session cookie)\n");

  // Also check OAuth identities table state.
  try {
    const oauthResult = await db.execute(sql`SELECT COUNT(*)::int AS n FROM oauth_identities`);
    const n = Number((oauthResult.rows as any[])?.[0]?.n || 0);
    console.log(`oauth_identities table: ${n} row${n === 1 ? "" : "s"} (DB-backed; file at .local/oauth-identities.json kept as backup).`);
  } catch (err) {
    console.log("oauth_identities table: not yet created. Run `npm run db:migrate` or `npm run db:push` first.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[merge-duplicate-users dry-run] error:", err);
  process.exit(1);
});
