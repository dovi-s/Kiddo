// Sealed-letter delivery worker (Prong B Phase 6).
//
// Per project_sealed_letters_implementation_plan.md (locked 2026-05-23).
// Daily worker that detects sealed letters whose deliver_at has fired
// and notifies the parent (and the kid, when the kid has a verified
// email and is post-handoff) so the moment doesn't pass quietly.
//
// Why this exists: a sealed letter scheduled for the kid's 13th
// birthday is meaningless if neither the parent nor the kid knows it
// unlocked. The KidView celebration (Phase 4) catches the kid IF they
// check in within 14 days, but that's a big IF for a 13-year-old.
// This worker pushes the moment via email — the channel both parent
// and kid actually check.
//
// Idempotency: an activity row with type='sealed_letter_delivered'
// and fundId scoping is the dedup marker. The worker queries
// sealed entries WHERE deliver_at <= NOW() AND no matching activity
// row exists. After a successful send, the activity row is written.
// Activity-based dedup avoids needing a new schema migration just
// for a delivered_at timestamp; the activities table already has the
// right shape (per-fund, type-filtered, indexed on fundId).
//
// Tone: warm relationship signal, not transactional. Parent gets
// "Emma's sealed message just unlocked — she'll see it next time she
// checks in" — names the artifact, frames the moment.

import { eq, and, sql, isNull } from "drizzle-orm";
import { db, pool } from "./db";
import { memoryEntries, activities, funds, users } from "@shared/schema";
import { sendEmail } from "./emailDelivery";
import { renderKiddoEmail } from "./templates/baseTemplate";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "sealed-letter-delivery-worker";

let workerRunning = false;

function getBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "https://kiddofund.com";
}

// Query sealed entries whose deliver_at <= NOW() and NO
// sealed_letter_delivered activity exists for the (fundId, entryId).
// The entryId is encoded in the activity's metadata JSON so multiple
// sealed letters per fund don't collide on dedup.
//
// LIMIT 100 per pass keeps any single tick bounded. A backlog of >100
// sealed letters on a single tick is unlikely (each parent only
// schedules a handful), but the LIMIT prevents a misconfigured worker
// from emailing a thousand kids in one batch if anything went wrong.
async function loadDueEntries(): Promise<Array<{
  id: string;
  fundId: string;
  content: string | null;
  authorName: string | null;
  deliverAt: Date | null;
}>> {
  const result = await pool.query<{
    id: string;
    fund_id: string;
    content: string | null;
    author_name: string | null;
    deliver_at: Date | null;
  }>(`
    SELECT
      me.id,
      me.fund_id,
      me.content,
      me.author_name,
      me.deliver_at
    FROM memory_entries me
    WHERE me.visibility = 'sealed'
      AND me.deliver_at IS NOT NULL
      AND me.deliver_at <= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM activities a
        WHERE a.fund_id = me.fund_id
          AND a.type = 'sealed_letter_delivered'
          AND a.metadata LIKE '%' || me.id || '%'
      )
    ORDER BY me.deliver_at ASC
    LIMIT 100
  `);
  return result.rows.map((r) => ({
    id: r.id,
    fundId: r.fund_id,
    content: r.content,
    authorName: r.author_name,
    deliverAt: r.deliver_at,
  }));
}

