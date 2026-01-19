import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replit_integrations/auth";
import { insertFundSchema, insertEventSchema, insertGiftSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ===== FUNDS =====
  app.get('/api/funds', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      if (fund.userId !== req.user.claims.sub) {
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
      const userId = req.user.claims.sub;
      const data = insertFundSchema.parse({ ...req.body, userId });
      const fund = await storage.createFund(data);
      
      // Create permanent "Gift anytime" link for the fund
      await storage.createEvent({
        fundId: fund.id,
        userId,
        name: "Gift anytime",
        slug: `${fund.slug}-anytime`,
        isPermanent: true,
        status: "active",
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
      if (fund.userId !== req.user.claims.sub) {
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
      const userId = req.user.claims.sub;
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
      if (fund.userId !== req.user.claims.sub) {
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

  // Public event page (no auth required for gift givers)
  app.get('/api/public/events/:slug', async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const fund = await storage.getFund(event.fundId);
      res.json({ 
        event: {
          id: event.id,
          name: event.name,
          description: event.description,
          imageUrl: event.imageUrl,
          eventDate: event.eventDate,
        },
        fundName: fund?.name,
      });
    } catch (error) {
      console.error('Error fetching public event:', error);
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertEventSchema.parse({ ...req.body, userId });
      const event = await storage.createEvent(data);
      res.status(201).json(event);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  app.patch('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updated = await storage.updateEvent(req.params.id, req.body);
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
      if (event.userId !== req.user.claims.sub) {
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
      if (fund.userId !== req.user.claims.sub) {
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
      if (fund.userId !== req.user.claims.sub) {
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
      const userId = req.user.claims.sub;
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
      if (fund.userId !== req.user.claims.sub) {
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
      const userId = req.user.claims.sub;
      const subscription = await storage.getSubscription(userId);
      res.json(subscription || { plan: 'free', status: 'active' });
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
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;
      
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
        `${baseUrl}/events?success=event-pass&eventId=${eventId || ''}`,
        `${baseUrl}/event/create?canceled=true`,
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
      const { amount, coverFees, eventId, fundId, fundSlug, eventSlug } = req.body;
      
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
      
      const fees = stripeService.calculateFees(
        parseFloat(amount) || 0, 
        coverFees || false, 
        hasEventPass, 
        hasFamilyPlan
      );
      res.json({ ...fees, hasEventPass, hasFamilyPlan });
    } catch (error) {
      console.error('Error calculating fees:', error);
      res.status(500).json({ error: 'Failed to calculate fees' });
    }
  });

  app.post('/api/stripe/checkout/gift', async (req, res) => {
    try {
      const { fundId, eventId, amount, senderName, senderEmail, message, coverFees } = req.body;
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
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getTransactionsByUser(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  return httpServer;
}
