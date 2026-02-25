import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated, isAdmin } from "./auth";
import { insertFundSchema, insertEventSchema, insertGiftSchema, insertMemoryEntrySchema, insertBankAccountSchema, insertThankYouSchema, insertRecurringGiftSchema, users, funds, holdings, gifts, events, subscriptions, transactions, bankAccounts, activities, thankYous, recurringGifts } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ===== FUNDS =====
  app.get('/api/funds', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const funds = await storage.getFundsByUser(userId);
      res.json(funds);
    } catch (error) {
      console.error('Error fetching funds:', error);
      res.status(500).json({ error: 'Failed to fetch funds' });
    }
  });

  app.get('/api/funds/:id', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.id);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      res.json(fund);
    } catch (error) {
      console.error('Error fetching fund:', error);
      res.status(500).json({ error: 'Failed to fetch fund' });
    }
  });

  app.post('/api/funds', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const data = insertFundSchema.parse({ ...req.body, userId });
      const fund = await storage.createFund(data);
      
      await storage.createEvent({
        fundId: fund.id,
        userId,
        name: "Gift anytime",
        slug: `${fund.slug}-anytime`,
        isPermanent: true,
        status: "active",
        eventType: "gift_anytime",
      });
      
      res.status(201).json(fund);
    } catch (error) {
      console.error('Error creating fund:', error);
      res.status(500).json({ error: 'Failed to create fund' });
    }
  });

  app.patch('/api/funds/:id', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.id);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updated = await storage.updateFund(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating fund:', error);
      res.status(500).json({ error: 'Failed to update fund' });
    }
  });

  // ===== EVENTS =====
  app.get('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const events = await storage.getEventsByUser(userId);
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  app.get('/api/funds/:fundId/events', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const events = await storage.getEventsByFund(req.params.fundId);
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  app.get('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(event);
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.get('/api/public/events/:slug', async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const fund = await storage.getFund(event.fundId);
      const gifts = await storage.getGiftsByEvent(event.id);
      res.json({ 
        event: {
          id: event.id,
          name: event.name,
          description: event.description,
          imageUrl: event.imageUrl,
          eventDate: event.eventDate,
          eventType: event.eventType,
          theme: event.theme,
          goalAmount: event.goalAmount,
          giftVolume: event.giftVolume,
          giftCount: event.giftCount,
          hasEventPass: event.hasEventPass,
        },
        fund: {
          id: fund?.id,
          name: fund?.name,
          recipientFirstName: fund?.recipientFirstName,
          accountType: fund?.accountType,
        },
        giftCount: gifts.length,
      });
    } catch (error) {
      console.error('Error fetching public event:', error);
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.get('/api/public/funds/:slug', async (req, res) => {
    try {
      const fund = await storage.getFundBySlug(req.params.slug);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      const events = await storage.getEventsByFund(fund.id);
      const permanentEvent = events.find(e => e.isPermanent);
      res.json({ 
        fund: {
          id: fund.id,
          name: fund.name,
          recipientFirstName: fund.recipientFirstName,
          accountType: fund.accountType,
        },
        permanentEventSlug: permanentEvent?.slug,
        eventCount: events.filter(e => !e.isPermanent).length,
      });
    } catch (error) {
      console.error('Error fetching public fund:', error);
      res.status(500).json({ error: 'Failed to fetch fund' });
    }
  });

  app.get('/api/public/funds/:id/overview', async (req, res) => {
    try {
      const fund = await storage.getFund(req.params.id);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      const fundGifts = await storage.getGiftsByFund(fund.id);
      const totalContributed = fundGifts
        .filter((g: any) => g.status === 'completed' || g.status === 'settled')
        .reduce((sum: number, g: any) => sum + parseFloat(g.netAmount || g.amount || '0'), 0);
      res.json({
        id: fund.id,
        name: fund.name,
        recipientFirstName: fund.recipientFirstName,
        accountType: fund.accountType,
        balance: fund.balance,
        totalGain: fund.totalGain,
        totalContributed: totalContributed.toFixed(2),
        giftCount: fundGifts.length,
      });
    } catch (error) {
      console.error('Error fetching public fund overview:', error);
      res.status(500).json({ error: 'Failed to fetch fund' });
    }
  });

  app.get('/api/public/funds/:id/gifts', async (req, res) => {
    try {
      const fund = await storage.getFund(req.params.id);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      const gifts = await storage.getGiftsByFund(fund.id);
      res.json(gifts.map(g => ({
        id: g.id,
        senderName: g.senderName,
        amount: g.amount,
        message: g.message,
        createdAt: g.createdAt,
        status: g.status,
      })));
    } catch (error) {
      console.error('Error fetching public fund gifts:', error);
      res.status(500).json({ error: 'Failed to fetch gifts' });
    }
  });

  app.get('/api/public/funds/:id/memory', async (req, res) => {
    try {
      const fund = await storage.getFund(req.params.id);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      const entries = await storage.getMemoryEntriesByFund(req.params.id);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching public memory:', error);
      res.status(500).json({ error: 'Failed to fetch memory' });
    }
  });

  app.post('/api/funds/activate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { fundId, strategy } = req.body;
      if (!fundId) {
        return res.status(400).json({ error: 'Fund ID is required' });
      }
      const fund = await storage.getFund(fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updated = await storage.updateFund(fundId, {
        status: "active",
        investmentStrategy: strategy || "growth",
      });
      res.json(updated);
    } catch (error) {
      console.error('Error activating fund:', error);
      res.status(500).json({ error: 'Failed to activate fund' });
    }
  });

  // ===== KYC =====
  app.post('/api/kyc/submit', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { personal, identity, strategy } = req.body;

      if (!personal || !identity) {
        return res.status(400).json({ error: 'Personal and identity information are required' });
      }

      const kycData = {
        firstName: personal.firstName,
        lastName: personal.lastName,
        dob: personal.dob,
        address: {
          street: personal.street,
          city: personal.city,
          state: personal.state,
          zip: personal.zip,
        },
        phone: personal.phone,
        citizenship: identity.citizenship,
        employment: identity.employment,
        ssnProvided: true,
      };

      await db.update(users).set({
        kycStatus: 'approved',
        kycSubmittedAt: new Date(),
        kycData: kycData,
        firstName: personal.firstName,
        lastName: personal.lastName,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      const userFunds = await storage.getFundsByUser(userId);
      for (const fund of userFunds) {
        if (fund.status === 'draft') {
          await storage.updateFund(fund.id, {
            status: 'active',
            investmentStrategy: strategy || 'growth',
          });
        }
      }

      await storage.createActivity({
        userId,
        fundId: userFunds[0]?.id,
        type: 'kyc_approved',
        title: 'Identity verified',
        description: 'Your identity has been verified. Your funds are now active and investing.',
      });

      res.json({ status: 'approved', activatedFunds: userFunds.length });
    } catch (error) {
      console.error('Error submitting KYC:', error);
      res.status(500).json({ error: 'Failed to submit KYC' });
    }
  });

  app.get('/api/user/kyc-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const [user] = await db.select({ kycStatus: users.kycStatus, kycSubmittedAt: users.kycSubmittedAt }).from(users).where(eq(users.id, userId));
      res.json({ kycStatus: user?.kycStatus || 'none', kycSubmittedAt: user?.kycSubmittedAt });
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      res.status(500).json({ error: 'Failed to fetch KYC status' });
    }
  });

  // ===== PRIVACY =====
  app.patch('/api/funds/:id/privacy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.id);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const { isDiscoverable } = req.body;
      const updated = await storage.updateFund(req.params.id, { isDiscoverable: !!isDiscoverable });
      res.json(updated);
    } catch (error) {
      console.error('Error updating privacy:', error);
      res.status(500).json({ error: 'Failed to update privacy' });
    }
  });

  // ===== SELL HOLDINGS =====
  app.post('/api/holdings/sell', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { holdingId, fundId, shares } = req.body;

      if (!holdingId || !fundId) {
        return res.status(400).json({ error: 'holdingId and fundId are required' });
      }

      const fund = await storage.getFund(fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const holdingsList = await storage.getHoldingsByFund(fundId);
      const holding = holdingsList.find(h => h.id === holdingId);
      if (!holding) return res.status(404).json({ error: 'Holding not found' });

      const sharesToSell = shares ? parseFloat(shares) : parseFloat(holding.shares);
      if (sharesToSell <= 0 || sharesToSell > parseFloat(holding.shares)) {
        return res.status(400).json({ error: 'Invalid number of shares' });
      }

      const pricePerShare = parseFloat(holding.currentValue) / parseFloat(holding.shares);
      const saleValue = sharesToSell * pricePerShare;
      const remainingShares = parseFloat(holding.shares) - sharesToSell;

      if (remainingShares <= 0.000001) {
        await storage.deleteHolding(holdingId);
      } else {
        const remainingCostBasis = (parseFloat(holding.costBasis) / parseFloat(holding.shares)) * remainingShares;
        const remainingValue = pricePerShare * remainingShares;
        await storage.updateHolding(holdingId, {
          shares: remainingShares.toFixed(6),
          costBasis: remainingCostBasis.toFixed(2),
          currentValue: remainingValue.toFixed(2),
          gain: (remainingValue - remainingCostBasis).toFixed(2),
        });
      }

      const newBalance = parseFloat(fund.balance) - saleValue;
      const newPending = parseFloat(fund.pendingBalance) + saleValue;
      await storage.updateFund(fundId, {
        balance: Math.max(0, newBalance).toFixed(2),
        pendingBalance: newPending.toFixed(2),
      });

      await storage.createActivity({
        userId,
        fundId,
        type: 'sell',
        title: `Sold ${holding.ticker}`,
        description: `Sold ${sharesToSell.toFixed(4)} shares of ${holding.name} for $${saleValue.toFixed(2)}. Cash will settle in 1-2 business days.`,
        amount: saleValue.toFixed(2),
      });

      await storage.createTransaction({
        userId,
        type: 'sell',
        amount: saleValue.toFixed(2),
        status: 'completed',
        description: `Sold ${sharesToSell.toFixed(4)} shares of ${holding.ticker}`,
        fundId,
        completedAt: new Date(),
      });

      res.json({ success: true, saleValue: saleValue.toFixed(2), ticker: holding.ticker, sharesSold: sharesToSell });
    } catch (error) {
      console.error('Error selling holding:', error);
      res.status(500).json({ error: 'Failed to sell holding' });
    }
  });

  // ===== WITHDRAWALS =====
  app.post('/api/withdrawals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { fundId, amount, bankAccountId } = req.body;

      if (!fundId || !amount || !bankAccountId) {
        return res.status(400).json({ error: 'fundId, amount, and bankAccountId are required' });
      }

      const fund = await storage.getFund(fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const bankAccounts = await storage.getBankAccountsByUser(userId);
      const bankAccount = bankAccounts.find(b => b.id === bankAccountId);
      if (!bankAccount) return res.status(404).json({ error: 'Bank account not found' });

      const withdrawAmount = parseFloat(amount);
      const availableCash = parseFloat(fund.pendingBalance);
      if (withdrawAmount <= 0 || withdrawAmount > availableCash) {
        return res.status(400).json({ error: `Insufficient cash. Available: $${availableCash.toFixed(2)}` });
      }

      await storage.updateFund(fundId, {
        pendingBalance: (availableCash - withdrawAmount).toFixed(2),
      });

      await storage.createActivity({
        userId,
        fundId,
        type: 'withdrawal',
        title: 'Cash withdrawal',
        description: `$${withdrawAmount.toFixed(2)} withdrawn to ${bankAccount.bankName} ending in ${bankAccount.accountLast4}. Expect 1-3 business days.`,
        amount: withdrawAmount.toFixed(2),
      });

      await storage.createTransaction({
        userId,
        type: 'withdrawal',
        amount: withdrawAmount.toFixed(2),
        status: 'processing',
        description: `Withdrawal to ${bankAccount.bankName} ****${bankAccount.accountLast4}`,
        fundId,
      });

      res.json({ success: true, amount: withdrawAmount.toFixed(2), bankAccount: { bankName: bankAccount.bankName, last4: bankAccount.accountLast4 } });
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      res.status(500).json({ error: 'Failed to process withdrawal' });
    }
  });

  // ===== BANK ACCOUNTS =====
  app.get('/api/bank-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const accounts = await storage.getBankAccountsByUser(userId);
      res.json(accounts);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      res.status(500).json({ error: 'Failed to fetch bank accounts' });
    }
  });

  app.post('/api/bank-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { bankName, accountLast4, routingLast4, accountType } = req.body;

      if (!bankName || !accountLast4) {
        return res.status(400).json({ error: 'Bank name and account last 4 digits are required' });
      }

      const account = await storage.createBankAccount({
        userId,
        bankName,
        accountLast4,
        routingLast4: routingLast4 || null,
        accountType: accountType || 'checking',
        status: 'active',
      });

      await storage.createActivity({
        userId,
        type: 'bank_linked',
        title: 'Bank account linked',
        description: `${bankName} account ending in ${accountLast4} has been linked.`,
      });

      res.status(201).json(account);
    } catch (error) {
      console.error('Error creating bank account:', error);
      res.status(500).json({ error: 'Failed to link bank account' });
    }
  });

  app.delete('/api/bank-accounts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const accounts = await storage.getBankAccountsByUser(userId);
      const account = accounts.find(a => a.id === req.params.id);
      if (!account) return res.status(404).json({ error: 'Bank account not found' });

      await storage.deleteBankAccount(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      res.status(500).json({ error: 'Failed to remove bank account' });
    }
  });

  // ===== AUTO-INVEST =====
  app.post('/api/funds/:fundId/auto-invest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
      if (fund.status !== 'active') return res.status(400).json({ error: 'Fund must be activated before investing' });

      const cashToInvest = parseFloat(fund.pendingBalance);
      if (cashToInvest <= 0) {
        return res.status(400).json({ error: 'No cash available to invest' });
      }

      const defaultBasket = [
        { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', weight: 0.50 },
        { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', weight: 0.25 },
        { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', weight: 0.15 },
        { ticker: 'VGT', name: 'Vanguard Information Technology ETF', weight: 0.10 },
      ];

      const createdHoldings = [];
      for (const asset of defaultBasket) {
        const investAmount = cashToInvest * asset.weight;
        if (investAmount < 0.01) continue;

        const mockPrices: Record<string, number> = { VTI: 285.42, VXUS: 62.18, BND: 71.35, VGT: 572.90 };
        const price = mockPrices[asset.ticker] || 100;
        const sharesBought = investAmount / price;

        const existing = await storage.getHoldingByFundAndTicker(fund.id, asset.ticker);
        if (existing) {
          const newShares = parseFloat(existing.shares) + sharesBought;
          const newCostBasis = parseFloat(existing.costBasis) + investAmount;
          const newValue = parseFloat(existing.currentValue) + investAmount;
          await storage.updateHolding(existing.id, {
            shares: newShares.toFixed(6),
            costBasis: newCostBasis.toFixed(2),
            currentValue: newValue.toFixed(2),
            gain: (newValue - newCostBasis).toFixed(2),
          });
        } else {
          await storage.createHolding({
            fundId: fund.id,
            ticker: asset.ticker,
            name: asset.name,
            shares: sharesBought.toFixed(6),
            costBasis: investAmount.toFixed(2),
            currentValue: investAmount.toFixed(2),
            gain: '0.00',
          });
        }
        createdHoldings.push({ ticker: asset.ticker, shares: sharesBought, value: investAmount });
      }

      await storage.updateFund(fund.id, {
        balance: (parseFloat(fund.balance) + cashToInvest).toFixed(2),
        pendingBalance: '0.00',
      });

      await storage.createActivity({
        userId,
        fundId: fund.id,
        type: 'auto_invest',
        title: 'Cash invested',
        description: `$${cashToInvest.toFixed(2)} invested across ${createdHoldings.length} positions.`,
        amount: cashToInvest.toFixed(2),
      });

      res.json({ success: true, invested: cashToInvest.toFixed(2), holdings: createdHoldings });
    } catch (error) {
      console.error('Error auto-investing:', error);
      res.status(500).json({ error: 'Failed to auto-invest' });
    }
  });

  app.patch('/api/funds/:fundId/strategy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const { strategy } = req.body;
      const validStrategies = ['growth', 'balanced', 'custom'];
      if (!strategy || !validStrategies.includes(strategy)) {
        return res.status(400).json({ error: 'Invalid strategy. Must be one of: growth, balanced, custom' });
      }

      if (strategy === 'custom') {
        const subscription = await storage.getSubscription(userId);
        const hasPaidPlan = subscription && (subscription.plan === 'starter' || subscription.plan === 'family') && subscription.status === 'active';
        if (!hasPaidPlan) {
          return res.status(403).json({ error: 'Custom strategy requires a Starter or Family plan' });
        }
      }

      const updated = await storage.updateFund(req.params.fundId, { investmentStrategy: strategy });
      res.json(updated);
    } catch (error) {
      console.error('Error updating strategy:', error);
      res.status(500).json({ error: 'Failed to update strategy' });
    }
  });

  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;

      const subscription = await storage.getSubscription(userId);
      const hasPaidPlan = subscription && (subscription.plan === 'family' || subscription.plan === 'starter') && subscription.status === 'active';

      let hasValidEventPass = false;
      if (req.body.stripeSessionId) {
        try {
          const session = await stripeService.getCheckoutSession(req.body.stripeSessionId);
          if (
            session.payment_status === 'paid' &&
            session.metadata?.type === 'event_pass' &&
            session.metadata?.userId === userId
          ) {
            hasValidEventPass = true;
          }
        } catch {}
      }

      if (!hasPaidPlan && !hasValidEventPass) {
        return res.status(403).json({ 
          error: 'Plan upgrade required',
          message: 'Upgrade to a paid plan or purchase an Event Boost to create events.'
        });
      }

      const { stripeSessionId, ...eventBody } = req.body;
      const data = insertEventSchema.parse({ ...eventBody, userId });
      const event = await storage.createEvent(data);

      if (hasValidEventPass) {
        await storage.updateEvent(event.id, {
          hasEventPass: true,
          eventPassPurchasedAt: new Date(),
        });
      }

      const finalEvent = hasValidEventPass 
        ? await storage.getEvent(event.id) 
        : event;
      res.status(201).json(finalEvent);
    } catch (error: any) {
      console.error('Error creating event:', error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid event data', message: error.errors?.[0]?.message || 'Validation failed' });
      }
      res.status(500).json({ error: 'Failed to create event', message: 'Please try again' });
    }
  });

  app.patch('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const allowedFields = ['name', 'description', 'eventDate', 'eventType', 'goalAmount', 'imageUrl', 'status'] as const;
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) sanitized[key] = req.body[key];
      }
      if (Object.keys(sanitized).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      const updated = await storage.updateEvent(req.params.id, sanitized);
      res.json(updated);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  });

  app.delete('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (event.isPermanent) {
        return res.status(400).json({ error: 'Cannot delete permanent link' });
      }
      await storage.deleteEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  // ===== HOLDINGS =====
  app.get('/api/funds/:fundId/holdings', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const holdings = await storage.getHoldingsByFund(req.params.fundId);
      res.json(holdings);
    } catch (error) {
      console.error('Error fetching holdings:', error);
      res.status(500).json({ error: 'Failed to fetch holdings' });
    }
  });

  // ===== GIFTS =====
  app.get('/api/funds/:fundId/gifts', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const gifts = await storage.getGiftsByFund(req.params.fundId);
      res.json(gifts);
    } catch (error) {
      console.error('Error fetching gifts:', error);
      res.status(500).json({ error: 'Failed to fetch gifts' });
    }
  });

  app.get('/api/public/gifts/:id', async (req, res) => {
    try {
      const gift = await storage.getGift(req.params.id);
      if (!gift) {
        return res.status(404).json({ error: 'Gift not found' });
      }
      const fund = await storage.getFund(gift.fundId);
      res.json({
        id: gift.id,
        senderName: gift.senderName,
        amount: gift.amount,
        netAmount: gift.netAmount,
        message: gift.message,
        executionModel: gift.executionModel,
        selectedTicker: gift.selectedTicker,
        status: gift.status,
        createdAt: gift.createdAt,
        fundName: fund?.name || 'Investment Fund',
        recipientFirstName: fund?.recipientFirstName || null,
      });
    } catch (error) {
      console.error('Error fetching public gift:', error);
      res.status(500).json({ error: 'Failed to fetch gift' });
    }
  });

  app.post('/api/gifts/:id/claim', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const gift = await storage.getGift(req.params.id);
      if (!gift) {
        return res.status(404).json({ error: 'Gift not found' });
      }
      if (gift.status !== 'pending' && gift.status !== 'completed') {
        return res.status(400).json({ error: 'Gift cannot be claimed in its current status' });
      }

      const { fundId, newFundName } = req.body;
      let targetFundId = fundId;

      if (newFundName) {
        const slug = newFundName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const newFund = await storage.createFund({
          userId,
          name: newFundName,
          slug: `${slug}-${Date.now().toString(36)}`,
          accountType: 'individual',
          status: 'active',
        });
        targetFundId = newFund.id;

        await storage.createEvent({
          fundId: newFund.id,
          userId,
          name: "Gift anytime",
          slug: `${newFund.slug}-anytime`,
          isPermanent: true,
          status: "active",
          eventType: "gift_anytime",
        });
      }

      if (!targetFundId) {
        return res.status(400).json({ error: 'Must specify a fund or provide a new fund name' });
      }

      const targetFund = await storage.getFund(targetFundId);
      if (!targetFund) {
        return res.status(404).json({ error: 'Target fund not found' });
      }
      if (targetFund.userId !== userId) {
        return res.status(403).json({ error: 'You do not own this fund' });
      }

      await storage.updateGift(gift.id, {
        fundId: targetFundId,
        status: 'settled',
        settledAt: new Date(),
      });

      const giftAmount = parseFloat(gift.netAmount);
      await storage.updateFund(targetFundId, {
        pendingBalance: (parseFloat(targetFund.pendingBalance) + giftAmount).toFixed(2),
        contributorCount: targetFund.contributorCount + 1,
      });

      await storage.createActivity({
        userId,
        fundId: targetFundId,
        type: 'gift_received',
        title: `Gift claimed from ${gift.senderName}`,
        description: `$${giftAmount.toFixed(2)} gift claimed and deposited.`,
        amount: giftAmount.toFixed(2),
      });

      res.json({ success: true, fundId: targetFundId, fundName: targetFund.name });
    } catch (error) {
      console.error('Error claiming gift:', error);
      res.status(500).json({ error: 'Failed to claim gift' });
    }
  });

  // Create gift (public, for gift givers)
  app.post('/api/public/gifts', async (req, res) => {
    try {
      const data = insertGiftSchema.parse(req.body);
      const gift = await storage.createGift(data);
      res.status(201).json(gift);
    } catch (error) {
      console.error('Error creating gift:', error);
      res.status(500).json({ error: 'Failed to create gift' });
    }
  });

  // ===== ACTIVITIES =====
  app.get('/api/activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await storage.getActivitiesByUser(userId, limit);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  });

  app.get('/api/activities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const activity = await storage.getActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      if (activity.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      let fund = null;
      if (activity.fundId) {
        fund = await storage.getFund(activity.fundId);
      }
      res.json({ ...activity, fundName: fund?.name || null, recipientFirstName: fund?.recipientFirstName || null });
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  app.get('/api/funds/:fundId/activities', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await storage.getActivitiesByFund(req.params.fundId, limit);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  });

  // ===== SUBSCRIPTION =====
  app.get('/api/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const subscription = await storage.ensureSubscription(userId);
      res.json(subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  // ===== STRIPE =====
  app.get('/api/stripe/products', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY p.name
      `);
      
      const productsMap = new Map();
      for (const row of result.rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
          });
        }
      }
      
      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.post('/api/stripe/checkout/family-plan', isAuthenticated, async (req: any, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const userId = (req.user as any).id;
      
      const result = await db.execute(sql`
        SELECT pr.id as price_id
        FROM stripe.products p
        JOIN stripe.prices pr ON pr.product = p.id
        WHERE p.name = 'Family Plan' AND pr.active = true
        LIMIT 1
      `);
      
      const priceId = (result.rows[0] as any)?.price_id;
      if (!priceId) {
        return res.status(404).json({ error: 'Family Plan price not found. Please run the seed script.' });
      }
      
      const session = await stripeService.createCheckoutSession(
        priceId,
        'subscription',
        `${baseUrl}/settings?tab=billing&success=family`,
        `${baseUrl}/settings?tab=billing&canceled=true`,
        { userId, type: 'family_plan' }
      );
      
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.post('/api/stripe/checkout/event-pass', isAuthenticated, async (req: any, res) => {
    try {
      const { eventId, eventName } = req.body;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const userId = (req.user as any).id;
      
      const result = await db.execute(sql`
        SELECT pr.id as price_id
        FROM stripe.products p
        JOIN stripe.prices pr ON pr.product = p.id
        WHERE (p.name = 'Event Boost' OR p.name = 'Event Pass') AND pr.active = true
        LIMIT 1
      `);
      
      const priceId = (result.rows[0] as any)?.price_id;
      if (!priceId) {
        return res.status(404).json({ error: 'Event Boost price not found. Please run the seed script.' });
      }
      
      const session = await stripeService.createCheckoutSession(
        priceId,
        'payment',
        `${baseUrl}/event/create?eventPass=purchased&session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/events?canceled=event-pass`,
        { eventId: eventId || '', eventName: eventName || '', userId, type: 'event_pass' }
      );
      
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.get('/api/stripe/publishable-key', async (req, res) => {
    try {
      const key = await stripeService.getPublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      console.error('Error getting publishable key:', error);
      res.status(500).json({ error: 'Failed to get publishable key' });
    }
  });

  app.post('/api/stripe/calculate-fees', async (req, res) => {
    try {
      const { amount, coverFees, eventId, fundId, fundSlug, eventSlug, paymentMethod } = req.body;
      
      let hasEventBoost = false;
      let hasPaidPlan = false;
      let hostPlan = 'free';
      let resolvedFund = null;
      
      if (fundId) {
        resolvedFund = await storage.getFund(fundId);
      } else if (fundSlug) {
        resolvedFund = await storage.getFundBySlug(fundSlug);
      }
      
      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (event?.hasEventPass) {
          hasEventBoost = true;
        }
      } else if (eventSlug && resolvedFund) {
        const events = await storage.getEventsByFund(resolvedFund.id);
        const event = events.find((e: any) => e.slug === eventSlug);
        if (event?.hasEventPass) {
          hasEventBoost = true;
        }
      }
      
      if (resolvedFund?.userId) {
        const subscription = await storage.getSubscription(resolvedFund.userId);
        if (subscription && (subscription.plan === 'family' || subscription.plan === 'starter') && subscription.status === 'active') {
          hasPaidPlan = true;
          hostPlan = subscription.plan;
        }
      }
      
      const parsedAmount = parseFloat(amount) || 0;
      const fees = stripeService.calculateFees(
        parsedAmount, 
        coverFees || false, 
        hasEventBoost, 
        hasPaidPlan,
        paymentMethod || 'card'
      );
      
      const processingFeeRate = paymentMethod === 'bank' 
        ? '0.8% (max $5.00)' 
        : '2.9% + $0.30';
      const koraFeeRate = hasEventBoost || hasPaidPlan 
        ? 'Waived' 
        : '$2.00 per gift';
      const stripeFeeExplanation = paymentMethod === 'bank'
        ? 'ACH bank transfer processing fee charged by Stripe.'
        : 'Card processing fee charged by Stripe for secure payment handling.';
      const koraFeeExplanation = hasEventBoost
        ? 'Waived because the host purchased an Event Boost ($29/event).'
        : hasPaidPlan
          ? `Waived because the host has an active ${hostPlan === 'family' ? 'Family' : 'Starter'} plan.`
          : '$2.00 platform fee per gift on the Free plan. The host can upgrade to remove this fee.';

      res.json({ 
        ...fees, 
        hasEventBoost, 
        hasPaidPlan,
        hostPlan,
        processingFeeRate,
        koraFeeRate,
        stripeFeeExplanation,
        koraFeeExplanation,
        feesSavedByPlan: hasEventBoost || hasPaidPlan ? 2.00 : 0,
      });
    } catch (error) {
      console.error('Error calculating fees:', error);
      res.status(500).json({ error: 'Failed to calculate fees' });
    }
  });

  app.post('/api/stripe/checkout/gift', async (req, res) => {
    try {
      const { fundId, eventId, amount, senderName, senderEmail, message, coverFees, paymentMethod, executionModel, selectedTicker } = req.body;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (!fundId || !amount || !senderName) {
        return res.status(400).json({ error: 'Missing required fields: fundId, amount, senderName' });
      }

      const fund = await storage.getFund(fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }

      let hasEventBoost = false;
      let hasPaidPlan = false;
      
      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (event?.hasEventPass) {
          hasEventBoost = true;
        }
      }
      
      if (fund.userId) {
        const subscription = await storage.getSubscription(fund.userId);
        if (subscription && (subscription.plan === 'family' || subscription.plan === 'starter') && subscription.status === 'active') {
          hasPaidPlan = true;
        }
      }

      const recipientName = fund.recipientFirstName || fund.name || 'recipient';

      const session = await stripeService.createGiftCheckoutSession({
        fundId,
        eventId,
        amount: parseFloat(amount),
        senderName,
        senderEmail,
        message,
        coverFees: coverFees || false,
        hasEventBoost,
        hasPaidPlan,
        fundUserId: fund.userId,
        recipientName,
        paymentMethod: paymentMethod || 'card',
        executionModel: executionModel || 'auto',
        selectedTicker: selectedTicker || undefined,
        successUrl: `${baseUrl}/gift/success?fundId=${fundId}&eventId=${eventId || ''}`,
        cancelUrl: `${baseUrl}/gift/${eventId || fundId}?canceled=true`,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error('Error creating gift checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.get('/api/stripe/session/:sessionId', async (req, res) => {
    try {
      const session = await stripeService.getCheckoutSession(req.params.sessionId);
      res.json({
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        metadata: session.metadata,
      });
    } catch (error) {
      console.error('Error getting checkout session:', error);
      res.status(500).json({ error: 'Failed to get checkout session' });
    }
  });

  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getTransactionsByUser(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // ===== MEMORY ENTRIES =====
  app.get('/api/funds/:fundId/memory', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const entries = await storage.getMemoryEntriesByFund(req.params.fundId);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching memory entries:', error);
      res.status(500).json({ error: 'Failed to fetch memory entries' });
    }
  });

  app.post('/api/funds/:fundId/memory', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const data = insertMemoryEntrySchema.parse({ ...req.body, fundId: req.params.fundId });
      const entry = await storage.createMemoryEntry(data);
      res.status(201).json(entry);
    } catch (error) {
      console.error('Error creating memory entry:', error);
      res.status(500).json({ error: 'Failed to create memory entry' });
    }
  });

  app.delete('/api/memory/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteMemoryEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting memory entry:', error);
      res.status(500).json({ error: 'Failed to delete memory entry' });
    }
  });

  app.patch('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { profileImageUrl, firstName, lastName } = req.body;
      const updates: Record<string, any> = {};
      if (profileImageUrl !== undefined) {
        if (typeof profileImageUrl === 'string' && profileImageUrl.length > 3 * 1024 * 1024) {
          return res.status(400).json({ error: 'Image too large. Please use an image under 2MB.' });
        }
        updates.profileImageUrl = profileImageUrl;
      }
      if (firstName !== undefined) updates.firstName = String(firstName).slice(0, 100);
      if (lastName !== undefined) updates.lastName = String(lastName).slice(0, 100);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      const { passwordHash: _, kycData: _kd, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // ===== THANK-YOUS =====
  app.get('/api/funds/:fundId/thank-yous', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== (req.user as any).id) return res.status(403).json({ error: 'Forbidden' });
      const items = await storage.getThankYousByFund(req.params.fundId);
      res.json(items);
    } catch (error) {
      console.error('Error fetching thank-yous:', error);
      res.status(500).json({ error: 'Failed to fetch thank-yous' });
    }
  });

  app.patch('/api/funds/:fundId/thank-yous/:id', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== (req.user as any).id) return res.status(403).json({ error: 'Forbidden' });

      const updates: Record<string, any> = {};
      if (req.body.message !== undefined) updates.message = req.body.message;
      if (req.body.status === 'sent') {
        updates.status = 'sent';
        updates.sentAt = new Date();
      }

      const updated = await storage.updateThankYou(req.params.id, updates);
      if (!updated) return res.status(404).json({ error: 'Thank-you not found' });
      res.json(updated);
    } catch (error) {
      console.error('Error updating thank-you:', error);
      res.status(500).json({ error: 'Failed to update thank-you' });
    }
  });

  app.post('/api/funds/:fundId/thank-yous/generate', isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== (req.user as any).id) return res.status(403).json({ error: 'Forbidden' });

      const fundGifts = await storage.getGiftsByFund(req.params.fundId);
      const existingThankYous = await storage.getThankYousByFund(req.params.fundId);
      const thankedGiftIds = new Set(existingThankYous.map(ty => ty.giftId));

      const unthankedGifts = fundGifts.filter(g =>
        (g.status === 'completed' || g.status === 'settled' || g.status === 'processing' || g.status === 'pending') &&
        !thankedGiftIds.has(g.id)
      );

      const created = [];
      for (const gift of unthankedGifts) {
        const message = `Thank you ${gift.senderName} for your generous gift of $${parseFloat(gift.amount).toFixed(2)} to ${fund.name}!`;
        const thankYou = await storage.createThankYou({
          fundId: fund.id,
          giftId: gift.id,
          senderName: gift.senderName,
          senderEmail: gift.senderEmail || null,
          message,
          status: 'draft',
        });
        created.push(thankYou);
      }

      res.json({ generated: created.length, thankYous: created });
    } catch (error) {
      console.error('Error generating thank-yous:', error);
      res.status(500).json({ error: 'Failed to generate thank-yous' });
    }
  });

  // ===== RECURRING GIFTS =====
  app.post('/api/recurring-gifts', async (req, res) => {
    try {
      const { fundId, senderName, senderEmail, amount, frequency } = req.body;

      if (!fundId || !senderName || !amount || !frequency) {
        return res.status(400).json({ error: 'Missing required fields: fundId, senderName, amount, frequency' });
      }

      const fund = await storage.getFund(fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }

      const validFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({ error: 'Invalid frequency. Must be one of: weekly, monthly, quarterly, yearly' });
      }

      const now = new Date();
      let nextChargeDate = new Date(now);
      switch (frequency) {
        case 'weekly': nextChargeDate.setDate(now.getDate() + 7); break;
        case 'monthly': nextChargeDate.setMonth(now.getMonth() + 1); break;
        case 'quarterly': nextChargeDate.setMonth(now.getMonth() + 3); break;
        case 'yearly': nextChargeDate.setFullYear(now.getFullYear() + 1); break;
      }

      const data = insertRecurringGiftSchema.parse({
        fundId,
        senderName,
        senderEmail: senderEmail || null,
        amount: parseFloat(amount).toFixed(2),
        frequency,
        status: 'active',
        nextChargeDate,
      });

      const recurringGift = await storage.createRecurringGift(data);
      res.status(201).json(recurringGift);
    } catch (error) {
      console.error('Error creating recurring gift:', error);
      res.status(500).json({ error: 'Failed to create recurring gift' });
    }
  });

  app.get('/api/funds/:fundId/recurring-gifts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      if (fund.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const subscription = await storage.getSubscription(userId);
      if (!subscription || subscription.plan !== 'family' || subscription.status !== 'active') {
        return res.status(403).json({ error: 'Family plan required to view recurring gifts' });
      }

      const gifts = await storage.getRecurringGiftsByFund(req.params.fundId);
      res.json(gifts);
    } catch (error) {
      console.error('Error fetching recurring gifts:', error);
      res.status(500).json({ error: 'Failed to fetch recurring gifts' });
    }
  });

  app.patch('/api/recurring-gifts/:id', async (req, res) => {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const validStatuses = ['active', 'paused', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be one of: active, paused, cancelled' });
      }

      const updated = await storage.updateRecurringGift(req.params.id, { status });
      if (!updated) {
        return res.status(404).json({ error: 'Recurring gift not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating recurring gift:', error);
      res.status(500).json({ error: 'Failed to update recurring gift' });
    }
  });

  // ===== ADMIN DASHBOARD =====
  app.get('/api/admin/overview', isAdmin, async (req: any, res) => {
    try {
      const userResult = await db.execute(sql`
        SELECT 
          COUNT(*)::int AS total_users,
          COUNT(CASE WHEN kyc_status = 'approved' THEN 1 END)::int AS kyc_approved,
          COUNT(CASE WHEN kyc_status = 'pending' THEN 1 END)::int AS kyc_pending,
          COUNT(CASE WHEN kyc_status = 'none' OR kyc_status IS NULL THEN 1 END)::int AS kyc_none
        FROM users
      `);
      const userStats: any = userResult.rows[0];

      const fundResult = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_funds,
          COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_funds,
          COUNT(CASE WHEN status = 'draft' THEN 1 END)::int AS draft_funds,
          COALESCE(SUM(CAST(balance AS numeric)), 0) AS total_invested,
          COALESCE(SUM(CAST(pending_balance AS numeric)), 0) AS total_pending,
          COALESCE(SUM(CAST(balance AS numeric) + CAST(pending_balance AS numeric)), 0) AS total_aum,
          COUNT(CASE WHEN account_type = 'UTMA' THEN 1 END)::int AS utma_funds,
          COUNT(CASE WHEN account_type != 'UTMA' THEN 1 END)::int AS personal_funds
        FROM funds
      `);
      const fundStats: any = fundResult.rows[0];

      const giftResult = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_gifts,
          COALESCE(SUM(CAST(amount AS numeric)), 0) AS total_gift_volume,
          COALESCE(AVG(CAST(amount AS numeric)), 0) AS avg_gift_size,
          COALESCE(SUM(CAST(processing_fee AS numeric)), 0) AS total_processing_fees,
          COALESCE(SUM(CAST(kora_fee AS numeric)), 0) AS total_kora_fees,
          COALESCE(SUM(CAST(net_amount AS numeric)), 0) AS total_net_to_recipients,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_gifts,
          COUNT(CASE WHEN status = 'processing' THEN 1 END)::int AS processing_gifts,
          COUNT(CASE WHEN status = 'invested' THEN 1 END)::int AS invested_gifts,
          COUNT(CASE WHEN status = 'settled' THEN 1 END)::int AS settled_gifts,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS failed_gifts,
          COUNT(DISTINCT sender_email)::int AS unique_givers
        FROM gifts
      `);
      const giftStats: any = giftResult.rows[0];

      const subResult = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_subscriptions,
          COUNT(CASE WHEN plan = 'free' THEN 1 END)::int AS free_plans,
          COUNT(CASE WHEN plan = 'family' AND status = 'active' THEN 1 END)::int AS active_family_plans,
          COUNT(CASE WHEN plan = 'family' AND status = 'canceled' THEN 1 END)::int AS canceled_family_plans
        FROM subscriptions
      `);
      const subStats: any = subResult.rows[0];

      const eventResult = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_events,
          COUNT(CASE WHEN has_event_pass = true THEN 1 END)::int AS events_with_pass,
          COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_events,
          COALESCE(SUM(CAST(gift_volume AS numeric)), 0) AS total_event_gift_volume,
          COALESCE(SUM(gift_count), 0)::int AS total_event_gift_count
        FROM events
      `);
      const eventStats: any = eventResult.rows[0];

      const txResult = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_transactions,
          COALESCE(SUM(CASE WHEN type = 'gift' AND status = 'completed' THEN CAST(amount AS numeric) ELSE 0 END), 0) AS gift_tx_volume,
          COALESCE(SUM(CASE WHEN type = 'family_plan' AND status = 'completed' THEN CAST(amount AS numeric) ELSE 0 END), 0) AS family_plan_revenue,
          COALESCE(SUM(CASE WHEN type = 'event_pass' AND status = 'completed' THEN CAST(amount AS numeric) ELSE 0 END), 0) AS event_pass_revenue,
          COALESCE(SUM(CASE WHEN type = 'subscription_renewal' AND status = 'completed' THEN CAST(amount AS numeric) ELSE 0 END), 0) AS renewal_revenue,
          COALESCE(SUM(CASE WHEN type = 'sell' AND status = 'completed' THEN CAST(amount AS numeric) ELSE 0 END), 0) AS sell_volume,
          COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN CAST(amount AS numeric) ELSE 0 END), 0) AS withdrawal_volume,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS failed_transactions
        FROM transactions
      `);
      const txStats: any = txResult.rows[0];

      const bankResult = await db.execute(sql`
        SELECT COUNT(*)::int AS total_bank_accounts FROM bank_accounts WHERE status = 'active'
      `);
      const bankStats: any = bankResult.rows[0];

      const koraGiftRevenue = parseFloat(String(giftStats.total_kora_fees || '0'));
      const familyPlanRevenue = parseFloat(String(txStats.family_plan_revenue || '0')) + parseFloat(String(txStats.renewal_revenue || '0'));
      const eventPassRevenue = parseFloat(String(txStats.event_pass_revenue || '0'));
      const totalKoraRevenue = koraGiftRevenue + familyPlanRevenue + eventPassRevenue;

      res.json({
        users: userStats,
        funds: fundStats,
        gifts: giftStats,
        subscriptions: subStats,
        events: eventStats,
        transactions: txStats,
        bankAccounts: bankStats,
        revenue: {
          giftPlatformFees: koraGiftRevenue.toFixed(2),
          familyPlanRevenue: familyPlanRevenue.toFixed(2),
          eventPassRevenue: eventPassRevenue.toFixed(2),
          totalKoraRevenue: totalKoraRevenue.toFixed(2),
        },
      });
    } catch (error) {
      console.error('Error fetching admin overview:', error);
      res.status(500).json({ error: 'Failed to fetch admin overview' });
    }
  });

  app.get('/api/admin/users', isAdmin, async (req: any, res) => {
    try {
      const allUsersResult = await db.execute(sql`
        SELECT 
          u.id, u.email, u.first_name, u.last_name, u.kyc_status, u.kyc_submitted_at, u.created_at,
          s.plan AS sub_plan, s.status AS sub_status, s.billing_interval, s.current_period_end,
          s.stripe_subscription_id,
          (SELECT COUNT(*)::int FROM funds f WHERE f.user_id = u.id) AS fund_count,
          (SELECT COUNT(*)::int FROM funds f WHERE f.user_id = u.id AND f.account_type = 'UTMA') AS utma_count,
          (SELECT COALESCE(SUM(CAST(f.balance AS numeric) + CAST(f.pending_balance AS numeric)), 0) FROM funds f WHERE f.user_id = u.id) AS total_value,
          (SELECT COUNT(*)::int FROM bank_accounts ba WHERE ba.user_id = u.id AND ba.status = 'active') AS bank_accounts,
          (SELECT COUNT(*)::int FROM gifts g JOIN funds f2 ON g.fund_id = f2.id WHERE f2.user_id = u.id) AS gifts_received
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        ORDER BY u.created_at DESC
      `);
      res.json(allUsersResult.rows);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ error: 'Failed to fetch admin users' });
    }
  });

  app.get('/api/admin/gifts', isAdmin, async (req: any, res) => {
    try {
      const allGiftsResult = await db.execute(sql`
        SELECT 
          g.*,
          f.name AS fund_name, f.account_type AS fund_type, f.slug AS fund_slug,
          e.name AS event_name, e.slug AS event_slug, e.has_event_pass,
          u.email AS owner_email, u.first_name AS owner_first_name
        FROM gifts g
        JOIN funds f ON g.fund_id = f.id
        LEFT JOIN events e ON g.event_id = e.id
        LEFT JOIN users u ON f.user_id = u.id
        ORDER BY g.created_at DESC
        LIMIT 200
      `);
      res.json(allGiftsResult.rows);
    } catch (error) {
      console.error('Error fetching admin gifts:', error);
      res.status(500).json({ error: 'Failed to fetch admin gifts' });
    }
  });

  app.get('/api/admin/transactions', isAdmin, async (req: any, res) => {
    try {
      const allTxResult = await db.execute(sql`
        SELECT 
          t.*,
          u.email AS user_email, u.first_name AS user_first_name,
          f.name AS fund_name,
          e.name AS event_name
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN funds f ON t.fund_id = f.id
        LEFT JOIN events e ON t.event_id = e.id
        ORDER BY t.created_at DESC
        LIMIT 200
      `);
      res.json(allTxResult.rows);
    } catch (error) {
      console.error('Error fetching admin transactions:', error);
      res.status(500).json({ error: 'Failed to fetch admin transactions' });
    }
  });

  app.get('/api/admin/funds', isAdmin, async (req: any, res) => {
    try {
      const allFundsResult = await db.execute(sql`
        SELECT 
          f.*,
          u.email AS owner_email, u.first_name AS owner_first_name, u.last_name AS owner_last_name,
          u.kyc_status AS owner_kyc_status,
          (SELECT COUNT(*)::int FROM holdings h WHERE h.fund_id = f.id) AS holding_count,
          (SELECT COUNT(*)::int FROM gifts g WHERE g.fund_id = f.id) AS gift_count,
          (SELECT COUNT(*)::int FROM events e WHERE e.fund_id = f.id) AS event_count
        FROM funds f
        JOIN users u ON f.user_id = u.id
        ORDER BY f.created_at DESC
      `);
      res.json(allFundsResult.rows);
    } catch (error) {
      console.error('Error fetching admin funds:', error);
      res.status(500).json({ error: 'Failed to fetch admin funds' });
    }
  });

  // ===== FUND COLLABORATORS =====
  app.post('/api/funds/:fundId/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const subscription = await storage.getSubscription(userId);
      if (!subscription || subscription.plan !== 'family' || subscription.status !== 'active') {
        return res.status(403).json({ error: 'Family plan required to invite collaborators' });
      }

      const { email, role } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      if (role && !['viewer', 'co-admin'].includes(role)) {
        return res.status(400).json({ error: 'Role must be viewer or co-admin' });
      }

      const collaborator = await storage.createCollaborator({
        fundId: req.params.fundId,
        email,
        role: role || 'viewer',
        status: 'pending',
      });
      res.status(201).json(collaborator);
    } catch (error) {
      console.error('Error creating collaborator:', error);
      res.status(500).json({ error: 'Failed to create collaborator' });
    }
  });

  app.get('/api/funds/:fundId/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const collaborators = await storage.getCollaboratorsByFund(req.params.fundId);
      res.json(collaborators);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
      res.status(500).json({ error: 'Failed to fetch collaborators' });
    }
  });

  app.patch('/api/funds/:fundId/collaborators/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const { role, status } = req.body;
      const updateData: any = {};
      if (role && ['viewer', 'co-admin'].includes(role)) updateData.role = role;
      if (status && ['pending', 'accepted', 'declined'].includes(status)) {
        updateData.status = status;
        if (status === 'accepted') updateData.acceptedAt = new Date();
      }

      const updated = await storage.updateCollaborator(req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: 'Collaborator not found' });
      res.json(updated);
    } catch (error) {
      console.error('Error updating collaborator:', error);
      res.status(500).json({ error: 'Failed to update collaborator' });
    }
  });

  app.delete('/api/funds/:fundId/collaborators/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });
      if (fund.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      await storage.deleteCollaborator(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting collaborator:', error);
      res.status(500).json({ error: 'Failed to delete collaborator' });
    }
  });

  return httpServer;
}
