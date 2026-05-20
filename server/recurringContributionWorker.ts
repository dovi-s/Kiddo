import Stripe from 'stripe';
import { pool } from './db';
import { storage } from './storage';
import { sendEmail } from './emailDelivery';
import { renderKiddoEmail } from './templates/baseTemplate';
import { buildParentHandoffRecurringEmail } from './templates/parentHandoffRecurring';
import { getUncachableStripeClient } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';

type LogFn = (message: string, source?: string) => void;

const WORKER_SOURCE = 'recurring-worker';

// How long to wait between consecutive "Time to add to {child}'s fund"
// decline emails for the same recurring contribution. Stripe retries can
// fire on N consecutive days; without this gate the parent got one email
// per retry day. 72h is short enough that a real persistent decline
// gets re-surfaced reasonably soon, long enough that a single failing
// card doesn't pelt the parent.
const RECURRING_DECLINE_EMAIL_COOLDOWN_HOURS = 72;

// Reconcile metadata pulled from the parent's payment method and used to
// stamp both success (gift_invested) and failure (parent_contribution_failed)
// rows so the History view can show "Visa ····4242" + a Stripe receipt
// link inline. Lets a parent match Kiddo rows to bank-statement lines —
// the gap that broke "Activity is covered for transactions" today.
type ReconcileInfo = {
  brand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  descriptor: string | null;
};

