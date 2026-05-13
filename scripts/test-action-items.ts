// Smoke-test the action-item derivation against your real user.
// Bypasses HTTP/auth — runs the derivation function directly.

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { deriveActionItemsForUser } from "../server/actionItems";

(async () => {
  const email = process.argv[2] || "dovisherman@gmail.com";
  const userResult = await db.execute(sql`
    SELECT * FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `);
  const user = (userResult.rows as any[])?.[0];
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }
  // Drizzle returns snake_case from raw SQL; convert to the shape
  // the derivation expects.
  const userObj: any = {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    preferredName: user.preferred_name,
    kycStatus: user.kyc_status,
  };

  const funds = await storage.getFundsByUser(user.id);
  const bankCount = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM bank_accounts WHERE user_id = ${user.id}
  `);
  const hasBank = Number((bankCount.rows as any[])?.[0]?.n || 0) > 0;

  console.log(`User: ${user.email}  kycStatus: ${user.kyc_status}  funds: ${funds.length}  hasBank: ${hasBank}`);

  const items = await deriveActionItemsForUser(userObj, funds as any, hasBank);
  console.log(`\nDerived ${items.length} open action items:\n`);
  for (const item of items) {
    console.log(`  [${item.severity.padEnd(8)}] ${item.type.padEnd(28)}  ${item.title}  (${item.fundLabel})`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
