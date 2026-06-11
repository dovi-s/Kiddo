// Seed the Dunphy family demo accounts + funds + gifts + holdings.
//
// One-time idempotent seed for the public-facing demo at /login (creds
// in DUNPHY_DEMO_SPEC.md). Run with: `npm run seed:dunphys`.
//
// Creates seven user accounts (Phil + Claire + 5 gifters), three child
// funds (Haley / Alex / Luke), realistic gift history, holdings, memory
// entries. All flagged isDemoAccount=true so future workers (gifter-
// notification, recurring-contribution, etc.) can skip them and the
// authenticated app can render the demo banner.
//
// IDEMPOTENT: Running this script multiple times is safe. It uses
// upsert-by-email semantics on the user accounts; for the fund + gift
// data, it bails early if Phil's account already has funds (assumes
// the demo is already seeded and exits cleanly).
//
// PAPER-TRADING ONLY: This script writes seeded data to the local DB.
// The money-flow sandboxing (mock Stripe / mock DriveWealth for demo
// accounts) is NOT yet implemented in the endpoints. For now, demo
// accounts are effectively browse-only — they hit the existing
// payment-method-required gates if anyone tries to transact. Full
// sandboxing is Phase 2 per DUNPHY_DEMO_SPEC.md.

import "../server/env";
import bcrypt from "bcryptjs";
import { db, pool } from "../server/db";
import {
  users,
  funds,
  gifts,
  giftAllocations,
  holdings,
  memoryEntries,
  activities,
  events,
  subscriptions,
  fundCollaborators,
  ageTransitions,
  parentContributions,
  recurringGifts,
  bankAccounts,
  fundSnapshots,
  thankYous,
  type InsertGift,
  type InsertMemoryEntry,
} from "../shared/schema";
import { eq, and, asc, inArray, like } from "drizzle-orm";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  loadPrices,
  buildPortfolio,
  allocateGift,
  holdingsFromPositions,
  totalValue,
  portfolioValueAtDate,
  type GiftInput,
  type BuildResult,
} from "./lib/demo-portfolio";
import {
  giftsForKid,
  rebalancesForKid,
  recurringNoteFor,
  momNoteFor,
  sealedLetterFor,
  type KidStory,
} from "./lib/demo-roster";
// Single source for the growth-passed milestone's constants + copy: the seed
// must write byte-identical rows to the engine (see GROWTH_PASSED_GIFTS).
import { GROWTH_PASSED_GIFTS } from "../server/milestones";

// Real historical prices (committed fixture); every gift buys real shares at
// the actual adjusted close on its month. Loaded once.
const PRICES = loadPrices();

// Display names for the tickers the demo uses (holdings.name).
const TICKER_NAMES: Record<string, string> = {
  AAPL: "Apple",
  GOOGL: "Google",
  DIS: "Disney",
  RBLX: "Roblox",
  // Per-kid personality picks (giftsForKid in demo-roster.ts). Names match
  // shared/stock-picks.ts so demo holdings read identically to the real product.
  NTDOY: "Nintendo",
  MCD: "McDonald's",
  AMZN: "Amazon",
  NFLX: "Netflix",
  NKE: "Nike",
  SBUX: "Starbucks",
  DUOL: "Duolingo",
  SPOT: "Spotify",
  VTI: "US Total Market",
  VXUS: "International",
  BND: "Bonds",
};

// English ordinal for "{N}th Birthday" occasion names.
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// NOTE: the historical balance curve is now generated from REAL prices (the
// committed fixture + buildPortfolio/portfolioValueAt), so the old synthetic
// market-index model (MARKET_DRAWDOWN_ANCHORS + monthKeyToReturn + scale-to-
// fit) was deleted. The chart's drawdowns (2008, 2020, 2022, ...) are now the
// fund's actual market value over time, not a stylized representation.

const DEMO_PASSWORD = "dunphyfamily";

// Account roster. All accounts share the same password since the demo
// is meant to be shared publicly. The password meets Kora's current
// auth.ts ≥8-char minimum (12 chars, no complexity required).
const ACCOUNTS = [
  {
    email: "phil@dunphyfamily.com",
    firstName: "Phil",
    lastName: "Dunphy",
    preferredName: "Dad",
    // Phil (Dad) is the CO-PARENT. Claire (Mom) is the primary custodian / lead
    // persona — moms are the day-to-day primary user (kin-keeping, the Memory
    // Book, managing the kids' accounts), so the demo leads as Mom. Phil still
    // engages (his sealed at-18 letter, co-parent access). Flipped 2026-06-11.
    role: "co-parent" as const,
    profileImageUrl: "https://pyxis.nymag.com/v1/imgs/1a5/a8b/1a2353ae4dfaf73880973701a654c5fdb8-ty-burrell-modern-family.rsquare.w330.jpg",
  },
  {
    email: "claire@dunphyfamily.com",
    firstName: "Claire",
    lastName: "Dunphy",
    preferredName: "Mom",
    // Claire (Mom) is the PRIMARY CUSTODIAN / fund owner / lead persona — see
    // the note on Phil above. Flipped 2026-06-11.
    role: "parent" as const,
    profileImageUrl: "https://arianadickson.wordpress.com/wp-content/uploads/2014/04/webct_upload_applet.jpg",
  },
  { email: "jay@dunphyfamily.com",      firstName: "Jay",      lastName: "Pritchett", preferredName: "Jay",      role: "gifter" as const, profileImageUrl: "https://openpsychometrics.org/tests/characters/test-resources/pics/MF/1.jpg" },
  { email: "gloria@dunphyfamily.com",   firstName: "Gloria",   lastName: "Pritchett", preferredName: "Gloria",   role: "gifter" as const, profileImageUrl: "https://static0.srcdn.com/wordpress/wp-content/uploads/2018/11/Modern-Family-Gloria.jpg?q=50&fit=crop&w=825&dpr=1.5" },
  { email: "mitchell@dunphyfamily.com", firstName: "Mitchell", lastName: "Pritchett", preferredName: "Mitchell", role: "gifter" as const, profileImageUrl: "https://i.ytimg.com/vi/hVvQTyeLyp0/maxresdefault.jpg" },
  { email: "cameron@dunphyfamily.com",  firstName: "Cameron",  lastName: "Tucker",    preferredName: "Cam",      role: "gifter" as const, profileImageUrl: "https://tvovermind.com/wp-content/uploads/2022/01/Cam-Tucker-750x402.jpg" },
  { email: "manny@dunphyfamily.com",    firstName: "Manny",    lastName: "Delgado",   preferredName: "Manny",    role: "gifter" as const, profileImageUrl: "https://cdn1.edgedatg.com/aws/v2/abc/ModernFamily/person/737059/0742ee201d7c06d751852e65200c9750/362x362-Q90_0742ee201d7c06d751852e65200c9750.jpg" },
  // Haley is the graduated adult: past CA majority (21), her fund is transferred
  // to her below (step 3b). The "graduate" role gives her approved KYC in
  // upsertUser — she owns a live individual investing account now, not a
  // parent-custodial one. Logging in as her renders the REAL post-handoff adult
  // experience (the demo is the real app, not a mock view).
  { email: "haley@dunphyfamily.com",    firstName: "Haley",    lastName: "Dunphy",    preferredName: "Haley",    role: "graduate" as const, profileImageUrl: "https://cdn.mos.cms.futurecdn.net/RYvAQd4QgRDhP3qKVPEvNK.jpg" },
];

