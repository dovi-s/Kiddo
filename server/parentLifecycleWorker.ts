import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { renderKiddoEmail } from "./templates/baseTemplate";
import { queueMobilePush } from "./mobilePushWorker";

const PARENT_LIFECYCLE_STATE_PATH = path.join(process.cwd(), ".local", "parent-lifecycle-state.json");
const PARENT_LIFECYCLE_QUEUE_PATH = path.join(process.cwd(), ".local", "parent-lifecycle-queue.jsonl");
const PARENT_LIFECYCLE_DELIVERY_LOG_PATH = path.join(process.cwd(), ".local", "parent-lifecycle-deliveries.json");

const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type ParentLifecycleState = {
  byFund: Record<
    string,
    {
      activationDay1SentAt?: string;
      activationDay3SentAt?: string;
      activationDay7SentAt?: string;
      firstGiftSentAt?: string;
      milestone100SentAt?: string;
      milestone500SentAt?: string;
      milestone1000SentAt?: string;
      birthdayReminderYear?: number;
      dormantSentAt?: string;
    }
  >;
};

type DeliveryLog = {
  deliveredById: Record<string, { deliveredAt: string; type: string; channel: string }>;
};

type QueueEntry = Record<string, unknown> & {
  id?: string;
  type?: string;
  fundId?: string;
  userId?: string;
  email?: string;
  childName?: string;
  createdAt?: string;
};

type LifecycleRow = {
  fund_id: string;
  fund_name: string | null;
  fund_slug: string | null;
  user_id: string;
  parent_email: string | null;
  parent_first_name: string | null;
  recipient_first_name: string | null;
  recipient_birthdate: string | null;
  created_at: string | null;
  last_contribution_at: string | null;
  total_value: string | null;
  pending_balance: string | null;
  gift_count: string | null;
  total_gifted: string | null;
  contributor_count: string | null;
};

type RenderedEmail = {
  to: string;
  subject: string;
  text: string;
};

type RenderedPush = {
  title: string;
  body: string;
  deepLink?: string | null;
};

