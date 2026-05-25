-- Magic-link auth tokens for passwordless gifter sign-in.
-- Per project_recurring_gifting_without_password_spec.md (locked 2026-05-25).
-- Backs the team-audit conversion #1 experiment: drop password collection
-- from the gifter-recurring flow; replace with a magic-link welcome email
-- after Stripe checkout.session.completed.
--
-- Same hashed-token discipline as password_resets + email_verifications.
-- Raw token (32 random bytes hex) embedded in the email; SHA-256 hash
-- persisted here. A DB leak does not enable authentication.
--
-- Token lifecycle:
--   1. Created at request time (welcome email or re-login).
--   2. Embedded in email link as raw token; hash stored in DB.
--   3. Verified by /api/auth/magic-link/verify; raw token hashed and
--      looked up; usedAt set; session established.
--   4. Single-use; 15-minute TTL.
--   5. ON DELETE CASCADE with users.id.

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  intent varchar(32) NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  request_ip text,
  request_user_agent text,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS magic_link_tokens_token_hash_unique ON magic_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS magic_link_tokens_user_id_idx ON magic_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS magic_link_tokens_expires_at_idx ON magic_link_tokens(expires_at);
