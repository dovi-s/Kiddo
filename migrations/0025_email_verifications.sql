-- Migration: email verification flow.
--
-- Adds users.email_verified_at (NULL until the user clicks the
-- verification link) and a new email_verifications table holding the
-- single-use tokens.
--
-- Grandfathering: existing accounts that registered before this flow
-- shipped get email_verified_at = NULL by default. Application code
-- treats NULL as "unverified" for new signups but the Dashboard
-- banner is gated on createdAt > (this migration's apply time) so
-- existing users aren't bothered.
--
-- Token shape matches password_resets: 32-byte raw token, SHA-256
-- hashed for storage. TTL is 7 days (longer than password reset
-- because verification is "I'll get to it" while reset is "I want
-- in NOW").

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS email_verifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_verifications_token_hash_unique
  ON email_verifications (token_hash);

CREATE INDEX IF NOT EXISTS email_verifications_user_id_idx
  ON email_verifications (user_id);

CREATE INDEX IF NOT EXISTS email_verifications_expires_at_idx
  ON email_verifications (expires_at);
