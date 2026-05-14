import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index, jsonb, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod/v4";

export * from "./models/auth";
import { users } from "./models/auth";

const { createInsertSchema } = createSchemaFactory({ zodInstance: z });

export const funds = pgTable("funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  giftCode: text("gift_code"),
  giftLinkToken: text("gift_link_token"),
  accountType: text("account_type").notNull().default("UTMA"),
  status: text("status").notNull().default("draft"),
  coverageState: text("coverage_state"),
  trialEndsAt: timestamp("trial_ends_at"),
  drivewealthAccountId: text("drivewealth_account_id"),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  pendingBalance: decimal("pending_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  cashBalance: decimal("cash_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  totalGain: decimal("total_gain", { precision: 12, scale: 2 }).notNull().default("0"),
  gainPercent: decimal("gain_percent", { precision: 6, scale: 2 }).notNull().default("0"),
  contributorCount: integer("contributor_count").notNull().default(0),
  projectedValue: decimal("projected_value", { precision: 12, scale: 2 }).notNull().default("0"),
  yearsUntilMaturity: integer("years_until_maturity"),
  childPhotoUrl: text("child_photo_url"),
  recipientFirstName: text("recipient_first_name"),
  recipientLastName: text("recipient_last_name"),
  recipientRelation: text("recipient_relation"),
  recipientBirthdate: timestamp("recipient_birthdate"),
  recipientSsnLast4: text("recipient_ssn_last4"),
  // Full child SSN (encrypted) — collected before first investment, required
  // for 1099-DIV / 1099-B tax reporting. Until present, the activate-investing
  // path is blocked server-side.
  recipientSsnFullEncrypted: text("recipient_ssn_full_encrypted"),
  recipientSsnCollectedAt: timestamp("recipient_ssn_collected_at"),
  // 2-letter US state code where the kid resides. Drives age of majority
  // (UTMA varies: 18 in most states, 19 in AL/NE, 21 in MS/PA, etc.).
  recipientState: text("recipient_state"),
  // Resolved age of majority for THIS fund, locked in at creation time so a
  // future change to the state→age table never silently shifts a kid's
  // existing transition date. Default 18 keeps legacy funds working.
  majorityAge: integer("majority_age").notNull().default(18),
  // Per-fund UTMA irrevocability acknowledgment. Each fund is a separate
  // legal account; one master agreement at signup isn't enough — each new
  // child needs explicit consent that the gift is irrevocable.
  utmaAcknowledgedAt: timestamp("utma_acknowledged_at"),
  utmaAcknowledgedByUserId: varchar("utma_acknowledged_by_user_id"),
  // Successor custodian — who manages the fund if the parent dies before
  // the kid reaches majority. Optional but always prompted at fund creation.
  successorCustodianName: text("successor_custodian_name"),
  successorCustodianEmail: text("successor_custodian_email"),
  successorCustodianRelation: text("successor_custodian_relation"),
  successorCustodianAddedAt: timestamp("successor_custodian_added_at"),
  age18NotifiedAt: timestamp("age_18_notified_at"),
  // NOTE: a `transferredAt` column was added to this schema on
  // 2026-05-14 (commit e2fd175) without the migration being applied
  // to the user's DB. That caused every funds-table query to 500
  // because Drizzle generated SELECTs referencing a column the DB
  // didn't have. Reverted the schema declaration in commit
  // following the rapid-fire mistake. The migration file
  // (migrations/0016_fund_transferred_at.sql) is intentionally
  // kept — it documents the intended addition and can be applied
  // via `npm run db:push` or `npm run db:migrate`. Once applied,
  // restoring `transferredAt: timestamp("transferred_at")` here
  // and the matching `transferredAt: transferTime` write in
  // server/auth.ts is safe.
  // Set the first time the kid (new owner post-handoff) finishes the
  // Age18Welcome.tsx walkthrough at /welcome-at-18. Null until then;
  // once stamped the walkthrough never re-fires. Dashboard.tsx checks
  // this in the closed-tab fallback path too (kid closes the welcome
  // tab without finishing → next dashboard visit redirects back).
  // Per AGE_18_HANDOFF_SPEC.md bucket 1.
  kidWelcomeCompletedAt: timestamp("kid_welcome_completed_at"),
  // First-large-withdrawal cooldown state. Bucket 2 of the handoff
  // spec: the kid's first withdrawal of >25% balance OR >$2,000
  // (whichever lower) triggers a 24h cooldown. cooldownStartedAt is
  // set when the kid first confirms via the modal; the withdrawal
  // proceeds only when now() >= cooldownStartedAt + 24h. After it
  // completes, firstLargeWithdrawalAt is stamped and subsequent
  // withdrawals bypass the cooldown.
  firstLargeWithdrawalCooldownStartedAt: timestamp("first_large_withdrawal_cooldown_started_at"),
  firstLargeWithdrawalAt: timestamp("first_large_withdrawal_at"),
  // Nudges the parent has explicitly dismissed (e.g., "strategy_band_11_13").
  // Each entry is one-shot: once dismissed, that band's nudge never re-fires for this fund.
  // Distinct from age18NotifiedAt because there are multiple nudges across the child's life.
  dismissedNudges: jsonb("dismissed_nudges"),
  culturalBackground: jsonb("cultural_background"),
  pronoun: text("pronoun"),
  investmentStrategy: text("investment_strategy").default("auto_invest"),
  isDiscoverable: boolean("is_discoverable").notNull().default(false),
  // Memory Book moderation toggle (per-fund). OFF by default — the
  // product philosophy is "no approval, parent controls" (gift link is
  // private + parent already has DELETE on any entry, so a pre-approval
  // gate would just add friction to the loop). When the parent flips
  // this on, gifter-submitted entries land as `pending_review` and the
  // parent gets a tray to approve or delete. Parent-authored entries
  // are NEVER subject to the toggle.
  gifterMemoryModeration: boolean("gifter_memory_moderation").notNull().default(false),
  lastContributionAt: timestamp("last_contribution_at"),
  dormantNotificationSentAt: timestamp("dormant_notification_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("funds_gift_code_unique").on(table.giftCode),
  uniqueIndex("funds_gift_link_token_unique").on(table.giftLinkToken),
  index("funds_coverage_state_idx").on(table.coverageState),
  index("funds_trial_ends_at_idx").on(table.trialEndsAt),
  index("funds_last_contribution_at_idx").on(table.lastContributionAt),
]);

export const fundsRelations = relations(funds, ({ one, many }) => ({
  user: one(users, { fields: [funds.userId], references: [users.id] }),
  events: many(events),
  holdings: many(holdings),
  gifts: many(gifts),
  gifterFunds: many(gifterFunds),
  notifications: many(notifications),
}));

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  // Cover-image focal point — saves the parent's framing intent from the
  // EventCreate pan/zoom editor as a normalized (0..1) coordinate. Each
  // destination surface (Memory Book strip, gifter hero, dashboard tile)
  // renders the same image at a different aspect ratio and was previously
  // letting `object-fit: cover` choose the crop, which discarded the
  // user's framing work. Now: every surface applies `object-position:
  // ${focalX*100}% ${focalY*100}%` so the parent's chosen subject stays
  // in frame across all aspect ratios. Null = no focal point set =
  // default center (0.5, 0.5), which is back-compat with existing rows.
  imageFocalX: decimal("image_focal_x", { precision: 4, scale: 3 }),
  imageFocalY: decimal("image_focal_y", { precision: 4, scale: 3 }),
  eventType: text("event_type").default("birthday"),
  eventCategory: text("event_category").default("gifting_occasion"),
  theme: text("theme").default("default"),
  goalAmount: decimal("goal_amount", { precision: 12, scale: 2 }),
  eventDate: timestamp("event_date"),
  isPermanent: boolean("is_permanent").notNull().default(false),
  hasEventPass: boolean("has_event_pass").notNull().default(false),
  eventPassPurchasedAt: timestamp("event_pass_purchased_at"),
  giftVolume: decimal("gift_volume", { precision: 12, scale: 2 }).notNull().default("0"),
  giftCount: integer("gift_count").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("events_fund_id_idx").on(table.fundId),
  index("events_slug_idx").on(table.slug),
]);

