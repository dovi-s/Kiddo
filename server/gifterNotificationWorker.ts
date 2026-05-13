import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { pool } from "./db";
import { sendEmail } from "./emailDelivery";
import { getMarketQuote } from "./marketQuotes";
import { MONEY_CROSS_COPY } from "@shared/milestones";

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
  // fund jumps past multiple thresholds in one event (rare but possible —
  // e.g. a $50k anonymous gift on a $5k fund crosses $10k, $25k, AND $50k),
  // we email about the HIGHEST crossed threshold to avoid spamming the same
  // gifter with three back-to-back emails about the same surge.
  lastMilestoneNotifiedThreshold: number | null;
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
  // many times in the anniversary window. Per-gift-per-year — a
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

// Renamed semantically — this returns the kid's UTMA majority date, which
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
  // Lead-up framing — the email now fires 7-14 days before the birthday
  // (not on the day-of), so the subject + opening line speak to that
  // window. Gives the gifter time to actually send the gift before the
  // birthday arrives. Falls back to "today" copy if daysUntil is 0
  // (defensive — shouldn't happen with the new window but keeps the
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
  // "Growing-up" line — the village context. Replaces the abandoned
  // separate Y1-Y17 series. Renders only when the aggregate values
  // are non-zero (a brand-new fund won't have either yet, in which
  // case the line falls out).
  const villageLine = (fundContributors > 0 && fundGifted > 0)
    ? `${childName}'s fund has $${fundGifted.toFixed(2)} today, built by ${fundContributors} ${fundContributors === 1 ? "person" : "people"}.`
    : null;
  // Age-specific milestone color for the most resonant ages. Quiet
  // additions to the email — the gifter feels like the year matters
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

