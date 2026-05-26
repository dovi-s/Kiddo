import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, timestamp, uniqueIndex, varchar, text } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  referralCode: varchar("referral_code", { length: 16 }).unique(),
  referredBy: varchar("referred_by").references((): any => users.id),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  preferredName: varchar("preferred_name", { length: 50 }),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  googleId: varchar("google_id").unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  // Test/dev account flag. When true, this user's contributions and memory
  // entries are filtered out of public-facing surfaces (KidView especially).
  // Catches the "testing", "qqqqq", "tstgin" leakage problem at the source —
  // a developer flagged once never has to worry about polluting Emma's view
  // again. Toggleable by admins; defaults false so production users are
  // unaffected.
  isTestUser: boolean("is_test_user").notNull().default(false),
  // Demo account flag for the public-facing shareable Dunphy demo at
  // /login (creds in DUNPHY_DEMO_SPEC.md). When true, the user is part
  // of the paper-trading demo experience: a banner renders on every
  // authenticated page, the seeded fund state is canonical and reset-
  // ready, and the account is meant to be shared publicly. Distinct
  // from is_test_user (dev-pollution flag) — demo accounts are
  // PRODUCTION-INTENDED and content is curated; test accounts are
  // dev-only and get filtered from public surfaces. Defaults false.
  isDemoAccount: boolean("is_demo_account").notNull().default(false),
  kycStatus: text("kyc_status").default("none"),
  kycSubmittedAt: timestamp("kyc_submitted_at"),
  kycData: jsonb("kyc_data"),
  // Account deletion (App Store 5.1.1(v) compliance). When the user
  // initiates in-app deletion: sessions invalidated immediately, Stripe
  // subscriptions canceled immediately, deletedAt set. PII anonymization
  // happens on a 30-day delay (matches the support-email grace period
  // for "undo deletion"). After 30 days, a worker scrubs first_name /
  // last_name / preferred_name / profile_image_url / phone (handled per-
  // surface; legal records / Memory Book entries are preserved). See
  // project_account_deletion_spec.md for the full decision matrix.
  deletedAt: timestamp("deleted_at"),
  deletionReason: text("deletion_reason"),
  // Set by the PII scrub worker (server/accountDeletionWorker.ts) the
  // first time it runs against a soft-deleted user whose grace period
  // has elapsed. After this is set, first_name / last_name /
  // preferred_name / profile_image_url / email are anonymized in
  // place + Stripe Customer object deleted + Plaid Items removed.
  // The user row itself stays (legal records keyed to its id must
  // persist) but contains no recoverable PII. NULL on accounts that
  // are still active OR still in the 30-day grace window.
  piiScrubbedAt: timestamp("pii_scrubbed_at"),
  // Post-handoff engagement loop. Bucket 3 of AGE_18_HANDOFF_SPEC.md.
  // Stamped each time the quarterly summary email goes out to a
  // kid-owner (i.e. a user who claimed a fund via age-transition).
  // Worker (`server/postHandoffEngagementWorker.ts`) reads this to
  // decide who's due — fires on Jan/Apr/Jul/Oct mid-month for owners
  // who haven't been emailed in the last 80 days AND whose first fund
  // was transferred >60 days ago.
  lastQuarterlySummaryAt: timestamp("last_quarterly_summary_at"),
  // Stamped once, when the 30-day post-handoff check-in email goes
  // out to a kid-owner. Distinct cadence from the quarterly summary:
  // this is a ONE-time "you've owned this for a month, here's how
  // it's been going" beat, fired ~30 days after the fund flipped to
  // accountType=Personal (the post-handoff state). Worker checks
  // for null + handoff age >=30 days <=60 days; sets to NOW() after
  // a successful send so it never re-fires. Per Tier-2 deferred
  // item #5; locked 2026-05-21.
  kidThirtyDayCheckInAt: timestamp("kid_thirty_day_check_in_at"),
  // Stamped the FIRST time a parent on Kiddo+ (starter/family) attaches
  // photo/video/voice to a parent-authored Memory Book entry. Drives a
  // one-time "your first photo just unlocked" celebration banner on
  // Dashboard so the Plus media upgrade gets its own moment instead of
  // landing silently. Set once, never reset — the celebration is keyed
  // to the row appearing within the last 7 days. Gifter-attached media
  // never sets this column (gifter media is free across all tiers; the
  // celebration is specifically the parent-side Plus differential
  // moment). Per Tier-2 deferred item #2; locked 2026-05-23.
  plusFirstMediaAt: timestamp("plus_first_media_at"),
  // Self-reported "I have a job" toggle set in the Age18Welcome
  // walkthrough screen 4. Drives the future Roth IRA setup nudge
  // (deferred from MVP until DriveWealth IRA support is wired). The
  // bracket is one of "0_45" | "45_100" | "100_plus" matching the
  // LTCG tax-rate buckets — used by the first-sell tax explainer.
  hasEarnedIncome: boolean("has_earned_income").notNull().default(false),
  estimatedIncomeBracket: text("estimated_income_bracket"),
  // Stamped the first time the user (kid-owner) confirms through the
  // first-sell tax explainer modal. After this is set, subsequent
  // sells skip the explainer auto-popup — they can still open it
  // from Settings or the per-sale receipt if they want a refresher.
  // Per AGE_18_HANDOFF_SPEC.md bucket 2.
  firstSellCompletedAt: timestamp("first_sell_completed_at"),
  // Roth IRA early-interest signal. Toggled by the placeholder
  // Settings card so when DriveWealth IRA integration ships, the
  // waiting-list ping can target these users first. Distinct from
  // hasEarnedIncome (the prereq); a kid with earned income can
  // still choose not to opt into Roth notifications.
  rothIraInterestAt: timestamp("roth_ira_interest_at"),
  // Trusted contact (FINRA Rule 4512). Someone Kiddo / DriveWealth /
  // Apex can contact when the account holder is unreachable, suspected
  // of financial exploitation, or where a guardian/executor identity
  // needs confirmation. Required by carrier-broker rules; doubles as
  // the right safety net for the kid-at-18 handoff failure path
  // (parent unreachable at the moment the kid claims their fund).
  // All fields are optional individually so a user can partial-fill;
  // the UI prompts to complete the row but doesn't hard-block save.
  // Name + (email OR phone) are the minimum useful combination.
  trustedContactName: text("trusted_contact_name"),
  trustedContactEmail: varchar("trusted_contact_email", { length: 254 }),
  trustedContactPhone: varchar("trusted_contact_phone", { length: 32 }),
  trustedContactRelation: varchar("trusted_contact_relation", { length: 50 }),
  trustedContactUpdatedAt: timestamp("trusted_contact_updated_at"),
  // Tracks per-feature dismissals of the contextual upgrade-wall
  // (FeatureWallModal). Shape: { [featureId]: ISO timestamp of last
  // dismissal }. Read by the modal to decide between the rich
  // first-time explainer and the softer repeat-encounter copy.
  // Per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md. Similar shape to
  // funds.dismissedNudges (also a JSONB key-value map of dismissal
  // timestamps). NULL on accounts that have never seen a wall.
  dismissedFeatureWalls: jsonb("dismissed_feature_walls"),
  // Email verification timestamp. Set when the user clicks the link
  // in the post-signup verification email. NULL on accounts that
  // registered before this flow shipped (2026-05-15) — those are
  // grandfathered as verified to avoid a punitive prompt for
  // existing users; new accounts must verify. Loop through new
  // user.emailVerifiedAt for the "verify your email" banner
  // condition on Dashboard. The verification token itself lives in
  // the separate email_verifications table.
  emailVerifiedAt: timestamp("email_verified_at"),
  // Per-category email opt-outs. Shape:
  //   { birthday?: false, anniversary?: false, milestones?: false,
  //     monthlyPulse?: false, volatility?: false, motherFathersDay?: false,
  //     taxPrep?: false, gifterReturn?: false, wrapped?: false }
  // Missing key = opted IN (the default). false = opted OUT. true is
  // accepted but redundant since opted-in is the default.
  //
  // Categories REQUIRED by law / security (password reset, email
  // verification, new device alert, large-gift alert, age-transition
  // emails, gift receipts, account deletion) are NOT in this map —
  // they're transactional and always send.
  //
  // The Settings UI surface that writes this lives at
  // /settings?tab=notifications → Email preferences section.
  emailPreferences: jsonb("email_preferences"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// OAuth identity mappings. One row per (provider, subject) pair the
// user has signed in with. Pre-existing parents may have multiple
// rows (Google + Apple) all pointing at the same user_id; the unique
// constraint is on the provider-subject tuple, NOT user_id.
//
// Why this lives in a DB table instead of the .local/oauth-identities
// .json file it used to live in: the file-backed store lost linkage
// data if the process crashed mid-write, and the merge-duplicate-users
// migration had no DB-level uniqueness guarantee to lean on. Moving
// here gives us ON DELETE CASCADE for clean user-removal and a single
// transactional truth source.
//
// The user_id column is ON DELETE CASCADE so deleting a user
// automatically cleans up their OAuth links — preferred to dangling
// rows that point at a deleted user.
export const oauthIdentities = pgTable("oauth_identities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("oauth_identities_provider_subject_unique").on(table.provider, table.subject),
  index("oauth_identities_user_id_idx").on(table.userId),
]);