// Three Dunphy kids. Ages locked relative to today so the demo always
// reads "Haley is 22 (a year past CA majority age 21 — the graduated
// adult-account demo), Alex is ~30 days from 21 (the approaching-handoff
// demo), Luke is 13" regardless of when the seed is run. Haley sits a
// clear year above Alex so the siblings don't read as same-age twins.
// Birthdates derived as `today - years - months_offset`.
// Per DUNPHY_DEMO_SPEC.md locked rule: Dunphys are LA-based →
// California UTMA majority age = 21. Set on each fund.
function birthdateForAge(years: number, monthsBack = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

// Holdings/balances are no longer hardcoded here — they're computed from the
// real gift history × real historical prices (see seedKidFund + demo-roster +
// demo-portfolio). Recurring amounts are tuned so the emergent balances land
// at the aspirational targets (Luke ~$22k, Alex ~$52k, Haley ~$79k) via the
// offline report (`npm run report:demo-portfolio`).
const KIDS = [
  {
    firstName: "Haley",
    childPhotoUrl: "https://cdn.mos.cms.futurecdn.net/RYvAQd4QgRDhP3qKVPEvNK.jpg",
    lastName: "Dunphy",
    pronoun: "she" as const,
    majorityAge: 21,
    ageYears: 22, // a year PAST CA majority (21) — graduated adult-account demo; sits clearly above Alex so they don't read as twins
    birthdate: birthdateForAge(22, 4), // ~22y4m, a year past the handoff
    state: "CA",
    slug: "haley-dunphy",
    strategy: "conservative" as const,
    description: "Haley is 22, a year past majority. The fund is hers now — this is what graduating looks like.",
    // Recurring ended at the handoff: the parent's auto-invest stops once
    // ownership transfers. The fund still carries its full realized history
    // (see giftsForKid / seedKidFund); Haley controls it from here.
    recurring: { amount: 85, status: "paused" },
  },
  {
    firstName: "Alex",
    childPhotoUrl: "https://i.pinimg.com/474x/c8/51/f7/c851f724bd9afecb195095d5c44220b2.jpg",
    lastName: "Dunphy",
    pronoun: "she" as const,
    majorityAge: 21,
    ageYears: 20, // ~30 days from CA majority (21) — the approaching-handoff demo
    birthdate: birthdateForAge(20, 11), // ~30 days from age 21 (handoff demo)
    state: "CA",
    slug: "alex-dunphy",
    strategy: "balanced" as const,
    description: "Alex is weeks from 21. This is where the handoff begins.",
    // Recurring stays ACTIVE right up to the handoff — the parent keeps
    // contributing until the fund actually transfers at 21. The worker
    // auto-pauses AT majority, NOT before (only Haley, already graduated, is
    // handoff-paused). Fixed 2026-06-04: was seeded "paused", which implied
    // recurring stops as the handoff nears (it doesn't) and surfaced a
    // confusing "Recurring paused · resume" prompt on a fund still funding.
    recurring: { amount: 50, status: "active" },
  },
  {
    firstName: "Luke",
    childPhotoUrl: "https://static0.srcdn.com/wordpress/wp-content/uploads/2023/02/luke-smiling-in-season-11-of-modern-family.jpg",
    lastName: "Dunphy",
    pronoun: "he" as const,
    majorityAge: 21,
    ageYears: 13,
    birthdate: birthdateForAge(13, 7),
    state: "CA",
    slug: "luke-dunphy",
    strategy: "growth" as const,
    description: "Luke's fund has the longest runway. Growth mix all the way.",
    recurring: { amount: 100, status: "active" },
  },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function upsertUser(account: typeof ACCOUNTS[number]): Promise<string> {
  // Parents (Phil, Claire) land KYC-approved so the demo dashboard
  // doesn't surface "Activate investing / Until we verify your
  // identity" prompts. Gifters don't need KYC — they go through the
  // gift checkout flow. Locked 2026-05-21 with the demo polish pass.
  const isParent = account.role === "parent" || account.role === "co-parent" || account.role === "graduate";
  const kycStatus = isParent ? "approved" : "none";
  // Check for existing by email. If found, update flags + return id.
  const [existing] = await db.select().from(users).where(eq(users.email, account.email)).limit(1);
  if (existing) {
    await db.update(users).set({
      isDemoAccount: true,
      firstName: account.firstName,
      lastName: account.lastName,
      preferredName: account.preferredName,
      profileImageUrl: (account as any).profileImageUrl ?? null,
      kycStatus,
    }).where(eq(users.id, existing.id));
    return existing.id;
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [created] = await db.insert(users).values({
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    preferredName: account.preferredName,
    profileImageUrl: (account as any).profileImageUrl ?? null,
    passwordHash,
    isDemoAccount: true,
    kycStatus,
  } as any).returning();
  return created.id;
}

// Gifter milestone-update opt-ins. The parent's "who's following along" surface
// (GET /api/funds/:id/gifter-notifications) reads a FILE-based store at
// .local/gifter-notifications.json (subscribersByFund[fundId][email]) — NOT the
// DB — so the DB reseed alone leaves it empty ("0 gifters following"). Seed a
// believable subset of opted-in gifters so the surface is lived-in. The engaged
// grandparents + uncle opt in; Mitchell (set-and-forget), Manny (young), and
// Claire (co-parent, sees everything) intentionally don't, so it reads as a
// real subset, not "everyone". Merges into the file (preserves other funds'
// entries); per-fund stats are computed from the gifts just inserted. Orphaned
// entries for prior reseeds' fund IDs are harmless (queried only by live id).
const OPT_IN_GIFTER_EMAILS = new Set([
  "gloria@dunphyfamily.com",
  "cameron@dunphyfamily.com",
  "jay@dunphyfamily.com",
]);
const GIFTER_NOTIF_PATH = path.join(process.cwd(), ".local", "gifter-notifications.json");

async function seedGifterNotifications(
  fundId: string,
  externalGifts: Array<{ senderName: string; senderEmail?: string; amount: number; createdAt: Date }>,
): Promise<number> {
  const byEmail = new Map<string, { name: string; count: number; total: number; first: number; last: number }>();
  for (const g of externalGifts) {
    if (!g.senderEmail) continue; // long-tail / anonymous givers have no account to follow along
    const email = g.senderEmail.toLowerCase();
    if (!OPT_IN_GIFTER_EMAILS.has(email)) continue;
    const t = g.createdAt.getTime();
    const cur = byEmail.get(email);
    if (cur) {
      cur.count += 1; cur.total += g.amount;
      cur.first = Math.min(cur.first, t); cur.last = Math.max(cur.last, t);
    } else {
      byEmail.set(email, { name: g.senderName, count: 1, total: g.amount, first: t, last: t });
    }
  }
  if (byEmail.size === 0) return 0;

  let store: { settingsByFund: Record<string, any>; subscribersByFund: Record<string, any>; memorySharesByToken: Record<string, any> } =
    { settingsByFund: {}, subscribersByFund: {}, memorySharesByToken: {} };
  try {
    const parsed = JSON.parse(await fsp.readFile(GIFTER_NOTIF_PATH, "utf8"));
    if (parsed && typeof parsed === "object") {
      store.settingsByFund = parsed.settingsByFund || {};
      store.subscribersByFund = parsed.subscribersByFund || {};
      store.memorySharesByToken = parsed.memorySharesByToken || {};
    }
  } catch { /* no file yet → fresh store */ }

  const subscribers: Record<string, any> = {};
  for (const [email, s] of Array.from(byEmail.entries())) {
    subscribers[email] = {
      email,
      name: s.name,
      optedInAt: new Date(s.first).toISOString(), // opted in around their first gift
      unsubscribed: false,
      unsubscribedAt: null,
      unsubscribeToken: `demo-unsub-${fundId}-${email.split("@")[0]}`,
      contributionCount: s.count,
      totalContributed: Number(s.total.toFixed(2)),
      fundIds: [fundId],
      lastGiftAt: new Date(s.last).toISOString(),
      isAnonymous: false,
    };
  }
  store.subscribersByFund[fundId] = subscribers;
  store.settingsByFund[fundId] = store.settingsByFund[fundId] || {
    birthdayReminders: true,
    memoryBookSharing: true,
    age18Notification: true,
    giftConfirmations: true,
    memoryBookSharesSentThisYear: 0,
    memoryBookShareYear: new Date().getFullYear(),
    updatedAt: new Date().toISOString(),
  };

  await fsp.mkdir(path.dirname(GIFTER_NOTIF_PATH), { recursive: true });
  await fsp.writeFile(GIFTER_NOTIF_PATH, JSON.stringify(store, null, 2), "utf8");
  return byEmail.size;
}

// Memory entries to mark isFeatured (the Memory Book "Pinned" lens) — chosen
// per-kid inside seedKidFund, written once at the end of the run. The store is
// the same .local/memory-entry-meta.json the server's patchMemoryMeta writes.
// Merge discipline: keys for entry ids that no longer EXIST in the DB are
// pruned (each reseed mints new entry ids, so prior demo pins become orphans —
// without pruning the file grows every reseed and a raced run leaves junk),
// while keys for live non-demo entries are preserved untouched. NOTE: the
// running dev server caches this file in-process (loadMemoryMeta) — restart it
// after seeding for pins to show.
const PINNED_MEMORY_ENTRY_IDS: string[] = [];
async function writeDemoMemoryEntryMeta(): Promise<void> {
  if (PINNED_MEMORY_ENTRY_IDS.length === 0) return;
  const metaPath = path.join(process.cwd(), ".local", "memory-entry-meta.json");
  let store: Record<string, { visibility?: string; isFeatured?: boolean }> = {};
  try {
    store = JSON.parse((await fsp.readFile(metaPath, "utf8")) || "{}") || {};
  } catch {
    store = {};
  }
  // Prune orphans: any key whose entry id is gone from the DB.
  const existingKeys = Object.keys(store);
  if (existingKeys.length > 0) {
    const liveRows = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .where(inArray(memoryEntries.id, existingKeys));
    const live = new Set(liveRows.map((r) => r.id));
    for (const key of existingKeys) {
      if (!live.has(key)) delete store[key];
    }
  }
  for (const id of PINNED_MEMORY_ENTRY_IDS) {
    store[id] = { visibility: "public", isFeatured: true };
  }
  await fsp.mkdir(path.dirname(metaPath), { recursive: true });
  await fsp.writeFile(metaPath, JSON.stringify(store, null, 2), "utf8");
}

async function seedKidFund(parentUserId: string, kid: typeof KIDS[number], parentDisplayName: string): Promise<string> {
  // Idempotent: if Phil already owns a fund with this slug, return its id.
  const [existing] = await db.select().from(funds).where(
    and(eq(funds.userId, parentUserId), eq(funds.slug, kid.slug)),
  ).limit(1);
  if (existing) {
    return existing.id;
  }

  // Build the REAL portfolio. Every gift buys shares at the ACTUAL historical
  // price on its month (committed fixture), and the product's age-based glide-
  // path automatically de-risks the managed index sleeve as the child nears
  // majority (the ONLY position changes after a buy — not discretionary
  // trading). Holdings, balance, and the chart are all emergent from honest
  // market math — no hand-picked balance, no scale-to-fit. The gift schedule
  // is tuned so the emergent totals land on the aspirational targets; verify
  // offline with `npm run report:demo-portfolio`.
  const kidStory: KidStory = {
    firstName: kid.firstName,
    ageYears: kid.ageYears,
    birthdate: kid.birthdate,
    recurringAmount: kid.recurring.amount,
    recurringPaused: kid.recurring.status === "paused",
    pronoun: kid.pronoun,
    majorityAge: kid.majorityAge,
    strategy: kid.strategy,
  };
  const giftList = giftsForKid(kidStory);
  const giftSum = giftList.reduce((sum, g) => sum + g.amount, 0);
  const giftInputs: GiftInput[] = giftList.map((g) => ({ date: g.createdAt, amount: g.amount, ticker: g.selectedTicker }));
  const rebalances = rebalancesForKid(kidStory);
  const portfolio = buildPortfolio(PRICES, giftInputs, rebalances);
  const computedHoldings = holdingsFromPositions(PRICES, portfolio.positions);
  const investedValue = totalValue(computedHoldings);
  const costBasis = computedHoldings.reduce((sum, h) => sum + h.costBasis, 0);
  // Backdate the fund's creation to just before its earliest gift. The
  // funds table defaults createdAt=now, but the seed's gifts span YEARS
  // into the past — and the Dashboard "{Kid}'s fund so far" breakdown
  // starts its window at the fund's createdAt. A now-dated fund therefore
  // excluded EVERY historical gift, zeroing the Gifts / recurring /
  // one-time rows and dumping the whole balance into "Market growth"
  // (impossible math: $0 contributed, $9k of "growth", and a "Worth today"
  // that didn't match the hero balance). Anchoring createdAt before the
  // first gift puts every gift inside the window so the breakdown
  // attributes correctly, and makes "Growing for {Kid} since {year}"
  // honest (a fund with 2014 gifts was not created in 2026). Locked
  // 2026-05-26 with the demo-breakdown audit.
  const earliestGiftMs = giftList.reduce((min, g) => {
    const t = new Date(g.createdAt).getTime();
    return Number.isFinite(t) && t < min ? t : min;
  }, Date.now());
  // One day before the first gift — the fund exists, THEN gifts arrive.
  const fundCreatedAt = new Date(earliestGiftMs - 24 * 60 * 60 * 1000);

  const [fund] = await db.insert(funds).values({
    userId: parentUserId,
    // Backdated so the fund predates its own gift history (see above) —
    // otherwise the "fund so far" breakdown shows $0 in gifts.
    createdAt: fundCreatedAt,
    recipientFirstName: kid.firstName,
    recipientLastName: kid.lastName,
    childPhotoUrl: (kid as any).childPhotoUrl ?? null,
    // recipientBirthdate is a timestamp column in shared/schema.ts —
    // Drizzle's PgTimestamp.mapToDriverValue calls .toISOString() on
    // the value, so a raw "YYYY-MM-DD" string crashes the insert.
    // Convert to a Date before passing. Locked 2026-05-21 after this
    // crashed every seed run and left every demo user with zero funds,
    // which made /demo → Dashboard → /get-started for every visitor.
    //
    // Anchor at NOON UTC, not midnight. The client formats the handoff
    // date ("{kid} turns 21 on...") via toLocaleDateString in LOCAL time;
    // a midnight-UTC birthdate renders as the PREVIOUS day west of UTC
    // (Nov 2 birthdate showed "Nov 1" handoff in US timezones), one day
    // off from the birthday OCCASION, which already anchors noon UTC
    // (Date.UTC(..., 12) below). Noon keeps the calendar day stable
    // across every US timezone so both surfaces read the same date.
    recipientBirthdate: new Date(`${kid.birthdate}T12:00:00Z`),
    pronoun: kid.pronoun,
    // Schema column is recipientState (recipient_state); a bare `state`
    // key wrote to nothing, leaving recipientState NULL on every demo fund
    // (so the snapshot fell back to a state default instead of using the
    // elected majority age, and showed no state name). Fixed 2026-05-26.
    recipientState: kid.state,
    majorityAge: kid.majorityAge,
    name: `${kid.firstName}'s Fund`,
    slug: kid.slug,
    description: kid.description,
    // Canonical casing "UTMA" (matches driveWealthAccountSetup + the real fund
    // creation), not "utma" — several reads compare accountType === "UTMA".
    accountType: "UTMA",
    status: "active",
    // Column is `investmentStrategy` (DB: investment_strategy). The old
    // `strategy` key matched NO column, so Drizzle silently dropped it and
    // every demo fund fell back to the "auto_invest" default — which the
    // dashboard renders as "{Kid}'s mix (Growth)" with an EMPTY emoji for
    // all three kids (so Alex/balanced + Haley/conservative both mislabeled
    // as Growth, and the missing emoji left a stray "( Growth)" gap).
    investmentStrategy: kid.strategy,
    balance: investedValue.toFixed(2),
    cashBalance: "0.00",
    pendingBalance: "0.00",
    contributorCount: 0, // recomputed below from inserted gifts
    // Stamp SSN-collected so the dashboard SSN nudge doesn't fire on
    // demo funds. Real users see this nudge until they enter the
    // recipient's SSN; demo funds are sandboxed and the SSN check
    // would block "investing" on every demo session. Locked 2026-05-21.
    recipientSsnCollectedAt: new Date(),
    recipientSsnLast4: "1234",
  } as any).returning();

  // Seed holdings from the REAL computed positions: shares bought at historical
  // prices, valued at the current price. No scaling — these ARE the real
  // numbers, and the server's self-heal (balance = SUM(holdings.current_value))
  // will agree with the fund balance exactly.
  for (const h of computedHoldings) {
    await db.insert(holdings).values({
      fundId: fund.id,
      ticker: h.ticker,
      name: TICKER_NAMES[h.ticker] ?? h.ticker,
      shares: h.shares.toFixed(6),
      costBasis: h.costBasis.toFixed(2),
      currentValue: h.currentValue.toFixed(2),
      gain: h.gain.toFixed(2),
    } as any);
  }

  // Audio URL for Gloria's gifts. Only set when the demo audio assets
  // are present in production (gated by DEMO_AUDIO_ENABLED env var). See
  // client/public/demo-audio/README.md for the file spec. Without the
  // flag, Gloria's voice memos stay text-only — better than a broken
  // play button pointing at 404'd audio.
  const audioEnabled = process.env.DEMO_AUDIO_ENABLED === "1";
  const gloriaAudioUrl = audioEnabled
    ? `/demo-audio/gloria-${kid.firstName.toLowerCase()}.mp3`
    : null;

  // Seed gifts + one gift_message memory entry per gift. Matches
  // production behavior: the Stripe webhook creates a memory_entry
  // (type "gift_message") for every successful gift, so the demo
  // seed mirrors that pattern. (giftList computed above with the portfolio.)
  const sendersSeen = new Set<string>();

  // Phil's recurring schedule (parent_contribution). Created BEFORE the
  // gift loop so each monthly cycle can link back to it — exactly the
  // shape the production worker leaves behind. totalContributed +
  // lastRunDate are backfilled from the cycles after they're inserted.
  const recurringPaused = kid.recurring.status === "paused";
  // A graduated kid's fund has transferred, so its (former parent's) recurring
  // was ended by the handoff, not paused by the user — mirror what the worker
  // stamps in production so the Activity/Dashboard read-only "Ended at handoff"
  // treatment renders correctly in the demo. Pre-majority paused funds keep
  // "user" (a plain manual pause).
  const recurringEndedAtHandoff = recurringPaused && kid.ageYears >= kid.majorityAge;
  // The single Memory Book note stamped on the first recurring cycle (varies
  // per kid). The cycle gift rows themselves carry no message.
  const recurringChargeNote = recurringNoteFor(kid);
  const recurringNextRun = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d; })();
  const [philContribution] = await db.insert(parentContributions).values({
    fundId: fund.id,
    userId: parentUserId,
    amount: kid.recurring.amount.toFixed(2),
    frequency: "monthly",
    status: kid.recurring.status,
    note: recurringChargeNote,
    pauseReason: recurringPaused ? (recurringEndedAtHandoff ? "majority_handoff" : "user") : null,
    pausedAt: recurringPaused ? new Date() : null,
    nextRunDate: recurringPaused ? null : recurringNextRun,
  } as any).returning();
  let recurringTotal = 0;
  let recurringLastDate: Date | null = null;
  let recurringFirstDate: Date | null = null;
  let recurringMemoryStamped = false;
  // Collect external gifts so a realistic subset can be seeded as ALREADY-SENT
  // thank-yous after the loop (so the demo shows the "Thanked" state, not only
  // the auto-backfilled "awaiting" drafts). Phil's recurring cycles are excluded
  // — the Memory Book renders those as "from you", never thankable.
  const externalGifts: Array<{ giftId: string; senderName: string; senderEmail?: string; amount: number; createdAt: Date; occasion?: string; memoryEntryId?: string; hasAudio?: boolean }> = [];
  for (const g of giftList) {
    const isRecurring = g.kind === "recurring";
    // A parent ONE-TIME top-up (Phil's own money, not an external gift): counts
    // as "Your one-time additions", shows on the dashboard's one-time card, and
    // never gets a self-thank-you / gifter follow-along.
    const isParentOneTime = g.kind === "parent_one_time";
    const isParentContrib = isRecurring || isParentOneTime;
    const giftAudioUrl = g.hasAudio ? gloriaAudioUrl : null;
    // Real share lots for THIS gift at its month's historical price (pick =
    // single ticker; otherwise the diversified managed mix).
    const processed = allocateGift(PRICES, { date: g.createdAt, amount: g.amount, ticker: g.selectedTicker });
    const giftRow: InsertGift = {
      fundId: fund.id,
      senderName: g.senderName,
      senderEmail: g.senderEmail ?? null,
      amount: g.amount.toFixed(2),
      netAmount: g.amount.toFixed(2),
      status: "invested",
      message: g.message ?? null,
      executionModel: g.selectedTicker ? "pick" : "auto_invest",
      selectedTicker: g.selectedTicker ?? null,
      // Real settlement fields (normally written by the invest pipeline).
      sharesAcquired: processed.sharesAcquired.toFixed(6),
      priceAtPurchase: processed.priceAtPurchase.toFixed(4),
      // Explicit anonymous flag (privacy choice — never inferred from name).
      isAnonymous: g.isAnonymous ?? false,
      audioUrl: giftAudioUrl,
      // Recurring cycles link to Phil's schedule + carry the worker's
      // source tag, exactly as recurringContributionWorker stamps them.
      // parentContributionId is what moves them into the dashboard's
      // "Your recurring investments" breakdown row (instead of "one-time").
      parentContributionId: isRecurring ? philContribution.id : null,
      source: isRecurring ? "recurring_worker" : null,
      createdAt: new Date(g.createdAt),
    } as any;
    const [insertedGift] = await db.insert(gifts).values(giftRow as any).returning();
    // gift_allocations ledger: exactly which ticker(s) this gift's money funded
    // (the exact attribution the holding-detail sheet reads).
    for (const a of processed.allocations) {
      await db.insert(giftAllocations).values({
        giftId: insertedGift.id,
        fundId: fund.id,
        ticker: a.ticker,
        costBasis: a.costBasis.toFixed(2),
        shares: a.shares.toFixed(6),
        source: g.selectedTicker ? "pick" : "auto",
      } as any);
    }
    // Unique contributors: prefer email, fall back to name (long-tail / one-off
    // givers have no account, so no email).
    sendersSeen.add((g.senderEmail ?? g.senderName).toLowerCase());

    // Activity-ledger row, mirroring the "arrival" activity production
    // writes in completeGiftPostPayment (webhookHandlers.ts:241):
    // gift_received for gifters, parent_contribution for Phil's recurring
    // cycles. Backdated to the gift date so the Activity tab reads as a
    // real multi-year ledger instead of just "Fund created." The
    // parentContributionId in metadata also lets the recurring schedule's
    // History tab pick up every cycle. (We mirror only the arrival row,
    // not the paired gift_invested row, to keep the demo feed from
    // doubling every entry with a near-identical "invested across the
    // mix" line — the arrival row is the legible ledger event.)
    await db.insert(activities).values({
      userId: parentUserId,
      fundId: fund.id,
      type: isParentContrib ? "parent_contribution" : "gift_received",
      title: isRecurring
        ? `You contributed $${g.amount.toFixed(2)}`
        : isParentOneTime
          ? `You invested $${g.amount.toFixed(2)}`
          : `Gift from ${g.senderName}`,
      description: isParentContrib
        ? (g.selectedTicker ? `Investing into ${String(g.selectedTicker).toUpperCase()}` : "Investing across the diversified mix")
        : (g.message ? `"${g.message}"` : "No note."),
      amount: g.amount.toFixed(2),
      metadata: JSON.stringify({
        giftId: insertedGift.id,
        ticker: g.selectedTicker || null,
        message: g.message || null,
        executionModel: isRecurring ? "auto_invest" : (isParentOneTime ? "pick" : null),
        senderEmail: g.senderEmail || null,
        senderName: g.senderName || null,
        // How the family refers to the custodian who made this contribution
        // ("Dad"). Lets the post-handoff owner view credit "Dad added $X"
        // instead of the custodial-era "You contributed". On any parent
        // contribution (recurring or one-time); external gifts carry their own.
        contributorName: isParentContrib ? parentDisplayName : null,
        isParentContribution: isParentContrib,
        // Only recurring cycles link to the schedule; one-time additions don't.
        parentContributionId: isRecurring ? philContribution.id : null,
      }),
      createdAt: new Date(g.createdAt),
    } as any);

    if (isParentOneTime) {
      // Parent's own one-time addition: a gift_message memory (so it shows in
      // the Memory Book, authored by the parent) — but NOT an external gift, so
      // no self-thank-you and no gifter follow-along.
      await db.insert(memoryEntries).values({
        fundId: fund.id,
        giftId: insertedGift.id,
        type: "gift_message",
        content: g.message ?? "",
        authorRole: "parent",
        authorName: g.senderName,
        visibility: "kid_now",
        createdAt: new Date(g.createdAt),
      } as any);
      continue;
    }

    if (isRecurring) {
      // Money + schedule bookkeeping for the cycle. The Memory Book gets
      // exactly ONE entry — a parent_note on the FIRST (oldest) cycle —
      // mirroring the worker's "stamp once on first cycle, never again"
      // rule (recurringContributionWorker.ts:235). Every later cycle is
      // money-only, so 36 months of auto-investing never buries the
      // timeline. giftList pushes Phil's cycles oldest-first, so the first
      // one we hit IS the first cycle.
      recurringTotal += g.amount;
      const chargeDate = new Date(g.createdAt);
      if (!recurringLastDate || chargeDate > recurringLastDate) recurringLastDate = chargeDate;
      if (!recurringFirstDate || chargeDate < recurringFirstDate) recurringFirstDate = chargeDate;
      if (!recurringMemoryStamped && recurringChargeNote) {
        await db.insert(memoryEntries).values({
          fundId: fund.id,
          giftId: insertedGift.id,
          type: "parent_note",
          content: recurringChargeNote,
          authorRole: "parent",
          authorName: g.senderName,
          visibility: "kid_now",
          createdAt: chargeDate,
        } as any);
        recurringMemoryStamped = true;
      }
      continue;
    }

    // Ordinary gifts: one gift_message memory entry each, mirroring the
    // public-gift webhook (with the same audio/transcript fields).
    // .returning() so the entry id can be pinned below (Pinned lens wear).
    const [giftMemoryEntry] = await db.insert(memoryEntries).values({
      fundId: fund.id,
      giftId: insertedGift.id,
      type: "gift_message",
      content: g.message ?? "",
      authorRole: "gifter",
      authorName: g.senderName,
      visibility: "kid_now",
      audioUrl: giftAudioUrl,
      // Transcript ships even when audio file isn't deployed — text
      // is the memory either way.
      audioTranscript: g.hasAudio
        ? (audioEnabled
            ? `Mi amor ${kid.firstName}, never forget your familia. Te amo, mi ${kid.pronoun === "she" ? "nieta" : "nieto"}.`
            : null)
        : null,
      createdAt: new Date(g.createdAt),
    } as any).returning();
    externalGifts.push({ giftId: insertedGift.id, senderName: g.senderName, senderEmail: g.senderEmail, amount: g.amount, createdAt: new Date(g.createdAt), occasion: g.occasion, memoryEntryId: giftMemoryEntry?.id, hasAudio: !!g.hasAudio });
  }

  // Backfill the schedule's realized totals from the cycles just written —
  // the same fields the worker accumulates (totalContributed) and advances
  // (lastRunDate). Now the recurring detail reads real history
  // ("$X over N cycles · last {date} · next {date}") instead of $0.
  await db.update(parentContributions)
    .set({
      totalContributed: recurringTotal.toFixed(2),
      lastRunDate: recurringLastDate ?? null,
      // Backdate the schedule's start to its FIRST cycle. The row defaults
      // createdAt=now, but the recurring detail's "Started" stat reads
      // schedule.createdAt — so without this it showed today even though the
      // 36 cycles span ~3 years (an impossible "Started today + 36 cycles").
      ...(recurringFirstDate ? { createdAt: recurringFirstDate } : {}),
    })
    .where(eq(parentContributions.id, philContribution.id));

  // Update contributor count from unique senders.
  await db.update(funds)
    .set({ contributorCount: sendersSeen.size })
    .where(eq(funds.id, fund.id));

  // Seed ALREADY-SENT thank-yous for the external gifts, so a prospect sees the
  // "Thanked" state in the Memory Book (the auto-backfill GET only ever creates
  // "awaiting" drafts). Rule: thank every external gift older than ~60 days —
  // i.e., an engaged parent who's caught up except the most recent couple
  // months. The freshest gifts (incl. the just-arrived one) stay awaiting, so
  // the actionable "thank now" prompt + composer also show at the top of the
  // book. Self-gifts (Phil's recurring) were never collected, so they're
  // untouched and render as "from you". Pronoun-correct; mirrors the Memory
  // Book's own warm template.
  const nowMs = Date.now();
  const thankMinAgeMs = 60 * 24 * 60 * 60 * 1000;
  // A few warm, parent-voiced variants so tapping different "Thanked" entries
  // in the demo reveals real-feeling notes, not one identical template. Picked
  // deterministically by gifter name (reproducible). Em-dash-free per the
  // locked voice rule.
  const THANK_VARIANTS: Array<(first: string, amt: string, kidName: string, willRead: string, age: number) => string> = [
    (first, amt, kidName, willRead, age) => `Dear ${first},\n\nThank you so much for your $${amt} gift to ${kidName}'s fund. It means more than you know: not just the investment itself, but the fact that you showed up for ${kidName}'s future.\n\n${kidName} will read this when ${willRead} ${age}.\n\nWith love,\nPhil`,
    (first, amt, kidName, willRead, age) => `${first}, just wanted to say thank you. Your $${amt} went straight into ${kidName}'s fund, and ${willRead} going to see it (and this note) at ${age}. We're so grateful you're part of ${kidName}'s story.\n\nPhil`,
    (first, amt, kidName) => `Thank you, ${first}! ${kidName}'s fund grew by $${amt} because of you. We can't wait to show ${kidName} who was there from the very start.\n\nWith love,\nPhil and Claire`,
    (first, amt, kidName, willRead, age) => `Dear ${first},\n\nWhat a generous gift, $${amt} toward ${kidName}'s future. Years from now ${willRead} going to understand exactly what this meant. Thank you for believing in ${kidName} this early.\n\nPhil`,
    (first, amt, kidName) => `${first}, thank you so much. The $${amt} is invested and already part of something that will be ${kidName}'s one day. We're so glad you're in ${kidName}'s corner.\n\nWith love,\nPhil`,
  ];
  for (const eg of externalGifts) {
    const age = nowMs - eg.createdAt.getTime();
    if (age < thankMinAgeMs) continue; // recent gifts stay awaiting (actionable)
    // Skip the email-less long-tail / anonymous one-off givers — you can't
    // really thank "Anonymous" or a random one-off, so they stay "awaiting,"
    // which reads as a realistic backlog rather than a perfectly-cleared book.
    if (!eg.senderEmail) continue;
    const first = eg.senderName.split(" ")[0];
    const amt = eg.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const willRead = kid.pronoun === "she" ? "she's" : kid.pronoun === "he" ? "he's" : "they're";
    await db.insert(thankYous).values({
      fundId: fund.id,
      giftId: eg.giftId,
      senderName: eg.senderName,
      senderEmail: eg.senderEmail || null,
      message: THANK_VARIANTS[
        Math.abs(eg.senderName.split("").reduce((s, c) => s + c.charCodeAt(0), 0)) % THANK_VARIANTS.length
      ](first, amt, kid.firstName, willRead, kid.majorityAge),
      status: "sent",
      sentAt: new Date(eg.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000),
    } as any);
  }

  // Pin the precious entries so the Memory Book's "Pinned" lens reads worn,
  // not guaranteed-empty. A real parent pins a few favorites over the years;
  // an 80k/266-gift book with zero pins is a tell. Two tasteful pins per kid:
  // the very FIRST external gift (the "it all started here" entry) and any
  // voice-note gift (Gloria's audio — the marquee Memory Book artifact).
  // isFeatured lives in the file-based meta store (.local/memory-entry-meta.json,
  // see routes.ts patchMemoryMeta), NOT the DB — collected here, written once
  // at the end of the run by writeDemoMemoryEntryMeta.
  const oldestExternal = [...externalGifts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  if (oldestExternal?.memoryEntryId) PINNED_MEMORY_ENTRY_IDS.push(oldestExternal.memoryEntryId);
  // ONE voice note, not all of them — Gloria's audio birthday gift is ANNUAL,
  // so pinning every audio entry pinned a-gift-per-year (~50/book on the
  // first live run; caught by verify-demo-state) and made the Pinned lens
  // meaningless. A parent pins the precious few; the most RECENT voice note
  // is the one they'd keep at the top.
  const newestAudio = [...externalGifts]
    .filter((eg) => eg.hasAudio && eg.memoryEntryId && eg.memoryEntryId !== oldestExternal?.memoryEntryId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (newestAudio?.memoryEntryId) PINNED_MEMORY_ENTRY_IDS.push(newestAudio.memoryEntryId);

  // Gifter milestone-update opt-ins for the "who's following along" surface
  // (file-based store; see seedGifterNotifications above).
  await seedGifterNotifications(fund.id, externalGifts);

  // Phil's (Dad, the co-parent) sealed "for when this becomes yours" letter —
  // both parents engage: Claire (Mom) owns + leaves a note, Phil leaves the deep
  // at-18 letter (Dad's voice). Seeded for the two
  // older kids: Alex (approaching majority, so it shows SEALED in the handoff
  // demo) and Haley (past majority, so it shows UNLOCKED in her adult-account
  // view). Luke is too young to need one yet.
  if (kid.firstName === "Haley" || kid.firstName === "Alex") {
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      content: sealedLetterFor(kid),
      type: "parent_letter",
      authorRole: "parent",
      authorName: "Phil Dunphy",
      visibility: "kid_at_18",
    } as any);
    // (Balance-crossing milestones are now seeded data-driven from the
    // actual snapshot curve for EVERY kid — see seedMilestonesFromSnapshots
    // after the history generation below — rather than hardcoded here.)
  }

  // Claire (Mom) authored note. Claire OWNS the fund (primary custodian); Phil
  // (Dad) is the accepted co-parent collaborator (wired in main()) — so the demo
  // shows BOTH parents engaging. A parent_note authored by Claire (Mom) puts a
  // "from Mom" entry in the timeline next to Phil's sealed letter, making both
  // parents lived-in (active authors, not just names on the access list).
  // Dated ~4 months back so it sits naturally in the recent timeline.
  {
    // Haley's note reads as a handoff-moment note ("this is yours now baby
    // girl... i saved everything") — date it near the transfer (~1y ago),
    // not 4 months ago, or the timeline says she wrote "now" 8 months late.
    const claireNoteDate = new Date();
    claireNoteDate.setDate(claireNoteDate.getDate() - (kid.ageYears >= kid.majorityAge ? 355 : 120));
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      type: "parent_note",
      content: momNoteFor(kid),
      authorRole: "parent",
      authorName: "Claire Dunphy",
      visibility: "kid_now",
      createdAt: claireNoteDate,
    } as any);
  }

  // Seed a creation activity. Dated to match the fund's backdated
  // createdAt so the Activity timeline's "Fund created" anchor sits at
  // the start of the saga (before the gifts), not at today's date on a
  // fund that's been growing for years.
  await db.insert(activities).values({
    userId: parentUserId,
    fundId: fund.id,
    type: "fund_created",
    title: `${kid.firstName}'s fund created`,
    description: kid.description,
    createdAt: fundCreatedAt,
  } as any);

  // Account-setup + recurring-lifecycle activities so the demo feed shows the
  // real lead-in a parent sees (bank linked, identity verified, recurring set
  // up) — not just gifts. The product logs these in prod; the demo must seed
  // them too or the feed under-represents a real account. One-time + dated at
  // setup so they sit quietly at the fund's origin, never flooding the feed.
  // Seed gap closed 2026-06-07.
  const setupAt = new Date(fundCreatedAt.getTime() + 12 * 60 * 60 * 1000);
  await db.insert(activities).values({
    userId: parentUserId, fundId: fund.id, type: "bank_linked", title: "Bank linked",
    description: "Linked a bank account to fund this account.", createdAt: setupAt,
  } as any);
  await db.insert(activities).values({
    userId: parentUserId, fundId: fund.id, type: "kyc_approved", title: "Identity verified",
    description: "Identity verification approved.", createdAt: setupAt,
  } as any);
  if (kid.recurring?.amount) {
    await db.insert(activities).values({
      userId: parentUserId, fundId: fund.id, type: "auto_invest", title: "Recurring investment",
      description: `Set up automatic monthly investing of $${kid.recurring.amount}.`, createdAt: setupAt,
    } as any);
    if (kid.recurring.status === "paused") {
      await db.insert(activities).values({
        userId: parentUserId, fundId: fund.id, type: "recurring_paused", title: "Recurring paused",
        description: "Monthly investing paused as the fund nears the age-18 handoff.",
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      } as any);
    }
  }

  // ── Lived-in lifecycle: PARENT-CHOSEN de-risking + real occasions ──
  // SELF-DIRECTED POSTURE (2026-06-03, founder catch): the product does NOT
  // auto-shift allocations — the old auto glide-path + age-band nudges were
  // removed in the self-directed pivot (ACCOUNT_MODEL.md §2b) to avoid the
  // adviser posture. So the seeded history must read as PHIL'S OWN choices,
  // never "automatically moved" (a demo narrating discretionary rebalancing
  // would misrepresent the product to prospects, press, and counsel). The
  // share moves were executed by buildPortfolio (rebalancesForKid) at the
  // same dates against real prices — so the story and the numbers agree;
  // rebalancesForKid is just the demo's stand-in for "Phil chose this at
  // these ages." kid.strategy is the CURRENT/latest mix.
  const bday = new Date(kid.birthdate);
  const atAge = (years: number) => { const d = new Date(bday); d.setFullYear(d.getFullYear() + years); return d; };
  // Mirror the canonical labels in lib/strategy.ts — "Steady & Balanced" is the
  // retired name; everywhere else (Dashboard, holdings) renders "Balanced Mix".
  const STRATEGY_LABEL: Record<string, string> = { growth: "Growth Mix", balanced: "Balanced Mix", conservative: "Conservative Mix" };
  const STRATEGY_ORDER: Record<string, number> = { growth: 0, balanced: 1, conservative: 2 };
  const currentOrder = STRATEGY_ORDER[kid.strategy] ?? 0;
  for (const s of [{ at: 13, from: "growth", to: "balanced" }, { at: 16, from: "balanced", to: "conservative" }]) {
    // Emit a shift only if the kid has reached that age AND their current
    // strategy is at-or-past the shift's target (so the history leads to the
    // present mix, not past it). Matches rebalancesForKid's conditions/dates.
    if (kid.ageYears >= s.at && currentOrder >= STRATEGY_ORDER[s.to]) {
      await db.insert(activities).values({
        userId: parentUserId,
        fundId: fund.id,
        type: "fund_strategy_changed",
        // Viewer-neutral phrasing + explicit attribution: Phil's view and
        // Haley's post-handoff view share these rows, so no bare "you".
        title: `Mix changed to ${STRATEGY_LABEL[s.to]}`,
        description: `${STRATEGY_LABEL[s.from]} → ${STRATEGY_LABEL[s.to]} · ${parentDisplayName}'s choice as ${kid.firstName} turned ${s.at}`,
        createdAt: atAge(s.at),
        metadata: JSON.stringify({ from: s.from, to: s.to, reason: "parent_choice", automatic: false, contributorName: parentDisplayName }),
      } as any);
    }
  }

  // Real, active occasions beyond the implicit "gift anytime" grouping: an
  // upcoming birthday, a long-horizon college-fund goal, and (for kids not
  // yet past it) graduation. Forward-looking — historical gifts stay under
  // "gift anytime"; these are the occasions the family is gifting toward now.
  const occToday = new Date();
  const nextBirthday = (() => {
    const d = new Date(Date.UTC(occToday.getUTCFullYear(), bday.getUTCMonth(), bday.getUTCDate(), 12));
    if (d.getTime() < occToday.getTime()) d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  })();
  const nextBirthdayAge = nextBirthday.getUTCFullYear() - bday.getUTCFullYear();
  // Fund-level dollar GOALS are retired (they don't compose on a fungible pot
  // and imply an earmark a UTMA can't keep — 529 turf we don't compete on). The
  // old "College Fund" / "{name}'s Fund" general event existed ONLY to carry a
  // dashboard goal: it was giftVolume 0, never a gift bucket ("pure dashboard
  // GOAL"), so it's removed. The catch-all "Gift anytime" permanent event stays
  // the main page; real per-occasion gift tracking (how much + who gave) lives
  // on actual OCCASIONS like Birthday, which is exactly what a parent wants.
  const occasions: Array<{ name: string; slug: string; eventType: string; eventDate: Date | null; goalAmount: number | null }> = [
    // Generic "Birthday" (not "14th Birthday") so the Memory Book can group ALL
    // years of birthday gifts under it without the ordinal reading wrong on an
    // old gift. The dashboard still uses eventDate for the next-birthday countdown.
    { name: `${kid.firstName}'s Birthday`, slug: `${kid.slug}-bday-${nextBirthday.getUTCFullYear()}`, eventType: "birthday", eventDate: nextBirthday, goalAmount: null },
  ];
  // NOTE: a forward-looking "Graduation" occasion was seeded here, but it landed
  // with ZERO gifts (no historical gift carried occasion:"graduation"), so it
  // rendered as a stark-empty tile next to the populated Birthday — and its
  // goal-era "Toward cap & gown" empty-state read as an earmark we no longer do.
  // Dropped: the demo now shows ONE strong, fully-populated occasion (Birthday)
  // plus the "Gift anytime" catch-all, which also keeps the Dashboard and the
  // Memory Book occasion strips consistent (both only show gift-bearing groups).
  // Attribute the annual BIRTHDAY gifts (Gloria/Cam/Mitchell) to the Birthday
  // occasion so the Memory Book's occasions strip shows a real, NATURAL group
  // ("{kid}'s Birthday · N gifts · $X raised") next to the catch-all "Gift
  // anytime". Birthday is a true gifting occasion with NO dollar goal on the
  // dashboard, so its gift total can't clash with a goal-progress number — the
  // mistake the earlier College-Fund attribution made ($600 of tagged gifts vs
  // the dashboard's $22k whole-fund goal progress, same name, two numbers).
  // College Fund / Graduation stay pure dashboard GOALS, not gift buckets. The
  // events table stores giftCount/giftVolume as counters (not a JOIN), so we set
  // them on the event row AND stamp eventId on the gifts.
  const birthdayGifts = externalGifts.filter((g) => g.occasion === "birthday");
  const birthdayGiftVolume = birthdayGifts.reduce((s, g) => s + g.amount, 0);
  for (const o of occasions) {
    const isBirthdayOccasion = o.eventType === "birthday";
    const [insertedEvent] = await db.insert(events).values({
      fundId: fund.id,
      userId: parentUserId,
      name: o.name,
      slug: o.slug,
      eventType: o.eventType,
      eventDate: o.eventDate,
      goalAmount: o.goalAmount != null ? o.goalAmount.toFixed(2) : null,
      status: "active",
      giftCount: isBirthdayOccasion ? birthdayGifts.length : 0,
      giftVolume: isBirthdayOccasion ? birthdayGiftVolume.toFixed(2) : "0.00",
    } as any).returning();
    // Paired activity for the occasion (seeded as a domain row but never an
    // activity, so the feed never showed "Occasion"). 2026-06-07.
    await db.insert(activities).values({
      userId: parentUserId, fundId: fund.id, type: "event_created", title: "Occasion",
      description: `Set up ${o.name}.`,
      createdAt: new Date(fundCreatedAt.getTime() + 36 * 60 * 60 * 1000),
    } as any);
    if (isBirthdayOccasion && birthdayGifts.length > 0) {
      await db.update(gifts)
        .set({ eventId: insertedEvent.id })
        .where(inArray(gifts.id, birthdayGifts.map((g) => g.giftId)));
    }
  }

  // Generate the historical balance curve from the REAL portfolio value
  // month-by-month (replays buys + glide-path rebalances against actual
  // historical prices). The drawdowns (2008, 2020, 2022, ...) are the fund's
  // genuine market value over time, not a synthetic shape — today's edge equals
  // the real hero balance.
  //
  // (Demo funds need fund_snapshots or the dashboard chart renders a flat line
  // from $0 — the kid-at-18 narrative depends on the multi-year story.)
  await generateHistoricalSnapshots(fund.id, portfolio.events, investedValue, costBasis);

  // Balance-crossing milestones, data-driven from the curve just generated.
  await seedMilestonesFromSnapshots(fund.id, kid.firstName);

  // "Growth passed the gifts" — the earned-truth milestone the REAL engine
  // fires at gift-settle (milestone_growth_passed_gifts, 2026-06-04). Demo
  // funds never run the webhook, so a worn fund that genuinely earned this
  // (value >= 2x contributed) would be missing its most meaningful page.
  // Data-driven from the same snapshot curve: the crossing date is the first
  // month where the real value reached double the money put in by then.
  await seedGrowthPassedMilestoneFromSnapshots(
    fund.id,
    parentUserId,
    kid.firstName,
    giftList.map((g) => ({ amount: g.amount, createdAt: new Date(g.createdAt) })),
  );

  // Pre-set Kid View so the parent surface shows a configured "{Kid}'s View ·
  // Active · PIN protected" instead of "Not set up yet". Skip graduated kids:
  // their fund is handed off (owner mode), so there's no parent-set PIN.
  if (kid.ageYears < kid.majorityAge) {
    await seedKidView(fund.id);
  }

  return fund.id;
}

