import "../server/env";
import { db } from "../server/db";
import { memoryEntries, funds } from "../shared/schema";
import { and, eq } from "drizzle-orm";

const [theo] = await db.select().from(funds).where(eq(funds.slug, "theo-rivera"));
console.log("theo fund:", theo?.id);
const rows = await db.select().from(memoryEntries).where(and(eq(memoryEntries.fundId, theo.id), eq(memoryEntries.type, "parent_note")));
for (const r of rows) {
  console.log(JSON.stringify({ content: String(r.content).slice(0, 34), photoUrl: r.photoUrl, visibility: r.visibility, authorName: r.authorName }));
}
process.exit(0);
