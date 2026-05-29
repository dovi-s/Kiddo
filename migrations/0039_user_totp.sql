-- Two-factor authentication (TOTP, RFC 6238) for parent accounts. Opt-in.
--
-- totp_pending_secret: unconfirmed base32 secret created at setup; promoted to
--   totp_secret only after the user verifies a live code (so a half-finished
--   setup never enables 2FA).
-- totp_secret: the confirmed base32 secret used to verify login codes.
-- totp_enabled: gates the login second factor.
-- totp_backup_codes: JSON array of bcrypt-hashed, single-use recovery codes.
--
-- Additive + idempotent. Non-enrolled users (everyone today) are unaffected:
-- totp_enabled defaults false and the login path only branches when true.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_pending_secret" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_backup_codes" jsonb;
