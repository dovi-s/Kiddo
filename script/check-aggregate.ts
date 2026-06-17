import "../server/env";
import { db, pool } from "../server/db";
import { funds, fundSnapshots, users } from "../shared/schema";
import { eq, inArray, asc } from "drizzle-orm";

async function main() {
  const [phil] = await db.select().from(users).where(eq(users.email, "elena@riverafamily.com"));
  if (!phil) { console.log("no claire"); await pool.end(); return; }
  const philFunds = await db.select().from(funds).where(eq(funds.userId, phil.id));
  console.log("Elena owns", philFunds.length, "funds:");
  let totalBalance = 0;
  for (const f of philFunds) {
    console.log(`  ${f.slug?.padEnd(15)} balance=$${f.balance}`);
    totalBalance += parseFloat(String(f.balance || 0));
  }
  console.log(`  total: $${totalBalance.toFixed(2)}`);

  // For each fund, get snapshot count + last snapshot value
  for (const f of philFunds) {
    const snaps = await db.select().from(fundSnapshots)
      .where(eq(fundSnapshots.fundId, f.id))
      .orderBy(asc(fundSnapshots.snapshotDate));
    if (snaps.length === 0) continue;
    const last = snaps[snaps.length - 1];
    const first = snaps[0];
    console.log(`  ${f.slug?.padEnd(15)} snaps=${snaps.length} first=${new Date(first.snapshotDate).toISOString().slice(0,10)} ($${first.totalValue}) last=${new Date(last.snapshotDate).toISOString().slice(0,10)} ($${last.totalValue})`);
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
