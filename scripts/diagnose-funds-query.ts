// Diagnostic — runs Drizzle SELECTs against every table the failing
// dashboard-summary / memory / thank-yous / large-gift-holds / gifts
// endpoints touch. Captures whatever PostgreSQL error comes back.
// Output to .local/funds-diagnose.txt.

import "../server/env";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";
import { writeFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";

const { Pool } = pg;
const OUT = join(process.cwd(), ".local", "funds-diagnose.txt");

function log(line: string) {
  console.log(line);
  try {
    appendFileSync(OUT, line + "\n");
  } catch {}
}

async function main() {
  try { mkdirSync(join(process.cwd(), ".local"), { recursive: true }); } catch {}
  writeFileSync(OUT, `=== diagnose run @ ${new Date().toISOString()} ===\n`);

  if (!process.env.DATABASE_URL) { log("ERROR: DATABASE_URL not set."); process.exit(1); }

  const pool = new Pool({
    connectionString: (() => {
      try { const url = new URL(process.env.DATABASE_URL!); url.searchParams.delete("sslmode"); return url.toString(); }
      catch { return process.env.DATABASE_URL!; }
    })(),
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", (e) => log(`POOL error: ${e.message}`));

  const db = drizzle(pool, { schema });

  const tables: Array<[string, any]> = [
    ["funds", schema.funds],
    ["fundMemberships", (schema as any).fundMemberships],
    ["subscriptions", schema.subscriptions],
    ["holdings", schema.holdings],
    ["gifts", schema.gifts],
    ["events", schema.events],
    ["fundSnapshots", schema.fundSnapshots],
    ["recurringGifts", (schema as any).recurringGifts],
    ["parentContributions", (schema as any).parentContributions],
    ["transactions", schema.transactions],
    ["memoryEntries", schema.memoryEntries],
  ];

  for (const [name, table] of tables) {
    log(`\n--- ${name} ---`);
    if (!table) { log(`  schema export missing — skip`); continue; }
    try {
      const rows = await db.select().from(table).limit(1);
      log(`  OK — ${rows.length} row, keys: ${rows[0] ? Object.keys(rows[0]).slice(0, 6).join(", ") + "..." : "(no rows)"}`);
    } catch (err: any) {
      log(`  FAILED: ${err?.message ?? String(err)}`);
      if (err?.code) log(`    code: ${err.code}`);
      if (err?.query) log(`    query: ${String(err.query).slice(0, 300)}`);
      if (err?.cause?.message) log(`    cause: ${err.cause.message}`);
    }
  }

  await pool.end();
  log("\n--- done ---");
}

main().catch((e) => { log(`top-level: ${e?.message ?? String(e)}`); process.exit(1); });
