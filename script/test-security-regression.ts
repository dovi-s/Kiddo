// Security regression tests — lock in the audit fixes so they can't
// silently regress. Exercises the actual DB constraint + storage scoping +
// the public endpoint shape. Uses the seeded demo funds (Phil's) and only
// creates throwaway rows it deletes afterward (marked @example.com). Run:
//   npm run test:security-regression
//
// Covered:
//   1. gifts.stripePaymentIntentId partial-unique index — a duplicate
//      PaymentIntent insert is rejected (gift double-credit race, migration
//      0035 / a35928b).
//   2. Collaborator IDOR scoping — storage.updateCollaborator /
//      deleteCollaborator scoped to the wrong fundId is a no-op (a35928b).
//   3. Public fund overview omits dollar amounts (minor-balance leak fix,
//      a35928b) — best-effort HTTP check, skipped if the dev server is down.

import "../server/env";
import { db, pool } from "../server/db";
import { funds, gifts, fundCollaborators, users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../server/storage";
import crypto from "node:crypto";

async function main() {
  let failures = 0;
  const ok = (name: string, cond: boolean) => {
    console.log(`  ${cond ? "✓" : "✗"} ${name}`);
    if (!cond) failures++;
  };
  const cleanup: Array<() => Promise<void>> = [];

  const [phil] = await db.select().from(users).where(eq(users.email, "phil@dunphyfamily.com")).limit(1);
  if (!phil) {
    console.log("Demo not seeded (no phil@dunphyfamily.com); skipping security regression tests.");
    await pool.end();
    return;
  }
  const philFunds = await db.select().from(funds).where(eq(funds.userId, phil.id)).limit(2);
  if (philFunds.length < 2) {
    console.log("Need 2 demo funds; skipping. Run `npm run reset:dunphys` first.");
    await pool.end();
    return;
  }
  const [fundA, fundB] = philFunds;

  try {
    // --- 1. Duplicate Stripe PaymentIntent must be rejected ---
    const testPi = `pi_sectest_${crypto.randomUUID()}`;
    const giftValues = (pi: string) => ({
      fundId: fundA.id,
      senderName: "Security Regression",
      senderEmail: "sectest@example.com",
      amount: "10.00",
      netAmount: "10.00",
      status: "invested",
      stripePaymentIntentId: pi,
    });
    const [g1] = await db.insert(gifts).values(giftValues(testPi) as any).returning();
    cleanup.push(async () => { await db.delete(gifts).where(eq(gifts.id, g1.id)); });

    let dupRejected = false;
    let g2Id: string | null = null;
    try {
      const [g2] = await db.insert(gifts).values(giftValues(testPi) as any).returning();
      g2Id = g2?.id ?? null;
    } catch {
      dupRejected = true;
    }
    if (g2Id) cleanup.push(async () => { await db.delete(gifts).where(eq(gifts.id, g2Id!)); });
    ok("duplicate Stripe PaymentIntent insert is rejected (double-credit race)", dupRejected);

    // --- 2. Collaborator IDOR scoping ---
    const [collabB] = await db
      .insert(fundCollaborators)
      .values({ fundId: fundB.id, email: "sectest-collab@example.com", role: "viewer", status: "accepted" } as any)
      .returning();
    cleanup.push(async () => { await db.delete(fundCollaborators).where(eq(fundCollaborators.id, collabB.id)); });

    // Updating collabB (on fundB) but scoped to fundA must NOT change it.
    const wrongScope = await storage.updateCollaborator(collabB.id, { role: "co-admin" } as any, fundA.id);
    ok("updateCollaborator with wrong fundId returns nothing (IDOR blocked)", !wrongScope);
    const afterWrong = (await db.select().from(fundCollaborators).where(eq(fundCollaborators.id, collabB.id)))[0];
    ok("collaborator role unchanged after wrong-scope update", afterWrong?.role === "viewer");

    // Correct fundId scope updates as expected.
    const rightScope = await storage.updateCollaborator(collabB.id, { role: "co-admin" } as any, fundB.id);
    ok("updateCollaborator with correct fundId updates", rightScope?.role === "co-admin");

    // deleteCollaborator scoped to the wrong fund must be a no-op.
    await storage.deleteCollaborator(collabB.id, fundA.id);
    const afterWrongDelete = await db.select().from(fundCollaborators).where(eq(fundCollaborators.id, collabB.id));
    ok("deleteCollaborator with wrong fundId is a no-op (IDOR blocked)", afterWrongDelete.length === 1);

    // --- 3. Public overview omits dollar amounts (best-effort HTTP) ---
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/public/funds/${fundA.id}/overview`);
      if (res.ok) {
        const body: any = await res.json();
        ok(
          "public fund overview omits balance/totalGain/totalContributed",
          body.balance === undefined && body.totalGain === undefined && body.totalContributed === undefined,
        );
      } else {
        console.log(`  - public overview HTTP check skipped (status ${res.status})`);
      }
    } catch {
      console.log("  - public overview HTTP check skipped (dev server not reachable)");
    }
  } finally {
    for (const c of cleanup.reverse()) {
      try { await c(); } catch (err) { console.warn("cleanup step failed (non-fatal):", err); }
    }
  }

  if (failures > 0) {
    console.error(`\nSecurity regression tests FAILED (${failures} failing).`);
    await pool.end();
    process.exit(1);
  }
  console.log("\nSecurity regression tests passed.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
