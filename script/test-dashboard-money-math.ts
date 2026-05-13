import assert from "node:assert/strict";
import { calculateDashboardMoneyMath } from "../shared/dashboard-money-math";

function main() {
  const withWithdrawalsAndCash = calculateDashboardMoneyMath({
    invested: 150,
    cash: 350,
    settling: 0,
    investedCostBasis: 150,
    gifts: [
      { status: "invested", netAmount: "250.00" },
      { status: "invested", netAmount: "50.00" },
      { status: "invested", netAmount: "100000.00" },
      { status: "failed", netAmount: "25.00" },
    ],
    parentContributions: [],
  });

  assert.equal(withWithdrawalsAndCash.currentFundBasis, 500);
  assert.equal(withWithdrawalsAndCash.displayContributionValue, 500);
  assert.equal(withWithdrawalsAndCash.contributionLabel, "Net in fund");
  assert.equal(withWithdrawalsAndCash.totalReturnVsPrincipal, 0);
  assert.equal(withWithdrawalsAndCash.uninvestedCash, 350);

  const simpleGiftOnly = calculateDashboardMoneyMath({
    invested: 50,
    cash: 0,
    settling: 0,
    investedCostBasis: 50,
    gifts: [{ status: "invested", netAmount: "50.00" }],
    parentContributions: [],
  });

  assert.equal(simpleGiftOnly.currentFundBasis, 50);
  assert.equal(simpleGiftOnly.displayContributionValue, 50);
  assert.equal(simpleGiftOnly.contributionLabel, "Gifts in");

  const contributionFallback = calculateDashboardMoneyMath({
    invested: 25,
    cash: 10,
    settling: 5,
    investedCostBasis: 25,
    gifts: [],
    parentContributions: [{ totalContributed: "40.00" }],
  });

  assert.equal(contributionFallback.currentFundBasis, 40);
  assert.equal(contributionFallback.displayContributionValue, 40);
  assert.equal(contributionFallback.contributionLabel, "Gifts in");
