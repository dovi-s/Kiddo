// Single source of truth for converting recurring-schedule frequencies to a
// monthly equivalent. Multiple places used to do this inline with two
// different week-to-month factors (4.333 vs 4.345), so the same set of
// schedules rendered as $725 in one place and $727 in another. This lives in
// shared/ so the server worker (lifecycle nudges) and every client surface
// (Dashboard summary, hero projection, Projection page, explainer dialog)
// agree.
//
// Conversion choices:
//   - WEEKS_PER_MONTH = 4.348 (≈ 52.1786 / 12) — accurate for a 365.25-day
//     year, which averages out leap years. Beats the rough 52/12 = 4.333
//     which assumes a 364-day year and silently understates weekly
//     contributions by ~1.5%.
//   - DAYS_PER_MONTH = 30.4375 (= 365.25/12) — same reasoning.
//   - yearly is divided by 12 (no surprises).

export const WEEKS_PER_MONTH = 4.348;
export const DAYS_PER_MONTH = 30.4375;

export type RecurringFrequency = "monthly" | "weekly" | "daily" | "yearly" | "annual" | "annually" | string | null | undefined;

// Convert a single schedule's amount + frequency into a monthly-equivalent
// dollar amount. Falls back to "monthly" for unknown frequencies (matches the
// historical default and covers any future row whose freq column is null).
export function toMonthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (String(frequency || "monthly").toLowerCase()) {
    case "daily":
      return amount * DAYS_PER_MONTH;
    case "weekly":
      return amount * WEEKS_PER_MONTH;
    case "yearly":
    case "annual":
    case "annually":
      return amount / 12;
    case "monthly":
    default:
      return amount;
  }
}

// Above this monthly-equivalent, a recurring contribution is almost certainly a
// fat-finger — most often a DAILY amount typed as if it were the monthly amount
// (daily multiplies by ~30.4). Left unchecked, the projection honestly compounds
// it into an absurd "potential" (e.g. $10k/day = ~$304k/mo = ~$34M at 21), which
// reads as broken to a demo visitor at peak intent. We stop the plan from saving
// above this ceiling. Tune it up if a genuine high-contribution case appears.
export const MAX_PLAUSIBLE_MONTHLY_CONTRIBUTION = 10000;

// Given a per-deposit amount + frequency, report whether the implied monthly
// contribution crosses the plausibility ceiling, and the monthly figure itself
// (so the caller can show "that's ~$X/month"). ONE place so the client guard and
// any future server-side check agree.
export function checkRecurringPlausibility(
  amount: number,
  frequency: RecurringFrequency,
): { ok: boolean; monthlyEquivalent: number } {
  const monthlyEquivalent = toMonthlyEquivalent(amount, frequency);
  return { ok: monthlyEquivalent <= MAX_PLAUSIBLE_MONTHLY_CONTRIBUTION, monthlyEquivalent };
}

// Sum a list of schedules into a single monthly-equivalent total. Filter to
// active schedules at the call site — this helper doesn't know which
// statuses count.
export function sumMonthlyEquivalent(
  rows: Array<{ amount: string | number | null | undefined; frequency: RecurringFrequency } | null | undefined>,
): number {
  let total = 0;
  for (const row of rows) {
    if (!row) continue;
    const amt = typeof row.amount === "number" ? row.amount : parseFloat(String(row.amount ?? "0"));
    total += toMonthlyEquivalent(amt, row.frequency);
  }
  return total;
}
