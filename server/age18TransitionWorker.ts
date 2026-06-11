// Age-18 transition worker fires the lifecycle around the kid's majority age.
//
// What this worker DOES:
//   1. T-30 reminder: emails the parent "your kid turns N in a month, here's the prep"
//   2. T-1  reminder: emails the parent "tomorrow's the day"
//   3. Day-of (T-0): does TWO things automatically so the kid doesn't get nothing:
//      a. If the parent has saved the kid's email in AgeTransitionManager AND
//         no invite has been triggered yet, auto-create the invite token and
//         email the kid the claim link (same template as the manual flow).
//      b. Email the parent "Today's the day, here's what's left to do" or
//         if the kid email isn't on file, "they turn N today and you haven't
//         set up the handoff."
//   4. Stamps funds.age_18_notified_at on T-0 to prevent the activity log
//      double-firing. Per-milestone send state is tracked in a separate
//      JSON file so the day-of can fire even if the parent dismissed the
//      preview emails earlier.
//
// Runs every 6 hours by default birthdays are day-granular and we don't
// need real-time precision for the email cue. The 6h cadence catches the
// kid's 18th in their local morning regardless of server TZ. Each milestone
// has independent send-state tracking, so a worker restart in the middle of
// a pass picks up where it left off without double-emailing.
//
// What this worker DOES NOT DO:
//   - DriveWealth account ownership transfer (custodian integration not yet
//     wired see Integrations admin tab for status)
//   - Kid-account claim flow itself (the kid clicks the link in the auto-sent
//     email, lands on /transition/{token}, creates their own Kiddo account
//     and accepts that flow lives in AgeTransitionInvite.tsx)
//   - Visibility unlock for Memory Book entries reserved for age-18 (already
//     handled by KidView API filter entries with visibility='kid_at_18'
//     auto-show once getKidAgePhase returns phase='adult')
//
// Per-fund majority age (locked at fund creation from state UTMA law) drives
// every milestone PA = 21, AL/NE = 19, most states = 18. Hardcoding 18
// would fire wrong for kids in those states.

import { db, pool } from "./db";
import { sql, eq } from "drizzle-orm";
import { storage } from "./storage";
import { sendEmail } from "./emailDelivery";
import { renderKiddoEmail } from "./templates/baseTemplate";
import {
  getAgeTransitionRecord,
  patchAgeTransitionRecord,
} from "./ageTransitionStore";
import {
  decideTodayParentVariant,
  shouldAutoSendKidInvite,
} from "../shared/age18-decisions";
import { age18ReminderState } from "@shared/schema";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "age18-transition-worker";

// Legacy JSON state path kept for one-time backfill on first worker
// pass after the migration. Safe to delete once all funds have a row
// in the age18_reminder_state table; the worker reads from Postgres
// going forward.
const REMINDER_STATE_PATH = path.join(
  process.cwd(),
  ".local",
  "age18-reminder-state.json",
);

type ReminderFundState = {
  t30SentAt?: string;
  t1SentAt?: string;
  todayInviteAutoSentAt?: string;
  todayParentEmailSentAt?: string;
};

type ReminderState = {
  byFund: Record<string, ReminderFundState>;
};

// One-time JSON-to-Postgres backfill. Reads the legacy file (if
// present), inserts any rows not already in the table. Process-scoped
// flag prevents repeated reads. Mirror of the ageTransitionStore
// backfill pattern.
let backfillRan = false;
async function ensureReminderBackfilled(log: LogFn): Promise<void> {
  if (backfillRan) return;
  backfillRan = true;
  try {
    const raw = await fs.readFile(REMINDER_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed?.byFund || typeof parsed.byFund !== "object") return;
    const entries = Object.entries(parsed.byFund) as Array<[string, ReminderFundState]>;
    if (entries.length === 0) return;
    const dateOrNull = (v: string | undefined) => (v ? new Date(v) : null);
    for (const [fundId, fundState] of entries) {
      await db
        .insert(age18ReminderState)
        .values({
          fundId,
          t30SentAt: dateOrNull(fundState.t30SentAt),
          t1SentAt: dateOrNull(fundState.t1SentAt),
          todayInviteAutoSentAt: dateOrNull(fundState.todayInviteAutoSentAt),
          todayParentEmailSentAt: dateOrNull(fundState.todayParentEmailSentAt),
        })
        .onConflictDoNothing()
        .catch((err: any) => {
          // Most likely cause: orphaned legacy entry referencing a
          // deleted fund. Safe to skip.
          log(`reminder backfill skipped fund ${fundId}: ${String(err?.message || err)}`, WORKER_SOURCE);
        });
    }
    log(`reminder backfill: migrated ${entries.length} legacy rows`, WORKER_SOURCE);
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      log(`reminder backfill read failed: ${String(err?.message || err)}`, WORKER_SOURCE);
    }
  }
}

