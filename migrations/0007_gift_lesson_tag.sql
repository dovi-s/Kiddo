-- Add optional gifter-curated lesson tag to gifts. Catalog of valid
-- values lives in shared/gift-lessons.ts; server validates against the
-- catalog before insert/update.
--
-- Why a single column instead of a join table: the gifter picks
-- one lesson at most per gift (intentional — the Reddit threads show
-- the curriculum pattern is one-lesson-per-gift over time, not
-- multiple-lessons-per-gift in one shot). One column keeps the read
-- path trivial: every gift surface joins this column directly.

ALTER TABLE gifts ADD COLUMN IF NOT EXISTS lesson_tag VARCHAR(64);
