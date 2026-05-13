-- Migration: user account deletion columns
--
-- App Store guideline 5.1.1(v) requires in-app account deletion for any
-- app that creates accounts. Kora's in-app deletion flow is gated on these
-- two new columns:
--
--   deletedAt          timestamp set to NOW() when user initiates deletion.
--                      Used by isAuthenticated middleware to reject sessions,
--                      by the (future) 30-day PII-scrub worker to know when
--                      to purge, and by the audit log to mark soft-deleted
--                      records.
--   deletion_reason    optional free-text from the deletion-modal "anything
--                      you'd like us to know?" field. Capped at 500 chars
--                      client-side. Helps with churn analysis.
--
-- Both nullable, no defaults. Pre-existing users get NULL (= active).
--
-- See: server/auth.ts (handlers + helpers), client/src/components/DeleteAccountModal.tsx,
-- project_account_deletion_spec.md, MEMORY.md → Account deletion entry.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

-- Index for the 30-day PII-scrub worker that periodically picks up
-- users whose deletedAt is more than 30 days old and needs anonymizing.
-- Skipped today's worker implementation; index ready when it ships.
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;
