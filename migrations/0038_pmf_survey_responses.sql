-- PMF (Sean Ellis) survey responses, moved off the .local/*.jsonl file onto
-- Postgres. The JSONL lived on container disk, so on an ephemeral/redeployed
-- host the responses vanished while survey emails kept going out — the panel
-- would silently read empty forever. This table is the durable backing store.
--
-- "Latest response per email wins" (a respondent can change their mind), so the
-- admin aggregation reads DISTINCT ON (lower(email)) ORDER BY created_at DESC.
-- Indexes cover that (email) + the recent-notes scan (created_at).

CREATE TABLE IF NOT EXISTS pmf_survey_responses (
  id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  response       TEXT NOT NULL,        -- vd | sd | nd
  response_label TEXT,
  note           TEXT,
  ip             TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pmf_survey_responses_email_idx ON pmf_survey_responses(LOWER(email));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pmf_survey_responses_created_idx ON pmf_survey_responses(created_at);
