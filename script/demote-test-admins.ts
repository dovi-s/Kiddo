// Pre-prod hygiene: demote admin rights on test/demo/QA accounts.
//
// The admin Access Review surfaced ~65 `qa_admin_ui_*@example.com` accounts
// carrying full is_admin — fine on local/staging, unacceptable in production.
// This demotes any admin account that is a test-pollution account
// (is_test_user), a demo account (is_demo_account), or an @example.com address
// (RFC-2606 reserved test domain). Real admins (e.g. a gmail.com operator) are
// matched by NONE of these, so they're preserved.
//
// SAFE BY DEFAULT: dry-run. Lists what WOULD be demoted and exits. Pass --apply
// to actually set is_admin = false. Idempotent (re-running after apply is a
// no-op — nothing matches once demoted).
//
//   npx tsx script/demote-test-admins.ts            # dry run
//   npx tsx script/demote-test-admins.ts --apply     # perform the demotion
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const apply = process.argv.includes("--apply");

const MATCH = sql`
  is_admin = true
  AND (
    is_test_user = true
    OR is_demo_account = true
    OR LOWER(email) LIKE '%@example.com'
  )
`;

const rows = (await db.execute(sql`
  SELECT id, email, is_test_user, is_demo_account
  FROM users
  WHERE ${MATCH}
  ORDER BY email
`)).rows as any[];

console.log(`Found ${rows.length} test/demo/QA admin account(s):`);
for (const r of rows) {
  console.log(`  ${String(r.email || "(no email)").padEnd(48)} test=${r.is_test_user} demo=${r.is_demo_account}`);
}

// Show which admins are being KEPT (real operators), for confidence.
const kept = (await db.execute(sql`
  SELECT email FROM users
  WHERE is_admin = true AND NOT (${MATCH}) ORDER BY email
`)).rows as any[];
console.log(`\nKeeping ${kept.length} real admin(s):`);
for (const r of kept) console.log(`  ${r.email}`);

if (!apply) {
  console.log("\nDRY RUN — nothing changed. Re-run with --apply to demote the test/demo/QA admins above.");
  process.exit(0);
}

await db.execute(sql`UPDATE users SET is_admin = false WHERE ${MATCH}`);
console.log(`\n✓ Demoted ${rows.length} test/demo/QA account(s) to non-admin.`);
process.exit(0);
