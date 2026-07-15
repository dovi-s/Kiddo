/* eslint-disable no-console */
// Guard test for shared/activity-semantics.ts — the single source of truth for
// what an activity event is CALLED and which filter bucket it lands in.
//
// This exists because the activity label taxonomy had previously drifted into
// four disagreeing copies (feed / modal / detail page / mobile). The shared
// module fixed that; this test LOCKS it so the drift can't silently return:
//   - canonical wording for a representative set of types is pinned
//   - every type in the filter buckets resolves to a non-null label
//   - category bucketing stays correct
//   - the gifter_recurring_* bug fix (mislabeled "Gift received") stays fixed
//
// Pure — no server, no DB. Runs in the test:all:runtime sequence and standalone.

import process from "node:process";
import {
  canonicalLabel,
  mapActivityTypeToCategory,
  mapItemToCategory,
  isParentContributionItem,
  GIFT_TYPES,
  AUTO_TYPES,
  GROWTH_TYPES,
  ENGINE_MILESTONE_TYPES,
  MILESTONE_TYPES,
} from "../shared/activity-semantics";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}\n       expected ${e}\n       got      ${a}`);
  }
}
function checkTruthy(name: string, actual: unknown) {
  if (actual) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name} — expected truthy, got ${JSON.stringify(actual)}`);
  }
}

console.log("\nactivity-semantics: canonical labels (pinned wording)");
// These are the cross-surface contract. Changing one is a deliberate product
// decision — update it here AND everywhere it renders, on purpose.
const LABELS: Array<[string, string]> = [
  ["gift_received", "Gift received"],
  ["gift_invested", "Gift invested"],
  ["gift_received_cash", "Gift held as cash"],
  ["large_gift_hold_started", "Gift on hold"],
  ["large_gift_hold_released", "Gift released"],
  ["refund", "Refund"],
  ["auto_invest", "Recurring investment"],
  ["parent_contribution", "Contribution"],
  ["parent_contribution_failed", "Charge failed"],
  ["recurring_request", "Recurring request"],
  ["sell", "Portfolio"],
  ["withdrawal", "Withdrawal"],
  ["cash_invested", "Cash invested"],
  ["bank_linked", "Bank linked"],
  ["bank_unlinked", "Bank removed"],
  ["kyc_approved", "Identity verified"],
  ["subscription_started", "Subscription"],
  ["subscription_renewal", "Renewed"],
  ["subscription_canceled", "Subscription ended"],
  ["payment_failed", "Payment failed"],
  ["fund_strategy_changed", "Strategy"],
  ["custom_allocations_changed", "Custom mix"],
  ["memory_entry_added", "Memory added"],
  ["memory_entry_edited", "Memory edited"],
  ["milestone_money_cross", "Milestone"],
  ["milestone_anniversary", "Anniversary"],
  ["age18_child_claimed", "Fund handed off"],
  ["successor_custodian_added", "Successor custodian"],
];
for (const [type, label] of LABELS) check(`canonicalLabel(${type})`, canonicalLabel(type), label);

console.log("\nactivity-semantics: gifter_recurring_* bug fix (must NOT be 'Gift received')");
// Regression lock: these are members of GIFT_TYPES, and the feed's
// GIFT_TYPES.includes short-circuit used to mislabel them. They must resolve to
// their own labels.
check("canonicalLabel(gifter_recurring_paused)", canonicalLabel("gifter_recurring_paused"), "Gifter paused recurring");
check("canonicalLabel(gifter_recurring_resumed)", canonicalLabel("gifter_recurring_resumed"), "Gifter resumed recurring");
check("canonicalLabel(gifter_recurring_cancelled)", canonicalLabel("gifter_recurring_cancelled"), "Gifter cancelled recurring");

console.log("\nactivity-semantics: unknown type falls back to null (caller's default)");
check("canonicalLabel(totally_unknown_xyz)", canonicalLabel("totally_unknown_xyz"), null);

console.log("\nactivity-semantics: every bucketed type has a canonical label");
// Catches a new activity type added to a filter bucket without giving it a
// label — the exact way drift creeps back in.
for (const t of [...GIFT_TYPES, ...AUTO_TYPES, ...GROWTH_TYPES, ...ENGINE_MILESTONE_TYPES, ...MILESTONE_TYPES]) {
  checkTruthy(`label exists for ${t}`, canonicalLabel(t));
}

console.log("\nactivity-semantics: category bucketing");
check("category(gift_received)", mapActivityTypeToCategory("gift_received"), "gift");
check("category(gifter_recurring_paused)", mapActivityTypeToCategory("gifter_recurring_paused"), "gift");
check("category(auto_invest)", mapActivityTypeToCategory("auto_invest"), "auto");
check("category(parent_contribution)", mapActivityTypeToCategory("parent_contribution"), "auto");
check("category(sell)", mapActivityTypeToCategory("sell"), "growth");
check("category(fund_strategy_changed)", mapActivityTypeToCategory("fund_strategy_changed"), "growth");
check("category(memory_entry_added)", mapActivityTypeToCategory("memory_entry_added"), "memory");
check("category(milestone_money_cross)", mapActivityTypeToCategory("milestone_money_cross"), "milestone");
check("category(age18_child_claimed)", mapActivityTypeToCategory("age18_child_claimed"), "milestone");
check("category(lifecycle_no_gift_14d)", mapActivityTypeToCategory("lifecycle_no_gift_14d"), "nudge");
check("category(totally_unknown_xyz)", mapActivityTypeToCategory("totally_unknown_xyz"), "update");

console.log("\nactivity-semantics: parent one-time gift (gift_received + metadata flag) buckets to 'auto'");
check(
  "isParentContributionItem(metadata flag)",
  isParentContributionItem({ metadata: JSON.stringify({ isParentContribution: true }) }),
  true,
);
check(
  "mapItemToCategory(parent gift_received) -> auto",
  mapItemToCategory({ type: "gift_received", metadata: JSON.stringify({ isParentContribution: true }) }),
  "auto",
);
check(
  "mapItemToCategory(real gift_received) -> gift",
  mapItemToCategory({ type: "gift_received", metadata: JSON.stringify({}) }),
  "gift",
);

if (failures > 0) {
  console.error(`\nactivity-semantics: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nactivity-semantics: all assertions passed.");
