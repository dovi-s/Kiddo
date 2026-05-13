-- OAuth identity store, DB-backed.
--
-- Replaces the file-backed `.local/oauth-identities.json` store. The
-- old file mapped (provider, subject) → user_id and tracked the
-- inverse user_id → keys[] list. That worked but lost linkage data
-- if the process crashed mid-write, and the merge-duplicate-users
-- migration had no DB-level uniqueness guarantee to lean on.
--
-- This table is the canonical source going forward. On first boot
-- after this migration runs, the OAuth identity store module
-- one-shot-imports any pre-existing entries from the legacy JSON
-- file into this table. The file is kept on disk as a backup but
-- new writes go straight to the DB.
--
-- Idempotent — IF NOT EXISTS on every clause so re-running is a
-- no-op.

CREATE TABLE IF NOT EXISTS "oauth_identities" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "provider" text NOT NULL,
    "subject" text NOT NULL,
    "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "linked_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_identities_provider_subject_unique"
    ON "oauth_identities" ("provider", "subject");

CREATE INDEX IF NOT EXISTS "oauth_identities_user_id_idx"
    ON "oauth_identities" ("user_id");
