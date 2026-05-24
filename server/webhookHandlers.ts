import Stripe from 'stripe';
import { getStripeSecretKey, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { db } from './db';
import { webhookEvents, transactions, memoryEntries, subscriptions, fundMemberships, recurringGifts } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { captureError, sendOpsAlert } from './ops';
import { recordEvent } from './analytics';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_CUSTOM_ALLOCATIONS, getFundCustomAllocations } from './fundStrategyConfig';
import {
  fireMoneyCrossMilestones,
  fireReturningGifterMilestone,
  fireUniqueGiftersMilestone,
  fireFirstVoiceMilestone,
  fireFirstPhotoMilestone,
} from './milestones';
import { getMarketQuote, ADMIN_ASSET_UNIVERSE } from './marketQuotes';
import { publishToUser } from './realtime';

export class WebhookHandlers {
  private static readonly INVESTMENT_CONFIG_PATH = path.join(process.cwd(), '.local', 'investment-config.json');
  private static readonly LARGE_GIFT_HOLD_THRESHOLD = 1000;
  // Heads-up email threshold. Independent from the HOLD threshold
  // above. Any gift at or above this amount triggers a one-off
  // alert email to the parent so they can verify it was expected.
  // Locked 2026-05-15 per the email-strategy review's Tier 1 #7.
  // Skipped for parent-self-contributions (those go through the
  // parent's own UI; no need to alert them about their own gift).
  private static readonly LARGE_GIFT_ALERT_THRESHOLD = 500;

  private static readonly DEFAULT_AUTO_STRATEGIES: Record<string, { label: string; allocations: Record<string, number> }> = {
    growth: {
      label: 'Growth Mix',
      allocations: { VTI: 0.50, VXUS: 0.25, BND: 0.15, VGT: 0.10 },
    },
    balanced: {
      label: 'Balanced Mix',
      allocations: { VTI: 0.35, VXUS: 0.15, BND: 0.35, VGT: 0.15 },
    },
    // For children approaching 18 — heavy bonds, capital preservation tilt.
    conservative: {
      label: 'Conservative Mix',
      allocations: { VTI: 0.30, BND: 0.40, VXUS: 0.20, VGT: 0.10 },
    },
  };

  private static readonly DEFAULT_UNIVERSE: Record<string, { name: string; source: 'auto_invest' | 'stock_pick' | 'both'; enabled: boolean }> = {
    VTI:  { name: 'Vanguard Total Stock Market ETF',         source: 'auto_invest', enabled: true },
    VXUS: { name: 'Vanguard Total International Stock ETF',  source: 'auto_invest', enabled: true },
    BND:  { name: 'Vanguard Total Bond Market ETF',          source: 'auto_invest', enabled: true },
    VGT:  { name: 'Vanguard Information Technology ETF',     source: 'auto_invest', enabled: true },
    VUG:  { name: 'Vanguard Growth ETF',                     source: 'auto_invest', enabled: true },
    VYM:  { name: 'Vanguard High Dividend Yield ETF',        source: 'auto_invest', enabled: true },
    SCHD: { name: 'Schwab US Dividend Equity ETF',           source: 'auto_invest', enabled: true },
    QQQ:  { name: 'Invesco QQQ Trust (Nasdaq 100)',          source: 'auto_invest', enabled: true },
  };

