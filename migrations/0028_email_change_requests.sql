-- Migration: email_change_requests table.
--
-- Backs the email-change-with-confirmation flow (Tier 0 #3 from the
-- email strategy review). Closes the most common account-takeover
-- vector: changing an email without notifying the OLD address.
-- See shared/models/auth.ts emailChangeRequests for the lifecycle
-- comments.

CREATE TABLE IF NOT EXISTS email_change_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_email VARCHAR(254) NOT NULL,
  new_email VARCHAR(254) NOT NULL,
  confirm_token_hash VARCHAR(64) NOT NULL,
  revoke_token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP,
  revoked_at TIMESTAMP,
  request_ip TEXT,
  request_user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_change_requests_confirm_token_unique
  ON email_change_requests (confirm_token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS email_change_requests_revoke_token_unique
  ON email_change_requests (revoke_token_hash);

CREATE INDEX IF NOT EXISTS email_change_requests_user_id_idx
  ON email_change_requests (user_id);

CREATE INDEX IF NOT EXISTS email_change_requests_expires_at_idx
  ON email_change_requests (expires_at);
