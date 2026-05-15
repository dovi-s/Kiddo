-- Track per-feature dismissals of the FeatureWallModal contextual
-- upgrade UI per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md.
--
-- Shape: { [featureId: string]: <ISO timestamp> } — recording the
-- last time the user dismissed each feature wall. Read by the
-- modal to switch between the rich first-time explainer copy and
-- the softer repeat-encounter copy.
--
-- Mirrors the funds.dismissed_nudges pattern (per-feature, per-row,
-- timestamp-keyed JSONB map). NULL on accounts that have never
-- seen a wall.
--
-- Forward-only. Pre-migration accounts default to NULL → treated
-- as "never dismissed" → first-time copy on first encounter.

ALTER TABLE users ADD COLUMN IF NOT EXISTS dismissed_feature_walls JSONB;
