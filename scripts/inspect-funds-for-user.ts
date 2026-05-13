// Inspect what's actually in the DB for the signed-in user.
// Lets us prove (or disprove) the "0 funds" theory for /api/funds-overview.

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function main() {
  // 1. Find user(s) by email.
  const email = process.argv[2] || "dovisherman@gmail.com";
  console.log(`Looking up user(s) with email: ${email}\n`);

  const users = await db.execute(sql`
    SELECT id, email, created_at, is_admin
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    ORDER BY created_at ASC
  `);
  const userRows = (users.rows as any[]) || [];

  if (userRows.length === 0) {
    console.log("❌ No user found with that email.");
    process.exit(0);
  }

  for (const u of userRows) {
    console.log(`👤 user.id=${u.id} email=${u.email} admin=${u.is_admin} created=${new Date(u.created_at).toISOString()}`);

    // 2. Funds owned by this user_id.
    const funds = await db.execute(sql`
      SELECT id, name, slug, status, balance, pending_balance, cash_balance, user_id
      FROM funds
      WHERE user_id = ${u.id}
      ORDER BY created_at DESC
    `);
    const fundRows = (funds.rows as any[]) || [];

    if (fundRows.length === 0) {
      console.log(`   no funds owned by this user.id\n`);
    } else {
      console.log(`   ${fundRows.length} fund(s):`);
      for (const f of fundRows) {
        console.log(`     - ${f.name}  status=${f.status}  balance=${f.balance}  pending=${f.pending_balance}  cash=${f.cash_balance}  id=${f.id}`);
      }
      console.log("");
    }

    // 3. Collaborator rows.
    try {
      const collabs = await db.execute(sql`
        SELECT fc.id, fc.fund_id, fc.status, fc.role, f.name
        FROM fund_collaborators fc
        LEFT JOIN funds f ON f.id = fc.fund_id
        WHERE fc.user_id = ${u.id}
      `);
      const cRows = (collabs.rows as any[]) || [];
      console.log(`   collaborator rows: ${cRows.length}`);
      for (const c of cRows) {
        console.log(`     - fund=${c.name} status=${c.status} role=${c.role}`);
      }
      console.log("");
    } catch (err) {
      console.log(`   (fund_collaborators query failed: ${(err as any)?.message})\n`);
    }
  }

  // 4. ANY fund matching name "Emma" — to verify it exists at all.
  console.log(`Searching all funds named like 'Emma' (no user filter):`);
  const allEmma = await db.execute(sql`
    SELECT id, name, slug, status, balance, user_id
    FROM funds
    WHERE LOWER(name) LIKE '%emma%' OR LOWER(recipient_first_name) = 'emma'
    LIMIT 10
  `);
  const allEmmaRows = (allEmma.rows as any[]) || [];
  if (allEmmaRows.length === 0) {
    console.log("   none found.");
  } else {
    for (const f of allEmmaRows) {
      console.log(`   - ${f.name}  status=${f.status}  balance=${f.balance}  user_id=${f.user_id}  id=${f.id}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
