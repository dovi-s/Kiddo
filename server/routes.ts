import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { sql } from "drizzle-orm";
import { db } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Stripe products and prices
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

  // Create checkout session for Family Plan (subscription)
  app.post('/api/stripe/checkout/family-plan', async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Get Family Plan price from database
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
        `${baseUrl}/settings?tab=billing&canceled=true`
      );
      
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  // Create checkout session for Event Pass (one-time)
  app.post('/api/stripe/checkout/event-pass', async (req, res) => {
    try {
      const { eventId, eventName } = req.body;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Get Event Pass price from database
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
        { eventId: eventId || '', eventName: eventName || '' }
      );
      
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  return httpServer;
}
