import "../server/env";
import { db, pool } from "../server/db";
import { users, funds } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";

const DEMO_EMAILS = [
  "marcus@riverafamily.com",
  "elena@riverafamily.com",
  "robert@riverafamily.com",
  "sofia@riverafamily.com",
  "david@riverafamily.com",
  "chris@riverafamily.com",
  "leo@riverafamily.com",
];

async function main() {
  const demoUsers = await db.select({ id: users.id, email: users.email, isDemo: users.isDemoAccount })
    .from(users)
    .where(inArray(users.email, DEMO_EMAILS));
  console.log("DEMO USERS:");
  for (const u of demoUsers) console.log(`  ${u.email} → ${u.id} (isDemoAccount=${u.isDemo})`);
  console.log("");
  for (const u of demoUsers) {
    const userFunds = await db.select({ id: funds.id, slug: funds.slug, name: funds.name })
      .from(funds)
      .where(eq(funds.userId, u.id));
    console.log(`FUNDS for ${u.email}: ${userFunds.length}`);
    for (const f of userFunds) console.log(`  - ${f.slug || "(no-slug)"} ${f.name}`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