function renderAge18Notification(entry: QueueEntry): RenderedEmail | null {
  const to = String(entry.email || "").trim().toLowerCase();
  const childName = String(entry.childName || "your child").trim();
  const contributionCount = Number(entry.contributionCount || 0);
  const totalContributors = Number(entry.totalContributors || 0);
  const totalGifted = Number(entry.totalGifted || 0);
  const unsubscribeUrl = String(entry.unsubscribeUrl || "").trim();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  if (!to || !childName) return null;
  return {
    to,
    subject: `${childName} turns 18 today. Their fund is now theirs.`,
    text: [
      `Hi${entry.name ? ` ${entry.name}` : ""},`,
      "",
      `${childName} turns 18 today.`,
      "",
      `Their fund is now theirs. Everything family and friends built over the years is in their hands.`,
      buildGiftProvenanceLine(childName),
      contributionCount > 0
        ? `You gifted ${childName} ${contributionCount} time${contributionCount === 1 ? "" : "s"} over the years.`
        : `You were part of building ${childName}'s future.`,
      `${totalContributors} people gifted a total of $${totalGifted.toFixed(2)}.`,
      "",
      "Thank you for being part of the story.",
      startFundUrl ? `Start a fund for your own child: ${startFundUrl}` : "",
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
  const fundName = String(entry.fundName || childName || "their fund").trim();
  const amount = Number(entry.amount || 0);
  const ticker = String(entry.ticker || "").trim().toUpperCase();
  const startFundUrl = String(entry.startFundUrl || "").trim();
  const giftUrl = String(entry.giftUrl || "").trim();
  const eventName = entry.eventName ? String(entry.eventName).trim() : null;
  if (!to || !startFundUrl) return null;

  const occasionLabel = eventName ? `'s ${eventName}` : "";
  const subject = eventName
    ? `Your gift for ${childName}'s ${eventName} is on its way`
    : `Your gift to ${childName} is on its way`;

  const giftLine = amount > 0
    ? ticker
      ? `Your $${amount.toFixed(2)} gift is being invested in ${ticker} for ${childName}${occasionLabel}. It will sit there and grow.`
      : `Your $${amount.toFixed(2)} gift for ${childName}${occasionLabel} is confirmed and headed into their investment fund.`
    : `Your gift for ${childName}${occasionLabel} is confirmed.`;

  // Honest disclosure of where the gifter's name shows up. Previously the
  // email mentioned the note going into the Memory Book but never told the
  // gifter their NAME also appears there + on the gift page's "who's already
  // given" social-proof list. This is the only paper trail they get; it
  // should be complete.
  const namedSender = entry.senderName ? String(entry.senderName).trim() : "";
  const isAnonymous = !namedSender || /^anonymous$/i.test(namedSender) || /^someone who loves /i.test(namedSender);
  const visibilityLine = isAnonymous
    ? "You sent this anonymously, so no name appears on the Memory Book or the gift page."
    : `Your first name (${namedSender.split(/\s+/)[0]}) appears in ${childName}'s family Memory Book and as a "who's already given" name on their gift page. Full name stays private. Reply to this email if you'd like it changed.`;

  return {
    to,
    subject,
    text: [
      `Hi${namedSender ? ` ${namedSender}` : ""},`,
      "",
      giftLine,
      buildGiftProvenanceLine(childName),
      "",
      "Your note goes into their Memory Book. They will read it someday alongside the story of this gift.",
      "",
      visibilityLine,
      "",
      giftUrl ? `Gift again any time: ${giftUrl}` : "",
      "",
      "Want to set up a fund for your own child or grandchild?",
      "The whole family can send lasting gifts in under a minute. No app. No account for gifters.",
      `Start a fund: ${startFundUrl}`,
      "",
      "The Kiddo team",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Gifter milestone email. Fires when the fund this gifter has contributed
// to crosses one of the meaningful money thresholds ($1k+; we skip $100/$500
// because they're noisy and would email gifters multiple times in the early
// weeks of a fund). Per-gifter ratchet dedup via lastMilestoneNotifiedThreshold
// — never email the same threshold twice, and skip lower thresholds if the
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
    default:
      return null;
  }
}

// Day-7 growth check-in email. Fires ~7 days after a gift, telling
// the gifter the gift IS invested and starting to grow. Without a
// live-price call (which would add an external dependency to the
// worker), the copy avoids fabricating numbers and stays at the
// "your gift is invested in {ticker}" framing — honest about the
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
  // Growth line — uses live price snapshot taken at enqueue time.
  // Falls back gracefully when the price service had no quote (ticker
  // missing from universe, provider failure, no shares stamped) so the
  // email never fabricates a number. Honest framing per the locked
  // "no greenwashing losses" rule: when value is BELOW gift amount we
  // still show it — losses are time-framed, not hidden. The
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
// is "a year ago you gave; here's what it's grown into" — same
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

// Day-7 growth check-in. Fires roughly a week after a gifter's gift —
// the highest-leverage WOM loop in the product per the design lens
// ("the gifter who just gave is the one most likely to give again").
// Calendar-based daily scan: any gift whose createdAt falls in the
// 7–8 day window AND has a senderEmail AND hasn't already been
// stamped as Day-7-sent gets enqueued. Window (not single day) is
// the same grace pattern as the birthday lead-up — the worker may
// miss a tick during a deploy, and a one-day window would lose the
// follow-up for affected gifts. Window also widens to 14 days as a
// hard upper bound so backfill on first deploy doesn't enqueue
// follow-ups for gifts that are already weeks old (those are too
// late to feel like a follow-up).
//
// Scope: ALL gifts with a senderEmail, opt-in OR opt-out — same
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
    // — they still get the Day-7 (it's transactional). The
    // unsubscribe link in this email lets them opt out of future
    // ones if they want.
    const subscriber = store.subscribersByFund?.[row.fund_id]?.[email];
    if (subscriber?.unsubscribed) {
      // Mark as "sent" anyway so we don't re-evaluate this gift on
      // every worker tick — once unsubscribed, always skipped.
      day7Sent[giftId] = new Date().toISOString();
      storeChanged = true;
      continue;
    }

    const childName = row.recipient_first_name || row.fund_name || "their child";
    const fundUrlFund = { id: row.fund_id, slug: row.fund_slug, name: row.fund_name } as FundReminderRow;
    const giftUrl = buildGiftUrl(baseUrl, fundUrlFund);
    const startFundUrl = buildLoopStartFundUrl(baseUrl, row.fund_id, "gift_day7_followup_email", "email");
    // Unsubscribe URL — if the gifter has a subscriber record, use
    // their token; otherwise mint one on the fly so unsubscribe still
    // works for opt-out-only gifters. The /updates/unsubscribe route
    // accepts either path.
    const unsubscribeToken = subscriber?.unsubscribeToken
      || crypto.createHash("sha1").update(`${row.fund_id}:${email}`).digest("hex");
    const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, unsubscribeToken);

    // Live price snapshot for the "now worth $X" line. Best-effort —
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
        // non-fatal — render uses the no-value fallback
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

// Anniversary email — fires on the gift's annual anniversary. Same
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
  // 0-7 day grace window forward — same window-not-single-day pattern
  // as Day-7 + birthday lead-up — to tolerate worker downtime). The
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

    // Cap anniversary cadence once the kid hits majority — at that
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

    // Live price snapshot — same best-effort pattern as Day-7. The
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

    // Birthday lead-up window — fire when the kid's next birthday is
    // 7–14 days away. The window (not a single day) is intentional: the
    // worker runs on a schedule and may miss a day during a deploy or
    // outage, so a 7-day grace tolerates a missed run without losing
    // the reminder. The childAge cap stays at < 18 — once the kid is
    // an adult, the relationship between gifter and the fund changes
    // (handoff via age18_notification handles that one separately).
    // The lastBirthdayReminderYear dedup means even if the window
    // overlaps two worker runs the gifter only gets one email per
    // calendar year. Was: fire ON the birthday — this iteration moves
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
          // over Z years" — merges the previously-separate Y1-Y17
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

    // Holiday trigger — Nov 15 through Dec 5. The gift-shopping window
    // for the season; before Nov 15 it reads as premature, after Dec 5
    // a parent's-friend gift card decision has usually been made. Once
    // per gifter per calendar year via lastHolidayReminderYear (per-
    // fund — a gifter who's contributed to two kids' funds gets two
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
      const eighteenthBirthday = getMajorityBirthday(fund.recipient_birthdate, Number((fund as any).majority_age) || 18);
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

    const delivery = await sendEmail({
      to: rendered.to,
      subject: rendered.subject,
      text: rendered.text,
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
// per-subscriber counts never were — so the Settings → Notifications
// "Gifter subscribers" panel showed every subscriber as "0 gifts · $0"
// even after they'd given hundreds of dollars. Settings has been
// reading honest values; the writes were just missing.
//
// Defensive shape: silent no-op when fundId/email is missing, when
// the subscriber doesn't exist for this fund (gifter who didn't opt
// in), or when amount is invalid. Failures are logged but never throw —
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
// threshold never emails them twice. Errors are logged but not thrown — a
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
    if (!copy) return; // Unknown threshold — defensive, shouldn't happen.

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
