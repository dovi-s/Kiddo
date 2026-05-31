// Gifter heads-up + expiry worker for gift intents.
//
// Built 2026-05-15 after the gifter-form audit identified two gaps:
//
//   1. A gifter who submitted an intent had no way of knowing whether
//      the parent acted. The success state used to say "no rush, the
//      note we sent is warm" but tell them nothing about timeline
//      the gifter could wonder for 60 days then watch the intent
//      silently expire.
//   2. Intents past their expiresAt sat at status='pending' forever.
//      No automatic flip to 'expired'. The schema column existed
//      (expiresAt at 60 days from createdAt) but nothing enforced
//      the state transition.
//
// This worker handles both:
//
//   A. HEADS-UP. For pending intents with expiresAt between 1 day
//      and 10 days from now, send the gifter a one-time email
//      naming the kid, the parent's email, the amount, and the
//      days remaining. Stamp gifter_reminder_sent_at so it never
//      re-fires for that intent.
//
//   B. EXPIRY CLEANUP. For pending intents with expiresAt in the
//      past, flip status to 'expired'. The intent stays in the DB
//      (audit + analytics + gifter dashboard listing) but is no
//      longer pickable for processing.
//
// The worker is deliberately conservative on emails. ONE heads-up
// per intent, ever. The gifter is told the parent's email and
// encouraged to follow up directly through their own channels
// (text, in person, etc.) Kiddo's role stays "warm welcome,"
// not "follow-up drip." Anti-spam discipline locked.
//
// Cadence: daily. The 10-day lead window means worker downtime of
// up to ~9 days still catches the intent before expiry.

import { db, pool } from "./db";
import { sql, eq, and, lte, gte, isNull } from "drizzle-orm";
import { giftIntents } from "@shared/schema";
import { sendEmail } from "./emailDelivery";
import { renderKiddoEmail } from "./templates/baseTemplate";
import { isGifterCaptureAtIntentEnabled } from "./giftCaptureFlag";
import { settleGiftIntentOffSession } from "./giftIntentSettlement";
import { stripeService } from "./stripeService";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "gift-intent-expiry-worker";
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const HEADS_UP_LEAD_DAYS_MIN = 1;
const HEADS_UP_LEAD_DAYS_MAX = 10;
// P0-1 capture-at-intent (Option C): how many off-session charge attempts (incl.
// the initial one at pairing) before we give up on a declined vaulted card. The
// worker is daily, so this is ~MAX_SETTLE_RETRIES days of soft-decline recovery
// before a terminal cancel + one goodbye email. Bounded to avoid card-network
// retry abuse. (An interactive "update your card" re-vault flow is a future
// enhancement; v1 retries the same saved card for soft declines.)
const MAX_SETTLE_RETRIES = 5;

function getBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "https://kiddofund.com";
}

