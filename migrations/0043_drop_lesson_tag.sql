-- Drop the orphaned lesson_tag column from the retired 8-tag gifter-lesson
-- system. Added in 0007, never read by any code path; the shared/gift-lessons.ts
-- module was deleted 2026-06-09. See feedback_structure_vs_behavior.md.
-- Idempotent: safe to re-run.
ALTER TABLE gifts DROP COLUMN IF EXISTS lesson_tag;