// Demo Kid View PIN. Self-revealing hint on purpose so a prospect exploring the
// demo can actually open the kid-view link. Kid View settings live in a LOCAL
// JSON store (.local/kid-view.json), keyed by fundId — the same store the routes
// read/write (server/routes.ts). We merge (read-modify-write) so any non-demo
// records survive. Hashed with bcryptjs; the server verifies with bcrypt and the
// two produce interchangeable bcrypt hashes (the demo passwords already rely on
// this). NOTE: this store is local/ephemeral per instance — same caveat as the
// other .local file stores; fine for the demo.
const DEMO_KID_VIEW_PIN = "1234";
async function seedKidView(fundId: string): Promise<void> {
  const kidViewPath = path.join(process.cwd(), ".local", "kid-view.json");
  let store: { byFundId: Record<string, any>; accessTokens: Record<string, any> } = { byFundId: {}, accessTokens: {} };
  try {
    const parsed = JSON.parse(await fsp.readFile(kidViewPath, "utf8"));
    store = {
      byFundId: parsed?.byFundId && typeof parsed.byFundId === "object" ? parsed.byFundId : {},
      accessTokens: parsed?.accessTokens && typeof parsed.accessTokens === "object" ? parsed.accessTokens : {},
    };
  } catch {
    // No store file yet — start fresh.
  }
  store.byFundId[fundId] = {
    fundId,
    enabled: true,
    shareToken: randomUUID(),
    pinHash: await bcrypt.hash(DEMO_KID_VIEW_PIN, 10),
    pinHint: `Demo PIN: ${DEMO_KID_VIEW_PIN}`,
    allowTeenSuggestions: true,
    suggestions: [],
    updatedAt: new Date().toISOString(),
  };
  await fsp.mkdir(path.dirname(kidViewPath), { recursive: true });
  await fsp.writeFile(kidViewPath, JSON.stringify(store, null, 2), "utf8");
}

