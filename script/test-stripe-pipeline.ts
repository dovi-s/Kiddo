/* eslint-disable no-console */
import "dotenv/config";
import pg from "pg";

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

function toNum(v: any): number {
  return Number(v || 0);
}

async function main() {
  const strict = process.env.STRIPE_PIPELINE_STRICT === "1";
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  });

  try {
    const [summaryRes, failedWebhookRes] = await Promise.all([
      pool.query(`
        WITH draft_funds_with_gifts AS (
          SELECT COUNT(*)::int AS total
          FROM funds f
          WHERE f.status = 'draft'
            AND EXISTS (SELECT 1 FROM gifts g WHERE g.fund_id = f.id)
        ),
        gifts_without_memory AS (
          SELECT COUNT(*)::int AS total
          FROM gifts g
          LEFT JOIN memory_entries m ON m.gift_id = g.id
          WHERE m.id IS NULL
        ),
        gifts_without_thankyou AS (
          SELECT COUNT(*)::int AS total
          FROM gifts g
          LEFT JOIN thank_yous t ON t.gift_id = g.id
          WHERE t.id IS NULL
        ),
        gift_tx_without_gift AS (
          SELECT COUNT(*)::int AS total
          FROM transactions t
          LEFT JOIN gifts g ON g.stripe_payment_intent_id = t.stripe_payment_intent_id
          WHERE t.type = 'gift'
            AND t.status = 'completed'
            AND g.id IS NULL
        )
        SELECT
          (SELECT total FROM draft_funds_with_gifts) AS draft_funds_with_gifts,
          (SELECT total FROM gifts_without_memory) AS gifts_without_memory,
          (SELECT total FROM gifts_without_thankyou) AS gifts_without_thankyou,
          (SELECT total FROM gift_tx_without_gift) AS gift_tx_without_gift
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM webhook_events
        WHERE status = 'failed'
          AND received_at > now() - interval '24 hours'
      `),
    ]);

    const summary = summaryRes.rows[0] || {};
    const webhookFailed24h = toNum(failedWebhookRes.rows[0]?.total);

    console.log("Stripe Pipeline Diagnostics");
    console.log(JSON.stringify({
      draft_funds_with_gifts: toNum(summary.draft_funds_with_gifts),
      gifts_without_memory: toNum(summary.gifts_without_memory),
      gifts_without_thankyou: toNum(summary.gifts_without_thankyou),
      gift_tx_without_gift: toNum(summary.gift_tx_without_gift),
      webhook_failed_last_24h: webhookFailed24h,
      strict,
    }, null, 2));

    const hardFailures: string[] = [];
    if (toNum(summary.gift_tx_without_gift) > 0) {
      hardFailures.push("completed gift transactions without gift records");
    }
    if (toNum(summary.draft_funds_with_gifts) > 0) {
      hardFailures.push("funds still in draft status despite having gifts");
    }
    if (strict && toNum(summary.gifts_without_memory) > 0) {
      hardFailures.push("gifts without memory entries");
    }
    if (strict && toNum(summary.gifts_without_thankyou) > 0) {
      hardFailures.push("gifts without thank-you drafts");
    }
    if (strict && webhookFailed24h > 0) {
      hardFailures.push("failed webhook events in last 24h");
    }

    if (hardFailures.length > 0) {
      console.error("Stripe pipeline test failed:");
      for (const item of hardFailures) console.error(`- ${item}`);
      process.exit(1);
    }

    console.log("Stripe pipeline test passed.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Stripe pipeline test failed:", err?.message || err);
  process.exit(1);
});

