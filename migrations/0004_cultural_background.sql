-- Add cultural_background JSONB to funds table for cultural milestone suggestions
ALTER TABLE funds ADD COLUMN IF NOT EXISTS cultural_background jsonb;
