-- C3 (data-privacy audit 2026-06-09): ephemeral store so child Memory Book media
-- URLs do not ride in Stripe checkout metadata. The gift-checkout path writes a
-- row keyed by an opaque token, passes only the token through Stripe, and the
-- webhook hydrates the URLs back. Rows are read at webhook time and swept later.
-- Idempotent so re-running is safe.
CREATE TABLE IF NOT EXISTS pending_gift_media (
  token       varchar PRIMARY KEY,
  photo_url   text,
  video_url   text,
  audio_url   text,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- Sweep helper index for the TTL cleanup (delete rows older than a few days).
CREATE INDEX IF NOT EXISTS pending_gift_media_created_idx ON pending_gift_media (created_at);
