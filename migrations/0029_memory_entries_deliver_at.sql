-- Migration: memory_entries.deliver_at — arbitrary future-delivery dates
-- for sealed letters (Prong B Phase 1).
--
-- Per project_sealed_letters_implementation_plan.md (locked 2026-05-23).
--
-- The existing memory_entries.visibility column already supports
-- 'kid_now' (default, visible always), 'kid_at_18' (hidden until
-- majority), and 'parent_only' (never visible to kid). This migration
-- adds a NEW visibility value 'sealed' that's gated by an explicit
-- timestamp, not by the kid's age:
--
--   visibility='sealed' + deliver_at='2030-06-15T00:00:00Z'
--     → hidden from kid surfaces until June 15, 2030
--     → visible to the authoring parent always (with a "sealed
--       until {date}" indicator in the composer / parent view)
--
-- This is the foundation for Prong B's "sealed letters with future
-- delivery dates" Plus feature — parents can compose messages for
-- specific future moments (kid's 13th birthday, graduation day,
-- every Mother's Day, etc.) and have them surface to the kid
-- exactly when they should.
--
-- Schema discipline:
--   - Additive only. New nullable column; no default value.
--   - Existing entries (every row in the table at migration time)
--     have deliver_at = NULL. They are not 'sealed' visibility; the
--     deliver_at value is meaningless for them.
--   - 'sealed' visibility WITHOUT a deliver_at is invalid — server
--     validation rejects this at the insert path (see
--     project_sealed_letters_implementation_plan.md Phase 2).
--   - Partial index over deliver_at IS NOT NULL because the daily
--     "deliver today" worker (Phase 6) queries WHERE deliver_at IS
--     NOT NULL AND deliver_at <= NOW(); the vast majority of rows
--     stay NULL.
--
-- Visibility precedence in the kid-surface filter (Phase 2):
--   1. parent_only → never visible to kid
--   2. kid_at_18 → visible when kidAge >= 18 (existing logic;
--      deliver_at is ignored even if set)
--   3. sealed → visible when deliver_at <= NOW() AND deliver_at IS
--      NOT NULL (this migration; missing deliver_at means never
--      visible — safer than visible-by-default for sealed entries)
--   4. kid_now (default) → visible always
--
-- Parent view bypasses these rules — the parent can always see their
-- own sealed entries (with a "sealed until {date}" indicator) so they
-- can audit what they've scheduled. The kid surface honors the rules
-- strictly.

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS deliver_at TIMESTAMP;

-- Partial index over the daily "deliver-today" worker's query path.
-- The worker queries WHERE deliver_at IS NOT NULL AND deliver_at <=
-- NOW(); the NOT NULL filter keeps the index tiny (the vast majority
-- of memory_entries rows have deliver_at = NULL because they aren't
-- sealed-with-date entries).
CREATE INDEX IF NOT EXISTS idx_memory_entries_deliver_at ON memory_entries (deliver_at)
  WHERE deliver_at IS NOT NULL;

COMMENT ON COLUMN memory_entries.deliver_at IS 'Arbitrary future-delivery timestamp. Honored only when visibility = sealed. NULL on every other row.';
