-- Migration: login_fingerprints table.
--
-- Backs the new-device sign-in alert email. On every successful
-- login, the server computes a fingerprint (SHA-256 of IP /24
-- prefix + UA family signature) and looks it up here for the
-- current user. First-time fingerprints fire an alert email and
-- get inserted; subsequent logins from the same fingerprint
-- update last_seen_at silently.
--
-- The /24 IP grouping and UA family signature are deliberately
-- coarse — they avoid alerting on every Wi-Fi network change,
-- mobile cell tower hop, or browser auto-update. The trade-off
-- is that two different laptops on the same home network with
-- the same browser version share a fingerprint, but the alert
-- email's purpose is "did someone NEW sign in?" and a co-parent
-- already-authenticated-on-the-same-network isn't that signal.

CREATE TABLE IF NOT EXISTS login_fingerprints (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint VARCHAR(64) NOT NULL,
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  first_seen_ip TEXT,
  first_seen_user_agent TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS login_fingerprints_user_fingerprint_unique
  ON login_fingerprints (user_id, fingerprint);

CREATE INDEX IF NOT EXISTS login_fingerprints_user_id_idx
  ON login_fingerprints (user_id);