export const eventsRelations = relations(events, ({ one, many }) => ({
  fund: one(funds, { fields: [events.fundId], references: [funds.id] }),
  user: one(users, { fields: [events.userId], references: [users.id] }),
  gifts: many(gifts),
}));

export const holdings = pgTable("holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  shares: decimal("shares", { precision: 12, scale: 6 }).notNull().default("0"),
  costBasis: decimal("cost_basis", { precision: 12, scale: 2 }).notNull().default("0"),
  currentValue: decimal("current_value", { precision: 12, scale: 2 }).notNull().default("0"),
  gain: decimal("gain", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("holdings_fund_id_idx").on(table.fundId),
  // Each fund has AT MOST ONE row per ticker. The webhook handlers
  // upsert via getHoldingByFundAndTicker, but a race between two
  // simultaneous fires could double-insert. The constraint forces the
  // race to resolve at the DB level — losing INSERT throws, the retry
  // path correctly takes the UPDATE branch — so the dashboard can never
  // show "Domino's" twice in the holdings list.
  unique("holdings_fund_ticker_unique").on(table.fundId, table.ticker),
]);

export const holdingsRelations = relations(holdings, ({ one }) => ({
  fund: one(funds, { fields: [holdings.fundId], references: [funds.id] }),
}));

export const fundSnapshots = pgTable("fund_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  snapshotDate: timestamp("snapshot_date").notNull().defaultNow(),
  investedValue: decimal("invested_value", { precision: 12, scale: 2 }).notNull().default("0"),
  cashValue: decimal("cash_value", { precision: 12, scale: 2 }).notNull().default("0"),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull().default("0"),
  principalBasis: decimal("principal_basis", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("fund_snapshots_fund_id_idx").on(table.fundId),
  index("fund_snapshots_fund_date_idx").on(table.fundId, table.snapshotDate),
]);

export const fundSnapshotsRelations = relations(fundSnapshots, ({ one }) => ({
  fund: one(funds, { fields: [fundSnapshots.fundId], references: [funds.id] }),
}));

