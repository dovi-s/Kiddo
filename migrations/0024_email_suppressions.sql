-- Migration: email_suppressions table.
--
-- Backs the bounce/complaint webhook handler at
-- server/postmarkWebhook.ts. When a recipient hard-bounces or files
-- a spam complaint, the ESP fires a webhook into Kiddo; the
-- handler writes a row here. sendEmail() reads this list before
-- every send and silently skips any suppressed address.
--
-- Why suppress on the Kiddo side at all (vs trusting Postmark's
-- own suppressions): the ESP suppression catches deliveries through
-- THAT ESP. If we ever fail over to the SendGrid backup, the
-- Postmark-side suppressions don't apply. Storing the suppression
-- locally keeps it provider-agnostic.
--
-- Reason values (controlled vocabulary, not an enum because the
-- list may grow):
--   hard_bounce      - mailbox does not exist or domain unroutable
--   spam_complaint   - recipient clicked spam in their mail client
--   manual           - support added the entry by hand
--
-- source values:
--   postmark | sendgrid | manual
--
-- Unique on (email, reason) so re-firing the same bounce doesn't
-- create duplicate rows. A separate spam_complaint after an earlier
-- hard_bounce still records as its own row (different reason).

CREATE TABLE IF NOT EXISTS email_suppressions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  reason VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL,
  payload JSONB,
  suppressed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  unsuppressed_at TIMESTAMP,
  unsuppressed_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS email_suppressions_email_reason_unique
  ON email_suppressions (email, reason);

CREATE INDEX IF NOT EXISTS email_suppressions_email_idx
  ON email_suppressions (email);

CREATE INDEX IF NOT EXISTS email_suppressions_suppressed_at_idx
  ON email_suppressions (suppressed_at);
