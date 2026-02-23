import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
import { users } from "./models/auth";

export const funds = pgTable("funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  accountType: text("account_type").notNull().default("UTMA"),
  status: text("status").notNull().default("draft"),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  pendingBalance: decimal("pending_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  totalGain: decimal("total_gain", { precision: 12, scale: 2 }).notNull().default("0"),
  gainPercent: decimal("gain_percent", { precision: 6, scale: 2 }).notNull().default("0"),
  contributorCount: integer("contributor_count").notNull().default(0),
  projectedValue: decimal("projected_value", { precision: 12, scale: 2 }).notNull().default("0"),
  yearsUntilMaturity: integer("years_until_maturity"),
  recipientFirstName: text("recipient_first_name"),
  recipientRelation: text("recipient_relation"),
  recipientBirthdate: timestamp("recipient_birthdate"),
  investmentStrategy: text("investment_strategy").default("auto_invest"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fundsRelations = relations(funds, ({ one, many }) => ({
  user: one(users, { fields: [funds.userId], references: [users.id] }),
  events: many(events),
  holdings: many(holdings),
  gifts: many(gifts),
}));

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  eventType: text("event_type").default("birthday"),
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
]);

export const holdingsRelations = relations(holdings, ({ one }) => ({
  fund: one(funds, { fields: [holdings.fundId], references: [funds.id] }),
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
  executionModel: text("execution_model").default("auto_invest"),
  selectedTicker: text("selected_ticker"),
  status: text("status").notNull().default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  investedAt: timestamp("invested_at"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("gifts_fund_id_idx").on(table.fundId),
  index("gifts_event_id_idx").on(table.eventId),
  index("gifts_status_idx").on(table.status),
]);

export const giftsRelations = relations(gifts, ({ one }) => ({
  fund: one(funds, { fields: [gifts.fundId], references: [funds.id] }),
  event: one(events, { fields: [gifts.eventId], references: [events.id] }),
}));

export const memoryEntries = pgTable("memory_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar("fund_id").notNull().references(() => funds.id),
  giftId: varchar("gift_id").references(() => gifts.id),
  type: text("type").notNull().default("gift_message"),
  content: text("content"),
  authorName: text("author_name"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("memory_entries_fund_id_idx").on(table.fundId),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_stripe_payment_intent_idx").on(table.stripePaymentIntentId),
  index("transactions_type_idx").on(table.type),
  index("transactions_status_idx").on(table.status),
]);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  gift: one(gifts, { fields: [transactions.giftId], references: [gifts.id] }),
  event: one(events, { fields: [transactions.eventId], references: [events.id] }),
  fund: one(funds, { fields: [transactions.fundId], references: [funds.id] }),
}));

export const insertFundSchema = createInsertSchema(funds).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHoldingSchema = createInsertSchema(holdings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGiftSchema = createInsertSchema(gifts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).omit({ id: true, createdAt: true });

export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof funds.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type Gift = typeof gifts.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