export const gifts = pgTable("gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  eventId: varchar("event_id").references(() => events.id),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  processingFee: decimal("processing_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  koraFee: decimal("kora_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  message: text("message"),
  photoUrl: text("photo_url"),
  // Video and audio mirror the photo column so all three media types live on
  // the gift row, not just in Stripe metadata. Before this column landed,
  // video/audio survived ONLY in the Stripe checkout session metadata and
  // were re-derived from there by ensureMemoryEntryForGift on
  // payment_intent.succeeded — a single point of failure if Stripe ever
  // truncated the metadata, the webhook fired before metadata was readable,
  // or we wanted to re-create the Memory Book entry later. With the column
  // present, the URL is canonical on our side. The webhook still falls back
  // to metadata for legacy gifts that pre-date this column.
  videoUrl: text("video_url"),
  audioUrl: text("audio_url"),
  executionModel: text("execution_model").default("auto_invest"),
  selectedTicker: text("selected_ticker"),
  status: text("status").notNull().default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  sharesAcquired: decimal("shares_acquired", { precision: 12, scale: 6 }),
  priceAtPurchase: decimal("price_at_purchase", { precision: 12, scale: 4 }),
  // Set when this gift was produced by a parent recurring schedule (worker-fired).
  // Null for one-time parent gifts and all gifter-sent gifts. Used to mark a gift row
  // as "↻ Recurring" in the gifter detail modal — the badge is per-gift, not per-person.
  parentContributionId: varchar("parent_contribution_id"),
  // Explicit anonymous flag — replaces the previous string-matching
  // pattern that inferred anonymous from sender_name being 'Anonymous'
  // or 'Someone who loves Emma' fallbacks. The string-matching pattern
  // leaked anonymous gifts into the public "who's already given"
  // social-proof carousel as "Someone." See
  // feedback_anonymous_as_explicit_flag.md (locked memory) for the
  // standing principle on why privacy choices belong as explicit
  // boolean fields, not inferred from string patterns. Backfilled by
  // migration 0009 from the legacy fallback strings.
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  // Orphaned column from the retired 8-tag lesson system (see
  // feedback_structure_vs_behavior.md). Kept in DB for historical
  // data; not read by any current code path. Safe to drop in a future
  // schema cleanup pass.
  lessonTag: varchar("lesson_tag", { length: 64 }),
  // Client source — which surface created the gift. Populated by the
  // gift-checkout endpoint from a `clientSource` body field that the
  // mobile app sets explicitly; web clients leave it absent and the
  // server defaults to 'web'. Values: 'web' | 'mobile_ios' |
  // 'mobile_android'. Historical rows pre-dating this column are NULL
  // (unknown). The motivating use case is the OPS_RUNBOOK_MOBILE_FEE_
  // DISPLAY_BUG_2026-05-14.md "Option C" — when the next mobile-only
  // UI bug surfaces, we want to triage which subset of gift rows came
  // from the affected surface without having to fetch user-agent from
  // every Stripe payment intent one at a time.
  source: text("source"),
  investedAt: timestamp("invested_at"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("gifts_fund_id_idx").on(table.fundId),
  index("gifts_event_id_idx").on(table.eventId),
  index("gifts_status_idx").on(table.status),
  index("gifts_parent_contribution_id_idx").on(table.parentContributionId),
]);

export const giftsRelations = relations(gifts, ({ one }) => ({
  fund: one(funds, { fields: [gifts.fundId], references: [funds.id] }),
  event: one(events, { fields: [gifts.eventId], references: [events.id] }),
}));

// Records exactly which ticker(s) a gift's money funded. One row per (gift, ticker).
// A pick gift writes 1 row (e.g. SBUX gift → SBUX allocation). An auto-invest gift
// writes N rows (one per ETF in the basket, weighted). When a holding is sold and
// the proceeds rebalance into the managed mix, new allocation rows are written
// crediting the originating gifts proportionally.
//
// This replaces the previous proportional-split approximation in the holding detail
// sheet — managed-mix contributor attribution is now exact, not estimated.
export const giftAllocations = pgTable("gift_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  giftId: varchar("gift_id").notNull().references(() => gifts.id, { onDelete: "cascade" }),
  fundId: varchar("fund_id").notNull().references(() => funds.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  costBasis: decimal("cost_basis", { precision: 12, scale: 2 }).notNull(),
  shares: decimal("shares", { precision: 14, scale: 6 }),
  // "pick" = single-ticker pick; "auto" = managed-basket allocation; "rebalance" = redirected from a sold holding
  source: text("source").notNull().default("auto"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("gift_allocations_fund_id_idx").on(table.fundId),
  index("gift_allocations_gift_id_idx").on(table.giftId),
  index("gift_allocations_ticker_idx").on(table.ticker),
  index("gift_allocations_fund_ticker_idx").on(table.fundId, table.ticker),
]);

export const giftAllocationsRelations = relations(giftAllocations, ({ one }) => ({
  gift: one(gifts, { fields: [giftAllocations.giftId], references: [gifts.id] }),
  fund: one(funds, { fields: [giftAllocations.fundId], references: [funds.id] }),
}));

export const insertGiftAllocationSchema = createInsertSchema(giftAllocations).omit({ id: true, createdAt: true });
export type GiftAllocation = typeof giftAllocations.$inferSelect;
export type InsertGiftAllocation = z.infer<typeof insertGiftAllocationSchema>;

export const gifters = pgTable("gifters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  name: text("name"),
  milestoneNotifications: boolean("milestone_notifications").notNull().default(true),
  optedInAt: timestamp("opted_in_at"),
  optedInIp: text("opted_in_ip"),
  unsubscribed: boolean("unsubscribed").notNull().default(false),
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeToken: text("unsubscribe_token").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("gifters_email_unique").on(table.email),
  uniqueIndex("gifters_unsubscribe_token_unique").on(table.unsubscribeToken),
  index("gifters_unsubscribed_idx").on(table.unsubscribed),
]);

export const giftersRelations = relations(gifters, ({ many }) => ({
  gifterFunds: many(gifterFunds),
  notifications: many(notifications),
}));

export const gifterFunds = pgTable("gifter_funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gifterId: varchar("gifter_id").notNull().references(() => gifters.id),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  totalContributed: decimal("total_contributed", { precision: 12, scale: 2 }).notNull().default("0"),
  contributionCount: integer("contribution_count").notNull().default(0),
  lastContributedAt: timestamp("last_contributed_at"),
  lastBirthdayReminderYear: integer("last_birthday_reminder_year"),
  lastBirthdayReminderSentAt: timestamp("last_birthday_reminder_sent_at"),
  age18NotifiedAt: timestamp("age_18_notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("gifter_funds_gifter_fund_unique").on(table.gifterId, table.fundId),
  index("gifter_funds_gifter_id_idx").on(table.gifterId),
  index("gifter_funds_fund_id_idx").on(table.fundId),
  index("gifter_funds_last_contributed_at_idx").on(table.lastContributedAt),
]);

export const gifterFundsRelations = relations(gifterFunds, ({ one, many }) => ({
  gifter: one(gifters, { fields: [gifterFunds.gifterId], references: [gifters.id] }),
  fund: one(funds, { fields: [gifterFunds.fundId], references: [funds.id] }),
  notifications: many(notifications),
}));

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  gifterId: varchar("gifter_id").references(() => gifters.id),
  fundId: varchar("fund_id").references(() => funds.id),
  gifterFundId: varchar("gifter_fund_id").references(() => gifterFunds.id),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("queued"),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_gifter_id_idx").on(table.gifterId),
  index("notifications_fund_id_idx").on(table.fundId),
  index("notifications_gifter_fund_id_idx").on(table.gifterFundId),
  index("notifications_type_idx").on(table.type),
  index("notifications_channel_idx").on(table.channel),
  index("notifications_status_idx").on(table.status),
  index("notifications_created_at_idx").on(table.createdAt),
]);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  gifter: one(gifters, { fields: [notifications.gifterId], references: [gifters.id] }),
  fund: one(funds, { fields: [notifications.fundId], references: [funds.id] }),
  gifterFund: one(gifterFunds, { fields: [notifications.gifterFundId], references: [gifterFunds.id] }),
}));

