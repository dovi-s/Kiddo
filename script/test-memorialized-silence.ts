// test:memorialized-silence — the safety test for the bereavement freeze.
//
// Proves that a memorialized fund goes silent: the email chokepoint suppresses,
// the gifter charge path refuses, and the silence gate is fail-closed — while an
// active fund and non-fund (transactional) mail are untouched. This test must
// NEVER go red. See BEREAVEMENT_POSTURE.md.
//
// Uses a real fund as the subject: marks it memorialized, asserts, and ALWAYS
// restores it (try/finally), so it leaves the DB exactly as it found it.

import { pool } from "../server/db";
import { shouldSilenceForFund, shouldSilenceForEmail } from "../server/memorialized";
import { sendEmail } from "../server/emailDelivery";
import { stripeService } from "../server/stripeService";

async function main() {
  const f = await pool.query("select id from funds where memorialized_at is null limit 1");
  if (f.rows.length === 0) {
    console.error("No active fund to test with — reseed first.");
    process.exit(1);
  }
  const fundId = String(f.rows[0].id);
  let failures = 0;
  const check = (name: string, ok: boolean) => {
    console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}`);
    if (!ok) failures++;
  };
  const TEST_TO = "memorialized-silence-test@example.com";

  try {
    // --- baseline: an ACTIVE fund is never silenced ---
    check("active fund: shouldSilence = false", (await shouldSilenceForFund(fundId)) === false);
    check("null fundId: shouldSilence = false (transactional mail never gated)", (await shouldSilenceForFund(null)) === false);
    const activeEmail = await sendEmail({ to: TEST_TO, subject: "active", text: "x", fundId });
    check("active fund email: NOT bereavement-suppressed", activeEmail.mode !== "bereavement_suppressed");

    // --- memorialize the fund ---
    await pool.query("update funds set memorialized_at = now() where id = $1", [fundId]);

    check("memorialized fund: shouldSilence = true", (await shouldSilenceForFund(fundId)) === true);

    const deadEmail = await sendEmail({ to: TEST_TO, subject: "birthday", text: "x", fundId });
    check("memorialized fund email: SUPPRESSED at the chokepoint",
      deadEmail.mode === "bereavement_suppressed" && deadEmail.delivered === false);

    // The gifter off-session charge refuses BEFORE reaching Stripe (guard runs
    // before the client is created), so this needs no real Stripe call.
    let chargeRefused = false;
    try {
      await stripeService.chargeGifterOffSession({
        customerId: "cus_test", paymentMethodId: "pm_test", amountCents: 100, metadata: { fundId },
      });
    } catch (e: any) {
      chargeRefused = /bereavement_silenced/.test(String(e?.message || e));
    }
    check("memorialized fund: gifter off-session charge REFUSED", chargeRefused);

    // User-level silence (PMF survey etc.): the memorialized fund's OWNER must never
    // get a person-addressed "how are we doing?" send.
    const ownerRow = await pool.query("select u.email from funds f join users u on u.id = f.user_id where f.id = $1", [fundId]);
    const ownerEmail = String(ownerRow.rows[0]?.email || "");
    if (ownerEmail) check("memorialized fund owner: shouldSilenceForEmail = true", (await shouldSilenceForEmail(ownerEmail)) === true);
    check("unrelated email: shouldSilenceForEmail = false", (await shouldSilenceForEmail("nobody-xyz@example.invalid")) === false);

    // Non-fund (transactional) mail must STILL send even with the fund memorialized.
    const txn = await sendEmail({ to: TEST_TO, subject: "password reset", text: "x" });
    check("transactional mail (no fundId): NOT suppressed", txn.mode !== "bereavement_suppressed");
  } finally {
    await pool.query("update funds set memorialized_at = null where id = $1", [fundId]);
  }

  await pool.end();
  if (failures === 0) {
    console.log("\nALL PASS — memorialized funds go silent; active + transactional mail untouched.");
    process.exit(0);
  }
  console.error(`\n${failures} FAILURE(S) — the bereavement freeze is not safe. Do not ship.`);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
