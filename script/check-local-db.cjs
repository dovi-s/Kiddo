/* eslint-disable no-console */
require("dotenv").config({ path: ".env" });
const pg = require("pg");

const { Pool } = pg;

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
  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    const tables = await client.query(
      "select tablename from pg_tables where schemaname='public' and tablename in ('users','subscriptions','sessions') order by tablename",
    );
    console.log("Database connection: ok");
    console.log(`Host: ${new URL(connectionString).host}`);
    console.log(
      `Core tables: ${tables.rows.length ? tables.rows.map((row) => row.tablename).join(", ") : "none found"}`,
    );
    if (tables.rows.length < 3) {
      console.log("Next step: run `npm run db:migrate` to apply the checked-in schema.");
    }
    client.release();
  } catch (error) {
    console.error("Database connection: failed");
    console.error(`Reason: ${error?.code || error?.name || "unknown"} ${error?.message || ""}`.trim());
    console.error("Expected local default from .env.example: postgres://postgres:postgres@localhost:5432/kora");
    console.error("Fix one of these:");
    console.error("1. Install/start PostgreSQL locally and keep DATABASE_URL pointed at it.");
    console.error("2. Install Docker Desktop, then run `npm run db:up` and `npm run db:migrate`.");
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

void main();