function getAppBaseUrl() {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT || "5000"}`;
}

function hoursBetween(earlier: Date | string, later = new Date()) {
  const left = earlier instanceof Date ? earlier : new Date(earlier);
  return (later.getTime() - left.getTime()) / (1000 * 60 * 60);
}

function daysBetween(earlier: Date | string, later = new Date()) {
  return hoursBetween(earlier, later) / 24;
}

/**
 * Calendar-day diff in APP_TIMEZONE. Counts midnight boundaries
 * crossed, ignores time-of-day. A fund created at 11:59 PM on May 15
 * and "now" at 12:01 AM on May 16 returns 1 — they're on different
 * calendar days in the configured timezone.
 *
 * Used by the activation drip (Day 1 / 3 / 7) so the label matches
 * user intuition: "Day N email arrives on the Nth calendar day after
 * signup," not "N * 24 fractional hours after signup."
 */
function calendarDaysBetween(earlier: Date | string, later: Date | string = new Date()) {
  const a = getDatePartsInTimeZone(earlier);
  const b = getDatePartsInTimeZone(later);
  // Convert both to UTC-midnight epoch values; the absolute date
  // arithmetic is straightforward and immune to DST shifts because
  // we're working in pure date space.
  const aMs = Date.UTC(a.year, a.month - 1, a.day);
  const bMs = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bMs - aMs) / (24 * 60 * 60 * 1000));
}

function getDatePartsInTimeZone(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

function getNextBirthdayWithinDays(birthdate: Date | string, withinDays: number, today = new Date()) {
  const birth = getDatePartsInTimeZone(birthdate);
  const current = getDatePartsInTimeZone(today);
  let targetYear = current.year;
  let nextBirthday = new Date(Date.UTC(targetYear, birth.month - 1, birth.day, 12, 0, 0));
  if (nextBirthday.getTime() < today.getTime()) {
    targetYear += 1;
    nextBirthday = new Date(Date.UTC(targetYear, birth.month - 1, birth.day, 12, 0, 0));
  }
  const diffDays = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= withinDays
    ? { nextBirthday, diffDays, birthdayYear: targetYear }
    : null;
}

async function loadState(): Promise<ParentLifecycleState> {
  try {
    const raw = await fs.readFile(PARENT_LIFECYCLE_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      byFund: parsed?.byFund && typeof parsed.byFund === "object" ? parsed.byFund : {},
    };
  } catch {
    return { byFund: {} };
  }
}

async function saveState(state: ParentLifecycleState) {
  await fs.mkdir(path.dirname(PARENT_LIFECYCLE_STATE_PATH), { recursive: true });
  await fs.writeFile(PARENT_LIFECYCLE_STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

async function loadDeliveryLog(): Promise<DeliveryLog> {
  try {
    const raw = await fs.readFile(PARENT_LIFECYCLE_DELIVERY_LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      deliveredById: parsed?.deliveredById && typeof parsed.deliveredById === "object" ? parsed.deliveredById : {},
    };
  } catch {
    return { deliveredById: {} };
  }
}

async function saveDeliveryLog(log: DeliveryLog) {
  await fs.mkdir(path.dirname(PARENT_LIFECYCLE_DELIVERY_LOG_PATH), { recursive: true });
  await fs.writeFile(PARENT_LIFECYCLE_DELIVERY_LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

async function appendQueueEntry(entry: QueueEntry) {
  const payload = {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    ...entry,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(PARENT_LIFECYCLE_QUEUE_PATH), { recursive: true });
  await fs.appendFile(PARENT_LIFECYCLE_QUEUE_PATH, JSON.stringify(payload) + "\n", "utf8");
}

async function getLifecycleRows(): Promise<LifecycleRow[]> {
  const result = await pool.query(
    `
      SELECT
        f.id AS fund_id,
        f.name AS fund_name,
        f.slug AS fund_slug,
        f.user_id,
        u.email AS parent_email,
        u.first_name AS parent_first_name,
        f.recipient_first_name,
        f.recipient_birthdate,
        f.created_at,
        f.last_contribution_at,
        f.balance AS total_value,
        f.pending_balance,
        COALESCE(g.gift_count, 0)::text AS gift_count,
        COALESCE(g.total_gifted, 0)::text AS total_gifted,
        COALESCE(g.contributor_count, 0)::text AS contributor_count
      FROM funds f
      JOIN users u ON u.id = f.user_id
      LEFT JOIN (
        SELECT
          fund_id,
          COUNT(*) FILTER (WHERE status NOT IN ('failed', 'refunded', 'canceled'))::int AS gift_count,
          -- Keep total_gifted NUMERIC inside the subquery so the
          -- outer COALESCE(g.total_gifted, 0) can match types
          -- (numeric + integer is valid; text + integer is not).
          -- The outer projection casts to text alongside the other
          -- two columns. Fixed 2026-05-18 — prior ::text cast in
          -- this position broke parent_lifecycle_worker on every
          -- tick with 'COALESCE types text and integer cannot be
          -- matched'.
          COALESCE(SUM(CAST(amount AS numeric)) FILTER (WHERE status NOT IN ('failed', 'refunded', 'canceled')), 0) AS total_gifted,
          COUNT(DISTINCT COALESCE(NULLIF(LOWER(TRIM(sender_email)), ''), LOWER(TRIM(sender_name)))) FILTER (WHERE status NOT IN ('failed', 'refunded', 'canceled'))::int AS contributor_count
        FROM gifts
        GROUP BY fund_id
      ) g ON g.fund_id = f.id
      WHERE u.email IS NOT NULL
    `,
  );
  return result.rows as LifecycleRow[];
}

function buildGiftUrl(baseUrl: string, row: LifecycleRow) {
  if (row.fund_slug) return `${baseUrl}/${row.fund_slug}`;
  return `${baseUrl}/gift/${row.fund_id}`;
}

function buildDashboardUrl(baseUrl: string, row: LifecycleRow) {
  return `${baseUrl}/dashboard?fund=${encodeURIComponent(row.fund_id)}`;
}

function buildMemoryBookUrl(baseUrl: string, row: LifecycleRow) {
  return `${baseUrl}/memory/${row.fund_id}`;
}

function buildEventsUrl(baseUrl: string) {
  return `${baseUrl}/events`;
}

function renderActivationEmail(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const parentName = String(entry.parentFirstName || "").trim();
  const childName = String(entry.childName || "your child").trim();
  const giftUrl = String(entry.giftUrl || "").trim();
  const dashboardUrl = String(entry.dashboardUrl || "").trim();
  const memoryBookUrl = String(entry.memoryBookUrl || "").trim();
  const eventsUrl = String(entry.eventsUrl || "").trim();
  const day = Number(entry.day || 0);
  if (!to || !giftUrl || !dashboardUrl) return null;

  let subject = `${childName}'s fund is live. Now get the first gift in.`;
  let body = [
    `Hi${parentName ? ` ${parentName}` : ""},`,
    "",
    `${childName}'s fund is live.`,
    "",
    "The next step is simple: share the link once so the first gift can land and the story can begin.",
    `Share the fund: ${giftUrl}`,
    `Open your dashboard: ${dashboardUrl}`,
  ];

  if (day >= 3 && day < 7) {
    subject = `Write the first note in ${childName}'s Memory Book`;
    body = [
      `Hi${parentName ? ` ${parentName}` : ""},`,
      "",
      `${childName}'s fund is live, and the Memory Book is waiting for its first real page.`,
      "",
      "Write one short note about why you started this fund, then share the link so the first gift can start the story.",
      `Open the Memory Book: ${memoryBookUrl}`,
      `Share the fund: ${giftUrl}`,
      `Open your dashboard: ${dashboardUrl}`,
    ];
  }

  if (day >= 7) {
    subject = `Turn ${childName}'s fund into a gifting moment`;
    body = [
      `Hi${parentName ? ` ${parentName}` : ""},`,
      "",
      `A birthday, holiday, or baby-shower page is the easiest way to get ${childName}'s first real gifting momentum.`,
      "",
      "Create a gifting moment, share it once, and give family a reason to act now instead of later.",
      `Create a gifting moment: ${eventsUrl}`,
      `Share the fund: ${giftUrl}`,
      `Open your dashboard: ${dashboardUrl}`,
    ];
  }

  return {
    to,
    subject,
    text: [...body, "", "The Kiddo team"].filter(Boolean).join("\n"),
  };
}

