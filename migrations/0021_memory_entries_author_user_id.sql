-- Migration: memory_entries.author_user_id column.
--
-- Closes the deferred gap from the account-deletion audit (Ring C3 in
-- the original spec). Memory Book entries carried author_name +
-- author_photo_url as denormalized strings with no foreign key back to
-- users. That meant the 30-day PII scrub worker couldn't identify
-- entries authored by the scrubbed user without a fragile name match
-- — so parent-authored Memory Book entries kept showing the deleted
-- user's name + photo forever.
--
-- This column gives the scrub worker a clean foreign-key anchor. On
-- scrub, the worker finds entries with author_user_id = deletedUserId
-- and anonymizes:
--
--   author_name      → "Former gifter"
--   author_photo_url → NULL
--
-- Content, photos, videos, and voice notes stay. Per the locked
-- Memory Book retention principle: the entries belong to the kid,
-- not to the parent's account. The kid at 18 still sees the message,
-- the photo, the voice — just without the original author's name
-- attached.
--
-- NULL on every existing row. Backfill is intentionally NOT done
-- because:
--   1. Gifter-authored entries (the majority) genuinely have no
--      user account to point at.
--   2. Old parent-authored entries can't be reliably matched by
--      name without false positives across users with the same
--      first name in different families.
--   3. The scrub worker's anonymization is one-way and irreversible.
--      Better to under-match than over-match. New entries written
--      AFTER this migration will carry the column correctly.
--
-- See: server/routes.ts POST /api/funds/:fundId/memory (the
-- canonical parent-authored entry path) — populates author_user_id
-- from req.user.id starting 2026-05-15.

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS author_user_id VARCHAR REFERENCES users(id);

-- Partial index over the scrub worker's query path. The worker looks
-- up entries by author_user_id; non-null filter keeps the index small
-- (the typical entry has author_user_id = null because gifter-authored
-- is the common case).
CREATE INDEX IF NOT EXISTS idx_memory_entries_author_user_id ON memory_entries (author_user_id)
  WHERE author_user_id IS NOT NULL;
