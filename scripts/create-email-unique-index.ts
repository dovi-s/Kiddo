import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

(async () => {
  console.log("Creating users_email_lower_unique index...");
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email)) WHERE email IS NOT NULL
  `);
  const idx = await db.execute(sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'users_email_lower_unique'
  `);
  console.log("Index present:", (idx.rows as any[]).length > 0);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