function renderFirstGiftEmail(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const parentName = String(entry.parentFirstName || "").trim();
  const childName = String(entry.childName || "your child").trim();
  const totalGifted = Number(entry.totalGifted || 0);
  const dashboardUrl = String(entry.dashboardUrl || "").trim();
  const memoryBookUrl = String(entry.memoryBookUrl || "").trim();
  if (!to || !dashboardUrl) return null;
  return {
    to,
    subject: `${childName} just received the first gift`,
    text: [
      `Hi${parentName ? ` ${parentName}` : ""},`,
      "",
      `${childName} just received the first gift.`,
      "",
      `The fund now has $${totalGifted.toFixed(2)} in total gifts, and the Memory Book has officially started.`,
      `Open the dashboard: ${dashboardUrl}`,
      `Open the Memory Book: ${memoryBookUrl}`,
      "",
      "The Kiddo team",
    ].join("\n"),
  };
}

function renderMilestoneEmail(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const parentName = String(entry.parentFirstName || "").trim();
  const childName = String(entry.childName || "your child").trim();
  const milestone = Number(entry.milestone || 0);
  const totalGifted = Number(entry.totalGifted || 0);
  const contributorCount = Number(entry.contributorCount || 0);
  const giftUrl = String(entry.giftUrl || "").trim();
  const dashboardUrl = String(entry.dashboardUrl || "").trim();
  if (!to || !dashboardUrl || !giftUrl || !milestone) return null;
  return {
    to,
    subject: `${childName}'s fund just passed $${milestone}`,
    text: [
      `Hi${parentName ? ` ${parentName}` : ""},`,
      "",
      `${childName}'s fund just passed $${milestone} in total gifts.`,
      "",
      `${contributorCount} people have helped build it so far, and the fund has received $${totalGifted.toFixed(2)} overall.`,
      "This is a great moment to share the link again while the momentum is real.",
      `Share the fund: ${giftUrl}`,
      `Open your dashboard: ${dashboardUrl}`,
      "",
      "The Kiddo team",
    ].join("\n"),
  };
}