// Writes a `parent_contribution_failed` activity row when a recurring
// charge fails (Stripe declined, PI errored, etc.). Without this, failures
// were completely silent — the schedule kept "Active" status, the gift was
// marked failed, and an email reminder went out, but nothing surfaced
// anywhere in the parent's UI. Now the Activity / Scheduled tab can show
// "⚠ Last cycle failed" by checking for a recent row of this type
// pointing back to the contribution. Best-effort; if the activity write
// itself fails we don't want to blow up the worker.
async function recordRecurringFailure(
  row: any,
  reason: string,
  reconcile: ReconcileInfo | null,
  nextRetry: Date | null,
): Promise<void> {
  try {
    const reconcileTail = reconcile?.last4
      ? ` Your ${reconcile.brand ? reconcile.brand.charAt(0).toUpperCase() + reconcile.brand.slice(1) : 'card'} ····${reconcile.last4} was declined.`
      : '';
    const retryTail = nextRetry
      ? ` Next attempt ${nextRetry.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
      : '';
    await storage.createActivity({
      userId: String(row.user_id),
      fundId: String(row.fund_id),
      type: 'parent_contribution_failed',
      title: 'Recurring investment failed',
      description: `Last automatic charge could not run.${reconcileTail}${retryTail} We sent you an email reminder so you can add it manually.`,
      amount: row.amount ? String(row.amount) : null,
      metadata: JSON.stringify({
        parentContributionId: String(row.id),
        reason: reason ? String(reason).slice(0, 240) : null,
        paymentMethodBrand: reconcile?.brand || null,
        paymentMethodLast4: reconcile?.last4 || null,
        descriptor: reconcile?.descriptor || null,
        nextRetryDate: nextRetry ? nextRetry.toISOString() : null,
      }),
    } as any);
  } catch (err) {
    // Don't let activity-write failure block the worker's email-fallback path.
    console.warn('[recurring-worker] failed to record failure activity:', err);
  }
}

function getBaseUrl() {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  return configured ? configured.replace(/\/+$/, '') : 'https://kiddofund.com';
}

function advanceDate(from: Date | string | null, frequency: string | null): Date {
  const base = from ? new Date(from) : new Date();
  const freq = (frequency || 'monthly').toLowerCase();
  const next = new Date(base);
  if (freq === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (freq === 'quarterly') {
    next.setMonth(next.getMonth() + 3);
  } else if (freq === 'annually' || freq === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    // monthly default
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

async function processSingleParentContribution(row: Record<string, any>, log: LogFn): Promise<void> {
  const amount = parseFloat(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    log(`skipping contribution ${row.id as string}: invalid amount ${String(row.amount)}`, WORKER_SOURCE);
    return;
  }

  const childName = String(row.recipient_first_name || row.fund_name || 'your child');
  const parentFirstName = String(row.user_first_name || '');
  const parentLastName = String(row.user_last_name || '');
  const parentName = [parentFirstName, parentLastName].filter(Boolean).join(' ') || 'Parent';
  const parentEmail = String(row.user_email || '');
  const stripeCustomerId = row.stripe_customer_id ? String(row.stripe_customer_id) : null;

  // Advance nextRunDate immediately to prevent double-processing on restart
  const nextRunDate = advanceDate(row.next_run_date as Date | string | null, row.frequency as string);
  await storage.updateParentContribution(row.id as string, {
    lastRunDate: new Date(),
    nextRunDate,
  });

  let charged = false;

  if (stripeCustomerId && parentEmail) {
    try {
      const stripe = await getUncachableStripeClient();
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (!customer.deleted) {
        const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
        const pmId = typeof defaultPm === 'string' ? defaultPm : (defaultPm as Stripe.PaymentMethod | null)?.id ?? null;

        if (pmId) {
          // Pre-fetch payment-method details so we can stamp brand+last4 on
          // both success and failure activity rows. One extra Stripe call
          // per cycle is cheap and unlocks the bank-statement reconcile
          // story ("Visa ····4242" inline on the History row).
          const reconcile: ReconcileInfo = { brand: null, last4: null, receiptUrl: null, descriptor: null };
          try {
            const pm: any = typeof defaultPm === 'string'
              ? await stripe.paymentMethods.retrieve(pmId)
              : (defaultPm as any);
            reconcile.brand = pm?.card?.brand || null;
            reconcile.last4 = pm?.card?.last4 || null;
          } catch (pmErr) {
            log(`contribution ${row.id as string}: PM lookup failed (non-fatal): ${String(pmErr)}`, WORKER_SOURCE);
          }
          // Recurring Memory Book note. If the parent set a per-schedule note when
          // creating the recurring investment ("Every month I add $50. This is your
          // future."), each successful auto-fire stamps that note as the gift's
          // message AND writes a memory_entries row below — so each cycle leaves a
          // love letter, not a mute ledger entry. Null note → schedule fires silently
          // (parent's choice).
          const recurringNote = row.note ? String(row.note).trim() : '';
          const giftMessage = recurringNote ? recurringNote.slice(0, 490) : null;

          // Create a gift record so completeGiftPostPayment can find it.
          // parentContributionId links the gift back to its recurring schedule so the
          // gifter detail modal can render a per-gift "↻ Recurring" badge (vs marking
          // the whole person, which would falsely tag one-time gifts from the same person).
          const gift = await storage.createGift({
            fundId: row.fund_id as string,
            senderName: parentName,
            senderEmail: parentEmail,
            amount: amount.toFixed(2),
            processingFee: '0',
            koraFee: '0',
            netAmount: amount.toFixed(2),
            message: giftMessage,
            executionModel: String(row.execution_model || 'auto_invest'),
            selectedTicker: row.selected_ticker ? String(row.selected_ticker) : null,
            status: 'processing',
            parentContributionId: row.id as string,
            // Worker-fired off-session payment intent — distinct from
            // gifter / parent-manual surfaces so ops can filter the
            // recurring cohort separately. Not derived from any client
            // request; this code path runs on the server's cron tick.
            source: 'recurring_worker',
          } as any);

          try {
            const pi = await stripe.paymentIntents.create({
              amount: Math.round(amount * 100),
              currency: 'usd',
              customer: stripeCustomerId,
              payment_method: pmId,
              confirm: true,
              off_session: true,
              // Stripe descriptor — appears on bank statements. Locked
              // copy: never "auto-invest" in user-facing strings.
              description: `Recurring investment for ${childName} via Kiddo`,
              metadata: {
                giftId: gift.id,
                fundId: row.fund_id as string,
                fundUserId: row.user_id as string,
                isParentContribution: 'true',
                selectedTicker: row.selected_ticker ? String(row.selected_ticker) : '',
                executionModel: String(row.execution_model || 'auto_invest'),
              },
            });

            // After confirm, the PI carries `latest_charge` which has the
            // receipt URL — used by the History row's "View receipt" link.
            try {
              const latestChargeId = typeof (pi as any).latest_charge === 'string' ? (pi as any).latest_charge : (pi as any).latest_charge?.id;
              if (latestChargeId) {
                const ch: any = await stripe.charges.retrieve(latestChargeId);
                reconcile.receiptUrl = ch?.receipt_url || null;
                reconcile.descriptor = ch?.statement_descriptor || ch?.calculated_statement_descriptor || null;
              }
            } catch (chargeErr) {
              log(`contribution ${row.id as string}: charge lookup failed (non-fatal): ${String(chargeErr)}`, WORKER_SOURCE);
            }

            if (pi.status === 'succeeded') {
              await storage.updateGift(gift.id, { stripePaymentIntentId: pi.id });
              await WebhookHandlers.completeGiftPostPayment(gift.id, {
                fundUserId: row.user_id as string,
                userId: row.user_id as string,
                isParentContribution: 'true',
                selectedTicker: row.selected_ticker ? String(row.selected_ticker) : '',
                executionModel: String(row.execution_model || 'auto_invest'),
                // Reconcile metadata flows into the gift_invested activity row.
                paymentMethodBrand: reconcile.brand || '',
                paymentMethodLast4: reconcile.last4 || '',
                stripeReceiptUrl: reconcile.receiptUrl || '',
                descriptor: reconcile.descriptor || '',
              });
              const prevTotal = parseFloat(String(row.total_contributed || '0'));
              await storage.updateParentContribution(row.id as string, {
                totalContributed: (prevTotal + amount).toFixed(2),
              });

              // Memory Book entry — STAMP ONCE on the first successful cycle of
              // a recurring schedule, never again. The note the parent wrote at
              // setup is a single intent ("Why I started this for Emma"); writing
              // the same line every cycle would create 216 identical entries
              // over 18 years and pollute the Memory Book at 18. Detection: if
              // prevTotal === 0, this is the first time this schedule has
              // contributed → stamp. Subsequent cycles record in Activity only.
              // The recurring schedule itself stays linked via giftId so the
              // memory entry can render the cadence ("Set up monthly · still
              // running") at read time.
              const isFirstCycle = prevTotal === 0;
              if (recurringNote && isFirstCycle) {
                try {
                  await storage.createMemoryEntry({
                    fundId: row.fund_id as string,
                    giftId: gift.id,
                    type: 'parent_note',
                    content: recurringNote,
                    authorName: parentName,
                    // 2026-05-15: stamp authorUserId so the 30-day PII
                    // scrub worker can anonymize this entry if the
                    // parent later deletes their account. row.user_id
                    // is the parent who set up the recurring schedule,
                    // matching the auth-shaped authorUserId column.
                    authorUserId: row.user_id as string,
                  } as any);
                } catch (memErr) {
                  // Memory write is best-effort — payment succeeded, fund credited.
                  // Don't roll back a real money movement over a memory-entry hiccup.
                  log(`contribution ${row.id as string}: memory entry write failed (non-fatal): ${String(memErr)}`, WORKER_SOURCE);
                }
              }
              const memoryStamped = recurringNote && isFirstCycle;
              log(`contribution ${row.id as string}: charged $${amount.toFixed(2)} via Stripe PI ${pi.id}${memoryStamped ? ' [+memory entry, first cycle]' : recurringNote ? ' [memory entry skipped — already stamped on first cycle]' : ''}`, WORKER_SOURCE);
              charged = true;
            } else {
              await storage.updateGift(gift.id, { status: 'failed' });
              await recordRecurringFailure(row, `Charge status: ${pi.status}`, reconcile, nextRunDate);
              log(`contribution ${row.id as string}: PI ${pi.id} status=${pi.status}, falling back to email`, WORKER_SOURCE);
            }
          } catch (piErr) {
            // PaymentIntent failed (e.g. card declined) - mark gift failed, fall through to email
            await storage.updateGift(gift.id, { status: 'failed' });
            await recordRecurringFailure(row, String(piErr), reconcile, nextRunDate);
            log(`contribution ${row.id as string}: Stripe charge failed: ${String(piErr)}`, WORKER_SOURCE);
          }
        }
      }
    } catch (stripeErr) {
      log(`contribution ${row.id as string}: Stripe error: ${String(stripeErr)}`, WORKER_SOURCE);
    }
  }

  if (!charged && parentEmail) {
    // 72h cooldown gate. Stripe retries cluster across multiple worker
    // ticks; without the gate a dying card produced one email per tick.
    // We still record the activity row (already done above via
    // recordRecurringFailure) so the in-app "Last cycle failed" surface
    // stays current; the gate only suppresses redundant inbox sends.
    // Defensive against the column being undefined for legacy rows
    // (treats undefined as "no prior email", which is the legacy
    // pre-cooldown behavior, so degrades safely).
    const lastDeclineEmailAt = row.last_decline_email_at
      ? new Date(row.last_decline_email_at as string)
      : null;
    const cooldownMs = RECURRING_DECLINE_EMAIL_COOLDOWN_HOURS * 60 * 60 * 1000;
    const withinCooldown =
      lastDeclineEmailAt &&
      Number.isFinite(lastDeclineEmailAt.getTime()) &&
      Date.now() - lastDeclineEmailAt.getTime() < cooldownMs;

    if (withinCooldown) {
      log(
        `contribution ${row.id as string}: skipped decline email to ${parentEmail} (last sent ${lastDeclineEmailAt!.toISOString()}, cooldown ${RECURRING_DECLINE_EMAIL_COOLDOWN_HOURS}h)`,
        WORKER_SOURCE,
      );
    } else {
      const dashboardUrl = `${getBaseUrl()}/dashboard`;
      const greeting = `Hi${parentFirstName ? ` ${parentFirstName}` : ''},`;
      const introBody = [
        greeting,
        '',
        `Your scheduled $${amount.toFixed(2)} for ${childName} is ready. We couldn't run it automatically this time.`,
        '',
        'Head to your dashboard to add it now.',
      ].join('\n');
      const { html } = renderKiddoEmail({
        heading: `Time to add to ${childName}'s fund`,
        intro: introBody,
        cta: { text: 'Open Dashboard', url: dashboardUrl },
      });
      await sendEmail({
        to: parentEmail,
        subject: `Time to add to ${childName}'s fund`,
        text: [
          greeting,
          '',
          `Your scheduled $${amount.toFixed(2)} for ${childName} is ready. We couldn't run it automatically this time.`,
          '',
          'Head to your dashboard to add it now:',
          dashboardUrl,
          '',
          '— The Kiddo team',
        ].join('\n'),
        html,
        tags: ['parent_contribution_reminder'],
        metadata: {
          contributionId: row.id as string,
          fundId: row.fund_id as string,
        },
      });
      // Stamp the cooldown anchor. Direct SQL keeps this worker
      // self-contained (matches the existing pattern of raw pool queries
      // for parent_contributions; no storage helper detour). Best-effort:
      // if the UPDATE fails we still consider the send successful,
      // worst case the next worker tick re-sends.
      try {
        await pool.query(
          `UPDATE parent_contributions SET last_decline_email_at = NOW() WHERE id = $1`,
          [row.id as string],
        );
      } catch (stampErr) {
        log(
          `contribution ${row.id as string}: cooldown stamp failed (non-fatal): ${String(stampErr)}`,
          WORKER_SOURCE,
        );
      }
      log(`contribution ${row.id as string}: email reminder sent to ${parentEmail}`, WORKER_SOURCE);
    }
  }
}