// Age-18 transition state — one row per fund. Tracks the parent's prep
// (childEmail, parentMessage, preview/invite tokens) and the actual
// handoff flow (kid claim, ownership transfer). Originally lived as a
// JSON file at .local/age-transition-flows.json; migrated to Postgres
// because it doesn't scale across multiple servers (file IO is per-
// process). The on-read backfill in `server/ageTransitionStore.ts`
// migrates any legacy JSON rows on first access — safe to keep around
// indefinitely; idempotent.
export const ageTransitions = pgTable("age_transitions", {
  fundId: varchar("fund_id").primaryKey().references(() => funds.id),
  childEmail: text("child_email"),
  parentMessage: text("parent_message"),
  previewToken: text("preview_token"),
  previewPreparedAt: timestamp("preview_prepared_at"),
  previewViewedAt: timestamp("preview_viewed_at"),
  inviteToken: text("invite_token"),
  invitedAt: timestamp("invited_at"),
  inviteViewedAt: timestamp("invite_viewed_at"),
  childClaimedAt: timestamp("child_claimed_at"),
  childClaimedByUserId: varchar("child_claimed_by_user_id").references(() => users.id),
  handoffRequestedAt: timestamp("handoff_requested_at"),
  ownershipTransferredAt: timestamp("ownership_transferred_at"),
  ownershipTransferredByUserId: varchar("ownership_transferred_by_user_id").references(() => users.id),
  formerCustodianUserId: varchar("former_custodian_user_id").references(() => users.id),
  // Verification gate — see project_age18_handoff_lifecycle_automatic.md.
  // The worker won't auto-send the at-18 invite unless verifiedAt is set.
  // Token is single-use; cleared after the kid clicks the link.
  childEmailVerificationToken: text("child_email_verification_token"),
  childEmailVerificationSentAt: timestamp("child_email_verification_sent_at"),
  childEmailVerifiedAt: timestamp("child_email_verified_at"),
  // Stalled-handoff escalation timestamps. Stamped by
  // server/stalledHandoffWorker.ts when the kid hasn't claimed
  // the fund N days after the invite went out. Three steps:
  //   T+7 : gentle nudge to kid + heads-up to parent
  //   T+30: stronger escalation; mentions trusted contact if set
  //   T+90: parent action-item surfaced; trusted contact emailed
  // Each timestamp fires exactly once per fund. Per the locked
  // discipline in AGE_18_HANDOFF_SPEC.md failure-paths section:
  // Kiddo does NOT liquidate stalled funds. UTMA ownership
  // belongs to the kid; we hold until they surface.
  stalledHandoffT7At: timestamp("stalled_handoff_t7_at"),
  stalledHandoffT30At: timestamp("stalled_handoff_t30_at"),
  stalledHandoffT90At: timestamp("stalled_handoff_t90_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Fast lookup by token for the public verify endpoint (kid clicks link).
  index("age_transitions_invite_token_idx").on(table.inviteToken),
  index("age_transitions_preview_token_idx").on(table.previewToken),
  index("age_transitions_verification_token_idx").on(table.childEmailVerificationToken),
]);

export const ageTransitionsRelations = relations(ageTransitions, ({ one }) => ({
  fund: one(funds, { fields: [ageTransitions.fundId], references: [funds.id] }),
}));

// Per-milestone send-state for the age-18 lifecycle worker. Each
// milestone (T-30 / T-1 / T-0 invite / T-0 parent email) fires exactly
// once per fund — the worker checks this row on every pass and skips
// what's already stamped. Originally lived as
// .local/age18-reminder-state.json; migrated to Postgres for the same
// scaling reason as age_transitions (per-process JSON loses concurrent
// updates across multi-server deployments). On-read backfill in
// server/age18TransitionWorker.ts migrates legacy JSON rows on first
// worker pass; the JSON file can be deleted manually after successful
// migration in production.
export const age18ReminderState = pgTable("age18_reminder_state", {
  fundId: varchar("fund_id").primaryKey().references(() => funds.id),
  t30SentAt: timestamp("t30_sent_at"),
  t1SentAt: timestamp("t1_sent_at"),
  todayInviteAutoSentAt: timestamp("today_invite_auto_sent_at"),
  todayParentEmailSentAt: timestamp("today_parent_email_sent_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const age18ReminderStateRelations = relations(age18ReminderState, ({ one }) => ({
  fund: one(funds, { fields: [age18ReminderState.fundId], references: [funds.id] }),
}));

// Feature flags — runtime-toggleable booleans (and JSON values) so we can
// gate experimental code paths without redeploying. The pattern is:
//   isFeatureEnabled('whisper_transcription', false)
// returns whatever the flag is currently set to (cached briefly server-side).
// Admins toggle flags via the Config tab. Audit trail captures every change.
// Default behavior when a flag doesn't exist: caller's defaultValue wins —
// so flagged code stays safe by design even if the row was never created.
export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 64 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  value: jsonb("value"),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memoryEntries = pgTable("memory_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  giftId: varchar("gift_id").references(() => gifts.id),
  type: text("type").notNull().default("gift_message"),
  content: text("content"),
  authorName: text("author_name"),
  authorPhotoUrl: text("author_photo_url"),
  photoUrl: text("photo_url"),
  videoUrl: text("video_url"),
  audioUrl: text("audio_url"),
  // Whisper transcript of the audio note. Populated asynchronously after
  // audio upload when OPENAI_API_KEY is configured + the openai package is
  // installed (gated dynamic import in server). Null when no audio, when
  // transcription is pending, or when the API isn't available. Renders
  // under the audio player as accessibility + a searchable record of what
  // the parent said. Particularly valuable for Memory Book search at 18.
  audioTranscript: text("audio_transcript"),
  // Visibility tier — controls when the kid sees this entry in KidView.
  //   'kid_now'    → visible at any age (default, gifter notes, parent notes
  //                  the parent didn't reserve, milestones, photos)
  //   'kid_at_18'  → reserved for the 18th-birthday reveal moment. Hidden
  //                  from KidView until the child turns 18, then unlocks
  //                  alongside legal control of the fund.
  //   'parent_only' → never visible to the kid; parent's private notes about
  //                   the fund (rare, but reserved for things like medical
  //                   reasoning, legal context, etc.)
  // Default 'kid_now' preserves existing behavior — every entry created
  // before this column landed stays visible. Parents opt INTO 'kid_at_18'
  // for specific entries via the modal toggle.
  visibility: text("visibility").notNull().default("kid_now"),
  // Moderation status. 'published' is the universal default — entries are
  // immediately live in the Memory Book. When fund.gifterMemoryModeration
  // is true, gifter-submitted entries land as 'pending_review' and stay
  // hidden from the default Memory Book / KidView queries until the
  // parent approves them (flips to 'published'). Parent-authored entries
  // are always 'published' — the toggle is for gifter content only.
  status: text("status").notNull().default("published"),
  // Trust & Safety state. Distinct from `status` above (which is the
  // parent-level workflow state). This is the admin-level safety state:
  //   null         → never reviewed (default; the vast majority of entries)
  //   'flagged'    → in the admin queue awaiting decision
  //   'approved'   → admin reviewed and marked safe (sticky; won't re-flag)
  //   'hidden'     → soft-removed from public surfaces (kid view, memory
  //                  book, gifter share, etc.) but row + media preserved
  //                  for audit. Reversible.
  //   'removed'    → media URLs and content nulled out; row preserved as
  //                  an audit-trail tombstone. Irreversible.
  //   'escalated'  → child-safety concern; preserved for evidence + ops
  //                  alert fires. Treated as hidden on user surfaces.
  // Memory Book / KidView queries filter out `hidden`, `removed`, and
  // `escalated`. The admin T&S queue lists `flagged` + `escalated`.
  moderationStatus: text("moderation_status"),
  // When the moderation flag was set, and by which admin (or worker for
  // automated flags — e.g. future CSAM scanning would write here with a
  // synthetic 'system:csam-scanner' user id).
  flaggedAt: timestamp("flagged_at"),
  flaggedByUserId: varchar("flagged_by_user_id"),
  // Short reason string captured at flag time. Free-form for admin
  // notes, structured for automated flaggers ('csam:hash-match',
  // 'rate-limit:burst', etc.).
  flaggedReason: text("flagged_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("memory_entries_fund_id_idx").on(table.fundId),
  index("memory_entries_status_idx").on(table.status),
  index("memory_entries_moderation_status_idx").on(table.moderationStatus),
]);

export const memoryEntriesRelations = relations(memoryEntries, ({ one }) => ({
  fund: one(funds, { fields: [memoryEntries.fundId], references: [funds.id] }),
  gift: one(gifts, { fields: [memoryEntries.giftId], references: [gifts.id] }),
}));

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fundId: varchar("fund_id").references(() => funds.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("activities_user_id_idx").on(table.userId),
  index("activities_fund_id_idx").on(table.fundId),
]);

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] }),
  fund: one(funds, { fields: [activities.fundId], references: [funds.id] }),
}));

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").notNull().default("free"),
  billingInterval: text("billing_interval").default("none"),
  status: text("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("subscriptions_user_id_idx").on(table.userId),
]);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));

