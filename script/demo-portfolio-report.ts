// Offline (no-DB) report: computes the EMERGENT balance for each demo kid from
// the real historical-price fixture + the gift schedule. Lets us verify and
// tune inputs to the aspirational targets without running Postgres.
//
// Run: `npm run report:demo-portfolio`

import {
  loadPrices,
  buildPortfolio,
  holdingsFromPositions,
  totalValue,
  portfolioValueAt,
  portfolioValueAtDate,
  allocateGift,
  currentPrice,
  monthKey,
  type GiftInput,
} from "./lib/demo-portfolio";
import { giftsForKid, rebalancesForKid, type KidStory } from "./lib/demo-roster";

function birthdateForAge(years: number, monthsBack = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

const KIDS: KidStory[] = [
  { firstName: "Luke", ageYears: 13, birthdate: birthdateForAge(13, 7), recurringAmount: 100, recurringPaused: false, pronoun: "he", majorityAge: 21, strategy: "growth" },
  { firstName: "Alex", ageYears: 20, birthdate: birthdateForAge(20, 11), recurringAmount: 50, recurringPaused: true, pronoun: "she", majorityAge: 21, strategy: "balanced" },
  { firstName: "Haley", ageYears: 22, birthdate: birthdateForAge(22, 4), recurringAmount: 85, recurringPaused: true, pronoun: "she", majorityAge: 21, strategy: "conservative" },
];

const TARGETS: Record<string, number> = { Luke: 22000, Alex: 48000, Haley: 80000 };

const prices = loadPrices();
const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

for (const kid of KIDS) {
  const specs = giftsForKid(kid);
  const gifts: GiftInput[] = specs.map((g) => ({ date: g.createdAt, amount: g.amount, ticker: g.selectedTicker }));
  const rebalances = rebalancesForKid(kid);
  const { positions } = buildPortfolio(prices, gifts, rebalances);
  const holdings = holdingsFromPositions(prices, positions).sort((a, b) => b.currentValue - a.currentValue);
  const total = totalValue(holdings);
  const contributed = gifts.reduce((s, g) => s + g.amount, 0);
  const noteCount = specs.filter((g) => g.message && g.message.trim()).length;
  const senders = new Set(specs.map((g) => g.senderName)).size;
  const target = TARGETS[kid.firstName];

  // Guard: a single-stock PICK must never be a managed-mix ETF (VTI/VXUS/BND).
  // Those are the managed backbone and aren't pickable in the real product; a
  // pick of one manufactures an "impossible" holding the dashboard splits out
  // of the mix confusingly. (See shared/stock-picks.ts.)
  const MANAGED_ETFS = new Set(["VTI", "VXUS", "BND"]);
  const badPicks = specs.filter((g) => g.selectedTicker && MANAGED_ETFS.has(g.selectedTicker));
  if (badPicks.length) {
    console.log(`  ⚠️  ${badPicks.length} managed-ETF PICK(s) — must be managed-only: ${[...new Set(badPicks.map((g) => g.selectedTicker))].join(", ")}`);
  }

  console.log(`\n━━ ${kid.firstName} (age ${kid.ageYears}, ${kid.strategy}) ━━`);
  console.log(`  gifts: ${specs.length}   contributors: ${senders}   with-note: ${noteCount} (${Math.round((noteCount / specs.length) * 100)}%)`);
  console.log(`  contributed: ${fmt(contributed)}   →   value: ${fmt(total)}   (${(total / contributed).toFixed(2)}x)`);
  console.log(`  target: ${fmt(target)}   delta: ${((total / target - 1) * 100).toFixed(0)}%`);
  for (const h of holdings) {
    console.log(`    ${h.ticker.padEnd(6)} ${h.shares.toFixed(3).padStart(10)} sh   basis ${fmt(h.costBasis).padStart(12)}   value ${fmt(h.currentValue).padStart(12)}   ${h.gain >= 0 ? "+" : ""}${fmt(h.gain)}`);
  }

  // Real-drawdown chart check: portfolio value at key months. A REAL curve dips
  // at the 2020 COVID crash and is far below today — proof it's not synthetic.
  if (kid.firstName === "Haley") {
    const events = buildPortfolio(prices, gifts, rebalances).events;
    console.log("  chart check (real portfolio value at month):");
    for (const k of ["2018-01", "2020-01", "2020-03", "2020-08", "2022-09", "2024-01"]) {
      const v = portfolioValueAt(prices, events, k).invested;
      console.log(`    ${k}: ${fmt(v)}`);
    }
    // Recent daily resolution: prove the last several days move day-to-day
    // (real dailies, not a flat-within-month value).
    console.log("  daily check (last 6 weekdays, real day-to-day):");
    const today = new Date();
    for (let i = 8; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i * 4);
      const v = portfolioValueAtDate(prices, events, d).invested;
      console.log(`    ${d.toISOString().slice(0, 10)}: ${fmt(v)}`);
    }
  }

  // Note realism: a few oldest single-stock gifts with their REAL now-value, to
  // eyeball the "$50 in 2009 is now ~$X" wow + that notes are short/unsigned.
  const wow = specs
    .filter((g) => g.selectedTicker && g.kind !== "recurring")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 4);
  for (const g of wow) {
    const p = allocateGift(prices, { date: g.createdAt, amount: g.amount, ticker: g.selectedTicker });
    const now = p.sharesAcquired * currentPrice(prices, g.selectedTicker!);
    const note = g.message ? `"${g.message}"` : "(no note)";
    console.log(`    ${g.createdAt.slice(0, 7)}  ${g.senderName.padEnd(18)} ${fmt(g.amount).padStart(8)} ${g.selectedTicker!.padEnd(5)} → now ${fmt(now).padStart(10)}   ${note}`);
  }
}
console.log();
