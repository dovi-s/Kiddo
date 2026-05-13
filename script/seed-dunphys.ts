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
  type InsertGift,
  type InsertMemoryEntry,
} from "../shared/schema";
import { eq, and } from "drizzle-orm";

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

// Gift histories per kid. Calibrated to land at the spec's stated
// balances (Haley ~$12,847 / Alex ~$8,234 / Luke ~$3,421) plus realistic
// gifter mix. Each entry: senderName, senderEmail, amount, note, when.
// Cam gives Disney to all three kids — the locked "love mark" detail.
function giftsForKid(kid: { firstName: string }) {
  const N = (yearsAgo: number, monthsAgo = 0): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - yearsAgo);
    d.setMonth(d.getMonth() - monthsAgo);
    return d.toISOString();
  };
  const base: Array<{
    senderName: string;
    senderEmail: string;
    amount: number;
    selectedTicker?: string;
    message?: string;
    createdAt: string;
  }> = [
    // Jay (grandpa) - large gifts, mostly Google
    { senderName: "Jay Pritchett",      senderEmail: "jay@dunphyfamily.com",      amount: 500, selectedTicker: "GOOGL", message: `Happy birthday, ${kid.firstName}. From your Grandpa Jay.`, createdAt: N(0, 4) },
    { senderName: "Jay Pritchett",      senderEmail: "jay@dunphyfamily.com",      amount: 500, selectedTicker: "GOOGL", message: `Merry Christmas, ${kid.firstName}.`, createdAt: N(1, 1) },
    // Gloria (grandma) - voice notes (placeholder; production gets a voice actor)
    { senderName: "Gloria Pritchett",   senderEmail: "gloria@dunphyfamily.com",   amount: 250, selectedTicker: "DIS",   message: `Mi amor, never forget your familia. Te amo, ${kid.firstName}.`, createdAt: N(0, 4) },
    { senderName: "Gloria Pritchett",   senderEmail: "gloria@dunphyfamily.com",   amount: 250, selectedTicker: "DIS",   message: `Para ti, ${kid.firstName}. Con todo mi amor.`, createdAt: N(1, 0) },
    // Mitchell (uncle) - recurring annual gifts in Apple
    { senderName: "Mitchell Pritchett", senderEmail: "mitchell@dunphyfamily.com", amount: 100, selectedTicker: "AAPL",  message: `Happy birthday, ${kid.firstName}.`, createdAt: N(0, 4) },
    { senderName: "Mitchell Pritchett", senderEmail: "mitchell@dunphyfamily.com", amount: 100, selectedTicker: "AAPL",  message: `Happy birthday, ${kid.firstName}. — Uncle Mitch`, createdAt: N(1, 4) },
    { senderName: "Mitchell Pritchett", senderEmail: "mitchell@dunphyfamily.com", amount: 100, selectedTicker: "AAPL",  message: `Happy birthday!`, createdAt: N(2, 4) },
    // Cameron (uncle) - Disney stock to all three kids. The love mark.
    { senderName: "Cameron Tucker",     senderEmail: "cameron@dunphyfamily.com",  amount: 200, selectedTicker: "DIS",   message: "Because magic is always a good investment. — Cam", createdAt: N(0, 6) },
    { senderName: "Cameron Tucker",     senderEmail: "cameron@dunphyfamily.com",  amount: 150, selectedTicker: "DIS",   message: `For ${kid.firstName} — one day you'll work for Disney, kid. Or own it. — Cam`, createdAt: N(1, 6) },
    // Manny (cousin) - small, young-gifter angle
    { senderName: "Manny Delgado",      senderEmail: "manny@dunphyfamily.com",    amount: 50,  selectedTicker: "RBLX",  message: `From Manny. I bought you Roblox. You're welcome.`, createdAt: N(0, 2) },
    // Phil himself (recurring monthly seed)
    { senderName: "Phil Dunphy",        senderEmail: "phil@dunphyfamily.com",     amount: 50,  selectedTicker: undefined, message: "Monthly add from Dad.", createdAt: N(0, 1) },
    { senderName: "Phil Dunphy",        senderEmail: "phil@dunphyfamily.com",     amount: 50,  selectedTicker: undefined, message: "Monthly add from Dad.", createdAt: N(0, 2) },
    { senderName: "Phil Dunphy",        senderEmail: "phil@dunphyfamily.com",     amount: 50,  selectedTicker: undefined, message: "Monthly add from Dad.", createdAt: N(0, 3) },
    // Claire (co-parent additions)
    { senderName: "Claire Dunphy",      senderEmail: "claire@dunphyfamily.com",   amount: 100, selectedTicker: undefined, message: `From Mom. ❤`, createdAt: N(0, 5) },
  ];
  return base;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function upsertUser(account: typeof ACCOUNTS[number]): Promise<string> {
  // Check for existing by email. If found, update flags + return id.
  const [existing] = await db.select().from(users).where(eq(users.email, account.email)).limit(1);
  if (existing) {
    await db.update(users).set({
      isDemoAccount: true,
      firstName: account.firstName,
      lastName: account.lastName,
      preferredName: account.preferredName,
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
  }).returning();
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

  // Aggregate balance from holdings as the starting "balance" field.
  // The Dashboard money-math reconciliation will recompute from gifts
  // + holdings on next load, so seeding a precise balance here is for
  // first-render only.
  const investedValue = kid.holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const costBasis = kid.holdings.reduce((sum, h) => sum + h.costBasis, 0);

  const [fund] = await db.insert(funds).values({
    userId: parentUserId,
    recipientFirstName: kid.firstName,
    recipientLastName: kid.lastName,
    recipientBirthdate: kid.birthdate,
    pronoun: kid.pronoun,
    state: kid.state,
    majorityAge: kid.majorityAge,
    name: `${kid.firstName}'s Fund`,
    slug: kid.slug,
    description: kid.description,
    accountType: "utma",
    status: "active",
    strategy: kid.strategy,
    balance: investedValue.toFixed(2),
    cashBalance: "0.00",
    pendingBalance: "0.00",
    contributorCount: 0, // recomputed below from inserted gifts
  } as any).returning();

  // Seed holdings.
  for (const h of kid.holdings) {
    await db.insert(holdings).values({
      fundId: fund.id,
      ticker: h.ticker,
      shares: h.shares.toFixed(6),
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

  // Seed gifts.
  const giftList = giftsForKid(kid);
  const sendersSeen = new Set<string>();
  for (const g of giftList) {
    const isGloria = g.senderEmail === "gloria@dunphyfamily.com";
    const giftRow: InsertGift = {
      fundId: fund.id,
      senderName: g.senderName,
      senderEmail: g.senderEmail,
      amount: g.amount.toFixed(2),
      netAmount: g.amount.toFixed(2),
      status: "invested",
      message: g.message ?? null,
      selectedTicker: g.selectedTicker ?? null,
      audioUrl: isGloria ? gloriaAudioUrl : null,
      createdAt: new Date(g.createdAt),
    } as any;
    await db.insert(gifts).values(giftRow as any);
    sendersSeen.add(g.senderEmail.toLowerCase());
  }

  // Update contributor count from unique senders.
  await db.update(funds)
    .set({ contributorCount: sendersSeen.size })
    .where(eq(funds.id, fund.id));

  // Seed a couple of Memory Book entries: Cam's Disney note (the love
  // mark), Gloria's voice memo (audio when DEMO_AUDIO_ENABLED is set,
  // text-only otherwise), plus a parent-authored note from Phil.
  const camGiftId = (await db.select({ id: gifts.id })
    .from(gifts)
    .where(and(eq(gifts.fundId, fund.id), eq(gifts.senderEmail, "cameron@dunphyfamily.com")))
    .limit(1))[0]?.id;
  if (camGiftId) {
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      content: "Cam gave Disney stock to all three Dunphy kids. \"Because magic is always a good investment.\"",
      type: "gift",
      authorRole: "gifter",
      authorName: "Cameron Tucker",
      visibility: "kid_now",
      giftId: camGiftId,
    } as any);
  }

  // Gloria's voice memo. Links to her most-recent gift for the kid.
  const gloriaGiftId = (await db.select({ id: gifts.id })
    .from(gifts)
    .where(and(eq(gifts.fundId, fund.id), eq(gifts.senderEmail, "gloria@dunphyfamily.com")))
    .limit(1))[0]?.id;
  if (gloriaGiftId) {
    await db.insert(memoryEntries).values({
      fundId: fund.id,
      content: `Para ti, ${kid.firstName}. Con todo mi amor. — Abuela`,
      type: "gift",
      authorRole: "gifter",
      authorName: "Gloria Pritchett",
      visibility: "kid_now",
      giftId: gloriaGiftId,
      audioUrl: gloriaAudioUrl,
      // Transcript ships with the entry whether audio is wired or not —
      // text version remains useful as the memory itself even when the
      // audio file isn't deployed.
      audioTranscript: audioEnabled
        ? `Mi amor ${kid.firstName}, never forget your familia. Te amo, mi ${kid.pronoun === "she" ? "nieta" : "nieto"}.`
        : null,
    } as any);
  }

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
  }

  // Seed a creation activity.
  await db.insert(activities).values({
    userId: parentUserId,
    fundId: fund.id,
    type: "fund_created",
    title: `${kid.firstName}'s fund created`,
    description: kid.description,
  } as any);

  return fund.id;
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
  for (const kid of KIDS) {
    const fundId = await seedKidFund(philId, kid);
    console.log(`  fund: ${kid.firstName}'s Fund (${kid.slug}) → ${fundId}`);
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
