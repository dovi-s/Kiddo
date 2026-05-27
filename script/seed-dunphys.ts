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
  holdings,
  memoryEntries,
  activities,
  subscriptions,
  fundCollaborators,
  parentContributions,
  recurringGifts,
  fundSnapshots,
  type InsertGift,
  type InsertMemoryEntry,
} from "../shared/schema";
import { eq, and } from "drizzle-orm";

// Real-shape monthly returns for the past ~17 years. NOT exact
// historical S&P 500 month-by-month — that would be a 200-row table
// I'd have to keep in sync. Instead: a deterministic shape that
// produces the right visual story when rendered as a chart:
//   - long-term upward drift around 7% annualized
//   - normal monthly volatility around ±2%
//   - identifiable real-world drawdown windows the user (a parent
//     who lived through them) will recognize:
//       Aug 2011 — US debt downgrade
//       Aug 2015 — China-shock
//       Dec 2018 — Q4 correction
//       Mar 2020 — COVID crash, V-shape recovery
//       Jun 2022 — bear market bottom
//
// Each kid's seeded balance is treated as the END of the curve; the
// path is generated and then linearly scaled so the final snapshot
// equals that balance. The SHAPE is real; the SCALE matches what
// the dashboard's hero number currently shows. This is the
// honest-math discipline applied to a demo: the chart can't
// outright lie (fabricate gains), but the shape can be a stylized
// representation of real market history.
//
// Sequence indexed by month-key (YYYY-MM). Anchors are hand-placed
// drawdowns; everything else falls back to a deterministic
// smooth-drift+noise via the monthKeyToReturn helper below.
const MARKET_DRAWDOWN_ANCHORS: Record<string, number> = {
  "2011-08": -0.062,
  "2011-09": -0.072,
  "2011-10": +0.105,
  "2015-08": -0.061,
  "2016-01": -0.050,
  "2018-10": -0.069,
  "2018-12": -0.091,
  "2019-01": +0.080,
  "2020-02": -0.085,
  "2020-03": -0.128,
  "2020-04": +0.127,
  "2022-04": -0.088,
  "2022-06": -0.082,
  "2022-09": -0.092,
  "2023-01": +0.063,
};

function monthKeyToReturn(year: number, month: number): number {
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (key in MARKET_DRAWDOWN_ANCHORS) return MARKET_DRAWDOWN_ANCHORS[key];
  // Deterministic noise around the +0.6% monthly drift (~7%/yr).
  // Math.sin/Math.cos with mixed periods gives a smooth-but-varied
  // shape; no Math.random so the chart reproduces identically on
  // every reset (user wants the curve to look the same shape each
  // time the demo is re-seeded).
  const t = year * 12 + month;
  const noise =
    0.012 * Math.sin(t * 0.7) +
    0.008 * Math.cos(t * 1.3 + 0.4) +
    0.005 * Math.sin(t * 2.1 + 1.1);
  return 0.0058 + noise; // 0.58% drift + ±~2% noise
}

const DEMO_PASSWORD = "dunphyfamily";

// Account roster. All accounts share the same password since the demo
// is meant to be shared publicly. The password meets Kora's current
// auth.ts ≥8-char minimum (12 chars, no complexity required).
const ACCOUNTS = [
  {
    email: "phil@dunphyfamily.com",
    firstName: "Phil",
    lastName: "Dunphy",
    preferredName: "Phil",
    role: "parent" as const,
  },
  {
    email: "claire@dunphyfamily.com",
    firstName: "Claire",
    lastName: "Dunphy",
    preferredName: "Claire",
    role: "co-parent" as const,
  },
  { email: "jay@dunphyfamily.com",      firstName: "Jay",      lastName: "Pritchett", preferredName: "Jay",      role: "gifter" as const },
  { email: "gloria@dunphyfamily.com",   firstName: "Gloria",   lastName: "Pritchett", preferredName: "Gloria",   role: "gifter" as const },
  { email: "mitchell@dunphyfamily.com", firstName: "Mitchell", lastName: "Pritchett", preferredName: "Mitchell", role: "gifter" as const },
  { email: "cameron@dunphyfamily.com",  firstName: "Cameron",  lastName: "Tucker",    preferredName: "Cam",      role: "gifter" as const },
  { email: "manny@dunphyfamily.com",    firstName: "Manny",    lastName: "Delgado",   preferredName: "Manny",    role: "gifter" as const },
];