export type OauthIdentity = typeof oauthIdentities.$inferSelect;

// Trusted devices for biometric unlock. Per FACE_ID_SPEC.md (formerly
// deferred item: "trusted devices panel"). Each row represents one
// device install where the user has enabled biometric unlock. Lets the
// user see + revoke biometric on a specific device from Settings, even
// if that device is lost or stolen.
//
// Device ID is generated by the mobile app at first biometric enable
// (random UUID stored in SecureStore so it persists across launches
// but resets on app reinstall — which is the right semantic). Device
// name comes from expo-device + user-editable later.
//
// Revocation lifecycle: setting revoked_at causes the next API call
// from that device to receive a 401 + signal to disable biometric
// locally. The biometric_enabled flag in the mobile app gets cleared,
// and the user is bounced back to password login.
export const trustedDevices = pgTable("trusted_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Stable per-install identifier generated by the mobile app.
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name"),
  platform: text("platform"), // "ios" | "android"
  biometricEnabledAt: timestamp("biometric_enabled_at").defaultNow().notNull(),
  lastUnlockedAt: timestamp("last_unlocked_at"),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  uniqueIndex("trusted_devices_user_device_unique").on(table.userId, table.deviceId),
  index("trusted_devices_user_id_idx").on(table.userId),
]);

