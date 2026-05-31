// Safety-invariant tests for the capture-at-intent gifter flow (P0-1).
//
// The flow vaults a gifter's card (Stripe SetupIntent) and charges it
// off-session when the parent later creates the fund. It is flag-gated and
// COUNSEL-PENDING — it must not charge anyone until legal clears. These tests
// don't hit Stripe; they lock the two invariants that keep the flow SAFE while
// it waits to ship:
//
//   1. The flag is HERMETIC. Only explicit truthy env values enable the capture
//      path; everything else (including unset) falls back to the warm-promise
//      email path. A regression here could silently turn on off-session card
//      capture before counsel signs off — the worst possible failure.
//   2. Settlement REFUSES to charge without a destination fund + a confirmed
//      SetupIntent + a customer. The prereq guard returns before any Stripe
//      call, so a half-set-up or unpaired intent can never produce an orphan
//      charge.
//
// Run: `npm run test:capture-at-intent`  (or: npx tsx script/test-capture-at-intent.ts)

import "dotenv/config";
import assert from "node:assert/strict";
import { isGifterCaptureAtIntentEnabled } from "../server/giftCaptureFlag";

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures += 1;
    console.error(`  ✗ ${name}\n    ${err?.message || err}`);
  }
}

// ── 1. Flag is hermetic ──────────────────────────────────────────────────────
function testFlagGating() {
  const KEY = "GIFTER_CAPTURE_AT_INTENT";
  const orig = process.env[KEY];
  const set = (v?: string) => { if (v === undefined) delete process.env[KEY]; else process.env[KEY] = v; };
  try {
    for (const v of ["true", "1", "yes", "TRUE", "Yes", " true "]) {
      set(v);
      assert.equal(isGifterCaptureAtIntentEnabled(), true, `"${v}" should ENABLE the capture path`);
    }
    for (const v of ["false", "0", "no", "", "off", "maybe", "2", "truee"]) {
      set(v);
      assert.equal(isGifterCaptureAtIntentEnabled(), false, `"${v}" must NOT enable the capture path`);
    }
    set(undefined);
    assert.equal(isGifterCaptureAtIntentEnabled(), false, "unset → OFF (safe default)");
  } finally {
    set(orig);
  }
}

// ── 2. Settlement refuses to charge without prereqs ──────────────────────────
async function testSettlementPrereqGuards() {
  // Dynamic import so heavy server-module wiring can't block the flag test above.
  const { settleGiftIntentOffSession } = await import("../server/giftIntentSettlement");
  const base = {
    id: "test-intent-1",
    amount: "50",
    gifterName: "Test Gifter",
    gifterEmail: "gifter@example.com",
    message: null,
    fundId: "fund-1",
    stripeSetupIntentId: "si_test",
    stripeCustomerId: "cus_test",
    failedChargeCount: 0,
  };
  // Each case nulls exactly ONE prereq → must return at the guard, before Stripe.
  const cases: Array<[string, Record<string, unknown>]> = [
    ["no destination fund", { fundId: null }],
    ["no confirmed SetupIntent", { stripeSetupIntentId: null }],
    ["no Stripe customer", { stripeCustomerId: null }],
  ];
  for (const [label, override] of cases) {
    const r = await settleGiftIntentOffSession({ ...base, ...override } as any);
    assert.equal(r.settled, false, `${label} → not settled`);
    assert.equal((r as any).declined, false, `${label} → NOT counted as a card decline`);
    assert.equal((r as any).reason, "missing-prereqs", `${label} → 'missing-prereqs' (no charge attempted)`);
  }
}

async function main() {
  console.log("capture-at-intent safety invariants:");
  await check("flag is hermetic (only explicit truthy enables; unset → off)", testFlagGating);
  await check("settlement refuses to charge without fund + setup + customer", testSettlementPrereqGuards);
  if (failures > 0) {
    console.error(`\n${failures} capture-at-intent test(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll capture-at-intent safety tests passed.");
  process.exit(0);
}

void main();