// Three Dunphy kids. Ages locked relative to today so the demo always
// reads "Haley is 18, Alex is 15, Luke is 13" regardless of when the
// seed is run. Birthdates derived as `today - years - months_offset`.
// Per DUNPHY_DEMO_SPEC.md locked rule: Dunphys are LA-based →
// California UTMA majority age = 21. Set on each fund.
function birthdateForAge(years: number, monthsBack = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

const KIDS = [
  {
    firstName: "Haley",
    lastName: "Dunphy",
    pronoun: "she",
    majorityAge: 21,
    ageYears: 20, // ~30 days from age 21 (handoff demo); used by giftsForKid to scale history
    birthdate: birthdateForAge(20, 11), // ~30 days from age 21 (handoff demo)
    state: "CA",
    slug: "haley-dunphy",
    strategy: "conservative",
    description: "Haley is heading off to school. Her fund is the bridge.",
    holdings: [
      { ticker: "AAPL",  shares: 12.45, costBasis: 2245.00, currentValue: 2503.20, name: "Apple" },
      { ticker: "GOOGL", shares: 8.32,  costBasis: 1387.00, currentValue: 1498.40, name: "Google" },
      { ticker: "DIS",   shares: 9.12,  costBasis: 821.00,  currentValue: 894.16,  name: "Disney" },
      { ticker: "VTI",   shares: 18.40, costBasis: 4250.00, currentValue: 5253.92, name: "Total Market" },
      { ticker: "BND",   shares: 18.50, costBasis: 1320.00, currentValue: 1310.50, name: "Bonds" },
      { ticker: "VXUS",  shares: 21.40, costBasis: 1280.00, currentValue: 1387.14, name: "International" },
    ],
  },
  {
    firstName: "Alex",
    lastName: "Dunphy",
    pronoun: "she",
    majorityAge: 21,
    ageYears: 15,
    birthdate: birthdateForAge(15, 3),
    state: "CA",
    slug: "alex-dunphy",
    strategy: "balanced",
    description: "Alex is going to read every prospectus we send her. Set her up right.",
    holdings: [
      { ticker: "AAPL",  shares: 4.20,  costBasis: 770.00,  currentValue: 844.20, name: "Apple" },
      { ticker: "GOOGL", shares: 3.10,  costBasis: 520.00,  currentValue: 558.40, name: "Google" },
      { ticker: "DIS",   shares: 6.50,  costBasis: 585.00,  currentValue: 637.00, name: "Disney" },
      { ticker: "VTI",   shares: 10.20, costBasis: 2380.00, currentValue: 2912.04, name: "Total Market" },
      { ticker: "BND",   shares: 8.50,  costBasis: 610.00,  currentValue: 602.05, name: "Bonds" },
      { ticker: "VXUS",  shares: 12.40, costBasis: 740.00,  currentValue: 803.72, name: "International" },
      { ticker: "VGT",   shares: 3.40,  costBasis: 1850.00, currentValue: 1947.32, name: "Tech" },
    ],
  },
  {
    firstName: "Luke",
    lastName: "Dunphy",
    pronoun: "he",
    majorityAge: 21,
    ageYears: 13,
    birthdate: birthdateForAge(13, 7),
    state: "CA",
    slug: "luke-dunphy",
    strategy: "growth",
    description: "Luke's fund has the longest runway. Growth mix all the way.",
    holdings: [
      { ticker: "AAPL",  shares: 2.10,  costBasis: 385.00,  currentValue: 422.10, name: "Apple" },
      { ticker: "GOOGL", shares: 1.50,  costBasis: 252.00,  currentValue: 270.30, name: "Google" },
      { ticker: "DIS",   shares: 4.20,  costBasis: 378.00,  currentValue: 411.60, name: "Disney" },
      { ticker: "RBLX",  shares: 8.50,  costBasis: 425.00,  currentValue: 467.50, name: "Roblox" },
      { ticker: "VTI",   shares: 4.80,  costBasis: 1120.00, currentValue: 1370.16, name: "Total Market" },
      { ticker: "VGT",   shares: 1.20,  costBasis: 654.00,  currentValue: 687.36, name: "Tech" },
    ],
  },
];

// Gift histories per kid, scaled by age so the Memory Book reads like
// a real 16-year saga for Haley, a 12-year build for Alex, and a
// shorter early-years record for Luke. Each entry produces both a
// `gifts` row AND a `memory_entries` gift_message row (matching what
// the production webhook does after a successful Stripe gift). The
// demo centerpiece on Age18Plan counts these to surface "N voice
// memos / M contributors / K gifts with a note" — empty seed → empty
// centerpiece, so the history needs real depth.
//
// Persona shapes (locked per DUNPHY_DEMO_SPEC.md):
//   • Jay (grandpa)    — big-gift Google every ~3 years
//   • Gloria (grandma) — annual DIS birthday with a voice memo
//   • Mitchell (uncle) — recurring annual AAPL birthday gift
//   • Cameron (uncle)  — annual DIS "love-mark" with a rotating quip
//   • Manny (cousin)   — small RBLX gift (recent only — Manny is young)
//   • Phil (dad)       — quarterly add note (the "I show up" parent)
//   • Claire (mom)     — occasional add note
//
// Output count target: Haley ≈ 50 gifts, Alex ≈ 30, Luke ≈ 22.
function giftsForKid(kid: { firstName: string; ageYears: number; birthdate: string }) {
  const N = (yearsAgo: number, monthsAgo = 0): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - yearsAgo);
    d.setMonth(d.getMonth() - monthsAgo);
    return d.toISOString();
  };
  // Birth month (0-11), parsed straight off the YYYY-MM-DD string so a
  // timezone offset can't shift it across a month boundary.
  const birthMonth = Number(kid.birthdate.slice(5, 7)) - 1;
  // Pin an occasion gift to a specific calendar month `yearsAgo` years
  // back (e.g. birthday gifts → birth month, Christmas → December),
  // instead of the old fixed "N months before today" offset that
  // decoupled the date from the occasion — that's how a "Merry
  // Christmas" note ended up dated in April and birthday gifts landed
  // nowhere near the kid's actual birthday. Guarantees a past date: if
  // pinning to this year's month would land in the future (birthday
  // hasn't happened yet this year), step back one more year. `day`
  // varies per gifter so same-month birthday gifts get distinct,
  // deterministically-ordered timestamps.
  const onMonth = (yearsAgo: number, month: number, day = 15): string => {
    const now = new Date();
    const year = now.getFullYear() - yearsAgo;
    let d = new Date(Date.UTC(year, month, day, 12, 0, 0));
    if (d.getTime() > now.getTime()) {
      d = new Date(Date.UTC(year - 1, month, day, 12, 0, 0));
    }
    return d.toISOString();
  };
  const list: Array<{
    senderName: string;
    senderEmail: string;
    amount: number;
    selectedTicker?: string;
    message?: string;
    hasAudio?: boolean;
    createdAt: string;
  }> = [];

  const age = kid.ageYears;

  // Gloria — annual birthday gift from age 4 onwards. Voice memo on
  // every one. Bilingual notes rotate so the Memory Book reads varied
  // when scrolled.
  const gloriaNotes = [
    `Mi amor, never forget your familia. Te amo, ${kid.firstName}.`,
    `Para ti, ${kid.firstName}. Con todo mi amor. — Abuela`,
    `Feliz cumpleaños, ${kid.firstName}. You are my heart.`,
    `Que Dios te bendiga, ${kid.firstName}. Always.`,
    `${kid.firstName}, you are getting so big. Abuela loves you.`,
  ];
  for (let agoYears = 0; agoYears < Math.max(0, age - 3); agoYears++) {
    list.push({
      senderName: "Gloria Pritchett",
      senderEmail: "gloria@dunphyfamily.com",
      amount: agoYears < 5 ? 75 : agoYears < 10 ? 150 : 200,
      selectedTicker: "DIS",
      message: gloriaNotes[agoYears % gloriaNotes.length],
      hasAudio: true,
      createdAt: onMonth(agoYears, birthMonth, 12),
    });
  }

  // Cam — annual Disney birthday from age 4 onwards. THE love-mark
  // detail per the locked spec. Quips rotate so the kid sees a
  // different one-liner each year scrolling back.
  const camNotes = [
    "Because magic is always a good investment. — Cam",
    `For ${kid.firstName} — one day you'll work for Disney, kid. Or own it. — Cam`,
    `Every kid deserves a stake in the Magic Kingdom. — Uncle Cam`,
    `${kid.firstName}, Cam says: never sell Disney. — Cam`,
    `Same gift, every year. Tradition. — Cam`,
    `Mickey, meet your new shareholder. — Cam`,
  ];
  for (let agoYears = 0; agoYears < Math.max(0, age - 3); agoYears++) {
    list.push({
      senderName: "Cameron Tucker",
      senderEmail: "cameron@dunphyfamily.com",
      amount: agoYears < 5 ? 100 : 200,
      selectedTicker: "DIS",
      message: camNotes[agoYears % camNotes.length],
      createdAt: onMonth(agoYears, birthMonth, 20),
    });
  }

  // Mitchell — annual Apple birthday from age 5 onwards. The
  // set-it-and-forget-it gifter; copy is brief because Mitchell is
  // brief.
  const mitchNotes = [
    `Happy birthday, ${kid.firstName}.`,
    `Happy birthday, ${kid.firstName}. — Uncle Mitch`,
    `Happy birthday!`,
    `Hope this is a great year. — Mitch`,
    `Another year, another share of Apple. — Mitch`,
  ];
  for (let agoYears = 0; agoYears < Math.max(0, age - 4); agoYears++) {
    list.push({
      senderName: "Mitchell Pritchett",
      senderEmail: "mitchell@dunphyfamily.com",
      amount: 100,
      selectedTicker: "AAPL",
      message: mitchNotes[agoYears % mitchNotes.length],
      createdAt: onMonth(agoYears, birthMonth, 5),
    });
  }

  // Jay — big-gift Google every ~3 years (birthday or Christmas).
  // Spread across years to look spontaneous, not formulaic.
  const jayNotes = [
    `Happy birthday, ${kid.firstName}. From your Grandpa Jay.`,
    `Merry Christmas, ${kid.firstName}.`,
    `Use this for college, ${kid.firstName}. Grandpa.`,
    `Big year. Big gift. — Grandpa Jay`,
    `For ${kid.firstName}'s future. — Jay`,
  ];
  for (let agoYears = 0; agoYears < age; agoYears += 3) {
    const jayIdx = (agoYears / 3) % jayNotes.length;
    // jayNotes[1] is the "Merry Christmas" note — date it in December so
    // the message and the month agree. Every other note is a
    // birthday/"big year"/"for your future" beat → birth month.
    const isChristmas = jayIdx === 1;
    list.push({
      senderName: "Jay Pritchett",
      senderEmail: "jay@dunphyfamily.com",
      amount: agoYears < 6 ? 250 : 500,
      selectedTicker: "GOOGL",
      message: jayNotes[jayIdx],
      createdAt: isChristmas ? onMonth(agoYears, 11, 22) : onMonth(agoYears, birthMonth, 25),
    });
  }

  // Manny — only past 2-3 years (Manny is ~14 in the show; he didn't
  // start gifting until recently).
  if (age >= 10) {
    list.push({
      senderName: "Manny Delgado",
      senderEmail: "manny@dunphyfamily.com",
      amount: 50,
      selectedTicker: "RBLX",
      message: `From Manny. I bought you Roblox. You're welcome.`,
      createdAt: N(0, 2),
    });
    if (age >= 12) {
      list.push({
        senderName: "Manny Delgado",
        senderEmail: "manny@dunphyfamily.com",
        amount: 50,
        selectedTicker: "RBLX",
        message: `${kid.firstName}: spend it wisely. — Manny`,
        createdAt: N(1, 6),
      });
    }
  }

  // Phil — quarterly monthly-add note. One per quarter going back
  // 4 years feels lived-in without dominating the feed.
  const quarters = Math.min(16, age * 2); // cap at 16 quarters / 4 years
  for (let q = 0; q < quarters; q++) {
    list.push({
      senderName: "Phil Dunphy",
      senderEmail: "phil@dunphyfamily.com",
      amount: 50,
      selectedTicker: undefined,
      message: q === 0 ? "Monthly add from Dad." : q % 4 === 0 ? `Just keeping it going, ${kid.firstName}. — Dad` : "Monthly add from Dad.",
      createdAt: N(0, q * 3 + 1),
    });
  }

  // Claire — occasional. One every 18 months feels right for the
  // co-parent who's mostly handing off the financial mechanics to
  // Phil but adds her own touch.
  for (let agoMonths = 5; agoMonths < age * 12; agoMonths += 18) {
    list.push({
      senderName: "Claire Dunphy",
      senderEmail: "claire@dunphyfamily.com",
      amount: 100,
      selectedTicker: undefined,
      message: `From Mom. ❤`,
      createdAt: N(Math.floor(agoMonths / 12), agoMonths % 12),
    });
  }

  return list;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function upsertUser(account: typeof ACCOUNTS[number]): Promise<string> {
  // Parents (Phil, Claire) land KYC-approved so the demo dashboard
  // doesn't surface "Activate investing / Until we verify your
  // identity" prompts. Gifters don't need KYC — they go through the
  // gift checkout flow. Locked 2026-05-21 with the demo polish pass.
  const isParent = account.role === "parent" || account.role === "co-parent";
  const kycStatus = isParent ? "approved" : "none";
  // Check for existing by email. If found, update flags + return id.
  const [existing] = await db.select().from(users).where(eq(users.email, account.email)).limit(1);
  if (existing) {
    await db.update(users).set({
      isDemoAccount: true,
      firstName: account.firstName,
      lastName: account.lastName,
      preferredName: account.preferredName,
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
    passwordHash,
    isDemoAccount: true,
    kycStatus,
  } as any).returning();
  return created.id;
}

async function seedKidFund(parentUserId: string, kid: typeof KIDS[number]): Promise<string> {
  // Idempotent: if Phil already owns a fund with this slug, return its id.
  const [existing] = await db.select().from(funds).where(
    and(eq(funds.userId, parentUserId), eq(funds.slug, kid.slug)),
  ).limit(1);
  if (existing) {
    return existing.id;
  }

  // Compute gift sum FIRST so we can size the holdings to reflect
  // realistic compound growth on top of contributed capital. Without
  // this, the seeded holdings ($3,629 for Luke vs $7,325 in gifts)
  // surfaced as a 50% LOSS on the dashboard, with the chart's basis
  // line above the value line — the worst possible demo state. Now
  // each kid's holdings.currentValue is scaled so the fund shows
  // age-appropriate positive growth:
  //   Haley (16-year fund) → 1.50× gift sum (~50% gain, realistic
  //     for a near-handoff fund that's seen one full market cycle)
  //   Alex (14-year fund)  → 1.40× gift sum (~40% gain)
  //   Luke (9-year fund)   → 1.25× gift sum (~25% gain — younger
  //     fund hasn't compounded as long)
  // costBasis also scales but at 0.92× of the value scale so the
  // displayed per-holding gain reads positive (currentValue > costBasis).
  // Locked 2026-05-21 after the chart audit revealed underwater
  // funds for two of three demo kids.
  const giftListForSizing = giftsForKid({ firstName: kid.firstName, ageYears: kid.ageYears, birthdate: kid.birthdate });
  const giftSum = giftListForSizing.reduce((sum, g) => sum + g.amount, 0);
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
  const earliestGiftMs = giftListForSizing.reduce((min, g) => {
    const t = new Date(g.createdAt).getTime();
    return Number.isFinite(t) && t < min ? t : min;
  }, Date.now());
  // One day before the first gift — the fund exists, THEN gifts arrive.
  const fundCreatedAt = new Date(earliestGiftMs - 24 * 60 * 60 * 1000);
  const growthFactor =
    kid.firstName === "Haley" ? 1.50
    : kid.firstName === "Alex" ? 1.40
    : 1.25;
  const targetValue = giftSum * growthFactor;
  const rawHoldingsValueSum = kid.holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const rawHoldingsBasisSum = kid.holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const valueScale = rawHoldingsValueSum > 0 ? targetValue / rawHoldingsValueSum : 1;
  // Basis scales at 92% of value scale so per-holding gain stays
  // visibly positive even after rebalance.
  const basisScale = valueScale * 0.92;
  // Build scaled holdings (used below for both DB insert + balance).
  const scaledHoldings = kid.holdings.map((h) => ({
    ...h,
    currentValue: h.currentValue * valueScale,
    costBasis: h.costBasis * basisScale,
  }));
  const investedValue = scaledHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const costBasis = scaledHoldings.reduce((sum, h) => sum + h.costBasis, 0);

  const [fund] = await db.insert(funds).values({
    userId: parentUserId,
    // Backdated so the fund predates its own gift history (see above) —
    // otherwise the "fund so far" breakdown shows $0 in gifts.
    createdAt: fundCreatedAt,
    recipientFirstName: kid.firstName,
    recipientLastName: kid.lastName,
    // recipientBirthdate is a timestamp column in shared/schema.ts —
    // Drizzle's PgTimestamp.mapToDriverValue calls .toISOString() on
    // the value, so a raw "YYYY-MM-DD" string crashes the insert.
    // Convert to a Date before passing. Locked 2026-05-21 after this
    // crashed every seed run and left every demo user with zero funds,
    // which made /demo → Dashboard → /get-started for every visitor.
    recipientBirthdate: new Date(kid.birthdate),
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
    accountType: "utma",
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

  // Seed holdings using the scaledHoldings array (see growth-factor
  // sizing above). Shares scale alongside value so price-per-share
  // stays stable (no $1000 shares of Apple etc.). Locked 2026-05-21.
  for (const h of scaledHoldings) {
    const scaledShares = h.shares * valueScale;
    await db.insert(holdings).values({
      fundId: fund.id,
      ticker: h.ticker,
      name: h.name,
      shares: scaledShares.toFixed(6),
      costBasis: h.costBasis.toFixed(2),
      currentValue: h.currentValue.toFixed(2),
      gain: (h.currentValue - h.costBasis).toFixed(2),
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
  // seed mirrors that pattern. Type was previously "gift" — wrong;
  // MemoryBook.tsx filters specifically for "gift_message" + "milestone"
  // + "photo" + "note", so the old entries silently fell through and
  // the Memory Book read empty regardless of how many gifts existed.
  const giftList = giftsForKid({ firstName: kid.firstName, ageYears: kid.ageYears, birthdate: kid.birthdate });
  const sendersSeen = new Set<string>();
  for (const g of giftList) {
    const giftAudioUrl = g.hasAudio ? gloriaAudioUrl : null;
    const giftRow: InsertGift = {
      fundId: fund.id,
      senderName: g.senderName,
      senderEmail: g.senderEmail,
      amount: g.amount.toFixed(2),
      netAmount: g.amount.toFixed(2),
      status: "invested",
      message: g.message ?? null,
      selectedTicker: g.selectedTicker ?? null,
      audioUrl: giftAudioUrl,
      createdAt: new Date(g.createdAt),
    } as any;
    const [insertedGift] = await db.insert(gifts).values(giftRow as any).returning();
    sendersSeen.add(g.senderEmail.toLowerCase());

    // Mirror the webhook: one gift_message memory entry per gift, with
    // the same audio/photo fields the production handler copies over.
    // createdAt is set to match the gift so the Memory Book sort lands
    // them in chronological order with the gift itself.
    await db.insert(memoryEntries).values({
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
    } as any);
  }

  // Update contributor count from unique senders.
  await db.update(funds)
    .set({ contributorCount: sendersSeen.size })
    .where(eq(funds.id, fund.id));

  // Phil's at-18 letter — appears in Haley's fund only (closest to majority).
  if (kid.firstName === "Haley") {
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      content: `Haley. The day you read this is the day this is yours. We started this fund when you were small because we knew this moment was coming. Not the money — the moment. You owning something we built together over years. Whatever you do with it, do it on purpose. We love you. — Dad`,
      type: "parent_letter",
      authorRole: "parent",
      authorName: "Phil Dunphy",
      visibility: "kid_at_18",
    } as any);

    // MilestoneMoment seed — Haley's fund crossed $5K when she was 12.
    // Type "milestone" is rendered by MemoryBook.tsx as a celebration
    // beat in the timeline. Anchored to ~9 years ago so it lands in
    // the middle of the saga, not at the end. The kid-at-18 reader
    // scrolls back and sees: "Wow, $5K crossed 9 years before I
    // turned 21." That's the heirloom register the page is built for.
    const fiveKMoment = (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 9);
      d.setMonth(d.getMonth() - 2);
      return d;
    })();
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      content: `Haley's fund crossed $5,000. Started with $100. Grew through every birthday, every Christmas, every Disney visit from Uncle Cam.`,
      type: "milestone",
      authorRole: "parent",
      authorName: "Phil Dunphy",
      visibility: "kid_now",
      createdAt: fiveKMoment,
    } as any);

    // A second milestone — $10K crossing about 4 years later. Two
    // milestone beats in the timeline gives the kid scrolling back
    // a sense of pace, not a one-off marker. Same MemoryBook filter
    // catches both.
    const tenKMoment = (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 5);
      d.setMonth(d.getMonth() - 7);
      return d;
    })();
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      content: `Haley's fund crossed $10,000. Five years in. Half the runway done; the other half is just compounding.`,
      type: "milestone",
      authorRole: "parent",
      authorName: "Phil Dunphy",
      visibility: "kid_now",
      createdAt: tenKMoment,
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

  // Generate the historical balance curve. Walks month-by-month from
  // the first gift date to today, applying real-shape monthly returns
  // (smooth drift + hand-placed crisis-window dips) and stepping up
  // at each gift date. Final value is then linearly scaled so the
  // last snapshot matches the seeded balance — keeps the chart honest
  // about the shape of the past 16 years while making the displayed
  // hero number consistent with the chart's right edge.
  //
  // Locked 2026-05-21 — the dashboard's growth chart was rendering a
  // straight line from $0 today because no fund_snapshots existed for
  // demo funds. The kid-at-18 narrative depends on the chart showing
  // a multi-year story; without snapshots there's no story.
  await generateHistoricalSnapshots(fund.id, giftList, investedValue, costBasis);

  return fund.id;
}

