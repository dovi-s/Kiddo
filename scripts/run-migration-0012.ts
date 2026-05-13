import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

(async () => {
  console.log("Creating oauth_identities table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "oauth_identities" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "provider" text NOT NULL,
      "subject" text NOT NULL,
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "linked_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  console.log("Creating unique index on (provider, subject)...");
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "oauth_identities_provider_subject_unique"
    ON "oauth_identities" ("provider", "subject")
  `);

  console.log("Creating index on user_id...");
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "oauth_identities_user_id_idx"
    ON "oauth_identities" ("user_id")
  `);

  const exists = await db.execute(
    sql`SELECT to_regclass('public.oauth_identities') AS t`,
  );
  console.log("oauth_identities table:", (exists.rows as any[])[0]?.t || "(missing)");

  const n = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM oauth_identities`,
  );
  console.log("row count:", (n.rows as any[])[0]?.n);
  process.exit(0);
})().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
