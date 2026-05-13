// Run the /api/funds-overview computation directly against the DB
// for a specific user. No HTTP, no auth — just the same logic the
// endpoint runs, so we can see exactly where it breaks (Drizzle
// schema drift, missing collaborators table, etc.).

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";

async function main() {
  const email = process.argv[2] || "dovisherman@gmail.com";

  console.log(`\nSimulating /api/funds-overview for ${email}\n${"=".repeat(60)}\n`);

  // Resolve user via case-insensitive email — same path as deserializeUser.
  const userResult = await db.execute(sql`
    SELECT id, email FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `);
  const userRow = (userResult.rows as any[])?.[0];
  if (!userRow) {
    console.log("❌ User not found");
    process.exit(1);
  }
  const userId: string = String(userRow.id);
  const userEmail: string = String(userRow.email || "").toLowerCase();
  console.log(`Resolved user: id=${userId}\n`);

  // Step 1: storage.getFundsByUser via Drizzle.
  let ownedFunds: any[] = [];
  try {
    ownedFunds = await storage.getFundsByUser(userId);
    console.log(`✅ storage.getFundsByUser(userId) -> ${ownedFunds.length} fund(s)`);
  } catch (err) {
    console.log(`❌ storage.getFundsByUser(userId) THREW:`);
    console.log(`   ${(err as any)?.message || err}`);
    console.log(`   This is the bug — Drizzle compiled schema drift.\n`);
    console.log(`   Trying raw SQL fallback...`);
    const fallback = await db.execute(sql`
      SELECT id, user_id, name, slug, status, balance, pending_balance, cash_balance
      FROM funds WHERE user_id = ${userId}
    `);
    console.log(`   Raw SQL returned ${(fallback.rows as any[])?.length || 0} row(s)`);
  }

  // Step 2: cross-device email merge.
  const candidates = await db.execute(sql`
    SELECT id FROM users WHERE LOWER(email) = ${userEmail}
  `);
  console.log(`\nEmail-merge candidates: ${(candidates.rows as any[])?.length || 0}`);

  // Step 3: getCollaboratedFunds.
  let collabFunds: any[] = [];
  try {
    collabFunds = await storage.getCollaboratedFunds(userId);
    console.log(`\n✅ storage.getCollaboratedFunds(userId) -> ${collabFunds.length} fund(s)`);
  } catch (err) {
    console.log(`\n❌ storage.getCollaboratedFunds(userId) THREW:`);
    console.log(`   ${(err as any)?.message || err}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Summary: owned=${ownedFunds.length} collab=${collabFunds.length} totalActive=${ownedFunds.filter(f => String(f.status || '').toLowerCase() !== 'closed').length + collabFunds.filter(f => String(f.status || '').toLowerCase() !== 'closed').length}`);
  console.log(`Expected: overview would ${ownedFunds.length + collabFunds.length >= 2 ? "UNLOCK" : "show not-enabled with fundCount=" + (ownedFunds.length + collabFunds.length)}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
