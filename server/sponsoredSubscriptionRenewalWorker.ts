// Sponsored-subscription renewal reminder worker (Prong B of pricing-v3
// conversion follow-on).
//
// Per project_gifter_sponsors_plus_subscription.md (locked 2026-05-23,
// renewal worker shipped 2026-05-23 as part of MVP polish pass).
//
// When a sponsored Plus/Family subscription is ~30 days from expiry,
// email the parent with a warm soft-conversion nudge:
//   "Your Plus from Grandma expires {date}. Renew for $29/yr to keep
//    it going. {Grandma}'s card won't be charged."
//
// Importantly: the gifter is NEVER re-charged. This worker emails the
// PARENT only. The whole point of the locked architecture is to
// prevent dark-pattern auto-charges to a one-time gifter.
//
// Idempotency: writes a `sponsor_renewal_reminder_sent` activity row
// after each successful send and checks for its presence on each
// subsequent tick. Activity-based dedup avoids needing a new
// timestamp column on sponsored_subscriptions and matches the
// sealedLetterDeliveryWorker pattern (commit cb37822).
//
// Tone: gentle reminder, not transactional. Names the gifter explicitly
// so the parent feels the relationship signal alongside the renewal
// nudge. Per the locked diplomatic framing discipline in pricing-v3.

import { pool } from "./db";
import { renderKiddoEmail } from "./templates/baseTemplate";
import { sendEmail } from "./emailDelivery";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "sponsored-subscription-renewal-worker";

let workerRunning = false;

function getBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "https://kiddofund.com";
}

// Query active sponsored subs whose expires_at is 25-35 days out AND
// for which no sponsor_renewal_reminder_sent activity exists yet.
// Wide-ish window so a missed-tick scenario doesn't drop the reminder
// entirely (worker runs daily; even if it skips for a day or two the
// 11-day window catches the row on the next pass).
//
// LIMIT 100 per pass bounds the worst case (sponsored sub volume is
// expected to be very low — handful per launch, scaling with the gift
// loop). The bounded LIMIT is defense against misconfiguration.
async function loadDueSubscriptions(): Promise<Array<{
  id: string;
  fundId: string;
  fundUserId: string;
  childName: string;
  parentEmail: string;
  parentFirstName: string | null;
  sponsorName: string | null;
  sponsorEmail: string;
  tier: string;
  expiresAt: Date;
}>> {
  const result = await pool.query<{
    id: string;
    fund_id: string;
    fund_user_id: string;
    child_name: string | null;
    parent_email: string;
    parent_first_name: string | null;
    sponsor_name: string | null;
    sponsor_email: string;
    tier: string;
    expires_at: Date;
  }>(`
    SELECT
      ss.id,
      ss.fund_id,
      f.user_id AS fund_user_id,
      f.recipient_first_name AS child_name,
      u.email AS parent_email,
      u.first_name AS parent_first_name,
      ss.sponsor_name,
      ss.sponsor_email,
      ss.tier,
      ss.expires_at
    FROM sponsored_subscriptions ss
    JOIN funds f ON f.id = ss.fund_id
    JOIN users u ON u.id = f.user_id
    WHERE ss.status = 'active'
      AND ss.expires_at BETWEEN (NOW() + INTERVAL '25 days') AND (NOW() + INTERVAL '35 days')
      AND u.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM activities a
        WHERE a.fund_id = ss.fund_id
          AND a.type = 'sponsor_renewal_reminder_sent'
          AND a.metadata LIKE '%' || ss.id || '%'
      )
    LIMIT 100
  `);
  return result.rows.map((r) => ({
    id: r.id,
    fundId: r.fund_id,
    fundUserId: r.fund_user_id,
    childName: String(r.child_name || "your kid"),
    parentEmail: r.parent_email,
    parentFirstName: r.parent_first_name,
    sponsorName: r.sponsor_name,
    sponsorEmail: r.sponsor_email,
    tier: r.tier,
    expiresAt: r.expires_at,
  }));
}

