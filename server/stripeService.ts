import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import type Stripe from 'stripe';
import {
  calculateKoraContributionFee,
  getGiftAddOn,
  type GiftAddOnId,
  KORA_FREE_VARIABLE_RATE,
  KORA_LARGE_GIFT_FLAT_FEE,
  KORA_LARGE_GIFT_RATE,
  KORA_LARGE_GIFT_THRESHOLD,
  type FundCoverageState,
} from '@shared/monetization';

export type PaymentMethodPreference = 'card' | 'apple_pay' | 'bank' | 'cashapp' | 'paypal';

export interface GiftCheckoutParams {
  fundId: string;
  eventId?: string;
  amount: number;
  senderName: string;
  senderEmail?: string;
  message?: string;
  photoUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  coverFees: boolean;
  hasLegacyPremiumEventCoverage?: boolean;
  hasEventBoost?: boolean;
  hostPlan?: 'free' | 'starter' | 'family' | 'legacy';
  coverageStatus?: FundCoverageState;
  fundUserId?: string;
  recipientName?: string;
  successUrl: string;
  cancelUrl: string;
  paymentMethod?: PaymentMethodPreference;
  executionModel?: string;
  selectedTicker?: string;
  giftAddOn?: GiftAddOnId | null;
  // Explicit anonymous flag — when true, the resulting gift row is
  // marked is_anonymous=true and never appears in the public
  // social-proof carousel. Sender name in metadata is still set
  // (to a friendly fallback) for the success-page rendering, but
  // every public surface treats anonymous as anonymous regardless.
  isAnonymous?: boolean;
  idempotencyKey?: string;
  isParentContribution?: boolean;
  // When the parent is contributing through their own recurring schedule
  // (the "Contribute now" / "Add now" button on a schedule card), this is
  // the schedule id. Flowing it through Stripe metadata lets the resulting
  // gift carry it back into the activity row, which is what the per-schedule
  // history modal filters on. Optional — bare one-time contributions
  // (no schedule context) leave this empty and surface in the "all
  // one-time contributions" view instead.
  parentContributionId?: string;
  // Which surface initiated this gift. Persists from the request into
  // Stripe metadata into the gifts.source column at webhook time, so
  // ops can triage "which gifts came from mobile" without per-row
  // Stripe API calls. Values: 'web' | 'mobile_ios' | 'mobile_android'.
  // Defaults to 'web' on the call site if unset. See
  // OPS_RUNBOOK_MOBILE_FEE_DISPLAY_BUG_2026-05-14.md Option C.
  source?: string;
}

export interface FeeCalculation {
  baseAmount: number;
  processingFee: number;
  koraFee: number;
  koraBaseFee: number;
  koraVariableFee: number;
  koraLargeGiftFee: number;
  giftAddOnFee: number;
  giftAddOnId: GiftAddOnId;
  giftAddOnName: string;
  largeGiftThreshold: number;
  largeGiftRate: number;
  largeGiftCap: number;
  totalCharge: number;
  netToFund: number;
}

export class StripeService {
  getFeePolicy() {
    return {
      freePlanBaseFee: 0,
      freeFlatThreshold: 0,
      freeVariableRate: KORA_FREE_VARIABLE_RATE,
      starterRate: 0,
      familyRate: 0,
      largeGiftThreshold: KORA_LARGE_GIFT_THRESHOLD,
      largeGiftRate: KORA_LARGE_GIFT_RATE,
      largeGiftFlatFee: KORA_LARGE_GIFT_FLAT_FEE,
    };
  }