export const fundMemberships = pgTable("fund_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").notNull().default("starter"),
  billingInterval: text("billing_interval").default("monthly"),
  status: text("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("fund_memberships_user_id_idx").on(table.userId),
  index("fund_memberships_fund_id_idx").on(table.fundId),
  index("fund_memberships_status_idx").on(table.status),
  index("fund_memberships_fund_plan_idx").on(table.fundId, table.plan),
]);

export const fundMembershipsRelations = relations(fundMemberships, ({ one }) => ({
  user: one(users, { fields: [fundMemberships.userId], references: [users.id] }),
  fund: one(funds, { fields: [fundMemberships.fundId], references: [funds.id] }),
}));

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: text("type").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  metadata: text("metadata"),
  giftId: varchar("gift_id").references(() => gifts.id),
  eventId: varchar("event_id").references(() => events.id),
  fundId: varchar("fund_id").references(() => funds.id),
  failureReason: text("failure_reason"),
  refundedAmount: decimal("refunded_amount", { precision: 12, scale: 2 }),
  refundedAt: timestamp("refunded_at"),
  completedAt: timestamp("completed_at"),
  // Realized-gain triplet — populated only on type='sell' rows.
  // realizedGain = saleProceeds - costBasisSold (positive = taxable
  // gain, negative = capital loss). costBasisSold is the basis of
  // the specific shares sold (already computed for the partial-sell
  // math in the sell endpoint, so we just store it). holdingPeriod
  // is "short_term" if the earliest purchase of this ticker in this
  // fund was < 1 year before the sale, otherwise "long_term".
  // Short-term sales are taxed as ordinary income (kiddie-tax
  // thresholds bite) while long-term sales get preferred rates.
  //
  // Why not a separate sales table: the transactions row is already
  // the canonical record of "this sell happened" — it has the
  // completedAt, the fundId, the amount, the ticker (in
  // description). Adding three columns here is cheaper than a
  // 1:1-join sales table that mirrors them.
  realizedGain: decimal("realized_gain", { precision: 12, scale: 2 }),
  costBasisSold: decimal("cost_basis_sold", { precision: 12, scale: 2 }),
  holdingPeriod: text("holding_period"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_stripe_payment_intent_idx").on(table.stripePaymentIntentId),
  index("transactions_type_idx").on(table.type),
  index("transactions_status_idx").on(table.status),
  // Index supports the "realized sales for fund X in year Y" query
  // pattern that the Tax Documents page hits.
  index("transactions_fund_id_completed_at_idx").on(table.fundId, table.completedAt),
]);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  gift: one(gifts, { fields: [transactions.giftId], references: [gifts.id] }),
  event: one(events, { fields: [transactions.eventId], references: [events.id] }),
  fund: one(funds, { fields: [transactions.fundId], references: [funds.id] }),
}));

