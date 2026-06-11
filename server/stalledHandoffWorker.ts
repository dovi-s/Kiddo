// Stalled-handoff worker. Catches the failure path where a kid has
// been invited to claim their fund at majority age but hasn't done
// so within a reasonable window.
//
// Three escalation steps, each fires exactly once per fund per
// stalled cycle:
//
//   T+7   Gentle reminder to the kid (resend the invite). Heads-up
//         to the parent that the kid hasn't claimed yet. Most
//         common cause is the kid forgot or marked the email as
//         spam; a second send usually clears it.
//
//   T+30  Stronger escalation. To the kid: "Your fund is waiting,
//         here's how to claim it." To the parent: "We still can't
//         reach Emma; would you check in with her?" If the parent
//         has a trusted contact on file, this email mentions the
//         trusted contact as a future escalation step.
//
//   T+90  Action-item surfaced on the parent dashboard (handled
//         via the existing action-items system; this worker doesn't
//         own that surface). The trusted contact (if any) gets the
//         stalled-handoff template email at server/templates/
//         trustedContact.ts.
//
// Beyond T+90, no further automatic action. The fund sits in
// stalled-handoff state indefinitely. Per the locked discipline in
// AGE_18_HANDOFF_SPEC.md failure-paths section: Kiddo does NOT
// liquidate kid funds at majority just because the kid is
// unreachable. UTMA ownership is bedrock and separate from
// operational convenience. The asset belongs to the kid.
//
// Worker runs every 12 hours. Stalled-handoff is a slow timer; we
// don't need real-time precision.

import { db, pool } from "./db";
import { sql, eq, and, isNotNull, isNull } from "drizzle-orm";
import { ageTransitions, funds, users } from "@shared/schema";
import { sendEmail } from "./emailDelivery";
import { renderStalledHandoffEmail } from "./templates/trustedContact";
import { renderKiddoEmail } from "./templates/baseTemplate";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "stalled-handoff-worker";
const RUN_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Escalation thresholds. Each in milliseconds since the invitedAt
// timestamp. The worker fires the matching email only if (a) the
// threshold has passed AND (b) the matching stalled* timestamp on
// the age_transitions row hasn't been stamped yet.
const T7_MS = 7 * 24 * 60 * 60 * 1000;
const T30_MS = 30 * 24 * 60 * 60 * 1000;
const T90_MS = 90 * 24 * 60 * 60 * 1000;

function getBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "https://kiddofund.com";
}

function getSupportUrl(): string {
  return `${getBaseUrl()}/support`;
}

function getFromAddress(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.SUPPORT_EMAIL ||
    "support@kiddofund.com"
  );
}

// Stalled-row shape. Joined across age_transitions + funds + users
// so each escalation has everything it needs in one row.
type StalledRow = {
  fundId: string;
  invitedAt: Date | null;
  childClaimedAt: Date | null;
  inviteToken: string | null;
  childEmail: string | null;
  stalledHandoffT7At: Date | null;
  stalledHandoffT30At: Date | null;
  stalledHandoffT90At: Date | null;
  // Fund details
  recipientFirstName: string | null;
  fundName: string | null;
  // Custodian details (current parent on the fund)
  parentUserId: string;
  parentEmail: string | null;
  parentFirstName: string | null;
  parentLastName: string | null;
  // Trusted contact (parent's account-level field)
  trustedContactName: string | null;
  trustedContactEmail: string | null;
  // Successor (fund-level; might not exist as nullable column)
  successorName: string | null;
};

