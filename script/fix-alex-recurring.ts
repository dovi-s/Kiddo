// One-off: activate the demo Nora's recurring (was seeded "paused" by mistake —
// a fund 30 days BEFORE the handoff is still actively funding; the worker only
// auto-pauses AT majority). Targets ONLY slug "nora-rivera" so no real fund is
// touched. The seed file is already fixed; this brings the current demo DB into
// line without a full ~75-min re-seed. 2026-06-04.
import "../server/env";
import { db, pool } from "../server/db";
import { funds, parentContributions } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [alex] = await db.select().from(funds).where(eq(funds.slug, "nora-rivera"));
  if (!alex) {
    console.log("No nora-rivera fund found — nothing to do.");
    return;
  }
  const contribs = await db.select().from(parentContributions).where(eq(parentContributions.fundId, alex.id));
  let changed = 0;
  for (const c of contribs) {
    // Only flip a non-handoff pause (a pre-majority fund should never be
    // handoff-paused; guard anyway so we never resurrect a true handoff stop).
    if (c.status === "paused" && c.pauseReason !== "majority_handoff") {
      const next = new Date();
      next.setDate(next.getDate() + 14);
      await db.update(parentContributions)
        .set({ status: "active", pauseReason: null, pausedAt: null, nextRunDate: next } as any)
        .where(eq(parentContributions.id, c.id));
      changed++;
      console.log(`Activated recurring ${c.id} ($${c.amount}/mo) on Nora's fund ${alex.id}.`);
    }
  }
  if (!changed) console.log("Nora's recurring was already active (or handoff-ended) — no change.");
}

main()
  .then(async () => { await pool.end().catch(() => {}); process.exit(0); })
  .catch(async (e) => { console.error(e); await pool.end().catch(() => {}); process.exit(1); });