export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bankName: text("bank_name").notNull(),
  accountLast4: text("account_last4").notNull(),
  routingLast4: text("routing_last4"),
  accountType: text("account_type").default("checking"),
  provider: text("provider").notNull().default("manual"),
  providerItemId: text("provider_item_id"),
  providerAccountId: text("provider_account_id"),
  connectionStatus: text("connection_status").notNull().default("active"),
  isDefault: boolean("is_default").notNull().default(false),
  needsRefreshAt: timestamp("needs_refresh_at"),
  lastBalanceCheckAt: timestamp("last_balance_check_at"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("bank_accounts_user_id_idx").on(table.userId),
  index("bank_accounts_provider_account_idx").on(table.provider, table.providerAccountId),
  index("bank_accounts_connection_status_idx").on(table.connectionStatus),
]);

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  user: one(users, { fields: [bankAccounts.userId], references: [users.id] }),
}));

export const thankYous = pgTable("thank_yous", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  giftId: varchar("gift_id").references(() => gifts.id),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email"),
  message: text("message").notNull(),
  status: text("status").notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("thank_yous_fund_id_idx").on(table.fundId),
]);

export const thankYousRelations = relations(thankYous, ({ one }) => ({
  fund: one(funds, { fields: [thankYous.fundId], references: [funds.id] }),
  gift: one(gifts, { fields: [thankYous.giftId], references: [gifts.id] }),
}));

export const recurringGifts = pgTable("recurring_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  occasionType: text("occasion_type"),
  paymentSetupStatus: text("payment_setup_status").notNull().default("pending_bank"),
  bankProvider: text("bank_provider"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("active"),
  // Same semantics as parent_contributions.pause_reason: "user" vs "subscription_ended".
  pauseReason: text("pause_reason"),
  pausedAt: timestamp("paused_at"),
  nextChargeDate: timestamp("next_charge_date"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("recurring_gifts_fund_id_idx").on(table.fundId),
]);

export const recurringGiftsRelations = relations(recurringGifts, ({ one }) => ({
  fund: one(funds, { fields: [recurringGifts.fundId], references: [funds.id] }),
}));

// Parent-initiated recurring auto-invest contributions (Kiddo Plus / Family exclusive)
export const parentContributions = pgTable("parent_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  bankAccountId: varchar("bank_account_id").references(() => bankAccounts.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: text("frequency").notNull().default("monthly"), // weekly | monthly
  status: text("status").notNull().default("active"), // active | paused | cancelled
  // When status="paused", explains WHY. "user" = parent paused manually.
  // "subscription_ended" = paused automatically because the household's paid plan lapsed.
  // Used by the reactivation flow to selectively un-pause schedules that were stopped by us, not by the user.
  pauseReason: text("pause_reason"),
  pausedAt: timestamp("paused_at"),
  nextRunDate: timestamp("next_run_date"),
  lastRunDate: timestamp("last_run_date"),
  // Cooldown anchor for the "Time to add to {child}'s fund" decline email.
  // Recurring charge can fail on consecutive worker ticks (Stripe retry-
  // every-N-days windows, persistent card declines, expired cards). Without
  // this anchor every retry sent a fresh email; a parent with a dying card
  // would get pelted with the same nag once per retry day. Stamped each
  // time the email is sent; the worker skips the send if this is within
  // RECURRING_DECLINE_EMAIL_COOLDOWN_HOURS (72h today). Activity row still
  // fires on every failure so the in-app "Last cycle failed" surface stays
  // accurate; the cooldown is email-only. Nullable for legacy rows that
  // pre-date the column.
  lastDeclineEmailAt: timestamp("last_decline_email_at"),
  totalContributed: decimal("total_contributed", { precision: 12, scale: 2 }).default("0"),
  executionModel: text("execution_model").default("auto"), // auto | pick | family
  selectedTicker: text("selected_ticker"),
  // Recurring Memory Book note. When set, the worker stamps this note as the
  // gift's message AND writes a memory_entries row on every successful auto-fire,
  // so each cycle of "Every month I add $50. This is your future." leaves a love
  // letter, not a mute ledger entry. Optional — null means no auto-stamp.
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("parent_contributions_fund_id_idx").on(table.fundId),
  index("parent_contributions_user_id_idx").on(table.userId),
  index("parent_contributions_bank_account_id_idx").on(table.bankAccountId),
]);

export const parentContributionsRelations = relations(parentContributions, ({ one }) => ({
  fund: one(funds, { fields: [parentContributions.fundId], references: [funds.id] }),
  user: one(users, { fields: [parentContributions.userId], references: [users.id] }),
  bankAccount: one(bankAccounts, { fields: [parentContributions.bankAccountId], references: [bankAccounts.id] }),
}));