export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertTrustedDevice = typeof trustedDevices.$inferInsert;

// Passkeys (WebAuthn credentials) for web login. Per FACE_ID_SPEC.md
// (formerly deferred item: "web passkeys / WebAuthn"). Each row is one
// registered passkey for a user — could be a platform authenticator
// (Face ID on Mac, Windows Hello, Touch ID) or a roaming authenticator
// (YubiKey, etc.).
//
// credential_id is the WebAuthn-assigned credential identifier (used
// to look up the right public key during authentication). public_key
// is the base64url-encoded COSE key. counter is the signature counter
// (incremented on each use; helps detect cloned authenticators).
export const passkeys = pgTable("passkeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // WebAuthn credential ID (base64url-encoded). Unique per credential
  // across all users — anyone with the credential ID can look up the
  // matching pubkey but cannot authenticate without the private key
  // held by the user's device.
  credentialId: text("credential_id").notNull().unique(),
  // COSE-encoded public key (base64url-encoded JSON). Used to verify
  // the signature in the WebAuthn assertion.
  publicKey: text("public_key").notNull(),
  // Signature counter from the authenticator. Updated on each
  // successful authentication. A counter that decreases suggests a
  // cloned authenticator (handled by the verification library).
  counter: integer("counter").notNull().default(0),
  // User-friendly name for this passkey (e.g., "Dovi's MacBook Pro").
  // Editable from Settings.
  nickname: text("nickname"),
  // Transport types reported by the authenticator (usb, nfc, ble,
  // internal, hybrid). Stored as comma-separated for simplicity.
  transports: text("transports"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => [
  index("passkeys_user_id_idx").on(table.userId),
]);

export type Passkey = typeof passkeys.$inferSelect;
export type InsertPasskey = typeof passkeys.$inferInsert;

// Password reset tokens. One row per outstanding reset request. The
// token in the email is a 32-byte random string; we store ONLY the
// SHA-256 hash so a DB leak doesn't enable resets. Token lifetime is
// 60 minutes (industry standard for password-reset links — long
// enough for "I'll check my email" friction, short enough that a
// stolen but unused link expires).
//
// usedAt is set when the token is consumed (success). Re-using a
// consumed token returns the same generic error as an invalid one.
// Multiple outstanding tokens for the same user are allowed: clicking
// "forgot password" twice issues two valid links until the first one
// is used or expires. Simpler than invalidating prior tokens and
// matches the locked anti-enumeration discipline (route always
// returns 200 regardless of whether the email matched a real user).
//
// On successful reset, the route also clears any sessions for that
// user (lockout-after-reset is the canonical "I was compromised"
// recovery flow).
export const passwordResets = pgTable("password_resets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // SHA-256(token) — never store the raw token. Hex-encoded.
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  // IP + user agent at request time. Forensic context if the user
  // later reports the reset wasn't theirs. Optional (request may
  // arrive via a proxy that strips both).
  requestIp: text("request_ip"),
  requestUserAgent: text("request_user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("password_resets_token_hash_unique").on(table.tokenHash),
  index("password_resets_user_id_idx").on(table.userId),
  index("password_resets_expires_at_idx").on(table.expiresAt),
]);

export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertPasswordReset = typeof passwordResets.$inferInsert;

// Email suppression list. Written by ESP webhook handlers
// (Postmark / SendGrid) when an address hard-bounces or files a
// spam complaint. Read by sendEmail() before every send — addresses
// in this table are silently skipped to protect sender reputation.
//
// Reasons:
//   - hard_bounce: address doesn't exist or domain is unroutable.
//     Continuing to send guarantees more bounces and crater the
//     domain's reputation; gmail / outlook / fastmail all flag it
//     fast.
//   - spam_complaint: recipient clicked the spam button in their
//     mail client. Sending more would compound the complaint rate;
//     ESPs auto-throttle senders over thresholds.
//   - manual: support added the entry by hand (e.g., user
//     emailed asking to be removed but we can't tie it to a
//     specific gifter row).
//
// source records which ESP webhook fired the suppression so we can
// audit + reconcile across ESPs if we later add SendGrid alongside
// Postmark. payload stores the raw event for forensic context (small
// — ~1-2KB per row).
//
// The email column is normalized lowercase + trimmed at insert time;
// reads also lowercase the lookup. Unique on (email, reason) so
// re-firing the same bounce doesn't create duplicate rows but a
// separate spam_complaint after a hard_bounce can still be recorded.
export const emailSuppressions = pgTable("email_suppressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 254 }).notNull(),
  reason: varchar("reason", { length: 32 }).notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  payload: jsonb("payload"),
  suppressedAt: timestamp("suppressed_at").defaultNow().notNull(),
  // Optional unsuppress-at for support overrides ("we verified the
  // gifter's mailbox is fixed; the previous bounce was a typo").
  // NULL means the suppression is current. A non-null value in the
  // past means the suppression has expired and reads should ignore.
  unsuppressedAt: timestamp("unsuppressed_at"),
  unsuppressedReason: text("unsuppressed_reason"),
}, (table) => [
  uniqueIndex("email_suppressions_email_reason_unique").on(table.email, table.reason),
  index("email_suppressions_email_idx").on(table.email),
  index("email_suppressions_suppressed_at_idx").on(table.suppressedAt),
]);