function renderBirthdayReminderEmail(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const parentName = String(entry.parentFirstName || "").trim();
  const childName = String(entry.childName || "your child").trim();
  const daysUntilBirthday = Number(entry.daysUntilBirthday || 0);
  const totalGifted = Number(entry.totalGifted || 0);
  const giftUrl = String(entry.giftUrl || "").trim();
  const eventsUrl = String(entry.eventsUrl || "").trim();
  if (!to || !giftUrl || !eventsUrl) return null;
  return {
    to,
    subject: `${childName}'s birthday is in ${daysUntilBirthday} days`,
    text: [
      `Hi${parentName ? ` ${parentName}` : ""},`,
      "",
      `${childName}'s birthday is in ${daysUntilBirthday} days.`,
      totalGifted > 0
        ? `Their fund has already received $${totalGifted.toFixed(2)} in total gifts.`
        : `Their fund is live and ready for its first gift.`,
      "",
      "This is the perfect moment to share the link or create a gifting page for the occasion.",
      `Share the fund: ${giftUrl}`,
      `Create a gifting moment: ${eventsUrl}`,
      "",
      "The Kiddo team",
    ].join("\n"),
  };
}

function renderDormantEmail(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const parentName = String(entry.parentFirstName || "").trim();
  const childName = String(entry.childName || "your child").trim();
  const totalGifted = Number(entry.totalGifted || 0);
  const contributorCount = Number(entry.contributorCount || 0);
  const giftUrl = String(entry.giftUrl || "").trim();
  const dashboardUrl = String(entry.dashboardUrl || "").trim();
  if (!to || !giftUrl || !dashboardUrl) return null;
  return {
    to,
    subject: `${childName}'s fund is ready for its next gift`,
    text: [
      `Hi${parentName ? ` ${parentName}` : ""},`,
      "",
      `${childName}'s fund has been quiet for a bit, but the story is still there waiting for the next moment.`,
      totalGifted > 0
        ? `So far ${contributorCount} people have contributed $${totalGifted.toFixed(2)}.`
        : "No gifts have landed yet, which means the next share matters even more.",
      "",
      "Share the link again, or use the next occasion as a reason to bring family back in.",
      `Share the fund: ${giftUrl}`,
      `Open your dashboard: ${dashboardUrl}`,
      "",
      "The Kiddo team",
    ].join("\n"),
  };
}

function renderQueuedEmail(entry: QueueEntry): RenderedEmail | null {
  switch (String(entry.type || "")) {
    case "activation_day_1":
    case "activation_day_3":
    case "activation_day_7":
      return renderActivationEmail(entry);
    case "first_gift":
      return renderFirstGiftEmail(entry);
    case "milestone":
      return renderMilestoneEmail(entry);
    case "birthday_reminder":
      return renderBirthdayReminderEmail(entry);
    case "dormant_reengagement":
      return renderDormantEmail(entry);
    default:
      return null;
  }
}

function renderQueuedPush(entry: QueueEntry): RenderedPush | null {
  const childName = String(entry.childName || "your child").trim();
  const fundId = String(entry.fundId || "").trim();
  const deepLink = fundId ? `/dashboard?fund=${encodeURIComponent(fundId)}` : "/dashboard";

  switch (String(entry.type || "")) {
    case "activation_day_1":
      return {
        title: `${childName}'s fund is live`,
        body: "Share the link once so the first gift can land and the story can begin.",
        deepLink,
      };
    case "activation_day_3":
      return {
        title: `Write ${childName}'s first Memory Book note`,
        body: "The fund is live. Give the story its opening line, then share it.",
        deepLink: fundId ? `/memory/${encodeURIComponent(fundId)}` : deepLink,
      };
    case "activation_day_7":
      return {
        title: `Turn ${childName}'s fund into a gifting moment`,
        body: "A birthday or holiday page is the easiest way to create momentum now.",
        deepLink: "/events",
      };
    case "first_gift":
      return {
        title: `${childName} just received the first gift`,
        body: "The fund is no longer just set up. The story has officially started.",
        deepLink,
      };
    case "milestone":
      return {
        title: `${childName}'s fund hit a new milestone`,
        body: `Family gifting just crossed $${Number(entry.milestone || 0).toFixed(0)}.`,
        deepLink,
      };
    case "birthday_reminder":
      return {
        title: `${childName}'s birthday is coming up`,
        body: "This is the perfect moment to share the link again.",
        deepLink: "/events",
      };
    case "dormant_reengagement":
      return {
        title: `${childName}'s fund is ready for its next gift`,
        body: "The story is waiting for the next moment. Bring family back in.",
        deepLink,
      };
    default:
      return null;
  }
}

