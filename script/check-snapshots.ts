import "../server/env";
import { db, pool } from "../server/db";
import { funds, fundSnapshots } from "../shared/schema";
import { eq, asc } from "drizzle-orm";

async function main() {
  const dunphyFunds = await db.select().from(funds).where(eq(funds.slug, "haley-dunphy"));
  for (const f of dunphyFunds) {
    const snaps = await db.select().from(fundSnapshots)
      .where(eq(fundSnapshots.fundId, f.id))
      .orderBy(asc(fundSnapshots.snapshotDate));
    console.log(`\n${f.name}: ${snaps.length} total snapshots`);
    const now = Date.now();
    const buckets = {
      "older than 1Y": 0,
      "1Y to 30d ago": 0,
      "last 30 days": 0,
    };
    for (const s of snaps) {
      const ageDays = (now - new Date(s.snapshotDate).getTime()) / 86_400_000;
      if (ageDays > 365) buckets["older than 1Y"]++;
      else if (ageDays > 30) buckets["1Y to 30d ago"]++;
      else buckets["last 30 days"]++;
    }
    console.log("Resolution buckets:", buckets);
    // Last 5 snapshots
    console.log("\nLast 5 snapshots:");
    for (const s of snaps.slice(-5)) {
      console.log(`  ${new Date(s.snapshotDate).toISOString().slice(0,10)}  total=$${Number(s.totalValue).toFixed(2)}`);
    }
    console.log(`\nfund.balance: $${f.balance}`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