// Stamp a "milestone" memory entry at the first date the fund's balance
// crossed each $5K threshold — read straight off the generated snapshot curve
// so the dates are accurate to the real shape, not hardcoded. MemoryBook
// renders these as celebration beats; every kid gets the full "watch it grow"
// ladder up to their current balance.
async function seedMilestonesFromSnapshots(fundId: string, childFirst: string): Promise<void> {
  const snaps = await db
    .select()
    .from(fundSnapshots)
    .where(eq(fundSnapshots.fundId, fundId))
    .orderBy(asc(fundSnapshots.snapshotDate));
  if (snaps.length === 0) return;
  const finalVal = parseFloat(String(snaps[snaps.length - 1].totalValue || "0"));
  for (const threshold of [5000, 10000, 15000, 20000, 25000]) {
    if (finalVal < threshold) break;
    const crossing = snaps.find((s) => parseFloat(String(s.totalValue || "0")) >= threshold);
    if (!crossing) continue;
    await db.insert(memoryEntries).values({
      fundId,
      // Just the fact, nothing else. Matches the clean shared MONEY_CROSS_COPY
      // register (no cost-anchor, no "head start" vibes) and the real milestone
      // engine, which writes a SYSTEM-authored row (authorName null → renders as
      // Kiddo, not the parent — a balance crossing isn't a note someone wrote).
      // Keeps milestones simple, not cheesy/AI.
      content: `${childFirst}'s fund crossed $${threshold.toLocaleString("en-US")}.`,
      type: "milestone",
      authorName: null,
      visibility: "kid_now",
      createdAt: new Date(crossing.snapshotDate as any),
    } as any);
  }
}