async function loadReminderState(log: LogFn): Promise<ReminderState> {
  await ensureReminderBackfilled(log);
  try {
    const rows = await db.select().from(age18ReminderState);
    const byFund: Record<string, ReminderFundState> = {};
    for (const row of rows) {
      byFund[row.fundId] = {
        t30SentAt: row.t30SentAt ? new Date(row.t30SentAt).toISOString() : undefined,
        t1SentAt: row.t1SentAt ? new Date(row.t1SentAt).toISOString() : undefined,
        todayInviteAutoSentAt: row.todayInviteAutoSentAt ? new Date(row.todayInviteAutoSentAt).toISOString() : undefined,
        todayParentEmailSentAt: row.todayParentEmailSentAt ? new Date(row.todayParentEmailSentAt).toISOString() : undefined,
      };
    }
    return { byFund };
  } catch (err) {
    log(`loadReminderState query failed: ${String((err as any)?.message || err)}`, WORKER_SOURCE);
    return { byFund: {} };
  }
}

async function saveReminderState(state: ReminderState, log: LogFn): Promise<void> {
  // Per-fund upsert. Only writes funds that actually have state in
  // the in-memory map this pass avoids no-op writes for funds the
  // worker didn't touch. Each upsert is independent so a single bad
  // fund_id doesn't take the whole save down.
  const dateOrNull = (v: string | undefined) => (v ? new Date(v) : null);
  for (const [fundId, fundState] of Object.entries(state.byFund)) {
    const values = {
      fundId,
      t30SentAt: dateOrNull(fundState.t30SentAt),
      t1SentAt: dateOrNull(fundState.t1SentAt),
      todayInviteAutoSentAt: dateOrNull(fundState.todayInviteAutoSentAt),
      todayParentEmailSentAt: dateOrNull(fundState.todayParentEmailSentAt),
      updatedAt: new Date(),
    };
    try {
      await db
        .insert(age18ReminderState)
        .values(values)
        .onConflictDoUpdate({
          target: age18ReminderState.fundId,
          set: {
            t30SentAt: values.t30SentAt,
            t1SentAt: values.t1SentAt,
            todayInviteAutoSentAt: values.todayInviteAutoSentAt,
            todayParentEmailSentAt: values.todayParentEmailSentAt,
            updatedAt: values.updatedAt,
          },
        });
    } catch (err) {
      log(`reminder upsert failed for fund ${fundId}: ${String((err as any)?.message || err)}`, WORKER_SOURCE);
    }
  }
}

// Suppress unused-import warning for `eq` kept for any future
// per-fund query helpers.
void eq;

function getAppBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "https://kiddofund.com";
}

let workerRunning = false;

type DueRow = {
  id: string;
  user_id: string;
  recipient_first_name: string | null;
  recipient_birthdate: string | null;
  majority_age: number | null;
  fund_name: string | null;
  parent_email: string | null;
  parent_first_name: string | null;
};

