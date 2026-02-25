import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }

  static async handleCheckoutCompleted(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const type = metadata.type;

    console.log('[Webhook] checkout.session.completed:', { type, sessionId: session.id });

    if (type === 'gift') {
      await this.handleGiftPayment(session);
    } else if (type === 'family_plan') {
      await this.handleFamilyPlanPurchase(session);
    } else if (type === 'event_pass') {
      await this.handleEventPassPurchase(session);
    }

    await storage.createTransaction({
      userId: metadata.userId || null,
      type: type || 'unknown',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      amount: ((session.amount_total || 0) / 100).toString(),
      currency: session.currency || 'usd',
      status: 'completed',
      description: `${type} payment`,
      metadata: JSON.stringify(metadata),
      fundId: metadata.fundId || null,
      eventId: metadata.eventId || null,
      completedAt: new Date(),
    });
  }

  static async handleGiftPayment(session: any): Promise<void> {
    const metadata = session.metadata || {};
    
    const giftData = {
      fundId: metadata.fundId,
      eventId: metadata.eventId || null,
      senderName: metadata.senderName || 'Anonymous',
      senderEmail: metadata.senderEmail || null,
      amount: metadata.baseAmount || ((session.amount_total || 0) / 100).toString(),
      processingFee: metadata.processingFee || '0',
      koraFee: metadata.koraFee || '0',
      netAmount: metadata.netToFund || metadata.baseAmount || ((session.amount_total || 0) / 100).toString(),
      message: metadata.message || null,
      executionModel: metadata.executionModel || 'auto_invest',
      selectedTicker: metadata.selectedTicker || null,
      status: 'pending',
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    };

    const gift = await storage.createGift(giftData);
    console.log('[Webhook] Gift created:', gift.id);

    if (gift.message) {
      await storage.createMemoryEntry({
        fundId: gift.fundId,
        giftId: gift.id,
        type: 'gift_message',
        content: gift.message,
        authorName: gift.senderName,
      });
      console.log('[Webhook] Memory entry created for gift:', gift.id);
    }

    await storage.createActivity({
      userId: metadata.userId || session.customer,
      fundId: metadata.fundId,
      type: 'gift_received',
      title: `Gift from ${giftData.senderName}`,
      description: `$${giftData.amount} gift received`,
      amount: giftData.amount,
    });

    if (metadata.eventId) {
      await storage.incrementEventGiftStats(metadata.eventId, parseFloat(giftData.amount));
    }

    try {
      let shouldAutoThankYou = false;

      if (metadata.eventId) {
        const event = await storage.getEvent(metadata.eventId);
        if (event?.hasEventPass) shouldAutoThankYou = true;
      }

      if (!shouldAutoThankYou && metadata.fundId) {
        const fund = await storage.getFund(metadata.fundId);
        if (fund?.userId) {
          const subscription = await storage.getSubscription(fund.userId);
          if (subscription && (subscription.plan === 'family' || subscription.plan === 'starter') && subscription.status === 'active') {
            shouldAutoThankYou = true;
          }
        }
      }

      if (shouldAutoThankYou) {
        const fund = await storage.getFund(metadata.fundId);
        const message = `Thank you ${giftData.senderName} for your generous gift of $${parseFloat(giftData.amount).toFixed(2)} to ${fund?.name || 'the fund'}!`;
        await storage.createThankYou({
          fundId: metadata.fundId,
          giftId: gift.id,
          senderName: giftData.senderName,
          senderEmail: giftData.senderEmail || null,
          message,
          status: 'draft',
        });
        console.log('[Webhook] Auto-generated thank-you draft for gift:', gift.id);
      }
    } catch (thankYouError) {
      console.error('[Webhook] Error auto-generating thank-you:', thankYouError);
    }
  }

  static async handleFamilyPlanPurchase(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const userId = metadata.userId;
    
    if (!userId) {
      console.error('[Webhook] Family plan purchase missing userId');
      return;
    }

    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription?.id;

    if (subscriptionId) {
      const stripe = await getUncachableStripeClient();
      const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
      
      await storage.upsertSubscription({
        userId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        plan: 'family',
        billingInterval: 'yearly',
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      await storage.createActivity({
        userId,
        type: 'subscription_started',
        title: 'Family Plan activated',
        description: 'Your Family Plan subscription is now active',
      });
    }
  }

  static async handleEventPassPurchase(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const eventId = metadata.eventId;
    const userId = metadata.userId;

    if (!eventId) {
      console.error('[Webhook] Event pass purchase missing eventId');
      return;
    }

    await storage.updateEvent(eventId, {
      hasEventPass: true, // Event Boost active (DB column name retained)
      eventPassPurchasedAt: new Date(),
    });

    if (userId) {
      await storage.createActivity({
        userId,
        type: 'event_pass_purchased',
        title: 'Event Boost purchased',
        description: 'Platform fee waived for gifts on this event',
      });
    }
  }

  static async handleSubscriptionUpdated(subscription: any): Promise<void> {
    console.log('[Webhook] subscription.updated:', subscription.id, subscription.status);

    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;

    const existingSub = await storage.getSubscriptionByStripeId(subscription.id);
    
    if (existingSub) {
      await storage.updateSubscription(existingSub.id, {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      });
    }
  }

  static async handleSubscriptionDeleted(subscription: any): Promise<void> {
    console.log('[Webhook] subscription.deleted:', subscription.id);

    const existingSub = await storage.getSubscriptionByStripeId(subscription.id);
    
    if (existingSub) {
      await storage.updateSubscription(existingSub.id, {
        status: 'canceled',
        canceledAt: new Date(),
      });

      await storage.createActivity({
        userId: existingSub.userId,
        type: 'subscription_canceled',
        title: 'Family Plan canceled',
        description: 'Your Family Plan subscription has been canceled',
      });
    }
  }

  static async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    console.log('[Webhook] payment_intent.succeeded:', paymentIntent.id);

    const gift = await storage.getGiftByPaymentIntent(paymentIntent.id);
    if (gift && gift.status === 'pending') {
      await storage.updateGift(gift.id, { status: 'processing' });
      console.log('[Webhook] Updated gift status to processing:', gift.id);
    }
  }

  static async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    console.log('[Webhook] payment_intent.payment_failed:', paymentIntent.id);

    const gift = await storage.getGiftByPaymentIntent(paymentIntent.id);
    if (gift) {
      await storage.updateGift(gift.id, { status: 'failed' });
    }

    await storage.createTransaction({
      type: 'payment_failed',
      stripePaymentIntentId: paymentIntent.id,
      amount: (paymentIntent.amount / 100).toString(),
      currency: paymentIntent.currency,
      status: 'failed',
      failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
    });
  }

  static async handleChargeRefunded(charge: any): Promise<void> {
    console.log('[Webhook] charge.refunded:', charge.id);

    const paymentIntentId = typeof charge.payment_intent === 'string' 
      ? charge.payment_intent 
      : charge.payment_intent?.id;

    if (paymentIntentId) {
      const gift = await storage.getGiftByPaymentIntent(paymentIntentId);
      if (gift) {
        await storage.updateGift(gift.id, { status: 'refunded' });
      }

      await storage.createTransaction({
        type: 'refund',
        stripePaymentIntentId: paymentIntentId,
        amount: ((charge.amount_refunded || 0) / 100).toString(),
        currency: charge.currency,
        status: 'completed',
        description: 'Refund processed',
        completedAt: new Date(),
      });
    }
  }

  static async handleInvoicePaid(invoice: any): Promise<void> {
    console.log('[Webhook] invoice.paid:', invoice.id);

    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

    if (subscriptionId) {
      const existingSub = await storage.getSubscriptionByStripeId(subscriptionId);
      if (existingSub) {
        await storage.createTransaction({
          userId: existingSub.userId,
          type: 'subscription_renewal',
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
          amount: ((invoice.amount_paid || 0) / 100).toString(),
          currency: invoice.currency || 'usd',
          status: 'completed',
          description: 'Family Plan renewal',
          completedAt: new Date(),
        });
      }
    }
  }

  static async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    console.log('[Webhook] invoice.payment_failed:', invoice.id);

    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

    if (subscriptionId) {
      const existingSub = await storage.getSubscriptionByStripeId(subscriptionId);
      if (existingSub) {
        await storage.createActivity({
          userId: existingSub.userId,
          type: 'payment_failed',
          title: 'Payment failed',
          description: 'Your subscription payment failed. Please update your payment method.',
        });
      }
    }
  }
}
