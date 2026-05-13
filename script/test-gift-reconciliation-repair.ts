/* eslint-disable no-console */
import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import { getGiftReconciliationRepairPreview, runGiftReconciliationRepair } from "./gift-reconciliation-repair-lib";

const { Pool } = pg;

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

async function main() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const paymentIntentId = `pi_repair_fixture_${suffix}`;

    const user = await client.query(
      `
        INSERT INTO users (email, first_name, last_name, kyc_status)
        VALUES ($1, 'Repair', 'Fixture', 'approved')
        RETURNING id
      `,
      [`repair-fixture-${suffix}@example.com`],
    );
    const userId = user.rows[0].id;

    const fund = await client.query(
      `
        INSERT INTO funds (user_id, name, slug, status, account_type, balance, pending_balance, recipient_first_name)
        VALUES ($1, 'Repair Fixture Fund', $2, 'active', 'UTMA', '0', '99.99', 'Test')
        RETURNING id
      `,
      [userId, `repair-fixture-${suffix}`],
    );
    const fundId = fund.rows[0].id;

    const gift = await client.query(
      `
        INSERT INTO gifts (
          fund_id, sender_name, sender_email, amount, processing_fee, kora_fee,
          net_amount, message, status, stripe_payment_intent_id
        )
        VALUES ($1, 'Aunt Repair', 'aunt.repair@example.com', '50.00', '1.75', '0.00', '50.00', 'Fixture note', 'completed', $2)
        RETURNING id
      `,
      [fundId, paymentIntentId],
    );
    const giftId = gift.rows[0].id;

    const tx = await client.query(
      `
        INSERT INTO transactions (
          user_id, type, stripe_payment_intent_id, amount, status, description, fund_id
        )
        VALUES ($1, 'gift', $2, '0.00', 'completed', 'Broken fixture gift transaction', NULL)
        RETURNING id
      `,
      [userId, paymentIntentId],
    );
    const transactionId = tx.rows[0].id;

    const preview = await getGiftReconciliationRepairPreview(client);
    assert.ok(preview.linkableTransactions >= 1, "fixture should create a linkable transaction");
    assert.ok(preview.txAmountMismatches >= 1, "fixture should create a transaction amount mismatch");
    assert.ok(preview.pendingBalanceMismatches >= 1, "fixture should create a pending balance mismatch");
    assert.ok(preview.giftsWithoutMemoryEntries >= 1, "fixture should create a gift without memory");
    assert.ok(preview.giftsWithoutThankYouDrafts >= 1, "fixture should create a gift without thank-you draft");

    const applied = await runGiftReconciliationRepair(client);
    assert.ok(applied.linkedTransactions >= 1, "repair should link transaction to gift");
    assert.ok(applied.fixedTransactionAmounts >= 1, "repair should fix transaction amount");
    assert.ok(applied.fixedPendingBalances >= 1, "repair should fix pending balance");
    assert.ok(applied.createdMemoryEntries >= 1, "repair should create memory entry");
    assert.ok(applied.createdThankYouDrafts >= 1, "repair should create thank-you draft");

    const repaired = await client.query(
      `
        SELECT
          t.gift_id,
          t.fund_id,
          CAST(t.amount AS numeric) AS tx_amount,
          CAST(f.pending_balance AS numeric) AS pending_balance,
          (SELECT COUNT(*)::int FROM memory_entries WHERE gift_id = $2) AS memory_count,
          (SELECT COUNT(*)::int FROM thank_yous WHERE gift_id = $2) AS thankyou_count
        FROM transactions t
        JOIN funds f ON f.id = $3
        WHERE t.id = $1
      `,
      [transactionId, giftId, fundId],
    );
    const row = repaired.rows[0];
    assert.equal(row.gift_id, giftId);
    assert.equal(row.fund_id, fundId);
    assert.equal(Number(row.tx_amount), 51.75);
    assert.equal(Number(row.pending_balance), 0);
    assert.equal(Number(row.memory_count), 1);
    assert.equal(Number(row.thankyou_count), 1);

    await client.query("ROLLBACK");
    console.log("Gift reconciliation repair fixture passed.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Gift reconciliation repair fixture failed:", err?.message || err);
  process.exit(1);
});