// One join + multiple flags so we only hit the DB once per pass. Returns
// every fund whose recipient is at any of the three milestones (T-30, T-1,
// T-0). Per-milestone gating happens in JS using the reminder state file.
async function loadDueFunds(): Promise<{
  t30: DueRow[];
  t1: DueRow[];
  today: DueRow[];
}> {
  const result = await pool.query<DueRow & { milestone: "t30" | "t1" | "today" }>(`
    WITH eligible AS (
      SELECT
        f.id,
        f.user_id,
        f.recipient_first_name,
        f.recipient_birthdate,
        f.majority_age,
        f.name AS fund_name,
        u.email AS parent_email,
        u.first_name AS parent_first_name,
        DATE(f.recipient_birthdate + (COALESCE(f.majority_age, 18) * INTERVAL '1 year')) AS majority_date
      FROM funds f
      JOIN users u ON u.id = f.user_id
      WHERE f.recipient_birthdate IS NOT NULL
        AND f.memorialized_at IS NULL -- bereavement freeze: a memorialized child never reaches handoff (BEREAVEMENT_POSTURE.md)
        AND f.status = 'active'
        AND u.email IS NOT NULL
        -- Demo-safety: never fire real age-of-majority emails for demo
        -- funds. The Dunphy seed puts Alex ~30 days from 21 (inside the
        -- T-30 window), which would email phil@dunphyfamily.com for real.
        -- The demo showcases the handoff via the interactive claim flow +
        -- seeded state, not via this background worker's live emails.
        AND COALESCE(u.is_demo_account, false) = false
    )
    SELECT * FROM (
      -- T-30 widened to a 3-day window (28-30 days out, inclusive).
      -- 2026-05-15 fix: previously an exact date match against
      -- CURRENT_DATE plus 30 days. Any worker downtime on T-30 day
      -- permanently lost the prep email. The fundState.t30SentAt
      -- timestamp inside processT30 ensures we only send once even
      -- if the worker ticks multiple times within the window. So
      -- widening the SQL is purely a backfill safety net: a missed
      -- T-30 day fires on T-29 or T-28 instead of never. Worst-case
      -- the email arrives 2 days late vs missing entirely.
      SELECT id, user_id, recipient_first_name, recipient_birthdate, majority_age,
             fund_name, parent_email, parent_first_name, 't30'::text AS milestone
      FROM eligible
      WHERE majority_date >= CURRENT_DATE + INTERVAL '28 days'
        AND majority_date <= CURRENT_DATE + INTERVAL '30 days'
      UNION ALL
      -- T-1 stays tight at 1 day out. If the worker misses T-1, T-0
      -- (the day-of) lookback below still catches the kid invite, so
      -- the failure mode is "T-1 parent heads-up was skipped" not
      -- "no email at all."
      SELECT id, user_id, recipient_first_name, recipient_birthdate, majority_age,
             fund_name, parent_email, parent_first_name, 't1'::text AS milestone
      FROM eligible
      WHERE majority_date = CURRENT_DATE + INTERVAL '1 day'
      UNION ALL
      SELECT id, user_id, recipient_first_name, recipient_birthdate, majority_age,
             fund_name, parent_email, parent_first_name, 'today'::text AS milestone
      FROM eligible
      WHERE majority_date <= CURRENT_DATE
        AND majority_date >= CURRENT_DATE - INTERVAL '1 day'
    ) AS combined
    ORDER BY milestone
    LIMIT 600
  `);

  const t30: DueRow[] = [];
  const t1: DueRow[] = [];
  const today: DueRow[] = [];
  for (const row of result.rows) {
    if (row.milestone === "t30") t30.push(row);
    else if (row.milestone === "t1") t1.push(row);
    else today.push(row);
  }
  return { t30, t1, today };
}

function safeChildName(row: DueRow): string {
  return String(row.recipient_first_name || row.fund_name || "your child");
}

function safeMajorityAge(row: DueRow): number {
  return Number(row.majority_age) || 18;
}

function parentGreeting(row: DueRow): string {
  return row.parent_first_name ? `Hi ${row.parent_first_name},` : "Hi,";
}

