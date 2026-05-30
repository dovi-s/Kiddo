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
import { eq, and, asc } from "drizzle-orm";
import { promises as fsp } from "node:fs";
import path from "node:path";

// English ordinal for "{N}th Birthday" occasion names.
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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
    preferredName: "Dad",
    role: "parent" as const,
  },
  {
    email: "claire@dunphyfamily.com",
    firstName: "Claire",
    lastName: "Dunphy",
    preferredName: "Mom",
    role: "co-parent" as const,
  },
  { email: "jay@dunphyfamily.com",      firstName: "Jay",      lastName: "Pritchett", preferredName: "Jay",      role: "gifter" as const },
  { email: "gloria@dunphyfamily.com",   firstName: "Gloria",   lastName: "Pritchett", preferredName: "Gloria",   role: "gifter" as const },
  { email: "mitchell@dunphyfamily.com", firstName: "Mitchell", lastName: "Pritchett", preferredName: "Mitchell", role: "gifter" as const },
  { email: "cameron@dunphyfamily.com",  firstName: "Cameron",  lastName: "Tucker",    preferredName: "Cam",      role: "gifter" as const },
  { email: "manny@dunphyfamily.com",    firstName: "Manny",    lastName: "Delgado",   preferredName: "Manny",    role: "gifter" as const },
  // Haley is the graduated adult: past CA majority (21), her fund is transferred
  // to her below (step 3b). The "graduate" role gives her approved KYC in
  // upsertUser — she owns a live individual investing account now, not a
  // parent-custodial one. Logging in as her renders the REAL post-handoff adult
  // experience (the demo is the real app, not a mock view).
  { email: "haley@dunphyfamily.com",    firstName: "Haley",    lastName: "Dunphy",    preferredName: "Haley",    role: "graduate" as const },
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

