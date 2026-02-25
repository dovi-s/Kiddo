import { 
  funds, events, holdings, gifts, activities, subscriptions, transactions, memoryEntries, bankAccounts,
  thankYous, recurringGifts, fundCollaborators,
  type Fund, type InsertFund,
  type Event, type InsertEvent,
  type Holding, type InsertHolding,
  type Gift, type InsertGift,
  type Activity, type InsertActivity,
  type Subscription, type InsertSubscription,
  type Transaction, type InsertTransaction,
  type MemoryEntry, type InsertMemoryEntry,
  type BankAccount, type InsertBankAccount,
  type ThankYou, type InsertThankYou,
  type RecurringGift, type InsertRecurringGift,
  type FundCollaborator, type InsertFundCollaborator,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  getFund(id: string): Promise<Fund | undefined>;
  getFundBySlug(slug: string): Promise<Fund | undefined>;
  getFundsByUser(userId: string): Promise<Fund[]>;
  createFund(fund: InsertFund): Promise<Fund>;
  updateFund(id: string, fund: Partial<InsertFund>): Promise<Fund | undefined>;
  deleteFund(id: string): Promise<void>;

  getEvent(id: string): Promise<Event | undefined>;
  getEventBySlug(slug: string): Promise<Event | undefined>;
  getEventsByFund(fundId: string): Promise<Event[]>;
  getEventsByUser(userId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;

  getHoldingsByFund(fundId: string): Promise<Holding[]>;
  getHoldingByFundAndTicker(fundId: string, ticker: string): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: string, holding: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: string): Promise<void>;

  getGift(id: string): Promise<Gift | undefined>;
  getGiftsByFund(fundId: string): Promise<Gift[]>;
  getGiftsByEvent(eventId: string): Promise<Gift[]>;
  createGift(gift: InsertGift): Promise<Gift>;
  updateGift(id: string, gift: Partial<InsertGift>): Promise<Gift | undefined>;

  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByUser(userId: string, limit?: number): Promise<Activity[]>;
  getActivitiesByFund(fundId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  getSubscription(userId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  upsertSubscription(subscription: InsertSubscription): Promise<Subscription>;
  ensureSubscription(userId: string): Promise<Subscription>;

  getGiftByPaymentIntent(paymentIntentId: string): Promise<Gift | undefined>;
  incrementEventGiftStats(eventId: string, amount: number): Promise<void>;

  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: string, limit?: number): Promise<Transaction[]>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;

  getMemoryEntriesByFund(fundId: string): Promise<MemoryEntry[]>;
  createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry>;
  deleteMemoryEntry(id: string): Promise<void>;

  getBankAccountsByUser(userId: string): Promise<BankAccount[]>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  deleteBankAccount(id: string): Promise<void>;

  getThankYousByFund(fundId: string): Promise<ThankYou[]>;
  createThankYou(thankYou: InsertThankYou): Promise<ThankYou>;
  updateThankYou(id: string, thankYou: Partial<InsertThankYou>): Promise<ThankYou | undefined>;

  getRecurringGiftsByFund(fundId: string): Promise<RecurringGift[]>;
  createRecurringGift(gift: InsertRecurringGift): Promise<RecurringGift>;
  updateRecurringGift(id: string, gift: Partial<InsertRecurringGift>): Promise<RecurringGift | undefined>;

  getCollaboratorsByFund(fundId: string): Promise<FundCollaborator[]>;
  createCollaborator(collaborator: InsertFundCollaborator): Promise<FundCollaborator>;
  updateCollaborator(id: string, collaborator: Partial<InsertFundCollaborator>): Promise<FundCollaborator | undefined>;
  deleteCollaborator(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getFund(id: string): Promise<Fund | undefined> {
    const [fund] = await db.select().from(funds).where(eq(funds.id, id));
    return fund;
  }

  async getFundBySlug(slug: string): Promise<Fund | undefined> {
    const [fund] = await db.select().from(funds).where(eq(funds.slug, slug));
    return fund;
  }

  async getFundsByUser(userId: string): Promise<Fund[]> {
    return db.select().from(funds).where(eq(funds.userId, userId)).orderBy(desc(funds.createdAt));
  }

  async createFund(fund: InsertFund): Promise<Fund> {
    const [created] = await db.insert(funds).values(fund).returning();
    return created;
  }

  async updateFund(id: string, fund: Partial<InsertFund>): Promise<Fund | undefined> {
    const [updated] = await db.update(funds).set({ ...fund, updatedAt: new Date() }).where(eq(funds.id, id)).returning();
    return updated;
  }

  async deleteFund(id: string): Promise<void> {
    await db.delete(funds).where(eq(funds.id, id));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEventBySlug(slug: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.slug, slug));
    return event;
  }

  async getEventsByFund(fundId: string): Promise<Event[]> {
    return db.select().from(events).where(eq(events.fundId, fundId)).orderBy(desc(events.createdAt));
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    return db.select().from(events).where(eq(events.userId, userId)).orderBy(desc(events.createdAt));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updated] = await db.update(events).set({ ...event, updatedAt: new Date() }).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async getHoldingsByFund(fundId: string): Promise<Holding[]> {
    return db.select().from(holdings).where(eq(holdings.fundId, fundId));
  }

  async getHoldingByFundAndTicker(fundId: string, ticker: string): Promise<Holding | undefined> {
    const [holding] = await db.select().from(holdings).where(and(eq(holdings.fundId, fundId), eq(holdings.ticker, ticker)));
    return holding;
  }

  async createHolding(holding: InsertHolding): Promise<Holding> {
    const [created] = await db.insert(holdings).values(holding).returning();
    return created;
  }

  async updateHolding(id: string, holding: Partial<InsertHolding>): Promise<Holding | undefined> {
    const [updated] = await db.update(holdings).set({ ...holding, updatedAt: new Date() }).where(eq(holdings.id, id)).returning();
    return updated;
  }

  async deleteHolding(id: string): Promise<void> {
    await db.delete(holdings).where(eq(holdings.id, id));
  }

  async getGift(id: string): Promise<Gift | undefined> {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id));
    return gift;
  }

  async getGiftsByFund(fundId: string): Promise<Gift[]> {
    return db.select().from(gifts).where(eq(gifts.fundId, fundId)).orderBy(desc(gifts.createdAt));
  }

  async getGiftsByEvent(eventId: string): Promise<Gift[]> {
    return db.select().from(gifts).where(eq(gifts.eventId, eventId)).orderBy(desc(gifts.createdAt));
  }

  async createGift(gift: InsertGift): Promise<Gift> {
    const [created] = await db.insert(gifts).values(gift).returning();
    return created;
  }

  async updateGift(id: string, gift: Partial<InsertGift>): Promise<Gift | undefined> {
    const [updated] = await db.update(gifts).set({ ...gift, updatedAt: new Date() }).where(eq(gifts.id, id)).returning();
    return updated;
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity;
  }

  async getActivitiesByUser(userId: string, limit = 50): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.userId, userId)).orderBy(desc(activities.createdAt)).limit(limit);
  }

  async getActivitiesByFund(fundId: string, limit = 50): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.fundId, fundId)).orderBy(desc(activities.createdAt)).limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return sub;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return sub;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [created] = await db.insert(subscriptions).values(subscription).returning();
    return created;
  }

  async updateSubscription(id: string, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updated] = await db.update(subscriptions).set({ ...subscription, updatedAt: new Date() }).where(eq(subscriptions.id, id)).returning();
    return updated;
  }

  async upsertSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const existing = await this.getSubscription(subscription.userId);
    if (existing) {
      const updated = await this.updateSubscription(existing.id, subscription);
      return updated!;
    }
    return this.createSubscription(subscription);
  }

  async ensureSubscription(userId: string): Promise<Subscription> {
    const existing = await this.getSubscription(userId);
    if (existing) return existing;
    return this.createSubscription({
      userId,
      plan: 'free',
      billingInterval: 'none',
      status: 'active',
    });
  }

  async getGiftByPaymentIntent(paymentIntentId: string): Promise<Gift | undefined> {
    const [gift] = await db.select().from(gifts).where(eq(gifts.stripePaymentIntentId, paymentIntentId));
    return gift;
  }

  async incrementEventGiftStats(eventId: string, amount: number): Promise<void> {
    await db.update(events).set({
      giftVolume: sql`${events.giftVolume} + ${amount}`,
      giftCount: sql`${events.giftCount} + 1`,
      updatedAt: new Date(),
    }).where(eq(events.id, eventId));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async getTransactionsByUser(userId: string, limit = 50): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(limit);
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [updated] = await db.update(transactions).set({ ...transaction, updatedAt: new Date() }).where(eq(transactions.id, id)).returning();
    return updated;
  }

  async getMemoryEntriesByFund(fundId: string): Promise<MemoryEntry[]> {
    return db.select().from(memoryEntries).where(eq(memoryEntries.fundId, fundId)).orderBy(desc(memoryEntries.createdAt));
  }

  async createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry> {
    const [created] = await db.insert(memoryEntries).values(entry).returning();
    return created;
  }

  async deleteMemoryEntry(id: string): Promise<void> {
    await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
  }

  async getBankAccountsByUser(userId: string): Promise<BankAccount[]> {
    return db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId)).orderBy(desc(bankAccounts.createdAt));
  }

  async createBankAccount(account: InsertBankAccount): Promise<BankAccount> {
    const [created] = await db.insert(bankAccounts).values(account).returning();
    return created;
  }

  async deleteBankAccount(id: string): Promise<void> {
    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async getThankYousByFund(fundId: string): Promise<ThankYou[]> {
    return db.select().from(thankYous).where(eq(thankYous.fundId, fundId)).orderBy(desc(thankYous.createdAt));
  }

  async createThankYou(thankYou: InsertThankYou): Promise<ThankYou> {
    const [created] = await db.insert(thankYous).values(thankYou).returning();
    return created;
  }

  async updateThankYou(id: string, thankYou: Partial<InsertThankYou>): Promise<ThankYou | undefined> {
    const [updated] = await db.update(thankYous).set(thankYou).where(eq(thankYous.id, id)).returning();
    return updated;
  }

  async getRecurringGiftsByFund(fundId: string): Promise<RecurringGift[]> {
    return db.select().from(recurringGifts).where(eq(recurringGifts.fundId, fundId)).orderBy(desc(recurringGifts.createdAt));
  }

  async createRecurringGift(gift: InsertRecurringGift): Promise<RecurringGift> {
    const [created] = await db.insert(recurringGifts).values(gift).returning();
    return created;
  }

  async updateRecurringGift(id: string, gift: Partial<InsertRecurringGift>): Promise<RecurringGift | undefined> {
    const [updated] = await db.update(recurringGifts).set(gift).where(eq(recurringGifts.id, id)).returning();
    return updated;
  }

  async getCollaboratorsByFund(fundId: string): Promise<FundCollaborator[]> {
    return db.select().from(fundCollaborators).where(eq(fundCollaborators.fundId, fundId)).orderBy(desc(fundCollaborators.invitedAt));
  }

  async createCollaborator(collaborator: InsertFundCollaborator): Promise<FundCollaborator> {
    const [created] = await db.insert(fundCollaborators).values(collaborator).returning();
    return created;
  }

  async updateCollaborator(id: string, collaborator: Partial<InsertFundCollaborator>): Promise<FundCollaborator | undefined> {
    const [updated] = await db.update(fundCollaborators).set(collaborator).where(eq(fundCollaborators.id, id)).returning();
    return updated;
  }

  async deleteCollaborator(id: string): Promise<void> {
    await db.delete(fundCollaborators).where(eq(fundCollaborators.id, id));
  }
}

export const storage = new DatabaseStorage();