// Auto-pause parent_contributions whose fund has changed ownership since
// the row was created. Fires BEFORE the regular processing loop so we
// never attempt a charge against an account the contributor no longer
// owns. The canonical case is the age-18 majority handoff: funds.userId
// flips from parent to kid (per the AgeTransitionInvite "complete
// transfer" flow), but pc.user_id stays pointing at the original
// parent. Without this guard the worker would keep charging the
// parent's card and depositing into the now-kid-owned account, which
// is both legally awkward (parent is now an undisclosed gifter) and
// product-wrong (parent's dashboard would still show "Recurring
// investment active" for a fund they no longer manage).
//
// Status set to 'paused' with pause_reason 'majority_handoff' so it
// can be distinguished from 'user' (manual pause) and 'subscription_
// ended' (subscription cascade). Different reasons gate different
// resume paths.
//
// Activity row written so the parent sees what happened on next
// dashboard visit (best-effort; activity write failure does not block
// the pause). The follow-up "would you like to convert this to a
// recurring gift?" email is deferred per Bucket 4b of
// AGE_18_HANDOFF_SPEC.md — copy needs a focused design pass.
async function autoPauseOwnershipMismatchedContributions(log: LogFn): Promise<void> {
  // Find active rows where the fund's owner is no longer the contributor.
  // RETURNING gives us the rows to write activity for in the next step.
  // Additional fields (user_email, user_first_name, fund_slug, frequency)
  // are needed for the conversion-to-gift email we send right after the
  // pause. The email tells the parent their recurring stopped and offers
  // the one-click path to re-set-it-up as a recurring gift through the
  // public gift link (same loop grandma uses).
  const flippedResult = await pool.query<Record<string, any>>(`
    SELECT pc.id, pc.fund_id, pc.user_id, pc.amount, pc.frequency,
           f.recipient_first_name, f.name AS fund_name, f.slug AS fund_slug,
           f.user_id AS current_fund_owner_id,
           u.email AS user_email, u.first_name AS user_first_name
    FROM parent_contributions pc
    JOIN funds f ON f.id = pc.fund_id
    JOIN users u ON u.id = pc.user_id
    WHERE pc.status = 'active'
      AND f.user_id <> pc.user_id
  `);

  if (flippedResult.rows.length === 0) return;

  // Bulk-pause the matching rows. Same UPDATE shape as the subscription-
  // cascade pause in storage.ts:563 so the patterns stay parallel.
  const idsToPause = flippedResult.rows.map((r) => String(r.id));
  await pool.query(
    `UPDATE parent_contributions
       SET status = 'paused',
           pause_reason = 'majority_handoff',
           paused_at = NOW(),
           updated_at = NOW()
     WHERE id = ANY($1::varchar[])`,
    [idsToPause],
  );

  // Write an activity row for each paused contribution so the
  // (former) parent sees the explanation in their feed. Scoped to
  // the original contributor's user_id so it appears on THEIR
  // dashboard, not the kid's (the kid has their own welcome-at-18
  // moment and should not see "Recurring investment paused" as an
  // intro to their fund).
  //
  // Uses the canonical `recurring_paused` type rather than a new
  // type so the existing client renderers (activity-helpers.tsx
  // getTypeConfig at line 90, NotificationsPanel auto-type maps,
  // Activity.tsx AUTO_TYPES filter) pick it up without UI taxonomy
  // changes. The `metadata.reason = 'majority_handoff'` field is
  // the seam for any future renderer that wants to distinguish
  // handoff pause from manual pause.
  for (const row of flippedResult.rows) {
    const childName = String(row.recipient_first_name || row.fund_name || 'your child');
    try {
      await storage.createActivity({
        userId: String(row.user_id),
        fundId: String(row.fund_id),
        type: 'recurring_paused',
        title: 'Recurring investment paused',
        description: `${childName} is the legal owner of the fund now, so the recurring investment from your account stopped. You can keep contributing as a gifter through the gift link if you want to.`,
        amount: row.amount ? String(row.amount) : null,
        metadata: JSON.stringify({
          parentContributionId: String(row.id),
          reason: 'majority_handoff',
          currentFundOwnerId: String(row.current_fund_owner_id),
        }),
      } as any);
    } catch (err) {
      // Don't let activity-write failure block the pause itself.
      console.warn('[recurring-worker] failed to record handoff-pause activity:', err);
    }

    // Conversion-to-gift email. Per AGE_18_HANDOFF_SPEC.md Bucket 4b:
    // when we auto-pause the parent's custodial recurring, offer them
    // the one-click path to keep contributing through the gift loop.
    // Same amount, same cadence, this time as a recurring gift via
    // the public /{slug} URL the kid can share.
    //
    // Skipped when the user has no email on file (legacy seed rows,
    // demo accounts). Best-effort — a single email failure does not
    // block the pause, and we do not retry the email (the activity
    // row carries the same information durably in the parent's
    // dashboard feed).
    const parentEmail = String(row.user_email || '').trim();
    if (parentEmail) {
      try {
        const giftLinkUrl = row.fund_slug
          ? `${getBaseUrl()}/${String(row.fund_slug)}`
          : `${getBaseUrl()}/gift/${String(row.fund_id)}`;
        const emailMsg = buildParentHandoffRecurringEmail({
          to: parentEmail,
          parentFirstName: row.user_first_name ? String(row.user_first_name) : null,
          childFirstName: childName,
          amountUsd: parseFloat(String(row.amount || '0')),
          frequency: String(row.frequency || 'monthly'),
          giftLinkUrl,
        });
        await sendEmail(emailMsg);
      } catch (mailErr) {
        console.warn(
          '[recurring-worker] handoff-conversion email failed:',
          mailErr,
        );
      }
    }
  }

  log(
    `auto-paused ${idsToPause.length} parent_contribution(s) due to ownership handoff`,
    WORKER_SOURCE,
  );
}