async function enqueueParentLifecycleEmails(log: (message: string, source?: string) => void) {
  const state = await loadState();
  const rows = await getLifecycleRows();
  const now = new Date();
  const baseUrl = getAppBaseUrl();
  let queued = 0;
  let changed = false;

  for (const row of rows) {
    const email = String(row.parent_email || "").trim().toLowerCase();
    const createdAt = row.created_at ? new Date(row.created_at) : null;
    const giftCount = Number(row.gift_count || 0);
    const totalGifted = Number(row.total_gifted || 0);
    const contributorCount = Number(row.contributor_count || 0);
    const giftUrl = buildGiftUrl(baseUrl, row);
    const dashboardUrl = buildDashboardUrl(baseUrl, row);
    const memoryBookUrl = buildMemoryBookUrl(baseUrl, row);
    const eventsUrl = buildEventsUrl(baseUrl);
    const childName = row.recipient_first_name || row.fund_name || "your child";
    if (!email || !createdAt) continue;

    const fundState = state.byFund[row.fund_id] || {};

    // Activation gate. Two conditions, both must hold:
    //   1. No settled gifts currently exist (`giftCount === 0`)
    //   2. The first-gift email has never fired for this fund
    //      (`!fundState.firstGiftSentAt`)
    //
    // The second condition prevents a subtle re-fire bug: if a gift
    // settles, the first-gift email queues, then the gift gets refunded
    // and `giftCount` drops back to 0, the previous gate would resume
    // sending activation emails ("get your first gift!") to a parent
    // who has already experienced one. Sending them activation copy in
    // that emotional context reads as tone-deaf. The firstGiftSentAt
    // flag persists across refunds, so once we've welcomed the first
    // gift, activation is permanently retired for this fund.
    if (giftCount === 0 && !fundState.firstGiftSentAt) {
      // 2026-05-15: switched from fractional hours/24 to calendar-day
      // diff in APP_TIMEZONE. With the previous fractional math, a
      // fund created at 11pm could trip "Day 1 >= 1" at midnight
      // (1 hour later) and the user got their "Day 1" email feeling
      // like it had been minutes since signup. The calendar-day
      // version requires a true date boundary to have passed in the
      // configured timezone: Day 1 fires on the day AFTER signup,
      // Day 3 on the third day, Day 7 on the seventh.
      //
      // The hoursElapsed >= 18 gate is the second safety net — a
      // fund created at 11:59 PM still wouldn't fire Day 1 at 12:01
      // AM (only 2 minutes later); we'd wait ~18+ hours so the
      // email arrives sometime during normal hours of the next day.
      const calendarAge = calendarDaysBetween(createdAt, now);
      const hoursElapsed = hoursBetween(createdAt, now);
      const ageDays = daysBetween(createdAt, now); // retained for backward-compat below if needed
      if (calendarAge >= 1 && hoursElapsed >= 18 && !fundState.activationDay1SentAt) {
        await appendQueueEntry({
          id: `activation_day_1:${row.fund_id}`,
          type: "activation_day_1",
          fundId: row.fund_id,
          userId: row.user_id,
          email,
          parentFirstName: row.parent_first_name,
          childName,
          giftUrl,
          dashboardUrl,
          memoryBookUrl,
          eventsUrl,
          day: 1,
        });
        fundState.activationDay1SentAt = now.toISOString();
        queued += 1;
        changed = true;
      }
      if (calendarAge >= 3 && !fundState.activationDay3SentAt) {
        await appendQueueEntry({
          id: `activation_day_3:${row.fund_id}`,
          type: "activation_day_3",
          fundId: row.fund_id,
          userId: row.user_id,
          email,
          parentFirstName: row.parent_first_name,
          childName,
          giftUrl,
          dashboardUrl,
          memoryBookUrl,
          eventsUrl,
          day: 3,
        });
        fundState.activationDay3SentAt = now.toISOString();
        queued += 1;
        changed = true;
      }
      if (calendarAge >= 7 && !fundState.activationDay7SentAt) {
        await appendQueueEntry({
          id: `activation_day_7:${row.fund_id}`,
          type: "activation_day_7",
          fundId: row.fund_id,
          userId: row.user_id,
          email,
          parentFirstName: row.parent_first_name,
          childName,
          giftUrl,
          dashboardUrl,
          memoryBookUrl,
          eventsUrl,
          day: 7,
        });
        fundState.activationDay7SentAt = now.toISOString();
        queued += 1;
        changed = true;
      }
    }

    // Track whether the first-gift email is queueing on THIS tick.
    // Used below to suppress same-tick milestone emails so a generous
    // opening gift (e.g., Grandpa Jay walks in with $1,500) doesn't
    // pelt the parent with four emails in one hour: first_gift +
    // milestone_100 + milestone_500 + milestone_1000. The single
    // first-gift email covers the emotional beat; milestones for
    // thresholds the first gift swept through stay silent but their
    // flags still flip so later gifts don't re-fire them either.
    let firstGiftQueuedThisTick = false;
    if (giftCount >= 1 && !fundState.firstGiftSentAt) {
      await appendQueueEntry({
        id: `first_gift:${row.fund_id}`,
        type: "first_gift",
        fundId: row.fund_id,
        userId: row.user_id,
        email,
        parentFirstName: row.parent_first_name,
        childName,
        totalGifted,
        dashboardUrl,
        memoryBookUrl,
      });
      fundState.firstGiftSentAt = now.toISOString();
      queued += 1;
      changed = true;
      firstGiftQueuedThisTick = true;
    }

    for (const milestone of [100, 500, 1000] as const) {
      const key = milestone === 100 ? "milestone100SentAt" : milestone === 500 ? "milestone500SentAt" : "milestone1000SentAt";
      if (totalGifted >= milestone && !fundState[key]) {
        // Suppress the milestone email if first_gift just queued on
        // this same tick. The welcome email is enough; layering a
        // "you crossed $100!" / "$500!" / "$1,000!" on top reads as
        // a spammy pile-up. We still mark the flag so the milestone
        // is considered consumed and won't fire on a future tick
        // when the threshold would no longer be "new."
        if (!firstGiftQueuedThisTick) {
          await appendQueueEntry({
            id: `milestone:${milestone}:${row.fund_id}`,
            type: "milestone",
            fundId: row.fund_id,
            userId: row.user_id,
            email,
            parentFirstName: row.parent_first_name,
            childName,
            milestone,
            totalGifted,
            contributorCount,
            giftUrl,
            dashboardUrl,
          });
          queued += 1;
        }
        fundState[key] = now.toISOString();
        changed = true;
      }
    }

    if (row.recipient_birthdate) {
      const birthdayWindow = getNextBirthdayWithinDays(row.recipient_birthdate, 14, now);
      if (birthdayWindow && fundState.birthdayReminderYear !== birthdayWindow.birthdayYear) {
        await appendQueueEntry({
          id: `birthday_reminder:${birthdayWindow.birthdayYear}:${row.fund_id}`,
          type: "birthday_reminder",
          fundId: row.fund_id,
          userId: row.user_id,
          email,
          parentFirstName: row.parent_first_name,
          childName,
          daysUntilBirthday: birthdayWindow.diffDays,
          totalGifted,
          giftUrl,
          eventsUrl,
        });
        fundState.birthdayReminderYear = birthdayWindow.birthdayYear;
        queued += 1;
        changed = true;
      }
    }

    const lastTouch = row.last_contribution_at || row.created_at;
    if (lastTouch && daysBetween(lastTouch, now) >= 45) {
      const dormantEligible =
        !fundState.dormantSentAt || daysBetween(fundState.dormantSentAt, now) >= 45;
      if (dormantEligible) {
        await appendQueueEntry({
          id: `dormant:${row.fund_id}:${getDatePartsInTimeZone(now).year}-${getDatePartsInTimeZone(now).month}`,
          type: "dormant_reengagement",
          fundId: row.fund_id,
          userId: row.user_id,
          email,
          parentFirstName: row.parent_first_name,
          childName,
          totalGifted,
          contributorCount,
          giftUrl,
          dashboardUrl,
        });
        fundState.dormantSentAt = now.toISOString();
        queued += 1;
        changed = true;
      }
    }

    state.byFund[row.fund_id] = fundState;
  }

  if (changed) {
    await saveState(state);
  }
  if (queued > 0) {
    log(`queued ${queued} parent lifecycle email(s)`, "parent-lifecycle-worker");
  }
}

