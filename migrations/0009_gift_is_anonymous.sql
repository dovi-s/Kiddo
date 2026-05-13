-- Add explicit is_anonymous flag to gifts. Replaces the previous
-- string-matching pattern (sender_name = 'Anonymous' OR ILIKE
-- 'someone who loves%') with a real boolean field.
--
-- Why this matters: the older inferred pattern leaked anonymous
-- gifts into the public "who's already given" social-proof carousel
-- as "Someone" with avatar "S" — visible to all family members
-- viewing the gift link. That violated the gifter's anonymous intent.
-- See feedback_anonymous_as_explicit_flag.md (locked memory) for the
-- standing principle.
--
-- Backfill is intentionally inclusive: any existing row whose
-- sender_name matches the legacy fallback strings (Anonymous /
-- "Someone who loves...") gets is_anonymous=true. Forward-only;
-- we don't try to recover originally-named gifts that lost their
-- name through some other path.

ALTER TABLE gifts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

UPDATE gifts
SET is_anonymous = true
WHERE is_anonymous = false
  AND (
    sender_name ILIKE 'anonymous'
    OR sender_name ILIKE 'someone who loves%'
  );