// "Growth passed the gifts" milestone, data-driven from the snapshot curve.
// Mirrors server/milestones.ts fireGrowthPassedGiftsMilestone exactly (same
// activity type, copy, metadata key, $250 floor, value >= 2x contributed)
// so the demo's worn history matches what the real engine would have
// written. The crossing date = the first snapshot month where the fund's
// REAL value reached double the cumulative gifts received by that date.
async function seedGrowthPassedMilestoneFromSnapshots(
  fundId: string,
  userId: string,
  childFirst: string,
  giftTimeline: Array<{ amount: number; createdAt: Date }>,
): Promise<void> {
  const snaps = await db
    .select()
    .from(fundSnapshots)
    .where(eq(fundSnapshots.fundId, fundId))
    .orderBy(asc(fundSnapshots.snapshotDate));
  if (snaps.length === 0 || giftTimeline.length === 0) return;
  const sortedGifts = [...giftTimeline].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let gi = 0;
  let contributed = 0;
  let crossing: { date: Date } | null = null;
  for (const s of snaps) {
    const snapDate = new Date(s.snapshotDate as any);
    while (gi < sortedGifts.length && sortedGifts[gi].createdAt.getTime() <= snapDate.getTime()) {
      contributed += sortedGifts[gi].amount;
      gi += 1;
    }
    const value = parseFloat(String(s.totalValue || "0"));
    if (contributed >= GROWTH_PASSED_GIFTS.contributedFloor && value >= contributed * GROWTH_PASSED_GIFTS.multiple) {
      crossing = { date: snapDate };
      break;
    }
  }
  if (!crossing) return;
  // Constants + copy imported from the engine (server/milestones.ts
  // GROWTH_PASSED_GIFTS) so the seeded rows are byte-identical to what the
  // real engine writes — duplicated literals drifting apart was the failure
  // mode (code-review 2026-06-04).
  const title = GROWTH_PASSED_GIFTS.title;
  const description = GROWTH_PASSED_GIFTS.description(childFirst);
  await db.insert(activities).values({
    userId,
    fundId,
    type: GROWTH_PASSED_GIFTS.activityType,
    title,
    description,
    metadata: JSON.stringify({ milestone: "growth_passed_gifts", contributed: Math.round(contributed), key: GROWTH_PASSED_GIFTS.dedupeKey }),
    createdAt: crossing.date,
  } as any);
  await db.insert(memoryEntries).values({
    fundId,
    content: title,
    type: "milestone",
    authorName: null,
    visibility: "kid_now",
    createdAt: crossing.date,
  } as any);
}