async function processQueue(log: (message: string, source?: string) => void) {
  let raw = "";
  try {
    raw = await fs.readFile(PARENT_LIFECYCLE_QUEUE_PATH, "utf8");
  } catch {
    return;
  }
  if (!raw.trim()) return;
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return;

  const deliveryLog = await loadDeliveryLog();
  let deliveredCount = 0;

  for (const line of lines) {
    let parsed: QueueEntry | null = null;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!parsed) continue;
    const id = typeof parsed.id === "string" && parsed.id ? parsed.id : crypto.createHash("sha1").update(line).digest("hex");
    if (deliveryLog.deliveredById[id]) continue;
    const rendered = renderQueuedEmail(parsed);
    if (!rendered) continue;

    // Minimum-frame branded HTML wrap. See note in gifterNotificationWorker.
    const { html: brandedHtml } = renderKiddoEmail({
      heading: rendered.subject,
      intro: rendered.text,
    });
    const delivery = await sendEmail({
      to: rendered.to,
      subject: rendered.subject,
      text: rendered.text,
      html: brandedHtml,
      tags: ["parent_lifecycle", String(parsed.type || "unknown")],
      metadata: {
        queueId: id,
        lifecycleType: String(parsed.type || "unknown"),
        fundId: String(parsed.fundId || ""),
        userId: String(parsed.userId || ""),
      },
    });

    deliveryLog.deliveredById[id] = {
      deliveredAt: new Date().toISOString(),
      type: String(parsed.type || "unknown"),
      channel: delivery.mode,
    };
    const push = renderQueuedPush(parsed);
    if (push && parsed.userId) {
      await queueMobilePush({
        id: `parent_lifecycle_push:${id}`,
        type: String(parsed.type || "unknown"),
        userId: String(parsed.userId),
        title: push.title,
        body: push.body,
        deepLink: push.deepLink || "/dashboard",
        metadata: {
          fundId: String(parsed.fundId || ""),
          lifecycleType: String(parsed.type || "unknown"),
        },
      });
    }
    deliveredCount += 1;
  }

  if (deliveredCount > 0) {
    await saveDeliveryLog(deliveryLog);
    log(`processed ${deliveredCount} parent lifecycle email(s)`, "parent-lifecycle-worker");
  }
}

let running = false;

export async function runParentLifecycleWorker(log: (message: string, source?: string) => void = () => undefined) {
  if (running) return;
  running = true;
  try {
    await enqueueParentLifecycleEmails(log);
    await processQueue(log);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`parent lifecycle worker failed: ${message}`, "parent-lifecycle-worker");
  } finally {
    running = false;
  }
}

export function startParentLifecycleWorker(log: (message: string, source?: string) => void = () => undefined) {
  const intervalMs = Number(process.env.PARENT_LIFECYCLE_WORKER_INTERVAL_MS || 1000 * 60 * 20);
  void runParentLifecycleWorker(log);
  const interval = setInterval(() => {
    void runParentLifecycleWorker(log);
  }, intervalMs);
  log(`parent lifecycle worker started (every ${Math.round(intervalMs / 60000)} min, tz ${APP_TIMEZONE})`, "parent-lifecycle-worker");
  return interval;
}
