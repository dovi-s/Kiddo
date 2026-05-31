// Orphan-gift monitor — closes the P0-1 advisory-panel gap "no orphan
// monitoring" (a charge succeeds but the investment never completes, leaving
// money in limbo). See P0-1_IMPLEMENTATION_REVIEW.md item #2.
//
// THE SIGNAL: a gift whose payment succeeded transitions status
// 'processing' → 'invested' (with investedAt) within seconds. A gift stuck at
// 'processing' with investedAt NULL past a grace window means the gifter was
// charged but nothing was bought — an orphan. We surface it to ops (deduped per
// gift) so a human can resolve it (re-invest or refund). Read-only + alert: this
// worker NEVER mutates a gift; money decisions stay human.
//
// WHY NOW, pre-custody: investing is a local-DB simulation today, so orphans are
// rare — but this is built ahead of custody on purpose. The moment a real
// broker-dealer is wired (DriveWealth/Alpaca/Apex), a rejected order manifests
// here as exactly this state (charged, never invested), and the capture-at-intent
// off-session path routes through the same processing→invested transition. So
// the monitor is live the instant it's needed, not bolted on after the first
// orphan. Gated by nothing — a charged-not-invested gift is always worth flagging.

import { pool } from "./db";
import { sendOpsAlert } from "./ops";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "gift-orphan-monitor";

// Grace window. A healthy gift invests within seconds; hours of lag means
// something failed. 3h is conservative (zero false positives on in-flight
// gifts) while still catching a stuck charge the same day. Override via env.
const ORPHAN_GRACE_HOURS = Math.max(1, Number(process.env.GIFT_ORPHAN_GRACE_HOURS || 3));

let running = false;

export async function runGiftOrphanMonitor(log: LogFn = () => undefined): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const res = await pool.query(
      `SELECT id, fund_id, amount, created_at
         FROM gifts
        WHERE status = 'processing'
          AND invested_at IS NULL
          AND created_at < NOW() - ($1 || ' hours')::interval
        ORDER BY created_at ASC
        LIMIT 100`,
      [String(ORPHAN_GRACE_HOURS)],
    );
    const orphans = res.rows;
    if (orphans.length === 0) return 0;
    log(`found ${orphans.length} orphan gift(s) — charged, not invested after ${ORPHAN_GRACE_HOURS}h`, WORKER_SOURCE);
    for (const g of orphans) {
      await sendOpsAlert(
        {
          severity: "warning",
          title: "Orphan gift: charged but not invested",
          message:
            `Gift ${g.id} (fund ${g.fund_id}, $${g.amount}) is status 'processing' with no investedAt ` +
            `since ${new Date(g.created_at).toISOString()}. The gifter was charged but the investment never ` +
            `completed — investigate and either re-invest or refund.`,
          context: { giftId: g.id, fundId: g.fund_id, amount: g.amount, createdAt: g.created_at },
        },
        // Dedupe per gift so a persistent orphan doesn't re-alert every tick.
        `gift-orphan:${g.id}`,
      ).catch(() => { /* an alerting failure must not break the scan */ });
    }
    return orphans.length;
  } catch (err: any) {
    log(`orphan scan failed: ${err?.message || err}`, WORKER_SOURCE);
    return 0;
  } finally {
    running = false;
  }
}

export function startGiftOrphanMonitorWorker(log: LogFn = () => undefined): void {
  // Every 6h by default (orphans aren't time-critical to detect; ops resolves
  // them by hand). Min 1h floor against misconfiguration into a tight loop.
  const intervalMs = Math.max(
    Number(process.env.GIFT_ORPHAN_MONITOR_INTERVAL_MS || 6 * 60 * 60 * 1000),
    60 * 60 * 1000,
  );
  void runGiftOrphanMonitor(log);
  const interval = setInterval(() => { void runGiftOrphanMonitor(log); }, intervalMs);
  interval.unref?.();
  log(`gift orphan monitor started (every ${Math.round(intervalMs / 60000)} min, grace ${ORPHAN_GRACE_HOURS}h)`, WORKER_SOURCE);
}