async function processParentContributions(log: LogFn): Promise<void> {
  // Run the ownership-mismatch sweep FIRST so the SELECT below cannot
  // pick up any rows that should have been paused. This is the
  // defensive ordering: even if a single tick races with a fresh
  // handoff, the same tick auto-pauses and then re-queries.
  await autoPauseOwnershipMismatchedContributions(log);

  const result = await pool.query<Record<string, any>>(`
    SELECT
      pc.id, pc.fund_id, pc.user_id, pc.amount, pc.frequency,
      pc.execution_model, pc.selected_ticker, pc.next_run_date,
      pc.last_run_date, pc.total_contributed, pc.note,
      pc.last_decline_email_at,
      f.name AS fund_name, f.slug AS fund_slug, f.recipient_first_name,
      u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name,
      s.stripe_customer_id
    FROM parent_contributions pc
    JOIN funds f ON f.id = pc.fund_id
    JOIN users u ON u.id = pc.user_id
    LEFT JOIN subscriptions s ON s.user_id = pc.user_id AND s.status = 'active'
    WHERE pc.status = 'active'
      AND pc.next_run_date IS NOT NULL
      AND pc.next_run_date <= NOW()
      -- Defense in depth: even if the auto-pause sweep above missed a
      -- row (e.g., a handoff that landed between the sweep and this
      -- query), this clause ensures we never charge for a contribution
      -- whose fund has flipped to a different owner.
      AND f.user_id = pc.user_id
    ORDER BY pc.next_run_date ASC
    LIMIT 100
  `);

  for (const row of result.rows) {
    try {
      await processSingleParentContribution(row, log);
    } catch (err) {
      log(`contribution ${String(row.id)} unhandled error: ${String(err)}`, WORKER_SOURCE);
    }
  }

  if (result.rows.length > 0) {
    log(`processed ${result.rows.length} parent contribution(s)`, WORKER_SOURCE);
  }
}

