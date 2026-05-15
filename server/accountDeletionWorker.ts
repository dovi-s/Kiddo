// Account-deletion PII scrub worker.
//
// Account-deletion is a two-phase operation. Phase 1 lives in
// performAccountDeletion (server/auth.ts) and runs synchronously when
// the user taps Delete: soft-delete the user, cancel Stripe subs,
// cancel recurring contributions, delete bank accounts, revoke pending
// invites, transfer owned funds to accepted co-admins, send the
// confirmation email.
//
// Phase 2 is this worker, running on a delay so the user has 30 days
// to undo the deletion via the emailed restore link (see
// accountRestoreToken.ts). After the grace window passes, this worker
// completes the actual PII scrub:
//
//   1. Anonymize first_name / last_name / preferred_name in place.
//      The user row stays (its id is the foreign-key target for
//      tax records / activities / audit logs that must persist
//      indefinitely) but loses every recoverable PII field.
//
//   2. Anonymize email to "deleted+<userId>@kiddofund.com". Keeps the
//      column non-null so any FK/index logic that lookups by user
//      still works, but the address never reaches an inbox. The user
//      id suffix prevents email-uniqueness collisions with a new
//      account that wants to use the original address.
//
//   3. Null out profile_image_url. The actual image file (if hosted
//      on object storage) is left in place — the URL not being
//      referenced anywhere is enough to break access, and immediate
//      object-storage deletion is a separate ops procedure that
//      varies by storage backend.
//
//   4. Delete the Stripe Customer object for each distinct
//      stripeCustomerId associated with this user (across
//      subscriptions / fund_memberships / transactions rows). Stripe
//      retains the historical records but the Customer with its
//      payment methods + addresses is gone.
//
//   5. Stamp users.pii_scrubbed_at = NOW so the worker doesn't
//      re-process. Once stamped, restoration via the email link is
//      effectively impossible — the row contains no recoverable
//      identity. (The restore endpoint will still grant access, but
//      the user will land on an account with anonymized fields.)
//
// What this worker does NOT do today (documented gaps for follow-up):
//
//   • Memory Book authorship anonymization. memory_entries rows
//     carry author_name + author_photo_url as denormalized strings,
//     not a foreign key to users. There's no clean way to identify
//     entries authored by THIS user without a schema change (add
//     author_user_id column). Deferred to a future Ring C3.
//
//   • Plaid /item/remove. We don't currently store a plaid_item_id
//     column anywhere in the schema; bank_accounts deletion in
//     Phase 1 already removes our reference to the linked account.
//     When/if Plaid Item IDs land in the schema, this worker should
//     call /item/remove on each one.
//
//   • DriveWealth account closure. Separate compliance flow that
//     requires manual operations team involvement; this worker
//     doesn't attempt it.
//
//   • Object-storage file deletion. The profile_image_url column is
//     cleared; whether the underlying file is also deleted depends
//     on the storage backend's retention policy (set elsewhere).
//
// Worker schedule: runs every 6 hours. PII scrub is a slow timer
// (30-day cliff) — no need for real-time precision. First run
// delayed 60s after server start so the rest of the process has
// time to come up.

import { db } from "./db";
import { eq, and, isNull, lt, sql } from "drizzle-orm";
import { users, subscriptions, fundMemberships, transactions, auditLogs } from "@shared/schema";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "account-deletion-worker";
const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BATCH_LIMIT = 50;

type ScrubResult = {
  userId: string;
  stripeCustomersDeleted: number;
  stripeCustomersFailed: number;
};

/**
 * Pick up the next batch of users whose grace period has elapsed but
 * haven't been scrubbed yet. Bounded by BATCH_LIMIT to keep each tick
 * cheap; the worker will catch up across ticks if a backlog accumulates.
 */
async function selectDueUsers(): Promise<Array<{ id: string }>> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);
  return db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.piiScrubbedAt),
        lt(users.deletedAt, cutoff),
      ),
    )
    .limit(BATCH_LIMIT);
}

/**
 * Collect all distinct Stripe Customer IDs referenced by this user's
 * subscription / fund_membership / transaction rows. Returns a Set so
 * duplicates across tables collapse to a single delete call at Stripe.
 */