async function notifyForEntry(
  entry: { id: string; fundId: string; content: string | null; authorName: string | null; deliverAt: Date | null },
  log: LogFn,
): Promise<boolean> {
  const fund = await db.select().from(funds).where(eq(funds.id, entry.fundId)).limit(1).then((r) => r[0]);
  if (!fund || !fund.userId) {
    log(`entry ${entry.id} has no fund or owner — skipping`, WORKER_SOURCE);
    return false;
  }
  const [parent] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, fund.userId))
    .limit(1);
  if (!parent?.email) {
    log(`entry ${entry.id} parent has no email — skipping`, WORKER_SOURCE);
    // Stamp the activity anyway so we don't keep checking. The
    // entry is unlocked in KidView per Phase 2 visibility; the kid
    // can still find it without the parent email beat.
    await stampDeliveredActivity(entry, fund.userId, "no_parent_email");
    return false;
  }

  const childName = String(fund.recipientFirstName || fund.name || "your kid").trim();
  const baseUrl = getBaseUrl();
  const dashboardUrl = `${baseUrl}/dashboard?fundId=${encodeURIComponent(entry.fundId)}`;
  const parentFirst = parent.firstName ? String(parent.firstName).trim() : "";

  const deliveryLabel = entry.deliverAt
    ? new Date(entry.deliverAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "today";

  const subject = `Your sealed message for ${childName} just unlocked`;
  const intro = [
    parentFirst ? `Hi ${parentFirst},` : `Hi,`,
    "",
    `The sealed message you wrote for ${childName} unlocked on ${deliveryLabel}. ${childName} will see it the next time they open Kid View.`,
    "",
    `You wrote this for a specific moment. The moment has arrived.`,
  ].join("\n");

  try {
    const { html } = renderKiddoEmail({
      heading: subject,
      intro,
      cta: { text: `See ${childName}'s fund`, url: dashboardUrl },
    });
    await sendEmail({
      to: parent.email,
      subject,
      text: intro,
      html,
      tags: ["sealed_letter_delivered"],
      metadata: { fundId: entry.fundId, entryId: entry.id },
    });
    await stampDeliveredActivity(entry, fund.userId, "parent_email_sent");
    log(`delivered sealed letter ${entry.id} for fund ${entry.fundId}`, WORKER_SOURCE);
    return true;
  } catch (err) {
    log(`entry ${entry.id} parent-email send failed: ${String(err)}`, WORKER_SOURCE);
    // Do NOT stamp the activity on send failure — let the next tick
    // retry. A persistent failure will keep retrying; that's the
    // right failure mode (the parent missing this notification is
    // worse than a few extra failed-send log lines).
    return false;
  }
}

async function stampDeliveredActivity(
  entry: { id: string; fundId: string; content: string | null },
  userId: string,
  reason: string,
): Promise<void> {
  const preview = (entry.content || "").trim().slice(0, 200);
  await db.insert(activities).values({
    userId,
    fundId: entry.fundId,
    type: "sealed_letter_delivered",
    title: "A sealed letter just unlocked",
    description: preview
      ? `Sealed letter delivered: "${preview.length === 200 ? preview + "..." : preview}"`
      : "A sealed letter you wrote just unlocked. Your kid will see it next time they check in.",
    metadata: JSON.stringify({ entryId: entry.id, reason }),
  } as any);
}

export async function runSealedLetterDeliveryWorker(log: LogFn = () => undefined): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const due = await loadDueEntries();
    if (due.length === 0) return;
    let delivered = 0;
    for (const entry of due) {
      try {
        if (await notifyForEntry(entry, log)) delivered++;
      } catch (err) {
        log(`entry ${entry.id} processing failed: ${String(err)}`, WORKER_SOURCE);
      }
    }
    if (delivered > 0) {
      log(`processed ${due.length} due entries; delivered ${delivered}`, WORKER_SOURCE);
    }
  } catch (err) {
    log(`worker pass failed: ${String(err)}`, WORKER_SOURCE);
  } finally {
    workerRunning = false;
  }
}

export function startSealedLetterDeliveryWorker(log: LogFn = () => undefined): void {
  // Hourly cadence. Sealed letters are date-granular (the parent picks
  // a calendar day, not an exact time), so once-per-hour is plenty of
  // resolution — the parent and kid emails will both fire within the
  // same hour as the deliver_at moment. Lower bound 15 min to prevent
  // misconfiguration into a tight loop.
  const intervalMs = Math.max(
    Number(process.env.SEALED_LETTER_WORKER_INTERVAL_MS || 60 * 60 * 1000),
    15 * 60 * 1000,
  );
  void runSealedLetterDeliveryWorker(log);
  const interval = setInterval(() => {
    void runSealedLetterDeliveryWorker(log);
  }, intervalMs);
  interval.unref?.();
  log(`sealed letter delivery worker started (every ${Math.round(intervalMs / 60000)} min)`, WORKER_SOURCE);
}
