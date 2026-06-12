/* eslint-disable no-console */
// Seed-and-run test for the pre-charge heads-up notice (money-flow). Inserts
// test recurring_gifts into Luke's demo fund, runs processPrechargeNotices, and
// asserts: (1) a charge ~2 days out gets noticed + stamped + an outbox email;
// (2) a second run is idempotent (no re-send); (3) a charge 10 days out is NOT
// noticed (outside lead window); (4) a reminder-only row (no Stripe sub) is NOT
// noticed. Sends go to the dev .local outbox (no provider configured), so no
// real email leaves. Cleans up its rows. Throwaway.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pool } from "../server/db";
import { processPrechargeNotices } from "../server/recurringContributionWorker";

const OUTBOX = path.join(process.cwd(), ".local", "email-outbox.jsonl");
const DUE = "precharge-due@example.com";       // ~2 days out, Stripe sub -> should notice
const FAR = "precharge-far@example.com";       // 10 days out -> should NOT notice
const REMIND = "precharge-remind@example.com"; // reminder-only (no sub) -> should NOT notice

const results: { name: string; ok: boolean; note: string }[] = [];
const rec = (name: string, ok: boolean, note = "") => { results.push({ name, ok, note }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? " — " + note : ""}`); };

function outboxCountTo(email: string): number {
  if (!existsSync(OUTBOX)) return 0;
  return readFileSync(OUTBOX, "utf8").split("\n").filter((l) => l.includes(email)).length;
}

async function cleanup() {
  await pool.query(`DELETE FROM recurring_gifts WHERE sender_email IN ($1,$2,$3)`, [DUE, FAR, REMIND]);
}

async function main() {
  const lukeRes = await pool.query<{ id: string }>(`SELECT id FROM funds WHERE slug = 'luke-dunphy' LIMIT 1`);
  const fundId = lukeRes.rows[0]?.id;
  if (!fundId) throw new Error("Luke fund not seeded; run npm run seed:dunphys");

  await cleanup(); // fresh start

  // Seed three rows.
  await pool.query(
    `INSERT INTO recurring_gifts (fund_id, sender_name, sender_email, amount, frequency, payment_setup_status, stripe_subscription_id, status, next_charge_date)
     VALUES ($1,'Due Gifter',$2,'50.00','monthly','active','sub_test_due','active', NOW() + INTERVAL '2 days')`,
    [fundId, DUE],
  );
  await pool.query(
    `INSERT INTO recurring_gifts (fund_id, sender_name, sender_email, amount, frequency, payment_setup_status, stripe_subscription_id, status, next_charge_date)
     VALUES ($1,'Far Gifter',$2,'50.00','monthly','active','sub_test_far','active', NOW() + INTERVAL '10 days')`,
    [fundId, FAR],
  );
  await pool.query(
    `INSERT INTO recurring_gifts (fund_id, sender_name, sender_email, amount, frequency, payment_setup_status, stripe_subscription_id, status, next_charge_date)
     VALUES ($1,'Reminder Gifter',$2,'50.00','monthly','active',NULL,'active', NOW() + INTERVAL '2 days')`,
    [fundId, REMIND],
  );

  const dueBefore = outboxCountTo(DUE);

  // First run.
  await processPrechargeNotices(() => undefined);

  const dueRow = (await pool.query(`SELECT precharge_notice_for_date, next_charge_date FROM recurring_gifts WHERE sender_email = $1`, [DUE])).rows[0] as any;
  const farRow = (await pool.query(`SELECT precharge_notice_for_date FROM recurring_gifts WHERE sender_email = $1`, [FAR])).rows[0] as any;
  const remindRow = (await pool.query(`SELECT precharge_notice_for_date FROM recurring_gifts WHERE sender_email = $1`, [REMIND])).rows[0] as any;

  const stamped = dueRow?.precharge_notice_for_date != null
    && new Date(dueRow.precharge_notice_for_date).getTime() === new Date(dueRow.next_charge_date).getTime();
  rec("1. due row noticed + stamped to its charge date", !!stamped, `stamp=${dueRow?.precharge_notice_for_date}`);

  const dueAfter = outboxCountTo(DUE);
  rec("1b. due row produced an outbox email", dueAfter === dueBefore + 1, `outbox +${dueAfter - dueBefore}`);

  rec("3. far row (10d out) NOT noticed", farRow?.precharge_notice_for_date == null, `stamp=${farRow?.precharge_notice_for_date}`);
  rec("4. reminder-only row (no Stripe sub) NOT noticed", remindRow?.precharge_notice_for_date == null, `stamp=${remindRow?.precharge_notice_for_date}`);

  // Second run — idempotent.
  await processPrechargeNotices(() => undefined);
  const dueAfter2 = outboxCountTo(DUE);
  rec("2. second run is idempotent (no re-send)", dueAfter2 === dueAfter, `outbox now +${dueAfter2 - dueBefore} total`);

  await cleanup();
  await pool.end().catch(() => null);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(async (e) => { console.error("test-precharge-notice crashed:", e); await pool.end().catch(() => null); process.exit(1); });