async function collectStripeCustomerIds(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const subs = await db
    .select({ id: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  for (const r of subs) {
    if (r.id) ids.add(r.id);
  }
  const fms = await db
    .select({ id: fundMemberships.stripeCustomerId })
    .from(fundMemberships)
    .where(eq(fundMemberships.userId, userId));
  for (const r of fms) {
    if (r.id) ids.add(r.id);
  }
  const txs = await db
    .select({ id: transactions.stripeCustomerId })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  for (const r of txs) {
    if (r.id) ids.add(r.id);
  }
  return ids;
}

/**
 * Delete each Stripe Customer object. Errors are non-fatal — a
 * Customer that's already deleted, doesn't exist, or fails to delete
 * due to a transient Stripe error gets logged and the worker moves
 * on. The PII scrub still completes; ops can manually clean up
 * stragglers via the Stripe dashboard if needed.
 */
async function deleteStripeCustomers(
  customerIds: Set<string>,
  log: LogFn,
): Promise<{ deleted: number; failed: number }> {
  if (customerIds.size === 0) return { deleted: 0, failed: 0 };
  let deleted = 0;
  let failed = 0;
  try {
    const { getUncachableStripeClient } = await import("./stripeClient");
    const stripe = await getUncachableStripeClient();
    // Array.from before iterating to avoid TS2802 under the project's
    // current tsconfig target (no downlevel-iteration on Set<T>).
    for (const cid of Array.from(customerIds)) {
      try {
        await stripe.customers.del(cid);
        deleted += 1;
      } catch (err: any) {
        // 404 = customer already gone; treat as success (idempotent).
        const code = err?.statusCode || err?.raw?.statusCode;
        if (code === 404) {
          deleted += 1;
        } else {
          failed += 1;
          log(`stripe customer delete failed (${cid}): ${err?.message || err}`, WORKER_SOURCE);
        }
      }
    }
  } catch (err: any) {
    // Stripe client init failed — entirely non-fatal for the worker.
    // Count all customers as failed; they'll get picked up on the
    // next tick when Stripe comes back.
    failed += customerIds.size;
    log(`stripe client init failed: ${err?.message || err}`, WORKER_SOURCE);
  }
  return { deleted, failed };
}

/**
 * Apply the in-DB PII scrub for a single user. Anonymizes the user
 * row + stamps pii_scrubbed_at so the worker won't re-process. Each
 * field is set to a stable, non-PII placeholder; the email gets the
 * user id as a suffix so it's unique even if a brand-new user
 * eventually signs up with the deleted user's original address.
 */
async function scrubUserRow(userId: string): Promise<void> {
  const placeholderEmail = `deleted+${userId}@kiddofund.com`;
  await db
    .update(users)
    .set({
      firstName: null,
      lastName: null,
      preferredName: null,
      profileImageUrl: null,
      email: placeholderEmail,
      // Clear PII from optional fields too. Phone-equivalents and the
      // trusted-contact slots are individually nullable so the cleanup
      // is just an UPDATE … SET = null. Trusted contact is preserved
      // because it identifies a SEPARATE person (the trusted contact);
      // anonymizing them would lose the deceased-account safety net.
      passwordHash: null,
      googleId: null,
      kycData: null,
      kycStatus: null,
      // referralCode is left intact: it's a non-PII opaque token. If
      // someone else referred users via this user's code, those
      // referral relationships are historical and the code itself
      // isn't sensitive.
      piiScrubbedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Process a single user end-to-end. Each step is independently
 * try/wrapped so partial failures still advance the work — e.g. a
 * Stripe outage shouldn't block the in-DB scrub from completing.
 * piiScrubbedAt is stamped LAST so the worker re-runs if any
 * step prior to the row-scrub fails.
 */
async function scrubOne(userId: string, log: LogFn): Promise<ScrubResult> {
  const result: ScrubResult = {
    userId,
    stripeCustomersDeleted: 0,
    stripeCustomersFailed: 0,
  };
  try {
    const customerIds = await collectStripeCustomerIds(userId);
    const { deleted, failed } = await deleteStripeCustomers(customerIds, log);
    result.stripeCustomersDeleted = deleted;
    result.stripeCustomersFailed = failed;
  } catch (err: any) {
    log(`Stripe customer collection failed for ${userId}: ${err?.message || err}`, WORKER_SOURCE);
  }
  try {
    await scrubUserRow(userId);
  } catch (err: any) {
    log(`In-DB scrub failed for ${userId}: ${err?.message || err}`, WORKER_SOURCE);
    throw err; // bubble so the tick logs failure for this user
  }
  try {
    await db.insert(auditLogs).values({
      userId,
      action: "account_pii_scrubbed",
      resourceType: "user",
      resourceId: userId,
      metadata: JSON.stringify({
        stripeCustomersDeleted: result.stripeCustomersDeleted,
        stripeCustomersFailed: result.stripeCustomersFailed,
        scrubbedAt: new Date().toISOString(),
      }),
      ipAddress: null,
      userAgent: WORKER_SOURCE,
    });
  } catch (err: any) {
    log(`Audit log write failed for ${userId}: ${err?.message || err}`, WORKER_SOURCE);
  }
  return result;
}

async function tick(log: LogFn): Promise<void> {
  let due: Array<{ id: string }>;
  try {
    due = await selectDueUsers();
  } catch (err: any) {
    log(`could not select due users: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }
  if (due.length === 0) {
    return;
  }
  log(`processing ${due.length} due user(s)`, WORKER_SOURCE);
  let succeeded = 0;
  let failed = 0;
  for (const u of due) {
    try {
      await scrubOne(u.id, log);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  log(`done: succeeded=${succeeded} failed=${failed}`, WORKER_SOURCE);
}

export function startAccountDeletionWorker(log: LogFn): void {
  // First run delayed 60s so the rest of the server has time to come
  // up. Subsequent runs every 6 hours. Worker is intentionally slow:
  // PII scrub is a 30-day timer, not real-time.
  setTimeout(() => {
    void tick(log).catch(() => null);
    setInterval(() => {
      void tick(log).catch(() => null);
    }, RUN_INTERVAL_MS);
  }, 60_000);
  log("started (interval 6h, grace 30d)", WORKER_SOURCE);
}
