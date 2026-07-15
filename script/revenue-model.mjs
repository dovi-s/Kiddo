/* eslint-disable no-console */
//
// Kiddo revenue model — a TRANSPARENT calculator, NOT a forecast.
//
// The point (per UNIT_ECONOMICS.md): per-fund revenue is NOT a flat $60 sub. It is
// max(subscription, AUM) per fund (the "one meter" / greater-of rule from
// ONE_METER_FEE_DECISION.md), and it RISES over a fund's life as the balance
// compounds and crosses the AUM>sub line. So total revenue depends on the BALANCE
// DISTRIBUTION (how mature the cohort is), not just the headcount. This script makes
// that visible: set the inputs, see rev/ARPU fall out, and see the sub->AUM mix shift
// as funds mature.
//
// Nothing here is a promise. Every input is an assumption you set. Run:
//   node script/revenue-model.mjs
//
// ---------------------------------------------------------------------------
// INPUTS YOU SET (edit these)
// ---------------------------------------------------------------------------

const SUB_ARPU = 60;        // blended paying-fund subscription $/yr (Plus $29 / Family $59 + add-ons)
const AUM_RATE = 0.0010;    // 0.10% platform fee today (pre-RIA)
const AUM_RATE_RIA = 0.0025; // ~0.25% advisory fee AFTER you own an RIA (the post-custody upgrade)

// Adult-LTV layer (the real $1B line): a kid kept past 18 = an adult financial
// customer acquired at ~$0 CAC. Set how many you model + their yearly value.
const ADULT_ARPU = 170;     // investing + banking $/yr per retained adult (UNIT_ECONOMICS illustrative)

// Balance distributions by cohort maturity. Each band = [share of funds, avg invested $].
// These are ILLUSTRATIVE shapes, not data. Edit freely. Shares must sum to ~1.
const COHORTS = {
  "Young (avg fund ~2yr old)": [
    [0.90, 1000],
    [0.09, 5000],
    [0.01, 15000],
  ],
  "Maturing (~8yr old)": [
    [0.40, 3000],
    [0.35, 12000],
    [0.20, 30000],
    [0.05, 60000],
  ],
  "Mature (~15yr / near-handoff)": [
    [0.15, 5000],
    [0.25, 20000],
    [0.35, 50000],
    [0.20, 100000],
    [0.05, 200000],
  ],
};

const PAYING_FUND_COUNTS = [10_000, 100_000, 1_000_000];

// ---------------------------------------------------------------------------
// MODEL
// ---------------------------------------------------------------------------

const usd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Per-fund annual revenue under the greater-of rule: a fund pays its subscription OR
// its AUM fee, whichever is larger, never both.
function perFundRevenue(balance, subArpu, aumRate) {
  const aum = balance * aumRate;
  return { fee: Math.max(subArpu, aum), billedAs: aum > subArpu ? "AUM" : "SUB" };
}

function modelCohort(bands, count, subArpu, aumRate) {
  let total = 0;
  let aumFunds = 0;
  let aumRev = 0;
  let subRev = 0;
  for (const [share, balance] of bands) {
    const funds = count * share;
    const { fee, billedAs } = perFundRevenue(balance, subArpu, aumRate);
    total += funds * fee;
    if (billedAs === "AUM") {
      aumFunds += funds;
      aumRev += funds * fee;
    } else {
      subRev += funds * fee;
    }
  }
  return { total, arpu: total / count, aumFunds, aumShare: aumFunds / count, aumRev, subRev };
}

console.log("=".repeat(78));
console.log("KIDDO REVENUE MODEL  (illustrative calculator, not a forecast)");
console.log(`greater-of rule: each fund pays MAX(sub $${SUB_ARPU}/yr, balance x ${(AUM_RATE * 100).toFixed(2)}%)`);
console.log("=".repeat(78));

for (const [cohortName, bands] of Object.entries(COHORTS)) {
  console.log(`\n### ${cohortName}`);
  // ARPU is independent of count, so show the per-fund economics once.
  const sample = modelCohort(bands, 1, SUB_ARPU, AUM_RATE);
  console.log(
    `  blended ARPU: ${usd(sample.arpu)}/yr/fund   |   ` +
    `${(sample.aumShare * 100).toFixed(0)}% of funds now billed on AUM (crossed the sub line)`,
  );
  console.log("  Platform revenue (sub + AUM via greater-of), pre-RIA 0.10%:");
  for (const count of PAYING_FUND_COUNTS) {
    const r = modelCohort(bands, count, SUB_ARPU, AUM_RATE);
    console.log(
      `    ${count.toLocaleString().padStart(9)} funds -> ${usd(r.total).padStart(14)}` +
      `   (sub ${usd(r.subRev)} + AUM ${usd(r.aumRev)})`,
    );
  }
  // Post-RIA upgrade on the mature cohort is where the advisory rate really bites.
  const ria = modelCohort(bands, 1_000_000, SUB_ARPU, AUM_RATE_RIA);
  console.log(
    `  Post-RIA upgrade @ ${(AUM_RATE_RIA * 100).toFixed(2)}% (1M funds): ` +
    `${usd(ria.total)}  (vs ${usd(modelCohort(bands, 1_000_000, SUB_ARPU, AUM_RATE).total)} at 0.10%)`,
  );
}

console.log("\n" + "=".repeat(78));
console.log("THE LINE THE SUB-ARR NUMBER HIDES: adult LTV (the $1B engine)");
console.log("=".repeat(78));
console.log(`A retained adult ~ ${usd(ADULT_ARPU)}/yr, acquired at ~$0 CAC (grandma paid it in gifts).`);
for (const base of [1_000_000, 10_000_000]) {
  for (const ret of [0.4, 0.6]) {
    const adults = base * ret;
    console.log(
      `  ${base.toLocaleString().padStart(11)} lifetime funds x ${(ret * 100).toFixed(0)}% kept at 18 ` +
      `= ${adults.toLocaleString().padStart(9)} adults -> ${usd(adults * ADULT_ARPU)}/yr adult LTV`,
    );
  }
}

console.log("\n" + "-".repeat(78));
console.log("READS:");
console.log("- Young cohort ARPU is ~the sub, because balances are tiny. This is the");
console.log("  '10k users = $600k' regime. It is the FLOOR, not the business.");
console.log("- As a cohort matures, funds cross the sub line and AUM takes over: ARPU");
console.log("  RISES with no new signups. Same families, more revenue, because the");
console.log("  asset compounded. That is the annuity the sub-ARR number cannot see.");
console.log("- The adult-LTV line dwarfs both once retention holds. Measure funded-k,");
console.log("  balance growth, and retention-at-18 — not sub ARR.");
console.log("- Performance/earnings fees are OFF THE TABLE (advisory + qualified-client");
console.log("  rule); charge on BALANCE only. The 0.25% line needs an RIA (post-custody).");
console.log("-".repeat(78));
