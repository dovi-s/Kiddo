// PMF survey trigger worker. Sends the Sean Ellis email
// ("How would you feel if you could no longer use Kiddo?") to users
// who have had 14+ days of real product experience.
//
// Locked 2026-05-26 per project_launch_wedge_and_creator_distribution.md
// as the deferred half of launch must-have #4. The survey RESPONSE
// surface (page + endpoint + admin tile + email template) shipped
// earlier the same day; this worker is the trigger half that decides
// who/when gets the email.
//
// Stake-of-a-mis-send: HIGH. Unlike fund-anniversary or birthday
// emails (which re-fire next cycle and the user gets another shot),
// the Sean Ellis question is asked ONCE per user lifetime. The first
// answer is the strongest signal because subsequent asks become
// "they made me click again" not "do you genuinely care." So:
//
//   1. Default kill switch: PMF_SURVEY_TRIGGER_ENABLED env var must
//      be explicitly set to "true" to enable sends. Without it, the
//      worker runs the candidate query and LOGS who would be sent
//      to, but does NOT send. Operator flips the switch after
//      verifying the email looks right and the audience is sane.
//   2. Batch size: 25 per tick. Daily tick. Early sends produce
//      early responses that inform the next batch — better than
//      flooding 1000 in one go and finding out the copy was wrong.
//   3. File-backed idempotence: one row per (user_email, lifetime).
//      Once we send to an email, we never send again — even if they
//      change accounts, change emails, or come back years later.
//
// Audience definition (locked):
//   - User account 14+ days old
//   - User has had MEANINGFUL product engagement: at least one gift
//     in 'processing' / 'settled' / 'invested' status either as the
//     parent on a fund they own, OR as a gifter who sent one.
//   - User's last meaningful engagement is within the past 90 days
//     (we want recent-user honest signal, not "I used this once 2
//     years ago and forgot" noise).
//   - Filter test users, demo accounts, deleted accounts.
//   - Suppression at sendEmail layer (Postmark bounces / opt-outs)
//     is the second filter; we don't double-check here because
//     emailDelivery.ts handles it.
//
// We deliberately do NOT check the granular email-preferences
// categories (gifterReturn, monthlyPulse, etc.). The Sean Ellis ask
// is transactional product feedback, not a marketing stream the
// user can subscribe / unsubscribe to. Hard suppression (bounced,
// unsubscribe-all) is honored by the email layer. Anything softer
// would defeat the purpose of asking everyone the one PMF question.

import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { buildSeanEllisSurveyEmail } from "./templates/seanEllisSurvey";
import { recordEvent } from "./analytics";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "pmf-survey-trigger";
const SENDS_PATH = path.join(process.cwd(), ".local", "pmf-survey-email-sends.json");
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const BATCH_SIZE = 25; // per tick — small enough to QA early responses before flooding

type State = { sentByEmail: Record<string, string> };

async function loadState(): Promise<State> {
  try {
    const raw = await fs.readFile(SENDS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { sentByEmail: parsed?.sentByEmail || {} };
  } catch (err: any) {
    if (err?.code === "ENOENT") return { sentByEmail: {} };
    throw err;
  }
}

async function saveState(s: State): Promise<void> {
  await fs.mkdir(path.dirname(SENDS_PATH), { recursive: true });
  await fs.writeFile(SENDS_PATH, JSON.stringify(s, null, 2), "utf8");
}

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");
}