// Generate fund_snapshots from the REAL portfolio value month-by-month: replays
// the gift buys + glide-path rebalances against actual historical prices, so
// the curve's drawdowns (2008, 2020, 2022, ...) are the fund's genuine market
// value over time. Today is hard-anchored to the real hero balance.
async function generateHistoricalSnapshots(
  fundId: string,
  events: BuildResult["events"],
  finalInvestedValue: number,
  finalCostBasis: number,
): Promise<void> {
  if (events.length === 0) return;
  // events are already chronological (buildPortfolio sorts them). The earliest
  // event sets the curve's start month.
  const startDate = new Date(events[0].date);
  startDate.setDate(1); // snap to month start
  const today = new Date();
  // STOP the monthly loop at the END of the previous complete month. Walking
  // into the current month stamps a future-dated end-of-month snapshot that
  // pollutes the "last 30 days" aggregate (a $48k double-count). Locked
  // 2026-05-21 with the aggregate-double-count fix.
  const monthlyEnd = new Date(today.getFullYear(), today.getMonth(), 0); // last day of PREVIOUS month
  monthlyEnd.setDate(1); // snap back to month-start for the loop check below

  // One snapshot at any date: the REAL portfolio market value for that date —
  // valued at the actual DAILY close when the date is within the daily window
  // (last ~400 days, so the 1W/1M/1Y chart tabs move day-to-day), otherwise the
  // month's close. Deep-history points are one-per-month (distinct), recent
  // points are real dailies, so nothing is dead-flat and nothing is synthetic.
  const snapshotAt = (d: Date): { date: Date; total: number; basis: number } => {
    const { invested, basis } = portfolioValueAtDate(PRICES, events, d);
    return { date: new Date(d), total: invested, basis };
  };

  // Variable resolution so each chart toggle has enough points: monthly
  // month-ends for ALL/5Y, weekly within the last year for YTD/1Y, daily within
  // the last 30 days for 1M/1W (monthly-only would leave 1W/1M as 1-2 flat
  // points). Every tier comes from the SAME snapshotAt model, so they join
  // seamlessly. Today is hard-anchored to the seeded balance so the chart's
  // right edge equals the hero number with zero drift.
  const allSnapshots: Array<{ date: Date; total: number; basis: number }> = [];

  // Monthly month-end anchors (noon UTC so a timezone shift can't move the day).
  {
    const cursor = new Date(startDate);
    while (cursor.getTime() <= monthlyEnd.getTime()) {
      allSnapshots.push(snapshotAt(new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12, 0, 0))));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  {
    const now = new Date();
    const oneYearAgo = new Date(now); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Weekly: 1 year ago up to 30 days ago (the daily loop covers the rest).
    const weeklyCursor = new Date(oneYearAgo);
    while (weeklyCursor.getTime() < thirtyDaysAgo.getTime()) {
      if (weeklyCursor.getTime() >= startDate.getTime()) allSnapshots.push(snapshotAt(weeklyCursor));
      weeklyCursor.setDate(weeklyCursor.getDate() + 7);
    }

    // Daily: 30 days ago through today; today hard-anchored to the hero balance.
    const dailyCursor = new Date(thirtyDaysAgo);
    while (dailyCursor.getTime() <= now.getTime()) {
      const isToday =
        dailyCursor.getFullYear() === now.getFullYear() &&
        dailyCursor.getMonth() === now.getMonth() &&
        dailyCursor.getDate() === now.getDate();
      if (isToday) {
        allSnapshots.push({ date: new Date(now), total: finalInvestedValue, basis: finalCostBasis });
      } else if (dailyCursor.getTime() >= startDate.getTime()) {
        allSnapshots.push(snapshotAt(dailyCursor));
      }
      dailyCursor.setDate(dailyCursor.getDate() + 1);
    }
  }

  // Dedupe by UTC calendar day — NOT by millisecond. The aggregate
  // sparkline query uses `DATE_TRUNC('day', snapshot_date)` and
  // SUMs across funds; if any fund has two snapshots on the same
  // calendar day at different ms timestamps, that fund's value
  // gets counted twice and the aggregate spikes to 2x. Previously
  // a ms-keyed dedupe missed this because the monthly loop's
  // "month-end" snapshot and the daily loop's same-day snapshot
  // had different ms values. Now the key is YYYY-MM-DD in UTC,
  // matching the SQL group. When days collide, the LATER push
  // wins (daily overrides weekly overrides monthly, today's
  // hard-anchor overrides daily wobble).
  // Locked 2026-05-21 after the aggregate sparkline showed
  // $48k/$49k spikes on the May 1 + May 21 overlap days.
  const dedupedByDay = new Map<string, { date: Date; total: number; basis: number }>();
  for (const snap of allSnapshots) {
    const dayKey = snap.date.toISOString().slice(0, 10); // UTC YYYY-MM-DD
    dedupedByDay.set(dayKey, snap);
  }
  const sorted = Array.from(dedupedByDay.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Bulk insert.
  for (const point of sorted) {
    await db.insert(fundSnapshots).values({
      fundId,
      snapshotDate: point.date,
      investedValue: point.total.toFixed(2),
      cashValue: "0.00",
      totalValue: point.total.toFixed(2),
      principalBasis: point.basis.toFixed(2),
    } as any);
  }
}

async function ensurePhilFamilySubscription(philId: string): Promise<void> {
  // The demo needs Phil on Family plan so the Family-tier features
  // (unlimited kids, multi-fund household view, etc.) render properly.
  // Real users get this via Stripe webhook; for the demo we write the
  // subscription row directly. Idempotent: upsert by userId.
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, philId)).limit(1);
  const now = new Date();
  const oneYearOut = new Date(now);
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  if (existing) {
    await db.update(subscriptions).set({
      plan: "family",
      status: "active",
      billingInterval: "year",
      currentPeriodStart: now,
      currentPeriodEnd: oneYearOut,
      canceledAt: null,
    }).where(eq(subscriptions.id, existing.id));
    return;
  }
  await db.insert(subscriptions).values({
    userId: philId,
    plan: "family",
    status: "active",
    billingInterval: "year",
    currentPeriodStart: now,
    currentPeriodEnd: oneYearOut,
    // Stripe IDs deliberately null — demo doesn't have real Stripe records.
    stripeSubscriptionId: null,
    stripeCustomerId: null,
  } as any);
}

