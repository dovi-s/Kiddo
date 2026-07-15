import crypto from "crypto";
import { isAnonGifterName } from "@shared/gifter-anon";
import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { renderKiddoEmail } from "./templates/baseTemplate";
import { getMarketQuote } from "./marketQuotes";
import { MONEY_CROSS_COPY } from "@shared/milestones";
import { GIFT_TAX_EXCLUSION_LABEL } from "@shared/legal-copy";

const GIFTER_NOTIFICATION_STATE_PATH = path.join(process.cwd(), ".local", "gifter-notifications.json");
const GIFTER_NOTIFICATION_QUEUE_PATH = path.join(process.cwd(), ".local", "gifter-notification-queue.jsonl");
const GIFTER_NOTIFICATION_OUTBOX_PATH = path.join(process.cwd(), ".local", "gifter-notification-outbox.jsonl");
const GIFTER_NOTIFICATION_DELIVERY_LOG_PATH = path.join(process.cwd(), ".local", "gifter-notification-deliveries.json");

const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/New_York";

type GifterNotificationSubscriber = {
  email: string;
  name: string | null;
  optedInAt: string;
  unsubscribed: boolean;
  unsubscribedAt: string | null;
  unsubscribeToken: string;
  contributionCount: number;
  totalContributed: number;
  fundIds: string[];
  lastGiftAt: string | null;
  lastBirthdayReminderYear: number | null;
  lastBirthdayReminderSentAt: string | null;
  // Holiday-trigger dedup. Tracks the calendar year the gifter most
  // recently received the Nov 15 – Dec 5 holiday gift-idea email so
  // the worker won't re-fire it within the same season even when its
  // tick lands inside the window many times. Per-fund (lives on the
  // fund-scoped subscriber record) so a gifter who's contributed to
  // two kids' funds gets two seasonal nudges, one per relationship.
  lastHolidayReminderYear: number | null;
  lastHolidayReminderSentAt: string | null;
  age18NotifiedAt: string | null;
  // Gifter-side fund-value milestone dedup. Stores the highest threshold the
  // gifter has been emailed about for this fund. Ratchet semantics: we only
  // email when a higher threshold crosses, never the same one twice. When a
  // fund jumps past multiple thresholds in one event (rare but possible
  // e.g. a $50k anonymous gift on a $5k fund crosses $10k, $25k, AND $50k),
  // we email about the HIGHEST crossed threshold to avoid spamming the same
  // gifter with three back-to-back emails about the same surge.
  lastMilestoneNotifiedThreshold: number | null;
  // Dormancy re-engagement dedup. ISO timestamp of the last
  // "we haven't seen you in a while" check-in email for this fund.
  // Enforces a 6-month minimum between dormancy nudges so a long-dormant
  // gifter never gets the same "we miss you" message twice in a year.
  // Null means we've never sent one (the most common state).
  lastDormancyCheckinAt: string | null;
  // Year-end recap dedup. Stores the calendar year the gifter most
  // recently received the December "year in giving" recap. Once per
  // calendar year per gifter (NOT per fund the recap aggregates
  // ALL funds the gifter has contributed to in that year).
  lastYearEndRecapYear: number | null;
  lastYearEndRecapSentAt: string | null;
  // Per feedback_anonymous_as_explicit_flag.md: when an anonymous
  // gifter opts into milestone updates, the system needs to keep
  // their email to send notifications, but every parent-facing
  // surface must hide it. This flag is the truth source. Set at
  // opt-in time from the underlying gift.isAnonymous; never inferred
  // from the email or name.
  isAnonymous: boolean;
};

type GifterNotificationSettings = {
  birthdayReminders: boolean;
  memoryBookSharing: boolean;
  age18Notification: boolean;
  memoryBookSharesSentThisYear: number;
  memoryBookShareYear: number;
  updatedAt: string;
};

type GifterMemoryShareRecord = {
  token: string;
  fundId: string;
  message: string;
  photoUrl: string | null;
  childName: string;
  parentName: string | null;
  parentMessage: string | null;
  startFundUrl: string | null;
  createdAt: string;
  recipientCount: number;
};

type GifterNotificationStore = {
  settingsByFund: Record<string, GifterNotificationSettings>;
  subscribersByFund: Record<string, Record<string, GifterNotificationSubscriber>>;
  memorySharesByToken: Record<string, GifterMemoryShareRecord>;
  // Day-7 follow-up dedup. giftId → ISO timestamp of when the Day-7
  // email was queued. Prevents the daily worker tick from re-firing
  // the same Day-7 if it runs multiple times during the 7–8 day
  // window. Per-gift (not per-gifter) because a gifter who gives
  // twice should get two Day-7 follow-ups, one per gift.
  day7SentByGiftId?: Record<string, string>;
  // Anniversary email dedup. Key shape: `${giftId}:${yearN}` where
  // yearN is the gift's nth anniversary (1, 2, 3...). Each year's
  // anniversary fires at most once even if the worker tick runs
  // many times in the anniversary window. Per-gift-per-year a
  // gift two years old can have already fired its 1st anniversary
  // and still be eligible for its 2nd.
  anniversarySentByKey?: Record<string, string>;
};

type QueueEntry = Record<string, unknown> & {
  id?: string;
  type?: string;
  fundId?: string;
  email?: string;
  childName?: string;
  createdAt?: string;
};

type DeliveryLog = {
  deliveredById: Record<string, { deliveredAt: string; channel: string; type: string }>;
};

type RenderedEmail = {
  to: string;
  subject: string;
  text: string;
  // Optional structured key/value rows the email base renders as a
  // small bordered table inside the card. Used by gift_receipt_followup
  // for receipt-grade formatting (reference, charge date, payment
  // method, amount, total charged). Other render functions can opt in
  // as needed. Locked 2026-05-19 per the gifter-receipt-grade upgrade.
  details?: Array<{ label: string; value: string }>;
};

type FundReminderRow = {
  id: string;
  slug: string | null;
  name: string | null;
  recipient_first_name: string | null;
  recipient_birthdate: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
};

function getAppBaseUrl() {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "https://kiddofund.com";
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

function isSameMonthDay(a: Date | string, b: Date | string) {
  const left = getDatePartsInTimeZone(a);
  const right = getDatePartsInTimeZone(b);
  return left.month === right.month && left.day === right.day;
}

// Days from `now` to the kid's NEXT birthday in the app's timezone.
// Returns 0 when today IS the birthday, never negative. Used to fire
// the 14-day lead-up reminder ("Emma's birthday is in 14 days") with
// a small grace window so we don't lose the reminder when the worker
// misses a daily run (deploy gap, server outage). When the next
// birthday falls inside the next 365 days, the count is exact in
// calendar-day terms.
function daysUntilNextBirthday(birthdate: Date | string, now: Date): number {
  const birth = getDatePartsInTimeZone(birthdate);
  const today = getDatePartsInTimeZone(now);
  // Build the next birthday in the app's TZ. If this year's birthday
  // already passed, roll to next year.
  const thisYear = new Date(Date.UTC(today.year, birth.month - 1, birth.day));
  const todayUTC = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const nextBirthday =
    thisYear.getTime() >= todayUTC.getTime()
      ? thisYear
      : new Date(Date.UTC(today.year + 1, birth.month - 1, birth.day));
  const diffMs = nextBirthday.getTime() - todayUTC.getTime();
  return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
}

function getAgeOnDate(birthdate: Date | string, today = new Date()) {
  const birth = getDatePartsInTimeZone(birthdate);
  const current = getDatePartsInTimeZone(today);
  let age = current.year - birth.year;
  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) {
    age -= 1;
  }
  return age;
}

// Renamed semantically this returns the kid's UTMA majority date, which
// is 18 in most states, 19 in AL/NE, 21 in MS/PA, etc. The fund's
// majority_age column is the source of truth (locked at fund creation).
function getMajorityBirthday(birthdate: Date | string, majorityAge: number = 18) {
  const safeAge = Number.isFinite(majorityAge) && majorityAge >= 18 && majorityAge <= 25 ? Math.floor(majorityAge) : 18;
  const birth = birthdate instanceof Date ? birthdate : new Date(birthdate);
  const majorityDate = new Date(birth);
  majorityDate.setFullYear(majorityDate.getFullYear() + safeAge);
  return majorityDate;
}