async function getStalledRows(log: LogFn): Promise<StalledRow[]> {
  // Pull every fund where:
  //   - An invite has gone out (invitedAt IS NOT NULL)
  //   - The kid hasn't claimed (childClaimedAt IS NULL)
  //   - Ownership hasn't already been transferred manually
  //   - At least T+7 has elapsed (cheapest lower bound; we do
  //     per-step checks inside the worker loop)
  //
  // Defensive: the trusted_contact_* and successor_* columns may
  // be missing on legacy databases that haven't run db:push yet.
  // COALESCE-via-LEFT-JOIN-style with a try/catch fallback.
  try {
    const result = await pool.query<StalledRow>(`
      SELECT
        at.fund_id              AS "fundId",
        at.invited_at           AS "invitedAt",
        at.child_claimed_at     AS "childClaimedAt",
        at.invite_token         AS "inviteToken",
        at.child_email          AS "childEmail",
        at.stalled_handoff_t7_at  AS "stalledHandoffT7At",
        at.stalled_handoff_t30_at AS "stalledHandoffT30At",
        at.stalled_handoff_t90_at AS "stalledHandoffT90At",
        f.recipient_first_name  AS "recipientFirstName",
        f.name                  AS "fundName",
        f.successor_name        AS "successorName",
        u.id                    AS "parentUserId",
        u.email                 AS "parentEmail",
        u.first_name            AS "parentFirstName",
        u.last_name             AS "parentLastName",
        u.trusted_contact_name  AS "trustedContactName",
        u.trusted_contact_email AS "trustedContactEmail"
      FROM age_transitions at
      JOIN funds f ON f.id = at.fund_id
      JOIN users u ON u.id = f.user_id
      WHERE at.invited_at IS NOT NULL
        AND f.memorialized_at IS NULL -- bereavement freeze (BEREAVEMENT_POSTURE.md)
        AND at.child_claimed_at IS NULL
        AND at.ownership_transferred_at IS NULL
        AND at.invited_at <= NOW() - INTERVAL '7 days'
        -- Demo-safety: never fire stalled-handoff emails for demo funds.
        AND COALESCE(u.is_demo_account, false) = false
      ORDER BY at.invited_at ASC
      LIMIT 500
    `);
    return result.rows;
  } catch (err: any) {
    // Most likely cause: columns added in this commit haven't been
    // pushed to the DB yet (pre-db:push). Worker degrades to "no
    // stalled rows" and logs once per run; safe no-op behavior.
    log(
      `query failed (probably missing stalled_handoff_* columns; run db:push): ${String(err?.message || err)}`,
      WORKER_SOURCE,
    );
    return [];
  }
}

// Email to the kid: gentle resend of the invite. Reused for T+7
// and T+30 with slightly different subjects + body intros so the
// second one reads as a follow-up rather than a duplicate.
async function emailKid(
  row: StalledRow,
  step: "t7" | "t30",
  log: LogFn,
): Promise<boolean> {
  if (!row.childEmail || !row.inviteToken) return false;
  const childName = row.recipientFirstName || "you";
  const claimUrl = `${getBaseUrl()}/transition/${row.inviteToken}`;
  const subject = step === "t7"
    ? `Your fund is still waiting, ${childName}`
    : `One more nudge: your fund is ready to claim`;
  const intro = step === "t7"
    ? `A week ago we sent you a link to claim your investing fund. The link is still good. Whenever you're ready, tap below.`
    : `Just checking back in. Your investing fund has been waiting a month. The claim link is still active and the money is still yours.`;
  const introBody = [
    `Hi ${childName},`,
    ``,
    intro,
    ``,
    `Nothing is at risk and nothing has changed. We're holding everything exactly as it was. Whenever you have ten minutes, the link below walks you through claiming the account.`,
    ``,
    `If you have any questions or the link doesn't work, just reply to this email.`,
  ].join("\n");
  const { html: branded } = renderKiddoEmail({
    heading: step === "t7" ? "Your fund is still waiting" : "One more nudge",
    intro: introBody,
    cta: { text: "Claim your fund", url: claimUrl },
  });
  await sendEmail({
    to: row.childEmail,
    subject,
    text: [
      `Hi ${childName},`,
      "",
      intro,
      claimUrl,
      "",
      `Nothing is at risk and nothing has changed. We're holding everything exactly as it was. Whenever you have ten minutes, the link above walks you through claiming the account.`,
      "",
      `If you have any questions or the link doesn't work, just reply to this email.`,
      "",
      `— The Kiddo team`,
    ].join("\n"),
    html: branded,
    tags: [`stalled_handoff_kid_${step}`],
    metadata: { fundId: row.fundId, step },
  });
  log(`stalled ${step} email sent to kid for fund ${row.fundId}`, WORKER_SOURCE);
  return true;
}

