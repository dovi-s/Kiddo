import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, timestamp, uniqueIndex, varchar, text } from "drizzle-orm/pg-core";

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
  // Post-handoff engagement loop. Bucket 3 of AGE_18_HANDOFF_SPEC.md.
  // Stamped each time the quarterly summary email goes out to a
  // kid-owner (i.e. a user who claimed a fund via age-transition).
  // Worker (`server/postHandoffEngagementWorker.ts`) reads this to
  // decide who's due — fires on Jan/Apr/Jul/Oct mid-month for owners
  // who haven't been emailed in the last 80 days AND whose first fund
  // was transferred >60 days ago.
  lastQuarterlySummaryAt: timestamp("last_quarterly_summary_at"),
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