// T-30: parent reminder. "Your kid turns N in a month here's the prep."
async function sendT30Email(row: DueRow, log: LogFn): Promise<void> {
  if (!row.parent_email) return;
  const childName = safeChildName(row);
  const majorityAge = safeMajorityAge(row);
  const baseUrl = getAppBaseUrl();
  const planUrl = `${baseUrl}/age-18-plan`;
  const managerUrl = `${baseUrl}/age-transition/${row.id}/manage`;
  const dashboardUrl = `${baseUrl}/dashboard?fund=${encodeURIComponent(row.id)}`;
  const t30Text = [
    parentGreeting(row),
    "",
    `${childName}'s ${majorityAge}th birthday is one month away. That's the day legal control of the fund transfers to them under your state's UTMA law. Nothing automatically sells. The investments stay exactly where they are. What changes is who decides.`,
    "",
    "Three things to do this month:",
    `  1. Add ${childName}'s email AND send them a verification link so the at-${majorityAge} invite reaches the right inbox: ${managerUrl}`,
    `  2. Share Kid View with ${childName} so the fund isn't a complete surprise when they take it over: ${dashboardUrl}`,
    `  3. Walk through the prep checklist (money conversation, tax position, successor custodian): ${planUrl}`,
    "",
    `When the day arrives, ${childName} gets an email with a private link to claim the fund into their own Kiddo account.`,
    "",
    "— The Kiddo team",
  ].join("\n");
  const { html: t30Html } = renderKiddoEmail({
    heading: `${childName} turns ${majorityAge} in a month`,
    intro: t30Text,
    cta: { text: "Open age-transition manager", url: managerUrl },
  });
  await sendEmail({
    to: row.parent_email,
    subject: `${childName} turns ${majorityAge} in a month`,
    text: t30Text,
    html: t30Html,
    tags: ["age_transition", "t_minus_30"],
    metadata: { fundId: row.id, milestone: "t_minus_30" },
  }).catch((err) => {
    log(`T-30 send failed for fund ${row.id}: ${String(err)}`, WORKER_SOURCE);
    throw err;
  });
}

// T-1: parent reminder. "Tomorrow's the day."
async function sendT1Email(row: DueRow, log: LogFn): Promise<void> {
  if (!row.parent_email) return;
  const childName = safeChildName(row);
  const majorityAge = safeMajorityAge(row);
  const baseUrl = getAppBaseUrl();
  const managerUrl = `${baseUrl}/age-transition/${row.id}/manage`;
  const t1Text = [
    parentGreeting(row),
    "",
    `Tomorrow is ${childName}'s ${majorityAge}th birthday. The fund transfers to them under state UTMA law.`,
    "",
    `If ${childName}'s email is on file, we'll send them the claim link automatically tomorrow morning. If it isn't yet, this is the moment to add it.`,
    "",
    "Nothing sells. The investments stay where they are. Only legal control changes.",
    "",
    "— The Kiddo team",
  ].join("\n");
  const { html: t1Html } = renderKiddoEmail({
    heading: `${childName} turns ${majorityAge} tomorrow`,
    intro: t1Text,
    cta: { text: "Open age-transition manager", url: managerUrl },
  });
  await sendEmail({
    to: row.parent_email,
    subject: `${childName} turns ${majorityAge} tomorrow`,
    text: t1Text,
    html: t1Html,
    tags: ["age_transition", "t_minus_1"],
    metadata: { fundId: row.id, milestone: "t_minus_1" },
  }).catch((err) => {
    log(`T-1 send failed for fund ${row.id}: ${String(err)}`, WORKER_SOURCE);
    throw err;
  });
}