// Exported so the reset-dunphys script (and any future driver) can invoke
// the seed without spawning a subprocess. closePool=true matches the
// standalone-script default; reset-dunphys passes false because it manages
// the pool lifecycle itself across wipe + reseed.
export async function runDunphySeed(options: { closePool?: boolean } = {}): Promise<void> {
  const closePool = options.closePool !== false;
  console.log("Seeding Dunphy family demo accounts...");

  // 1. Upsert all seven user accounts.
  const userIdByEmail = new Map<string, string>();
  for (const account of ACCOUNTS) {
    const id = await upsertUser(account);
    userIdByEmail.set(account.email, id);
    console.log(`  user: ${account.email} (${account.firstName} ${account.lastName}) → ${id}`);
  }

  const coParentId = userIdByEmail.get("phil@dunphyfamily.com")!;   // Phil (Dad) — co-parent
  const ownerId = userIdByEmail.get("claire@dunphyfamily.com")!;    // Claire (Mom) — primary custodian / lead persona

  // 1b. Seed the primary custodian's (Claire's) Family-plan subscription (idempotent).
  await ensurePhilFamilySubscription(ownerId);
  console.log(`  subscription: claire@dunphyfamily.com → Family · active`);

  // 1c. GUARDRAIL: detect STALE demo funds owned by the co-parent (Phil). The
  //     plain seed is idempotent BY OWNER, so after an ownership change (e.g. the
  //     2026-06-11 mom flip: Phil→Claire) it can't see the OLD owner's funds and
  //     would silently layer Claire's new funds on top — leaving the dashboard
  //     showing DUPLICATES (each kid once as owner, once as the stale co-parent
  //     collaborator row). The co-parent never OWNS a fund, so any -dunphy fund
  //     owned by them is stale. Refuse and point to the clean path. (Haley's
  //     graduated fund is owned by Haley, not the co-parent, so it never trips this.)
  const staleCoParentFunds = await db
    .select({ id: funds.id })
    .from(funds)
    .where(and(eq(funds.userId, coParentId), like(funds.slug, "%-dunphy%")));
  if (staleCoParentFunds.length > 0) {
    console.log(`\n⚠️  ${staleCoParentFunds.length} stale Dunphy fund(s) are still owned by the co-parent (likely a previous seed before the owner changed).`);
    console.log("A plain seed would layer new funds on top → the demo would show DUPLICATES.");
    console.log("Run `npm run reset:dunphys` instead — it wipes ALL Dunphy data + reseeds clean.");
    if (closePool) await pool.end();
    return;
  }

  // 2. Check if Claire (the primary custodian) already has funds. If yes,
  //    assume the seed has already run before and exit early (idempotent).
  const existingFunds = await db.select().from(funds).where(eq(funds.userId, ownerId));
  if (existingFunds.length > 0) {
    console.log(`\nClaire already has ${existingFunds.length} fund(s). Skipping fund seed to stay idempotent.`);
    console.log("To re-seed funds from scratch: run `npm run reset:dunphys` instead.");
    if (closePool) await pool.end();
    return;
  }

  // 3. Seed all three Dunphy kid funds.
  // Custodian's preferred display name ("Mom") — stamped onto each recurring
  // contribution's activity so the post-handoff owner view can credit "Mom
  // added $X" instead of the custodial-era "You contributed".
  const ownerDisplayName = ACCOUNTS.find((a) => a.role === "parent")?.preferredName || "Mom";
  const seededFundIds: string[] = [];
  for (const kid of KIDS) {
    const fundId = await seedKidFund(ownerId, kid, ownerDisplayName);
    seededFundIds.push(fundId);
    console.log(`  fund: ${kid.firstName}'s Fund (${kid.slug}) → ${fundId}`);
  }

  // 3a. Mark the per-kid precious entries as Pinned (file-based meta store).
  await writeDemoMemoryEntryMeta();
  console.log(`  pinned: ${PINNED_MEMORY_ENTRY_IDS.length} Memory Book entries (restart the dev server to pick up .local meta)`);

  // 3b. Hand Haley's fund off to Haley — the graduated adult-account demo.
  //
  // The demo IS the real app, so there is no mock "adult view": we seed the
  // ACTUAL post-handoff state. The real claim/transfer flow flips fund.userId,
  // stamps transferredAt + previousOwnerId, and the Age18Welcome walkthrough
  // sets kidWelcomeCompletedAt; we replicate exactly that. Result: logging in
  // as Haley renders the real adult/individual experience, and Phil sees the
  // real previous-owner "your part of the story" view of her fund.
  const haleyFundId = seededFundIds[0]; // KIDS[0] is Haley (age 21, past CA majority)
  const haleyUserId = userIdByEmail.get("haley@dunphyfamily.com");
  if (haleyUserId && haleyFundId) {
    // Haley graduated ~1 year ago ("22, a year past majority"), so stamp the
    // handoff a year back — not at seed-time — and freeze valueAtTransfer to
    // roughly her value THEN (~91% of today's). This makes Phil's previous-owner
    // KEEPSAKE honest AND demonstrable: "handed off at $X a year ago", distinct
    // from her live balance now. A same-day handoff would make keepsake == live
    // and the freeze invisible.
    const [haleyBalRow] = await db.select({ balance: funds.balance }).from(funds).where(eq(funds.id, haleyFundId));
    const haleyBalNum = parseFloat(haleyBalRow?.balance || "0");
    const haleyHandoffValue = haleyBalNum > 0 ? (haleyBalNum * 0.91).toFixed(2) : null;
    const transferredAt = new Date();
    transferredAt.setFullYear(transferredAt.getFullYear() - 1);
    await db.update(funds).set({
      userId: haleyUserId,
      previousOwnerId: ownerId,
      // Frozen handoff keepsake value for the previous-owner view (see column).
      valueAtTransfer: haleyHandoffValue,
      // Mirror the real /complete handoff (routes.ts ~7503): a UTMA terminates
      // at majority and becomes the owner's own individual account. Without
      // these the demo fund stayed accountType "utma" + recipientRelation null,
      // which (a) showed "UTMA" on the tax / fund-details surfaces and (b) made
      // postHandoffEngagementWorker (gated on LOWER(accountType)='personal')
      // SKIP Haley — so the graduated owner never got the post-handoff
      // engagement loop. Set them here so the seed matches a real handoff.
      accountType: "Personal",
      recipientRelation: "self",
      transferredAt,
      kidWelcomeCompletedAt: transferredAt,
    }).where(eq(funds.id, haleyFundId));
    await db.insert(ageTransitions).values({
      fundId: haleyFundId,
      childClaimedByUserId: haleyUserId,
      childClaimedAt: transferredAt,
      ownershipTransferredAt: transferredAt,
      ownershipTransferredByUserId: haleyUserId,
      formerCustodianUserId: ownerId,
      invitedAt: transferredAt,
      inviteViewedAt: transferredAt,
      childEmailVerifiedAt: transferredAt,
      updatedAt: transferredAt,
    } as any).onConflictDoNothing();
    // The real handoff flow (routes.ts ~7586) emits an "age18_handoff_completed_child"
    // activity so the transfer lands as the most recent milestone in the owner's feed
    // ("Fund handed off" / Sprout). The direct seed-transfer skips routes.ts, so emit it
    // here too — otherwise Haley's Activity is missing the single most important event in
    // her timeline: the day it became hers. createdAt = transferredAt keeps it at the top.
    // Mirror the parent-side row too, so Claire's previous-owner view shows the handoff.
    await db.insert(activities).values({
      userId: haleyUserId,
      fundId: haleyFundId,
      type: "age18_handoff_completed_child",
      title: "Your fund is now yours",
      description: "Kiddo ownership transfer complete. Your fund now lives in your own account.",
      createdAt: transferredAt,
    } as any);
    await db.insert(activities).values({
      userId: ownerId,
      fundId: haleyFundId,
      type: "age18_handoff_completed_parent",
      title: "Age-18 handoff completed",
      description: "Haley now owns this fund in Kiddo.",
      createdAt: transferredAt,
    } as any);
    console.log(`  handoff: Haley's fund → haley@dunphyfamily.com (graduated adult account; Phil is previous owner)`);
  }

  // 3c. Seed a connected bank for the recurring-setup demo. Recurring pulls
  //     from a linked bank for EVERYONE (parent + owner + co-parent), and the
  //     setup modal disables "Continue" with no bank. Without this, "Set up
  //     recurring" / "+ Add another" dead-ends at the bank step in the demo —
  //     for Claire (primary custodian), Haley (graduated owner), AND Phil
  //     (co-parent, who has write access on Alex+Luke and can set up recurring
  //     too). Demo money is mocked, so this is an illustrative connected
  //     account, not real ACH.
  for (const [label, uid] of [["claire", ownerId], ["haley", haleyUserId], ["phil", coParentId]] as const) {
    if (!uid) continue;
    const existingBank = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, uid)).limit(1);
    if (existingBank.length > 0) continue;
    await db.insert(bankAccounts).values({
      userId: uid,
      bankName: "Dunphy Checking",
      accountLast4: "4291",
      provider: "manual",
      connectionStatus: "active",
      status: "active",
      isDefault: true,
    } as any);
    console.log(`  bank: ${label} → Dunphy Checking ····4291 (demo, for recurring setup)`);
  }

  // 4. Wire Phil as co-parent on the pre-handoff funds (Alex + Luke).
  //    Haley's fund transferred to her at majority, so co-parent access there
  //    ended with the handoff — a graduated adult owns it solo. Without this,
  //    logging in as Phil via /demo shows an empty fund list and
  //    Dashboard redirects to /get-started — defeating the
  //    "co-parent view of the same three funds" spec promise.
  //    status='accepted' is the canonical value the auth middleware
  //    (requireOwnedFundParam) and the new /api/funds collaborator
  //    merge both look for. acceptedAt populated so the row passes
  //    any timestamp-based filters.
  if (seededFundIds.length > 0) {
    // The co-parent "just accepted" CELEBRATION banner is gated to acceptances
    // within ~30 days. With acceptedAt = now on every pre-handoff fund, it fired
    // on BOTH Luke and Alex — the same one-time beat shown twice as you switch
    // funds. Make exactly ONE acceptance recent (the banner fires once, teaching
    // the feature) and date the rest back: Phil still co-parents every fund
    // (access is the collaborator row, not the timestamp), the banner just
    // doesn't re-fire there. 2026-06-07.
    let recentAssigned = false;
    const OLD_ACCEPT = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    for (const fundId of seededFundIds) {
      if (fundId === haleyFundId) continue; // transferred to Haley at majority; co-parent access ended
      const isRecent = !recentAssigned;
      recentAssigned = true;
      const acceptedAt = isRecent ? new Date() : OLD_ACCEPT;
      await db.insert(fundCollaborators).values({
        fundId,
        userId: coParentId,
        email: "phil@dunphyfamily.com",
        // "co-admin" is the canonical editor role across the app (auth
        // middleware, /api/funds access merge, plan-benefits-usage all check
        // it). The display label for co-admin is literally "Co-parent (can
        // edit)". The old "co-parent" value matched NO code path, so the co-parent
        // was silently downgraded to a read-only viewer AND uncounted as a co-parent.
        role: "co-admin",
        status: "accepted",
        acceptedAt,
        invitedAt: acceptedAt,
      } as any);
      // Seed the matching ACTIVITY rows so Phil's invite + acceptance show in
      // the fund's Activity feed. The product logs these as of 2026-06-07; the
      // demo must seed them too or the feed under-represents a real account.
      const [fundRow] = await db.select({ name: funds.recipientFirstName }).from(funds).where(eq(funds.id, fundId)).limit(1);
      const childPoss = fundRow?.name?.trim() ? `${fundRow.name.trim()}'s` : "the";
      const invitedAt = new Date(acceptedAt.getTime() - 2 * 24 * 60 * 60 * 1000);
      await db.insert(activities).values({
        userId: ownerId, fundId, type: "collaborator_invited", title: "Co-parent invited",
        description: `Invited phil@dunphyfamily.com to help manage ${childPoss} fund.`,
        createdAt: invitedAt,
      } as any);
      await db.insert(activities).values({
        userId: ownerId, fundId, type: "collaborator_accepted", title: "Co-parent joined",
        description: `Phil joined as a co-parent on ${childPoss} fund.`,
        createdAt: acceptedAt,
      } as any);
    }
    console.log(`  collaborator: phil@dunphyfamily.com → co-parent on ${seededFundIds.filter((id) => id !== haleyFundId).length} fund(s) (Haley's transferred out)`);
  }

  // 5. Phil's recurring parent_contributions are now seeded PER FUND
  //    inside seedKidFund — each schedule is created with its realized
  //    monthly-cycle history (linked gifts, totalContributed, lastRunDate)
  //    so the recurring detail and the dashboard breakdown read real
  //    paper-trading numbers instead of "$0 · never charged." Config
  //    (amount + active/paused) lives on each KIDS entry's `recurring`.
  //    Haley's is paused (winding down ~30 days from majority); Alex + Luke
  //    active monthly. Moved out of this step 2026-05-27 with the
  //    recurring-realism pass.

  // 6. Seed Mitchell's recurring_gifts (annual birthday AAPL gift).
  //    Mitchell is the locked "recurring uncle" persona per the spec.
  //    The one-time gifts already in the seed cover his history;
  //    these rows cover the SCHEDULE that the gifter dashboard's
  //    "your gifts" list reads from.
  const mitchellId = userIdByEmail.get("mitchell@dunphyfamily.com");
  if (mitchellId) {
    for (let i = 0; i < KIDS.length; i++) {
      const kid = KIDS[i];
      const fundId = seededFundIds[i];
      if (!fundId) continue;
      const nextBirthday = new Date(kid.birthdate);
      nextBirthday.setFullYear(new Date().getFullYear());
      if (nextBirthday < new Date()) {
        nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
      }
      await db.insert(recurringGifts).values({
        fundId,
        senderName: "Mitchell Pritchett",
        senderEmail: "mitchell@dunphyfamily.com",
        amount: "100.00",
        // Canonical cadence value is "yearly" (maps to Stripe interval
        // "year"); "annual" is non-canonical and breaks the gifter-
        // dashboard edit dropdown + the /update endpoint validation.
        frequency: "yearly",
        occasionType: "birthday",
        paymentSetupStatus: "active",
        status: "active",
        nextChargeDate: nextBirthday,
        // Demo-fake subscription id (founder catch 2026-06-04): the Dunphys
        // are on the FAMILY plan, so the product would have offered Mitchell
        // the real auto-charging recurring — a reminder-only row here demoed
        // the free-fund fallback on a paid fund and undersold the marquee
        // feature. The demo_ prefix makes every consumer behave right: the
        // Scheduled tab renders the auto-charge treatment, the gifter
        // dashboard labels "Next charge", the reminder worker skips it
        // (sub-id rows are excluded), and the status-change endpoints skip
        // the Stripe call for demo_ ids.
        stripeSubscriptionId: `demo_sub_mitchell_${kid.slug}`,
      } as any);
      // Mark Mitchell's recurring SETUP in the feed (the yearly fires arrive as
      // gifts; this is the "set up a recurring gift" moment that previously
      // logged nowhere). 2026-06-07.
      await db.insert(activities).values({
        userId: ownerId, fundId, type: "gifter_recurring_started", title: "Gifter set up recurring",
        description: "Mitchell Pritchett set up a yearly recurring gift of $100.",
        createdAt: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
      } as any);
    }
    console.log(`  recurring (Mitchell): annual birthday on ${KIDS.length} fund(s)`);
  }

  console.log("\nDone. Demo accounts ready.");
  console.log("Login: any of the seven emails, password: " + DEMO_PASSWORD);
  console.log("  claire@dunphyfamily.com  — parent dashboard with 3 kids (primary custodian)");
  console.log("  phil@dunphyfamily.com    — co-parent view");
  console.log("  jay@dunphyfamily.com     — gifter dashboard");
  console.log("  gloria@dunphyfamily.com  — gifter (voice-memo persona)");
  console.log("  mitchell@dunphyfamily.com — gifter (recurring persona)");
  console.log("  cameron@dunphyfamily.com — gifter (Disney love-mark)");
  console.log("  manny@dunphyfamily.com   — gifter (young-gifter)");

  if (closePool) await pool.end();
}

// When invoked directly (npm run seed:dunphys), run the standalone path.
// When imported, callers use runDunphySeed() and we don't touch the pool.
// Robust detection across Windows + macOS + Linux paths: compare normalized
// script path against process.argv[1]. require.main isn't available under
// tsx ESM. The fallback below also handles the case where this module is
// invoked via tsx with a forward-slash argv path on Windows.
const isDirectInvocation = (() => {
  try {
    const invoked = process.argv[1] ? process.argv[1].replace(/\\/g, "/").toLowerCase() : "";
    return invoked.endsWith("/seed-dunphys.ts") || invoked.endsWith("/seed-dunphys.js");
  } catch {
    return false;
  }
})();

if (isDirectInvocation) {
  runDunphySeed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