async function processGifterRecurring(log: LogFn): Promise<void> {
  const result = await pool.query<Record<string, any>>(`
    SELECT
      rg.id, rg.fund_id, rg.sender_name, rg.sender_email,
      rg.amount, rg.frequency, rg.next_charge_date,
      f.name AS fund_name, f.slug AS fund_slug, f.recipient_first_name
    FROM recurring_gifts rg
    JOIN funds f ON f.id = rg.fund_id
    WHERE rg.status = 'active'
      AND rg.sender_email IS NOT NULL
      AND rg.next_charge_date IS NOT NULL
      AND rg.next_charge_date <= NOW()
    ORDER BY rg.next_charge_date ASC
    LIMIT 100
  `);

  for (const row of result.rows) {
    try {
      const amount = parseFloat(String(row.amount));
      const childName = String(row.recipient_first_name || row.fund_name || 'the child');
      const senderEmail = String(row.sender_email || '');
      const senderName = String(row.sender_name || 'there');

      if (!senderEmail) continue;

      const giftUrl = row.fund_slug
        ? `${getBaseUrl()}/${String(row.fund_slug)}`
        : `${getBaseUrl()}/gift/${String(row.fund_id)}`;

      // Advance before sending so a crash doesn't cause double-sends
      const nextChargeDate = advanceDate(row.next_charge_date as Date | string | null, row.frequency as string);
      await storage.updateRecurringGift(row.id as string, { nextChargeDate });

      const reminderIntro = [
        `Hi ${senderName},`,
        '',
        `You asked us to remind you when it was time to gift ${childName} again.`,
        `Last time you set $${Number.isFinite(amount) ? amount.toFixed(2) : '?'} as your suggested amount. It's totally up to you.`,
        '',
        `Not the right time? Ignore this email. We won't charge anything.`,
      ].join('\n');
      const { html: reminderHtml } = renderKiddoEmail({
        heading: `Time to gift ${childName} again`,
        intro: reminderIntro,
        cta: { text: `Send a gift`, url: giftUrl },
      });
      await sendEmail({
        to: senderEmail,
        subject: `Time to gift ${childName} again`,
        text: [
          `Hi ${senderName},`,
          '',
          `You asked us to remind you when it was time to gift ${childName} again.`,
          `Last time you set $${Number.isFinite(amount) ? amount.toFixed(2) : '?'} as your suggested amount. It's totally up to you.`,
          '',
          `One tap to gift:`,
          giftUrl,
          '',
          `Not the right time? Ignore this email. We won't charge anything.`,
          '',
          '— The Kiddo team',
        ].join('\n'),
        html: reminderHtml,
        tags: ['gift_reminder'],
        metadata: {
          recurringGiftId: row.id as string,
          fundId: row.fund_id as string,
        },
      });

      log(`recurring gift ${row.id as string}: reminder sent to ${senderEmail}`, WORKER_SOURCE);
    } catch (err) {
      log(`recurring gift ${String(row.id)} unhandled error: ${String(err)}`, WORKER_SOURCE);
    }
  }

  if (result.rows.length > 0) {
    log(`processed ${result.rows.length} recurring gift reminder(s)`, WORKER_SOURCE);
  }
}