export const fundCollaborators = pgTable("fund_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  // userId is null until the invitee accepts (and proves they own the
  // matching session). After accept it carries the invited user's id so
  // the auth middleware can match without re-resolving by email each
  // request.
  userId: varchar("user_id").references(() => users.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"),
  status: text("status").notNull().default("pending"),
  // Acceptance token. Generated at invite time, mailed to the invitee
  // as part of the /invitations/:token link. Treated as a bearer
  // capability — anyone holding the token can accept the invite, which
  // is the right model for email-based invites (the email is the
  // delivery channel and the proof). Tokens are revoked by setting
  // status to declined / removed; we do NOT rotate on acceptance
  // because we want resend-without-regen to keep working.
  token: text("token"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  // Last time we sent the invitation email for this row. Used to
  // throttle resend and to display "Invited Xd ago, last reminder Yd
  // ago" in the Settings pending list.
  lastNotifiedAt: timestamp("last_notified_at"),
}, (table) => [
  index("fund_collaborators_fund_id_idx").on(table.fundId),
  index("fund_collaborators_token_idx").on(table.token),
  index("fund_collaborators_user_id_idx").on(table.userId),
  index("fund_collaborators_email_idx").on(table.email),
]);

export const fundCollaboratorsRelations = relations(fundCollaborators, ({ one }) => ({
  fund: one(funds, { fields: [fundCollaborators.fundId], references: [funds.id] }),
  user: one(users, { fields: [fundCollaborators.userId], references: [users.id] }),
}));

export const referralEvents = pgTable("referral_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  refCode: text("ref_code").notNull(),
  fundId: varchar("fund_id").references(() => funds.id),
  eventId: varchar("event_id").references(() => events.id),
  action: text("action").notNull(),
  channel: text("channel"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("referral_events_ref_code_idx").on(table.refCode),
  index("referral_events_fund_id_idx").on(table.fundId),
  index("referral_events_action_idx").on(table.action),
]);

export const referralEventsRelations = relations(referralEvents, ({ one }) => ({
  fund: one(funds, { fields: [referralEvents.fundId], references: [funds.id] }),
  event: one(events, { fields: [referralEvents.eventId], references: [events.id] }),
}));

export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("processing"), // processing | processed | failed
  attempts: integer("attempts").notNull().default(1),
  error: text("error"),
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => [
  index("webhook_events_type_idx").on(table.eventType),
  index("webhook_events_status_idx").on(table.status),
]);

// Blocked gifters. Two scopes:
//   - 'global'  : admin-applied. Email (or userId, if known) cannot
//                 contribute to ANY fund. Set at the T&S queue when an
//                 admin escalates / removes content from a gifter
//                 deemed unsafe across the platform.
//   - 'fund'    : parent-applied. Email cannot contribute to THIS fund.
//                 Reserved for v1.5; not surfaced yet (the parent's
//                 today-equivalent is "ignore the notification + remove
//                 the memory entry"). Keeping the column for the future.
// Check at gift checkout: any inbound gift whose sender_email (or
// authenticated userId) matches a global block, or a fund-scoped
// block for the target fund, is rejected before payment.
export const blockedGifters = pgTable("blocked_gifters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Either email OR userId must be non-null. Both can be set when an
  // admin blocks a known account holder by both vectors.
  email: text("email"),
  userId: varchar("user_id").references(() => users.id),
  scope: text("scope").notNull().default("global"),
  // Null when scope='global'; required when scope='fund'.
  fundId: varchar("fund_id").references(() => funds.id),
  reason: text("reason"),
  blockedByUserId: varchar("blocked_by_user_id").references(() => users.id),
  blockedAt: timestamp("blocked_at").defaultNow(),
  // When a block is reversed, this is set instead of deleting the row —
  // keeps the audit chain ("was blocked, then unblocked by X on Y").
  unblockedAt: timestamp("unblocked_at"),
  unblockedByUserId: varchar("unblocked_by_user_id").references(() => users.id),
}, (table) => [
  index("blocked_gifters_email_idx").on(table.email),
  index("blocked_gifters_user_id_idx").on(table.userId),
  index("blocked_gifters_scope_idx").on(table.scope),
  index("blocked_gifters_fund_id_idx").on(table.fundId),
]);

// User-submitted content reports. A real T&S queue lives off this table
// plus the moderation_status field on memory_entries. The two paths into
// the queue are: (1) a user clicks "Report" on a public surface (kid
// view, gifter share, memory book), (2) an automated scanner (future
// CSAM hookup) writes a row and pre-flags the target. Resolution is
// recorded inline so the queue can stay tight (open vs resolved).
//
// targetType + targetId are intentionally loose strings so the table can
// service future content types (gifts, thank-yous, profile photos, etc.)
// without a schema change.
export const contentReports = pgTable("content_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  // Reporter may be authenticated (userId set) or anonymous (email or
  // device fingerprint only). Either branch is acceptable — the bar for
  // submitting a report should be low.
  reporterUserId: varchar("reporter_user_id").references(() => users.id),
  reporterEmail: text("reporter_email"),
  reason: text("reason").notNull(),
  // Free-form context the reporter or auto-flagger attached. JSON string
  // for query-friendliness without forcing a jsonb migration on the
  // append-only path.
  context: text("context"),
  // Resolution state. null = open. Once an admin acts on the underlying
  // target, the corresponding reports get resolved with a pointer to the
  // action taken (approved / hidden / removed / escalated).
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("content_reports_target_idx").on(table.targetType, table.targetId),
  index("content_reports_resolution_idx").on(table.resolution),
  index("content_reports_created_idx").on(table.createdAt),
]);

export const contentReportsRelations = relations(contentReports, ({ one }) => ({
  reporter: one(users, { fields: [contentReports.reporterUserId], references: [users.id] }),
  resolver: one(users, { fields: [contentReports.resolvedByUserId], references: [users.id] }),
}));

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("audit_logs_user_idx").on(table.userId),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_resource_idx").on(table.resourceType),
]);

// Lightweight first-party product analytics. Server-side only — no third-
// party tracking pixel, no kid data shipped off-platform. Powers the
// admin /funnels surface (parent + gifter activation).
//
// Design notes:
// - `eventName` is a stable string ('signup', 'fund_created',
//   'share_link_visited', 'gift_started', 'gift_completed'). Kept as
//   text so adding new events doesn't need a migration.
// - `userId` and `fundId` are nullable: gifters are anonymous,
//   share-link visits don't have a fund-owner session.
// - `props` JSONB carries event-specific fields (amount, source,
//   referrer). Keep small.
// - Writes are fire-and-forget via `recordEvent()`; errors swallowed
//   so analytics never break a request path.
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventName: text("event_name").notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  userId: varchar("user_id").references(() => users.id),
  fundId: varchar("fund_id").references(() => funds.id),
  sessionId: text("session_id"),
  source: text("source"), // 'web' | 'mobile' | 'webhook' | 'public'
  props: jsonb("props"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => [
  index("analytics_events_name_idx").on(table.eventName),
  index("analytics_events_occurred_idx").on(table.occurredAt),
  index("analytics_events_user_idx").on(table.userId),
  index("analytics_events_fund_idx").on(table.fundId),
]);

