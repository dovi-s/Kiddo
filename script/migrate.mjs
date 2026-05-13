import { config } from "dotenv";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

config({ path: ".env", quiet: true });
config({ path: ".env.example", override: false, quiet: true });

function getConnectionString() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) {
    throw new Error("DATABASE_URL is missing from .env");
  }

  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return raw;
  }
}

async function main() {
  const connectionString = getConnectionString();
  const pool = new pg.Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "migrations" });
    console.log("Drizzle migrations applied.");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

void main();
