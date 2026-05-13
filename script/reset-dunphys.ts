// Reset the Dunphy demo state. Wipes all data tied to demo users, then
// re-runs the seed. Used by:
//   1. Manual invocation: `npm run reset:dunphys` — when a demo visitor
//      mutated the seeded data and you want to put it back.
//   2. Nightly cron: server/demoResetWorker.ts fires this daily so the
//      shared public demo doesn't drift over time.
//
// Idempotent. Safe to run on a fresh DB (no demo users found = no-op
// wipe, then seed creates everything). Safe to run repeatedly.
//
// What gets wiped: all rows in dependent tables filtered to demo-owned
// funds OR demo-owned users. What stays: the user rows themselves
// (preserves password hashes so the seed's idempotent upsert path runs
// cheaper). The seed's upsertUser will refresh names + flags anyway.
//
// Per DUNPHY_DEMO_SPEC.md "nightly reset cron" deferred item.

import "../server/env";
import { db, pool } from "../server/db";
import {
  users,
  funds,
  gifts,
  holdings,
  memoryEntries,
  activities,
  parentContributions,
  transactions,
  fundMemberships,
  fundSnapshots,
  gifterFunds,
  bankAccounts,
} from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { runDunphySeed } from "./seed-dunphys";

const DEMO_EMAILS = [
  "phil@dunphyfamily.com",
  "claire@dunphyfamily.com",
  "jay@dunphyfamily.com",
  "gloria@dunphyfamily.com",
  "mitchell@dunphyfamily.com",
  "cameron@dunphyfamily.com",
  "manny@dunphyfamily.com",
];

async function wipeDemoState(): Promise<void> {
  // 1. Find demo user IDs.
  const demoUsers = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, DEMO_EMAILS));
  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length === 0) {
    console.log("No Dunphy demo users found. Nothing to wipe.");
    return;
  }

  console.log(`Found ${demoUserIds.length} demo user(s). Wiping dependent rows...`);

  // 2. Find demo fund IDs (owned by demo users).
  const demoFunds = await db.select({ id: funds.id, name: funds.name })
    .from(funds)
    .where(inArray(funds.userId, demoUserIds));
  const demoFundIds = demoFunds.map((f) => f.id);

  // 3. Delete dependent rows in FK-safe order. Fund-scoped first, then
  //    user-scoped, then funds + memberships + subscriptions are handled
  //    after dependents are clear.
  //
  //    Subscriptions table is intentionally NOT wiped — the seed's
  //    ensurePhilFamilySubscription() upserts it. Wiping the row would
  //    cascade onto Stripe IDs the seed sets to null, no real harm.
  //    Keeping the row avoids a needless DELETE.
  if (demoFundIds.length > 0) {
    await db.delete(gifts).where(inArray(gifts.fundId, demoFundIds));
    await db.delete(holdings).where(inArray(holdings.fundId, demoFundIds));
    await db.delete(memoryEntries).where(inArray(memoryEntries.fundId, demoFundIds));
    await db.delete(activities).where(inArray(activities.fundId, demoFundIds));
    await db.delete(parentContributions).where(inArray(parentContributions.fundId, demoFundIds));
    await db.delete(transactions).where(inArray(transactions.fundId, demoFundIds));
    await db.delete(fundMemberships).where(inArray(fundMemberships.fundId, demoFundIds));
    await db.delete(fundSnapshots).where(inArray(fundSnapshots.fundId, demoFundIds));
    await db.delete(gifterFunds).where(inArray(gifterFunds.fundId, demoFundIds));
    console.log(`  cleared dependents for ${demoFundIds.length} fund(s)`);
  }

  // 4. Also delete user-scoped rows that aren't fund-keyed.
  await db.delete(bankAccounts).where(inArray(bankAccounts.userId, demoUserIds));
  // Activities can be user-scoped without a fundId (e.g. subscription events).
  await db.delete(activities).where(inArray(activities.userId, demoUserIds));
  await db.delete(transactions).where(inArray(transactions.userId, demoUserIds));

  // 5. Delete the funds themselves.
  if (demoFundIds.length > 0) {
    await db.delete(funds).where(inArray(funds.id, demoFundIds));
    console.log(`  deleted ${demoFundIds.length} fund(s)`);
  }

  // 6. Users stay — the seed upserts by email and the password hashes
  //    are stable across resets. Saves a bcrypt pass per user per reset.
}

export async function resetDunphys(options: { closePool?: boolean } = {}): Promise<void> {
  const closePool = options.closePool !== false;
  await wipeDemoState();
  console.log("");
  await runDunphySeed({ closePool: false });
  if (closePool) await pool.end();
}

const isDirectInvocation = (() => {
  try {
    const invoked = process.argv[1] ? process.argv[1].replace(/\\/g, "/").toLowerCase() : "";
    return invoked.endsWith("/reset-dunphys.ts") || invoked.endsWith("/reset-dunphys.js");
  } catch {
    return false;
  }
})();

if (isDirectInvocation) {
  resetDunphys().catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
}