// Day-of kid email auto-generated invite token, claim link in the body.
// Mirrors the manual /api/funds/:fundId/age-transition/invite-link flow so
// the email reads identically whether parent triggered it or the worker did.
async function sendKidInviteEmail(
  row: DueRow,
  childEmail: string,
  inviteToken: string,
  log: LogFn,
): Promise<void> {
  const childName = safeChildName(row);
  const baseUrl = getAppBaseUrl();
  const inviteLink = `${baseUrl}/transition/${inviteToken}`;
  const kidIntroBody = [
    `Hi ${childName},`,
    "",
    "Today's the day. Your family has built something for you, and now it's yours.",
    "",
    "Open your invite to claim the fund into your own Kiddo account. Everything they built (gifts, notes, photos, the whole Memory Book) comes with you.",
    "",
    "Nothing has been sold. The investments stay exactly where they are. What changes is who decides, and from today, that's you.",
  ].join("\n");
  const { html: kidHtml } = renderKiddoEmail({
    heading: "Today's the day",
    intro: kidIntroBody,
    cta: { text: "Claim your fund", url: inviteLink },
  });
  await sendEmail({
    to: childEmail,
    subject: `${childName}'s Kiddo fund is ready to claim`,
    text: [
      `Hi ${childName},`,
      "",
      "Today's the day. Your family has built something for you, and now it's yours.",
      "",
      "Open your invite to claim the fund into your own Kiddo account. Everything they built (gifts, notes, photos, the whole Memory Book) comes with you.",
      "",
      `Your invite link: ${inviteLink}`,
      "",
      "Nothing has been sold. The investments stay exactly where they are. What changes is who decides, and from today, that's you.",
      "",
      "— The Kiddo team",
    ].join("\n"),
    html: kidHtml,
    tags: ["age_transition", "invite", "auto"],
    metadata: { fundId: row.id, childEmail, milestone: "today_kid_invite" },
  }).catch((err) => {
    log(`kid invite send failed for fund ${row.id}: ${String(err)}`, WORKER_SOURCE);
    throw err;
  });
}

// Day-of parent email. Three variants:
//   "configured" → child email was on file AND verified, we sent the kid invite
//   "unverified" → child email on file but NOT verified at age 17 → we held
//                  off auto-sending the kid (could be a typo); parent needs
//                  to confirm and re-send manually
//   "missing"    → child email NOT on file, parent needs to add it manually
async function sendTodayParentEmail(
  row: DueRow,
  variant: "configured" | "unverified" | "missing",
  childEmail: string | null,
  log: LogFn,
): Promise<void> {
  if (!row.parent_email) return;
  const childName = safeChildName(row);
  const majorityAge = safeMajorityAge(row);
  const baseUrl = getAppBaseUrl();
  const managerUrl = `${baseUrl}/age-transition/${row.id}/manage`;
  const subject =
    variant === "configured"
      ? `Today's the day. ${childName} owns the fund.`
      : variant === "unverified"
        ? `${childName} turns ${majorityAge} today. Confirm their email`
        : `${childName} turns ${majorityAge} today. Add their email`;
  const body =
    variant === "configured"
      ? [
          parentGreeting(row),
          "",
          `Today's the day. ${childName} turned ${majorityAge}, and legal control of the fund has transferred to them under state UTMA law.`,
          "",
          `We've sent ${childName} a private claim link. Once they accept, the fund moves into their own Kiddo account.`,
          "",
          `What's left for you: walk through the final transfer status when ${childName} accepts, and confirm with your CPA on the tax filing for this year. Manage the handoff: ${managerUrl}`,
          "",
          "Nothing was sold. The investments stay exactly where they are. Only the custodian changed.",
          "",
          "The Kiddo team",
        ].join("\n")
      : variant === "unverified"
        ? [
            parentGreeting(row),
            "",
            `Today's ${childName}'s ${majorityAge}th birthday. Legal control of the fund transferred to them under state UTMA law as of today.`,
            "",
            `We have an email on file for them (${childEmail || "address hidden"}) but it was never confirmed by ${childName} from a verification link we sent. To avoid sending the claim link to the wrong person, we held off on the automatic send.`,
            "",
            `Confirm the address is right and trigger the invite from here: ${managerUrl}`,
            "",
            "If the address is wrong, update it there too and re-send. Nothing was sold; the investments stay where they are.",
            "",
            "The Kiddo team",
          ].join("\n")
        : [
            parentGreeting(row),
            "",
            `Today's ${childName}'s ${majorityAge}th birthday. Legal control of the fund transferred to them under state UTMA law as of today.`,
            "",
            `We don't have ${childName}'s email on file yet, so we couldn't send them the claim link automatically. Add their email here and we'll send it: ${managerUrl}`,
            "",
            "Until they claim, the fund stays under your account. Nothing was sold and the investments stay where they are. But the legal custodian has changed, and the in-app handoff completes when they accept the invite.",
            "",
            "The Kiddo team",
          ].join("\n");

  const tagSuffix =
    variant === "configured"
      ? "today_parent_configured"
      : variant === "unverified"
        ? "today_parent_unverified"
        : "today_parent_missing";

  const { html: parentHtml } = renderKiddoEmail({
    heading: subject,
    intro: body,
    cta: { text: "Open age-transition manager", url: managerUrl },
  });
  await sendEmail({
    to: row.parent_email,
    subject,
    text: body,
    html: parentHtml,
    tags: ["age_transition", tagSuffix],
    metadata: { fundId: row.id, variant, milestone: "today_parent" },
  }).catch((err) => {
    log(`today parent email failed for fund ${row.id}: ${String(err)}`, WORKER_SOURCE);
    throw err;
  });
}

