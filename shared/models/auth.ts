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