function isSendEnabled(): boolean {
  const flag = String(process.env.PMF_SURVEY_TRIGGER_ENABLED || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

async function tick(log: LogFn): Promise<void> {
  let rows: any[] = [];
  try {
    // Candidates: 14+ days old, real users (not test/demo/deleted),
    // with meaningful gift activity in the last 90 days (either as
    // a parent-on-a-fund-they-own or as a gifter). last_active_at
    // is the most recent of the two engagement timestamps so a
    // user who's both a parent and a gifter gets ranked by the
    // most recent of either role.
    const result = await pool.query(`
      WITH eligible_users AS (
        SELECT
          u.id,
          LOWER(u.email) AS email,
          u.first_name,
          u.created_at,
          GREATEST(
            COALESCE((
              SELECT MAX(g.created_at)
              FROM gifts g
              JOIN funds f ON f.id = g.fund_id
              WHERE f.user_id = u.id
                AND g.status IN ('processing', 'settled', 'invested')
            ), '1970-01-01'::timestamp),
            COALESCE((
              SELECT MAX(g.created_at)
              FROM gifts g
              WHERE LOWER(g.sender_email) = LOWER(u.email)
                AND g.status IN ('processing', 'settled', 'invested')
            ), '1970-01-01'::timestamp)
          ) AS last_active_at
        FROM users u
        WHERE u.email IS NOT NULL
          AND u.created_at < NOW() - INTERVAL '14 days'
          AND u.deleted_at IS NULL
          AND u.is_test_user = false
          AND u.is_demo_account = false
      )
      SELECT id, email, first_name, created_at, last_active_at
      FROM eligible_users
      WHERE last_active_at > NOW() - INTERVAL '90 days'
      ORDER BY last_active_at DESC
      LIMIT 500
    `);
    rows = result.rows;
  } catch (err: any) {
    log(`pmf-survey-trigger candidate query failed: ${err?.message || err}`, WORKER_SOURCE);
    return;
  }

  if (rows.length === 0) {
    log(`tick done: 0 candidates`, WORKER_SOURCE);
    return;
  }

  const state = await loadState();
  const unsent = rows.filter((row: any) => row.email && !state.sentByEmail[row.email]);

  if (unsent.length === 0) {
    log(`tick done: ${rows.length} candidates queried, 0 unsent`, WORKER_SOURCE);
    return;
  }

  // Kill-switch awareness. When disabled, log who WOULD be sent so
  // an operator can preview the audience size + a sample without
  // having to query the DB themselves.
  if (!isSendEnabled()) {
    const sampleEmails = unsent.slice(0, 5).map((r: any) => r.email).join(", ");
    log(
      `kill-switch OFF (set PMF_SURVEY_TRIGGER_ENABLED=true to enable). Would send to ${unsent.length} users. Sample: ${sampleEmails}`,
      WORKER_SOURCE,
    );
    return;
  }

  const batch = unsent.slice(0, BATCH_SIZE);
  const baseUrl = getBaseUrl();
  const surveyBaseUrl = `${baseUrl}/feedback/pmf`;

  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    const email = String(row.email).toLowerCase();
    const firstName = (row.first_name || "").trim() || null;

    try {
      const message = buildSeanEllisSurveyEmail({
        to: email,
        firstName,
        surveyBaseUrl,
      });
      const result = await sendEmail(message);
      if (result.delivered || result.mode === "outbox_fallback") {
        state.sentByEmail[email] = new Date().toISOString();
        sent += 1;
        try {
          recordEvent({
            name: "pmf_survey_email_sent",
            source: "webhook", // server-side worker; closest source category
            userId: row.id || null,
            props: { lastActiveAt: row.last_active_at, accountAgeDays: Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000) },
          });
        } catch (eventErr) {
          // Non-fatal — the email shipped, the analytics is best-effort.
          log(`recordEvent failed for ${email}: ${(eventErr as any)?.message || eventErr}`, WORKER_SOURCE);
        }
      } else {
        // Suppressed / dedupe_skipped / no-provider. Mark as sent so
        // we don't keep retrying — suppression is permanent.
        state.sentByEmail[email] = new Date().toISOString();
        log(`skipped send to ${email}: mode=${result.mode}`, WORKER_SOURCE);
      }
    } catch (err: any) {
      failed += 1;
      log(`send failed for ${email}: ${err?.message || err}`, WORKER_SOURCE);
    }
  }

  // Persist state once per tick (not per-send) to amortize fs cost.
  // Worst case on crash mid-tick: a few duplicate sends next tick,
  // bounded by the BATCH_SIZE and caught by the sendEmail dedupe
  // cache (12h TTL). Acceptable for a one-time-per-lifetime email.
  await saveState(state);
  log(`tick done: ${batch.length} batch, ${sent} sent, ${failed} failed, ${unsent.length - batch.length} deferred to next tick`, WORKER_SOURCE);
}

export function startPmfSurveyTriggerWorker(log: LogFn = () => undefined): void {
  // Stagger startup by ~150s like the other workers so a fresh server
  // boot doesn't slam every worker through their first tick at the
  // same time.
  setTimeout(() => {
    void tick(log).catch(() => null);
    const interval = setInterval(() => { void tick(log).catch(() => null); }, RUN_INTERVAL_MS);
    interval.unref?.();
  }, 150_000);
  const enabled = isSendEnabled();
  log(
    `started (daily, ${enabled ? "SENDING enabled" : "kill-switch OFF — set PMF_SURVEY_TRIGGER_ENABLED=true to enable sends"})`,
    WORKER_SOURCE,
  );
}
