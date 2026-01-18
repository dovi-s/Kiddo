import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import type Stripe from 'stripe';

export interface GiftCheckoutParams {
  fundId: string;
  eventId?: string;
  amount: number;
  senderName: string;
  senderEmail?: string;
  message?: string;
  coverFees: boolean;
  hasEventPass?: boolean;
  hasFamilyPlan?: boolean;
  fundUserId?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface FeeCalculation {
  baseAmount: number;
  processingFee: number;
  koraFee: number;
  totalCharge: number;
  netToFund: number;
}

export class StripeService {
  calculateFees(amount: number, coverFees: boolean, hasEventPass: boolean = false, hasFamilyPlan: boolean = false): FeeCalculation {
    const baseAmount = amount;
    const processingFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
    
    let koraFee = 0;
    if (!hasEventPass && !hasFamilyPlan) {
      koraFee = Math.min(Math.max(amount * 0.015, 1), 10);
      koraFee = Math.round(koraFee * 100) / 100;
    }

    if (coverFees) {
      return {
        baseAmount,
        processingFee,
        koraFee,
        totalCharge: baseAmount + processingFee + koraFee,
        netToFund: baseAmount,
      };
    } else {
      return {
        baseAmount,
        processingFee,
        koraFee,
        totalCharge: baseAmount + processingFee + koraFee,
        netToFund: baseAmount - koraFee,
      };
    }
  }

  async getPublishableKey(): Promise<string> {
    return await getStripePublishableKey();
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      name,
      metadata,
    });
  }

  async getOrCreateCustomer(email: string, name?: string, userId?: string): Promise<Stripe.Customer> {
    const stripe = await getUncachableStripeClient();
    
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    return await this.createCustomer(email, name, userId ? { userId } : undefined);
  }

  async createGiftCheckoutSession(params: GiftCheckoutParams): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    const fees = this.calculateFees(
      params.amount, 
      params.coverFees, 
      params.hasEventPass || false, 
      params.hasFamilyPlan || false
    );
    const totalCents = Math.round(fees.totalCharge * 100);

    return await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Gift to fund`,
            description: params.message ? `"${params.message.slice(0, 100)}"` : 'Investment gift',
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.senderEmail,
      metadata: {
        type: 'gift',
        fundId: params.fundId,
        fundUserId: params.fundUserId || '',
        eventId: params.eventId || '',
        senderName: params.senderName,
        senderEmail: params.senderEmail || '',
        message: params.message || '',
        baseAmount: params.amount.toString(),
        processingFee: fees.processingFee.toString(),
        koraFee: fees.koraFee.toString(),
        netToFund: fees.netToFund.toString(),
        coverFees: params.coverFees.toString(),
        hasEventPass: (params.hasEventPass || false).toString(),
        hasFamilyPlan: (params.hasFamilyPlan || false).toString(),
      },
      payment_intent_data: {
        metadata: {
          type: 'gift',
          fundId: params.fundId,
          fundUserId: params.fundUserId || '',
          eventId: params.eventId || '',
        },
      },
    });
  }

  async createCheckoutSession(
    priceId: string, 
    mode: 'subscription' | 'payment',
    successUrl: string, 
    cancelUrl: string,
    metadata?: Record<string, string>,
    customerId?: string
  ): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }

    return await stripe.checkout.sessions.create(sessionParams);
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = await getUncachableStripeClient();
    return await stripe.subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    const stripe = await getUncachableStripeClient();
    
    if (immediately) {
      return await stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = await getUncachableStripeClient();
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const stripe = await getUncachableStripeClient();
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    const stripe = await getUncachableStripeClient();
    return await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as Stripe.RefundCreateParams.Reason,
    });
  }

  async listCustomerPayments(customerId: string, limit: number = 10): Promise<Stripe.PaymentIntent[]> {
    const stripe = await getUncachableStripeClient();
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit,
    });
    return paymentIntents.data;
  }

  async listCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    const stripe = await getUncachableStripeClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
    });
    return subscriptions.data;
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'subscription', 'customer'],
    });
  }
}

export const stripeService = new StripeService();
