-- "Request a company" intake — the escape hatch off the curated stock picker.
-- When a gifter/parent doesn't see the brand they want, they can request it.
-- Routed to status 'escape_hatch_requested' and reviewed MANUALLY (a founder
-- decides whether to add it + wire its logo/quote/explainer metadata) — never
-- auto-added to the offered universe (that would turn a self-directed menu into
-- a moving target; see project_stock_curation_liability). Innocuous data: a
-- typed company name + optional contact. Mirrors pmf_survey_responses (0038).

CREATE TABLE IF NOT EXISTS stock_requests (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_text  TEXT NOT NULL,                                   -- the company/ticker the requester typed
  status          TEXT NOT NULL DEFAULT 'escape_hatch_requested', -- manual-review bucket
  fund_id         VARCHAR,                                          -- context: which fund's gift page (nullable)
  event_id        VARCHAR,                                          -- context: which occasion (nullable)
  requester_email TEXT,                                             -- optional, only if they want a heads-up
  ip              TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stock_requests_status_idx ON stock_requests(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stock_requests_created_idx ON stock_requests(created_at);
