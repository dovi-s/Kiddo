-- Migration: password_resets table.
--
-- Closes the long-standing forgot-password TODO at server/auth.ts:1273
-- (was logging the reset request to console but never sending an
-- email, never minting a token, never storing anything). This table
-- holds the issued reset tokens (as SHA-256 hashes so a DB leak
-- doesn't enable resets) with a 60-minute expiry.
--
-- Schema mirrors shared/models/auth.ts passwordResets.
--
-- Indexes:
--   - token_hash unique: every reset link is single-use; the unique
--     constraint catches the unlikely-but-possible collision and
--     prevents a token being valid for two users at once.
--   - user_id: cleanup queries (revoke-all-tokens-on-password-change)
--     filter on user_id.
--   - expires_at: lets a periodic worker prune expired rows cheaply
--     (`DELETE FROM password_resets WHERE expires_at < NOW()` is
--     index-bound).

CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  request_ip TEXT,
  request_user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token_hash_unique
  ON password_resets (token_hash);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx
  ON password_resets (user_id);

CREATE INDEX IF NOT EXISTS password_resets_expires_at_idx
  ON password_resets (expires_at);