function fmtMoney(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDaysLeft(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in about ${days} days`;
}

/**
 * Send the gifter a one-time heads-up that their intent is
 * approaching expiry. Returns true on success (email queued or
 * delivered), false on failure. Caller stamps gifterReminderSentAt
 * regardless of return value better to miss one email than to
 * spam the gifter with retries from a worker tick loop.
 */
async function sendGifterHeadsUp(
  intent: {
    id: string;
    gifterName: string;
    gifterEmail: string;
    recipientEmail: string;
    kidFirstName: string;
    amount: string;
    expiresAt: Date | null;
  },
  log: LogFn,
): Promise<boolean> {
  if (!intent.gifterEmail) return false;
  if (!intent.expiresAt) return false;
  const baseUrl = getBaseUrl();
  const giveAGiftUrl = `${baseUrl}/give-a-gift`;
  const daysLeftCopy = fmtDaysLeft(intent.expiresAt);
  const expiresDateStr = intent.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const firstName = intent.gifterName
    ? intent.gifterName.split(" ")[0] || intent.gifterName
    : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const intro = [
    greeting,
    ``,
    `Quick heads up: your ${fmtMoney(intent.amount)} gift for ${intent.kidFirstName} is still waiting for ${intent.recipientEmail} to set up the fund.`,
    ``,
    `The intent expires ${daysLeftCopy} (on ${expiresDateStr}). After that, the gift won't go through and you'd need to start fresh.`,
    ``,
    `If you want to follow up directly, you can text or call ${intent.recipientEmail} the old-fashioned way. Kiddo's role is the warm welcome; yours is the relationship. We won't send the parent another email from our side.`,
    ``,
    `If they do set up ${intent.kidFirstName}'s fund before the deadline, you'll get an email with a one-click link to complete the gift.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `Your gift for ${intent.kidFirstName} is waiting`,
    intro,
    cta: { text: "Start a fresh intent", url: giveAGiftUrl },
    postscript: "Different parent email, different amount, or different child? Tap above to start fresh.",
  });

  const text = [
    greeting,
    ``,
    `Quick heads up: your ${fmtMoney(intent.amount)} gift for ${intent.kidFirstName} is still waiting for ${intent.recipientEmail} to set up the fund.`,
    ``,
    `The intent expires ${daysLeftCopy} (on ${expiresDateStr}). After that, the gift won't go through and you'd need to start fresh.`,
    ``,
    `If you want to follow up directly, you can text or call ${intent.recipientEmail} the old-fashioned way. Kiddo's role is the warm welcome; yours is the relationship. We won't send the parent another email from our side.`,
    ``,
    `If they do set up ${intent.kidFirstName}'s fund before the deadline, you'll get an email with a one-click link to complete the gift.`,
    ``,
    `To start a fresh intent: ${giveAGiftUrl}`,
    ``,
    `— The Kiddo team`,
  ].join("\n");

  try {
    await sendEmail({
      to: intent.gifterEmail,
      subject: `Heads up about your gift for ${intent.kidFirstName}`,
      text,
      html,
      tags: ["gift-intent-gifter-headsup"],
      metadata: { intentId: intent.id },
    });
    log(`heads-up sent to ${intent.gifterEmail} for intent ${intent.id}`, WORKER_SOURCE);
    return true;
  } catch (err: any) {
    log(`heads-up email failed for intent ${intent.id}: ${err?.message || err}`, WORKER_SOURCE);
    return false;
  }
}

/**
 * Pick up pending intents whose expiresAt falls in the heads-up
 * window (now+1day to now+10days) and that haven't already had a
 * heads-up sent. Send the email, stamp gifterReminderSentAt.
 */
async function processHeadsUps(log: LogFn): Promise<number> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + HEADS_UP_LEAD_DAYS_MIN * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + HEADS_UP_LEAD_DAYS_MAX * 24 * 60 * 60 * 1000);
  let due: Array<{
    id: string;
    gifterName: string;
    gifterEmail: string;
    recipientEmail: string;
    kidFirstName: string;
    amount: string;
    expiresAt: Date | null;
  }>;
  try {
    due = await db
      .select({
        id: giftIntents.id,
        gifterName: giftIntents.gifterName,
        gifterEmail: giftIntents.gifterEmail,
        recipientEmail: giftIntents.recipientEmail,
        kidFirstName: giftIntents.kidFirstName,
        amount: giftIntents.amount,
        expiresAt: giftIntents.expiresAt,
      })
      .from(giftIntents)
      .where(
        and(
          eq(giftIntents.status, "pending"),
          isNull(giftIntents.gifterReminderSentAt),
          gte(giftIntents.expiresAt, windowStart),
          lte(giftIntents.expiresAt, windowEnd),
        ),
      )
      .limit(200);
  } catch (err: any) {
    log(`heads-up select failed: ${err?.message || err}`, WORKER_SOURCE);
    return 0;
  }
  if (due.length === 0) return 0;
  log(`processing ${due.length} heads-up candidate(s)`, WORKER_SOURCE);
  let sent = 0;
  for (const intent of due) {
    // Stamp BEFORE sending so an email-retry loop can't spam the
    // gifter. If sendGifterHeadsUp fails, we accept missing the
    // email rather than risking double-send on the next worker
    // tick. (Locked anti-spam discipline > guaranteed delivery.)
    try {
      await db
        .update(giftIntents)
        .set({ gifterReminderSentAt: new Date() })
        .where(eq(giftIntents.id, intent.id));
    } catch (err: any) {
      log(`stamp failed for intent ${intent.id}, skipping: ${err?.message || err}`, WORKER_SOURCE);
      continue;
    }
    const ok = await sendGifterHeadsUp(intent, log);
    if (ok) sent += 1;
  }
  return sent;
}