  private static readonly ALLOWED_VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "loom.com"];

  private static normalizeHttpUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 2000) return null;
    if (trimmed.startsWith("/uploads/")) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private static normalizeVideoUrl(value: unknown): string | null {
    const normalized = this.normalizeHttpUrl(value);
    if (!normalized) return null;
    if (normalized.startsWith("/uploads/")) return normalized;
    if (normalized.startsWith("/")) return null;
    const host = new URL(normalized).hostname.toLowerCase();
    const allowed = this.ALLOWED_VIDEO_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
    return allowed ? normalized : null;
  }

  private static async reconcileFundFromGifts(fundId?: string | null): Promise<void> {
    if (!fundId) return;
    const fund = await storage.getFund(fundId);
    if (!fund) return;
    const fundGifts = await storage.getGiftsByFund(fundId);

    const pendingFromGifts = fundGifts
      .filter((g) => g.status === 'pending' || g.status === 'processing')
      .reduce((sum, g) => sum + parseFloat(g.netAmount || g.amount || '0'), 0);

    const contributorCount = new Set(
      fundGifts
        .map((g) => (g.senderEmail || g.senderName || '').trim().toLowerCase())
        .filter(Boolean)
    ).size;

    const updates: any = {
      pendingBalance: pendingFromGifts.toFixed(2),
      contributorCount,
    };

    // If real paid gifts exist, keep fund accessible in dashboard as active.
    if (fund.status === 'draft' && fundGifts.length > 0) {
      updates.status = 'active';
    }

    await storage.updateFund(fundId, updates);
  }

  private static shouldHoldGiftForHostDecision(metadata: any): boolean {
    const coverageStatus = String(metadata?.coverageStatus || "uncovered").toLowerCase();
    const hostPlan = String(metadata?.hostPlan || "free").toLowerCase();
    const coverFees = String(metadata?.coverFees || "false").toLowerCase() === "true";
    const amount = Number(metadata?.baseAmount || 0);
    if (coverFees) return false;
    if (!Number.isFinite(amount) || amount < this.LARGE_GIFT_HOLD_THRESHOLD) return false;
    if (coverageStatus === "trial_active") return false;
    return hostPlan === "free" && coverageStatus === "uncovered";
  }

  static async completeGiftPostPayment(giftId: string, metadata: any): Promise<void> {
    const gift = await storage.getGift(giftId);
    if (!gift) return;
    const fund = await storage.getFund(gift.fundId);
    if (!fund) return;

    // Snapshot the fund's TOTAL value before the gift credits — used by
    // money-cross milestones to detect threshold crossings on this update.
    // Total = balance + pending + cash, since money in any of these
    // counts toward the parent's "fund worth this much" reading.
    const prevTotal =
      parseFloat(fund.balance || '0') +
      parseFloat(fund.pendingBalance || '0') +
      parseFloat(String((fund as any).cashBalance || '0'));

    try {
      const nextPending = parseFloat(fund.pendingBalance || '0') + parseFloat(gift.netAmount || gift.amount || '0');
      const nextContributors = Math.max(0, Number(fund.contributorCount || 0)) + 1;
      await storage.updateFund(fund.id, {
        pendingBalance: nextPending.toFixed(2),
        contributorCount: nextContributors,
      });
    } catch (fundCreditError) {
      console.error('[Webhook] Failed to credit pending balance for gift:', gift.id, fundCreditError);
    }

    await this.ensureFundPendingCoversPendingGifts(gift.fundId);
    await this.reconcileFundFromGifts(gift.fundId);
    await this.investGiftImmediatelyIfNeeded(gift.id);

    // Large-gift verification heads-up. Fires when a non-parent
    // contribution at or above the alert threshold lands. Best-
    // effort: any failure logs but never blocks the rest of the
    // webhook pipeline. Locked 2026-05-15 per the Tier 1 email
    // strategy.
    try {
      const giftAmountForAlert = parseFloat(gift.amount || "0");
      const isParent = String(metadata?.isParentContribution || "").toLowerCase() === "true";
      if (!isParent && Number.isFinite(giftAmountForAlert) && giftAmountForAlert >= this.LARGE_GIFT_ALERT_THRESHOLD) {
        const [{ buildLargeGiftAlertEmail }, { sendEmail }, { db }, { users }, { eq }] = await Promise.all([
          import("./templates/largeGiftAlert"),
          import("./emailDelivery"),
          import("./db"),
          import("@shared/schema"),
          import("drizzle-orm"),
        ]);
        const parentRows = await db
          .select({ email: users.email, firstName: users.firstName })
          .from(users)
          .where(eq(users.id, fund.userId))
          .limit(1);
        const parentEmail = parentRows[0]?.email;
        if (parentEmail) {
          const baseUrl =
            process.env.APP_BASE_URL ||
            process.env.PUBLIC_APP_URL ||
            "https://kiddofund.com";
          const dashboardUrl = `${baseUrl.replace(/\/+$/, "")}/dashboard?fund=${encodeURIComponent(fund.id)}`;
          await sendEmail(buildLargeGiftAlertEmail({
            to: parentEmail,
            parentFirstName: parentRows[0]?.firstName ?? null,
            childFirstName: fund.recipientFirstName || "your child",
            gifterName: gift.senderName || null,
            amountUsd: giftAmountForAlert,
            arrivedAt: gift.createdAt ? new Date(gift.createdAt) : new Date(),
            dashboardUrl,
          }));
        }
      }
    } catch (alertErr) {
      console.warn("[Webhook] large-gift alert failed (non-fatal):", alertErr);
    }

    // Update the gifter-notification subscriber record's per-gifter counts
    // when the sender is opted in. The fund's aggregate contributorCount
    // got bumped above; the matching subscriber record's contributionCount
    // and totalContributed used to never increment, leaving the
    // Settings → Notifications "Gifter subscribers" panel showing
    // "0 gifts · $0" for every subscriber regardless of actual giving.
    // Skip for parent self-contributions — those flow through the
    // parent's own UI, not the gifter-notification path.
    if (String(metadata?.isParentContribution || '').toLowerCase() !== 'true') {
      try {
        const { recordGifterGiftContribution } = await import("./gifterNotificationWorker");
        await recordGifterGiftContribution(
          gift.fundId,
          gift.senderEmail,
          parseFloat(gift.netAmount || gift.amount || "0"),
          gift.createdAt ? new Date(gift.createdAt) : new Date(),
        );
      } catch (recordErr) {
        console.warn("[Webhook] Failed to record gifter contribution:", recordErr);
      }
    }

    const isParentContrib = String(metadata?.isParentContribution || '').toLowerCase() === 'true';
    if (!isParentContrib) {
      try {
        await this.ensureMemoryEntryForGift(gift.id, this.normalizeVideoUrl(metadata?.videoUrl), metadata?.audioUrl || null);
        console.log('[Webhook] Memory entry created for gift:', gift.id);
      } catch (memoryError) {
        console.error('[Webhook] Failed to create memory entry for gift:', gift.id, memoryError);
      }
    }

    try {
      const isParentContrib = String(metadata?.isParentContribution || '').toLowerCase() === 'true';
      // Reconcile fields are passed through by the recurring worker (and any
      // future one-time parent flow) so the History row can show payment
      // method + receipt link inline. Empty strings collapse to null so the
      // metadata stays clean for older rows that pre-date this enrichment.
      const reconcileBrand = typeof metadata?.paymentMethodBrand === 'string' && metadata.paymentMethodBrand ? metadata.paymentMethodBrand : null;
      const reconcileLast4 = typeof metadata?.paymentMethodLast4 === 'string' && metadata.paymentMethodLast4 ? metadata.paymentMethodLast4 : null;
      const reconcileReceiptUrl = typeof metadata?.stripeReceiptUrl === 'string' && metadata.stripeReceiptUrl ? metadata.stripeReceiptUrl : null;
      const reconcileDescriptor = typeof metadata?.descriptor === 'string' && metadata.descriptor ? metadata.descriptor : null;
      await storage.createActivity({
        userId: metadata?.fundUserId || metadata?.userId || null,
        fundId: gift.fundId,
        type: isParentContrib ? 'parent_contribution' : 'gift_received',
        title: isParentContrib
          ? `You contributed $${parseFloat(gift.amount || '0').toFixed(2)}`
          : `Gift from ${gift.senderName}`,
        description: isParentContrib
          ? (gift.selectedTicker ? `Investing into ${String(gift.selectedTicker).toUpperCase()}` : 'Investing across the diversified mix')
          : (gift.message ? `"${gift.message}"` : 'No note.'),
        amount: gift.amount,
        metadata: JSON.stringify({
          giftId: gift.id,
          ticker: gift.selectedTicker || null,
          message: gift.message || null,
          eventId: gift.eventId || null,
          executionModel: (gift as any).executionModel || null,
          senderEmail: gift.senderEmail || null,
          isParentContribution: isParentContrib,
          // Schedule link: prefer the gift's own column (set at creation
          // for both worker and Contribute-Now flows) so the per-schedule
          // history modal picks up every fire. Fall back to the metadata
          // flag if the gift somehow didn't capture it.
          parentContributionId: (gift as any).parentContributionId || metadata?.parentContributionId || null,
          paymentMethodBrand: reconcileBrand,
          paymentMethodLast4: reconcileLast4,
          stripeReceiptUrl: reconcileReceiptUrl,
          descriptor: reconcileDescriptor,
        }),
      });
    } catch (activityError) {
      console.error('[Webhook] Failed to create activity for gift:', gift.id, activityError);
    }

    if (gift.eventId) {
      try {
        await storage.incrementEventGiftStats(gift.eventId, parseFloat(gift.amount || '0'));
      } catch (eventStatsError) {
        console.error('[Webhook] Failed to increment event stats for gift:', gift.id, eventStatsError);
      }
    } else {
      // No eventId means the gift came via the fund URL directly. Attribute to the permanent event.
      try {
        const fundEvents = await storage.getEventsByFund(gift.fundId);
        const permanentEvent = fundEvents.find((e: any) => e.isPermanent);
        if (permanentEvent) {
          await storage.incrementEventGiftStats(permanentEvent.id, parseFloat(gift.amount || '0'));
        }
      } catch (permEventError) {
        console.error('[Webhook] Failed to update permanent event stats for gift:', gift.id, permEventError);
      }
    }

    try {
      const existingThankYous = await storage.getThankYousByFund(gift.fundId);
      const alreadyExists = existingThankYous.some((ty) => ty.giftId === gift.id);
      if (!alreadyExists) {
        const message = `Thank you ${gift.senderName} for your generous gift of $${parseFloat(gift.amount || '0').toFixed(2)} to ${fund?.name || 'the fund'}!`;
        await storage.createThankYou({
          fundId: gift.fundId,
          giftId: gift.id,
          senderName: gift.senderName,
          senderEmail: gift.senderEmail || null,
          message,
          status: 'draft',
        });
      }
    } catch (thankYouError) {
      console.error('[Webhook] Error auto-generating thank-you:', thankYouError);
    }

    // Milestones engine — fire celebratory rows for emotional moments the
    // raw transaction log doesn't capture. Each helper is best-effort and
    // dedup-guarded internally, so re-running this method is idempotent.
    // We re-fetch the fund AFTER all updates above to read the post-state
    // total accurately. Skipped entirely for parent contributions on the
    // returning-gifter / unique-gifters paths (those are about external
    // community moments, not the parent's own money).
    try {
      const isParentContrib = String(metadata?.isParentContribution || '').toLowerCase() === 'true';
      const settledFund = await storage.getFund(gift.fundId);
      if (settledFund && (settledFund as any).userId) {
        const ownerId = String((settledFund as any).userId);
        const newTotal =
          parseFloat(settledFund.balance || '0') +
          parseFloat(settledFund.pendingBalance || '0') +
          parseFloat(String((settledFund as any).cashBalance || '0'));
        await fireMoneyCrossMilestones(gift.fundId, ownerId, prevTotal, newTotal);
        if (!isParentContrib) {
          if (gift.senderEmail) {
            await fireReturningGifterMilestone(gift.fundId, ownerId, gift.senderEmail, gift.senderName || null);
          }
          await fireUniqueGiftersMilestone(gift.fundId, ownerId);
        }
        // First-X memory-media milestones (only when the gift carried a
        // photo or audio that gets stamped into the Memory Book — covered
        // by ensureMemoryEntryForGift above).
        if (!isParentContrib) {
          if (typeof metadata?.audioUrl === 'string' && metadata.audioUrl.trim()) {
            await fireFirstVoiceMilestone(gift.fundId, ownerId);
          }
          // Photo URL lands via different metadata keys depending on the
          // gift checkout path; check the conventional ones.
          const photoUrlMaybe = metadata?.photoUrl || metadata?.photo_url || null;
          if (typeof photoUrlMaybe === 'string' && photoUrlMaybe.trim()) {
            await fireFirstPhotoMilestone(gift.fundId, ownerId);
          }
        }
      }
    } catch (milestoneError) {
      console.warn('[Webhook] Milestones engine non-fatal failure:', milestoneError);
    }

    // Realtime nudge to any parent dashboard tabs the fund owner has open.
    // The payload is a hint, not state — the client re-fetches the
    // dashboard summary on receipt. See server/realtime.ts. Both the
    // Stripe webhook path and the recurring-contribution worker funnel
    // through this method, so one publish covers both arrival sources.
    // Failures here must NEVER mask the gift completion; swallow them.
    try {
      const ownerIdForRealtime = String((fund as any).userId || '');
      if (ownerIdForRealtime) {
        publishToUser(ownerIdForRealtime, {
          type: 'gift.arrived',
          fundId: fund.id,
          giftId: gift.id,
        });
      }
    } catch (realtimeError) {
      console.warn('[Webhook] Realtime publish failed (non-fatal):', realtimeError);
    }
  }

  private static getAutoInvestBasket() {
    return [
      { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', weight: 0.50 },
      { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', weight: 0.25 },
      { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', weight: 0.15 },
      { ticker: 'VGT', name: 'Vanguard Information Technology ETF', weight: 0.10 },
    ];
  }

  private static normalizeAllocations(raw: Record<string, unknown>): Record<string, number> {
    const allocations: Record<string, number> = {};
    let total = 0;
    for (const [tickerRaw, weightRaw] of Object.entries(raw || {})) {
      const ticker = String(tickerRaw || '').trim().toUpperCase();
      const weight = Number(weightRaw);
      if (!ticker || !Number.isFinite(weight) || weight <= 0) continue;
      allocations[ticker] = weight;
      total += weight;
    }
    if (total <= 0) return {};
    for (const ticker of Object.keys(allocations)) {
      allocations[ticker] = allocations[ticker] / total;
    }
    return allocations;
  }

  // Tax-smart contribution rebalancing.
  //
  // Acorns rebalances by selling — but in a UTMA each sale is a taxable event for the
  // child. Instead, we let the portfolio drift toward target by weighting NEW contributions
  // toward whichever strategy tickers are currently UNDER their target weight.
  //
  // Inputs:
  //   targetBasket   — the strategy's target weights (sum to 1, decimals)
  //   fundId         — to read current holdings
  //   newAmount      — the dollar amount of this contribution
  //
  // Output: per-ticker dollar allocations summing to newAmount.
  private static async computeContributionAllocations(
    targetBasket: Array<{ ticker: string; name: string; weight: number }>,
    fundId: string,
    newAmount: number,
  ): Promise<Array<{ ticker: string; name: string; weight: number; dollars: number }>> {
    if (!targetBasket.length || newAmount <= 0) return [];

    const holdings = await storage.getHoldingsByFund(fundId);
    const currentByTicker = new Map<string, number>();
    let currentTotal = 0;
    for (const asset of targetBasket) {
      const h = holdings.find((x: any) => String(x.ticker || "").toUpperCase() === asset.ticker.toUpperCase());
      const v = h ? parseFloat(String((h as any).currentValue || (h as any).cost_basis || 0)) : 0;
      currentByTicker.set(asset.ticker.toUpperCase(), Number.isFinite(v) ? v : 0);
      currentTotal += Number.isFinite(v) ? v : 0;
    }

    // No managed-mix history yet: just apply target weights.
    if (currentTotal <= 0.01) {
      return targetBasket.map(a => ({ ticker: a.ticker, name: a.name, weight: a.weight, dollars: newAmount * a.weight }));
    }

    // Compute under-weight gap per ticker, projected against the post-contribution total.
    const totalAfter = currentTotal + newAmount;
    const gaps = targetBasket.map(a => {
      const targetDollars = totalAfter * a.weight;
      const currentDollars = currentByTicker.get(a.ticker.toUpperCase()) || 0;
      const gap = Math.max(0, targetDollars - currentDollars);
      return { asset: a, gap };
    });
    const totalGap = gaps.reduce((s, g) => s + g.gap, 0);

    // Edge case: nothing under-weight (everything overshoots target). Should be rare.
    // Fall back to plain target weights so we always invest something.
    if (totalGap <= 0.01) {
      return targetBasket.map(a => ({ ticker: a.ticker, name: a.name, weight: a.weight, dollars: newAmount * a.weight }));
    }

    return gaps.map(g => ({
      ticker: g.asset.ticker,
      name: g.asset.name,
      weight: g.asset.weight,
      dollars: newAmount * (g.gap / totalGap),
    }));
  }

  private static async getAutoInvestBasketFromConfig(strategy?: string | null, fundId?: string | null) {
    try {
      const raw = await fs.readFile(this.INVESTMENT_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw || '{}') as any;
      const universeRaw = (parsed?.universe && typeof parsed.universe === 'object') ? parsed.universe : {};
      const strategiesRaw = (parsed?.autoStrategies && typeof parsed.autoStrategies === 'object') ? parsed.autoStrategies : {};

      const universe: Record<string, { name: string; source: 'auto_invest' | 'stock_pick' | 'both'; enabled: boolean }> = { ...this.DEFAULT_UNIVERSE };
      for (const [tickerRaw, rowRaw] of Object.entries(universeRaw)) {
        const ticker = String(tickerRaw || '').trim().toUpperCase();
        if (!ticker) continue;
        const row: any = rowRaw || {};
        const source = row.source === 'auto_invest' || row.source === 'stock_pick' || row.source === 'both'
          ? row.source
          : 'stock_pick';
        universe[ticker] = {
          name: String(row.name || ticker),
          source,
          enabled: row.enabled !== false,
        };
      }

      const normalizedStrategies: Record<string, { label: string; allocations: Record<string, number> }> = {};
      for (const [keyRaw, stratRaw] of Object.entries(strategiesRaw)) {
        const key = String(keyRaw || '').trim().toLowerCase();
        if (!key) continue;
        const strat: any = stratRaw || {};
        const allocations = this.normalizeAllocations((strat.allocations && typeof strat.allocations === 'object') ? strat.allocations : {});
        if (Object.keys(allocations).length === 0) continue;
        normalizedStrategies[key] = {
          label: String(strat.label || key),
          allocations,
        };
      }
      const strategies = Object.keys(normalizedStrategies).length > 0 ? normalizedStrategies : this.DEFAULT_AUTO_STRATEGIES;
      const requested = String(strategy || '').trim().toLowerCase();
      const allocations = requested === "custom" && fundId
        ? ((await getFundCustomAllocations(fundId)) || DEFAULT_CUSTOM_ALLOCATIONS)
        : ((strategies[requested] || strategies.balanced || strategies.growth || Object.values(strategies)[0])?.allocations || {});
      const rows = Object.entries(allocations)
        .map(([ticker, weight]) => {
          const meta = universe[ticker];
          const enabled = meta?.enabled !== false;
          const source = meta?.source || 'stock_pick';
          const allowedForAuto = source === 'auto_invest' || source === 'both';
          if (!enabled || !allowedForAuto || Number(weight) <= 0) return null;
          return {
            ticker,
            name: meta?.name || ticker,
            weight: Number(weight),
          };
        })
        .filter((x): x is { ticker: string; name: string; weight: number } => Boolean(x));

      const total = rows.reduce((sum, r) => sum + r.weight, 0);
      if (total <= 0) return this.getAutoInvestBasket();
      return rows.map((r) => ({ ...r, weight: r.weight / total }));
    } catch {
      return this.getAutoInvestBasket();
    }
  }

  private static async investGiftImmediatelyIfNeeded(giftId: string): Promise<void> {
    const gift = await storage.getGift(giftId);
    if (!gift) return;
    if (gift.status === 'invested') return;
    if (gift.status === 'host_hold') return;

    const executionRaw = String(gift.executionModel || '').toLowerCase();
    const isCash = executionRaw === 'cash';
    const isPick = !isCash && executionRaw.includes('pick') && !!gift.selectedTicker;
    // isAuto when neither cash nor pick — that's the legacy default behavior
    // (managed-strategy auto-allocation). isCash short-circuits both branches
    // so the cash-park fallback below handles it cleanly.
    const isAuto = !isCash && !isPick;

    const fund = await storage.getFund(gift.fundId);
    if (!fund) return;

    const investAmount = parseFloat(gift.netAmount || gift.amount || '0');
    if (investAmount <= 0) return;

    // Track which assets were invested so activity can describe them precisely
    let investedPositions: Array<{ ticker: string; name: string; shares: number; price: number }> = [];
    let pickSharesAcquired: number | null = null;
    let pickPriceAtPurchase: number | null = null;

    if (isPick) {
      const ticker = String(gift.selectedTicker || '').toUpperCase();
      // No valid ticker on a pick gift — let it fall through to the post-loop check,
      // which will park the money in cashBalance instead of leaving it stranded in
      // pendingBalance with no resolution path.
      if (!ticker) {
        // intentionally skip the pick branch; investedPositions stays empty
      } else {
      const quote = await getMarketQuote(ticker);
      const price = quote?.price || 100;
      const sharesBought = investAmount / price;
      pickSharesAcquired = sharesBought;
      pickPriceAtPurchase = price;

      const existingHolding = await storage.getHoldingByFundAndTicker(fund.id, ticker);
      if (existingHolding) {
        const nextShares = parseFloat(existingHolding.shares || '0') + sharesBought;
        const nextCostBasis = parseFloat(existingHolding.costBasis || '0') + investAmount;
        const nextCurrentValue = parseFloat(existingHolding.currentValue || '0') + investAmount;
        await storage.updateHolding(existingHolding.id, {
          shares: nextShares.toFixed(6),
          costBasis: nextCostBasis.toFixed(2),
          currentValue: nextCurrentValue.toFixed(2),
          gain: (nextCurrentValue - nextCostBasis).toFixed(2),
        });
      } else {
        // Use the proper brand name from the asset universe so the dashboard
        // doesn't end up showing "AAPL · AAPL" duplicated. Fall back to the
        // ticker as a last resort.
        const brandName = ADMIN_ASSET_UNIVERSE[ticker]?.name || ticker;
        await storage.createHolding({
          fundId: fund.id,
          ticker,
          name: brandName,
          shares: sharesBought.toFixed(6),
          costBasis: investAmount.toFixed(2),
          currentValue: investAmount.toFixed(2),
          gain: '0.00',
        });
      }
      // Record the precise allocation: this gift fully funded this ticker.
      // Used by the holding detail sheet for exact contributor attribution.
      await storage.createGiftAllocation({
        giftId: gift.id,
        fundId: fund.id,
        ticker,
        costBasis: investAmount.toFixed(2),
        shares: sharesBought.toFixed(6),
        source: "pick",
      });
      investedPositions = [{ ticker, name: ticker, shares: sharesBought, price }];
      }
    } else if (isAuto) {
      const strategyKey = String((fund as any).investmentStrategy || (fund as any).strategy || "growth").toLowerCase();
      const autoBasket = await this.getAutoInvestBasketFromConfig(strategyKey, fund.id);

      // Contribution-only rebalancing: instead of mechanically applying the strategy
      // weights to this single contribution, we bias the new dollars toward whichever
      // strategy tickers are currently UNDER target. This way the portfolio drifts back
      // to the target allocation over time WITHOUT triggering taxable sells in the UTMA.
      // Falls back to plain target weights when the basket is brand-new (no holdings yet)
      // or when nothing is under-weight.
      const allocations = await this.computeContributionAllocations(autoBasket, fund.id, investAmount);

      for (const allocation of allocations) {
        const portion = allocation.dollars;
        if (portion < 0.01) continue;
        const asset = { ticker: allocation.ticker, name: allocation.name, weight: allocation.weight };
        const quote = await getMarketQuote(asset.ticker);
        const price = quote?.price || 100;
        const sharesBought = portion / price;
        const existingHolding = await storage.getHoldingByFundAndTicker(fund.id, asset.ticker);
        if (existingHolding) {
          const nextShares = parseFloat(existingHolding.shares || '0') + sharesBought;
          const nextCostBasis = parseFloat(existingHolding.costBasis || '0') + portion;
          const nextCurrentValue = parseFloat(existingHolding.currentValue || '0') + portion;
          await storage.updateHolding(existingHolding.id, {
            shares: nextShares.toFixed(6),
            costBasis: nextCostBasis.toFixed(2),
            currentValue: nextCurrentValue.toFixed(2),
            gain: (nextCurrentValue - nextCostBasis).toFixed(2),
          });
        } else {
          await storage.createHolding({
            fundId: fund.id,
            ticker: asset.ticker,
            name: asset.name,
            shares: sharesBought.toFixed(6),
            costBasis: portion.toFixed(2),
            currentValue: portion.toFixed(2),
            gain: '0.00',
          });
        }
        // Record the slice this gift contributed to this managed-mix ticker.
        await storage.createGiftAllocation({
          giftId: gift.id,
          fundId: fund.id,
          ticker: asset.ticker,
          costBasis: portion.toFixed(2),
          shares: sharesBought.toFixed(6),
          source: "auto",
        });
        investedPositions.push({ ticker: asset.ticker, name: asset.name, shares: sharesBought, price });
      }
    }

    const currentPending = parseFloat(fund.pendingBalance || '0');
    const currentBalance = parseFloat(fund.balance || '0');
    const currentCash = parseFloat(String((fund as any).cashBalance || '0'));
    const nextPending = Math.max(0, currentPending - investAmount);

    // Cash branch — three sources land here:
    //   1. Explicit cash mode (parent chose "Hold as cash" in the one-time
    //      flow; reason = 'explicit_cash')
    //   2. Pick gift with a missing/invalid ticker (reason = 'pick_failed')
    //   3. Auto allocation that produced zero positions — empty strategy
    //      basket, disabled universe, custom mix with no rows
    //      (reason = 'empty_basket')
    // All three park the money in cashBalance instead of inflating `balance`
    // (which would desync from the holdings sum). Mark the gift `invested`
    // so it still counts toward volume/contributor totals; activity copy
    // distinguishes the explicit-choice case from the fallback cases so
    // the parent isn't told "we couldn't allocate" when they specifically
    // asked us not to.
    if (isCash || investedPositions.length === 0) {
      await storage.updateFund(fund.id, {
        pendingBalance: nextPending.toFixed(2),
        cashBalance: (currentCash + investAmount).toFixed(2),
      });
      await storage.updateGift(gift.id, {
        status: 'invested',
        investedAt: new Date(),
      });
      const reason = isCash ? 'explicit_cash' : (isPick ? 'pick_failed' : 'empty_basket');
      const title = isCash
        ? 'Held as cash'
        : 'Gift received. Held as cash';
      const description = isCash
        ? `$${investAmount.toFixed(2)} added to cash. Invest from the dashboard whenever you're ready.`
        : `$${investAmount.toFixed(2)} added to cash. Invest from the dashboard when ready.`;
      await storage.createActivity({
        userId: fund.userId,
        fundId: fund.id,
        type: 'gift_received_cash',
        title,
        description,
        amount: investAmount.toFixed(2),
        metadata: JSON.stringify({
          giftId: gift.id,
          reason,
          executionModel: (gift as any).executionModel || null,
          selectedTicker: (gift as any).selectedTicker || null,
        }),
      });
      recordEvent({
        name: "gift_completed",
        fundId: fund.id,
        source: "webhook",
        props: {
          amount: investAmount,
          executionModel: gift.executionModel || null,
          parked: "cash",
          reason,
          isParentContribution: !!(gift as any).parentContributionId,
        },
      });
      return;
    }

    const nextBalance = currentBalance + investAmount;

    await storage.updateFund(fund.id, {
      pendingBalance: nextPending.toFixed(2),
      balance: nextBalance.toFixed(2),
    });

    const isSinglePosition = investedPositions.length === 1;
    const singlePos = isSinglePosition ? investedPositions[0] : null;
    // For single-position auto investments, record shares/price so Memory Book can show them
    const finalShares = pickSharesAcquired ?? (singlePos ? singlePos.shares : null);
    const finalPrice = pickPriceAtPurchase ?? (singlePos ? singlePos.price : null);
    const finalTicker = (gift as any).selectedTicker ?? (singlePos ? singlePos.ticker : null);

    await storage.updateGift(gift.id, {
      status: 'invested',
      investedAt: new Date(),
      ...(finalShares !== null ? { sharesAcquired: finalShares.toFixed(6) } : {}),
      ...(finalPrice !== null ? { priceAtPurchase: finalPrice.toFixed(4) } : {}),
      ...(finalTicker && !(gift as any).selectedTicker ? { selectedTicker: finalTicker } : {}),
    });

    const positionLine = isSinglePosition
      ? `${investedPositions[0].name} (${investedPositions[0].ticker})`
      : investedPositions.map(p => p.ticker).join(' · ');
    await storage.createActivity({
      userId: fund.userId,
      fundId: fund.id,
      type: 'gift_invested',
      title: isSinglePosition
        ? `Invested in ${investedPositions[0].name}`
        // Locked copy: drop the "Auto-" prefix. The parent doesn't need
        // to know whether the strategy allocator or a single pick fired
        // — they just need to know the gift settled across N positions.
        : `Invested across ${investedPositions.length} positions`,
      description: `$${investAmount.toFixed(2)} into ${positionLine}`,
      amount: investAmount.toFixed(2),
      metadata: JSON.stringify({
        giftId: gift.id,
        tickers: investedPositions.map(p => p.ticker),
        ticker: isSinglePosition ? (investedPositions[0]?.ticker ?? null) : null,
        message: gift.message || null,
        eventId: gift.eventId || null,
        executionModel: (gift as any).executionModel || null,
        // Carry the schedule link onto the invest row too — both rows
        // (parent_contribution and gift_invested) need it so the modal's
        // schedule filter catches the full lifecycle.
        parentContributionId: (gift as any).parentContributionId || null,
      }),
    });

    recordEvent({
      name: "gift_completed",
      fundId: fund.id,
      source: "webhook",
      props: {
        amount: investAmount,
        executionModel: gift.executionModel || null,
        parked: "invested",
        positionCount: investedPositions.length,
        ticker: isSinglePosition ? (investedPositions[0]?.ticker ?? null) : null,
        isParentContribution: !!(gift as any).parentContributionId,
      },
    });
  }

  private static async ensureMemoryEntryForGift(giftId: string, fallbackVideoUrl?: string | null, fallbackAudioUrl?: string | null): Promise<void> {
    const gift = await storage.getGift(giftId);
    if (!gift) return;

    const [existingEntry] = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .where(eq(memoryEntries.giftId, gift.id));
    if (existingEntry) return;

    // Sanitize the message before persisting it as memory_entry content.
    // Three categories of input must NEVER reach Emma's eye at 18:
    //   1) Test-pattern messages from dev/QA ("test for recurring",
    //      "tstgin with recurring", "qqqqq…")
    //   2) Legacy auto-invest boilerplate ("Auto-invest contribution
    //      to {fund}") — system-generated, not a love letter
    //   3) Empty or whitespace-only messages
    const rawMessage = String(gift.message || "").trim();
    const isTestMessage = /^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(rawMessage);
    const isBoilerplate = /^auto-invest contribution to /i.test(rawMessage);
    const cleanMessage = (rawMessage && !isTestMessage && !isBoilerplate) ? rawMessage : null;

    // Read media from the gift row first (canonical post-migration 0010),
    // fall back to metadata for legacy gifts created before the columns
    // landed.
    const resolvedVideoUrl = (gift as any).videoUrl || fallbackVideoUrl || null;
    const resolvedAudioUrl = (gift as any).audioUrl || fallbackAudioUrl || null;
    const resolvedPhotoUrl = gift.photoUrl || null;

    // Memory Book inversion rule (project_memory_book_inversion): the
    // note IS the entry, the transaction is metadata. If there is no
    // human note AND no photo / video / voice attached, this gift does
    // NOT belong in the Memory Book — the gift still exists in the
    // gift list, but the Book is reserved for moments with real human
    // content. Skipping the write here prevents a Memory Book full of
    // "Someone who loves Emma sent a gift of $50.00" template entries
    // that read like a bank statement when Emma opens it at 18.
    //
    // Auto-invest from the parent's recurring schedule is the same: no
    // note + no media = no entry. The recurring "stamp once" rule (per
    // the same memory) is handled separately at the recurring-worker
    // first-cycle path, which writes ONE intentional parent note.
    const hasRealContent = Boolean(cleanMessage) || Boolean(resolvedPhotoUrl) || Boolean(resolvedVideoUrl) || Boolean(resolvedAudioUrl);
    if (!hasRealContent) {
      return;
    }

    // Per-fund moderation gate. OFF by default everywhere. When the parent
    // has flipped fund.gifterMemoryModeration on, gifter-submitted entries
    // land as 'pending_review' so they're hidden from Memory Book + KidView
    // until the parent approves. Parent-authored entries don't take this
    // path — they go through the parent memory routes and are always
    // 'published'. Best-effort: if the fund lookup fails, default to
    // 'published' so a transient DB hiccup never silently quarantines
    // grandma's voice note.
    let entryStatus: 'published' | 'pending_review' = 'published';
    try {
      const fund = await storage.getFund(gift.fundId);
      if (fund && (fund as any).gifterMemoryModeration === true) {
        entryStatus = 'pending_review';
      }
    } catch {
      // Default to published on lookup failure — the alternative is silent
      // quarantine, which is exactly the broken-promise scenario this
      // codebase is designed to avoid.
    }

    await storage.createMemoryEntry({
      fundId: gift.fundId,
      giftId: gift.id,
      type: 'gift_message',
      content: cleanMessage,
      authorName: gift.senderName,
      photoUrl: resolvedPhotoUrl,
      videoUrl: resolvedVideoUrl,
      audioUrl: resolvedAudioUrl,
      status: entryStatus,
    });
  }

  static async finalizeHeldGiftRelease(
    giftId: string,
    options?: { releasedByUserId?: string | null; releaseReason?: string | null },
  ): Promise<void> {
    const gift = await storage.getGift(giftId);
    if (!gift) return;
    const fund = await storage.getFund(gift.fundId);
    if (!fund) return;

    await this.completeGiftPostPayment(gift.id, {
      fundUserId: fund.userId,
    });

    await storage.createActivity({
      userId: options?.releasedByUserId || fund.userId,
      fundId: fund.id,
      type: "large_gift_hold_released",
      title: "Large gift released",
      description:
        options?.releaseReason === "upgraded_release"
          ? "A held large gift was released after coverage was upgraded."
          : "A held large gift was released using the current free-plan fee.",
      amount: gift.amount,
    });
  }

  static async ensureFundPendingCoversPendingGifts(fundId?: string | null): Promise<void> {
    if (!fundId) return;
    try {
      const [fund, fundGifts] = await Promise.all([
        storage.getFund(fundId),
        storage.getGiftsByFund(fundId),
      ]);
      if (!fund) return;

      const pendingFromGifts = fundGifts
        .filter((g) => g.status === 'pending' || g.status === 'processing')
        .reduce((sum, g) => sum + parseFloat(g.netAmount || g.amount || '0'), 0);

      const currentPending = parseFloat(fund.pendingBalance || '0');
      if (pendingFromGifts > currentPending + 0.0001) {
        await storage.updateFund(fundId, {
          pendingBalance: pendingFromGifts.toFixed(2),
        });
      }
      await this.reconcileFundFromGifts(fundId);
    } catch (err) {
      console.error('[Webhook] Failed pending-balance reconciliation for fund:', fundId, err);
    }
  }

  static async selfHealPendingGifts(fundId: string): Promise<void> {
    const fundGifts = await storage.getGiftsByFund(fundId);
    const stuck = fundGifts.filter((g) => {
      const s = String(g.status || '').toLowerCase();
      return s === 'pending' || s === 'processing';
    });
    for (const g of stuck) {
      try {
        await this.investGiftImmediatelyIfNeeded(g.id);
      } catch {}
    }
    if (stuck.length > 0) {
      try { await this.reconcileFundFromGifts(fundId); } catch {}
    }
  }

  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET must be set for webhook verification.');
    }

    const stripeSecretKey = await getStripeSecretKey();
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-11-17.clover' });
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    const inserted = await db.insert(webhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      status: 'processing',
      attempts: 1,
    }).onConflictDoNothing({ target: webhookEvents.stripeEventId }).returning();

    if (inserted.length === 0) {
      const [existing] = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.stripeEventId, event.id));
      if (existing?.status === 'processed') {
        console.log('[Webhook] Duplicate processed event ignored:', event.id);
        return;
      }
      await db.update(webhookEvents).set({
        status: 'processing',
        error: null,
        attempts: sql`${webhookEvents.attempts} + 1`,
      }).where(eq(webhookEvents.stripeEventId, event.id));
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as any);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as any);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as any);
          break;
        case 'customer.deleted':
          await this.handleCustomerDeleted(event.data.object as any);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as any);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as any);
          break;
        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as any);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as any);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as any);
          break;
        default:
          console.log('[Webhook] Ignored event type:', event.type);
      }

      await db.update(webhookEvents).set({
        status: 'processed',
        processedAt: new Date(),
        error: null,
      }).where(eq(webhookEvents.stripeEventId, event.id));
    } catch (err: any) {
      await db.update(webhookEvents).set({
        status: 'failed',
        error: err?.message?.slice(0, 1000) || 'unknown webhook error',
      }).where(eq(webhookEvents.stripeEventId, event.id));
      await captureError(err, {
        area: "webhook-handler",
        eventId: event.id,
        eventType: event.type,
      });
      await sendOpsAlert(
        {
          title: "Webhook event failed",
          severity: "critical",
          source: "webhook-handler",
          details: { eventId: event.id, eventType: event.type, message: err?.message || "unknown" },
        },
        `webhook-event-failed:${event.id}`,
      );
      throw err;
    }
  }

  static async handleCheckoutCompleted(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const type = metadata.type;

    const [existingTx] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.stripeCheckoutSessionId, session.id));
    if (existingTx) {
      console.log('[Webhook] Checkout session already processed:', session.id);
      if (type === 'gift') {
        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
        if (paymentIntentId) {
          const gift = await storage.getGiftByPaymentIntent(paymentIntentId);
          if (gift) {
            if (String(gift.status || "").toLowerCase() !== "host_hold") {
              await this.investGiftImmediatelyIfNeeded(gift.id);
              await this.reconcileFundFromGifts(gift.fundId);
            }
          }
        }
        await this.ensureFundPendingCoversPendingGifts(metadata.fundId || null);
      }
      return;
    }

    console.log('[Webhook] checkout.session.completed:', { type, sessionId: session.id });

    if (type === 'gift') {
      await this.handleGiftPayment(session);
    } else if (type === 'starter_plan') {
      await this.handleStarterPlanPurchase(session);
    } else if (type === 'family_plan') {
      await this.handleFamilyPlanPurchase(session);
    } else if (type === 'legacy_plan') {
      await this.handleLegacyPlanPurchase(session);
    } else if (type === 'event_pass') {
      await this.handleEventPassPurchase(session);
    } else if (type === 'gifter_recurring') {
      // Gifter recurring setup completed — insert the recurring_gifts row
      // so the worker (recurringContributionWorker.ts::processGifterRecurring)
      // picks it up for subsequent monthly charges. Per Decision E in
      // project_gifter_recurring_restoration.md. The actual money for the
      // FIRST charge will flow through invoice.payment_succeeded (which
      // fires immediately after subscription creation); this handler just
      // creates the schedule record.
      await this.handleGifterRecurringSetup(session);
    } else if (type === 'sponsor_plus') {
      // Gifter sponsored a year of Plus or Family for a fund (Prong B
      // of pricing-v3 conversion). One-time payment; insert the
      // sponsored_subscriptions row, activate 12 months of coverage,
      // send notification emails to parent + gifter. Per
      // project_gifter_sponsors_plus_subscription.md.
      await this.handleSponsorPlusPurchase(session);
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    let giftId: string | null = null;
    if (type === 'gift' && paymentIntentId) {
      const linkedGift = await storage.getGiftByPaymentIntent(paymentIntentId);
      giftId = linkedGift?.id || null;
    }

    await storage.createTransaction({
      userId: metadata.fundUserId || metadata.userId || null,
      type: type || 'unknown',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      giftId,
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
    const rawExecutionModel = String(metadata.executionModel || '').toLowerCase();
    const normalizedExecutionModel =
      rawExecutionModel.includes('pick')
        ? 'pick'
        : rawExecutionModel.includes('family')
          ? 'family'
          : 'auto';
    
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new Error('Gift checkout session missing payment_intent id');
    }

    const existingGift = await storage.getGiftByPaymentIntent(paymentIntentId);
    if (existingGift) {
      console.log('[Webhook] Gift already exists for payment intent:', paymentIntentId);
      if (String(existingGift.status || "").toLowerCase() !== "host_hold") {
        await this.investGiftImmediatelyIfNeeded(existingGift.id);
        // Parent contributions never get a Memory Book entry from the gift
        // itself — the parent's REAL note (set on a recurring schedule, or
        // explicitly attached to a one-time contribution) is the only entry
        // that should land in the Book. Boilerplate "Auto-invest contribution
        // to Emma's Fund" messages don't pollute Emma's view at 18.
        // Per `feedback_memory_book_inversion`: note IS the entry, transaction
        // is metadata. The same guard exists in completeGiftPostPayment
        // line 148; mirroring it here closes the early-return-for-existing-
        // gift path that was bypassing it.
        const isParentContrib = String(metadata?.isParentContribution || '').toLowerCase() === 'true';
        if (!isParentContrib) {
          await this.ensureMemoryEntryForGift(existingGift.id, this.normalizeVideoUrl(metadata.videoUrl), metadata?.audioUrl || null);
        }
        await this.ensureFundPendingCoversPendingGifts(existingGift.fundId);
      }
      return;
    }

    // Explicit anonymous flag from Stripe metadata. The boolean ride-
    // through is the truth source for downstream display and public
    // social-proof filtering. The senderName fallback below is for
    // the success-page render only — the gift IS anonymous if the
    // gifter checked the toggle, regardless of what name string lands.
    const isAnonymous = String(metadata.isAnonymous || '').toLowerCase() === 'true';

    // Anonymous gates ALL three media types — see
    // feedback_anonymous_as_explicit_flag.md. Belt + suspenders: the
    // gift-checkout endpoint already nulls these server-side when the
    // anonymous toggle is on, but mirroring the rule here means a stale
    // checkout session created before the toggle was added still can't
    // sneak media into the Memory Book.
    const giftPhotoUrl = isAnonymous ? null : (this.normalizeHttpUrl(metadata.photoUrl) || null);
    const giftVideoUrl = isAnonymous ? null : (this.normalizeVideoUrl(metadata.videoUrl) || null);
    const giftAudioUrl = isAnonymous ? null : (this.normalizeHttpUrl(metadata.audioUrl) || null);

    const giftData = {
      fundId: metadata.fundId,
      eventId: metadata.eventId || null,
      senderName: metadata.senderName || 'Anonymous',
      senderEmail: metadata.senderEmail || null,
      isAnonymous,
      amount: metadata.baseAmount || ((session.amount_total || 0) / 100).toString(),
      processingFee: metadata.processingFee || '0',
      koraFee: metadata.koraFee || '0',
      netAmount: metadata.netToFund || metadata.baseAmount || ((session.amount_total || 0) / 100).toString(),
      message: metadata.message || null,
      photoUrl: giftPhotoUrl,
      // Mirror video and audio onto the gift row alongside photo. Before this
      // landed, these URLs lived ONLY in Stripe metadata, which made the
      // Memory Book entry creation a single point of failure. With the
      // columns persisted, ensureMemoryEntryForGift can read from the gift
      // row directly and the metadata path becomes a fallback for legacy.
      videoUrl: giftVideoUrl,
      audioUrl: giftAudioUrl,
      executionModel: normalizedExecutionModel,
      selectedTicker: metadata.selectedTicker || null,
      status: this.shouldHoldGiftForHostDecision(metadata) ? 'host_hold' : 'pending',
      stripePaymentIntentId: paymentIntentId,
      // Persist the schedule link if the parent fired this through the
      // "Contribute now" button on a recurring card. Empty / missing =
      // a bare one-time contribution with no schedule context.
      parentContributionId: typeof metadata.parentContributionId === 'string' && metadata.parentContributionId
        ? metadata.parentContributionId
        : null,
      // Carry the client-source label from Stripe metadata into the
      // gifts.source column. Server set this from the checkout-endpoint
      // request body (web omits → 'web' default, mobile sends explicit
      // mobile_ios / mobile_android). Stripe metadata round-trips it
      // through the webhook. Historical rows pre-dating this column
      // are NULL (unknown). See OPS_RUNBOOK_MOBILE_FEE_DISPLAY_BUG.
      source: typeof metadata.source === 'string' && metadata.source
        ? metadata.source
        : null,
    };

    const gift = await storage.createGift(giftData);
    console.log('[Webhook] Gift created:', gift.id);
    if (giftData.status === "host_hold") {
      try {
        await storage.createActivity({
          userId: metadata.fundUserId || metadata.userId || null,
          fundId: metadata.fundId,
          type: "large_gift_hold_started",
          title: "Large gift waiting for your decision",
          description: "A large gift is holding for up to 24 hours so you can choose how to invest it with care.",
          amount: giftData.amount,
        });
      } catch (activityError) {
        console.error('[Webhook] Failed to create large gift hold activity:', gift.id, activityError);
      }
      return;
    }

    await this.completeGiftPostPayment(gift.id, metadata);
  }

  static async handleLegacyPlanPurchase(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const userId = metadata.userId;

    if (!userId) {
      console.error('[Webhook] Legacy plan purchase missing userId');
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
        plan: 'legacy',
        billingInterval: 'yearly',
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      await storage.createActivity({
        userId,
        type: 'subscription_started',
        // Legacy activation description aligned with the honest bullet
        // list 2026-05-12. Was previously: "advanced planning, and premium
        // family support" — both features that don't exist in code. Per
        // project_acorns_bundle_inflation_pattern.md, only the real
        // differential is 2 Occasion credits/yr beyond Family.
        title: 'Kiddo Legacy activated',
        description: 'Everything in Kiddo Family, plus 2 Occasion credits per year.',
      });

      try {
        const memberships = await storage.getFundMembershipsByUser(userId);
        const activeStarterMemberships = memberships.filter((m) => {
          if (m.plan !== "starter" || !m.stripeSubscriptionId) return false;
          const status = String(m.status || "").toLowerCase();
          if (status === "active") return true;
          if (status !== "canceled") return false;
          if (!m.currentPeriodEnd) return true;
          const end = new Date(m.currentPeriodEnd);
          return !Number.isNaN(end.getTime()) && end.getTime() > Date.now();
        });
        let canceledCount = 0;
        for (const membership of activeStarterMemberships) {
          try {
            const starterSub: any = await stripe.subscriptions.retrieve(String(membership.stripeSubscriptionId));
            const starterStatus = String(starterSub?.status || "").toLowerCase();
            if (starterStatus && starterStatus !== "canceled" && starterStatus !== "incomplete_expired") {
              if (!starterSub.cancel_at_period_end) {
                await stripe.subscriptions.update(String(membership.stripeSubscriptionId), {
                  cancel_at_period_end: true,
                });
              }
              await storage.updateFundMembership(membership.id, {
                status: "canceled",
                canceledAt: new Date(),
                currentPeriodEnd: starterSub.current_period_end
                  ? new Date(starterSub.current_period_end * 1000)
                  : membership.currentPeriodEnd || null,
              });
              canceledCount += 1;
            }
          } catch (starterErr) {
            console.error('[Webhook] Failed to schedule starter overlap cancellation after Legacy activation:', {
              userId,
              membershipId: membership.id,
              fundId: membership.fundId,
              error: starterErr,
            });
          }
        }
        if (canceledCount > 0) {
          await storage.createActivity({
            userId,
            type: 'subscription_canceled',
            title: 'Kiddo+ plans scheduled to cancel',
            description: `We scheduled ${canceledCount} Kiddo+ plan${canceledCount === 1 ? '' : 's'} to cancel at period end to avoid double billing while Legacy is active.`,
          });
        }
      } catch (overlapErr) {
        console.error('[Webhook] Failed overlap cleanup after Legacy activation:', overlapErr);
      }
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
      const recurringInterval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
      const billingInterval = recurringInterval === 'year' ? 'yearly' : 'monthly';
      
      await storage.upsertSubscription({
        userId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        plan: 'family',
        billingInterval,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      await storage.createActivity({
        userId,
        type: 'subscription_started',
        title: 'Kiddo Family activated',
        description: 'Your Kiddo Family subscription is now active',
      });

      try {
        const memberships = await storage.getFundMembershipsByUser(userId);
        const activeStarterMemberships = memberships.filter((m) => {
          if (m.plan !== "starter" || !m.stripeSubscriptionId) return false;
          const status = String(m.status || "").toLowerCase();
          if (status === "active") return true;
          if (status !== "canceled") return false;
          if (!m.currentPeriodEnd) return true;
          const end = new Date(m.currentPeriodEnd);
          return !Number.isNaN(end.getTime()) && end.getTime() > Date.now();
        });
        let canceledCount = 0;
        for (const membership of activeStarterMemberships) {
          try {
            const starterSub: any = await stripe.subscriptions.retrieve(String(membership.stripeSubscriptionId));
            const starterStatus = String(starterSub?.status || "").toLowerCase();
            if (starterStatus && starterStatus !== "canceled" && starterStatus !== "incomplete_expired") {
              if (!starterSub.cancel_at_period_end) {
                await stripe.subscriptions.update(String(membership.stripeSubscriptionId), {
                  cancel_at_period_end: true,
                });
              }
              await storage.updateFundMembership(membership.id, {
                status: "canceled",
                canceledAt: new Date(),
                currentPeriodEnd: starterSub.current_period_end
                  ? new Date(starterSub.current_period_end * 1000)
                  : membership.currentPeriodEnd || null,
              });
              canceledCount += 1;
            }
          } catch (starterErr) {
            console.error('[Webhook] Failed to schedule starter overlap cancellation:', {
              userId,
              membershipId: membership.id,
              fundId: membership.fundId,
              error: starterErr,
            });
          }
        }
        if (canceledCount > 0) {
          await storage.createActivity({
            userId,
            type: 'subscription_canceled',
            title: 'Kiddo+ plans scheduled to cancel',
            description: `We scheduled ${canceledCount} Kiddo+ plan${canceledCount === 1 ? '' : 's'} to cancel at period end to avoid double billing while Family is active.`,
          });
        }
      } catch (overlapErr) {
        console.error('[Webhook] Failed overlap cleanup after Family activation:', overlapErr);
      }
    }
  }

  static async handleStarterPlanPurchase(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const userId = metadata.userId;
    const fundId = metadata.fundId;

    if (!userId || !fundId) {
      console.error('[Webhook] Kiddo+ purchase missing userId or fundId');
      return;
    }

    const fund = await storage.getFund(fundId);
    if (!fund || fund.userId !== userId) {
      console.error('[Webhook] Kiddo+ purchase fund does not belong to user', { userId, fundId });
      return;
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    if (subscriptionId) {
      const stripe = await getUncachableStripeClient();
      const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
      const recurringInterval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
      const billingInterval = recurringInterval === 'year' ? 'yearly' : 'monthly';

      await storage.upsertFundMembership({
        userId,
        fundId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        plan: 'starter',
        billingInterval,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      await storage.createActivity({
        userId,
        fundId,
        type: 'subscription_started',
        title: 'Kiddo+ activated',
        description: `Kiddo+ is now active for ${fund.name}.`,
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
      hasEventPass: true, // Legacy DB column retained for premium event coverage compatibility
      eventPassPurchasedAt: new Date(),
    });

    if (userId) {
      await storage.createActivity({
        userId,
        type: 'event_pass_purchased',
        title: `${String(metadata.occasionTier || 'premium').replace(/^\w/, (c) => c.toUpperCase())} Kiddo Occasion activated`,
        description: 'This occasion now has a polished gift page and premium Memory Book moment.',
      });
    }
  }

  static async handleSubscriptionUpdated(subscription: any): Promise<void> {
    console.log('[Webhook] subscription.updated:', subscription.id, subscription.status, 'cancel_at_period_end:', subscription.cancel_at_period_end);

    // When cancel_at_period_end is true, Stripe still reports status:"active".
    // We map this to "canceled" in our DB so the UI correctly shows "scheduled to cancel".
    const effectiveStatus = subscription.cancel_at_period_end ? 'canceled' : subscription.status;
    const recurringInterval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
    const billingInterval: 'monthly' | 'yearly' | undefined = recurringInterval === 'year' ? 'yearly' : recurringInterval === 'month' ? 'monthly' : undefined;

    const existingSub = await storage.getSubscriptionByStripeId(subscription.id);
    if (existingSub) {
      const wasCanceled = existingSub.status === 'canceled';
      const isNowActive = effectiveStatus === 'active';
      await storage.updateSubscription(existingSub.id, {
        status: effectiveStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : (subscription.cancel_at_period_end && !existingSub.canceledAt ? new Date() : existingSub.canceledAt),
        ...(billingInterval ? { billingInterval } : {}),
      });
      // Subscription came back to life — un-pause schedules that we paused due to subscription_ended.
      // Manually-paused rows stay paused (their pause_reason isn't 'subscription_ended').
      if (wasCanceled && isNowActive) {
        try {
          const { parentContributionsResumed, recurringGiftsResumed } = await storage.resumeScheduledItemsForUserAfterSubscriptionRestart(existingSub.userId);
          if (parentContributionsResumed > 0 || recurringGiftsResumed > 0) {
            console.log(`[Webhook] cascade-resumed ${parentContributionsResumed} parent contributions and ${recurringGiftsResumed} recurring gifts for user ${existingSub.userId}`);
          }
        } catch (resumeErr) {
          console.error('[Webhook] subscription cascade-resume failed:', resumeErr);
        }
      }
      return;
    }

    const existingFundMembership = await storage.getFundMembershipByStripeId(subscription.id);
    if (existingFundMembership) {
      const wasCanceled = existingFundMembership.status === 'canceled';
      const isNowActive = effectiveStatus === 'active';
      await storage.updateFundMembership(existingFundMembership.id, {
        status: effectiveStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : (subscription.cancel_at_period_end && !existingFundMembership.canceledAt ? new Date() : existingFundMembership.canceledAt),
        ...(billingInterval ? { billingInterval } : {}),
      });
      if (wasCanceled && isNowActive) {
        try {
          const { parentContributionsResumed, recurringGiftsResumed } = await storage.resumeScheduledItemsForUserAfterSubscriptionRestart(existingFundMembership.userId);
          if (parentContributionsResumed > 0 || recurringGiftsResumed > 0) {
            console.log(`[Webhook] cascade-resumed ${parentContributionsResumed} parent contributions and ${recurringGiftsResumed} recurring gifts for user ${existingFundMembership.userId}`);
          }
        } catch (resumeErr) {
          console.error('[Webhook] fundMembership cascade-resume failed:', resumeErr);
        }
      }
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

      // Cascade: actually pause every active recurring schedule (parent contributions
      // and gifter recurring gifts) tied to this user's funds. The cancel-modal copy
      // promised this; now we deliver it.
      try {
        const { parentContributionsPaused, recurringGiftsPaused } = await storage.pauseScheduledItemsForUserOnSubscriptionEnd(existingSub.userId);
        if (parentContributionsPaused > 0 || recurringGiftsPaused > 0) {
          console.log(`[Webhook] cascade-paused ${parentContributionsPaused} parent contributions and ${recurringGiftsPaused} recurring gifts for user ${existingSub.userId}`);
        }
      } catch (cascadeErr) {
        console.error('[Webhook] subscription.deleted cascade-pause failed:', cascadeErr);
      }

      await storage.createActivity({
        userId: existingSub.userId,
        type: 'subscription_canceled',
        title: existingSub.plan === 'legacy' ? 'Kiddo Legacy canceled' : 'Kiddo Family canceled',
        description: existingSub.plan === 'legacy' ? 'Your Kiddo Legacy subscription has been canceled' : 'Your Kiddo Family subscription has been canceled',
      });
      return;
    }

    const existingFundMembership = await storage.getFundMembershipByStripeId(subscription.id);
    if (existingFundMembership) {
      await storage.updateFundMembership(existingFundMembership.id, {
        status: 'canceled',
        canceledAt: new Date(),
      });

      // Per-fund Kiddo+ end: cascade pause for that user's funds. Same helper
      // since recurring items live at the fund level.
      try {
        const { parentContributionsPaused, recurringGiftsPaused } = await storage.pauseScheduledItemsForUserOnSubscriptionEnd(existingFundMembership.userId);
        if (parentContributionsPaused > 0 || recurringGiftsPaused > 0) {
          console.log(`[Webhook] cascade-paused ${parentContributionsPaused} parent contributions and ${recurringGiftsPaused} recurring gifts for user ${existingFundMembership.userId}`);
        }
      } catch (cascadeErr) {
        console.error('[Webhook] fundMembership.deleted cascade-pause failed:', cascadeErr);
      }

      await storage.createActivity({
        userId: existingFundMembership.userId,
        fundId: existingFundMembership.fundId,
        type: 'subscription_canceled',
        title: 'Kiddo+ canceled',
        description: 'Kiddo+ for this fund has been canceled.',
      });
    }
  }

  static async handleCustomerDeleted(customer: any): Promise<void> {
    const customerId = typeof customer?.id === 'string' ? customer.id : null;
    if (!customerId) return;
    console.log('[Webhook] customer.deleted:', customerId);

    const linkedSubscriptions = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId));

    const linkedFundMemberships = await db
      .select({
        id: fundMemberships.id,
        userId: fundMemberships.userId,
        fundId: fundMemberships.fundId,
        stripeSubscriptionId: fundMemberships.stripeSubscriptionId,
      })
      .from(fundMemberships)
      .where(eq(fundMemberships.stripeCustomerId, customerId));

    for (const linked of linkedSubscriptions) {
      await storage.updateSubscription(linked.id, {
        status: 'canceled',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        canceledAt: new Date(),
      });

      if (linked.userId) {
        await storage.createActivity({
          userId: linked.userId,
          type: 'subscription_canceled',
          title: 'Billing customer removed',
          description: 'Stripe customer record was deleted and subscription link was cleared.',
        });
      }
    }

    for (const linked of linkedFundMemberships) {
      await storage.updateFundMembership(linked.id, {
        status: 'canceled',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        canceledAt: new Date(),
      });

      if (linked.userId) {
        await storage.createActivity({
          userId: linked.userId,
          fundId: linked.fundId,
          type: 'subscription_canceled',
          title: 'Billing customer removed',
          description: 'Stripe customer record was deleted and starter subscription link was cleared.',
        });
      }
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

      const refundAmount = ((charge.amount_refunded || 0) / 100);
      await storage.createTransaction({
        type: 'refund',
        stripePaymentIntentId: paymentIntentId,
        amount: refundAmount.toString(),
        currency: charge.currency,
        status: 'completed',
        description: 'Refund processed',
        completedAt: new Date(),
      });

      // Surface the refund as a first-class History row so the parent can
      // see it (and reconcile against the bank statement). Previously
      // refunds existed only in the transactions table — invisible to the
      // user even though `refund` is a defined activity type with red
      // styling. Without an activity row the parent would see the gift
      // disappear from the fund without explanation. Best-effort; never
      // fail the webhook over an activity write.
      if (gift) {
        try {
          const fund = await storage.getFund(gift.fundId);
          const refundedRefund = Array.isArray(charge.refunds?.data) ? charge.refunds.data[0] : null;
          const senderLabel = gift.senderName || 'a gifter';
          await storage.createActivity({
            userId: fund?.userId || null,
            fundId: gift.fundId,
            type: 'refund',
            title: 'Gift refunded',
            description: `$${refundAmount.toFixed(2)} from ${senderLabel} was returned to the original payment method.`,
            amount: refundAmount.toFixed(2),
            metadata: JSON.stringify({
              giftId: gift.id,
              senderName: gift.senderName || null,
              senderEmail: gift.senderEmail || null,
              ticker: (gift as any).selectedTicker || null,
              refundedAt: new Date().toISOString(),
              stripeChargeId: charge.id,
              stripeRefundId: refundedRefund?.id || null,
              stripeReceiptUrl: charge.receipt_url || null,
              descriptor: charge.statement_descriptor || charge.calculated_statement_descriptor || null,
            }),
          } as any);
        } catch (activityErr) {
          console.error('[Webhook] Failed to record refund activity:', gift.id, activityErr);
        }
      }

      // Sponsor-Plus refund handling (Prong B of pricing-v3 conversion,
      // refund-handler shipped 2026-05-23 as part of MVP polish pass).
      // If the refunded payment_intent matches a sponsored_subscriptions
      // row, flip status to 'refunded' so the coverage helper stops
      // returning it as active. Write an activity row + email the
      // parent that coverage was rolled back. Per
      // project_gifter_sponsors_plus_subscription.md.
      try {
        const { db } = await import("./db");
        const { sponsoredSubscriptions } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const [sponsored] = await db
          .select()
          .from(sponsoredSubscriptions)
          .where(eq(sponsoredSubscriptions.stripePaymentIntentId, paymentIntentId))
          .limit(1);
        if (sponsored && sponsored.status === 'active') {
          await db
            .update(sponsoredSubscriptions)
            .set({ status: 'refunded' })
            .where(eq(sponsoredSubscriptions.id, sponsored.id));
          console.log(`[Webhook] sponsor_plus refunded: sub=${sponsored.id} fund=${sponsored.fundId}`);

          // Best-effort: write parent activity + email so they know
          // the coverage was rolled back. Doesn't block the webhook.
          try {
            const fund = await storage.getFund(sponsored.fundId);
            if (fund?.userId) {
              const childName = String(fund.recipientFirstName || fund.name || 'the kid').trim();
              const tierLabel = sponsored.tier === 'family' ? 'Family' : 'Plus';
              const sponsorDisplay = sponsored.sponsorName || sponsored.sponsorEmail;
              await storage.createActivity({
                userId: fund.userId,
                fundId: sponsored.fundId,
                type: 'sponsor_plus_refunded',
                title: `Sponsored ${tierLabel} on ${childName}'s fund was refunded`,
                description: `${sponsorDisplay}'s sponsorship was refunded. ${tierLabel} coverage on ${childName}'s fund has ended. You can take over the bill directly any time.`,
                metadata: JSON.stringify({ sponsoredSubId: sponsored.id, sponsorEmail: sponsored.sponsorEmail }),
              });
            }
          } catch (activityErr: any) {
            console.warn('[Webhook] sponsor_plus refund activity failed (non-fatal):', activityErr?.message || activityErr);
          }
        }
      } catch (sponsoredErr: any) {
        console.warn('[Webhook] sponsor_plus refund lookup failed (non-fatal):', sponsoredErr?.message || sponsoredErr);
      }
    }
  }

  // Gifter recurring setup handler. Fires on checkout.session.completed
  // when the gifter completes the subscription checkout. Inserts the
  // recurring_gifts row that the worker (processGifterRecurring)
  // reads on each cycle. The FIRST charge has already happened (or
  // is about to) via Stripe's subscription billing; that's handled by
  // handleInvoicePaid below — this method only creates the SCHEDULE
  // record.
  //
  // Locked 2026-05-21 per project_gifter_recurring_restoration.md
  // Decision E. Idempotent: if a recurring_gifts row already exists
  // for this Stripe subscription ID, skip.
  static async handleGifterRecurringSetup(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const fundId = String(metadata.fundId || "");
    const stripeSubscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
    if (!fundId || !stripeSubscriptionId) {
      console.warn("[Webhook] gifter_recurring missing fundId or subscriptionId:", session.id);
      return;
    }

    // Idempotency: already inserted?
    const [existing] = await db
      .select({ id: recurringGifts.id })
      .from(recurringGifts)
      .where(eq(recurringGifts.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    if (existing) {
      console.log("[Webhook] gifter_recurring already linked:", stripeSubscriptionId);
      return;
    }

    const amountUsd = parseFloat(String(metadata.amountUsd || "0"));
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      console.warn("[Webhook] gifter_recurring invalid amountUsd:", metadata.amountUsd);
      return;
    }

    const frequency = String(metadata.frequency || "monthly");
    const senderName = String(metadata.senderName || "Anonymous").slice(0, 200);
    const senderEmail = String(metadata.senderEmail || "").slice(0, 200);

    await db.insert(recurringGifts).values({
      fundId,
      senderName,
      senderEmail: senderEmail || null,
      amount: amountUsd.toFixed(2),
      frequency,
      paymentSetupStatus: "active",
      stripeSubscriptionId,
      status: "active",
      nextChargeDate: (() => {
        const d = new Date();
        if (frequency === "weekly") d.setDate(d.getDate() + 7);
        else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return d;
      })(),
    } as any);

    console.log(`[Webhook] gifter_recurring row created: fund=${fundId} amount=$${amountUsd} ${frequency}`);
  }

  // Sponsor-Plus purchase handler — fires on checkout.session.completed
  // when metadata.type === 'sponsor_plus'. Inserts the
  // sponsored_subscriptions row, activates 12 months of plan coverage
  // on the fund, sends notification emails to parent + gifter.
  // Idempotency: the table has UNIQUE(stripe_session_id) so a webhook
  // double-fire is a no-op at the SQL level. Per
  // project_gifter_sponsors_plus_subscription.md.
  static async handleSponsorPlusPurchase(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const fundId = String(metadata.fundId || '');
    const tierRaw = String(metadata.tier || 'starter').toLowerCase();
    const tier = tierRaw === 'family' ? 'family' : 'starter';
    const sponsorEmail = String(metadata.sponsorEmail || '').trim().toLowerCase();
    const sponsorName = String(metadata.sponsorName || '').trim();
    if (!fundId || !sponsorEmail) {
      console.warn('[Webhook] sponsor_plus session missing fundId or sponsorEmail; skipping');
      return;
    }

    const fund = await storage.getFund(fundId);
    if (!fund) {
      console.warn(`[Webhook] sponsor_plus session references missing fund ${fundId}; skipping`);
      return;
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

    // 12-month activation window. The expires_at math is "today + 365
    // days" rather than "today + 1 calendar year" — slightly simpler,
    // matches the parent's intuition of "a year of Plus" within a few
    // days. Leap-year edge case handled by the +365 approach.
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + 365 * 24 * 60 * 60 * 1000);

    try {
      const { db } = await import("./db");
      const { sponsoredSubscriptions } = await import("@shared/schema");
      await db.insert(sponsoredSubscriptions).values({
        fundId,
        sponsorEmail,
        sponsorName: sponsorName || null,
        tier,
        activatedAt,
        expiresAt,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        status: 'active',
      } as any).onConflictDoNothing();
    } catch (insertErr: any) {
      // ON CONFLICT DO NOTHING handles the webhook double-fire case
      // via the unique stripe_session_id. The unique partial index
      // on (fund_id) WHERE status='active' may also reject — that's
      // the race-condition guard for two simultaneous purchases.
      // Both cases: log and continue (the original row is authoritative).
      console.warn('[Webhook] sponsor_plus insert conflict (likely double-fire or race):', insertErr?.message || insertErr);
    }

    // Write activity row on the parent's dashboard. The parent sees
    // this in their feed as "{Grandma} sponsored Plus on Emma's fund
    // until {date}." Relationship signal, framed warmly.
    const childName = String(fund.recipientFirstName || fund.name || 'your kid').trim();
    const sponsorDisplay = sponsorName ? sponsorName.split(/\s+/)[0] : 'Someone';
    const tierLabel = tier === 'family' ? 'Family' : 'Plus';
    const expiresLabel = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    try {
      await storage.createActivity({
        userId: fund.userId,
        fundId,
        type: 'sponsor_plus_activated',
        title: `${sponsorDisplay} sponsored ${tierLabel} for ${childName}'s fund`,
        description: `${tierLabel} is active on ${childName}'s fund through ${expiresLabel}. Sponsored by ${sponsorName || sponsorEmail}.`,
      });
    } catch (activityErr: any) {
      console.warn('[Webhook] sponsor_plus activity insert failed (non-fatal):', activityErr?.message || activityErr);
    }

    // Parent notification email. Warm relationship framing, NOT
    // transactional. The parent's Plan tab will show "Plus from
    // {sponsorName}" as the source attribution.
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [parent] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, fund.userId))
        .limit(1);
      if (parent?.email) {
        const { renderKiddoEmail } = await import("./templates/baseTemplate");
        const { sendEmail } = await import("./emailDelivery");
        const baseUrl = (() => {
          const configured =
            process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL;
          return configured ? configured.replace(/\/+$/, '') : 'https://kiddofund.com';
        })();
        const dashboardUrl = `${baseUrl}/dashboard?fundId=${encodeURIComponent(fundId)}`;
        const parentFirst = parent.firstName ? String(parent.firstName).trim() : '';
        const subject = `${sponsorDisplay} sponsored Kiddo ${tierLabel} for ${childName}`;
        const intro = [
          parentFirst ? `Hi ${parentFirst},` : `Hi,`,
          '',
          `${sponsorName || sponsorEmail} just sponsored a year of Kiddo ${tierLabel} for ${childName}'s fund. It's active through ${expiresLabel}.`,
          '',
          `That unlocks recurring contributions on ${childName}'s fund (for you and for any gifter), custom fund mix, photo and voice memos in the Memory Book, and the rest of ${tierLabel} on this fund. We won't charge you for any of it — ${sponsorName ? sponsorName.split(/\s+/)[0] : 'the gifter'} covered the cost.`,
          '',
          `If you want to keep ${tierLabel} going past ${expiresLabel}, we'll send a gentle reminder ahead of the renewal so you can take over with direct billing. No surprises.`,
        ].join('\n');
        const { html } = renderKiddoEmail({
          heading: subject,
          intro,
          cta: { text: `Open ${childName}'s fund`, url: dashboardUrl },
        });
        await sendEmail({
          to: parent.email,
          subject,
          text: intro,
          html,
          tags: ['sponsor_plus_activated'],
          metadata: { fundId, sponsorEmail, tier },
        }).catch((emailErr: any) => {
          console.warn('[Webhook] sponsor_plus parent email failed (non-fatal):', emailErr?.message || emailErr);
        });
      }
    } catch (parentLookupErr: any) {
      console.warn('[Webhook] sponsor_plus parent lookup failed (non-fatal):', parentLookupErr?.message || parentLookupErr);
    }

    // Gifter confirmation email. Simple receipt + emotional reinforcement
    // ("you just gave Emma a year of Plus"). No upsell, no follow-on
    // marketing — the gifter paid for a gift and is done.
    try {
      const { renderKiddoEmail } = await import("./templates/baseTemplate");
      const { sendEmail } = await import("./emailDelivery");
      const subject = `Your gift of Kiddo ${tierLabel} for ${childName} is active`;
      const intro = [
        sponsorName ? `Hi ${sponsorName.split(/\s+/)[0]},` : `Hi,`,
        '',
        `Thank you for sponsoring a year of Kiddo ${tierLabel} for ${childName}'s fund. It's active right now and runs through ${expiresLabel}.`,
        '',
        `${childName}'s parents just got an email letting them know it was you. They'll be able to set up recurring contributions, add photos and voice memos to the Memory Book, and use the rest of ${tierLabel} for the whole year on you.`,
        '',
        `Keep this email for your records. There's nothing more for you to do — your card won't be charged again. If ${childName}'s parents want to keep Plus going next year, that's on their own subscription.`,
      ].join('\n');
      const { html } = renderKiddoEmail({
        heading: subject,
        intro,
      });
      await sendEmail({
        to: sponsorEmail,
        subject,
        text: intro,
        html,
        tags: ['sponsor_plus_confirmation'],
        metadata: { fundId, tier, sessionId: session.id },
      }).catch((emailErr: any) => {
        console.warn('[Webhook] sponsor_plus gifter email failed (non-fatal):', emailErr?.message || emailErr);
      });
    } catch (gifterEmailErr: any) {
      console.warn('[Webhook] sponsor_plus gifter email setup failed (non-fatal):', gifterEmailErr?.message || gifterEmailErr);
    }

    console.log(`[Webhook] sponsor_plus activated: fund=${fundId} tier=${tier} sponsor=${sponsorEmail} expires=${expiresAt.toISOString()}`);
  }

  // Per-cycle gifter recurring charge handler. Fires on invoice.paid
  // for subscriptions where metadata.type === 'gifter_recurring'.
  // Creates a gift row (so the money lands in the fund the same way
  // one-time gifts do), bumps the recurring_gifts.nextChargeDate,
  // and sends a branded post-charge email to the gifter per locked
  // Decision C. Stripe's default subscription receipt is suppressed
  // for these subscriptions (set at session creation time).
  //
  // Returns true if this WAS a gifter_recurring invoice (caller should
  // skip the parent-subscription renewal logic below).
  static async handleGifterRecurringCharge(invoice: any, subscription: any): Promise<boolean> {
    const subMetadata = subscription?.metadata || {};
    if (String(subMetadata.type || "") !== "gifter_recurring") return false;

    const fundId = String(subMetadata.fundId || "");
    if (!fundId) {
      console.warn("[Webhook] gifter_recurring invoice missing fundId in sub metadata:", invoice.id);
      return true; // claimed but malformed; don't fall through to renewal logic
    }

    const stripeSubscriptionId = typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;
    const amountUsd = (invoice.amount_paid || 0) / 100;
    if (amountUsd <= 0) {
      console.warn("[Webhook] gifter_recurring invoice has zero amount_paid:", invoice.id);
      return true;
    }

    const fund = await storage.getFund(fundId);
    if (!fund) {
      console.warn("[Webhook] gifter_recurring fund not found:", fundId);
      return true;
    }

    // Fund-state cascade per Decision E. If the fund is closed, cancel
    // the subscription so no more charges fire AND notify the gifter.
    // Don't process this charge into the (now-closed) fund. NOTE:
    // Stripe already accepted the payment for this cycle; we'd need
    // to refund, but that's a separate operational concern. For now,
    // log and skip the gift insert. The cancel-on-next-tick prevents
    // future charges.
    if (String(fund.status || "").toLowerCase() === "closed") {
      try {
        const stripe = await getUncachableStripeClient();
        if (stripeSubscriptionId) {
          await stripe.subscriptions.cancel(stripeSubscriptionId);
        }
      } catch (cancelErr) {
        console.warn("[Webhook] failed to cancel gifter recurring on closed fund:", cancelErr);
      }
      console.warn(`[Webhook] gifter_recurring charge to CLOSED fund ${fundId}; sub canceled, charge not processed`);
      return true;
    }

    // Insert a gift row so the money flows into holdings the same way
    // one-time gifts do. completeGiftPostPayment handles the holdings
    // update + Memory Book entry + activity row. The recurring_gift_id
    // foreign key tags this gift as part of a recurring cycle so the
    // Memory Book renderer can compress visual weight per Decision D.
    const senderName = String(subMetadata.senderName || "Anonymous").slice(0, 200);
    const senderEmail = String(subMetadata.senderEmail || "").slice(0, 200);
    const message = String(subMetadata.message || "").slice(0, 490);
    const executionModel = String(subMetadata.executionModel || "auto");
    const selectedTicker = String(subMetadata.selectedTicker || "");
    const isAnonymousFlag = String(subMetadata.isAnonymous || "0") === "1";

    // Look up the recurring_gifts row by stripe_subscription_id so we can
    // stamp the gift's recurring_gift_id foreign key. Best-effort: if the
    // lookup fails the gift still gets created without the tag, just
    // renders at full Memory Book weight instead of compressed.
    let recurringGiftId: string | null = null;
    try {
      const rgRows = await db.execute(sql`
        SELECT id FROM recurring_gifts
        WHERE stripe_subscription_id = ${stripeSubscriptionId}
        LIMIT 1
      `);
      const rgRow = (rgRows.rows as any[])?.[0];
      if (rgRow?.id) recurringGiftId = String(rgRow.id);
    } catch (rgErr) {
      console.warn("[Webhook] recurring_gift_id lookup failed:", rgErr);
    }

    const [insertedGift] = await db.execute(sql`
      INSERT INTO gifts (
        fund_id, sender_name, sender_email, amount, net_amount, status,
        message, selected_ticker, execution_model, is_anonymous,
        stripe_payment_intent_id, recurring_gift_id, created_at
      ) VALUES (
        ${fundId}, ${senderName}, ${senderEmail || null}, ${amountUsd.toFixed(2)},
        ${amountUsd.toFixed(2)}, 'processing', ${message || null},
        ${selectedTicker || null}, ${executionModel}, ${isAnonymousFlag},
        ${invoice.payment_intent || null}, ${recurringGiftId},
        NOW()
      )
      RETURNING id
    `).then((r: any) => r.rows || []);
    const newGiftId = String(insertedGift?.id || "");

    if (newGiftId) {
      try {
        await this.completeGiftPostPayment(newGiftId, { fundUserId: fund.userId });
      } catch (completeErr) {
        console.error("[Webhook] gifter_recurring completeGiftPostPayment failed:", completeErr);
      }
    }

    // Bump recurring_gifts.nextChargeDate based on the subscription's
    // current_period_end (Stripe is the source of truth for cadence).
    try {
      const nextChargeMs = subscription?.current_period_end
        ? subscription.current_period_end * 1000
        : null;
      if (stripeSubscriptionId && nextChargeMs) {
        await db
          .update(recurringGifts)
          .set({ nextChargeDate: new Date(nextChargeMs), status: "active", pauseReason: null, pausedAt: null })
          .where(eq(recurringGifts.stripeSubscriptionId, stripeSubscriptionId));
      }
    } catch (updateErr) {
      console.warn("[Webhook] failed to update recurring_gifts.nextChargeDate:", updateErr);
    }

    // Branded post-charge email per Decision C. Best-effort: never
    // fail the webhook because of an email send.
    try {
      if (senderEmail) {
        const { sendEmail } = await import("./emailDelivery");
        const { renderKiddoEmail } = await import("./templates/baseTemplate");
        const childName = fund.recipientFirstName || fund.name || "the fund";
        const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const subject = `$${amountUsd.toFixed(0)} added to ${childName}'s fund — ${monthLabel}`;
        const body = [
          `Your $${amountUsd.toFixed(2)} recurring landed in ${childName}'s fund.`,
          "",
          `Manage or cancel any time from your gifter dashboard.`,
        ].join("\n");
        const { html } = renderKiddoEmail({ heading: subject, intro: body });
        await sendEmail({
          to: senderEmail,
          subject,
          text: body + "\n\nThe Kiddo team",
          html,
        } as any);
      }
    } catch (emailErr) {
      console.warn("[Webhook] gifter_recurring post-charge email failed:", emailErr);
    }

    return true;
  }

  static async handleInvoicePaid(invoice: any): Promise<void> {
    console.log('[Webhook] invoice.paid:', invoice.id);

    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

    if (!subscriptionId) return;

    // Check if this is a gifter_recurring subscription FIRST. If so,
    // hand off to the dedicated handler and skip the renewal logic
    // below (which assumes parent-subscription semantics).
    try {
      const stripe = await getUncachableStripeClient();
      const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
      const isGifterRecurring = await this.handleGifterRecurringCharge(invoice, subscription);
      if (isGifterRecurring) return;
    } catch (gifterCheckErr) {
      console.warn("[Webhook] gifter_recurring detection failed:", gifterCheckErr);
    }

    // Determine billing period from the invoice if available
    const periodEnd = invoice.lines?.data?.[0]?.period?.end
      ? new Date(invoice.lines.data[0].period.end * 1000)
      : null;
    const periodStart = invoice.lines?.data?.[0]?.period?.start
      ? new Date(invoice.lines.data[0].period.start * 1000)
      : null;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const amountNum = ((invoice.amount_paid || 0) / 100);
    const amount = amountNum.toString();

    // Pull card brand + last4 (and a hosted receipt link) from the underlying
    // charge so the History row can show "Visa ····4242" — the bank-line
    // reconciliation detail that lets a parent match the Kiddo charge to
    // their statement. One extra Stripe round-trip per renewal is cheap
    // and only fires on real billing events. All best-effort: never fail
    // the webhook because of a card-detail lookup.
    const reconcile: { brand: string | null; last4: string | null; receiptUrl: string | null; descriptor: string | null } = {
      brand: null, last4: null, receiptUrl: null, descriptor: null,
    };
    try {
      const chargeId = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge?.id;
      if (chargeId) {
        const stripe = await getUncachableStripeClient();
        const charge: any = await stripe.charges.retrieve(chargeId);
        reconcile.brand = charge?.payment_method_details?.card?.brand || null;
        reconcile.last4 = charge?.payment_method_details?.card?.last4 || null;
        reconcile.receiptUrl = charge?.receipt_url || null;
        reconcile.descriptor = charge?.statement_descriptor || charge?.calculated_statement_descriptor || null;
      }
    } catch (chargeErr) {
      console.warn('[Webhook] invoice.paid: failed to fetch charge for reconcile metadata:', chargeErr);
    }
    // Fall back to the hosted invoice URL if we couldn't pull the receipt.
    const receiptOrInvoiceUrl = reconcile.receiptUrl || invoice.hosted_invoice_url || null;

    const existingSub = await storage.getSubscriptionByStripeId(subscriptionId);
    if (existingSub) {
      const updates: any = {};
      if (periodEnd) updates.currentPeriodEnd = periodEnd;
      if (periodStart) updates.currentPeriodStart = periodStart;
      // Renewal reactivates a canceled-at-period-end sub if Stripe kept it going
      if (existingSub.status === 'canceled' && periodEnd && periodEnd > new Date()) {
        updates.status = 'active';
        updates.canceledAt = null;
      }
      if (Object.keys(updates).length > 0) await storage.updateSubscription(existingSub.id, updates);
      await storage.createTransaction({
        userId: existingSub.userId,
        type: 'subscription_renewal',
        stripeSubscriptionId: subscriptionId,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: customerId,
        amount,
        currency: invoice.currency || 'usd',
        status: 'completed',
        description: 'Kiddo Family renewal',
        completedAt: new Date(),
      });
      // Mirror the renewal as a History activity row (Gap 1: subscription
      // billing was previously invisible in Activity — only landed in the
      // transactions table). Includes payment-method last4 + receipt URL
      // so the row earns its place in the parent's reconciliation flow.
      try {
        const planLabel = existingSub.plan === 'family' ? 'Kiddo Family' : existingSub.plan === 'legacy' ? 'Kiddo Legacy' : 'Kiddo';
        const reconcileTail = reconcile.last4 ? ` to ${reconcile.brand ? reconcile.brand.charAt(0).toUpperCase() + reconcile.brand.slice(1) : 'card'} ····${reconcile.last4}` : '';
        await storage.createActivity({
          userId: existingSub.userId,
          type: 'subscription_renewal',
          title: `${planLabel} renewed`,
          description: `$${amountNum.toFixed(2)} charged${reconcileTail}.`,
          amount: amountNum.toFixed(2),
          metadata: JSON.stringify({
            plan: existingSub.plan,
            paymentMethodBrand: reconcile.brand,
            paymentMethodLast4: reconcile.last4,
            descriptor: reconcile.descriptor,
            stripeReceiptUrl: receiptOrInvoiceUrl,
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subscriptionId,
            periodStart: periodStart ? periodStart.toISOString() : null,
            periodEnd: periodEnd ? periodEnd.toISOString() : null,
          }),
        } as any);
      } catch (activityErr) {
        console.error('[Webhook] Failed to record subscription_renewal activity:', activityErr);
      }
      return;
    }

    const existingMembership = await storage.getFundMembershipByStripeId(subscriptionId);
    if (existingMembership) {
      const updates: any = {};
      if (periodEnd) updates.currentPeriodEnd = periodEnd;
      if (periodStart) updates.currentPeriodStart = periodStart;
      if (existingMembership.status === 'canceled' && periodEnd && periodEnd > new Date()) {
        updates.status = 'active';
        updates.canceledAt = null;
      }
      if (Object.keys(updates).length > 0) await storage.updateFundMembership(existingMembership.id, updates);
      await storage.createTransaction({
        userId: existingMembership.userId,
        fundId: existingMembership.fundId,
        type: 'subscription_renewal',
        stripeSubscriptionId: subscriptionId,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: customerId,
        amount,
        currency: invoice.currency || 'usd',
        status: 'completed',
        description: 'Kiddo+ renewal',
        completedAt: new Date(),
      });
      // Same mirror for per-fund Plus memberships.
      try {
        const reconcileTail = reconcile.last4 ? ` to ${reconcile.brand ? reconcile.brand.charAt(0).toUpperCase() + reconcile.brand.slice(1) : 'card'} ····${reconcile.last4}` : '';
        await storage.createActivity({
          userId: existingMembership.userId,
          fundId: existingMembership.fundId,
          type: 'subscription_renewal',
          title: 'Kiddo+ renewed',
          description: `$${amountNum.toFixed(2)} charged${reconcileTail}.`,
          amount: amountNum.toFixed(2),
          metadata: JSON.stringify({
            plan: 'starter',
            paymentMethodBrand: reconcile.brand,
            paymentMethodLast4: reconcile.last4,
            descriptor: reconcile.descriptor,
            stripeReceiptUrl: receiptOrInvoiceUrl,
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subscriptionId,
            periodStart: periodStart ? periodStart.toISOString() : null,
            periodEnd: periodEnd ? periodEnd.toISOString() : null,
          }),
        } as any);
      } catch (activityErr) {
        console.error('[Webhook] Failed to record subscription_renewal activity (membership):', activityErr);
      }
    }
  }

  static async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    console.log('[Webhook] invoice.payment_failed:', invoice.id);

    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

    if (!subscriptionId) return;

    // Gifter recurring card-failure cascade per locked Decision B
    // (project_gifter_recurring_restoration.md). Privacy-first:
    //   1. Auto-pause the schedule (no Memory Book entry; no parent
    //      notification about the FAILURE — only that recurring is
    //      paused).
    //   2. Email the gifter immediately (their financial state is
    //      their business; the parent doesn't see why).
    //   3. The 14-day reminder + 30-day cancel will fire from the
    //      recurringContributionWorker (which polls paused schedules
    //      with payment_failed reason).
    // Stripe's default subscription receipts/dunning are suppressed
    // for these subscriptions, so we own the email cadence.
    try {
      const stripe = await getUncachableStripeClient();
      const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
      const subMetadata = subscription?.metadata || {};
      if (String(subMetadata.type || "") === "gifter_recurring") {
        // Pause the recurring_gifts row with payment_failed reason.
        await db
          .update(recurringGifts)
          .set({
            status: "paused",
            pauseReason: "payment_failed",
            pausedAt: new Date(),
          })
          .where(eq(recurringGifts.stripeSubscriptionId, subscriptionId));

        // Send our branded "update your card" email to the gifter.
        const senderEmail = String(subMetadata.senderEmail || "");
        const fundId = String(subMetadata.fundId || "");
        if (senderEmail && fundId) {
          try {
            const fund = await storage.getFund(fundId);
            const childName = fund?.recipientFirstName || fund?.name || "the fund";
            const { sendEmail } = await import("./emailDelivery");
            const { renderKiddoEmail } = await import("./templates/baseTemplate");
            const subject = `Your monthly to ${childName} couldn't go through`;
            const body = [
              `Your most recent monthly to ${childName}'s fund didn't go through. This usually means your card needs an update.`,
              "",
              `Open your gifter dashboard to update your payment any time. We'll try again automatically once the card is current.`,
              "",
              `If you do nothing, the recurring will stop after about 30 days. No further charges.`,
            ].join("\n");
            const { html } = renderKiddoEmail({ heading: subject, intro: body });
            await sendEmail({
              to: senderEmail,
              subject,
              text: body + "\n\nThe Kiddo team",
              html,
            } as any);
          } catch (emailErr) {
            console.warn("[Webhook] gifter_recurring payment_failed email failed:", emailErr);
          }
        }
        return;
      }
    } catch (gifterCheckErr) {
      console.warn("[Webhook] gifter_recurring payment_failed detection failed:", gifterCheckErr);
    }

    const existingSub = await storage.getSubscriptionByStripeId(subscriptionId);
    if (existingSub) {
      await storage.createActivity({
        userId: existingSub.userId,
        type: 'payment_failed',
        title: 'Kiddo Family payment failed',
        description: 'Your Kiddo Family payment failed. Please update your payment method in Settings.',
      });
      return;
    }

    const existingMembership = await storage.getFundMembershipByStripeId(subscriptionId);
    if (existingMembership) {
      await storage.createActivity({
        userId: existingMembership.userId,
        fundId: existingMembership.fundId,
        type: 'payment_failed',
        title: 'Kiddo+ payment failed',
        description: 'Your Kiddo+ payment failed for this fund. Please update your payment method in Settings.',
      });
    }
  }
}