async function sendRenewalReminder(
  sub: Awaited<ReturnType<typeof loadDueSubscriptions>>[0],
  log: LogFn,
): Promise<boolean> {
  const tierLabel = sub.tier === "family" ? "Family" : "Plus";
  const tierPrice = sub.tier === "family" ? "$59/yr" : "$29/yr";
  const sponsorDisplay = sub.sponsorName ? sub.sponsorName.split(/\s+/)[0] : "your sponsor";
  const expiresLabel = sub.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const daysOut = Math.max(0, Math.round((sub.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const parentFirst = sub.parentFirstName ? String(sub.parentFirstName).trim() : "";
  const baseUrl = getBaseUrl();
  const upgradePath = `/account?tab=plan&upgrade=${sub.tier === "family" ? "family" : "starter"}&fundId=${encodeURIComponent(sub.fundId)}`;

  const subject = `${tierLabel} on ${sub.childName}'s fund expires ${expiresLabel}`;
  const intro = [
    parentFirst ? `Hi ${parentFirst},` : `Hi,`,
    "",
    `${sponsorDisplay}'s sponsored ${tierLabel} on ${sub.childName}'s fund expires on ${expiresLabel} (${daysOut} ${daysOut === 1 ? "day" : "days"} from today).`,
    "",
    `If you want to keep ${tierLabel} going — recurring contributions for everyone, custom fund mix, photo and voice memos in the Memory Book, co-parent access — you can take over the bill at ${tierPrice}. ${sub.sponsorName ? sub.sponsorName.split(/\s+/)[0] : "Your sponsor"}'s card won't be charged again; this is your decision.`,
    "",
    `If you do nothing, ${tierLabel} will end on ${expiresLabel} and the fund returns to Free. Existing recurring contributions and Memory Book entries stay either way; only the ability to set NEW recurring contributions pauses until you reactivate.`,
  ].join("\n");

  try {
    const { html } = renderKiddoEmail({
      heading: subject,
      intro,
      cta: { text: `Keep ${tierLabel} going for ${tierPrice}`, url: `${baseUrl}${upgradePath}` },
    });
    await sendEmail({
      to: sub.parentEmail,
      subject,
      text: intro,
      html,
      tags: ["sponsor_renewal_reminder"],
      metadata: { fundId: sub.fundId, sponsoredSubId: sub.id, expiresAt: sub.expiresAt.toISOString() },
    });
  } catch (emailErr) {
    log(`sub ${sub.id} renewal email send failed: ${String(emailErr)}`, WORKER_SOURCE);
    return false;
  }

  // Stamp the activity row for idempotency dedup. Sponsored sub ID
  // is in the metadata so the NOT EXISTS LIKE check above matches.
  // Also gives the parent a dashboard record of the reminder beat.
  try {
    const { db } = await import("./db");
    const { activities } = await import("@shared/schema");
    await db.insert(activities).values({
      userId: sub.fundUserId,
      fundId: sub.fundId,
      type: "sponsor_renewal_reminder_sent",
      title: `${tierLabel} renewal reminder sent`,
      description: `Reminded you that ${sub.sponsorName || "your sponsor"}'s sponsored ${tierLabel} on ${sub.childName}'s fund expires ${expiresLabel}.`,
      metadata: JSON.stringify({ sponsoredSubId: sub.id, expiresAt: sub.expiresAt.toISOString() }),
    } as any);
  } catch (activityErr) {
    log(`sub ${sub.id} activity stamp failed (non-fatal): ${String(activityErr)}`, WORKER_SOURCE);
  }

  log(`sent renewal reminder for sponsored sub ${sub.id} (fund ${sub.fundId}, expires ${sub.expiresAt.toISOString()})`, WORKER_SOURCE);
  return true;
}

export async function runSponsoredSubscriptionRenewalWorker(log: LogFn = () => undefined): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const due = await loadDueSubscriptions();
    if (due.length === 0) return;
    let sent = 0;
    for (const sub of due) {
      try {
        if (await sendRenewalReminder(sub, log)) sent++;
      } catch (err) {
        log(`sub ${sub.id} processing failed: ${String(err)}`, WORKER_SOURCE);
      }
    }
    if (sent > 0) {
      log(`processed ${due.length} due sponsored subs; sent ${sent} renewal reminders`, WORKER_SOURCE);
    }
  } catch (err) {
    log(`worker pass failed: ${String(err)}`, WORKER_SOURCE);
  } finally {
    workerRunning = false;
  }
}

export function startSponsoredSubscriptionRenewalWorker(log: LogFn = () => undefined): void {
  // Daily cadence is the right granularity — expires_at is date-level,
  // so once-per-day is fine. The 25-35 day window means a missed tick
  // doesn't drop the reminder entirely (11-day grace).
  const intervalMs = Math.max(
    Number(process.env.SPONSORED_SUB_WORKER_INTERVAL_MS || 24 * 60 * 60 * 1000),
    60 * 60 * 1000,
  );
  void runSponsoredSubscriptionRenewalWorker(log);
  const interval = setInterval(() => {
    void runSponsoredSubscriptionRenewalWorker(log);
  }, intervalMs);
  interval.unref?.();
  log(`sponsored subscription renewal worker started (every ${Math.round(intervalMs / 60000)} min)`, WORKER_SOURCE);
}