export type EmailSuppression = typeof emailSuppressions.$inferSelect;
export type InsertEmailSuppression = typeof emailSuppressions.$inferInsert;

// Email verification tokens. Same shape as password_resets — single-
// use 32-byte token stored as SHA-256 hash, 7-day TTL (longer than
// password reset because users often delay clicking through; a
// password reset is "I want in NOW," a verify-email is "I'll get
// to it"). On verification success, users.emailVerifiedAt is
// stamped and the row is marked used.
//
// Re-issuing verification (parent didn't get the first email, etc.)
// creates a new row; the original stays valid until used or
// expired. Cleanup is the periodic purge of expired+used rows
// (not implemented yet — table will stay small for the
// foreseeable future).
export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // The email being verified. Stored alongside user_id so a future
  // email-change flow can verify a NEW address before swapping it
  // onto the user row.
  email: varchar("email", { length: 254 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("email_verifications_token_hash_unique").on(table.tokenHash),
  index("email_verifications_user_id_idx").on(table.userId),
  index("email_verifications_expires_at_idx").on(table.expiresAt),
]);

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = typeof emailVerifications.$inferInsert;

// Login fingerprints. One row per (userId, fingerprint) tuple seen.
// First time a fingerprint appears for a user, we treat it as a NEW
// device and send the new-device-sign-in alert email. Subsequent
// logins from the same fingerprint are silent.
//
// Fingerprint shape: SHA-256 of (IP /24 prefix + user-agent family
// signature). The /24 grouping avoids alerting on every Wi-Fi
// network change (DHCP rotation, mobile cell tower hop, coffee-shop
// IPs). The UA family signature is the browser family + major OS
// (e.g., "Chrome|macOS") — coarse enough that a Chrome auto-update
// doesn't fire an alert.
//
// Cleanup: not implemented yet. Table grows by ~1 row per user per
// distinct device. For most users that's <10 rows lifetime. If it
// becomes a concern, a worker can prune rows older than 365 days.
export const loginFingerprints = pgTable("login_fingerprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  // First time we saw this fingerprint for this user. Doubles as the
  // moment we sent the new-device alert email.
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  // Updated on every subsequent login with the same fingerprint.
  // Helps the user (and admin debugging) understand which devices
  // are still active.
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  // Forensic context captured at first-seen time. Useful for the
  // user's own "is this me?" review later. Trimmed conservatively
  // to keep the row small.
  firstSeenIp: text("first_seen_ip"),
  firstSeenUserAgent: text("first_seen_user_agent"),
}, (table) => [
  uniqueIndex("login_fingerprints_user_fingerprint_unique").on(table.userId, table.fingerprint),
  index("login_fingerprints_user_id_idx").on(table.userId),
]);