// Generate monthly fund_snapshots from the first gift to today,
// producing a believable historical-balance curve with real-shape
// market movement scaled to land at `finalInvestedValue`.
async function generateHistoricalSnapshots(
  fundId: string,
  giftList: ReturnType<typeof giftsForKid>,
  finalInvestedValue: number,
  finalCostBasis: number,
): Promise<void> {
  if (giftList.length === 0) return;
  // Sort gifts ascending. Earliest gift sets the curve's start month.
  const sortedGifts = [...giftList].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const startDate = new Date(sortedGifts[0].createdAt);
  startDate.setDate(1); // snap to month start
  const today = new Date();
  // STOP the monthly loop at the END of the previous complete month.
  // Walking into the current month stamps a future-dated end-of-
  // month snapshot (e.g. on May 21 it'd write a "May 31 23:59"
  // snapshot, which is in the future). That future date then
  // pollutes the aggregate sparkline query that filters by
  // "last 30 days" — landed as a $48k double-count when both the
  // daily loop and the monthly loop wrote near-today rows. Locked
  // 2026-05-21 with the aggregate-double-count fix.
  const monthlyEnd = new Date(today.getFullYear(), today.getMonth(), 0); // last day of PREVIOUS month
  monthlyEnd.setDate(1); // snap back to month-start for the loop check below

  // Walk months. For each month: apply that month's return to the
  // running balance, then add any gifts whose createdAt falls inside
  // this month.
  const path: Array<{ date: Date; total: number; basis: number }> = [];
  let balance = 0;
  let basis = 0;
  let giftIdx = 0;
  const cursor = new Date(startDate);
  while (cursor.getTime() <= monthlyEnd.getTime()) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    // 1. Market return on existing balance (skip the very first month
    //    since balance is still zero — market math is a no-op then).
    if (balance > 0) {
      const r = monthKeyToReturn(year, month);
      balance = balance * (1 + r);
    }
    // 2. Add any gifts that landed inside this month.
    while (
      giftIdx < sortedGifts.length &&
      (() => {
        const g = sortedGifts[giftIdx];
        const gd = new Date(g.createdAt);
        return gd.getFullYear() === year && gd.getMonth() === month;
      })()
    ) {
      const g = sortedGifts[giftIdx];
      balance += g.amount;
      basis += g.amount;
      giftIdx += 1;
    }
    // 3. Snapshot at month-end (last day of this month, noon UTC
    //    so timezone shifts can't push it into the next calendar
    //    day in either direction). Was previously local 23:59
    //    which crossed UTC midnight on systems east of UTC and
    //    landed snapshots a day forward.
    const snapshotDate = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
    path.push({ date: snapshotDate, total: balance, basis });
    // Step to next month.
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // Absorb any gifts that arrive in the current (not-yet-complete)
  // month so the daily-loop interpolation has the correct balance
  // running into today. Same logic as the monthly-loop body, just
  // applied once for the current month before we exit the monthly
  // phase.
  {
    const curYear = today.getFullYear();
    const curMonth = today.getMonth();
    if (balance > 0) {
      const r = monthKeyToReturn(curYear, curMonth);
      // Apply only the partial-month portion of the current month's
      // return, prorated by days-elapsed/days-in-month.
      const dim = new Date(curYear, curMonth + 1, 0).getDate();
      const prorate = today.getDate() / dim;
      balance = balance * (1 + r * prorate);
    }
    while (
      giftIdx < sortedGifts.length &&
      (() => {
        const g = sortedGifts[giftIdx];
        const gd = new Date(g.createdAt);
        return gd.getFullYear() === curYear && gd.getMonth() === curMonth;
      })()
    ) {
      const g = sortedGifts[giftIdx];
      balance += g.amount;
      basis += g.amount;
      giftIdx += 1;
    }
    // Push a final "today" anchor on the monthly path so the
    // interpolator has a right edge to interpolate against. It's
    // also what the daily loop will hard-anchor to.
    path.push({ date: new Date(today), total: balance, basis });
  }

  // Scale so the final path value lands on the seeded balance. Real
  // market shape stays — just the magnitude reconciles to what the
  // dashboard hero shows.
  const finalPathValue = path[path.length - 1]?.total ?? 0;
  const scale = finalPathValue > 0 ? finalInvestedValue / finalPathValue : 1;
  const basisScale = path[path.length - 1]?.basis ?? 0;
  const basisScaleFactor = basisScale > 0 ? finalCostBasis / basisScale : 1;

  // Apply the scale to the monthly path values.
  const scaledMonthly = path.map((p) => ({
    date: p.date,
    total: p.total * scale,
    basis: p.basis * basisScaleFactor,
  }));

  // Resolution policy — each toggle on the dashboard chart (1W / 1M /
  // YTD / 1Y / 5Y / ALL) reads from the same fund_snapshots series and
  // filters by date. Monthly-only data leaves 1W with 1 point and 1M
  // with 1-2 points, rendering as a flat line. Fix: ship snapshots at
  // variable resolution depending on how recent the window is.
  //   ALL / 5Y      → monthly (handled above)
  //   YTD / 1Y      → weekly within the last 12 months
  //   1M / 1W       → daily within the last 30 days
  //
  // The finer-resolution series interpolates between adjacent monthly
  // anchors plus a tiny deterministic daily wobble (no Math.random —
  // the curve reproduces identically on every reset). Locked
  // 2026-05-21 alongside the historical-snapshot landing.
  const allSnapshots: Array<{ date: Date; total: number; basis: number }> = [...scaledMonthly];

  if (scaledMonthly.length >= 2) {
    const now = new Date();
    const oneYearAgo = new Date(now); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Helper: interpolate the scaled monthly path to any date in
    // between the existing month-end anchors. Returns linear-interp
    // value plus a tiny sin-based daily wobble (~±0.4% intraday).
    const interpAt = (when: Date): { total: number; basis: number } => {
      const t = when.getTime();
      let before = scaledMonthly[0];
      let after = scaledMonthly[scaledMonthly.length - 1];
      for (let i = 0; i < scaledMonthly.length - 1; i++) {
        if (scaledMonthly[i].date.getTime() <= t && scaledMonthly[i + 1].date.getTime() >= t) {
          before = scaledMonthly[i];
          after = scaledMonthly[i + 1];
          break;
        }
      }
      const span = after.date.getTime() - before.date.getTime();
      const ratio = span > 0 ? (t - before.date.getTime()) / span : 0;
      const baseTotal = before.total + (after.total - before.total) * ratio;
      const baseBasis = before.basis + (after.basis - before.basis) * ratio;
      // Daily wobble: deterministic, modest, doesn't shift the long
      // arc. Tied to day-of-epoch so the same date always gets the
      // same wobble across resets.
      const dayIdx = Math.floor(t / 86_400_000);
      const wobble =
        0.004 * Math.sin(dayIdx * 0.41) +
        0.0025 * Math.cos(dayIdx * 1.13);
      return {
        total: baseTotal * (1 + wobble),
        basis: baseBasis, // basis doesn't wobble — it only changes when gifts arrive
      };
    };

    // Weekly snapshots: every 7 days from 1 year ago up to 30 days
    // ago. Don't extend past 30-days-ago because the daily loop
    // below covers that.
    const weeklyEnd = new Date(thirtyDaysAgo);
    const weeklyCursor = new Date(oneYearAgo);
    while (weeklyCursor.getTime() < weeklyEnd.getTime()) {
      const { total, basis } = interpAt(weeklyCursor);
      allSnapshots.push({ date: new Date(weeklyCursor), total, basis });
      weeklyCursor.setDate(weeklyCursor.getDate() + 7);
    }

    // Daily snapshots: every day from 30 days ago through today.
    // Today's snapshot reuses the final scaled-monthly value exactly
    // (so the chart's right edge is identical to the hero number).
    const dailyCursor = new Date(thirtyDaysAgo);
    while (dailyCursor.getTime() <= now.getTime()) {
      // Today: hard-anchor to the final value so chart-right ===
      // hero number with zero drift.
      const isToday =
        dailyCursor.getFullYear() === now.getFullYear() &&
        dailyCursor.getMonth() === now.getMonth() &&
        dailyCursor.getDate() === now.getDate();
      if (isToday) {
        allSnapshots.push({
          date: new Date(now),
          total: finalInvestedValue,
          basis: finalCostBasis,
        });
      } else {
        const { total, basis } = interpAt(dailyCursor);
        allSnapshots.push({ date: new Date(dailyCursor), total, basis });
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

  const philId = userIdByEmail.get("phil@dunphyfamily.com")!;

  // 1b. Seed Phil's Family-plan subscription (idempotent).
  await ensurePhilFamilySubscription(philId);
  console.log(`  subscription: phil@dunphyfamily.com → Family · active`);

  // 2. Check if Phil already has funds. If yes, assume the seed has
  //    already run before and exit early to keep the script idempotent.
  const existingFunds = await db.select().from(funds).where(eq(funds.userId, philId));
  if (existingFunds.length > 0) {
    console.log(`\nPhil already has ${existingFunds.length} fund(s). Skipping fund seed to stay idempotent.`);
    console.log("To re-seed funds from scratch: run `npm run reset:dunphys` instead.");
    if (closePool) await pool.end();
    return;
  }

  // 3. Seed all three Dunphy kid funds.
  const seededFundIds: string[] = [];
  for (const kid of KIDS) {
    const fundId = await seedKidFund(philId, kid);
    seededFundIds.push(fundId);
    console.log(`  fund: ${kid.firstName}'s Fund (${kid.slug}) → ${fundId}`);
  }

  // 4. Wire Claire as co-parent on all three funds. Without this,
  //    logging in as Claire via /demo shows an empty fund list and
  //    Dashboard redirects to /get-started — defeating the
  //    "co-parent view of the same three funds" spec promise.
  //    status='accepted' is the canonical value the auth middleware
  //    (requireOwnedFundParam) and the new /api/funds collaborator
  //    merge both look for. acceptedAt populated so the row passes
  //    any timestamp-based filters.
  const claireId = userIdByEmail.get("claire@dunphyfamily.com");
  if (claireId && seededFundIds.length > 0) {
    for (const fundId of seededFundIds) {
      await db.insert(fundCollaborators).values({
        fundId,
        userId: claireId,
        email: "claire@dunphyfamily.com",
        role: "co-parent",
        status: "accepted",
        acceptedAt: new Date(),
        invitedAt: new Date(),
      } as any);
    }
    console.log(`  collaborator: claire@dunphyfamily.com → co-parent on ${seededFundIds.length} fund(s)`);
  }

  // 5. Seed Phil's recurring parent_contributions on the kids whose
  //    runway justifies it. Haley's is paused (she's a month from
  //    handoff — the recurring would naturally have wound down).
  //    Alex + Luke active monthly. This is the "auto-invest" /
  //    "Recurring investment" surface on the dashboard; without
  //    these rows the demo shows "Set up recurring investments" CTA
  //    for every fund, undercutting the "fully set up household"
  //    showcase. Locked 2026-05-21 with the demo polish pass.
  const recurringSchedule: Array<{ kidName: string; amount: number; status: "active" | "paused" }> = [
    { kidName: "Haley", amount: 50, status: "paused" },
    { kidName: "Alex",  amount: 50, status: "active" },
    { kidName: "Luke",  amount: 75, status: "active" },
  ];
  for (let i = 0; i < KIDS.length; i++) {
    const kid = KIDS[i];
    const fundId = seededFundIds[i];
    const cfg = recurringSchedule.find((s) => s.kidName === kid.firstName);
    if (!cfg || !fundId) continue;
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 14); // ~2 weeks out
    await db.insert(parentContributions).values({
      fundId,
      userId: philId,
      amount: cfg.amount.toFixed(2),
      frequency: "monthly",
      status: cfg.status,
      pauseReason: cfg.status === "paused" ? "user" : null,
      pausedAt: cfg.status === "paused" ? new Date() : null,
      nextRunDate: cfg.status === "active" ? nextRun : null,
      lastRunDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        return d;
      })(),
    } as any);
  }
  console.log(`  recurring (Phil): ${recurringSchedule.filter(r => r.status === "active").length} active, ${recurringSchedule.filter(r => r.status === "paused").length} paused`);

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
      } as any);
    }
    console.log(`  recurring (Mitchell): annual birthday on ${KIDS.length} fund(s)`);
  }

  console.log("\nDone. Demo accounts ready.");
  console.log("Login: any of the seven emails, password: " + DEMO_PASSWORD);
  console.log("  phil@dunphyfamily.com    — parent dashboard with 3 kids");
  console.log("  claire@dunphyfamily.com  — co-parent view");
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
