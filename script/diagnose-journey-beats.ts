// One-off diagnostic (safe, read-only): print exactly what the "Watch it
// grow" journey replay has to work with for each Rivera fund — snapshot span,
// first/biggest gifts, recurring start, occasion gift-attribution — so beat
// gaps can be diagnosed against REAL data instead of guessed at.
import { db } from "../server/db";
import { funds, gifts, events, parentContributions, fundSnapshots, memoryEntries } from "../shared/schema";
import { eq, asc } from "drizzle-orm";

async function main() {
  const allFunds = await db.select().from(funds);
  const demoFunds = allFunds.filter((f: any) =>
    ["luke", "alex", "haley"].some((n) => String(f.recipientFirstName || "").toLowerCase().includes(n)),
  );
  for (const fund of demoFunds) {
    console.log(`\n===== ${fund.recipientFirstName} (${fund.id}) =====`);
    console.log(`fund.createdAt: ${fund.createdAt}`);

    const snaps = await db.select().from(fundSnapshots).where(eq(fundSnapshots.fundId, fund.id)).orderBy(asc(fundSnapshots.snapshotDate));
    console.log(`snapshots: ${snaps.length} | first: ${snaps[0]?.snapshotDate} ($${snaps[0]?.totalValue}) | last: ${snaps[snaps.length - 1]?.snapshotDate} ($${snaps[snaps.length - 1]?.totalValue})`);
    if (snaps.length > 2) {
      console.log(`  2nd: ${snaps[1]?.snapshotDate} ($${snaps[1]?.totalValue}) | 3rd: ${snaps[2]?.snapshotDate} ($${snaps[2]?.totalValue})`);
    }

    const giftRows = await db.select().from(gifts).where(eq(gifts.fundId, fund.id));
    const sorted = [...giftRows].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    console.log(`gifts: ${giftRows.length} | first: ${sorted[0]?.createdAt} $${sorted[0]?.amount} from ${sorted[0]?.senderName}`);
    const oneTime = sorted.filter((g: any) => !g.parentContributionId);
    const biggest = [...oneTime].sort((a: any, b: any) => parseFloat(String(b.netAmount || b.amount || "0")) - parseFloat(String(a.netAmount || a.amount || "0")))[0];
    console.log(`biggest one-time: $${(biggest as any)?.netAmount || (biggest as any)?.amount} from ${(biggest as any)?.senderName} at ${(biggest as any)?.createdAt}`);
    const withEventId = giftRows.filter((g: any) => g.eventId).length;
    console.log(`gifts with eventId: ${withEventId} / ${giftRows.length}`);

    const contribs = await db.select().from(parentContributions).where(eq(parentContributions.fundId, fund.id));
    for (const c of contribs) {
      console.log(`recurring: $${(c as any).amount}/${(c as any).frequency} status=${(c as any).status} createdAt=${(c as any).createdAt}`);
    }

    const evts = await db.select().from(events).where(eq(events.fundId, fund.id));
    for (const e of evts) {
      console.log(`event: "${(e as any).name}" date=${(e as any).eventDate} vol=$${(e as any).giftVolume} status=${(e as any).status} permanent=${(e as any).isPermanent}`);
    }

    const mems = await db.select().from(memoryEntries).where(eq(memoryEntries.fundId, fund.id)).orderBy(asc(memoryEntries.createdAt));
    console.log(`memories: ${mems.length} | first: ${mems[0]?.createdAt} type=${(mems[0] as any)?.type}`);
  }
  process.exit(0);
}

void main();
