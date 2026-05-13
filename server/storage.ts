import {
  funds, events, holdings, gifts, activities, subscriptions, fundMemberships, transactions, memoryEntries, bankAccounts,
  thankYous, recurringGifts, parentContributions, fundCollaborators, giftAllocations,
  type Fund, type InsertFund,
  type Event, type InsertEvent,
  type Holding, type InsertHolding,
  type Gift, type InsertGift,
  type Activity, type InsertActivity,
  type Subscription, type InsertSubscription,
  type FundMembership, type InsertFundMembership,
  type Transaction, type InsertTransaction,
  type MemoryEntry, type InsertMemoryEntry,
  type BankAccount, type InsertBankAccount,
  type ThankYou, type InsertThankYou,
  type RecurringGift, type InsertRecurringGift,
  type ParentContribution, type InsertParentContribution,
  type FundCollaborator, type InsertFundCollaborator,
  type GiftAllocation, type InsertGiftAllocation,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, asc } from "drizzle-orm";

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

  getGiftAllocationsByFund(fundId: string): Promise<GiftAllocation[]>;
  getGiftAllocationsByFundAndTicker(fundId: string, ticker: string): Promise<GiftAllocation[]>;
  createGiftAllocation(allocation: InsertGiftAllocation): Promise<GiftAllocation>;
  deleteGiftAllocationsByGift(giftId: string): Promise<void>;
  deleteGiftAllocationsByFundAndTicker(fundId: string, ticker: string): Promise<void>;
  scaleGiftAllocationsByFundAndTicker(fundId: string, ticker: string, scale: number): Promise<void>;

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
  getFundMembership(userId: string, fundId: string): Promise<FundMembership | undefined>;
  getFundMembershipByStripeId(stripeSubscriptionId: string): Promise<FundMembership | undefined>;
  getFundMembershipsByUser(userId: string): Promise<FundMembership[]>;
  upsertFundMembership(membership: InsertFundMembership): Promise<FundMembership>;
  updateFundMembership(id: string, membership: Partial<InsertFundMembership>): Promise<FundMembership | undefined>;

  getGiftByPaymentIntent(paymentIntentId: string): Promise<Gift | undefined>;
  incrementEventGiftStats(eventId: string, amount: number): Promise<void>;

  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: string, limit?: number): Promise<Transaction[]>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;

  getMemoryEntriesByFund(fundId: string): Promise<MemoryEntry[]>;
  createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry>;
  updateMemoryEntry(id: string, entry: Partial<InsertMemoryEntry>): Promise<MemoryEntry | undefined>;
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

  getParentContributionsByFund(fundId: string): Promise<ParentContribution[]>;
  getParentContributionsByUser(userId: string): Promise<ParentContribution[]>;
  createParentContribution(contribution: InsertParentContribution): Promise<ParentContribution>;
  updateParentContribution(id: string, data: Partial<InsertParentContribution>): Promise<ParentContribution | undefined>;
  pauseScheduledItemsForUserOnSubscriptionEnd(userId: string): Promise<{ parentContributionsPaused: number; recurringGiftsPaused: number }>;
  resumeScheduledItemsForUserAfterSubscriptionRestart(userId: string): Promise<{ parentContributionsResumed: number; recurringGiftsResumed: number }>;
  deleteParentContribution(id: string): Promise<void>;

  getCollaboratorsByFund(fundId: string): Promise<FundCollaborator[]>;
  createCollaborator(collaborator: InsertFundCollaborator): Promise<FundCollaborator>;
  updateCollaborator(id: string, collaborator: Partial<InsertFundCollaborator>): Promise<FundCollaborator | undefined>;
  deleteCollaborator(id: string): Promise<void>;
  // Resolve an accepted collaborator for the (fund, user) pair. Used by the
  // fund-auth middleware to decide if a non-owner can act on a fund.
  getCollaboratorForFundAndUser(fundId: string, userId: string): Promise<FundCollaborator | undefined>;
  // Look an invitation up by its bearer token. Public-flow only (preview +
  // accept pages call this without auth).
  getCollaboratorByToken(token: string): Promise<FundCollaborator | undefined>;
  // Pending invitations addressed to this email (case-insensitive) OR
  // already attached to this userId. The OR covers both flows: an invite
  // sent to an email that isn't yet a Kora user (matches by email after
  // signup) and an invite that was accepted on a prior session (matches by
  // userId in case the email later changes).
  getPendingInvitationsForUser(userId: string, email: string): Promise<FundCollaborator[]>;
  // Funds the user has been accepted into as a collaborator. Returns the
  // joined fund rows so the my-funds endpoint can union owned + shared in
  // one trip.
  getCollaboratedFunds(userId: string): Promise<Array<Fund & { accessRole: 'co-admin' | 'viewer' }>>;
  // Delete all collaborator rows for a fund. Called on close-fund and on
  // the age-18 ownership handoff — collaborators do not survive a
  // closure or a UTMA transfer to the now-adult child.
  deleteCollaboratorsByFund(fundId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getFund(id: string): Promise<Fund | undefined> {
    const [fund] = await db.select().from(funds).where(eq(funds.id, id));
    return fund;
  }

  async getFundBySlug(slug: string): Promise<Fund | undefined> {
    const [fund] = await db
      .select()
      .from(funds)
      .where(eq(funds.slug, slug))
      .orderBy(asc(funds.createdAt));
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

  async getGiftAllocationsByFund(fundId: string): Promise<GiftAllocation[]> {
    return db.select().from(giftAllocations).where(eq(giftAllocations.fundId, fundId));
  }

  async getGiftAllocationsByFundAndTicker(fundId: string, ticker: string): Promise<GiftAllocation[]> {
    return db.select().from(giftAllocations).where(and(
      eq(giftAllocations.fundId, fundId),
      eq(giftAllocations.ticker, ticker.toUpperCase()),
    ));
  }

  async createGiftAllocation(allocation: InsertGiftAllocation): Promise<GiftAllocation> {
    const [created] = await db.insert(giftAllocations).values(allocation).returning();
    return created;
  }

  async deleteGiftAllocationsByGift(giftId: string): Promise<void> {
    await db.delete(giftAllocations).where(eq(giftAllocations.giftId, giftId));
  }

  async deleteGiftAllocationsByFundAndTicker(fundId: string, ticker: string): Promise<void> {
    await db.delete(giftAllocations).where(and(
      eq(giftAllocations.fundId, fundId),
      eq(giftAllocations.ticker, ticker.toUpperCase()),
    ));
  }

  // Multiply every allocation's cost_basis and shares by `scale` for a fund+ticker.
  // Used by partial sells: if a user sells half of AAPL, every Apple allocation halves
  // so per-gift attribution stays proportional to the remaining holding.
  async scaleGiftAllocationsByFundAndTicker(fundId: string, ticker: string, scale: number): Promise<void> {
    if (!Number.isFinite(scale) || scale < 0) return;
    if (scale >= 0.9999 && scale <= 1.0001) return;
    await db.execute(sql`
      UPDATE gift_allocations
      SET
        cost_basis = ROUND((cost_basis::numeric * ${scale}::numeric)::numeric, 2),
        shares = CASE WHEN shares IS NULL THEN NULL ELSE ROUND((shares::numeric * ${scale}::numeric)::numeric, 6) END
      WHERE fund_id = ${fundId} AND ticker = ${ticker.toUpperCase()}
    `);
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

  async getFundMembership(userId: string, fundId: string): Promise<FundMembership | undefined> {
    const [membership] = await db
      .select()
      .from(fundMemberships)
      .where(and(eq(fundMemberships.userId, userId), eq(fundMemberships.fundId, fundId)));
    return membership;
  }

  async getFundMembershipByStripeId(stripeSubscriptionId: string): Promise<FundMembership | undefined> {
    const [membership] = await db
      .select()
      .from(fundMemberships)
      .where(eq(fundMemberships.stripeSubscriptionId, stripeSubscriptionId));
    return membership;
  }

  async getFundMembershipsByUser(userId: string): Promise<FundMembership[]> {
    return db
      .select()
      .from(fundMemberships)
      .where(eq(fundMemberships.userId, userId))
      .orderBy(desc(fundMemberships.createdAt));
  }

  async upsertFundMembership(membership: InsertFundMembership): Promise<FundMembership> {
    const existing = await this.getFundMembership(membership.userId, membership.fundId);
    if (existing) {
      const updated = await this.updateFundMembership(existing.id, membership);
      return updated!;
    }
    const [created] = await db.insert(fundMemberships).values(membership).returning();
    return created;
  }

  async updateFundMembership(id: string, membership: Partial<InsertFundMembership>): Promise<FundMembership | undefined> {
    const [updated] = await db
      .update(fundMemberships)
      .set({ ...membership, updatedAt: new Date() })
      .where(eq(fundMemberships.id, id))
      .returning();
    return updated;
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
    // Three filters layered here, all user-facing surfaces (parent memory
    // book, kid view, gifter share) call this. Admin browses use raw
    // /api/admin/memory which bypasses these.
    //
    // 1. T&S — exclude admin-hidden / removed / escalated entries.
    // 2. Memory Book inversion — exclude legacy auto-generated boilerplate
    //    rows. The write path no longer creates these as of the inversion
    //    fix, but existing rows persist in the DB from before. The two
    //    patterns are:
    //      - "<sender> sent a gift of $<amount>." (the silent-gift
    //        template that polluted Emma's book before the fix)
    //      - "Auto-invest contribution to <fund name>" (the recurring
    //        worker boilerplate before its own fix landed)
    //    Both patterns are excluded ONLY when there is no media attached
    //    — if the entry has a photo / video / voice, the media is the
    //    entry regardless of what's in content.
    // 3. (Already in place) — moderation status filter above.
    const rows = await db.select().from(memoryEntries)
      .where(and(
        eq(memoryEntries.fundId, fundId),
        sql`(${memoryEntries.moderationStatus} IS NULL OR ${memoryEntries.moderationStatus} NOT IN ('hidden','removed','escalated'))`,
      ))
      .orderBy(desc(memoryEntries.createdAt));

    return rows.filter((entry) => {
      const hasMedia = Boolean(entry.photoUrl) || Boolean(entry.videoUrl) || Boolean(entry.audioUrl);
      if (hasMedia) return true;
      const content = String(entry.content || "").trim();
      if (!content) {
        // Entry has neither content nor media — nothing real to surface.
        // Belt-and-suspenders: the inversion-fix write path skips
        // creating these now, but legacy rows might exist.
        return false;
      }
      // Match the two known auto-generated boilerplate patterns.
      const isSilentGiftTemplate = / sent a gift of \$\d/i.test(content);
      const isAutoInvestBoilerplate = /^auto-invest contribution to /i.test(content);
      return !isSilentGiftTemplate && !isAutoInvestBoilerplate;
    });
  }

  async createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry> {
    const [created] = await db.insert(memoryEntries).values(entry).returning();
    return created;
  }

  async updateMemoryEntry(id: string, entry: Partial<InsertMemoryEntry>): Promise<MemoryEntry | undefined> {
    const [updated] = await db.update(memoryEntries).set(entry).where(eq(memoryEntries.id, id)).returning();
    return updated;
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

  async getParentContributionsByFund(fundId: string): Promise<ParentContribution[]> {
    return db.select().from(parentContributions).where(eq(parentContributions.fundId, fundId)).orderBy(desc(parentContributions.createdAt));
  }

  async getParentContributionsByUser(userId: string): Promise<ParentContribution[]> {
    return db.select().from(parentContributions).where(eq(parentContributions.userId, userId)).orderBy(desc(parentContributions.createdAt));
  }

  async createParentContribution(contribution: InsertParentContribution): Promise<ParentContribution> {
    const [created] = await db.insert(parentContributions).values(contribution).returning();
    return created;
  }

  async updateParentContribution(id: string, data: Partial<InsertParentContribution>): Promise<ParentContribution | undefined> {
    const [updated] = await db.update(parentContributions).set({ ...data, updatedAt: new Date() }).where(eq(parentContributions.id, id)).returning();
    return updated;
  }

  async deleteParentContribution(id: string): Promise<void> {
    await db.delete(parentContributions).where(eq(parentContributions.id, id));
  }

  // === Subscription cascade helpers ===
  // When a household's paid plan ends, every active parent_contribution and
  // recurring_gift across all of the user's funds is auto-paused with
  // pause_reason="subscription_ended". Reactivating the plan flips them back to
  // active (only the rows we paused — manually-paused rows stay paused).

  async pauseScheduledItemsForUserOnSubscriptionEnd(userId: string): Promise<{ parentContributionsPaused: number; recurringGiftsPaused: number }> {
    const userFunds = await db.select({ id: funds.id }).from(funds).where(eq(funds.userId, userId));
    const fundIds = userFunds.map(f => f.id);
    if (fundIds.length === 0) return { parentContributionsPaused: 0, recurringGiftsPaused: 0 };

    const parentRes = await db.execute(sql`
      UPDATE parent_contributions
      SET status = 'paused',
          pause_reason = 'subscription_ended',
          paused_at = NOW(),
          updated_at = NOW()
      WHERE fund_id = ANY(${fundIds})
        AND status = 'active'
      RETURNING id
    `);
    const parentContributionsPaused = (parentRes as any).rowCount ?? (parentRes as any).rows?.length ?? 0;

    const giftRes = await db.execute(sql`
      UPDATE recurring_gifts
      SET status = 'paused',
          pause_reason = 'subscription_ended',
          paused_at = NOW()
      WHERE fund_id = ANY(${fundIds})
        AND status = 'active'
      RETURNING id
    `);
    const recurringGiftsPaused = (giftRes as any).rowCount ?? (giftRes as any).rows?.length ?? 0;

    return { parentContributionsPaused, recurringGiftsPaused };
  }

  async resumeScheduledItemsForUserAfterSubscriptionRestart(userId: string): Promise<{ parentContributionsResumed: number; recurringGiftsResumed: number }> {
    const userFunds = await db.select({ id: funds.id }).from(funds).where(eq(funds.userId, userId));
    const fundIds = userFunds.map(f => f.id);
    if (fundIds.length === 0) return { parentContributionsResumed: 0, recurringGiftsResumed: 0 };

    const parentRes = await db.execute(sql`
      UPDATE parent_contributions
      SET status = 'active',
          pause_reason = NULL,
          paused_at = NULL,
          updated_at = NOW()
      WHERE fund_id = ANY(${fundIds})
        AND status = 'paused'
        AND pause_reason = 'subscription_ended'
      RETURNING id
    `);
    const parentContributionsResumed = (parentRes as any).rowCount ?? (parentRes as any).rows?.length ?? 0;

    const giftRes = await db.execute(sql`
      UPDATE recurring_gifts
      SET status = 'active',
          pause_reason = NULL,
          paused_at = NULL
      WHERE fund_id = ANY(${fundIds})
        AND status = 'paused'
        AND pause_reason = 'subscription_ended'
      RETURNING id
    `);
    const recurringGiftsResumed = (giftRes as any).rowCount ?? (giftRes as any).rows?.length ?? 0;

    return { parentContributionsResumed, recurringGiftsResumed };
  }

  async getCollaboratorsByFund(fundId: string): Promise<FundCollaborator[]> {
    return db.select().from(fundCollaborators).where(eq(fundCollaborators.fundId, fundId)).orderBy(desc(fundCollaborators.invitedAt));
  }

  async createCollaborator(collaborator: InsertFundCollaborator): Promise<FundCollaborator> {
    // Auto-generate the acceptance token if the caller didn't supply one.
    // Email is lowercased here (not in the schema) because Postgres text
    // columns are case-sensitive and we want "Alice@x.com" and
    // "alice@x.com" to match the same invite when the invitee signs up.
    const cryptoMod = await import('crypto');
    const payload: any = { ...collaborator };
    if (!payload.token) payload.token = cryptoMod.randomUUID();
    if (typeof payload.email === 'string') payload.email = payload.email.trim().toLowerCase();
    const [created] = await db.insert(fundCollaborators).values(payload).returning();
    return created;
  }

  async updateCollaborator(id: string, collaborator: Partial<InsertFundCollaborator>): Promise<FundCollaborator | undefined> {
    const [updated] = await db.update(fundCollaborators).set(collaborator).where(eq(fundCollaborators.id, id)).returning();
    return updated;
  }

  async deleteCollaborator(id: string): Promise<void> {
    await db.delete(fundCollaborators).where(eq(fundCollaborators.id, id));
  }

  async getCollaboratorForFundAndUser(fundId: string, userId: string): Promise<FundCollaborator | undefined> {
    // The middleware path: a non-owner is acting on a fund. Match on
    // fundId + userId + status='accepted'. We intentionally do NOT
    // fall through to email matching here — once a row has a userId it
    // belongs to that account; email-based matching is the pre-acceptance
    // path and lives in getPendingInvitationsForUser.
    const [row] = await db.select().from(fundCollaborators)
      .where(and(
        eq(fundCollaborators.fundId, fundId),
        eq(fundCollaborators.userId, userId),
        eq(fundCollaborators.status, 'accepted'),
      ));
    return row;
  }

  async getCollaboratorByToken(token: string): Promise<FundCollaborator | undefined> {
    if (!token) return undefined;
    const [row] = await db.select().from(fundCollaborators).where(eq(fundCollaborators.token, token));
    return row;
  }

  async getPendingInvitationsForUser(userId: string, email: string): Promise<FundCollaborator[]> {
    // Pending = status='pending' AND (email match OR explicit userId).
    // The userId branch is for the rare case where a row was pre-linked
    // (e.g. the invitee's email changed between invite and accept and
    // we already proved their identity another way).
    const normalizedEmail = (email || '').trim().toLowerCase();
    return db.select().from(fundCollaborators)
      .where(and(
        eq(fundCollaborators.status, 'pending'),
        sql`(${fundCollaborators.email} = ${normalizedEmail} OR ${fundCollaborators.userId} = ${userId})`,
      ))
      .orderBy(desc(fundCollaborators.invitedAt));
  }

  async getCollaboratedFunds(userId: string): Promise<Array<Fund & { accessRole: 'co-admin' | 'viewer' }>> {
    // Inner-join collaborators -> funds for this user's accepted rows.
    // Hand back the fund payload plus the role so the my-funds endpoint
    // can tag each row without a second round trip per fund.
    const rows = await db
      .select({
        fund: funds,
        role: fundCollaborators.role,
      })
      .from(fundCollaborators)
      .innerJoin(funds, eq(funds.id, fundCollaborators.fundId))
      .where(and(
        eq(fundCollaborators.userId, userId),
        eq(fundCollaborators.status, 'accepted'),
      ));
    return rows.map(r => ({
      ...(r.fund as Fund),
      accessRole: (r.role === 'co-admin' ? 'co-admin' : 'viewer') as 'co-admin' | 'viewer',
    }));
  }

  async deleteCollaboratorsByFund(fundId: string): Promise<number> {
    const res = await db.delete(fundCollaborators).where(eq(fundCollaborators.fundId, fundId));
    return (res as any).rowCount ?? (res as any).rows?.length ?? 0;
  }
}

export const storage = new DatabaseStorage();
