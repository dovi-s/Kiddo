type DashboardMoneyMathGift = {
  status?: string | null;
  amount?: string | number | null;
  netAmount?: string | number | null;
};

type DashboardMoneyMathContribution = {
  totalContributed?: string | number | null;
};

const toMoney = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateDashboardMoneyMath(input: {
  invested: number;
  cash: number;
  settling: number;
  investedCostBasis: number;
  gifts: DashboardMoneyMathGift[];
  parentContributions: DashboardMoneyMathContribution[];
}) {
  const invested = toMoney(input.invested);
  const cash = toMoney(input.cash);
  const settling = toMoney(input.settling);
  const investedCostBasis = toMoney(input.investedCostBasis);

  const investedPrincipal = Math.max(investedCostBasis, invested);
  const countedGiftPrincipal = input.gifts.reduce((sum, gift) => {
    const status = String(gift.status || "").toLowerCase();
    if (["failed", "refunded", "canceled", "cancelled", "expired"].includes(status)) {
      return sum;
    }
    const net = toMoney(gift.netAmount ?? gift.amount);
    return sum + net;
  }, 0);

  const recurringContributionPrincipal = input.parentContributions.reduce((sum, contribution) => {
    return sum + toMoney(contribution.totalContributed);
  }, 0);

  const lifetimeContributionPrincipal =
    countedGiftPrincipal > 0
      ? countedGiftPrincipal
      : recurringContributionPrincipal > 0
        ? recurringContributionPrincipal
        : investedPrincipal + cash + settling;

  const currentFundBasis = investedPrincipal + cash + settling;
  const displayContributionValue =
    lifetimeContributionPrincipal > currentFundBasis + 0.01
      ? currentFundBasis
      : lifetimeContributionPrincipal;

  const contributionLabel =
    lifetimeContributionPrincipal > currentFundBasis + 0.01
      ? "Net in fund"
      : "Gifts in";

  const totalValue = invested + cash + settling;

  return {
    investedPrincipal,
    countedGiftPrincipal,
    recurringContributionPrincipal,
    lifetimeContributionPrincipal,
    currentFundBasis,
    displayContributionValue,
    contributionLabel,
    totalValue,
    uninvestedCash: cash + settling,
    totalReturnVsPrincipal: totalValue - currentFundBasis,
    // Parent-mental-model growth: "the fund is worth $X, you gave $Y, so
    // it grew by $X − $Y." Used by the headline "Growth" stat and the
    // hero gain badge — both surfaces face parents who don't think in
    // cost basis. Cost-basis return (above) is preserved for audit /
    // tax-time / brokerage views where lots-and-basis matter. The two
    // numbers can diverge when sales-and-reinvestments inflate cost
    // basis (or when test data does the same), so the parent-facing
    // value should always be the contribution-relative one.
    totalReturnVsContributions: totalValue - lifetimeContributionPrincipal,
  };
}
