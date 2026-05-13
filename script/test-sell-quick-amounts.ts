import assert from "node:assert/strict";
import { buildSellDollarQuickAmountOptions } from "../client/src/lib/sell-quick-amounts";

function main() {
  const exactPresetMax = buildSellDollarQuickAmountOptions(100);
  assert.deepEqual(
    exactPresetMax.map((option) => option.label),
    ["$25", "$50", "All"],
    "max value matching a preset should not create a duplicate preset and all option",
  );
  assert.equal(exactPresetMax.at(-1)?.amount, 100);

  const roundedAll = buildSellDollarQuickAmountOptions(83.42);
  assert.deepEqual(
    roundedAll.map((option) => option.label),
    ["$25", "$50", "All"],
    "non-round values should still end with a single All option",
  );
  assert.equal(roundedAll.at(-1)?.amount, 83.42);

  const tinyMax = buildSellDollarQuickAmountOptions(18);
  assert.deepEqual(
    tinyMax.map((option) => option.label),
    ["All"],
    "small positions should only offer All",
  );

  const keys = exactPresetMax.map((option) => `${option.label}-${option.amount}`);
  assert.equal(new Set(keys).size, keys.length, "sell quick amount options should always produce unique keys");

  console.log("Sell quick amount option tests passed.");
}

main();
