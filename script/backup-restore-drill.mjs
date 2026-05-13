// Monthly backup-health drill — see policies/backup-and-recovery.md §4.
//
// What this does:
//   - Connects to the production DATABASE_URL (read-only operations).
//   - Counts rows in every table.
//   - Captures size estimates per table.
//   - Writes the snapshot to .local/backup-drill-YYYY-MM-DD.json.
//   - Compares against the previous month's drill if one exists.
//
// What this does NOT do:
//   - It does NOT exercise an actual restore-from-backup. That's the
//     quarterly drill described in the policy §4 "Quarterly: full
//     restore drill" subsection. This script proves the production
//     pool is healthy and queryable; quarterly drills prove the
//     backups themselves restore.
//
// Usage:
//   npm run backup:drill
//
// The drill file is committed to the repo as audit evidence.
// See policies/backup-and-recovery.md §4 for the comparison procedure.

import { config } from "dotenv";
import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";

config({ path: ".env", quiet: true });
config({ path: ".env.example", override: false, quiet: true });

const url = String(process.env.DATABASE_URL || "").trim();
if (!url) {
  console.error("[backup-drill] DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

async function main() {
  const startedAt = new Date();
  console.log(`[backup-drill] starting at ${startedAt.toISOString()}`);

  // List tables in the public schema. Excludes sequence/index/etc.
  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tableNames = tablesResult.rows.map((r) => r.table_name);
  console.log(`[backup-drill] found ${tableNames.length} tables`);

  const snapshot = {
    drillType: "monthly_count_drill",
    drilledAt: startedAt.toISOString(),
    databaseUrlHost: maskHost(url),
    tables: {},
    totals: { tableCount: tableNames.length, rowCountSum: 0 },
    elapsed_ms: 0,
  };

  for (const table of tableNames) {
    try {
      const rowCountResult = await pool.query(`SELECT COUNT(*)::bigint AS n FROM "${table}"`);
      const rowCount = Number(rowCountResult.rows[0]?.n || 0);

      // pg_total_relation_size includes indexes + toast.
      const sizeResult = await pool.query(`SELECT pg_total_relation_size($1)::bigint AS bytes`, [`"${table}"`]);
      const sizeBytes = Number(sizeResult.rows[0]?.bytes || 0);

      snapshot.tables[table] = { rowCount, sizeBytes };
      snapshot.totals.rowCountSum += rowCount;
      console.log(`  ${table.padEnd(35)} ${String(rowCount).padStart(12)} rows  ${formatBytes(sizeBytes).padStart(10)}`);
    } catch (e) {
      snapshot.tables[table] = { error: e.message };
      console.warn(`  ${table.padEnd(35)} ERROR: ${e.message}`);
    }
  }

  snapshot.elapsed_ms = Date.now() - startedAt.getTime();

  // Compare against the most recent prior drill, if any.
  // Drill files live under incidents/ so they're committed as audit
  // evidence per policies/backup-and-recovery.md §4.
  const drillDir = path.join("incidents", "restore-drills");
  await fs.mkdir(drillDir, { recursive: true });
  const dateStamp = startedAt.toISOString().slice(0, 10);
  const outPath = path.join(drillDir, `${dateStamp}.json`);

  const priorDrill = await findMostRecentPriorDrill(drillDir);
  if (priorDrill) {
    snapshot.comparison = compareSnapshots(priorDrill.snapshot, snapshot);
    console.log(`\n[backup-drill] compared against ${priorDrill.fileName}:`);
    if (snapshot.comparison.tablesAdded.length > 0) {
      console.log(`  + ${snapshot.comparison.tablesAdded.length} table(s) added: ${snapshot.comparison.tablesAdded.join(", ")}`);
    }
    if (snapshot.comparison.tablesRemoved.length > 0) {
      console.log(`  ! ${snapshot.comparison.tablesRemoved.length} table(s) removed: ${snapshot.comparison.tablesRemoved.join(", ")}`);
    }
    if (snapshot.comparison.shrinkages.length > 0) {
      console.log(`  ! ${snapshot.comparison.shrinkages.length} table(s) shrunk:`);
      for (const s of snapshot.comparison.shrinkages) {
        console.log(`      ${s.table}: ${s.priorRows} → ${s.currentRows} (${s.delta})`);
      }
      console.log(`    NOTE: shrinkage may be legitimate (retention purge) or a sign of data loss. Investigate.`);
    } else {
      console.log(`  ✓ no shrinkage detected`);
    }
  } else {
    console.log(`[backup-drill] no prior drill to compare against (this is the first run).`);
  }

  await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`\n[backup-drill] wrote ${outPath} (${snapshot.totals.tableCount} tables, ${snapshot.totals.rowCountSum.toLocaleString()} total rows, ${snapshot.elapsed_ms}ms)`);
  console.log(`[backup-drill] commit this file per policies/backup-and-recovery.md §4`);
}

async function findMostRecentPriorDrill(drillDir) {
  try {
    const files = await fs.readdir(drillDir);
    const drillFiles = files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
    // Skip today's if already written; pick the most recent prior.
    const today = new Date().toISOString().slice(0, 10);
    for (const file of drillFiles) {
      const stamp = file.replace(/\.json$/, "");
      if (stamp >= today) continue;
      const content = await fs.readFile(path.join(drillDir, file), "utf8");
      try {
        return { fileName: file, snapshot: JSON.parse(content) };
      } catch {
        continue;
      }
    }
  } catch {
    // dir doesn't exist or unreadable
  }
  return null;
}

function compareSnapshots(prior, current) {
  const priorTables = new Set(Object.keys(prior.tables || {}));
  const currentTables = new Set(Object.keys(current.tables || {}));

  const tablesAdded = [...currentTables].filter((t) => !priorTables.has(t));
  const tablesRemoved = [...priorTables].filter((t) => !currentTables.has(t));

  const shrinkages = [];
  for (const table of currentTables) {
    if (!priorTables.has(table)) continue;
    const priorRows = Number(prior.tables[table]?.rowCount || 0);
    const currentRows = Number(current.tables[table]?.rowCount || 0);
    if (currentRows < priorRows) {
      shrinkages.push({
        table,
        priorRows,
        currentRows,
        delta: currentRows - priorRows,
      });
    }
  }

  return { tablesAdded, tablesRemoved, shrinkages };
}

function formatBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function maskHost(connectionString) {
  try {
    const u = new URL(connectionString);
    return u.hostname;
  } catch {
    return "(unparseable)";
  }
}

try {
  await main();
} finally {
  await pool.end().catch(() => {});
}
