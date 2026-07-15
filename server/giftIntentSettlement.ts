// P0-1 capture-at-intent (Option C) — shared off-session settlement.
//
// One code path for "charge the gifter's vaulted card and settle the gift into
// the paired fund," called by BOTH:
//   - the pairing loop in POST /api/funds (initial settlement at fund creation)
//   - giftIntentExpiryWorker's decline-retry pass (soft-decline recovery)
//
// Keeping this in one place (vs. duplicating in the worker) is per the advisory
// panel's implementation review — the missing "resilience layer" must reuse the
// exact settle logic so the two paths can't diverge. INERT unless the caller is
// gated by isGifterCaptureAtIntentEnabled(). See P0-1_IMPLEMENTATION_REVIEW.md.

import { db } from "./db";
import { eq } from "drizzle-orm";
import { giftIntents } from "@shared/schema";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { WebhookHandlers } from "./webhookHandlers";
import { shouldSilenceForFund } from "./memorialized";

export interface SettleableIntent {
  id: string;
  amount: string;
  gifterName: string;
  gifterEmail: string | null;
  message: string | null;
  fundId: string | null;
  stripeSetupIntentId: string | null;
  stripeCustomerId: string | null;
  failedChargeCount?: number | null;
}

export type SettleResult =
  | { settled: true; giftId: string }
  | { settled: false; declined: boolean; reason: string };

/**
 * Charge the vaulted card off-session and settle the gift into intent.fundId.
 * Caller must ensure the intent is paired (fundId set) and has a confirmed
 * SetupIntent + customer. `attempt` varies the idempotency key across retries so
 * a retry isn't deduped against the original failed attempt (attempt 0 = initial).
 * On decline, stamps payment_status='declined' + increments failed_charge_count.
 */
export async function settleGiftIntentOffSession(
  intent: SettleableIntent,
  opts?: { attempt?: number; markPaired?: boolean },
): Promise<SettleResult> {
  if (!intent.fundId || !intent.stripeSetupIntentId || !intent.stripeCustomerId) {
    return { settled: false, declined: false, reason: "missing-prereqs" };
  }

  const setup = await stripeService.retrieveSetupIntent(String(intent.stripeSetupIntentId));
  const pmId = typeof setup.payment_method === "string"
    ? setup.payment_method
    : (setup.payment_method as any)?.id;
  if (setup.status !== "succeeded" || !pmId) {
    return { settled: false, declined: false, reason: "setup-not-confirmed" };
  }

  const attempt = opts?.attempt ?? 0;
  const markFailed = async () => {
    await db.update(giftIntents)
      .set({ paymentStatus: "declined", failedChargeCount: (Number(intent.failedChargeCount) || 0) + 1 })
      .where(eq(giftIntents.id, intent.id));
  };

  // Bereavement freeze: never settle (charge) a gift toward a memorialized fund.
  // Hold it silently — the card is fine, so this is NOT a decline; don't mark
  // failed or retry. See BEREAVEMENT_POSTURE.md.
  if (await shouldSilenceForFund(intent.fundId)) {
    return { settled: false, declined: false, reason: "bereavement-silenced" };
  }

  let pi;
  try {
    pi = await stripeService.chargeGifterOffSession({
      customerId: String(intent.stripeCustomerId),
      paymentMethodId: String(pmId),
      amountCents: Math.round(parseFloat(String(intent.amount)) * 100),
      metadata: { kind: "gifter_capture_settlement", giftIntentId: intent.id, fundId: intent.fundId },
      // Vary the key per attempt so retries aren't deduped against the failed one.
      idempotencyKey: attempt > 0 ? `gifter-settle-${intent.id}-r${attempt}` : `gifter-settle-${intent.id}`,
    });
  } catch (err) {
    await markFailed();
    return { settled: false, declined: true, reason: (err as any)?.message || "charge-failed" };
  }

  if (pi.status !== "succeeded") {
    await markFailed();
    return { settled: false, declined: true, reason: `pi-status-${pi.status}` };
  }

  // Gifter pledged `amount`; charge exactly that, net all to the fund (Kiddo
  // absorbs processing — fee model to confirm pre-launch per the panel review).
  const amt = parseFloat(String(intent.amount)).toFixed(2);
  const giftRow = await storage.createGift({
    fundId: intent.fundId,
    senderName: intent.gifterName,
    senderEmail: intent.gifterEmail,
    amount: amt,
    netAmount: amt,
    processingFee: "0",
    koraFee: "0",
    message: intent.message || null,
    status: "pending",
    stripePaymentIntentId: pi.id,
  } as any);

  await WebhookHandlers.completeGiftPostPayment(giftRow.id, {
    fundId: intent.fundId,
    isParentContribution: "false",
  });

  await db.update(giftIntents)
    .set({
      status: "completed",
      fundId: intent.fundId,
      ...(opts?.markPaired ? { pairedAt: new Date() } : {}),
      completedAt: new Date(),
      chargedAt: new Date(),
      paymentStatus: "charged",
      settledGiftId: giftRow.id,
    })
    .where(eq(giftIntents.id, intent.id));

  return { settled: true, giftId: giftRow.id };
}
