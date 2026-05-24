-- Migration: memory_entries.parent_sealed_series_id — series grouping
-- for recurring sealed letters (Prong B Phase 5).
--
-- Per project_sealed_letters_implementation_plan.md Phase 5 (locked
-- 2026-05-23). When a parent picks "Repeat yearly" on a scheduled
-- sealed letter, the server generates one entry per year from the
-- chosen start date through the kid's 18th birthday — each entry has
-- its own deliver_at (year-by-year) and they all share a
-- parent_sealed_series_id so the parent can cancel the whole series
-- with one click.
--
-- Example: parent writes a letter on Jan 1, 2026, sets it for
-- "every Mother's Day, yearly, for Emma (age 3)." Server creates
-- 15 entries (Mother's Day 2026 → Mother's Day 2040 when Emma is 17)
-- all sharing the same series_id. Cancelling the series cancels all
-- 15. Cancelling one entry only cancels that year's delivery.
--
-- Schema discipline:
--   - Additive only. New nullable VARCHAR column.
--   - NULL on every existing row + on every NEW row that's a
--     one-shot (non-recurring) sealed letter. Only set on rows
--     that were generated as part of a recurring series.
--   - Partial index for the cancel-series query path. Worker /
--     parent UI queries WHERE parent_sealed_series_id = X to
--     find all entries in a series.
--   - Series IDs are application-generated UUIDs (server uses
--     crypto.randomUUID() before the batch insert). No DB-side
--     constraint linking to a separate series table — the series
--     IS the set of rows sharing the ID; no extra table needed
--     for MVP. If future series-level metadata becomes load-bearing
--     (per-series schedule customization, per-series moderation
--     status, etc.) a separate `sealed_letter_series` table can
--     be added with FK from memory_entries.parent_sealed_series_id.

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS parent_sealed_series_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_memory_entries_sealed_series
  ON memory_entries (parent_sealed_series_id)
  WHERE parent_sealed_series_id IS NOT NULL;

COMMENT ON COLUMN memory_entries.parent_sealed_series_id IS 'Grouping ID for recurring sealed letters. NULL for one-shot sealed letters and for all non-sealed entries.';