let workerRunning = false;

// Anniversary milestone scan — once per worker tick, walks active funds
// and fires the milestone_anniversary row when today's date matches a
// fund's createdAt anniversary AND the year delta hits 1/5/10/18. Cheap
// (one query + a few writes max), idempotent (the milestones helper
// dedups), and naturally rate-limited by the worker's tick interval.
async function processAnniversaryMilestones(log: LogFn): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, user_id, created_at FROM funds WHERE status = 'active' AND created_at IS NOT NULL`,
    );
    const { fireAnniversaryMilestone } = await import("./milestones");
    for (const row of result.rows) {
      try {
        await fireAnniversaryMilestone(
          String(row.id),
          String(row.user_id),
          new Date(row.created_at),
        );
      } catch (err) {
        log(`anniversary milestone write failed for fund ${row.id}: ${String(err)}`, WORKER_SOURCE);
      }
    }
  } catch (err) {
    log(`anniversary milestone scan failed: ${String(err)}`, WORKER_SOURCE);
  }
}

export async function runRecurringContributionWorker(log: LogFn = () => undefined): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  try {
    await processParentContributions(log);
    await processGifterRecurring(log);
    await processAnniversaryMilestones(log);
  } catch (err) {
    log(`recurring contribution worker failed: ${String(err)}`, WORKER_SOURCE);
  } finally {
    workerRunning = false;
  }
}

export function startRecurringContributionWorker(log: LogFn = () => undefined): void {
  const intervalMs = Math.max(
    Number(process.env.RECURRING_WORKER_INTERVAL_MS || 30 * 60 * 1000),
    60_000,
  );
  void runRecurringContributionWorker(log);
  const interval = setInterval(() => {
    void runRecurringContributionWorker(log);
  }, intervalMs);
  interval.unref?.();
  log(`recurring contribution worker started (every ${Math.round(intervalMs / 60000)} min)`, WORKER_SOURCE);
}
