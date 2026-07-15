-- 0050: push_subscriptions table for Web Push — 2026-07-01.
--
-- One row per browser/device that opted into OS-level push notifications. endpoint +
-- keys come from the browser PushManager.subscribe(); the server sends via web-push
-- (VAPID). endpoint is UNIQUE so re-subscribing the same device upserts instead of
-- duplicating. Rows are pruned on 404/410 at send time (dead endpoints).
--
-- Inline FK + IF NOT EXISTS so a re-run — or the dev DB, where this table was already
-- created via targeted SQL during the build — is a safe no-op.
-- ⚠️ After applying, run `npm run db:secure`: new Supabase tables default to RLS-off,
--    and this table holds device endpoints + crypto keys (must not be world-readable).

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id");
