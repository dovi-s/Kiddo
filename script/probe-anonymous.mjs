// Verify the gifts.is_anonymous backfill worked.
import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const r = await pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE is_anonymous = true) AS anon_count,
    COUNT(*) FILTER (WHERE is_anonymous = false) AS named_count,
    COUNT(*) FILTER (WHERE sender_name ILIKE 'anonymous' OR sender_name ILIKE 'someone who loves%') AS legacy_anon_pattern,
    COUNT(*) AS total
  FROM gifts
`);
console.log(r.rows[0]);
await pool.end();