  private isValidEmail(email?: string | null): boolean {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  calculateFees(
    amount: number,
    coverFees: boolean,
    hasLegacyPremiumEventCoverage: boolean = false,
    coverageStatus: FundCoverageState = "uncovered",
    hostPlan: 'free' | 'starter' | 'family' | 'legacy' = 'free',
    paymentMethod: PaymentMethodPreference = 'card',
    giftAddOn: GiftAddOnId | null = null,
  ): FeeCalculation {
    const baseAmount = amount;
    let processingFee: number;
    if (paymentMethod === 'bank') {
      // ACH: 0.8%, capped at $5. Cheapest rail by far.
      processingFee = Math.round(Math.min(5, amount * 0.008) * 100) / 100;
    } else if (paymentMethod === 'paypal') {
      // PayPal in US via Stripe: 3.49% + $0.49. Slightly higher than card
      // processing, but the demographic gap it covers (older grandparents
      // who refuse to type card numbers) more than justifies the spread.
      processingFee = Math.round((amount * 0.0349 + 0.49) * 100) / 100;
    } else {
      // Card / Apple Pay / Google Pay / Cash App all share Stripe's
      // standard 2.9% + $0.30 card-rail pricing.
      processingFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
    }
    
    const effectivePlan =
      coverageStatus === "trial_active"
        ? "trial"
        : hasLegacyPremiumEventCoverage && hostPlan === "free"
          ? "starter"
          : hostPlan;
    const feeBreakdown = calculateKoraContributionFee(baseAmount, effectivePlan);
    const koraBaseFee = feeBreakdown.flatComponent;
    const koraVariableFee = feeBreakdown.variableComponent;
    const koraLargeGiftFee = feeBreakdown.largeGiftComponent;
    const koraFee = feeBreakdown.total;
    const selectedAddOn = getGiftAddOn(giftAddOn);
    const giftAddOnFee = selectedAddOn.price;

    return {
      baseAmount,
      processingFee,
      koraFee,
      koraBaseFee,
      koraVariableFee,
      koraLargeGiftFee,
      giftAddOnFee,
      giftAddOnId: selectedAddOn.id,
      giftAddOnName: selectedAddOn.name,
      largeGiftThreshold: KORA_LARGE_GIFT_THRESHOLD,
      largeGiftRate: KORA_LARGE_GIFT_RATE,
      largeGiftCap: 0,
      totalCharge: baseAmount + processingFee + koraFee + giftAddOnFee,
      netToFund: baseAmount,
    };
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

  // P0-1 "capture money at intent" (Option C: vault-and-charge-later).
  // Hosted setup-mode Checkout that saves the gifter's card for a future
  // OFF-SESSION charge at pairing — no money is charged or held now. We use
  // hosted Checkout (not embedded Elements) to match the rest of the app: the
  // client has no Stripe.js dependency. On completion the session carries a
  // confirmed `setup_intent`, captured by WebhookHandlers.handleGifterCardSetup.
  // Gated by isGifterCaptureAtIntentEnabled(); see P0-1_ADVISORY_PANEL_DECISION.md.
  async createGifterCardSetupCheckout(params: { customerId: string; successUrl: string; cancelUrl: string; metadata?: Record<string, string> }): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer: params.customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { type: 'gifter_card_setup', ...(params.metadata || {}) },
    });
  }

  async retrieveSetupIntent(id: string): Promise<Stripe.SetupIntent> {
    const stripe = await getUncachableStripeClient();
    return await stripe.setupIntents.retrieve(id);
  }

  // Off-session charge of a previously-vaulted card (P0-1 Option C settlement at
  // pairing). Throws on decline (StripeCardError) — callers must catch and fall
  // back. Gated upstream by isGifterCaptureAtIntentEnabled().
  async chargeGifterOffSession(params: { customerId: string; paymentMethodId: string; amountCents: number; metadata?: Record<string, string> }): Promise<Stripe.PaymentIntent> {
    const stripe = await getUncachableStripeClient();
    return await stripe.paymentIntents.create({
      amount: params.amountCents,
      currency: 'usd',
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: params.metadata,
    });
  }

  private getPaymentMethodTypes(preference?: PaymentMethodPreference): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
    switch (preference) {
      case 'bank':
        // ACH-only. The Stripe page locks to us_bank_account; card is
        // not shown. This is load-bearing: the gifter saw "0.8% (max $5)"
        // on the Kiddo picker; if card were a fallback, a user could
        // pay 2.9% + $0.30 instead, and we'd undercharge the processing
        // fee line item on the Stripe session by the gap (Kiddo would
        // eat the difference per transaction). Lock prevents that.
        return ['us_bank_account'];
      case 'cashapp':
        // Cash-App-only. Previously included 'card' as a fallback for
        // users whose Cash App was unavailable, but the fallback broke
        // the picker promise ("Pay with Cash App balance") and let a
        // user who selected Cash App in the Kiddo UI pay by card on
        // the Stripe page — confusing UX even though the fee math is
        // identical (both rails are 2.9% + $0.30). Locked 2026-05-25
        // per user audit. Cash App Pay supports desktop browsers via
        // QR-code redirect to the mobile app, so device-coverage is
        // not a problem.
        return ['cashapp'];
      case 'paypal':
        // PayPal-only at Stripe Checkout; no card fallback because the
        // user explicitly chose PayPal (the typical demographic actively
        // does NOT want to be funneled into entering card details).
        return ['paypal'];
      case 'apple_pay':
      case 'card':
      default:
        // Stripe's 'card' payment method type automatically includes
        // the Apple Pay / Google Pay / Link quick-pay buttons at the
        // top of the page when the device supports them. There is no
        // separate 'apple_pay' payment_method_type in the Stripe API
        // for Checkout; the apple_pay preference on the Kiddo picker
        // is purely a marketing/promotion of the same underlying rail.
        // Card fee = wallet fee (2.9% + $0.30), so the line-item
        // processing fee is identical regardless of which rail the
        // gifter ends up using on the Stripe page.
        return ['card'];
    }
  }

  async createGiftCheckoutSession(params: GiftCheckoutParams): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    const fees = this.calculateFees(
      params.amount, 
      params.coverFees, 
      params.hasLegacyPremiumEventCoverage ?? params.hasEventBoost ?? false, 
      params.coverageStatus || "uncovered",
      params.hostPlan || 'free',
      params.paymentMethod,
      params.giftAddOn || null,
    );
    const paymentMethodTypes = this.getPaymentMethodTypes(params.paymentMethod);

    const recipientLabel = params.recipientName || 'recipient';
    const giftAmountCents = Math.round(fees.netToFund * 100);
    const processingFeeCents = Math.round(fees.processingFee * 100);
    const koraBaseFeeCents = Math.round(fees.koraBaseFee * 100);
    const koraVariableFeeCents = Math.round(fees.koraVariableFee * 100);
    const giftAddOnFeeCents = Math.round(fees.giftAddOnFee * 100);
    if (giftAmountCents < 1) {
      throw new Error("Gift amount is too low. Increase the gift amount to continue.");
    }

    const payMethodLabel = params.paymentMethod === 'bank' ? 'ACH bank transfer'
      : params.paymentMethod === 'apple_pay' ? 'Apple Pay / Google Pay'
      : params.paymentMethod === 'cashapp' ? 'Cash App'
      : params.paymentMethod === 'paypal' ? 'PayPal'
      : 'Card';

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Investment gift for ${recipientLabel}`,
            description: `Full $${params.amount.toFixed(2)} goes to ${recipientLabel}'s investment fund`,
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

    if (koraBaseFeeCents > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Kiddo service fee',
            description: 'Kiddo service fee applied to this gift.',
          },
          unit_amount: koraBaseFeeCents,
        },
        quantity: 1,
      });
    }

    if (koraVariableFeeCents > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Kiddo contribution fee',
            description: 'Kiddo contribution fee applied under the current plan.',
          },
          unit_amount: koraVariableFeeCents,
        },
        quantity: 1,
      });
    }

    if (Math.round(fees.koraLargeGiftFee * 100) > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Large gift premium',
            description: 'Flat Kiddo service fee for gifts of $1,000 or more.',
          },
          unit_amount: Math.round(fees.koraLargeGiftFee * 100),
        },
        quantity: 1,
      });
    }

    if (giftAddOnFeeCents > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: fees.giftAddOnName,
            description: 'Optional premium gift upgrade. The gift amount stays whole.',
          },
          unit_amount: giftAddOnFeeCents,
        },
        quantity: 1,
      });
    }

    const senderEmail = this.isValidEmail(params.senderEmail) ? params.senderEmail!.trim() : undefined;

    let customerId: string | undefined;
    if (senderEmail) {
      try {
        const customer = await this.getOrCreateCustomer(
          senderEmail,
          params.senderName,
          undefined,
        );
        customerId = customer.id;
      } catch (customerErr) {
        console.error("Gift checkout customer lookup failed:", customerErr);
      }
    }

    const customerParams: Partial<Stripe.Checkout.SessionCreateParams> = customerId
      ? { customer: customerId }
      : (senderEmail ? { customer_email: senderEmail } : {});

    return await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      line_items,
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      ...customerParams,
      metadata: {
        type: 'gift',
        fundId: params.fundId,
        fundUserId: params.fundUserId || '',
        eventId: params.eventId || '',
        senderName: params.senderName.slice(0, 100),
        senderEmail: params.senderEmail || '',
        message: (params.message || '').slice(0, 490),
        photoUrl: (params.photoUrl || '').slice(0, 2000),
        videoUrl: (params.videoUrl || '').slice(0, 2000),
        audioUrl: (params.audioUrl || '').slice(0, 2000),
        baseAmount: params.amount.toString(),
        processingFee: fees.processingFee.toString(),
        koraFee: fees.koraFee.toString(),
        koraBaseFee: fees.koraBaseFee.toString(),
        koraVariableFee: fees.koraVariableFee.toString(),
        koraLargeGiftFee: fees.koraLargeGiftFee.toString(),
        giftAddOn: fees.giftAddOnId,
        giftAddOnFee: fees.giftAddOnFee.toString(),
        giftAddOnName: fees.giftAddOnName,
        netToFund: fees.netToFund.toString(),
        coverFees: params.coverFees.toString(),
        hasLegacyPremiumEventCoverage: String(params.hasLegacyPremiumEventCoverage ?? params.hasEventBoost ?? false),
        hasEventBoost: String(params.hasLegacyPremiumEventCoverage ?? params.hasEventBoost ?? false),
        hostPlan: params.hostPlan || 'free',
        coverageStatus: params.coverageStatus || 'uncovered',
        paymentMethod: params.paymentMethod || 'card',
        executionModel: params.executionModel || 'auto',
        selectedTicker: params.selectedTicker || '',
        isParentContribution: params.isParentContribution ? 'true' : '',
        parentContributionId: params.parentContributionId || '',
        isAnonymous: params.isAnonymous ? 'true' : '',
        source: params.source || 'web',
      },
      payment_intent_data: {
        description: `Gift of $${fees.netToFund.toFixed(2)} to ${recipientLabel}'s investment fund via Kiddo`,
        metadata: {
          type: 'gift',
          fundId: params.fundId,
          fundUserId: params.fundUserId || '',
          eventId: params.eventId || '',
          senderName: params.senderName,
          senderEmail: params.senderEmail || '',
          message: (params.message || '').slice(0, 490),
          photoUrl: (params.photoUrl || '').slice(0, 2000),
          videoUrl: (params.videoUrl || '').slice(0, 2000),
          audioUrl: (params.audioUrl || '').slice(0, 2000),
          baseAmount: params.amount.toString(),
          processingFee: fees.processingFee.toString(),
          koraFee: fees.koraFee.toString(),
          koraBaseFee: fees.koraBaseFee.toString(),
          koraVariableFee: fees.koraVariableFee.toString(),
          koraLargeGiftFee: fees.koraLargeGiftFee.toString(),
          giftAddOn: fees.giftAddOnId,
          giftAddOnFee: fees.giftAddOnFee.toString(),
          giftAddOnName: fees.giftAddOnName,
          netToFund: fees.netToFund.toString(),
          executionModel: params.executionModel || 'auto',
          selectedTicker: params.selectedTicker || '',
          isParentContribution: params.isParentContribution ? 'true' : '',
          parentContributionId: params.parentContributionId || '',
          isAnonymous: params.isAnonymous ? 'true' : '',
          source: params.source || 'web',
        },
      },
    }, params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined);
  }

  async createCheckoutSession(
    priceId: string, 
    mode: 'subscription' | 'payment',
    successUrl: string, 
    cancelUrl: string,
    metadata?: Record<string, string>,
    customerId?: string,
    idempotencyKey?: string
  ): Promise<Stripe.Checkout.Session> {
    const stripe = await getUncachableStripeClient();
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      // Omitting payment_method_types lets Stripe automatically show card, Apple Pay, Google Pay
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }
    if (mode === "subscription" && metadata) {
      sessionParams.subscription_data = { metadata };
    }

    return await stripe.checkout.sessions.create(
      sessionParams,
      idempotencyKey ? { idempotencyKey } : undefined,
    );
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

  // Used by the gift-receipt enrichment path (server/routes.ts) to
  // surface payment-method brand + last4 in the receipt email. Same
  // call recurringContributionWorker uses inline; promoted to a
  // service method here so the routes module doesn't have to import
  // the stripe client directly. Locked 2026-05-19 per the gifter
  // receipt-grade polish.
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    const stripe = await getUncachableStripeClient();
    return await stripe.paymentMethods.retrieve(paymentMethodId);
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
