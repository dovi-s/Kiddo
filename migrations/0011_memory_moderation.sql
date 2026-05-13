-- Memory Book moderation toggle (per-fund) + entry status column.
--
-- Product philosophy reminder (see project_child_safety_architecture.md
-- and the standing "no approval, parent controls" answer): the gift link
-- is private, so a pre-approval gate would just add friction to the
-- loop. The TOGGLE is for parents who want it; the DEFAULT stays open.
--
-- When fund.gifter_memory_moderation = true, gifter-submitted entries
-- land as status='pending_review' instead of 'published'. The parent
-- gets a tray to approve (flip to 'published') or delete. Parent-authored
-- entries are always 'published' — the toggle is gifter content only.
--
-- Forward-only. Existing rows get status='published' via the column
-- default, which preserves visibility for everything that pre-dates
-- this migration.

ALTER TABLE funds ADD COLUMN IF NOT EXISTS gifter_memory_moderation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

CREATE INDEX IF NOT EXISTS memory_entries_status_idx ON memory_entries (status);
