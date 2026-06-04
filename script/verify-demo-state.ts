// One-shot demo-state verification (post-reseed sanity check, 2026-06-03).
// Prints per-fund counts the worn-demo work depends on: gifts, thank-yous
// (sent vs draft), memory entries, plus the pinned-meta file contents.
// Read-only. Run: npx tsx script/verify-demo-state.ts
import "../server/env";
import { db, pool } from "../server/db";
import { users, funds, gifts, thankYous, memoryEntries } from "../shared/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { promises as fsp } from "node:fs";
import path from "node:path";

async function main() {
  const demoUsers = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.isDemoAccount, true));
  const ids = demoUsers.map((u) => u.id);
  const demoFunds = await db.select({ id: funds.id, name: funds.name, userId: funds.userId, transferredAt: funds.transferredAt })
    .from(funds).where(inArray(funds.userId, ids));
  console.log(`demo users: ${demoUsers.length} · demo funds: ${demoFunds.length}`);
  for (const f of demoFunds) {
    const [g] = await db.select({ n: sql<number>`count(*)` }).from(gifts).where(eq(gifts.fundId, f.id));
    const [tySent] = await db.select({ n: sql<number>`count(*)` }).from(thankYous).where(sql`${thankYous.fundId} = ${f.id} and ${thankYous.status} = 'sent'`);
    const [tyOther] = await db.select({ n: sql<number>`count(*)` }).from(thankYous).where(sql`${thankYous.fundId} = ${f.id} and ${thankYous.status} <> 'sent'`);
    const [m] = await db.select({ n: sql<number>`count(*)` }).from(memoryEntries).where(eq(memoryEntries.fundId, f.id));
    console.log(`  ${f.name}${f.transferredAt ? " (handed off)" : ""}: gifts=${g.n} thankYous(sent)=${tySent.n} thankYous(other)=${tyOther.n} memories=${m.n}`);
  }
  try {
    const meta = JSON.parse(await fsp.readFile(path.join(process.cwd(), ".local", "memory-entry-meta.json"), "utf8"));
    const pinned = Object.values(meta).filter((m: any) => m?.isFeatured).length;
    console.log(`pinned (isFeatured) entries in .local meta: ${pinned}`);
    // Cross-check the pinned ids actually exist as memory entries post-reseed
    const pinnedIds = Object.entries(meta).filter(([, m]: any) => m?.isFeatured).map(([id]) => id);
    if (pinnedIds.length > 0) {
      const [live] = await db.select({ n: sql<number>`count(*)` }).from(memoryEntries).where(inArray(memoryEntries.id, pinnedIds));
      console.log(`pinned ids resolving to live memory entries: ${live.n}/${pinnedIds.length}`);
    }
  } catch (e: any) {
    console.log(`pinned meta: unreadable (${e?.message})`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
