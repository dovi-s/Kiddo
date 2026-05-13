// Diagnostic: hit the same Drizzle SELECT the failing routes use.
// Prints the FULL Postgres error so we can see what column / table is missing.
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const fundId = process.argv[2] || '599261de-154d-4233-8e0a-d5c8073dd89e';

async function probe(label, sql, params = []) {
  try {
    const r = await pool.query(sql, params);
    console.log(`OK  ${label} -> ${r.rowCount} rows`);
  } catch (e) {
    console.log(`ERR ${label} -> ${e.code || ''} ${e.message}`);
    if (e.position) console.log(`    position=${e.position}`);
    if (e.hint) console.log(`    hint=${e.hint}`);
  }
}

await probe('gifts.lesson_tag exists', `select lesson_tag from gifts limit 1`);
await probe('age_transitions table exists', `select 1 from age_transitions limit 1`);
await probe('age18_reminder_state table exists', `select 1 from age18_reminder_state limit 1`);
await probe(
  'gifts SELECT * by fund (mimics Drizzle)',
  `select id, fund_id, event_id, sender_name, sender_email, amount, processing_fee, kora_fee, net_amount, message, photo_url, execution_model, selected_ticker, status, stripe_payment_intent_id, shares_acquired, price_at_purchase, parent_contribution_id, lesson_tag, invested_at, settled_at, created_at, updated_at from gifts where fund_id = $1 limit 1`,
  [fundId],
);
await probe('memory_entries by fund', `select * from memory_entries where fund_id = $1 limit 1`, [fundId]);
await probe('thank_yous by fund', `select * from thank_yous where fund_id = $1 limit 1`, [fundId]);
await probe('large_gift_holds by fund', `select * from large_gift_holds where fund_id = $1 limit 1`, [fundId]);
await probe('funds by id', `select * from funds where id = $1 limit 1`, [fundId]);

await pool.end();