export type LoginFingerprint = typeof loginFingerprints.$inferSelect;
export type InsertLoginFingerprint = typeof loginFingerprints.$inferInsert;

// Pending email change requests. Closes the account-takeover
// vector documented as Tier 0 #3 in the email strategy:
// 'Email-change confirmation sent to old address.' The flow:
//   1. User hits POST /api/me/change-email with {newEmail}.
//   2. We generate two tokens (confirmTokenHash, revokeTokenHash)
//      and store a row here with both, plus the old + new email.
//   3. Send confirmation to NEW address (confirm = swap).
//   4. Send heads-up to OLD address (revoke = cancel + lock).
//   5. NEW confirms -> users.email gets swapped, sessions cleared.
//   6. OLD revokes -> request marked revoked, change cancelled.
//   7. Either way: the OTHER token becomes useless.
// 24-hour TTL. After expiry, both tokens are invalid; the user
// can re-initiate from /settings.
export const emailChangeRequests = pgTable("email_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  oldEmail: varchar("old_email", { length: 254 }).notNull(),
  newEmail: varchar("new_email", { length: 254 }).notNull(),
  confirmTokenHash: varchar("confirm_token_hash", { length: 64 }).notNull(),
  revokeTokenHash: varchar("revoke_token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  revokedAt: timestamp("revoked_at"),
  requestIp: text("request_ip"),
  requestUserAgent: text("request_user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("email_change_requests_confirm_token_unique").on(table.confirmTokenHash),
  uniqueIndex("email_change_requests_revoke_token_unique").on(table.revokeTokenHash),
  index("email_change_requests_user_id_idx").on(table.userId),
  index("email_change_requests_expires_at_idx").on(table.expiresAt),
]);

export type EmailChangeRequest = typeof emailChangeRequests.$inferSelect;
export type InsertEmailChangeRequest = typeof emailChangeRequests.$inferInsert;

// Magic-link auth tokens for passwordless gifter sign-in. Same hashed-
// token discipline as password_resets + email_verifications: the raw
// token in the email is 32 random bytes, but we persist only the
// SHA-256 hash — a DB leak doesn't grant authentication.
//
// Per project_recurring_gifting_without_password_spec.md (locked
// 2026-05-25). Backs the team-audit conversion #1 experiment: drop
// password collection from the gifter-recurring checkout flow; replace
// with a magic-link welcome email after Stripe success.
//
// Lifecycle:
//   1. Created when /api/auth/magic-link/request fires OR when the
//      gifter-recurring webhook handler emits a welcome email after
//      Stripe checkout.session.completed.
//   2. The raw 32-byte hex token is embedded in the email link
//      ({APP_URL}/auth/magic?token=...). The hash goes in the DB.
//   3. /api/auth/magic-link/verify reads the token from the query,
//      SHA-256s it, looks up the row, validates expiresAt + usedAt,
//      establishes a session, stamps usedAt.
//   4. Single-use: after usedAt is non-null, the link can't be
//      redeemed again — the gifter must request a new one.
//   5. Time-limited: 15-minute TTL is short enough that a stolen-
//      then-unused link expires quickly. Most legitimate clicks
//      happen within 1 minute.
//
// intent column distinguishes the two surfaces:
//   - 'gifter_welcome' — fired after the post-recurring Stripe
//     success webhook. Welcomes a freshly-created gifter to their
//     dashboard.
//   - 'gifter_relogin' — fired when an existing gifter clicks
//     "email me a sign-in link" on the Login screen.
//
// Rate limiting (server-side): 5 requests per email per hour, soft
// enforced in the route handler (not the DB). Enumeration mitigation:
// the request endpoint ALWAYS returns 200 regardless of whether the
// email matched a real user — same discipline as password_resets.
//
// Cleanup: rows are kept for 7 days post-expiry to support
// enumeration detection ("which emails have been probed?"). After
// that, a future cron worker hard-deletes used + expired rows.
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // SHA-256(token) — never store the raw token. Hex-encoded.
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  // 'gifter_welcome' | 'gifter_relogin' (extensible).
  intent: varchar("intent", { length: 32 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  // Forensic context. Read by future enumeration-detection tooling
  // ("which IPs requested links for which emails in the last 24h").
  requestIp: text("request_ip"),
  requestUserAgent: text("request_user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("magic_link_tokens_token_hash_unique").on(table.tokenHash),
  index("magic_link_tokens_user_id_idx").on(table.userId),
  index("magic_link_tokens_expires_at_idx").on(table.expiresAt),
]);

export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = typeof magicLinkTokens.$inferInsert;

// Founding Members — the first 1,000 signups who lock in $19/yr Plus
// lifetime + Founding Member badge + early access to every future
// Kiddo product + $25 starter credit at fund-live. Locked
// 2026-05-23 per project_pricing_v3_pricing_levels.md; capture
// surface at /founding-members shipped same day; idempotent dedupe +
// welcome email shipped 2026-05-26.
//
// This table is the graduated form of `.local/founding-members.jsonl`
// (the flat-file capture surface that's been live since the page
// shipped). Day 1 of `project_founding_member_claim_flow_spec.md`:
// move the source of truth from a JSONL file to Postgres so:
//   - The 1,000-cap is enforced via a unique constraint on `position`
//     instead of a best-effort line-count check (race-safe).
//   - Dedupe is enforced via a unique constraint on `email` instead
//     of a best-effort linear scan.
//   - The data joins to `users.id` once the launch claim flow ships
//     (Days 2-5 of the spec) — `claimedUserId` is the link.
//   - The data survives `.local/*` resets across deploys.
//   - Admin queries can use SQL instead of parsing JSONL.
//
// The JSONL file stays as an append-only audit log (every successful
// signup also appends a row there). It's not the source of truth
// anymore; it's the forensic trail.
//
// Claim columns (claimToken, claimedAt, claimedUserId) are present
// from Day 1 even though the claim flow itself doesn't ship until
// Days 2-5. Adding them now means the launch claim flow can be
// built without a second migration — and a founder who signs up
// before the claim flow ships will simply have `claimedAt = NULL`
// until they redeem.
export const foundingMembers = pgTable("founding_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Canonical lowercased email. Unique constraint enforces dedupe
  // at the DB layer — the application-level scan in the endpoint
  // becomes a fast-path optimization, with the DB as the source of
  // truth on collisions (handles concurrent submit race correctly).
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  // Position number in the 1,000 cap. Unique so two simultaneous
  // signups can't both claim position 47 — one INSERT wins, the
  // other retries with the next position. The endpoint computes
  // `currentCount + 1` and inserts; if the unique conflict fires,
  // the endpoint can retry once with the new count.
  position: integer("position").notNull(),
  signupMessage: text("signup_message"),
  sourceSurface: text("source_surface").notNull(),
  signupAt: timestamp("signup_at").notNull().defaultNow(),
  // Claim state. All three NULL until the launch claim flow fires.
  // claimToken is SHA-256 of the URL token (same discipline as
  // magic_link_tokens + password_resets); raw token in the email,
  // hash here. Cleared after redemption.
  claimToken: varchar("claim_token", { length: 64 }),
  claimedAt: timestamp("claimed_at"),
  claimedUserId: varchar("claimed_user_id").references(() => users.id, { onDelete: "set null" }),
  // Gifted-slot tracking. When a gifter sponsors a Founder slot
  // for a recipient (per the existing /api/stripe/checkout/sponsor-founder
  // endpoint), the recipient gets a row here with `giftedBy` =
  // sponsor email + `giftedStripeSessionId` = the Stripe session
  // for audit. Direct signups have both NULL.
  giftedBy: text("gifted_by"),
  giftedStripeSessionId: text("gifted_stripe_session_id"),
}, (table) => [
  uniqueIndex("founding_members_email_unique").on(table.email),
  uniqueIndex("founding_members_position_unique").on(table.position),
  index("founding_members_claimed_user_id_idx").on(table.claimedUserId),
]);

export type FoundingMember = typeof foundingMembers.$inferSelect;
export type InsertFoundingMember = typeof foundingMembers.$inferInsert;