// Gifter-led acquisition: pending gift intents created by a gifter
// for a child whose parent hasn't set up a Kiddo fund yet. Per
// GIFTER_LED_ACQUISITION_SPEC.md. V1 ships as warm-promise (no
// card upfront); V2 may add Stripe SetupIntent for pre-auth.
//
// Lifecycle:
//   pending  -> intent created, nudge email sent to parent, awaiting setup
//   paired   -> parent created a fund matching this intent; fund_id set
//   completed -> gifter completed the actual gift payment after pairing
//   cancelled -> gifter cancelled before completion
//   expired  -> 60+ days passed with no parent action
//
// The pairing logic runs in POST /api/funds when a parent creates a
// new fund: any pending intent matching the parent's email AND the
// kid's first name (case-insensitive) gets paired automatically.
export const giftIntents = pgTable("gift_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Token for the nudge URL the parent receives. Unguessable; rotates
  // never (revoked by status change).
  token: text("token").notNull().unique(),
  // Gifter side. Nullable userId because anonymous-creation may be
  // added later; V1 requires gifter signup so this is always set.
  gifterUserId: varchar("gifter_user_id").references(() => users.id),
  gifterName: text("gifter_name").notNull(),
  gifterEmail: text("gifter_email").notNull(),
  // Recipient side. Email is required; phone is V2.
  recipientEmail: text("recipient_email").notNull(),
  recipientPhone: text("recipient_phone"),
  // Kid identifier. First name is the matching key for auto-pair
  // since the kid likely doesn't have a Kiddo presence yet. Birthdate
  // is optional but improves pairing precision when present.
  kidFirstName: text("kid_first_name").notNull(),
  kidBirthdate: text("kid_birthdate"),
  // The intent's economic core. Amount is the gifter's stated gift;
  // message is the personal note (490-char Stripe-metadata cap).
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  message: text("message"),
  // Pairing state. fundId is set when the parent creates a matching fund.
  status: text("status").notNull().default("pending"),
  fundId: varchar("fund_id").references(() => funds.id),
  // Timestamps for the lifecycle. Expires at 60 days from creation
  // unless gifter extends. Reminder cadence: 7d, 30d nudges to parent.
  createdAt: timestamp("created_at").defaultNow(),
  pairedAt: timestamp("paired_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  expiresAt: timestamp("expires_at"),
  // Last reminder fired so the worker doesn't double-send.
  lastReminderAt: timestamp("last_reminder_at"),
}, (table) => [
  index("gift_intents_token_idx").on(table.token),
  index("gift_intents_recipient_email_idx").on(table.recipientEmail),
  index("gift_intents_gifter_user_id_idx").on(table.gifterUserId),
  index("gift_intents_status_idx").on(table.status),
]);

export const insertFundSchema = createInsertSchema(funds).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHoldingSchema = createInsertSchema(holdings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFundSnapshotSchema = createInsertSchema(fundSnapshots).omit({ id: true, createdAt: true });
export const insertGiftSchema = createInsertSchema(gifts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGifterSchema = createInsertSchema(gifters).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGifterFundSchema = createInsertSchema(gifterFunds).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFundMembershipSchema = createInsertSchema(fundMemberships).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).omit({ id: true, createdAt: true });
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, createdAt: true });
export const insertThankYouSchema = createInsertSchema(thankYous).omit({ id: true, createdAt: true });
export const insertRecurringGiftSchema = createInsertSchema(recurringGifts).omit({ id: true, createdAt: true });
export const insertParentContributionSchema = createInsertSchema(parentContributions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFundCollaboratorSchema = createInsertSchema(fundCollaborators).omit({ id: true, invitedAt: true });
export const insertReferralEventSchema = createInsertSchema(referralEvents).omit({ id: true, createdAt: true });
export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ id: true, receivedAt: true, processedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertGiftIntentSchema = createInsertSchema(giftIntents).omit({ id: true, token: true, createdAt: true, pairedAt: true, completedAt: true, cancelledAt: true, expiresAt: true, lastReminderAt: true });

export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof funds.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;
export type InsertFundSnapshot = z.infer<typeof insertFundSnapshotSchema>;
export type FundSnapshot = typeof fundSnapshots.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type Gift = typeof gifts.$inferSelect;
export type InsertGifter = z.infer<typeof insertGifterSchema>;
export type Gifter = typeof gifters.$inferSelect;
export type InsertGifterFund = z.infer<typeof insertGifterFundSchema>;
export type GifterFund = typeof gifterFunds.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertFundMembership = z.infer<typeof insertFundMembershipSchema>;
export type FundMembership = typeof fundMemberships.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertThankYou = z.infer<typeof insertThankYouSchema>;
export type ThankYou = typeof thankYous.$inferSelect;
export type InsertRecurringGift = z.infer<typeof insertRecurringGiftSchema>;
export type RecurringGift = typeof recurringGifts.$inferSelect;
export type InsertParentContribution = z.infer<typeof insertParentContributionSchema>;
export type ParentContribution = typeof parentContributions.$inferSelect;
export type InsertFundCollaborator = z.infer<typeof insertFundCollaboratorSchema>;
export type FundCollaborator = typeof fundCollaborators.$inferSelect;
export type InsertReferralEvent = z.infer<typeof insertReferralEventSchema>;
export type ReferralEvent = typeof referralEvents.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertGiftIntent = z.infer<typeof insertGiftIntentSchema>;
export type GiftIntent = typeof giftIntents.$inferSelect;
