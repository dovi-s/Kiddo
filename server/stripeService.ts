import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import type Stripe from 'stripe';

export type PaymentMethodPreference = 'card' | 'apple_pay' | 'bank' | 'cashapp';

export interface GiftCheckoutParams {
  fundId: string;
  eventId?: string;
  amount: number;
  senderName: string;
  senderEmail?: string;
  message?: string;
  coverFees: boolean;
  hasEventBoost?: boolean;
  hasPaidPlan?: boolean;
  fundUserId?: string;
  recipientName?: string;
  successUrl: string;
  cancelUrl: string;
  paymentMethod?: PaymentMethodPreference;
  executionModel?: string;
  selectedTicker?: string;
}

export interface FeeCalculation {
  baseAmount: number;
  processingFee: number;
  koraFee: number;
  totalCharge: number;
  netToFund: number;
}

export class StripeService {
  calculateFees(amount: number, coverFees: boolean, hasEventBoost: boolean = false, hasPaidPlan: boolean = false, paymentMethod: PaymentMethodPreference = 'card'): FeeCalculation {
    const baseAmount = amount;
    let processingFee: number;
    if (paymentMethod === 'bank') {
      processingFee = Math.round(Math.min(5, amount * 0.008) * 100) / 100;
    } else {
      processingFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
    }
    
    let koraFee = 0;
    if (!hasPaidPlan && !hasEventBoost) {
      koraFee = 2.00;
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
        totalCharge: baseAmount,
        netToFund: baseAmount - processingFee - koraFee,
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

  private getPaymentMethodTypes(preference?: PaymentMethodPreference): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
    switch (preference) {
      case 'bank':
        return ['us_bank_account'];
      case 'cashapp':
        return ['cashapp', 'card'];
      case 'apple_pay':
      case 'card':
      default:
        return ['card'];
    }
  }

  async createGiftCheckoutSession(params: GiftCheckoutParams): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    const fees = this.calculateFees(
      params.amount, 
      params.coverFees, 
      params.hasEventBoost || false, 
      params.hasPaidPlan || false,
      params.paymentMethod
    );
    const paymentMethodTypes = this.getPaymentMethodTypes(params.paymentMethod);

    const recipientLabel = params.recipientName || 'recipient';
    const giftAmountCents = Math.round(fees.netToFund * 100);
    const processingFeeCents = Math.round(fees.processingFee * 100);
    const koraFeeCents = Math.round(fees.koraFee * 100);

    const payMethodLabel = params.paymentMethod === 'bank' ? 'ACH bank transfer' 
      : params.paymentMethod === 'apple_pay' ? 'Apple Pay / Google Pay'
      : params.paymentMethod === 'cashapp' ? 'Cash App'
      : 'Card';

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Investment gift for ${recipientLabel}`,
            description: params.coverFees
              ? `Full $${params.amount.toFixed(2)} goes to ${recipientLabel}'s investment fund`
              : `$${fees.netToFund.toFixed(2)} deposited into ${recipientLabel}'s investment fund`,
          },
          unit_amount: giftAmountCents,
        },
        quantity: 1,
      },
    ];

    if (processingFeeCents > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Payment processing (${payMethodLabel})`,
            description: params.paymentMethod === 'bank'
              ? 'ACH transfer fee: 0.8% of gift amount, capped at $5.00'
              : `${payMethodLabel} processing: 2.9% + $0.30`,
          },
          unit_amount: processingFeeCents,
        },
        quantity: 1,
      });
    }

    if (koraFeeCents > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Kora platform fee',
            description: '$2.00 per gift on Free plan. Upgrade to Starter or Family to remove this fee.',
          },
          unit_amount: koraFeeCents,
        },
        quantity: 1,
      });
    }

    if (fees.koraFee === 0 && (params.hasEventBoost || params.hasPaidPlan)) {
      const waiver = params.hasPaidPlan 
        ? 'Kora platform fee waived by your subscription'
        : 'Kora platform fee waived by Event Boost';
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${waiver}`,
            description: 'Normally $2.00 per gift. Saving you money on every gift.',
          },
          unit_amount: 0,
        },
        quantity: 1,
      });
    }

    return await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      line_items,
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
        hasEventBoost: (params.hasEventBoost || false).toString(),
        hasPaidPlan: (params.hasPaidPlan || false).toString(),
        paymentMethod: params.paymentMethod || 'card',
        executionModel: params.executionModel || 'auto',
        selectedTicker: params.selectedTicker || '',
      },
      payment_intent_data: {
        description: `Gift of $${fees.netToFund.toFixed(2)} to ${recipientLabel}'s investment fund via Kora`,
        metadata: {
          type: 'gift',
          fundId: params.fundId,
          fundUserId: params.fundUserId || '',
          eventId: params.eventId || '',
          senderName: params.senderName,
          baseAmount: params.amount.toString(),
          processingFee: fees.processingFee.toString(),
          koraFee: fees.koraFee.toString(),
          netToFund: fees.netToFund.toString(),
          executionModel: params.executionModel || 'auto',
          selectedTicker: params.selectedTicker || '',
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
