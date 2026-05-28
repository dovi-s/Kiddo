-- Durable, cross-instance rate-limit counters. The in-memory Map limiter
-- (server/index.ts) only protects a single process; under a multi-instance
-- deploy each replica kept its own window, so the effective limit was N× the
-- intended cap. This fixed-window counter table is the shared backing store.
--
-- The limiter (server/rateLimiter.ts) fails OPEN to an in-memory fallback if
-- this table / the DB is unavailable, so a DB hiccup never blocks the request
-- path (auth / checkout / webhook / kid-view-unlock).
--
-- Fixed-window (not sliding): key = "rule:method:ip", window_start = the
-- bucket's epoch-ms start. Atomic increment via ON CONFLICT. Stale buckets are
-- swept by the limiter's throttled periodic cleanup; the window_start index
-- keeps that DELETE cheap.

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key          TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rate_limit_counters_window_idx ON rate_limit_counters(window_start);