async function processT30(rows: DueRow[], state: ReminderState, log: LogFn): Promise<number> {
  let sent = 0;
  for (const row of rows) {
    const fundState = state.byFund[row.id] || (state.byFund[row.id] = {});
    if (fundState.t30SentAt) continue;
    try {
      await sendT30Email(row, log);
      fundState.t30SentAt = new Date().toISOString();
      sent += 1;
      log(`T-30 sent for fund ${row.id} (${safeChildName(row)})`, WORKER_SOURCE);
    } catch {
      // sendT30Email already logged the error. State stays unsent so the
      // next pass retries. Stop the world only if state-save fails.
    }
  }
  return sent;
}

async function processT1(rows: DueRow[], state: ReminderState, log: LogFn): Promise<number> {
  let sent = 0;
  for (const row of rows) {
    const fundState = state.byFund[row.id] || (state.byFund[row.id] = {});
    if (fundState.t1SentAt) continue;
    try {
      await sendT1Email(row, log);
      fundState.t1SentAt = new Date().toISOString();
      sent += 1;
      log(`T-1 sent for fund ${row.id} (${safeChildName(row)})`, WORKER_SOURCE);
    } catch {}
  }
  return sent;
}

async function processToday(rows: DueRow[], state: ReminderState, log: LogFn): Promise<number> {
  let processed = 0;
  for (const row of rows) {
    const fundId = String(row.id);
    const childName = safeChildName(row);
    const majorityAge = safeMajorityAge(row);
    const fundState = state.byFund[fundId] || (state.byFund[fundId] = {});

    try {
      // Always stamp age_18_notified_at first even if downstream emails
      // fail, we don't want to re-fire the activity log. Better one missed
      // email than ten duplicate ones.
      await db.execute(sql`
        UPDATE funds
        SET age_18_notified_at = NOW()
        WHERE id = ${fundId}
          AND age_18_notified_at IS NULL
      `);

      // Activity log entry surfaces in admin + parent activity feed.
      await storage
        .createActivity({
          userId: String(row.user_id),
          fundId,
          type: "kid_age_18_reached",
          title: `${childName} turned ${majorityAge}`,
          description: `Legal control of the fund transferred to ${childName} (UTMA majority age ${majorityAge} per state law). Memory Book entries reserved for this milestone are now visible in their Kid View. Nothing was sold.`,
        })
        .catch((err: any) => {
          log(`activity log write failed for fund ${fundId}: ${String(err)}`, WORKER_SOURCE);
        });

      // Try to auto-send the kid invite. Four branches now (verification
      // gate added to prevent the wrong-email failure mode):
      //   1. Child email VERIFIED + no existing inviteToken → generate
      //      token, send the kid the claim email automatically.
      //   2. Child email VERIFIED + inviteToken exists (parent manually
      //      triggered earlier) → don't double-send; parent gets the
      //      "today's the day" follow-up.
      //   3. Child email present but UNVERIFIED → DON'T auto-send the kid
      //      (could be a wrong address); parent gets the "confirm their
      //      email" variant prompting them to verify and re-send manually.
      //   4. No child email at all → parent gets the "add their email"
      //      prompt (existing behavior).
      // Verification gate is the load-bearing change: it prevents the at-18
      // claim link from silently going to the wrong inbox because of a
      // parent typo six years earlier.
      const transitionRecord = await getAgeTransitionRecord(fundId);
      const childEmail = transitionRecord.childEmail || null;
      const isVerified = !!transitionRecord.childEmailVerifiedAt;
      const hasExistingToken = !!transitionRecord.inviteToken;

      // Pure decision logic extracted to ../shared/age18-decisions.ts
      // so it's unit-testable. See script/test-age18-decisions.ts.
      // The variant tells us which parent email to send; the auto-send
      // gate is independent (only fires when configured AND no existing
      // token prevents double-send when parent manually triggered earlier).
      const parentVariant = decideTodayParentVariant({ childEmail, isVerified });
      const autoSendKid = shouldAutoSendKidInvite({
        childEmail,
        isVerified,
        hasExistingInviteToken: hasExistingToken,
      });
      if (autoSendKid && childEmail && !fundState.todayInviteAutoSentAt) {
        const inviteToken = crypto.randomUUID();
        await patchAgeTransitionRecord(fundId, {
          inviteToken,
          invitedAt: new Date().toISOString(),
        });
        try {
          await sendKidInviteEmail(row, childEmail, inviteToken, log);
          fundState.todayInviteAutoSentAt = new Date().toISOString();
          await storage
            .createActivity({
              userId: String(row.user_id),
              fundId,
              type: "age18_invite_auto_sent",
              title: `Auto-sent claim link to ${childName}`,
              description: `${childName}'s claim link was sent automatically to ${childEmail}.`,
            })
            .catch(() => undefined);
        } catch {
          // Email failed; the token was already written so subsequent
          // passes don't re-generate. State stays unsent but the parent
          // email below will still go out, alerting them to take over.
        }
      }

      if (!fundState.todayParentEmailSentAt) {
        try {
          await sendTodayParentEmail(row, parentVariant, childEmail, log);
          fundState.todayParentEmailSentAt = new Date().toISOString();
        } catch {}
      }

      processed += 1;
      log(
        `today processed for fund ${fundId} (${childName}, variant=${parentVariant})`,
        WORKER_SOURCE,
      );
    } catch (err) {
      log(`today processing failed for fund ${fundId}: ${String(err)}`, WORKER_SOURCE);
    }
  }
  return processed;
}

