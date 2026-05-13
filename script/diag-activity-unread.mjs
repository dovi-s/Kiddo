// Diagnostic: dump the recent activities for a fund and classify each
// against the bell-noise + internal-only filters that the new
// useNotificationUnreadCount hook applies. Tells us EXACTLY which rows
// would still count as "unread" today.
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const fundId = process.argv[2] || '599261de-154d-4233-8e0a-d5c8073dd89e';

// Mirror of the BELL_EXCLUDED_TYPES set + isInternalOnlyActivity in
// client/src/components/NotificationsPanel.tsx. If these drift, the
// diagnostic drifts. Single-source-of-truth would be better long term.
const BELL_NOISE = new Set([
  'auto_invest',
  'cash_invested',
  'parent_contribution',
  'subscription_renewal',
  'large_gift_hold_released',
  'gift_invested',
  'memory_entry_added',
  'memory_milestone_added',
  'memory_entry_edited',
  'memory_entry_deleted',
  'event_created',
  'event_archived',
  'event_unarchived',
  'fund_strategy_changed',
  'custom_allocations_changed',
  'child_profile_updated',
  'recurring_paused',
  'recurring_resumed',
  'kid_suggestion_approved',
  'kid_suggestion_declined',
  'gifter_recurring_resumed',
  'bank_unlinked',
  'ssn_provided',
]);

const isInternalOnly = (t) => t === 'monetization_trigger_event' || (t || '').startsWith('upgrade_');

const r = await pool.query(`
  SELECT id, type, title, created_at, fund_id
  FROM activities
  WHERE fund_id = $1
  ORDER BY created_at DESC
  LIMIT 40
`, [fundId]);

console.log(`Recent 40 activities for fund ${fundId}:\n`);

let counted = 0;
let bellNoiseCount = 0;
let internalCount = 0;
const counts = {};

for (const row of r.rows) {
  const t = row.type || '(null)';
  counts[t] = (counts[t] || 0) + 1;

  const isBN = BELL_NOISE.has(t);
  const isIO = isInternalOnly(t);
  const filtered = isBN || isIO;
  if (filtered) {
    if (isBN) bellNoiseCount += 1;
    if (isIO) internalCount += 1;
  } else {
    counted += 1;
  }

  const tag = isIO ? '[INTERNAL]' : isBN ? '[BELL_NOISE]' : '[COUNTS  ]';
  const ts = new Date(row.created_at).toISOString().slice(0, 16);
  console.log(`  ${tag} ${ts}  ${t.padEnd(28)}  ${(row.title || '').slice(0, 50)}`);
}

console.log(`\nType breakdown (recent 40):`);
for (const [t, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  const tag = isInternalOnly(t) ? 'internal' : BELL_NOISE.has(t) ? 'bell-noise' : 'COUNTED';
  console.log(`  ${String(n).padStart(3)}  ${t.padEnd(32)} (${tag})`);
}

console.log(`\nWith new filter applied:`);
console.log(`  ${counted} activities would COUNT as unread`);
console.log(`  ${bellNoiseCount} excluded as bell-noise (your own actions / routine flows)`);
console.log(`  ${internalCount} excluded as internal-only (upgrade funnel telemetry)`);
console.log(`  (cap is most-recent 40 per useActivities; total may be higher)`);

await pool.end();