// Email to the parent: heads-up that the kid hasn't claimed.
async function emailParent(
  row: StalledRow,
  step: "t7" | "t30",
  log: LogFn,
): Promise<boolean> {
  if (!row.parentEmail) return false;
  const childName = row.recipientFirstName || "your child";
  const parentFirst = row.parentFirstName || "there";
  const trustedNote = row.trustedContactName && step === "t30"
    ? `\nIf we still can't reach ${childName} after another two months, we'll reach out once to your trusted contact (${row.trustedContactName}) to help us close the loop. They won't be given any authority over the account; they're a confirmation channel only.\n`
    : "";
  const subject = step === "t7"
    ? `${childName} hasn't claimed their fund yet`
    : `${childName} still hasn't claimed their fund`;
  const intro = step === "t7"
    ? `It's been a week since we emailed ${childName} the link to claim their investing fund. They haven't opened it yet.`
    : `${childName} still hasn't claimed their fund. It's been a month since the invite went out.`;
  const baseUrl = getBaseUrl();
  const parentIntroBody = [
    `Hi ${parentFirst},`,
    ``,
    intro,
    ``,
    `Everything is fine on our end. The money is safe, nothing has been sold, and the claim link still works. Most kids just need a small nudge from a parent to actually do the thing.${trustedNote}`,
    ``,
    `If their email address is wrong or has changed, you can update it from the Age-18 Plan page on Kiddo.`,
  ].join("\n");
  const { html: parentBranded } = renderKiddoEmail({
    heading: subject,
    intro: parentIntroBody,
    cta: { text: "Open Age-18 Plan", url: `${baseUrl}/age-18-plan` },
  });
  await sendEmail({
    to: row.parentEmail,
    subject,
    text: [
      `Hi ${parentFirst},`,
      "",
      intro,
      "",
      `Everything is fine on our end. The money is safe, nothing has been sold, and the claim link still works. Most kids just need a small nudge from a parent to actually do the thing.${trustedNote}`,
      "",
      `If their email address is wrong or has changed, you can update it from the Age-18 Plan page on Kiddo.`,
      "",
      `— The Kiddo team`,
    ].join("\n"),
    html: parentBranded,
    tags: [`stalled_handoff_parent_${step}`],
    metadata: { fundId: row.fundId, step },
  });
  log(`stalled ${step} email sent to parent for fund ${row.fundId}`, WORKER_SOURCE);
  return true;
}

// T+90: trusted contact gets one email. No further follow-ups.
async function emailTrustedContact(row: StalledRow, log: LogFn): Promise<boolean> {
  if (!row.trustedContactEmail || !row.trustedContactName) return false;
  if (!row.invitedAt) return false;
  const daysStalled = Math.floor(
    (Date.now() - new Date(row.invitedAt).getTime()) / (24 * 60 * 60 * 1000),
  );
  const parentDisplayName =
    [row.parentFirstName, row.parentLastName].filter(Boolean).join(" ").trim() ||
    row.parentEmail ||
    "The account holder";
  const childFirst = row.recipientFirstName || row.fundName || "their child";

  // Best-effort: the schema includes `majorityAge` per fund per state
  // UTMA law. We don't have it on this row to keep the query lean.
  // Default to 18 in the copy; the email is general enough that this
  // doesn't materially mislead.
  const childMajorityAge = 18;

  const { subject, text, html } = renderStalledHandoffEmail({
    trustedContactName: row.trustedContactName,
    parentDisplayName,
    childFirstName: childFirst,
    childMajorityAge,
    daysStalled,
    successorContactName: row.successorName,
    fromAddress: getFromAddress(),
    supportUrl: getSupportUrl(),
  });

  await sendEmail({
    to: row.trustedContactEmail,
    subject,
    text,
    html,
    tags: ["stalled_handoff_trusted_t90"],
    metadata: { fundId: row.fundId, parentUserId: row.parentUserId },
  });
  log(`stalled T+90 email sent to trusted contact for fund ${row.fundId}`, WORKER_SOURCE);
  return true;
}

async function stampSentAt(fundId: string, column: "t7" | "t30" | "t90", log: LogFn): Promise<void> {
  const columnName =
    column === "t7"
      ? "stalled_handoff_t7_at"
      : column === "t30"
        ? "stalled_handoff_t30_at"
        : "stalled_handoff_t90_at";
  try {
    await pool.query(
      `UPDATE age_transitions SET ${columnName} = NOW(), updated_at = NOW() WHERE fund_id = $1`,
      [fundId],
    );
  } catch (err: any) {
    log(`stamp ${column} failed for fund ${fundId}: ${String(err?.message || err)}`, WORKER_SOURCE);
  }
}

