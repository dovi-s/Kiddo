// Apply any migration files in `migrations/` whose tag isn't yet listed
// in `migrations/meta/_journal.json`. Use this when you've added a new
// SQL file but didn't run drizzle-kit generate (which is what registers
// it in the journal). Idempotent: every migration must use IF NOT EXISTS.
import { config } from 'dotenv';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env', quiet: true });
config({ path: '.env.example', override: false, quiet: true });

const DRY = process.argv.includes('--dry');

const url = String(process.env.DATABASE_URL || '').trim();
if (!url) throw new Error('DATABASE_URL missing');

const journalPath = path.join('migrations', 'meta', '_journal.json');
const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
const journalTags = new Set(journal.entries.map((e) => e.tag));

const allFiles = (await fs.readdir('migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();

const pending = allFiles
  .map((f) => ({ tag: f.replace(/\.sql$/, ''), file: f }))
  .filter((m) => !journalTags.has(m.tag));

if (pending.length === 0) {
  console.log('No pending migrations.');
  process.exit(0);
}

console.log(`Pending: ${pending.map((m) => m.tag).join(', ')}`);

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

let nextIdx = Math.max(0, ...journal.entries.map((e) => Number(e.idx) || 0)) + 1;
let nextWhen = Math.max(0, ...journal.entries.map((e) => Number(e.when) || 0)) + 100_000_000;

try {
  for (const m of pending) {
    const sql = await fs.readFile(path.join('migrations', m.file), 'utf8');
    process.stdout.write(`-> ${m.tag} ... `);
    if (DRY) { console.log('(dry)'); continue; }
    try {
      await pool.query(sql);
      console.log('applied');
    } catch (e) {
      console.log(`FAILED: ${e.code || ''} ${e.message}`);
      throw e;
    }
    journal.entries.push({ idx: nextIdx, version: '7', when: nextWhen, tag: m.tag, breakpoints: true });
    nextIdx += 1;
    nextWhen += 100_000_000;
  }
  if (!DRY) {
    await fs.writeFile(journalPath, JSON.stringify(journal, null, 2) + '\n');
    console.log('Journal updated.');
  }
} finally {
  await pool.end().catch(() => {});
}
