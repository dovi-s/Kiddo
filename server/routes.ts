import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { insertFundSchema, insertEventSchema, insertGiftSchema, insertMemoryEntrySchema, insertBankAccountSchema, users, funds, holdings } from "@shared/schema";

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
          goalAmount: event.goalAmount,
          giftVolume: event.giftVolume,
          giftCount: event.giftCount,
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
      const gifts = await storage.getGiftsByFund(fund.id);
      res.json({
        id: fund.id,
        name: fund.name,
        recipientFirstName: fund.recipientFirstName,
        accountType: fund.accountType,
        balance: fund.balance,
        totalGain: fund.totalGain,
        giftCount: gifts.length,
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

  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;

      const subscription = await storage.getSubscription(userId);
      const isFamily = subscription?.plan === 'family' && subscription?.status === 'active';

      if (!isFamily) {
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

        if (!hasValidEventPass) {
          return res.status(403).json({ 
            error: 'Plan upgrade required',
            message: 'Upgrade to Family Plan or purchase an Event Pass to create events.'
          });
        }
      }

      const { stripeSessionId, ...eventBody } = req.body;
      const data = insertEventSchema.parse({ ...eventBody, userId });
      const event = await storage.createEvent(data);
      res.status(201).json(event);
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
        WHERE p.name = 'Event Pass' AND pr.active = true
        LIMIT 1
      `);
      
      const priceId = (result.rows[0] as any)?.price_id;
      if (!priceId) {
        return res.status(404).json({ error: 'Event Pass price not found. Please run the seed script.' });
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
      
      let hasEventPass = false;
      let hasFamilyPlan = false;
      let resolvedFund = null;
      
      if (fundId) {
        resolvedFund = await storage.getFund(fundId);
      } else if (fundSlug) {
        resolvedFund = await storage.getFundBySlug(fundSlug);
      }
      
      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (event?.hasEventPass) {
          hasEventPass = true;
        }
      } else if (eventSlug && resolvedFund) {
        const events = await storage.getEventsByFund(resolvedFund.id);
        const event = events.find((e: any) => e.slug === eventSlug);
        if (event?.hasEventPass) {
          hasEventPass = true;
        }
      }
      
      if (resolvedFund?.userId) {
        const subscription = await storage.getSubscription(resolvedFund.userId);
        if (subscription?.plan === 'family' && subscription?.status === 'active') {
          hasFamilyPlan = true;
        }
      }
      
      const parsedAmount = parseFloat(amount) || 0;
      const fees = stripeService.calculateFees(
        parsedAmount, 
        coverFees || false, 
        hasEventPass, 
        hasFamilyPlan,
        paymentMethod || 'card'
      );
      
      const processingFeeRate = paymentMethod === 'bank' 
        ? '0.8% (max $5.00)' 
        : '2.9% + $0.30';
      const koraFeeRate = hasEventPass || hasFamilyPlan 
        ? 'Waived' 
        : '1.5% (min $1, max $10)';
      const stripeFeeExplanation = paymentMethod === 'bank'
        ? 'ACH bank transfer processing fee charged by Stripe.'
        : 'Card processing fee charged by Stripe for secure payment handling.';
      const koraFeeExplanation = hasEventPass
        ? 'Waived because the host purchased an Event Pass ($99/event).'
        : hasFamilyPlan
          ? 'Waived because the host has an active Family Plan ($149/year).'
          : 'Kora platform fee that supports secure investing infrastructure. Minimum $1, maximum $10 per gift.';

      res.json({ 
        ...fees, 
        hasEventPass, 
        hasFamilyPlan,
        processingFeeRate,
        koraFeeRate,
        stripeFeeExplanation,
        koraFeeExplanation,
        feesSavedByPlan: hasEventPass || hasFamilyPlan ? Math.min(Math.max(parsedAmount * 0.015, 1), 10) : 0,
      });
    } catch (error) {
      console.error('Error calculating fees:', error);
      res.status(500).json({ error: 'Failed to calculate fees' });
    }
  });

  app.post('/api/stripe/checkout/gift', async (req, res) => {
    try {
      const { fundId, eventId, amount, senderName, senderEmail, message, coverFees, paymentMethod } = req.body;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (!fundId || !amount || !senderName) {
        return res.status(400).json({ error: 'Missing required fields: fundId, amount, senderName' });
      }

      const fund = await storage.getFund(fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }

      let hasEventPass = false;
      let hasFamilyPlan = false;
      
      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (event?.hasEventPass) {
          hasEventPass = true;
        }
      }
      
      if (fund.userId) {
        const subscription = await storage.getSubscription(fund.userId);
        if (subscription?.plan === 'family' && subscription?.status === 'active') {
          hasFamilyPlan = true;
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
        hasEventPass,
        hasFamilyPlan,
        fundUserId: fund.userId,
        recipientName,
        paymentMethod: paymentMethod || 'card',
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

  return httpServer;
}