const KIDS = [
  {
    firstName: "Haley",
    lastName: "Dunphy",
    pronoun: "she",
    majorityAge: 21,
    ageYears: 22, // a year PAST CA majority (21) — graduated adult-account demo; sits clearly above Alex so they don't read as twins
    birthdate: birthdateForAge(22, 4), // ~22y4m, a year past the handoff
    state: "CA",
    slug: "haley-dunphy",
    strategy: "conservative",
    description: "Haley is 22, a year past majority. The fund is hers now — this is what graduating looks like.",
    // Recurring ended at the handoff: the parent's auto-invest stops once
    // ownership transfers. The fund still carries its full realized history
    // (see giftsForKid / seedKidFund); Haley controls it from here.
    recurring: { amount: 50, status: "paused" },
    holdings: [
      { ticker: "AAPL",  shares: 12.45, costBasis: 2245.00, currentValue: 2503.20, name: "Apple" },
      { ticker: "GOOGL", shares: 8.32,  costBasis: 1387.00, currentValue: 1498.40, name: "Google" },
      { ticker: "DIS",   shares: 9.12,  costBasis: 821.00,  currentValue: 894.16,  name: "Disney" },
      // Legacy conservative-mix holdings, built over years BEFORE the 2026-05-28
      // self-directed pivot dropped the VGT tech sleeve. Existing positions stay
      // (realistic for a long-lived fund); NEW managed investments now follow the
      // VGT-free conservative target (VTI 42 / VXUS 18 / BND 40, ~60% equity).
      { ticker: "VTI",   shares: 9.82,  costBasis: 2535.00, currentValue: 2800.00, name: "US Total Market" },
      { ticker: "VXUS",  shares: 18.46, costBasis: 1085.00, currentValue: 1200.00, name: "International" },
      { ticker: "VGT",   shares: 1.39,  costBasis: 725.00,  currentValue: 800.00,  name: "Tech" },
      { ticker: "BND",   shares: 44.44, costBasis: 3300.00, currentValue: 3200.00, name: "Bonds" },
    ],
  },
  {
    firstName: "Alex",
    lastName: "Dunphy",
    pronoun: "she",
    majorityAge: 21,
    ageYears: 20, // ~30 days from CA majority (21) — the approaching-handoff demo
    birthdate: birthdateForAge(20, 11), // ~30 days from age 21 (handoff demo)
    state: "CA",
    slug: "alex-dunphy",
    strategy: "balanced",
    description: "Alex is weeks from 21. This is where the handoff begins.",
    // Recurring winds down as the handoff nears (the worker auto-pauses near
    // majority); the fund still carries years of realized history.
    recurring: { amount: 50, status: "paused" },
    holdings: [
      { ticker: "AAPL",  shares: 4.20,  costBasis: 770.00,  currentValue: 844.20, name: "Apple" },
      { ticker: "GOOGL", shares: 3.10,  costBasis: 520.00,  currentValue: 558.40, name: "Google" },
      { ticker: "DIS",   shares: 6.50,  costBasis: 585.00,  currentValue: 637.00, name: "Disney" },
      // Legacy balanced-mix holdings (pre-2026-05-28 pivot, included a VGT sleeve).
      // New managed investments follow the VGT-free target: VTI 50 / VXUS 25 / BND 25.
      { ticker: "VTI",   shares: 8.42,  costBasis: 2175.00, currentValue: 2400.00, name: "US Total Market" },
      { ticker: "VXUS",  shares: 18.46, costBasis: 1085.00, currentValue: 1200.00, name: "International" },
      { ticker: "VGT",   shares: 1.57,  costBasis: 815.00,  currentValue: 900.00,  name: "Tech" },
      { ticker: "BND",   shares: 20.83, costBasis: 1545.00, currentValue: 1500.00, name: "Bonds" },
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
    recurring: { amount: 75, status: "active" },
    holdings: [
      { ticker: "AAPL",  shares: 2.10,  costBasis: 385.00,  currentValue: 422.10, name: "Apple" },
      { ticker: "GOOGL", shares: 1.50,  costBasis: 252.00,  currentValue: 270.30, name: "Google" },
      { ticker: "DIS",   shares: 4.20,  costBasis: 378.00,  currentValue: 411.60, name: "Disney" },
      { ticker: "RBLX",  shares: 8.50,  costBasis: 425.00,  currentValue: 467.50, name: "Roblox" },
      // Legacy growth-mix holdings (pre-2026-05-28 pivot, included a VGT sleeve).
      // New managed investments follow the VGT-free target: VTI 62 / VXUS 28 / BND 10
      // (~90% equity, the up-and-to-the-right default for a lifelong horizon).
      { ticker: "VTI",   shares: 3.86,  costBasis: 995.00,  currentValue: 1100.00, name: "US Total Market" },
      { ticker: "VXUS",  shares: 7.69,  costBasis: 453.00,  currentValue: 500.00,  name: "International" },
      { ticker: "VGT",   shares: 0.35,  costBasis: 181.00,  currentValue: 200.00,  name: "Tech" },
      { ticker: "BND",   shares: 2.78,  costBasis: 206.00,  currentValue: 200.00,  name: "Bonds" },
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
//   • Manny (step-uncle, young) — small RBLX gift (recent only — Manny is young)
//   • Phil (dad)       — quarterly add note (the "I show up" parent)
//   • Claire (mom)     — occasional add note
//
// Output count target: Haley ≈ 50 gifts, Alex ≈ 30, Luke ≈ 22.
function giftsForKid(kid: { firstName: string; ageYears: number; birthdate: string; recurringAmount: number; recurringPaused: boolean }) {
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
    // Anchor to the most recent year in which this month/day has ALREADY
    // occurred: if the target date this year is still in the future, the
    // latest past occurrence was last year. Then step back whole years.
    // Computing the anchor ONCE (rather than subtracting yearsAgo first and
    // stepping back per-call) keeps consecutive yearsAgo values on distinct
    // years — otherwise yearsAgo 0 and 1 both collapse onto last year for a
    // kid whose birthday hasn't happened yet this year, doubling that year's
    // birthday gifts in the Memory Book.
    const thisYear = new Date(Date.UTC(now.getFullYear(), month, day, 12, 0, 0));
    const anchorYear = thisYear.getTime() > now.getTime() ? now.getFullYear() - 1 : now.getFullYear();
    return new Date(Date.UTC(anchorYear - yearsAgo, month, day, 12, 0, 0)).toISOString();
  };
  const list: Array<{
    senderName: string;
    senderEmail: string;
    amount: number;
    selectedTicker?: string;
    message?: string;
    hasAudio?: boolean;
    createdAt: string;
    // "recurring" marks a Phil auto-invest cycle so seedKidFund can link
    // it to the parent_contribution + apply the production worker's
    // memory-stamp-once rule. Absent on ordinary gifts.
    kind?: "recurring";
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

  // Phil — the recurring auto-investor ("the parent who shows up every
  // month"). Modeled EXACTLY as the production recurring worker writes a
  // cycle (recurringContributionWorker.ts): one gift per monthly charge,
  // at the schedule's amount, carrying the parent's recurring note as the
  // message, linked to the schedule (parentContributionId stamped in
  // seedKidFund). Mirroring prod is what makes this honest paper-trading:
  //   • the recurring detail shows real cycles + a real total invested
  //   • the dashboard breakdown counts them as "recurring investments"
  //     (the row keys off parentContributionId), not "one-time additions"
  //   • the balance absorbs them through the same gift-sizing every other
  //     gift flows through — no desync
  //   • exactly ONE (the first/oldest) becomes a Memory Book parent_note
  //     in seedKidFund; the worker stamps memory once on the first cycle
  //     and never again, so 3 years of auto-investing never floods the
  //     timeline.
  // 36 cycles ≈ 3 years of showing up. Active schedules ran through last
  // month (next charge upcoming); the paused one (Haley, winding down near
  // majority) stopped a few months back.
  const recurringNote = `Every month, a little more for ${kid.firstName}. From Dad.`;
  const recurringStartOffset = kid.recurringPaused ? 3 : 1;
  for (let i = 0; i < 36; i++) {
    list.push({
      senderName: "Phil Dunphy",
      senderEmail: "phil@dunphyfamily.com",
      amount: kid.recurringAmount,
      selectedTicker: undefined,
      message: recurringNote,
      createdAt: N(0, recurringStartOffset + i),
      kind: "recurring",
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

  // A FRESH gift, a couple of days ago. Without this the newest activity is
  // ~2 months old (Manny at N(0,2)) for EVERY kid, so the dashboard's "Last
  // 30 days" summary reads all $0 and a living fund looks abandoned. This also
  // gives the "a gift just came in" notification (client DemoGiftMoment) a
  // REAL, top-of-feed entry that matches it — keyed to the same gifter /
  // amount / ticker the toast announces for each child, so the moment is
  // coherent the instant a prospect taps "View". Dated ~2 days back (not
  // "now") so it sits robustly inside the 30-day window and reads "this week"
  // even if a dev DB isn't reseeded for a day or two (prod reseeds nightly).
  const recentGift: Record<string, { senderName: string; senderEmail: string; amount: number; ticker: string; message: string; hasAudio?: boolean }> = {
    Haley: { senderName: "Gloria Pritchett", senderEmail: "gloria@dunphyfamily.com", amount: 75, ticker: "DIS", message: `Thinking of you today, mi amor. A little more for your future. Te amo. — Abuela`, hasAudio: true },
    Alex: { senderName: "Jay Pritchett", senderEmail: "jay@dunphyfamily.com", amount: 250, ticker: "GOOGL", message: `Proud of you, Alex. Put this toward something that lasts. — Grandpa Jay` },
    Luke: { senderName: "Manny Delgado", senderEmail: "manny@dunphyfamily.com", amount: 50, ticker: "RBLX", message: `Saw a stock I liked and thought of you, Luke. — Manny` },
  };
  const fresh = recentGift[kid.firstName];
  if (fresh) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    list.push({
      senderName: fresh.senderName,
      senderEmail: fresh.senderEmail,
      amount: fresh.amount,
      selectedTicker: fresh.ticker,
      message: fresh.message,
      hasAudio: fresh.hasAudio,
      createdAt: d.toISOString(),
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
  externalGifts: Array<{ senderName: string; senderEmail: string; amount: number; createdAt: Date }>,
): Promise<number> {
  const byEmail = new Map<string, { name: string; count: number; total: number; first: number; last: number }>();
  for (const g of externalGifts) {
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

async function seedKidFund(parentUserId: string, kid: typeof KIDS[number], parentDisplayName: string): Promise<string> {
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
  const giftListForSizing = giftsForKid({ firstName: kid.firstName, ageYears: kid.ageYears, birthdate: kid.birthdate, recurringAmount: kid.recurring.amount, recurringPaused: kid.recurring.status === "paused" });
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
    kid.firstName === "Haley" ? 1.55   // graduated: the longest, fullest history
    : kid.firstName === "Alex" ? 1.50  // near majority: mature, well-grown fund
    : 1.25;                            // Luke: younger, shorter runway so far
  const targetValue = giftSum * growthFactor;
  const rawHoldingsValueSum = kid.holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const rawHoldingsBasisSum = kid.holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const valueScale = rawHoldingsValueSum > 0 ? targetValue / rawHoldingsValueSum : 1;
  // Cost basis is tied to ACTUAL CONTRIBUTIONS, not a cosmetic fraction of
  // value. sum(costBasis) === giftSum (every dollar contributed bought
  // holdings; cashBalance is 0), so the holdings-based fund gain works out
  // to exactly growthFactor − 1 (25% / 40% / 50%) — which MATCHES the
  // contributions-vs-value "market growth" the dashboard breakdown shows.
  // The old `valueScale * 0.92` heuristic floated cost basis ABOVE total
  // contributions (e.g. Haley basis $16,178 > $13,325 ever contributed —
  // impossible) and made the two growth readings disagree (23.5% vs 50%).
  // Per-holding variety is preserved (each keeps its own value/basis ratio);
  // they're just renormalized so the fund total is honest. As a bonus the
  // historical basis line in generateHistoricalSnapshots becomes the real
  // cumulative-contributions curve (basisScaleFactor → 1), so the chart's
  // value line only dips below basis during genuine market drawdowns.
  const basisScale = rawHoldingsBasisSum > 0 ? giftSum / rawHoldingsBasisSum : valueScale;
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
  const giftList = giftsForKid({ firstName: kid.firstName, ageYears: kid.ageYears, birthdate: kid.birthdate, recurringAmount: kid.recurring.amount, recurringPaused: kid.recurring.status === "paused" });
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
  const recurringChargeNote = giftList.find((g) => g.kind === "recurring")?.message ?? null;
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
  const externalGifts: Array<{ giftId: string; senderName: string; senderEmail: string; amount: number; createdAt: Date }> = [];
  for (const g of giftList) {
    const isRecurring = g.kind === "recurring";
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
      // Recurring cycles link to Phil's schedule + carry the worker's
      // source tag, exactly as recurringContributionWorker stamps them.
      // parentContributionId is what moves them into the dashboard's
      // "Your recurring investments" breakdown row (instead of "one-time").
      parentContributionId: isRecurring ? philContribution.id : null,
      source: isRecurring ? "recurring_worker" : null,
      createdAt: new Date(g.createdAt),
    } as any;
    const [insertedGift] = await db.insert(gifts).values(giftRow as any).returning();
    sendersSeen.add(g.senderEmail.toLowerCase());

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
      type: isRecurring ? "parent_contribution" : "gift_received",
      title: isRecurring
        ? `You contributed $${g.amount.toFixed(2)}`
        : `Gift from ${g.senderName}`,
      description: isRecurring
        ? (g.selectedTicker ? `Investing into ${String(g.selectedTicker).toUpperCase()}` : "Investing across the diversified mix")
        : (g.message ? `"${g.message}"` : "No note."),
      amount: g.amount.toFixed(2),
      metadata: JSON.stringify({
        giftId: insertedGift.id,
        ticker: g.selectedTicker || null,
        message: g.message || null,
        executionModel: isRecurring ? "auto_invest" : null,
        senderEmail: g.senderEmail || null,
        senderName: g.senderName || null,
        // How the family refers to the custodian who made this contribution
        // ("Dad"). Lets the post-handoff owner view credit "Dad added $X"
        // instead of the custodial-era "You contributed". Only on recurring
        // (parent) contributions; external gifts carry their own senderName.
        contributorName: isRecurring ? parentDisplayName : null,
        isParentContribution: isRecurring,
        parentContributionId: isRecurring ? philContribution.id : null,
      }),
      createdAt: new Date(g.createdAt),
    } as any);

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
    externalGifts.push({ giftId: insertedGift.id, senderName: g.senderName, senderEmail: g.senderEmail, amount: g.amount, createdAt: new Date(g.createdAt) });
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
  for (const eg of externalGifts) {
    const age = nowMs - eg.createdAt.getTime();
    if (age < thankMinAgeMs) continue; // recent gifts stay awaiting (actionable)
    const first = eg.senderName.split(" ")[0];
    const amt = eg.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const willRead = kid.pronoun === "she" ? "she's" : kid.pronoun === "he" ? "he's" : "they're";
    await db.insert(thankYous).values({
      fundId: fund.id,
      giftId: eg.giftId,
      senderName: eg.senderName,
      senderEmail: eg.senderEmail || null,
      message: `Dear ${first},\n\nThank you so much for your $${amt} gift to ${kid.firstName}'s fund. It means more than you know: not just the investment itself, but the fact that you showed up for ${kid.firstName}'s future.\n\n${kid.firstName} will read this when ${willRead} ${kid.majorityAge}.\n\nWith love,\nPhil`,
      status: "sent",
      sentAt: new Date(eg.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000),
    } as any);
  }

  // Gifter milestone-update opt-ins for the "who's following along" surface
  // (file-based store; see seedGifterNotifications above).
  await seedGifterNotifications(fund.id, externalGifts);

  // Phil's sealed "for when this becomes yours" letter — seeded for the two
  // older kids: Alex (approaching majority, so it shows SEALED in the handoff
  // demo) and Haley (past majority, so it shows UNLOCKED in her adult-account
  // view). Luke is too young to need one yet.
  if (kid.firstName === "Haley" || kid.firstName === "Alex") {
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      content: `${kid.firstName}. The day you read this is the day this is yours. We started this fund when you were small because we knew this moment was coming. Not the money, the moment: you owning something we built together over years. Whatever you do with it, do it on purpose. We love you. Always, Dad`,
      type: "parent_letter",
      authorRole: "parent",
      authorName: "Phil Dunphy",
      visibility: "kid_at_18",
    } as any);
    // (Balance-crossing milestones are now seeded data-driven from the
    // actual snapshot curve for EVERY kid — see seedMilestonesFromSnapshots
    // after the history generation below — rather than hardcoded here.)
  }

  // Claire (co-parent) authored note. Phil owns the fund, but Claire is an
  // accepted co-parent collaborator (wired in main()) — so the demo should show
  // BOTH parents engaging, not just Phil. A parent_note authored by Claire puts
  // a "from Mom" entry in the timeline next to Phil's, making the co-parent
  // relationship lived-in (active author, not just a name on the access list).
  // Dated ~4 months back so it sits naturally in the recent timeline.
  {
    const claireNoteDate = new Date();
    claireNoteDate.setDate(claireNoteDate.getDate() - 120);
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      type: "parent_note",
      content: `Watching you grow up, ${kid.firstName}. Every name in here is someone who loves you. I add my own notes too, so when you read this one day you'll know your mom was paying attention the whole time. — Mom`,
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

  // ── Lived-in lifecycle: strategy evolution + real occasions ──
  // Strategy evolution. A real UTMA shifts allocation as the child ages
  // toward majority (the product itself nudges this). kid.strategy is the
  // CURRENT/latest mix; backfill the earlier shifts as dated activity rows so
  // the Activity timeline shows the fund being managed across the years
  // (Growth → Balanced → Conservative).
  const bday = new Date(kid.birthdate);
  const atAge = (years: number) => { const d = new Date(bday); d.setFullYear(d.getFullYear() + years); return d; };
  const STRATEGY_LABEL: Record<string, string> = { growth: "Growth Mix", balanced: "Steady & Balanced", conservative: "Conservative Mix" };
  const STRATEGY_ORDER: Record<string, number> = { growth: 0, balanced: 1, conservative: 2 };
  const currentOrder = STRATEGY_ORDER[kid.strategy] ?? 0;
  for (const s of [{ at: 13, from: "growth", to: "balanced" }, { at: 16, from: "balanced", to: "conservative" }]) {
    // Emit a shift only if the kid has reached that age AND their current
    // strategy is at-or-past the shift's target (so the history leads to the
    // present mix, not past it).
    if (kid.ageYears >= s.at && currentOrder >= STRATEGY_ORDER[s.to]) {
      await db.insert(activities).values({
        userId: parentUserId,
        fundId: fund.id,
        type: "fund_strategy_changed",
        title: "Strategy changed",
        description: `${STRATEGY_LABEL[s.from]} → ${STRATEGY_LABEL[s.to]}`,
        createdAt: atAge(s.at),
        metadata: JSON.stringify({ from: s.from, to: s.to, reason: "age_band" }),
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
  // Post-handoff (graduated) kids own a self-directed account now, so a
  // "College Fund" general page reads as stale (and Kiddo isn't college-
  // restricted regardless). Name their general page "{name}'s Fund"; pre-
  // majority kids keep the familiar "College Fund" framing gifters relate to.
  const isGraduated = kid.ageYears >= kid.majorityAge;
  const occasions: Array<{ name: string; slug: string; eventType: string; eventDate: Date | null; goalAmount: number | null }> = [
    { name: `${kid.firstName}'s ${ordinal(nextBirthdayAge)} Birthday`, slug: `${kid.slug}-bday-${nextBirthday.getUTCFullYear()}`, eventType: "birthday", eventDate: nextBirthday, goalAmount: null },
    { name: isGraduated ? `${kid.firstName}'s Fund` : `${kid.firstName}'s College Fund`, slug: isGraduated ? `${kid.slug}-fund` : `${kid.slug}-college`, eventType: "general", eventDate: null, goalAmount: kid.ageYears >= 18 ? 30000 : 40000 },
  ];
  if (kid.ageYears < 18) {
    occasions.push({ name: `${kid.firstName}'s Graduation`, slug: `${kid.slug}-graduation`, eventType: "graduation", eventDate: new Date(Date.UTC(bday.getUTCFullYear() + 18, 5, 1, 12)), goalAmount: null });
  }
  for (const o of occasions) {
    await db.insert(events).values({
      fundId: fund.id,
      userId: parentUserId,
      name: o.name,
      slug: o.slug,
      eventType: o.eventType,
      eventDate: o.eventDate,
      goalAmount: o.goalAmount != null ? o.goalAmount.toFixed(2) : null,
      status: "active",
    } as any);
  }

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

  // Balance-crossing milestones, data-driven from the curve just generated.
  await seedMilestonesFromSnapshots(fund.id, kid.firstName);

  return fund.id;
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
  const note: Record<number, string> = {
    5000: "Started small; grew through every birthday, holiday, and gift from the people who showed up.",
    10000: "Five figures now — compounding doing the quiet work.",
    15000: "Past the halfway mark; from here it's mostly the market.",
    20000: "A real head start. The kind that changes the options in front of a kid.",
    25000: "Two decades of showing up, compounded.",
  };
  for (const threshold of [5000, 10000, 15000, 20000, 25000]) {
    if (finalVal < threshold) break;
    const crossing = snaps.find((s) => parseFloat(String(s.totalValue || "0")) >= threshold);
    if (!crossing) continue;
    await db.insert(memoryEntries).values({
      fundId,
      content: `${childFirst}'s fund crossed $${threshold.toLocaleString("en-US")}. ${note[threshold] || ""}`.trim(),
      type: "milestone",
      authorRole: "parent",
      authorName: "Phil Dunphy",
      visibility: "kid_now",
      createdAt: new Date(crossing.snapshotDate as any),
    } as any);
  }
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

  // Value model: ONE calendar-driven market index shared by every fund, with
  // each contribution compounding from its own date. The market % over any
  // period is then identical across kids (only the lifetime total differs,
  // because older funds compounded longer). This replaces the old "scale a
  // gift-inclusive monthly path" approach, which smeared mid-month gifts across
  // the interpolation, baked phantom growth onto just-arrived gifts, and let
  // the per-fund market drift apart (one fund could show a negative 30-day
  // market while another showed positive over the SAME period). Now:
  //   value(t) = scale x sum over gifts landed by t of [gift x M(t) / M(date)]
  //   basis(t) = (cumulative contributions by t) x finalCostBasis / total gifts
  // so value = stepped contributions + compounding market, a gift adds ~its
  // face value on its date (no phantom growth), and the market arc is uniform.

  // Cumulative monthly market index from the first gift's month to now (M = 1
  // at the start). Calendar-keyed, so it's the SAME curve for every fund.
  const startMonthIdx = startDate.getFullYear() * 12 + startDate.getMonth();
  const nowMonthIdx = today.getFullYear() * 12 + today.getMonth();
  const indexByMonth = new Map<number, number>();
  indexByMonth.set(startMonthIdx, 1);
  let marketAcc = 1;
  for (let m = startMonthIdx + 1; m <= nowMonthIdx; m++) {
    marketAcc *= 1 + monthKeyToReturn(Math.floor(m / 12), m % 12);
    indexByMonth.set(m, marketAcc);
  }
  // Market index at any date, prorated linearly within its month.
  const marketIndexAt = (d: Date): number => {
    const mIdx = d.getFullYear() * 12 + d.getMonth();
    if (mIdx <= startMonthIdx) return 1;
    const prev = indexByMonth.get(mIdx - 1) ?? marketAcc;
    const cur = indexByMonth.get(mIdx) ?? marketAcc;
    const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return prev + (cur - prev) * ((d.getDate() - 1) / dim);
  };

  // Pre-resolve each gift's amount + the market index at its date (ascending).
  const giftCompounding = sortedGifts.map((g) => {
    const gd = new Date(g.createdAt);
    return { t: gd.getTime(), amount: g.amount, idxAtGift: Math.max(marketIndexAt(gd), 1e-9) };
  });
  const totalRawGifts = giftCompounding.reduce((s, g) => s + g.amount, 0);

  // Raw compounded value: each gift grows by the market-index ratio from its
  // date to t. Raw cumulative basis: sum of gift face amounts landed by t.
  const rawValueAt = (t: number): number => {
    const mNow = marketIndexAt(new Date(t));
    let v = 0;
    for (const g of giftCompounding) {
      if (g.t <= t) v += g.amount * (mNow / g.idxAtGift);
      else break;
    }
    return v;
  };
  const rawBasisAt = (t: number): number => {
    let c = 0;
    for (const g of giftCompounding) {
      if (g.t <= t) c += g.amount;
      else break;
    }
    return c;
  };

  // Scale so today lands exactly on the seeded balance (one multiplier, so the
  // market shape is preserved); basis scales independently to finalCostBasis.
  const rawNow = rawValueAt(today.getTime());
  const valueScale = rawNow > 0 ? finalInvestedValue / rawNow : 1;
  const basisFactor = totalRawGifts > 0 ? finalCostBasis / totalRawGifts : 1;

  // One snapshot at any date. Deterministic daily wobble (no Math.random, so it
  // reproduces on every reset) applied to the GAIN only, so contributions never
  // wobble and value stays >= basis whenever the fund is genuinely up.
  const snapshotAt = (d: Date): { date: Date; total: number; basis: number } => {
    const t = d.getTime();
    const basis = rawBasisAt(t) * basisFactor;
    const gain = rawValueAt(t) * valueScale - basis;
    const dayIdx = Math.floor(t / 86_400_000);
    const wobble = 0.004 * Math.sin(dayIdx * 0.41) + 0.0025 * Math.cos(dayIdx * 1.13);
    return { date: new Date(d), total: basis + gain * (1 + wobble), basis };
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
  // Custodian's preferred display name ("Dad") — stamped onto each recurring
  // contribution's activity so the post-handoff owner view can credit "Dad
  // added $X" instead of the custodial-era "You contributed".
  const philDisplayName = ACCOUNTS.find((a) => a.role === "parent")?.preferredName || "Dad";
  const seededFundIds: string[] = [];
  for (const kid of KIDS) {
    const fundId = await seedKidFund(philId, kid, philDisplayName);
    seededFundIds.push(fundId);
    console.log(`  fund: ${kid.firstName}'s Fund (${kid.slug}) → ${fundId}`);
  }

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
    const transferredAt = new Date();
    await db.update(funds).set({
      userId: haleyUserId,
      previousOwnerId: philId,
      transferredAt,
      kidWelcomeCompletedAt: transferredAt,
    }).where(eq(funds.id, haleyFundId));
    await db.insert(ageTransitions).values({
      fundId: haleyFundId,
      childClaimedByUserId: haleyUserId,
      childClaimedAt: transferredAt,
      ownershipTransferredAt: transferredAt,
      ownershipTransferredByUserId: haleyUserId,
      formerCustodianUserId: philId,
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
    // Mirror the parent-side row too, so Phil's previous-owner view shows the handoff.
    await db.insert(activities).values({
      userId: haleyUserId,
      fundId: haleyFundId,
      type: "age18_handoff_completed_child",
      title: "Your fund is now yours",
      description: "Kiddo ownership transfer complete. Your fund now lives in your own account.",
      createdAt: transferredAt,
    } as any);
    await db.insert(activities).values({
      userId: philId,
      fundId: haleyFundId,
      type: "age18_handoff_completed_parent",
      title: "Age-18 handoff completed",
      description: "Haley now owns this fund in Kiddo.",
      createdAt: transferredAt,
    } as any);
    console.log(`  handoff: Haley's fund → haley@dunphyfamily.com (graduated adult account; Phil is previous owner)`);
  }

  // 3c. Seed a connected bank for the recurring-setup demo. Recurring pulls
  //     from a linked bank for EVERYONE (parent + owner), and the setup modal
  //     disables "Continue" with no bank. Without this, "Set up recurring" /
  //     "+ Add another" dead-ends at the bank step in the demo — for Phil
  //     (parent) AND Haley (graduated owner). Demo money is mocked, so this is
  //     an illustrative connected account, not a real ACH source.
  for (const [label, uid] of [["phil", philId], ["haley", haleyUserId]] as const) {
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

  // 4. Wire Claire as co-parent on the pre-handoff funds (Alex + Luke).
  //    Haley's fund transferred to her at majority, so co-parent access there
  //    ended with the handoff — a graduated adult owns it solo. Without this,
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
      if (fundId === haleyFundId) continue; // transferred to Haley at majority; co-parent access ended
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
    console.log(`  collaborator: claire@dunphyfamily.com → co-parent on ${seededFundIds.filter((id) => id !== haleyFundId).length} fund(s) (Haley's transferred out)`);
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
