// Quick verifier for analytics_events. Confirms table exists and prints
// row count. Useful after applying the migration.
import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const r = await pool.query(
  `select column_name, data_type from information_schema.columns where table_name='analytics_events' order by ordinal_position`,
);
console.log('analytics_events columns:');
for (const row of r.rows) console.log(`  ${row.column_name}: ${row.data_type}`);
const c = await pool.query(`select count(*)::int as n from analytics_events`);
console.log(`row count: ${c.rows[0].n}`);
await pool.end();