function createDefaultSettings(): GifterNotificationSettings {
  return {
    birthdayReminders: true,
    memoryBookSharing: true,
    age18Notification: true,
    memoryBookSharesSentThisYear: 0,
    memoryBookShareYear: new Date().getFullYear(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSettings(raw: any): GifterNotificationSettings {
  const defaults = createDefaultSettings();
  return {
    birthdayReminders: typeof raw?.birthdayReminders === "boolean" ? raw.birthdayReminders : defaults.birthdayReminders,
    memoryBookSharing: typeof raw?.memoryBookSharing === "boolean" ? raw.memoryBookSharing : defaults.memoryBookSharing,
    age18Notification: typeof raw?.age18Notification === "boolean" ? raw.age18Notification : defaults.age18Notification,
    memoryBookSharesSentThisYear: Number.isFinite(Number(raw?.memoryBookSharesSentThisYear))
      ? Math.max(0, Number(raw.memoryBookSharesSentThisYear))
      : defaults.memoryBookSharesSentThisYear,
    memoryBookShareYear: Number.isFinite(Number(raw?.memoryBookShareYear))
      ? Number(raw.memoryBookShareYear)
      : defaults.memoryBookShareYear,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : defaults.updatedAt,
  };
}

function normalizeSubscriber(email: string, raw: any): GifterNotificationSubscriber {
  return {
    email,
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : null,
    optedInAt: typeof raw?.optedInAt === "string" ? raw.optedInAt : new Date().toISOString(),
    unsubscribed: Boolean(raw?.unsubscribed),
    unsubscribedAt: typeof raw?.unsubscribedAt === "string" ? raw.unsubscribedAt : null,
    unsubscribeToken:
      typeof raw?.unsubscribeToken === "string" && raw.unsubscribeToken.trim()
        ? raw.unsubscribeToken.trim()
        : crypto.randomBytes(16).toString("hex"),
    contributionCount: Number.isFinite(Number(raw?.contributionCount)) ? Math.max(0, Number(raw.contributionCount)) : 0,
    totalContributed: Number.isFinite(Number(raw?.totalContributed)) ? Math.max(0, Number(raw.totalContributed)) : 0,
    fundIds: Array.isArray(raw?.fundIds) ? raw.fundIds.map((value: unknown) => String(value)).filter(Boolean) : [],
    lastGiftAt: typeof raw?.lastGiftAt === "string" ? raw.lastGiftAt : null,
    lastBirthdayReminderYear: Number.isFinite(Number(raw?.lastBirthdayReminderYear))
      ? Number(raw.lastBirthdayReminderYear)
      : null,
    lastBirthdayReminderSentAt: typeof raw?.lastBirthdayReminderSentAt === "string" ? raw.lastBirthdayReminderSentAt : null,
    lastHolidayReminderYear: Number.isFinite(Number(raw?.lastHolidayReminderYear))
      ? Number(raw.lastHolidayReminderYear)
      : null,
    lastHolidayReminderSentAt: typeof raw?.lastHolidayReminderSentAt === "string" ? raw.lastHolidayReminderSentAt : null,
    age18NotifiedAt: typeof raw?.age18NotifiedAt === "string" ? raw.age18NotifiedAt : null,
    lastMilestoneNotifiedThreshold: Number.isFinite(Number(raw?.lastMilestoneNotifiedThreshold))
      ? Math.max(0, Number(raw.lastMilestoneNotifiedThreshold))
      : null,
    lastDormancyCheckinAt: typeof raw?.lastDormancyCheckinAt === "string" ? raw.lastDormancyCheckinAt : null,
    lastYearEndRecapYear: Number.isFinite(Number(raw?.lastYearEndRecapYear))
      ? Number(raw.lastYearEndRecapYear)
      : null,
    lastYearEndRecapSentAt: typeof raw?.lastYearEndRecapSentAt === "string" ? raw.lastYearEndRecapSentAt : null,
    isAnonymous: Boolean(raw?.isAnonymous),
  };
}

async function loadNotificationStore(): Promise<GifterNotificationStore> {
  try {
    const raw = await fs.readFile(GIFTER_NOTIFICATION_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const settingsByFundRaw = parsed?.settingsByFund && typeof parsed.settingsByFund === "object" ? parsed.settingsByFund : {};
    const subscribersByFundRaw = parsed?.subscribersByFund && typeof parsed.subscribersByFund === "object" ? parsed.subscribersByFund : {};
    const memorySharesByTokenRaw = parsed?.memorySharesByToken && typeof parsed.memorySharesByToken === "object" ? parsed.memorySharesByToken : {};
    const day7SentRaw = parsed?.day7SentByGiftId && typeof parsed.day7SentByGiftId === "object" ? parsed.day7SentByGiftId : {};
    const anniversarySentRaw = parsed?.anniversarySentByKey && typeof parsed.anniversarySentByKey === "object" ? parsed.anniversarySentByKey : {};
    return {
      day7SentByGiftId: Object.fromEntries(
        Object.entries(day7SentRaw).map(([giftId, value]) => [String(giftId), String(value)]),
      ),
      anniversarySentByKey: Object.fromEntries(
        Object.entries(anniversarySentRaw).map(([key, value]) => [String(key), String(value)]),
      ),
      settingsByFund: Object.fromEntries(
        Object.entries(settingsByFundRaw).map(([fundId, value]) => [fundId, normalizeSettings(value)]),
      ),
      subscribersByFund: Object.fromEntries(
        Object.entries(subscribersByFundRaw).map(([fundId, value]) => [
          fundId,
          Object.fromEntries(
            Object.entries(value && typeof value === "object" ? value : {}).map(([email, subscriber]) => {
              const normalizedEmail = String(email || "").trim().toLowerCase();
              return [normalizedEmail, normalizeSubscriber(normalizedEmail, subscriber)];
            }),
          ),
        ]),
      ),
      memorySharesByToken: Object.fromEntries(
        Object.entries(memorySharesByTokenRaw).map(([token, value]: [string, any]) => [
          token,
          {
            token,
            fundId: String(value?.fundId || ""),
            message: String(value?.message || ""),
            photoUrl: typeof value?.photoUrl === "string" ? value.photoUrl : null,
            childName: String(value?.childName || "your child"),
            parentName: typeof value?.parentName === "string" ? value.parentName : null,
            parentMessage: typeof value?.parentMessage === "string" ? value.parentMessage : null,
            startFundUrl: typeof value?.startFundUrl === "string" ? value.startFundUrl : null,
            createdAt: typeof value?.createdAt === "string" ? value.createdAt : new Date().toISOString(),
            recipientCount: Number.isFinite(Number(value?.recipientCount)) ? Math.max(0, Number(value.recipientCount)) : 0,
          },
        ]),
      ),
    };
  } catch {
    return { settingsByFund: {}, subscribersByFund: {}, memorySharesByToken: {}, day7SentByGiftId: {}, anniversarySentByKey: {} };
  }
}

async function saveNotificationStore(store: GifterNotificationStore) {
  await fs.mkdir(path.dirname(GIFTER_NOTIFICATION_STATE_PATH), { recursive: true });
  await fs.writeFile(GIFTER_NOTIFICATION_STATE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function appendQueueEntry(entry: QueueEntry) {
  const payload = {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    ...entry,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(GIFTER_NOTIFICATION_QUEUE_PATH), { recursive: true });
  await fs.appendFile(GIFTER_NOTIFICATION_QUEUE_PATH, JSON.stringify(payload) + "\n", "utf8");
}

async function loadDeliveryLog(): Promise<DeliveryLog> {
  try {
    const raw = await fs.readFile(GIFTER_NOTIFICATION_DELIVERY_LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      deliveredById:
        parsed?.deliveredById && typeof parsed.deliveredById === "object"
          ? parsed.deliveredById
          : {},
    };
  } catch {
    return { deliveredById: {} };
  }
}

async function saveDeliveryLog(log: DeliveryLog) {
  await fs.mkdir(path.dirname(GIFTER_NOTIFICATION_DELIVERY_LOG_PATH), { recursive: true });
  await fs.writeFile(GIFTER_NOTIFICATION_DELIVERY_LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

async function appendOutbox(entry: Record<string, unknown>) {
  await fs.mkdir(path.dirname(GIFTER_NOTIFICATION_OUTBOX_PATH), { recursive: true });
  await fs.appendFile(GIFTER_NOTIFICATION_OUTBOX_PATH, JSON.stringify(entry) + "\n", "utf8");
}

async function getFundReminderRows(): Promise<FundReminderRow[]> {
  const result = await pool.query(`
    SELECT
      f.id,
      f.slug,
      f.name,
      f.recipient_first_name,
      f.recipient_birthdate,
      u.first_name AS owner_first_name,
      u.last_name AS owner_last_name
    FROM funds f
    LEFT JOIN users u ON u.id = f.user_id
    WHERE f.recipient_birthdate IS NOT NULL
      AND f.memorialized_at IS NULL -- bereavement freeze: never nudge gifters about a memorialized child (BEREAVEMENT_POSTURE.md)
      -- Exclude post-handoff funds: a transferred fund is owned by the now-adult recipient,
      -- so gifter birthday/holiday/age-18 reminders ("Emma's birthday is in 14 days") are
      -- contextually wrong once Emma is grown and owns the fund. Mirrors fundBirthdayWorker.
      AND f.transferred_at IS NULL
  `);
  return result.rows as FundReminderRow[];
}

async function getFundGiftAggregate(fundId: string) {
  const result = await pool.query(
    `
      SELECT
        COUNT(DISTINCT COALESCE(NULLIF(LOWER(TRIM(sender_email)), ''), LOWER(TRIM(sender_name))))::int AS total_contributors,
        COALESCE(SUM(CAST(amount AS numeric)), 0)::text AS total_gifted
      FROM gifts
      WHERE fund_id = $1
        AND status NOT IN ('failed', 'refunded', 'canceled')
    `,
    [fundId],
  );
  const row = result.rows[0] || {};
  return {
    totalContributors: Number(row.total_contributors || 0),
    totalGifted: Number(row.total_gifted || 0),
  };
}

function buildGiftUrl(baseUrl: string, fund: FundReminderRow) {
  if (fund.slug) return `${baseUrl}/${fund.slug}`;
  return `${baseUrl}/gift/${fund.id}`;
}

function buildUnsubscribeUrl(baseUrl: string, token: string) {
  return `${baseUrl}/updates/unsubscribe/${token}`;
}

function buildLoopStartFundUrl(baseUrl: string, fundId: string, touchpoint: string, channel: "email" | "web") {
  const params = new URLSearchParams({
    ref: `gift-success:${fundId || "unknown"}`,
    src: touchpoint,
    loop_touchpoint: touchpoint,
    loop_channel: channel,
  });
  return `${baseUrl}/get-started?${params.toString()}`;
}

function buildGiftProvenanceLine(childName: string) {
  return `Invested in ${childName}'s future with Kiddo.`;
}

function renderBirthdayReminder(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "your child").trim();
  const age = Number(entry.childAge || 0);
  const daysUntil = Number(entry.daysUntil || 0);
  const contributionCount = Number(entry.contributionCount || 0);
  // Fund-wide aggregate for the "growing up" line. When present, the
  // email weaves in "{childName}'s fund has $X today, built by Y
  // people" so the gifter sees the village they're part of, not just
  // their own slice. Merges the previously-planned Y1-Y17 series into
  // this single birthday-cycle email.
  const fundContributors = Number(entry.totalFundContributors || 0);
  const fundGifted = Number(entry.totalFundGifted || 0);
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  const giftUrl = String(entry.giftUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  if (!to || !childName || !giftUrl) return null;
  // Lead-up framing the email now fires 7-14 days before the birthday
  // (not on the day-of), so the subject + opening line speak to that
  // window. Gives the gifter time to actually send the gift before the
  // birthday arrives. Falls back to "today" copy if daysUntil is 0
  // (defensive shouldn't happen with the new window but keeps the
  // render safe for legacy queue entries that pre-date the change).
  const dayLabel =
    daysUntil <= 0
      ? "today"
      : daysUntil === 1
        ? "tomorrow"
        : daysUntil <= 7
          ? `in ${daysUntil} days`
          : `in ${daysUntil} days`;
  const subject =
    daysUntil <= 0
      ? `${childName} turns ${age} today`
      : `${childName} turns ${age} ${dayLabel}`;
  const repeatedLine =
    contributionCount > 1
      ? `You have gifted ${childName} ${contributionCount} times. Every one of those gifts is still part of their fund.`
      : `You gifted ${childName} before. That gift is still part of their fund.`;
  // "Growing-up" line the village context. Replaces the abandoned
  // separate Y1-Y17 series. Renders only when the aggregate values
  // are non-zero (a brand-new fund won't have either yet, in which
  // case the line falls out).
  const villageLine = (fundContributors > 0 && fundGifted > 0)
    ? `${childName}'s fund has $${fundGifted.toFixed(2)} today, built by ${fundContributors} ${fundContributors === 1 ? "person" : "people"}.`
    : null;
  // Age-specific milestone color for the most resonant ages. Quiet
  // additions to the email the gifter feels like the year matters
  // without it reading as a generic age-based marketing template.
  const ageColorLine = (() => {
    if (age === 1) return `One year of compounding. Small numbers now, real ones later.`;
    if (age === 5) return `Half a decade of building. The early gifts have had time to grow.`;
    if (age === 10) return `A decade in. The fund has had time to settle into a rhythm.`;
    if (age === 13) return `Teenage years. Eight more, and the fund becomes theirs.`;
    if (age === 16) return `Two more years until ${childName} takes the wheel.`;
    return "";
  })();
  const specialLine =
    age === 18
      ? `One more year. At 18, the fund becomes fully theirs. This birthday is one of the last chances to add to it before that moment arrives.`
      : "";
  return {
    to,
    subject,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `${childName} turns ${age} ${dayLabel}.`,
      "",
      repeatedLine,
      villageLine,
      ageColorLine,
      buildGiftProvenanceLine(childName),
      specialLine,
      "",
      `Gift again: ${giftUrl}`,
      startFundUrl ? `Start a fund for your own child: ${startFundUrl}` : "",
      "",
      "The Kiddo team",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Holiday gift-idea email. Fires Nov 15 – Dec 5, once per gifter per
// season per fund. The frame is honest: a Kiddo gift is the opposite
// of a stocking-stuffer that's gone by January. Includes the fund's
// village context (same aggregate as the birthday lead-up) so the
// gifter sees they're part of something already in motion.
function renderHolidayReminder(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "your child").trim();
  const contributionCount = Number(entry.contributionCount || 0);
  const fundContributors = Number(entry.totalFundContributors || 0);
  const fundGifted = Number(entry.totalFundGifted || 0);
  const giftUrl = String(entry.giftUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  if (!to || !childName || !giftUrl) return null;
  const repeatedLine =
    contributionCount > 1
      ? `You've given ${childName} ${contributionCount} times before. Every one of those gifts is still part of their fund.`
      : `You gave ${childName} a gift before. That gift is still part of their fund.`;
  const villageLine = (fundContributors > 0 && fundGifted > 0)
    ? `${childName}'s fund has $${fundGifted.toFixed(2)} today, built by ${fundContributors} ${fundContributors === 1 ? "person" : "people"}.`
    : null;
  return {
    to,
    subject: `A holiday gift for ${childName} that's still there in January`,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `Holiday gift season. Easy to give something that's gone by January.`,
      "",
      `A Kiddo gift to ${childName} stays. It compounds. They read your note when they're 18.`,
      "",
      repeatedLine,
      villageLine,
      buildGiftProvenanceLine(childName),
      "",
      `Add to ${childName}'s fund: ${giftUrl}`,
      startFundUrl ? `Or start a fund for your own child: ${startFundUrl}` : "",
      "",
      "The Kiddo team",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Age-18 retrospective email. Enhanced 2026-05-12 to give the gifter
// their own 18-year story, not just a generic "thanks for being part
// of the village" closing. The kid-at-18 lens applies to the GIFTER
// too: this is the moment where they get to see what their consistency
// (or single gift) actually became over 18 years of compounding.
// Includes personal stats (their $ contributed, their gift count, the
// fund's final size, their share of it), the locked majority age (18-21
// per state), and a forward-looking CTA that does not assume the
// gifter has young kids of their own (some are grandparents whose kids
// are grown). Per feedback_no_emdash.md: no em-dashes in copy.
function renderAge18Notification(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "your child").trim();
  const contributionCount = Number(entry.contributionCount || 0);
  const senderTotalContributed = Number(entry.senderTotalContributed || 0);
  const totalContributors = Number(entry.totalContributors || 0);
  const totalGifted = Number(entry.totalGifted || 0);
  const majorityAge = Number(entry.majorityAge || 18);
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  if (!to || !childName) return null;

  // Personal share of the fund. Honest fractional math: gifter's
  // contributions over total fund gifts. Renders as a percentage with
  // one decimal when meaningful; collapses to a short line when this
  // gifter contributed a trivially small share so we never imply a
  // single-gift gifter built half the fund.
  const personalShareLine = (() => {
    if (senderTotalContributed <= 0 || totalGifted <= 0) return null;
    const fraction = senderTotalContributed / totalGifted;
    if (fraction >= 0.005) {
      const pct = (fraction * 100).toFixed(fraction >= 0.1 ? 0 : 1);
      return `Your gifts make up ${pct}% of the fund.`;
    }
    return null;
  })();

  // Personal contribution history. Three states: multi-gift consistent
  // gifter (most emotional), single-gift gifter (still meaningful), and
  // opted-in-but-never-gifted (no personal stats, just village context).
  const personalHistoryLine = (() => {
    if (contributionCount > 1 && senderTotalContributed > 0) {
      return `You gave ${childName} $${senderTotalContributed.toFixed(2)} across ${contributionCount} gifts over the years. Every one of those is now theirs.`;
    }
    if (contributionCount === 1 && senderTotalContributed > 0) {
      return `Your $${senderTotalContributed.toFixed(2)} gift compounded over the years. It is now part of what they take into adulthood.`;
    }
    if (contributionCount > 0) {
      return `You gifted ${childName} ${contributionCount} time${contributionCount === 1 ? "" : "s"} over the years.`;
    }
    return `You were part of building ${childName}'s future.`;
  })();

  // Subject locks the majority age. "Turns 18" is the most common
  // case (most states); other states get the right number. Lowercase
  // for the "their fund is now theirs" line which reads as a soft
  // declaration rather than an announcement.
  const subject = `${childName} turns ${majorityAge} today. Their fund is now theirs.`;

  return {
    to,
    subject,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `${childName} turns ${majorityAge} today.`,
      "",
      `Their fund is now theirs. Everything family and friends built over the years is in their hands.`,
      "",
      personalHistoryLine,
      personalShareLine,
      `${totalContributors} people gifted a total of $${totalGifted.toFixed(2)} to make this fund what it became.`,
      buildGiftProvenanceLine(childName),
      "",
      "Thank you for being part of the story.",
      "",
      // CTA reframed: "for someone you love" not "for your own child"
      // since many age-18 gifters are grandparents whose kids are adults.
      // The fund-loop still applies (other grandchildren, nieces, godchildren)
      // but the older copy excluded them.
      startFundUrl ? `Start a fund for someone you love: ${startFundUrl}` : "",
      "",
      "The Kiddo team",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function renderMemoryBookShare(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "your child").trim();
  const shareUrl = String(entry.shareUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeToken ? buildUnsubscribeUrl(getAppBaseUrl(), String(entry.unsubscribeToken)) : "").trim();
  if (!to || !childName || !shareUrl) return null;
  return {
    to,
    subject: `An update from ${childName}'s Memory Book`,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `A new update from ${childName}'s Memory Book is ready to view.`,
      buildGiftProvenanceLine(childName),
      `See the shared update: ${shareUrl}`,
      startFundUrl ? `Start a fund for your own child: ${startFundUrl}` : "",
      "",
      "The Kiddo team",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function renderOptInConfirmation(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "your child").trim();
  if (!to) return null;
  return {
    to,
    subject: `You will hear when ${childName} reaches milestones`,
    text: [
      `Hi${entry.senderName ? ` ${entry.senderName}` : ""},`,
      "",
      `You opted in to milestone updates for ${childName}.`,
      "",
      buildGiftProvenanceLine(childName),
      "We will send you birthday reminders, parent-shared Memory Book updates, and one final note when the child turns 18.",
      "Parents control what updates are shared. We do not send balance updates or investment-performance claims unless the parent explicitly shares an accurate update.",
      "",
      "You can unsubscribe from any of those emails at any time.",
      "",
      "The Kiddo team",
    ].join("\n"),
  };
}

function renderGiftReceiptFollowup(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "their child").trim();
  const amount = Number(entry.amount || 0);
  const ticker = String(entry.ticker || "").trim().toUpperCase();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const giftUrl = String(entry.giftUrl || "").trim();
  const eventName = entry.eventName ? String(entry.eventName).trim() : null;
  if (!to || !startFundUrl) return null;

  const occasionLabel = eventName ? `'s ${eventName}` : "";
  const subject = eventName
    ? `Receipt: your gift for ${childName}'s ${eventName}`
    : `Receipt: your gift to ${childName}`;

  const giftLine = amount > 0
    ? ticker
      ? `Your $${amount.toFixed(2)} gift is being invested in ${ticker} for ${childName}${occasionLabel}. It will sit there and grow.`
      : `Your $${amount.toFixed(2)} gift for ${childName}${occasionLabel} is confirmed and headed into ${childName}'s UTMA investment fund.`
    : `Your gift for ${childName}${occasionLabel} is confirmed.`;

  // Honest disclosure of where the gifter's name shows up. Previously the
  // email mentioned the note going into the Memory Book but never told the
  // gifter their NAME also appears there + on the gift page's "who's already
  // given" social-proof list. This is the only paper trail they get; it
  // should be complete.
  const namedSender = entry.senderName ? String(entry.senderName).trim() : "";
  const isAnonymous = isAnonGifterName(namedSender);
  const visibilityLine = isAnonymous
    ? "You sent this anonymously, so no name appears on the Memory Book or the gift page."
    : `Your first name (${namedSender.split(/\s+/)[0]}) appears in ${childName}'s family Memory Book and as a "who's already given" name on their gift page. Full name stays private. Reply to this email if you'd like it changed.`;

  // ─── Receipt-grade details block ────────────────────────────────
  // Locked 2026-05-19 per the gifter-receipt audit. The prior email
  // was a warm thank-you; sophisticated gifters (grandparents giving
  // $1k+, professionals tracking gift-tax compliance via Form 709)
  // need a structured "for your records" block alongside the prose.
  // All fields are nullable upstream when Stripe enrichment fails
  // the block simply renders fewer rows or skips entirely.
  const details: Array<{ label: string; value: string }> = [];
  const receiptReference = entry.receiptReference ? String(entry.receiptReference).trim() : "";
  const chargedAtIso = entry.chargedAtIso ? String(entry.chargedAtIso).trim() : "";
  const pmBrand = entry.paymentMethodBrand ? String(entry.paymentMethodBrand).trim() : "";
  const pmLast4 = entry.paymentMethodLast4 ? String(entry.paymentMethodLast4).trim() : "";
  const totalChargedCents = typeof entry.totalChargedCents === "number" ? (entry.totalChargedCents as number) : null;
  const chargedAtDate = chargedAtIso ? new Date(chargedAtIso) : null;
  const chargedAtLabel = chargedAtDate && Number.isFinite(chargedAtDate.getTime())
    ? chargedAtDate.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : null;
  if (receiptReference) details.push({ label: "Receipt reference", value: receiptReference });
  if (chargedAtLabel) details.push({ label: "Charged", value: chargedAtLabel });
  if (pmBrand) {
    const pmDisplay = pmLast4
      ? `${pmBrand.charAt(0).toUpperCase() + pmBrand.slice(1)} ····${pmLast4}`
      : pmBrand.charAt(0).toUpperCase() + pmBrand.slice(1);
    details.push({ label: "Payment method", value: pmDisplay });
  }
  if (amount > 0) details.push({ label: "Gift amount", value: `$${amount.toFixed(2)}` });
  if (typeof totalChargedCents === "number") {
    const total = totalChargedCents / 100;
    const fees = total - amount;
    if (fees > 0.005) {
      details.push({ label: "Processing fee", value: `$${fees.toFixed(2)}` });
    }
    details.push({ label: "Total charged", value: `$${total.toFixed(2)}` });
  }
  details.push({ label: "Recipient", value: `${childName}'s UTMA · custody at our broker-dealer partner once invested` });

  // Plain-text version of the receipt block fixed-width alignment
  // for monospace viewers (some CPAs forward these to their inbox as
  // text-only). Two-column with right-padded labels, dotted lines
  // between rows.
  const textReceiptBlock = details.length > 0
    ? [
        "",
        "Receipt details",
        "----------------------------------------",
        ...details.map((r) => `${r.label.padEnd(22, " ")}${r.value}`),
        "----------------------------------------",
      ].join("\n")
    : "";

  // Tax-implications briefing locked 2026-05-19 per the Five Towns
  // gifter polish. A wealthy gifter giving $5k+ needs to know:
  //   (a) THEY have no tax liability on this gift
  //   (b) The parent files the 1099s issued by DriveWealth
  //   (c) Kiddie-tax rules apply at the recipient level above the
  //       inflation-adjusted threshold (currently $2,700/yr for 2025)
  //   (d) Form 709 may apply if THIS gifter's total annual gifts to
  //       this recipient exceed the IRS annual exclusion (GIFT_TAX_EXCLUSION_LABEL
  //       in @shared/legal-copy, rising with inflation)
  // Kept brief; the gifter's CPA fills in the rest.
  const taxLine = amount >= 500
    ? `Tax note: gifts to a UTMA are not deductible to the gifter and create no tax liability for you. ${childName}'s parent receives the annual 1099-DIV / 1099-B from our broker-dealer partner. If your total gifts to ${childName} across the calendar year exceed the IRS annual gift-tax exclusion (${GIFT_TAX_EXCLUSION_LABEL} per recipient, adjusted yearly), you may need to file Form 709. Your CPA can confirm.`
    : "";

  return {
    to,
    subject,
    text: [
      `Hi${namedSender ? ` ${namedSender}` : ""},`,
      "",
      giftLine,
      buildGiftProvenanceLine(childName),
      textReceiptBlock,
      "",
      "Your note goes into their Memory Book. They will read it someday alongside the story of this gift.",
      "",
      visibilityLine,
      "",
      taxLine,
      "",
      giftUrl ? `Gift again any time: ${giftUrl}` : "",
      "",
      // Sponsor-Plus secondary CTA, only when the recipient fund is on
      // Free tier (eligibleForSponsorship=true gets set server-side at
      // queue time). Per project_gifter_sponsors_plus_subscription.md
      // (locked 2026-05-23). The CTA points at the fund's GiftCheckout
      // with ?sponsor=1 so the SponsorPlusCard sidebar is surfaced on
      // load. Soft language ('one more way to show up') keeps this from
      // reading as a paywall pitch; the CTA is the same scale as the
      // existing 'start a fund' below it, not larger.
      entry.eligibleForSponsorship && entry.sponsorUrl ? `One more way to show up for ${childName}'s family?` : "",
      entry.eligibleForSponsorship && entry.sponsorUrl
        ? `For \$29, you can cover a year of Kiddo Plus for ${childName}'s fund — unlocks recurring gifts for everyone who gives, parent-authored Memory Book media, and a custom fund mix.`
        : "",
      entry.eligibleForSponsorship && entry.sponsorUrl ? `Cover Plus for them: ${entry.sponsorUrl}` : "",
      entry.eligibleForSponsorship && entry.sponsorUrl ? "" : "",
      // Gifter→parent conversion CTA. Per project_pre_launch_strategic_frame.md
      // (locked 2026-05-23): every one-time gift success email gets a soft
      // "want one for your own kid?" CTA. Greenlight/Acorns structurally
      // can't replicate this — they don't have a gifter loop. Probably 5-10%
      // conversion from this high-intent moment. Sharpened 2026-05-23 to
      // reference the just-experienced moment and frame the kid-2.0
      // family-spanning story rather than the generic feature pitch.
      "Want one for your own child or grandchild?",
      `You just experienced what it's like to give a lasting investment gift. Set up a fund for someone you love and let your whole family show up for them the way you just showed up for ${childName}.`,
      `Start a fund: ${startFundUrl}`,
      "",
      "Kiddo, Inc. is a technology company, not a broker-dealer.",
      "When investing is live, securities are offered through our broker-dealer partner (Member FINRA/SIPC).",
      "Keep this email for your records.",
      "",
      "The Kiddo team",
    ]
      .filter(Boolean)
      .join("\n"),
    // The HTML wrapper picks this up and renders a bordered key/value
    // table inside the email card.
    details,
  };
}

// Gifter milestone email. Fires when the fund this gifter has contributed
// to crosses one of the meaningful money thresholds ($1k+; we skip $100/$500
// because they're noisy and would email gifters multiple times in the early
// weeks of a fund). Per-gifter ratchet dedup via lastMilestoneNotifiedThreshold
// never email the same threshold twice, and skip lower thresholds if the
// fund jumped past several at once. The emotional anchor in the body comes
// from the same shared/milestones.ts copy table the in-app celebration card
// and the parent email use, so all three surfaces tell the same story at a
// given threshold.
function renderGifterMilestoneCrossed(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "their child").trim();
  const senderName = String(entry.name || "").trim();
  const senderFirst = senderName ? senderName.split(/\s+/)[0] : "";
  const threshold = Number(entry.threshold || 0);
  const emotionalLine = String(entry.emotionalLine || "").trim();
  const contributorCount = Number(entry.contributorCount || 0);
  const giftCount = Number(entry.giftCount || 0);
  const totalContributed = Number(entry.totalContributed || 0);
  const giftUrl = String(entry.giftUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  if (!to || !giftUrl || threshold <= 0) return null;

  const thresholdLabel = threshold >= 1_000_000
    ? `$${(threshold / 1_000_000).toFixed(1)}M`
    : threshold >= 1_000
      ? `$${(threshold / 1_000).toFixed(0)}K`
      : `$${threshold}`;

  // Body lines built sequentially so we can drop any that would feel forced
  // (e.g. contributorCount = 1 means the gifter alone crossed it; a
  // "You're one of 1 person" line would read as broken).
  const villageLine = contributorCount > 1
    ? `${contributorCount} people have helped build this fund. You're one of them.`
    : `Your gifts have helped ${childName}'s fund cross this milestone.`;

  const personalLine = (() => {
    if (giftCount <= 0) return "";
    const giftWord = giftCount === 1 ? "gift" : "gifts";
    if (totalContributed > 0) {
      return `Your ${giftCount} ${giftWord} ${giftCount === 1 ? "has" : "have"} added $${totalContributed.toFixed(2)} over time.`;
    }
    return `Your ${giftCount} ${giftWord} ${giftCount === 1 ? "is" : "are"} part of this story.`;
  })();

  // Subject uses the compact label ("$5K") for inbox scannability.
  // Body uses the full number ("$5,000") because the gifter is now reading
  // not scanning, and the comma-grouped form lands more concretely.
  const fullAmount = `$${threshold.toLocaleString("en-US")}`;

  return {
    to,
    subject: `${childName}'s fund just crossed ${thresholdLabel}`,
    text: [
      `Hi${senderFirst ? ` ${senderFirst}` : ""},`,
      "",
      `${childName}'s fund just crossed ${fullAmount}.`,
      emotionalLine || "",
      "",
      villageLine,
      personalLine,
      "",
      `If you'd like to add another gift: ${giftUrl}`,
      "",
      "The Kiddo team",
      unsubscribeUrl ? "" : "",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter((line) => line !== null && line !== undefined)
      .join("\n"),
  };
}

// Parent thank-you email. Fires when a parent marks a thank-you note as
// sent in the dashboard. Distinct from auto-generated transactional
// receipts because this is a HUMAN message the parent personally wrote
// (or composed from a template) for this specific gifter. Treated as
// transactional in terms of unsubscribe gating a personal thank-you
// addressed to a specific gifter is not a marketing email even when
// the gifter has opted out of lifecycle reminders. Per
// project_seth_godin_kora_alignment.md: a thank-you the gifter forwarded
// or screenshotted is the cleanest organic acquisition surface we have.
function renderParentThankYou(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "their child").trim();
  const parentMessage = String(entry.parentMessage || "").trim();
  const parentName = entry.parentName ? String(entry.parentName).trim() : null;
  const giftAmount = Number(entry.giftAmount || 0);
  const giftUrl = String(entry.giftUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  if (!to || !childName || !parentMessage) return null;

  // Subject leads with the parent's name when known so the gifter sees
  // "Sarah sent you a note" not the impersonal "An update from Emma's
  // family". Falls back gracefully when parent name is missing.
  const subject = parentName
    ? `${parentName} sent you a note about your gift to ${childName}`
    : `A thank-you for your gift to ${childName}`;

  const amountLine = giftAmount > 0
    ? `Your $${giftAmount.toFixed(2)} gift to ${childName}.`
    : `Your gift to ${childName}.`;

  return {
    to,
    subject,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      parentName
        ? `${parentName} wrote you a note about your gift:`
        : `${childName}'s family wrote you a note about your gift:`,
      "",
      // Indent the parent's message so it visually reads as a quoted
      // human note, not Kiddo system copy. Each line gets a "> " prefix.
      parentMessage.split(/\r?\n/).map((line) => `> ${line}`).join("\n"),
      "",
      amountLine,
      buildGiftProvenanceLine(childName),
      "",
      giftUrl ? `Want to do it again? ${giftUrl}` : "",
      startFundUrl ? `Or start a fund for someone you love: ${startFundUrl}` : "",
      "",
      "The Kiddo team",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Dormancy re-engagement email. Fires when a gifter has not given to a
// fund in 6+ months AND the fund has been active in that gap (other
// gifts received, milestones crossed). Honest framing: "Emma is N now,
// her fund has grown to $X, you were part of building it" not
// guilt-trip, not "Don't miss out", just a quiet check-in with real
// context. Once per gifter per fund per 6-month window. Skipped when
// the gifter is unsubscribed OR when the parent has the birthdayReminders
// umbrella setting off (same gate as birthday/holiday/age-18 reminders;
// a gifter who turned off lifecycle nudges does not want dormancy nudges
// either). Per feedback_no_emdash.md: no em-dashes in the copy.
function renderDormancyCheckIn(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "your child").trim();
  const monthsSinceLastGift = Number(entry.monthsSinceLastGift || 0);
  const childAge = Number(entry.childAge || 0);
  const fundTotalGifted = Number(entry.fundTotalGifted || 0);
  const fundContributors = Number(entry.fundContributors || 0);
  const senderTotalContributed = Number(entry.senderTotalContributed || 0);
  const senderGiftCount = Number(entry.senderGiftCount || 0);
  const giftUrl = String(entry.giftUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  if (!to || !childName || !giftUrl) return null;

  // Time-since phrasing. We keep the framing soft and factual instead
  // of using guilt-trip copy. "It has been about a year" reads better
  // than "It has been 12 months", so collapse common ranges.
  const timeSinceLabel = (() => {
    if (monthsSinceLastGift >= 24) return `over two years`;
    if (monthsSinceLastGift >= 18) return `about a year and a half`;
    if (monthsSinceLastGift >= 12) return `about a year`;
    if (monthsSinceLastGift >= 9) return `nearly a year`;
    if (monthsSinceLastGift >= 6) return `about six months`;
    return `a while`;
  })();

  // Subject leans on fund momentum, not on the gifter's silence. Tells
  // them what they MISSED, not that they were silent. Pattern lifted
  // from milestone-crossed emails which read calmly.
  const subject = fundTotalGifted >= 1000
    ? `${childName}'s fund has grown to $${fundTotalGifted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `An update on ${childName}'s fund`;

  // Personal-history line. If the gifter has given multiple times,
  // surface the cumulative effort so they feel the relationship,
  // not the silence.
  const personalLine = senderGiftCount > 1 && senderTotalContributed > 0
    ? `You gave ${childName} $${senderTotalContributed.toFixed(2)} across ${senderGiftCount} gifts. That money is still in the fund, still compounding.`
    : senderTotalContributed > 0
      ? `Your $${senderTotalContributed.toFixed(2)} gift is still in the fund, still compounding.`
      : `Your gift is still in the fund, still compounding.`;

  // Village line. Same shape as birthday lead-up so the page register
  // stays consistent across all fund-context emails.
  const villageLine = (fundContributors > 0 && fundTotalGifted > 0)
    ? `${childName}'s fund has $${fundTotalGifted.toFixed(2)} today, built by ${fundContributors} ${fundContributors === 1 ? "person" : "people"}.`
    : null;

  // Age anchor. Only render when we have an age and it is a meaningful
  // marker. Quiet, not breathless.
  const ageLine = childAge > 0 && childAge < 18
    ? `${childName} is ${childAge} now.`
    : null;

  return {
    to,
    subject,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `It has been ${timeSinceLabel} since you gave to ${childName}. Here is where their fund stands today.`,
      "",
      ageLine,
      villageLine,
      personalLine,
      buildGiftProvenanceLine(childName),
      "",
      `Add to ${childName}'s fund: ${giftUrl}`,
      startFundUrl ? `Or start a fund for someone you love: ${startFundUrl}` : "",
      "",
      "The Kiddo team",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Year-end recap email. Fires mid-December once per gifter per
// calendar year. THE FIRST cross-fund email in the system: aggregates
// every gift the gifter sent in the current year across all funds
// they've contributed to, then frames it as a "your year in giving"
// recap. Doubles as: (1) personal-record receipt for the gifter (some
// jurisdictions ask gifters to keep their own records even though the
// UTMA tax sits with the kid/custodian), (2) brand re-entry moment in
// the Jan resolution window when families plan the year ahead, and
// (3) forwardable content that lets gifters share their giving story
// with their spouse or extended family natural organic acquisition.
//
// Per feedback_anonymous_as_explicit_flag.md: anonymous gifts ARE
// counted in the aggregate (their email is real and the dollars are
// real) but the recap copy avoids naming the recipient when the gift
// was anonymous on a fund where the gifter has ONLY anonymous gifts
// to that recipient. Mixed-history (some anon, some named) shows the
// named child but the dollar total is the full sum gifters who
// gave anonymously presumably still want to know their own year-end
// total.
function renderYearEndRecap(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const year = Number(entry.year || 0);
  const totalGiven = Number(entry.totalGiven || 0);
  const giftCount = Number(entry.giftCount || 0);
  const childNames: string[] = Array.isArray(entry.childNames)
    ? (entry.childNames as unknown[]).map((value) => String(value).trim()).filter(Boolean)
    : [];
  const fundCount = Number(entry.fundCount || childNames.length || 0);
  const primaryGiftUrl = String(entry.primaryGiftUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  if (!to || !year || giftCount <= 0 || totalGiven <= 0) return null;

  // Format recipient list. Single child reads as a name; two reads as
  // "Emma and Mila"; three+ collapses to "{first}, {second}, and N
  // others" so the subject line doesn't sprawl. Empty list (rare
  // edge case where every gift was to a deleted fund) falls back to
  // generic phrasing.
  const recipientLabel = (() => {
    if (childNames.length === 0) return `${fundCount} ${fundCount === 1 ? "child" : "children"}`;
    if (childNames.length === 1) return childNames[0];
    if (childNames.length === 2) return `${childNames[0]} and ${childNames[1]}`;
    const named = childNames.slice(0, 2).join(", ");
    const remaining = childNames.length - 2;
    return `${named}, and ${remaining} ${remaining === 1 ? "other" : "others"}`;
  })();

  // Format the total nicely (no decimals when whole; one decimal for
  // partial cents would look weird at this scale).
  const totalLabel = `$${totalGiven.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const giftCountLabel = giftCount === 1 ? "one gift" : `${giftCount} gifts`;

  const subject = `Your ${year} in giving`;

  return {
    to,
    subject,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `Here is your ${year} in gifts on Kiddo.`,
      "",
      `You gave ${recipientLabel} ${totalLabel} across ${giftCountLabel} this year.`,
      "",
      // Brief reflection lines. Quiet and factual; no celebratory
      // emoji storm, no manipulative "WOW look what YOU did!" framing.
      // The recipient list and total speak for themselves.
      "Every one of those gifts is invested and compounding toward the day each kid turns 18.",
      "",
      // CTAs. Primary is a soft "keep going next year" link to the
      // first fund the gifter has contributed to (or the generic gift
      // landing if no specific fund is recoverable). Secondary is the
      // start-fund loop. Both carry tracking params.
      primaryGiftUrl ? `Keep going in ${year + 1}: ${primaryGiftUrl}` : "",
      startFundUrl ? `Or start a fund for someone you love: ${startFundUrl}` : "",
      "",
      "Thank you for being part of these kids' stories.",
      "",
      "The Kiddo team",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function renderQueuedEmail(entry: QueueEntry): RenderedEmail | null {
  switch (String(entry.type || "")) {
    case "gift_receipt_followup":
      return renderGiftReceiptFollowup(entry);
    case "gift_day7_followup":
      return renderGiftDay7Followup(entry);
    case "gift_anniversary":
      return renderGiftAnniversary(entry);
    case "birthday_reminder":
      return renderBirthdayReminder(entry);
    case "holiday_reminder":
      return renderHolidayReminder(entry);
    case "age18_notification":
      return renderAge18Notification(entry);
    case "memory_book_share":
      return renderMemoryBookShare(entry);
    case "gifter_opt_in":
      return renderOptInConfirmation(entry);
    case "gifter_milestone_crossed":
      return renderGifterMilestoneCrossed(entry);
    case "parent_thank_you":
      return renderParentThankYou(entry);
    case "dormancy_checkin":
      return renderDormancyCheckIn(entry);
    case "year_end_recap":
      return renderYearEndRecap(entry);
    default:
      return null;
  }
}

// Day-7 growth check-in email. Fires ~7 days after a gift, telling
// the gifter the gift IS invested and starting to grow. Without a
// live-price call (which would add an external dependency to the
// worker), the copy avoids fabricating numbers and stays at the
// "your gift is invested in {ticker}" framing honest about the
// state without inventing growth figures. The included gift link
// lets them gift again with one tap, which is the actual loop the
// design lens cares about.
function renderGiftDay7Followup(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "their child").trim();
  const amount = Number(entry.amount || 0);
  const ticker = String(entry.ticker || "").trim().toUpperCase();
  const currentValue = typeof entry.currentValue === "number" && Number.isFinite(entry.currentValue) && entry.currentValue > 0
    ? entry.currentValue
    : null;
  const giftUrl = String(entry.giftUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  if (!to || !childName || !giftUrl || amount <= 0) return null;
  const amountLabel = `$${amount.toFixed(2)}`;
  // Growth line uses live price snapshot taken at enqueue time.
  // Falls back gracefully when the price service had no quote (ticker
  // missing from universe, provider failure, no shares stamped) so the
  // email never fabricates a number. Honest framing per the locked
  // "no greenwashing losses" rule: when value is BELOW gift amount we
  // still show it losses are time-framed, not hidden. The
  // "growing alongside everything else they own" line carries the
  // emotional payload for funds where the live value isn't computable.
  const valueLine = (() => {
    if (currentValue === null) return null;
    const valueLabel = `$${currentValue.toFixed(2)}`;
    const delta = currentValue - amount;
    const deltaAbs = Math.abs(delta).toFixed(2);
    if (Math.abs(delta) < 0.01) {
      return `It's now worth ${valueLabel}. Markets just opened on this one.`;
    }
    if (delta > 0) {
      return `It's now worth ${valueLabel} (+$${deltaAbs}) 🌱`;
    }
    return `It's now worth ${valueLabel} (−$${deltaAbs}). Markets move in both directions; this is one snapshot in 18 years.`;
  })();
  const tickerLine = ticker
    ? `Your gift is invested in ${ticker}. It's part of ${childName}'s portfolio now, growing alongside everything else they own.`
    : `Your gift is invested across ${childName}'s portfolio, growing alongside everything else they own.`;
  return {
    to,
    subject: `Your ${amountLabel} gift to ${childName} is invested 🌱`,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `A week ago you gave ${childName} ${amountLabel}. Today, that gift is invested.`,
      "",
      tickerLine,
      valueLine,
      buildGiftProvenanceLine(childName),
      "",
      `Want to do it again? ${giftUrl}`,
      startFundUrl ? `Or start a fund for your own child: ${startFundUrl}` : "",
      "",
      "--",
      "The Kiddo team",
      "",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Anniversary email render. Fires on the gift's 1st, 2nd, 3rd... year
// anniversary (capped at the kid's majority age). The emotional beat
// is "a year ago you gave; here's what it's grown into" same
// honest-loss / time-framed pattern as Day-7. Year 1 gets warmer copy
// because it's the milestone-feeling first anniversary.
function renderGiftAnniversary(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "their child").trim();
  const amount = Number(entry.amount || 0);
  const yearN = Math.max(1, Number(entry.yearN || 1));
  const ticker = String(entry.ticker || "").trim().toUpperCase();
  const currentValue = typeof entry.currentValue === "number" && Number.isFinite(entry.currentValue) && entry.currentValue > 0
    ? entry.currentValue
    : null;
  const giftUrl = String(entry.giftUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  if (!to || !childName || !giftUrl || amount <= 0) return null;
  const amountLabel = `$${amount.toFixed(2)}`;
  const yearLabel = yearN === 1 ? "One year" : `${yearN} years`;
  const valueLine = (() => {
    if (currentValue === null) return null;
    const valueLabel = `$${currentValue.toFixed(2)}`;
    const delta = currentValue - amount;
    const deltaAbs = Math.abs(delta).toFixed(2);
    if (Math.abs(delta) < 0.01) {
      return `It's worth ${valueLabel} today, same as the day you gave it.`;
    }
    if (delta > 0) {
      return `It's worth ${valueLabel} today. That's $${deltaAbs} of growth over ${yearLabel.toLowerCase()}. 🌱`;
    }
    // Honest losses, time-framed (locked feedback_no_greenwashing_losses).
    return `It's worth ${valueLabel} today (−$${deltaAbs} from where it started). The fund has 18 years to compound; ${yearLabel.toLowerCase()} is one snapshot.`;
  })();
  const tickerLine = ticker
    ? `Your gift sat in ${childName}'s ${ticker} position the whole time. It's still there.`
    : `Your gift has been part of ${childName}'s portfolio the whole time. It's still there.`;
  return {
    to,
    subject: yearN === 1
      ? `${yearLabel} ago, you gave ${childName} ${amountLabel}`
      : `${yearLabel} ago: your gift to ${childName}`,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      yearN === 1
        ? `One year ago today, you gave ${childName} ${amountLabel}.`
        : `${yearLabel} ago today, you gave ${childName} ${amountLabel}.`,
      "",
      tickerLine,
      valueLine,
      buildGiftProvenanceLine(childName),
      "",
      `Want to add to it? ${giftUrl}`,
      startFundUrl ? `Or start a fund for your own child: ${startFundUrl}` : "",
      "",
      "--",
      "The Kiddo team",
      "",
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Day-7 growth check-in. Fires roughly a week after a gifter's gift
// the highest-leverage WOM loop in the product per the design lens
// ("the gifter who just gave is the one most likely to give again").
// Calendar-based daily scan: any gift whose createdAt falls in the
// 7–8 day window AND has a senderEmail AND hasn't already been
// stamped as Day-7-sent gets enqueued. Window (not single day) is
// the same grace pattern as the birthday lead-up the worker may
// miss a tick during a deploy, and a one-day window would lose the
// follow-up for affected gifts. Window also widens to 14 days as a
// hard upper bound so backfill on first deploy doesn't enqueue
// follow-ups for gifts that are already weeks old (those are too
// late to feel like a follow-up).
//
// Scope: ALL gifts with a senderEmail, opt-in OR opt-out same
// precedent as the immediate gift_receipt_followup which sends
// transactionally. Day-7 is an extension of that receipt cluster,
// not a marketing email. Every email carries an unsubscribe link;
// gifters who unsubscribed for the fund (subscribersByFund[email]
// .unsubscribed === true) are skipped here. Anonymous / no-email
// gifts are skipped at the SQL filter.
async function enqueueGiftDay7Followups(log: (message: string, source?: string) => void) {
  const result = await pool.query(`
    SELECT
      g.id,
      g.fund_id,
      g.sender_email,
      g.sender_name,
      g.amount,
      g.selected_ticker,
      g.created_at,
      g.shares_acquired,
      f.slug AS fund_slug,
      f.recipient_first_name,
      f.name AS fund_name
    FROM gifts g
    LEFT JOIN funds f ON f.id = g.fund_id
    WHERE g.sender_email IS NOT NULL
      AND (f.memorialized_at IS NULL) -- bereavement: exclude memorialized recipients (BEREAVEMENT_POSTURE.md)
      AND TRIM(g.sender_email) <> ''
      AND g.status NOT IN ('failed', 'refunded', 'canceled', 'host_hold', 'pending')
      AND g.created_at >= NOW() - INTERVAL '14 days'
      AND g.created_at <= NOW() - INTERVAL '7 days'
  `);

  if (result.rows.length === 0) return;

  const store = await loadNotificationStore();
  const day7Sent = store.day7SentByGiftId || {};
  const baseUrl = getAppBaseUrl();
  let queued = 0;
  let storeChanged = false;

  for (const row of result.rows as Array<{
    id: string;
    fund_id: string;
    sender_email: string;
    sender_name: string | null;
    amount: string;
    selected_ticker: string | null;
    created_at: string;
    shares_acquired: string | null;
    fund_slug: string | null;
    recipient_first_name: string | null;
    fund_name: string | null;
  }>) {
    const giftId = String(row.id);
    if (day7Sent[giftId]) continue;

    const email = String(row.sender_email || "").trim().toLowerCase();
    if (!email) continue;

    // Honor unsubscribe state if the gifter is in the per-fund
    // subscriber map and has flipped to unsubscribed. Gifters who
    // never opted in for ongoing emails won't be in the map at all
    // they still get the Day-7 (it's transactional). The
    // unsubscribe link in this email lets them opt out of future
    // ones if they want.
    const subscriber = store.subscribersByFund?.[row.fund_id]?.[email];
    if (subscriber?.unsubscribed) {
      // Mark as "sent" anyway so we don't re-evaluate this gift on
      // every worker tick once unsubscribed, always skipped.
      day7Sent[giftId] = new Date().toISOString();
      storeChanged = true;
      continue;
    }

    const childName = row.recipient_first_name || row.fund_name || "their child";
    const fundUrlFund = { id: row.fund_id, slug: row.fund_slug, name: row.fund_name } as FundReminderRow;
    const giftUrl = buildGiftUrl(baseUrl, fundUrlFund);
    const startFundUrl = buildLoopStartFundUrl(baseUrl, row.fund_id, "gift_day7_followup_email", "email");
    // Unsubscribe URL if the gifter has a subscriber record, use
    // their token; otherwise mint one on the fly so unsubscribe still
    // works for opt-out-only gifters. The /updates/unsubscribe route
    // accepts either path.
    const unsubscribeToken = subscriber?.unsubscribeToken
      || crypto.createHash("sha1").update(`${row.fund_id}:${email}`).digest("hex");
    const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, unsubscribeToken);

    // Live price snapshot for the "now worth $X" line. Best-effort
    // getMarketQuote returns null when the ticker is missing from the
    // universe or a provider call fails. Cached upstream (5 min TTL),
    // so calling it from the worker tick is cheap. The render falls
    // back to a value-less version when this returns null, never
    // fabricates a number.
    const ticker = row.selected_ticker ? String(row.selected_ticker).toUpperCase() : null;
    const shares = row.shares_acquired ? parseFloat(String(row.shares_acquired)) : null;
    let currentValue: number | null = null;
    if (ticker && shares !== null && Number.isFinite(shares) && shares > 0) {
      try {
        const quote = await getMarketQuote(ticker);
        if (quote && Number.isFinite(quote.price) && quote.price > 0) {
          currentValue = Math.round(shares * quote.price * 100) / 100;
        }
      } catch {
        // non-fatal render uses the no-value fallback
      }
    }

    await appendQueueEntry({
      id: `gift_day7_followup:${giftId}`,
      type: "gift_day7_followup",
      fundId: row.fund_id,
      giftId,
      email,
      name: row.sender_name,
      childName,
      amount: Number(row.amount || 0),
      ticker,
      sharesAcquired: row.shares_acquired,
      currentValue,
      giftUrl,
      startFundUrl,
      unsubscribeUrl,
    });
    day7Sent[giftId] = new Date().toISOString();
    queued += 1;
    storeChanged = true;
  }

  if (storeChanged) {
    store.day7SentByGiftId = day7Sent;
    await saveNotificationStore(store);
  }
  if (queued > 0) {
    log(`queued ${queued} Day-7 gift follow-up(s)`, "gifter-worker");
  }
}

// Anniversary email fires on the gift's annual anniversary. Same
// shape as Day-7 but anchored on a yearly cadence and capped at the
// kid turning 18 (after that the at-18 ceremony email is the
// canonical end of the gifter relationship; layering anniversary
// emails on top would feel like marketing). Per-year dedup key
// `${giftId}:${yearN}` so each anniversary fires at most once even
// if the worker tick runs many times during the calendar-day
// anniversary window. Forward-only: gifts whose anniversary already
// passed (more than ~7 days ago in the current year) are skipped to
// avoid backfill carpet-bombing on first deploy.
async function enqueueGiftAnniversaryEmails(log: (message: string, source?: string) => void) {
  // Find gifts whose anniversary day-of-year matches today (within a
  // 0-7 day grace window forward same window-not-single-day pattern
  // as Day-7 + birthday lead-up to tolerate worker downtime). The
  // SQL filter computes the next anniversary date by adding (year_diff
  // + 1) years to the gift's createdAt, then keeps gifts where the
  // anniversary fell within the last 7 days.
  const result = await pool.query(`
    SELECT
      g.id,
      g.fund_id,
      g.sender_email,
      g.sender_name,
      g.amount,
      g.selected_ticker,
      g.created_at,
      g.shares_acquired,
      f.slug AS fund_slug,
      f.recipient_first_name,
      f.recipient_birthdate,
      f.name AS fund_name,
      f.majority_age,
      DATE_PART('year', AGE(NOW(), g.created_at))::int AS years_since
    FROM gifts g
    LEFT JOIN funds f ON f.id = g.fund_id
    WHERE g.sender_email IS NOT NULL
      AND (f.memorialized_at IS NULL) -- bereavement: exclude memorialized recipients (BEREAVEMENT_POSTURE.md)
      AND TRIM(g.sender_email) <> ''
      AND g.status NOT IN ('failed', 'refunded', 'canceled', 'host_hold', 'pending')
      AND g.created_at <= NOW() - INTERVAL '1 year'
      AND EXTRACT(DOY FROM g.created_at) BETWEEN
            EXTRACT(DOY FROM NOW()) - 7 AND EXTRACT(DOY FROM NOW())
  `);

  if (result.rows.length === 0) return;

  const store = await loadNotificationStore();
  const annivSent = store.anniversarySentByKey || {};
  const baseUrl = getAppBaseUrl();
  let queued = 0;
  let storeChanged = false;

  for (const row of result.rows as Array<{
    id: string;
    fund_id: string;
    sender_email: string;
    sender_name: string | null;
    amount: string;
    selected_ticker: string | null;
    created_at: string;
    shares_acquired: string | null;
    fund_slug: string | null;
    recipient_first_name: string | null;
    recipient_birthdate: string | null;
    fund_name: string | null;
    majority_age: number | null;
    years_since: number;
  }>) {
    const giftId = String(row.id);
    const yearN = Math.max(1, Number(row.years_since || 1));
    const dedupKey = `${giftId}:${yearN}`;
    if (annivSent[dedupKey]) continue;

    // Cap anniversary cadence once the kid hits majority at that
    // point the at-18 notification IS the closing ceremony for the
    // gifter relationship; layering anniversaries on top would
    // dilute it and feel like a mailing list.
    if (row.recipient_birthdate) {
      const childAge = getAgeOnDate(row.recipient_birthdate, new Date());
      const cap = Number(row.majority_age) || 18;
      if (childAge >= cap) continue;
    }

    const email = String(row.sender_email || "").trim().toLowerCase();
    if (!email) continue;
    const subscriber = store.subscribersByFund?.[row.fund_id]?.[email];
    if (subscriber?.unsubscribed) {
      annivSent[dedupKey] = new Date().toISOString();
      storeChanged = true;
      continue;
    }

    const childName = row.recipient_first_name || row.fund_name || "their child";
    const fundUrlFund = { id: row.fund_id, slug: row.fund_slug, name: row.fund_name } as FundReminderRow;
    const giftUrl = buildGiftUrl(baseUrl, fundUrlFund);
    const startFundUrl = buildLoopStartFundUrl(baseUrl, row.fund_id, "gift_anniversary_email", "email");
    const unsubscribeToken = subscriber?.unsubscribeToken
      || crypto.createHash("sha1").update(`${row.fund_id}:${email}`).digest("hex");
    const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, unsubscribeToken);

    // Live price snapshot same best-effort pattern as Day-7. The
    // anniversary email is where "$50 has grown to $X over a year"
    // earns the most: a real time-framed update on a gift the gifter
    // has had a year to forget about.
    const ticker = row.selected_ticker ? String(row.selected_ticker).toUpperCase() : null;
    const shares = row.shares_acquired ? parseFloat(String(row.shares_acquired)) : null;
    let currentValue: number | null = null;
    if (ticker && shares !== null && Number.isFinite(shares) && shares > 0) {
      try {
        const quote = await getMarketQuote(ticker);
        if (quote && Number.isFinite(quote.price) && quote.price > 0) {
          currentValue = Math.round(shares * quote.price * 100) / 100;
        }
      } catch { /* non-fatal */ }
    }

    await appendQueueEntry({
      id: `gift_anniversary:${dedupKey}`,
      type: "gift_anniversary",
      fundId: row.fund_id,
      giftId,
      yearN,
      email,
      name: row.sender_name,
      childName,
      amount: Number(row.amount || 0),
      ticker,
      currentValue,
      giftUrl,
      startFundUrl,
      unsubscribeUrl,
    });
    annivSent[dedupKey] = new Date().toISOString();
    queued += 1;
    storeChanged = true;
  }

  if (storeChanged) {
    store.anniversarySentByKey = annivSent;
    await saveNotificationStore(store);
  }
  if (queued > 0) {
    log(`queued ${queued} gift anniversary email(s)`, "gifter-worker");
  }
}

async function enqueueRecurringNotifications(log: (message: string, source?: string) => void) {
  const store = await loadNotificationStore();
  const funds = await getFundReminderRows();
  const now = new Date();
  const baseUrl = getAppBaseUrl();
  const currentYear = getDatePartsInTimeZone(now).year;
  let queued = 0;
  let storeChanged = false;

  for (const fund of funds) {
    if (!fund.recipient_birthdate) continue;
    const subscribersMap = store.subscribersByFund[fund.id] || {};
    const activeSubscribers = Object.entries(subscribersMap).filter(([, subscriber]) => !subscriber.unsubscribed);
    if (activeSubscribers.length === 0) continue;

    const settings = normalizeSettings(store.settingsByFund[fund.id]);
    store.settingsByFund[fund.id] = settings;

    // Birthday lead-up window fire when the kid's next birthday is
    // 7–14 days away. The window (not a single day) is intentional: the
    // worker runs on a schedule and may miss a day during a deploy or
    // outage, so a 7-day grace tolerates a missed run without losing
    // the reminder. The childAge cap stays at < 18 once the kid is
    // an adult, the relationship between gifter and the fund changes
    // (handoff via age18_notification handles that one separately).
    // The lastBirthdayReminderYear dedup means even if the window
    // overlaps two worker runs the gifter only gets one email per
    // calendar year. Was: fire ON the birthday this iteration moves
    // the trigger forward 7-14 days so gifts can actually arrive
    // BEFORE the day, which is the whole job of a lead-up reminder.
    if (settings.birthdayReminders) {
      const daysUntil = daysUntilNextBirthday(fund.recipient_birthdate, now);
      const inLeadUpWindow = daysUntil >= 7 && daysUntil <= 14;
      if (inLeadUpWindow) {
        // childAge = age on the upcoming birthday (today's age + 1
        // when the next one's still ahead). Used in the email copy
        // ("Emma's turning 8 in 14 days") so the number lines up with
        // the gift the gifter is being nudged toward sending.
        const childAge = getAgeOnDate(fund.recipient_birthdate, now) + 1;
        if (childAge >= 1 && childAge < 18) {
          // Fetch the fund aggregate ONCE per fund (not per gifter)
          // for the "growing-up" framing line. Cheap on the worker
          // (already cached for the at-18 path). Lets the email
          // include "Emma's fund has $X today, built by Y people
          // over Z years" merges the previously-separate Y1-Y17
          // series into the lead-up email so each gifter gets one
          // birthday-cycle email per year, not two.
          const aggregate = await getFundGiftAggregate(fund.id);
          for (const [email, subscriber] of activeSubscribers) {
            if (subscriber.lastBirthdayReminderYear === currentYear) continue;
            await appendQueueEntry({
              type: "birthday_reminder",
              fundId: fund.id,
              email,
              name: subscriber.name,
              childName: fund.recipient_first_name || fund.name || "your child",
              childAge,
              daysUntil,
              contributionCount: subscriber.contributionCount,
              totalContributed: subscriber.totalContributed,
              totalFundContributors: aggregate.totalContributors,
              totalFundGifted: aggregate.totalGifted,
              giftUrl: buildGiftUrl(baseUrl, fund),
              startFundUrl: buildLoopStartFundUrl(baseUrl, fund.id, "birthday_reminder_email", "email"),
              unsubscribeUrl: buildUnsubscribeUrl(baseUrl, subscriber.unsubscribeToken),
            });
            store.subscribersByFund[fund.id][email] = {
              ...subscriber,
              lastBirthdayReminderYear: currentYear,
              lastBirthdayReminderSentAt: now.toISOString(),
            };
            queued += 1;
            storeChanged = true;
          }
        }
      }
    }

    // Holiday trigger Nov 15 through Dec 5. The gift-shopping window
    // for the season; before Nov 15 it reads as premature, after Dec 5
    // a parent's-friend gift card decision has usually been made. Once
    // per gifter per calendar year via lastHolidayReminderYear (per-
    // fund a gifter who's contributed to two kids' funds gets two
    // seasonal nudges, one per relationship). Piggybacks on the
    // birthdayReminders setting for now since both are "ongoing
    // reminders" the parent has consented to send. Could split into
    // its own setting later if parents want finer control.
    // Children-aged cap matches birthday lead-up: <18 only. After
    // majority the at-18 ceremony email is the canonical end.
    if (settings.birthdayReminders) {
      const todayParts = getDatePartsInTimeZone(now);
      const isInHolidayWindow =
        (todayParts.month === 11 && todayParts.day >= 15) ||
        (todayParts.month === 12 && todayParts.day <= 5);
      if (isInHolidayWindow) {
        const childAge = getAgeOnDate(fund.recipient_birthdate, now);
        if (childAge >= 0 && childAge < 18) {
          const aggregate = await getFundGiftAggregate(fund.id);
          for (const [email, subscriber] of activeSubscribers) {
            if (subscriber.lastHolidayReminderYear === currentYear) continue;
            await appendQueueEntry({
              type: "holiday_reminder",
              fundId: fund.id,
              email,
              name: subscriber.name,
              childName: fund.recipient_first_name || fund.name || "your child",
              childAge,
              contributionCount: subscriber.contributionCount,
              totalContributed: subscriber.totalContributed,
              totalFundContributors: aggregate.totalContributors,
              totalFundGifted: aggregate.totalGifted,
              giftUrl: buildGiftUrl(baseUrl, fund),
              startFundUrl: buildLoopStartFundUrl(baseUrl, fund.id, "holiday_reminder_email", "email"),
              unsubscribeUrl: buildUnsubscribeUrl(baseUrl, subscriber.unsubscribeToken),
            });
            store.subscribersByFund[fund.id][email] = {
              ...subscriber,
              lastHolidayReminderYear: currentYear,
              lastHolidayReminderSentAt: now.toISOString(),
            };
            queued += 1;
            storeChanged = true;
          }
        }
      }
    }

    if (settings.age18Notification) {
      const majorityAge = Number((fund as any).majority_age) || 18;
      const eighteenthBirthday = getMajorityBirthday(fund.recipient_birthdate, majorityAge);
      if (now.getTime() >= eighteenthBirthday.getTime()) {
        const aggregate = await getFundGiftAggregate(fund.id);
        for (const [email, subscriber] of activeSubscribers) {
          if (subscriber.age18NotifiedAt) continue;
          await appendQueueEntry({
            type: "age18_notification",
            fundId: fund.id,
            email,
            name: subscriber.name,
            childName: fund.recipient_first_name || fund.name || "your child",
            contributionCount: subscriber.contributionCount,
            // Personal stats added 2026-05-12 for the 18-year retrospective.
            // The render function uses these to compute the gifter's share
            // of the fund and their cumulative contribution narrative.
            senderTotalContributed: subscriber.totalContributed,
            // Majority age plumbed through so the email and subject line
            // honor the locked state-specific UTMA age (18 in most states,
            // 19 in AL/NE, 21 in MS/PA/etc.). Without this the email
            // says "turns 18 today" even when the legal majority age for
            // this fund's state is 21.
            majorityAge,
            totalContributors: aggregate.totalContributors,
            totalGifted: aggregate.totalGifted,
            startFundUrl: buildLoopStartFundUrl(baseUrl, fund.id, "age_18_email", "email"),
            unsubscribeUrl: buildUnsubscribeUrl(baseUrl, subscriber.unsubscribeToken),
          });
          store.subscribersByFund[fund.id][email] = {
            ...subscriber,
            age18NotifiedAt: now.toISOString(),
          };
          queued += 1;
          storeChanged = true;
        }
      }
    }
  }

  if (storeChanged) {
    await saveNotificationStore(store);
  }
  if (queued > 0) {
    log(`queued ${queued} recurring gifter notification(s)`, "gifter-worker");
  }
}

// Dormancy re-engagement enqueue. Single highest-ROI repeat-gift
// conversion lever per the audit silent gifters get NO existing
// touchpoint between the day-7 follow-up (or 1st-year anniversary)
// and the birthday lead-up. For a gifter whose last gift was 6+
// months ago AND who is NOT in a natural reminder window (birthday
// lead-up, holiday season, age-18, anniversary), this fills the gap
// with one quiet "here's where the fund stands" check-in.
//
// Eligibility gates:
//   1. Gifter has actually contributed (totalContributed > 0). Opt-in-
//      only subscribers with no gifts get the lifecycle reminders, not
//      this one. Dormancy is for people who gave and went quiet.
//   2. lastGiftAt >= 6 months ago. Hard floor on "dormant".
//   3. lastDormancyCheckinAt is null OR >= 6 months ago. Frequency cap.
//      Same gifter never gets two dormancy emails in one 6-month window.
//   4. settings.birthdayReminders is true. Same umbrella as the other
//      lifecycle nudges. A parent who turned off lifecycle reminders
//      (or a gifter who unsubscribed) does not get this email.
//   5. NOT inside birthday lead-up window (within 7-14 days of next
//      birthday). Birthday email handles that nudge; firing dormancy
//      on top would double-nudge.
//   6. NOT inside holiday window (Nov 15 - Dec 5). Same reason.
//   7. childAge < majorityAge. After majority the at-18 ceremony is
//      the canonical close; don't re-engage past it.
//
// Per feedback_no_emdash.md + structure-vs-behavior research: the
// email is calm and factual, not "Don't miss out!" / "Hurry back!" /
// guilt-trip copy. Subject leans on what they MISSED (fund value,
// new milestone) not on their silence.
async function enqueueDormancyCheckIns(log: (message: string, source?: string) => void) {
  const store = await loadNotificationStore();
  const funds = await getFundReminderRows();
  const now = new Date();
  const baseUrl = getAppBaseUrl();
  const SIX_MONTHS_MS = 6 * 30.44 * 24 * 60 * 60 * 1000;
  let queued = 0;
  let storeChanged = false;

  for (const fund of funds) {
    if (!fund.recipient_birthdate) continue;

    const subscribersMap = store.subscribersByFund[fund.id] || {};
    const activeSubscribers = Object.entries(subscribersMap).filter(
      ([, subscriber]) => !subscriber.unsubscribed,
    );
    if (activeSubscribers.length === 0) continue;

    const settings = normalizeSettings(store.settingsByFund[fund.id]);
    store.settingsByFund[fund.id] = settings;
    if (!settings.birthdayReminders) continue; // same umbrella as lifecycle reminders

    // Skip funds inside birthday or holiday windows to avoid double-nudging.
    const daysUntilBirthday = daysUntilNextBirthday(fund.recipient_birthdate, now);
    if (daysUntilBirthday >= 7 && daysUntilBirthday <= 14) continue;
    const todayParts = getDatePartsInTimeZone(now);
    const inHolidayWindow =
      (todayParts.month === 11 && todayParts.day >= 15) ||
      (todayParts.month === 12 && todayParts.day <= 5);
    if (inHolidayWindow) continue;

    // Skip funds whose owners have reached majority. The at-18 email is
    // the canonical close of the gifter relationship.
    const majorityAge = Number((fund as any).majority_age) || 18;
    const childAge = getAgeOnDate(fund.recipient_birthdate, now);
    if (childAge >= majorityAge) continue;

    // Fund aggregate computed once per fund for the email context.
    const aggregate = await getFundGiftAggregate(fund.id);

    for (const [email, subscriber] of activeSubscribers) {
      // Gate 1: must have contributed.
      if (subscriber.totalContributed <= 0 || subscriber.contributionCount <= 0) continue;
      // Gate 2: lastGiftAt must be 6+ months ago.
      if (!subscriber.lastGiftAt) continue;
      const lastGiftMs = new Date(subscriber.lastGiftAt).getTime();
      if (!Number.isFinite(lastGiftMs)) continue;
      const msSinceLastGift = now.getTime() - lastGiftMs;
      if (msSinceLastGift < SIX_MONTHS_MS) continue;
      // Gate 3: no dormancy email within the last 6 months.
      if (subscriber.lastDormancyCheckinAt) {
        const lastCheckinMs = new Date(subscriber.lastDormancyCheckinAt).getTime();
        if (Number.isFinite(lastCheckinMs) && now.getTime() - lastCheckinMs < SIX_MONTHS_MS) {
          continue;
        }
      }

      const monthsSinceLastGift = Math.floor(msSinceLastGift / (30.44 * 24 * 60 * 60 * 1000));

      await appendQueueEntry({
        type: "dormancy_checkin",
        fundId: fund.id,
        email,
        name: subscriber.name,
        childName: fund.recipient_first_name || fund.name || "your child",
        childAge,
        monthsSinceLastGift,
        fundTotalGifted: aggregate.totalGifted,
        fundContributors: aggregate.totalContributors,
        senderTotalContributed: subscriber.totalContributed,
        senderGiftCount: subscriber.contributionCount,
        giftUrl: buildGiftUrl(baseUrl, fund),
        startFundUrl: buildLoopStartFundUrl(baseUrl, fund.id, "dormancy_checkin_email", "email"),
        unsubscribeUrl: buildUnsubscribeUrl(baseUrl, subscriber.unsubscribeToken),
      });

      store.subscribersByFund[fund.id][email] = {
        ...subscriber,
        lastDormancyCheckinAt: now.toISOString(),
      };
      queued += 1;
      storeChanged = true;
    }
  }

  if (storeChanged) {
    await saveNotificationStore(store);
  }
  if (queued > 0) {
    log(`queued ${queued} dormancy check-in(s)`, "gifter-worker");
  }
}

// Year-end recap enqueue. Runs Dec 15-31 (window so a missed worker
// tick doesn't lose anyone, plus reasonable runway before New Year's
// when inboxes get noisy). Aggregates ALL gifts the gifter sent this
// calendar year across every fund they touched, then enqueues ONE
// cross-fund recap email per gifter.
//
// Eligibility gates:
//   1. Calendar window: Dec 15 - Dec 31 in the app's timezone.
//   2. Gifter has at least one settled gift in the current year.
//   3. lastYearEndRecapYear !== currentYear (one per year per gifter).
//   4. Gifter is not unsubscribed from ANY fund they gifted this year
//      (we treat the recap as per-gifter, not per-fund if they've
//      opted out of one fund's reminders but stayed on for two
//      others, they still get the cross-fund recap because the
//      content speaks to all three).
//
// Implementation note: this is the FIRST cross-fund email so the
// dedup field lives on the SUBSCRIBER record but is only meaningful
// when read across all funds. We pick one fund's subscriber record
// as the "anchor" (the one with the most recent gift) and write the
// year-stamp there. To avoid double-sending we also pre-flight check
// every other fund's subscriber record for the same email and only
// proceed if NONE have already been stamped for this year.
async function enqueueYearEndRecaps(log: (message: string, source?: string) => void) {
  const now = new Date();
  const todayParts = getDatePartsInTimeZone(now);
  // Window guard. December 15 through 31. Tight enough that we don't
  // accidentally send during November or January.
  if (todayParts.month !== 12 || todayParts.day < 15) return;

  const currentYear = todayParts.year;
  const baseUrl = getAppBaseUrl();
  const store = await loadNotificationStore();
  let queued = 0;
  let storeChanged = false;

  // Aggregate gifts by sender email for the current year. Single SQL
  // pass, then we slice per-gifter in JS.
  const result = await pool.query(
    `
      SELECT
        LOWER(TRIM(g.sender_email)) AS email,
        g.fund_id,
        g.sender_name,
        g.amount,
        g.is_anonymous,
        f.recipient_first_name,
        f.name AS fund_name,
        f.slug AS fund_slug,
        g.created_at
      FROM gifts g
      LEFT JOIN funds f ON f.id = g.fund_id
      WHERE g.sender_email IS NOT NULL
        AND TRIM(g.sender_email) <> ''
        AND g.status NOT IN ('failed', 'refunded', 'canceled', 'host_hold')
        AND EXTRACT(YEAR FROM g.created_at AT TIME ZONE $1) = $2
      ORDER BY g.created_at DESC
    `,
    [APP_TIMEZONE, currentYear],
  );

  // gifter email -> aggregate state
  type GifterAggregate = {
    fundIds: Set<string>;
    childNames: Set<string>;
    totalGiven: number;
    giftCount: number;
    // Track per-fund whether ALL gifts to that fund were anonymous;
    // if so we suppress the recipient name in the recap. Mixed (some
    // anon, some named) still shows the name.
    nonAnonymousFundIds: Set<string>;
    primaryFundId: string | null;
    primaryFundSlug: string | null;
    senderName: string | null;
  };
  const aggregates = new Map<string, GifterAggregate>();
  for (const row of result.rows) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) continue;
    const amount = parseFloat(String(row.amount || "0")) || 0;
    if (amount <= 0) continue;
    if (!aggregates.has(email)) {
      aggregates.set(email, {
        fundIds: new Set(),
        childNames: new Set(),
        totalGiven: 0,
        giftCount: 0,
        nonAnonymousFundIds: new Set(),
        primaryFundId: null,
        primaryFundSlug: null,
        senderName: null,
      });
    }
    const agg = aggregates.get(email)!;
    agg.fundIds.add(row.fund_id);
    agg.totalGiven += amount;
    agg.giftCount += 1;
    if (!row.is_anonymous) {
      agg.nonAnonymousFundIds.add(row.fund_id);
      if (row.recipient_first_name) agg.childNames.add(String(row.recipient_first_name).trim());
    }
    // First row encountered for this email is the most recent gift
    // (rows are ORDER BY created_at DESC) so it's the natural anchor
    // for the "keep going" CTA destination.
    if (!agg.primaryFundId) {
      agg.primaryFundId = row.fund_id;
      agg.primaryFundSlug = row.fund_slug;
    }
    if (!agg.senderName && row.sender_name && !row.is_anonymous) {
      agg.senderName = String(row.sender_name).trim();
    }
  }

  if (aggregates.size === 0) return;

  // Array.from for cross-version Map iteration compatibility. Same
  // pattern used by getPendingInvitationsForUser elsewhere in storage.ts.
  for (const [email, agg] of Array.from(aggregates.entries())) {
    // Find ANY subscriber record for this email across all funds
    // they touched. We use the first one we find as the "anchor" for
    // the dedup write. If ANY subscriber record for this email shows
    // lastYearEndRecapYear === currentYear, skip already sent.
    let anchorFundId: string = "";
    let anchorSubscriber: GifterNotificationSubscriber | null = null;
    let alreadySentThisYear = false;
    for (const fundId of Array.from(agg.fundIds)) {
      const sub = store.subscribersByFund[fundId]?.[email];
      if (!sub) continue;
      if (sub.lastYearEndRecapYear === currentYear) {
        alreadySentThisYear = true;
        break;
      }
      if (!anchorSubscriber) {
        anchorFundId = fundId;
        anchorSubscriber = sub;
      }
    }
    if (alreadySentThisYear) continue;

    // No subscriber record for this gifter on ANY of the funds they
    // gave to? Unusual (the gift webhook chain creates these), but
    // possible for legacy data or gifts that bypassed the opt-in
    // flow. We still want the recap synthesize an anonymous
    // anchor record so we have an unsubscribe token to include and
    // a place to write the dedup stamp.
    if (!anchorSubscriber || !anchorFundId) {
      const anchor = agg.primaryFundId;
      if (!anchor) continue;
      if (!store.subscribersByFund[anchor]) store.subscribersByFund[anchor] = {};
      const token = crypto.randomBytes(16).toString("hex");
      const synthesized = normalizeSubscriber(email, {
        name: agg.senderName,
        unsubscribeToken: token,
      });
      store.subscribersByFund[anchor][email] = synthesized;
      anchorFundId = anchor;
      anchorSubscriber = synthesized;
    }
    if (!anchorFundId || !anchorSubscriber) continue;

    // Resolve recipient names. Show only kids the gifter gave to
    // non-anonymously (when ALL gifts to a fund were anonymous, the
    // recipient should remain hidden). If that filtering leaves the
    // list empty (everything was anonymous), the render function
    // falls back to "{N} children" generic phrasing.
    const childNamesList = Array.from(agg.childNames);

    const primaryGiftUrl = agg.primaryFundSlug
      ? `${baseUrl}/${agg.primaryFundSlug}`
      : agg.primaryFundId
        ? `${baseUrl}/gift/${agg.primaryFundId}`
        : "";

    await appendQueueEntry({
      type: "year_end_recap",
      // Anchor fundId the year-end recap isn't per-fund but the
      // queue entries carry one for outbox tagging consistency.
      fundId: anchorFundId,
      email,
      name: anchorSubscriber.name,
      year: currentYear,
      totalGiven: Math.round(agg.totalGiven * 100) / 100,
      giftCount: agg.giftCount,
      fundCount: agg.fundIds.size,
      childNames: childNamesList,
      primaryGiftUrl,
      startFundUrl: buildLoopStartFundUrl(baseUrl, anchorFundId, "year_end_recap_email", "email"),
      unsubscribeUrl: buildUnsubscribeUrl(baseUrl, anchorSubscriber.unsubscribeToken),
    });

    // Stamp dedup on the anchor record. We do NOT stamp every fund's
    // subscriber the cross-fund check at the top of this loop already
    // catches subsequent runs because we read lastYearEndRecapYear from
    // ANY of the gifter's subscriber records.
    store.subscribersByFund[anchorFundId][email] = {
      ...anchorSubscriber,
      lastYearEndRecapYear: currentYear,
      lastYearEndRecapSentAt: now.toISOString(),
    };
    storeChanged = true;
    queued += 1;
  }

  if (storeChanged) {
    await saveNotificationStore(store);
  }
  if (queued > 0) {
    log(`queued ${queued} year-end recap(s)`, "gifter-worker");
  }
}

// Exported enqueue for the parent-thank-you flow. Called from
// routes.ts when a parent marks a thank-you note as "sent" in the
// dashboard. Distinct from the auto-generated draft created by the
// webhook: the parent has personally written (or curated from a
// template) this message and is choosing to send it. Treats as
// transactional. Sends even when the gifter has unsubscribed,
// because a personal thank-you addressed to that specific gifter
// is not a marketing email. Per feedback_anonymous_as_explicit_flag.md:
// when the gifter was anonymous on the original gift, the parent's
// thank-you UI didn't have a name to address (and the gifter's
// email is held private from the parent). We still send the email
// to that hidden address because thanks are valuable; the salutation
// just falls back to "Hi" without a name.
export async function enqueueParentThankYou(params: {
  fundId: string;
  gifterEmail: string;
  gifterName: string | null;
  childName: string;
  parentMessage: string;
  parentName: string | null;
  giftAmount: number;
  isAnonymous?: boolean;
}): Promise<void> {
  const normalizedEmail = String(params.gifterEmail || "").trim().toLowerCase();
  if (!normalizedEmail) return;
  if (!params.parentMessage || !params.parentMessage.trim()) return;

  const baseUrl = getAppBaseUrl();

  // Pull the fund row so we can build a clean gift URL (slug-based when
  // available). Best-effort: if the fund lookup fails we skip the
  // gift_url but still send the thank-you (the message is the point).
  let giftUrl = "";
  try {
    const result = await pool.query(
      `SELECT id, slug, name, recipient_first_name FROM funds WHERE id = $1 LIMIT 1`,
      [params.fundId],
    );
    const row = result.rows[0];
    if (row) {
      giftUrl = row.slug ? `${baseUrl}/${row.slug}` : `${baseUrl}/gift/${row.id}`;
    }
  } catch {
    // non-fatal, continue without gift URL
  }

  // Look up the subscriber to honor unsubscribe token (so the email
  // can carry one). We do NOT skip on unsubscribed: thank-yous are
  // transactional. Missing subscriber record is fine; the email goes
  // out without an unsubscribe link, which is acceptable because the
  // gifter never opted into anything.
  let unsubscribeUrl = "";
  try {
    const store = await loadNotificationStore();
    const sub = store.subscribersByFund[params.fundId]?.[normalizedEmail];
    if (sub?.unsubscribeToken) {
      unsubscribeUrl = buildUnsubscribeUrl(baseUrl, sub.unsubscribeToken);
    }
  } catch {
    // non-fatal
  }

  await appendQueueEntry({
    type: "parent_thank_you",
    fundId: params.fundId,
    email: normalizedEmail,
    name: params.gifterName,
    childName: params.childName,
    parentMessage: params.parentMessage.trim(),
    parentName: params.parentName,
    giftAmount: params.giftAmount,
    giftUrl,
    startFundUrl: buildLoopStartFundUrl(baseUrl, params.fundId, "parent_thank_you_email", "email"),
    unsubscribeUrl,
  });
}

async function processQueuedNotifications(log: (message: string, source?: string) => void) {
  let raw = "";
  try {
    raw = await fs.readFile(GIFTER_NOTIFICATION_QUEUE_PATH, "utf8");
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

    // Wrap the rendered plain-text body in the branded HTML shell.
    // Per-event-type custom HTML is a follow-up; this minimum-frame
    // pass ensures every gifter email immediately gets the cream +
    // evergreen brand even if the body styling is just paragraph
    // text. Locked 2026-05-15.
    const { html: brandedHtml } = renderKiddoEmail({
      heading: rendered.subject,
      intro: rendered.text,
      details: rendered.details,
    });
    const delivery = await sendEmail({
      to: rendered.to,
      subject: rendered.subject,
      text: rendered.text,
      html: brandedHtml,
      tags: ["gifter_notifications", String(parsed.type || "unknown")],
      metadata: {
        queueId: id,
        notificationType: String(parsed.type || "unknown"),
        fundId: String(parsed.fundId || ""),
      },
    });

    await appendOutbox({
      id,
      type: parsed.type || "unknown",
      queuedAt: parsed.createdAt || new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      deliveryMode: delivery.mode,
      providerId: delivery.providerId || null,
      timezone: APP_TIMEZONE,
      ...rendered,
    });
    deliveryLog.deliveredById[id] = {
      deliveredAt: new Date().toISOString(),
      channel: delivery.mode,
      type: String(parsed.type || "unknown"),
    };
    deliveredCount += 1;
  }

  if (deliveredCount > 0) {
    await saveDeliveryLog(deliveryLog);
    log(`processed ${deliveredCount} queued gifter notification(s)`, "gifter-worker");
  }
}

let workerRunning = false;

// Increments the per-subscriber contributionCount + totalContributed
// when the subscriber (matched by email) sends a gift to a fund they're
// opted into. Called from the gift webhook after a successful payment.
//
// The bug this fixes: subscribers opt in via the gifter-notifications
// flow (birthday reminders, age-18, milestones), seeding a subscriber
// record at contributionCount 0 / totalContributed 0. They later send
// gifts. The fund's contributorCount aggregate gets bumped, but the
// per-subscriber counts never were so the Settings → Notifications
// "Gifter subscribers" panel showed every subscriber as "0 gifts · $0"
// even after they'd given hundreds of dollars. Settings has been
// reading honest values; the writes were just missing.
//
// Defensive shape: silent no-op when fundId/email is missing, when
// the subscriber doesn't exist for this fund (gifter who didn't opt
// in), or when amount is invalid. Failures are logged but never throw
// the gift webhook chain shouldn't break because we couldn't update
// a notification stat.
export async function recordGifterGiftContribution(
  fundId: string,
  senderEmail: string | null | undefined,
  giftNetAmount: number,
  giftCreatedAt: Date,
  log: (message: string, source?: string) => void = () => undefined,
): Promise<void> {
  if (!fundId || !senderEmail) return;
  const normalizedEmail = String(senderEmail).trim().toLowerCase();
  if (!normalizedEmail) return;
  const safeAmount = Number.isFinite(giftNetAmount) && giftNetAmount > 0 ? giftNetAmount : 0;

  try {
    const store = await loadNotificationStore();
    const fundSubscribers = store.subscribersByFund[fundId];
    if (!fundSubscribers) return;
    const subscriber = fundSubscribers[normalizedEmail];
    if (!subscriber) return;

    fundSubscribers[normalizedEmail] = {
      ...subscriber,
      contributionCount: subscriber.contributionCount + 1,
      totalContributed: subscriber.totalContributed + safeAmount,
      lastGiftAt: giftCreatedAt.toISOString(),
    };
    await saveNotificationStore(store);
    log(
      `recorded gift contribution for ${normalizedEmail} on fund ${fundId} (count=${subscriber.contributionCount + 1}, total=${subscriber.totalContributed + safeAmount})`,
      "gifter-contribution-record",
    );
  } catch (err) {
    log(`failed to record gifter contribution: ${String(err)}`, "gifter-contribution-record");
  }
}

// Gate: only $1k+ thresholds trigger gifter emails. Lower thresholds
// ($100, $500) fire too often in the early life of a fund and would feel
// like spam to grandma. Activity-log entries and parent emails still fire
// at every threshold; this gate is gifter-side only.
const GIFTER_MILESTONE_FLOOR = 1000;

// Called from server/milestones.ts when a fund's total value crosses one of
// the canonical thresholds. Looks up active gifters (opted-in, not
// unsubscribed, milestoneNotifications setting on via the birthdayReminders
// umbrella for now), enqueues a gifter_milestone_crossed email per gifter,
// and ratchets each gifter's lastMilestoneNotifiedThreshold so the same
// threshold never emails them twice. Errors are logged but not thrown a
// milestone email failure shouldn't break the gift webhook chain that
// triggered this call.
export async function enqueueGifterMilestoneNotifications(
  fundId: string,
  threshold: number,
  log: (message: string, source?: string) => void = () => undefined,
): Promise<void> {
  const SOURCE = "gifter-milestone-enqueue";
  try {
    if (!fundId || !Number.isFinite(threshold) || threshold < GIFTER_MILESTONE_FLOOR) return;
    const copy = MONEY_CROSS_COPY[threshold];
    if (!copy) return; // Unknown threshold defensive, shouldn't happen.

    // Fetch the fund row for the gift-link URL + child name.
    const fundResult = await pool.query(
      `SELECT id, slug, name, recipient_first_name, recipient_birthdate, owner_first_name, owner_last_name
       FROM funds f
       LEFT JOIN users u ON u.id = f.user_id
       WHERE f.id = $1
       LIMIT 1`,
      [fundId],
    );
    const fundRow = (fundResult.rows[0] || null) as FundReminderRow | null;
    if (!fundRow) return;

    const childName = fundRow.recipient_first_name || fundRow.name || "this child";
    const aggregate = await getFundGiftAggregate(fundId);

    const store = await loadNotificationStore();
    const subscribersMap = store.subscribersByFund[fundId] || {};
    const settings = normalizeSettings(store.settingsByFund[fundId]);
    if (!settings.birthdayReminders) {
      // Parent disabled gifter ongoing reminders for this fund. Honor that
      // for milestone emails too (same umbrella as birthday + holiday).
      return;
    }

    const baseUrl = getAppBaseUrl();
    const giftUrl = buildGiftUrl(baseUrl, fundRow);
    let queued = 0;
    let storeChanged = false;

    for (const [email, subscriber] of Object.entries(subscribersMap)) {
      if (subscriber.unsubscribed) continue;
      // Ratchet: only email if this threshold is strictly higher than
      // anything we've emailed about before. A fund jumping from $0 to
      // $50k in one anonymous gift will email each gifter ONCE about
      // the highest crossed threshold (caller passes the highest), not
      // once per threshold the fund passed through.
      const last = Number(subscriber.lastMilestoneNotifiedThreshold ?? 0);
      if (last >= threshold) continue;

      await appendQueueEntry({
        type: "gifter_milestone_crossed",
        fundId,
        email,
        name: subscriber.name,
        childName,
        threshold,
        emotionalLine: copy.emotionalLine,
        contributorCount: aggregate.totalContributors,
        giftCount: subscriber.contributionCount,
        totalContributed: subscriber.totalContributed,
        giftUrl,
        unsubscribeUrl: buildUnsubscribeUrl(baseUrl, subscriber.unsubscribeToken),
      });
      store.subscribersByFund[fundId][email] = {
        ...subscriber,
        lastMilestoneNotifiedThreshold: threshold,
      };
      queued += 1;
      storeChanged = true;
    }

    if (storeChanged) {
      await saveNotificationStore(store);
    }
    if (queued > 0) {
      log(`enqueued ${queued} gifter milestone email(s) for fund ${fundId} at $${threshold}`, SOURCE);
    }
  } catch (err) {
    log(`gifter milestone enqueue failed for fund ${fundId} at $${threshold}: ${String(err)}`, SOURCE);
  }
}

export async function runGifterNotificationWorker(log: (message: string, source?: string) => void = () => undefined) {
  if (workerRunning) return;
  workerRunning = true;
  try {
    await enqueueGiftDay7Followups(log);
    await enqueueGiftAnniversaryEmails(log);
    await enqueueRecurringNotifications(log);
    await enqueueDormancyCheckIns(log);
    await enqueueYearEndRecaps(log);
    await processQueuedNotifications(log);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`gifter notification worker failed: ${message}`, "gifter-worker");
  } finally {
    workerRunning = false;
  }
}

export function startGifterNotificationWorker(log: (message: string, source?: string) => void = () => undefined) {
  const intervalMs = Math.max(Number(process.env.GIFTER_NOTIFICATION_WORKER_INTERVAL_MS || 15 * 60 * 1000), 60_000);
  void runGifterNotificationWorker(log);
  const interval = setInterval(() => {
    void runGifterNotificationWorker(log);
  }, intervalMs);
  interval.unref?.();
  log(`gifter notification worker started (every ${Math.round(intervalMs / 60000)} min, tz ${APP_TIMEZONE})`, "gifter-worker");
}
