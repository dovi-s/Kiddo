export type SellQuickAmountOption = {
  label: string;
  amount: number;
  isAll?: boolean;
};

export function buildSellDollarQuickAmountOptions(maxValue: number): SellQuickAmountOption[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [];

  const roundedMax = Math.round(maxValue);
  const seen = new Set<number>();
  const options: SellQuickAmountOption[] = [];

  for (const preset of [25, 50, 100]) {
    if (preset >= maxValue || seen.has(preset)) continue;
    seen.add(preset);
    options.push({
      label: `$${preset}`,
      amount: preset,
    });
  }

  const fullAmount = Number(maxValue.toFixed(2));
  if (!seen.has(roundedMax) || Math.abs(fullAmount - roundedMax) > 0.0001) {
    options.push({
      label: "All",
      amount: fullAmount,
      isAll: true,
    });
  } else {
    options.push({
      label: "All",
      amount: fullAmount,
      isAll: true,
    });
  }

  return options.slice(0, 4);
}
