/* eslint-disable no-console */
import "dotenv/config";
import pg from "pg";
import { getGiftReconciliationRepairPreview, runGiftReconciliationRepair } from "./gift-reconciliation-repair-lib";

const { Pool } = pg;

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  });

  try {
    const preview = await getGiftReconciliationRepairPreview(pool);

    console.log("Gift Reconciliation Repair Preview");
    console.log(JSON.stringify(preview, null, 2));

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to execute repairs.");
      return;
    }

    const applied = await runGiftReconciliationRepair(pool);

    console.log("Gift Reconciliation Repair Applied");
    console.log(JSON.stringify(applied, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Repair failed:", err?.message || err);
  process.exit(1);
});