/**
 * Flip status from 'pending' to 'expired' on intents whose
 * expiresAt is in the past. Idempotent the WHERE clause excludes
 * already-expired rows. Returns the number of rows flipped this
 * tick (for the log).
 */
async function processExpiries(log: LogFn): Promise<number> {
  let flipped = 0;
  try {
    const result = await pool.query(
      `UPDATE gift_intents
         SET status = 'expired'
       WHERE status = 'pending'
         AND expires_at IS NOT NULL
         AND expires_at < NOW()
       RETURNING id`,
    );
    flipped = result.rows.length;
    if (flipped > 0) {
      log(`flipped ${flipped} intent(s) to expired`, WORKER_SOURCE);
    }
  } catch (err: any) {
    log(`expiry flip failed: ${err?.message || err}`, WORKER_SOURCE);
  }

  // Honor the point-of-charge disclosure ("we delete your saved card after 60
  // days"): detach the vaulted card from Stripe for any EXPIRED intent that
  // still holds one. Self-healing — stripe_setup_intent_id is cleared only after
  // a successful detach, so a transient Stripe failure simply retries next tick
  // (this scan, not the flip above, drives cleanup). Gated by the capture flag
  // (no card is vaulted when it's off); never touches a charged/completed intent.
  if (isGifterCaptureAtIntentEnabled()) {
    try {
      const stale = await pool.query(
        `SELECT id, stripe_setup_intent_id
           FROM gift_intents
          WHERE status = 'expired'
            AND stripe_setup_intent_id IS NOT NULL
            AND COALESCE(payment_status, '') <> 'charged'
          LIMIT 200`,
      );
      for (const row of stale.rows) {
        try {
          await stripeService.detachGifterSavedCard(String(row.stripe_setup_intent_id));
          await pool.query(
            `UPDATE gift_intents
                SET stripe_setup_intent_id = NULL, payment_status = 'expired'
              WHERE id = $1`,
            [row.id],
          );
          log(`deleted saved card for expired intent ${row.id}`, WORKER_SOURCE);
        } catch (cardErr: any) {
          log(`card cleanup for intent ${row.id} failed (will retry): ${cardErr?.message || cardErr}`, WORKER_SOURCE);
        }
      }
    } catch (selErr: any) {
      log(`saved-card cleanup scan failed: ${selErr?.message || selErr}`, WORKER_SOURCE);
    }
  }
  return flipped;
}

/**
 * Terminal give-up on a declined capture intent after MAX_SETTLE_RETRIES: mark
 * cancelled + send ONE honest goodbye email. No re-select after this (status
 * leaves 'paired'), so the email fires exactly once.
 */