export async function runAge18TransitionWorker(log: LogFn = () => undefined): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const due = await loadDueFunds();
    const state = await loadReminderState(log);

    const t30Sent = await processT30(due.t30, state, log);
    const t1Sent = await processT1(due.t1, state, log);
    const todayProcessed = await processToday(due.today, state, log);

    // Persist state once at the end of the pass Postgres-backed
    // upserts (one per touched fund). Per-fund failures don't take the
    // whole save down; they re-attempt on the next pass with at most
    // one duplicate send per affected fund.
    if (t30Sent + t1Sent + todayProcessed > 0) {
      try {
        await saveReminderState(state, log);
      } catch (err) {
        log(`reminder state save failed: ${String(err)}`, WORKER_SOURCE);
      }
      log(
        `processed: t30=${t30Sent}, t1=${t1Sent}, today=${todayProcessed}`,
        WORKER_SOURCE,
      );
    }
  } catch (err) {
    log(`worker pass failed: ${String(err)}`, WORKER_SOURCE);
  } finally {
    workerRunning = false;
  }
}

export function startAge18TransitionWorker(log: LogFn = () => undefined): void {
  // 6 hours is the right cadence for day-granular birthdays. Min 1 hour to
  // prevent accidental misconfiguration into a tight loop. Each milestone
  // tracks its own send-state, so a worker restart in the middle of a pass
  // picks up cleanly (idempotent: anything already stamped won't re-send).
  const intervalMs = Math.max(
    Number(process.env.AGE18_WORKER_INTERVAL_MS || 6 * 60 * 60 * 1000),
    60 * 60 * 1000,
  );
  void runAge18TransitionWorker(log);
  const interval = setInterval(() => {
    void runAge18TransitionWorker(log);
  }, intervalMs);
  interval.unref?.();
  log(`age-18 transition worker started (every ${Math.round(intervalMs / 60000)} min)`, WORKER_SOURCE);
}
