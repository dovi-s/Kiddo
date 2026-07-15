// Nightly Rivera-demo reset worker.
//
// Runs once a day at ~03:00 UTC (≈8 PM Pacific, when demo traffic is
// lowest) and re-seeds the Rivera family demo state. Off by default —
// only fires when `ENABLE_DEMO_RESET=1` is set. That gating matters
// because we DON'T want this firing on a developer's laptop or on any
// non-demo production environment.
//
// Sequencing:
//   1. Boot picks up the env flag. If unset, log "demo reset disabled" and exit.
//   2. setInterval ticks every 5 minutes checking "is it the reset window
//      AND have we not run yet today?" Cheap check, never holds the loop.
//   3. When the window matches, runs `resetRiveras()` (wipe + re-seed).
//
// Why an in-process worker rather than Render Cron Jobs ($1/mo):
//   - Render Hobby workspaces are limited to one project; cron jobs as
//     a separate service add operational complexity we don't need at
//     pre-launch scale.
//   - The reset is idempotent. Worst case if the worker restarts and
//     re-fires the same day, the DB state is identical.
//   - In-process means no extra Render service to monitor.
//
// Last-run state is held in memory only. A restart between 03:00 and
// the next 03:00 will cause an extra reset — fine, it's idempotent.
// Persisting the timestamp wasn't worth the disk write.

import { resetRiveras } from "../script/reset-dunphys";

type LogFn = (message: string, source?: string) => void;
const WORKER_SOURCE = "demo-reset-worker";

// Reset window: 03:00–03:10 UTC. A ten-minute window so the worker
// catches it even if the tick lands a few minutes off the hour.
const RESET_HOUR_UTC = 3;
const RESET_MINUTE_WINDOW = 10;

let lastResetYmd: string | null = null;
let resetInFlight = false;

function todayYmdUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inResetWindow(): boolean {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  return h === RESET_HOUR_UTC && m < RESET_MINUTE_WINDOW;
}

async function tickDemoReset(log: LogFn): Promise<void> {
  if (resetInFlight) return;
  if (!inResetWindow()) return;
  const ymd = todayYmdUtc();
  if (lastResetYmd === ymd) return;

  resetInFlight = true;
  try {
    log("nightly demo reset starting", WORKER_SOURCE);
    // closePool=false: the worker reuses the server's connection pool.
    await resetRiveras({ closePool: false });
    lastResetYmd = ymd;
    log(`nightly demo reset complete for ${ymd}`, WORKER_SOURCE);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`nightly demo reset failed: ${message}`, WORKER_SOURCE);
  } finally {
    resetInFlight = false;
  }
}

export function startDemoResetWorker(log: LogFn = () => undefined): void {
  if (process.env.ENABLE_DEMO_RESET !== "1") {
    log("demo reset worker disabled (set ENABLE_DEMO_RESET=1 to enable)", WORKER_SOURCE);
    return;
  }
  const intervalMs = 5 * 60 * 1000; // 5 minutes
  void tickDemoReset(log);
  const interval = setInterval(() => {
    void tickDemoReset(log);
  }, intervalMs);
  interval.unref?.();
  log(`demo reset worker started (window: ${RESET_HOUR_UTC}:00–${RESET_HOUR_UTC}:${RESET_MINUTE_WINDOW.toString().padStart(2, "0")} UTC)`, WORKER_SOURCE);
}
