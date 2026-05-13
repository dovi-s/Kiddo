-- First-party server-side product analytics. See shared/schema.ts for
-- design notes (no third-party tracking, no kid data off-platform,
-- powers the admin /funnels surface).
--
-- Indexes are sized for the realistic query mix: most reads are
-- "events of name X in the last N days" or "events for fund Y";
-- both are covered by the (event_name, occurred_at) and (fund_id)
-- indexes respectively.

CREATE TABLE IF NOT EXISTS analytics_events (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   TEXT NOT NULL,
  occurred_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id      VARCHAR REFERENCES users(id),
  fund_id      VARCHAR REFERENCES funds(id),
  session_id   TEXT,
  source       TEXT,
  props        JSONB,
  ip_address   TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS analytics_events_name_idx       ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS analytics_events_occurred_idx   ON analytics_events(occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx       ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS analytics_events_fund_idx       ON analytics_events(fund_id);