async function giveUpOnDeclinedIntent(
  intent: { id: string; gifterName: string; gifterEmail: string | null; kidFirstName: string; amount: string },
  log: LogFn,
): Promise<void> {
  try {
    await db
      .update(giftIntents)
      .set({ status: "cancelled", cancelledAt: new Date(), paymentStatus: "expired" })
      .where(eq(giftIntents.id, intent.id));
  } catch (err: any) {
    log(`give-up update failed for intent ${intent.id}: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (!intent.gifterEmail) return;
  const baseUrl = getBaseUrl();
  const giveAGiftUrl = `${baseUrl}/give-a-gift`;
  const firstName = intent.gifterName ? intent.gifterName.split(" ")[0] || intent.gifterName : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const text = [
    greeting,
    ``,
    `We tried a few times but couldn't complete your ${fmtMoney(intent.amount)} gift for ${intent.kidFirstName} — your card didn't go through.`,
    ``,
    `No charge was made. If you'd still like to give, you can start fresh any time and use a different card.`,
    ``,
    `To start fresh: ${giveAGiftUrl}`,
    ``,
    `— The Kiddo team`,
  ].join("\n");
  try {
    const { html } = renderKiddoEmail({
      heading: `We couldn't complete your gift for ${intent.kidFirstName}`,
      intro: text,
      cta: { text: "Start fresh", url: giveAGiftUrl },
    });
    await sendEmail({
      to: intent.gifterEmail,
      subject: `We couldn't complete your gift for ${intent.kidFirstName}`,
      text,
      html,
      tags: ["gift-intent-charge-failed"],
      metadata: { intentId: intent.id },
    });
    log(`give-up goodbye sent to ${intent.gifterEmail} for intent ${intent.id}`, WORKER_SOURCE);
  } catch (err: any) {
    log(`give-up email failed for intent ${intent.id}: ${err?.message || err}`, WORKER_SOURCE);
  }
}

/**
 * P0-1 capture-at-intent (Option C) decline recovery. For paired intents whose
 * vaulted-card off-session charge was declined, retry the SAME card (catches
 * soft declines that later clear). Reuses the exact settle helper the pairing
 * loop uses, so the two paths can't diverge. After MAX_SETTLE_RETRIES attempts,
 * give up terminally. INERT unless capture-at-intent is enabled.
 */
async function processDeclineRetries(log: LogFn): Promise<number> {
  if (!isGifterCaptureAtIntentEnabled()) return 0;
  let due: Array<{
    id: string;
    amount: string;
    gifterName: string;
    gifterEmail: string | null;
    message: string | null;
    kidFirstName: string;
    fundId: string | null;
    stripeSetupIntentId: string | null;
    stripeCustomerId: string | null;
    failedChargeCount: number | null;
  }>;
  try {
    due = await db
      .select({
        id: giftIntents.id,
        amount: giftIntents.amount,
        gifterName: giftIntents.gifterName,
        gifterEmail: giftIntents.gifterEmail,
        message: giftIntents.message,
        kidFirstName: giftIntents.kidFirstName,
        fundId: giftIntents.fundId,
        stripeSetupIntentId: giftIntents.stripeSetupIntentId,
        stripeCustomerId: giftIntents.stripeCustomerId,
        failedChargeCount: giftIntents.failedChargeCount,
      })
      .from(giftIntents)
      .where(and(eq(giftIntents.status, "paired"), eq(giftIntents.paymentStatus, "declined")))
      .limit(100);
  } catch (err: any) {
    log(`decline-retry select failed: ${err?.message || err}`, WORKER_SOURCE);
    return 0;
  }
  if (due.length === 0) return 0;
  log(`processing ${due.length} decline-retry candidate(s)`, WORKER_SOURCE);
  let settled = 0;
  for (const intent of due) {
    const priorFails = Number(intent.failedChargeCount) || 0;
    if (priorFails >= MAX_SETTLE_RETRIES) {
      await giveUpOnDeclinedIntent(intent, log);
      continue;
    }
    try {
      const result = await settleGiftIntentOffSession(intent, { attempt: priorFails, markPaired: false });
      if (result.settled) {
        settled += 1;
        log(`decline-retry settled intent ${intent.id} -> gift ${result.giftId}`, WORKER_SOURCE);
      } else if (result.declined && priorFails + 1 >= MAX_SETTLE_RETRIES) {
        await giveUpOnDeclinedIntent(intent, log);
      }
    } catch (err: any) {
      log(`decline-retry error for intent ${intent.id}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }
  return settled;
}

async function tick(log: LogFn): Promise<void> {
  const headsUps = await processHeadsUps(log);
  const expiries = await processExpiries(log);
  const retries = await processDeclineRetries(log);
  if (headsUps === 0 && expiries === 0 && retries === 0) return;
  log(`tick done: headsUps=${headsUps} expiries=${expiries} declineRetries=${retries}`, WORKER_SOURCE);
}

export function startGiftIntentExpiryWorker(log: LogFn): void {
  // First run delayed 60s so the rest of the server has time to come
  // up. Subsequent runs daily. 10-day heads-up window means worker
  // downtime of up to ~9 days still catches the intent before expiry.
  setTimeout(() => {
    void tick(log).catch(() => null);
    setInterval(() => {
      void tick(log).catch(() => null);
    }, RUN_INTERVAL_MS);
  }, 60_000);
  log("started (daily, 10d heads-up lead, expiry flip on tick)", WORKER_SOURCE);
}
