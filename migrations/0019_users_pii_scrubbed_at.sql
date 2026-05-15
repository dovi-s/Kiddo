-- Migration: pii_scrubbed_at column for the account-deletion PII scrub worker.
--
-- App Store guideline 5.1.1(v) requires in-app account deletion to result in
-- actual deletion of personal information. The Kora flow goes in two phases:
--
--   Phase 1 (immediate, performAccountDeletion in server/auth.ts):
--     - Soft-deletes the user (users.deletedAt = NOW)
--     - Cancels Stripe subscriptions
--     - Cancels recurring parent_contributions
--     - Deletes linked bank_accounts
--     - Revokes pending outbound co-parent invitations
--     - Hard-deletes the user's collaborator rows on OTHER funds
--     - Transfers owned funds to accepted co-admins (Ring B)
--     - Sends confirmation + restore-link email
--
--   Phase 2 (delayed 30 days, server/accountDeletionWorker.ts — Ring C2):
--     - Anonymizes first_name / last_name / preferred_name / profile_image_url
--     - Anonymizes email (so the row can stay for foreign-key integrity)
--     - Deletes the user's Stripe Customer object
--     - Calls Plaid /item/remove for any remaining Item references
--     - Anonymizes Memory Book authorship to "Former gifter"
--     - Stamps pii_scrubbed_at = NOW so the worker doesn't re-process
--
-- This column is the worker's idempotency anchor. The worker picks up users
-- where deleted_at < NOW() - 30 days AND pii_scrubbed_at IS NULL. Once it
-- successfully completes the scrub, it sets pii_scrubbed_at = NOW and the
-- user falls out of the worker's query set.
--
-- See: server/accountRestoreToken.ts (cryptographic restore-token system),
-- server/accountDeletionWorker.ts (the worker itself, ships in Ring C2).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pii_scrubbed_at TIMESTAMP NULL;

-- Partial index over the worker's eligibility set. Targets users whose
-- deletion is more than 30 days old AND haven't been scrubbed yet. The
-- partial-where clause keeps the index small (only soft-deleted users
-- count) and skips the active-user fast path entirely. The worker
-- query plan is essentially "scan this small index, do the scrub."
CREATE INDEX IF NOT EXISTS idx_users_pii_scrub_due ON users (deleted_at)
  WHERE deleted_at IS NOT NULL AND pii_scrubbed_at IS NULL;