async function processRow(row: StalledRow, log: LogFn): Promise<void> {
  if (!row.invitedAt) return;
  const ageMs = Date.now() - new Date(row.invitedAt).getTime();

  // T+90 trusted-contact escalation. Check this FIRST so we don't
  // double-fire a T+30 then T+90 in the same tick on a long-stalled
  // fund. Each step is idempotent via the stamped timestamp.
  //
  // 2026-05-15 fix: previously stamped t90 unconditionally even on
  // sendEmail throw. A trusted contact with a real email address who
  // happened to be unreachable during a Postmark / SendGrid outage
  // got marked "processed" with no retry mechanism. The kid stayed
  // stalled, the parent had no visibility, and the trusted contact
  // never received the email.
  //
  // New behavior distinguishes the two failure modes:
  //   • emailTrustedContact returns false → permanent state (no
  //     contact on file). Stamp t90 so the worker doesn't re-check
  //     every 12 hours forever. Log a notice for ops follow-up.
  //   • emailTrustedContact throws → transient ESP failure. Do NOT
  //     stamp t90. Next 12-hour tick will retry.
  if (ageMs >= T90_MS && !row.stalledHandoffT90At) {
    try {
      const sent = await emailTrustedContact(row, log);
      // Successful call either email landed (sent=true) or there's
      // no trusted contact to email (sent=false). Both are permanent
      // states; stamp so we don't re-check.
      await stampSentAt(row.fundId, "t90", log);
      if (!sent && !row.trustedContactEmail) {
        log(
          `fund ${row.fundId} reached T+90 with no trusted contact on file; consider surfacing action item`,
          WORKER_SOURCE,
        );
      }
    } catch (err: any) {
      // Transient failure. Don't stamp next tick retries.
      log(
        `T+90 trusted contact email failed for fund ${row.fundId} (will retry next tick): ${String(err?.message || err)}`,
        WORKER_SOURCE,
      );
    }
  }

  // T+30 escalation. Fires kid + parent emails. Mentions the
  // trusted contact in the parent email if one is set.
  if (ageMs >= T30_MS && !row.stalledHandoffT30At) {
    try {
      await emailKid(row, "t30", log);
    } catch (err: any) {
      log(`T+30 kid email failed for fund ${row.fundId}: ${String(err?.message || err)}`, WORKER_SOURCE);
    }
    try {
      await emailParent(row, "t30", log);
    } catch (err: any) {
      log(`T+30 parent email failed for fund ${row.fundId}: ${String(err?.message || err)}`, WORKER_SOURCE);
    }
    await stampSentAt(row.fundId, "t30", log);
  }

  // T+7 gentle nudge. Fires kid + parent.
  if (ageMs >= T7_MS && !row.stalledHandoffT7At) {
    try {
      await emailKid(row, "t7", log);
    } catch (err: any) {
      log(`T+7 kid email failed for fund ${row.fundId}: ${String(err?.message || err)}`, WORKER_SOURCE);
    }
    try {
      await emailParent(row, "t7", log);
    } catch (err: any) {
      log(`T+7 parent email failed for fund ${row.fundId}: ${String(err?.message || err)}`, WORKER_SOURCE);
    }
    await stampSentAt(row.fundId, "t7", log);
  }
}

async function tick(log: LogFn): Promise<void> {
  let processed = 0;
  try {
    const rows = await getStalledRows(log);
    for (const row of rows) {
      try {
        await processRow(row, log);
        processed += 1;
      } catch (err: any) {
        log(
          `unhandled error for fund ${row.fundId}: ${String(err?.message || err)}`,
          WORKER_SOURCE,
        );
      }
    }
  } catch (err: any) {
    log(`tick failed: ${String(err?.message || err)}`, WORKER_SOURCE);
  }
  if (processed > 0) {
    log(`processed ${processed} stalled-handoff row(s)`, WORKER_SOURCE);
  }
}

export function startStalledHandoffWorker(log: LogFn): void {
  // First run delayed 60s so the rest of the server has time to come
  // up. Subsequent runs every 12 hours. Worker is intentionally slow:
  // stalled-handoff is a multi-week timer, not a real-time signal.
  setTimeout(() => {
    void tick(log).catch(() => null);
    setInterval(() => {
      void tick(log).catch(() => null);
    }, RUN_INTERVAL_MS);
  }, 60_000);
  log("started (interval 12h)", WORKER_SOURCE);
}
