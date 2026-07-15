// One-off repair: rewrite .local/memory-entry-meta.json demo pins from the
// LIVE DB using the same rule the seed now applies (2026-06-03): per demo
// fund, pin the OLDEST external gift entry + the NEWEST voice-note entry.
// Prunes orphaned keys (entry ids no longer in the DB — each reseed mints new
// ids) and de-pins prior demo over-pins; leaves live non-demo keys untouched.
// Safe to re-run. Run: npx tsx script/repair-demo-pins.ts
// (The dev server caches this file in-process — restart it after running.)
import "../server/env";
import { db, pool } from "../server/db";
import { users, funds, gifts, memoryEntries } from "../shared/schema";
import { eq, inArray, and, isNull, asc, desc, isNotNull, sql } from "drizzle-orm";
import { promises as fsp } from "node:fs";
import path from "node:path";

async function main() {
  const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.isDemoAccount, true));
  const demoFunds = await db.select({ id: funds.id, name: funds.name }).from(funds)
    .where(inArray(funds.userId, demoUsers.map((u) => u.id)));
  const demoFundIds = demoFunds.map((f) => f.id);

  const pins: string[] = [];
  for (const f of demoFunds) {
    // Oldest EXTERNAL gift entry: gift_message whose gift is neither a parent
    // recurring cycle (parentContributionId null) nor Marcus's own one-time
    // (sender email != phil's). NB: memory_entries has no authorRole column —
    // the seed passes one via `as any` and Postgres silently drops it.
    const [oldest] = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .innerJoin(gifts, eq(memoryEntries.giftId, gifts.id))
      .where(and(
        eq(memoryEntries.fundId, f.id),
        eq(memoryEntries.type, "gift_message"),
        isNull(gifts.parentContributionId),
        sql`coalesce(${gifts.senderEmail}, '') <> 'marcus@riverafamily.com'`,
      ))
      .orderBy(asc(memoryEntries.createdAt))
      .limit(1);
    if (oldest) pins.push(oldest.id);
    // Newest voice-note entry (audio attached or transcript-only).
    const [newestAudio] = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.fundId, f.id),
        eq(memoryEntries.type, "gift_message"),
        isNotNull(memoryEntries.audioTranscript),
      ))
      .orderBy(desc(memoryEntries.createdAt))
      .limit(1);
    if (newestAudio && newestAudio.id !== oldest?.id) pins.push(newestAudio.id);
    console.log(`${f.name}: pin oldest=${oldest?.id ?? "none"} audio=${newestAudio?.id ?? "none"}`);
  }

  const metaPath = path.join(process.cwd(), ".local", "memory-entry-meta.json");
  let store: Record<string, { visibility?: string; isFeatured?: boolean }> = {};
  try { store = JSON.parse((await fsp.readFile(metaPath, "utf8")) || "{}") || {}; } catch { store = {}; }

  // Prune: drop orphaned keys (id not in DB) and de-pin demo-fund entries
  // that aren't in the new pin set.
  const keys = Object.keys(store);
  const liveRows = keys.length
    ? await db.select({ id: memoryEntries.id, fundId: memoryEntries.fundId })
        .from(memoryEntries).where(inArray(memoryEntries.id, keys))
    : [];
  const liveById = new Map(liveRows.map((r) => [r.id, r.fundId]));
  const demoSet = new Set(demoFundIds);
  const pinSet = new Set(pins);
  let pruned = 0, depinned = 0;
  for (const key of keys) {
    const fundId = liveById.get(key);
    if (!fundId) { delete store[key]; pruned++; continue; }
    if (demoSet.has(String(fundId)) && !pinSet.has(key)) { delete store[key]; depinned++; }
  }
  for (const id of pins) store[id] = { visibility: "public", isFeatured: true };
  await fsp.mkdir(path.dirname(metaPath), { recursive: true });
  await fsp.writeFile(metaPath, JSON.stringify(store, null, 2), "utf8");
  console.log(`meta rewritten: ${pins.length} pins · pruned ${pruned} orphans · de-pinned ${depinned} demo over-pins · ${Object.keys(store).length} keys total`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
