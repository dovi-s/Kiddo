-- 0049: composite indexes on activities (user_id/fund_id, created_at) — 2026-06-24.
--
-- The activity feed query is "WHERE user_id = ? (or fund_id = ?) ORDER BY created_at
-- DESC LIMIT n". The old single-column indexes (activities_user_id_idx /
-- activities_fund_id_idx) matched the WHERE but forced Postgres to SORT every matched
-- row by created_at — the ~5s, all-skeleton Activity feed on a heavy account. These
-- composite indexes turn it into a pure index scan; the leftmost prefix still covers
-- the bare user_id / fund_id lookups, so they replace the single-column ones cleanly.
-- IF NOT EXISTS / IF EXISTS so a re-run (or a dev DB already synced via db:push) is a
-- safe no-op.

CREATE INDEX IF NOT EXISTS "activities_user_created_idx" ON "activities" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_fund_created_idx" ON "activities" ("fund_id","created_at");
--> statement-breakpoint
DROP INDEX IF EXISTS "activities_user_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "activities_fund_id_idx";
