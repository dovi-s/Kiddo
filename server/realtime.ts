// Per-user realtime event bus, surfaced over Server-Sent Events.
//
// Why this exists: the dashboard used to poll /api/funds/:id/dashboard-summary
// every 20s (then 6s) to discover newly-arrived gifts. SSE collapses that to
// the round-trip from webhook to browser (sub-second on a healthy connection).
//
// Shape on the wire: each event is a single JSON object in the SSE `data:`
// field. Clients receive `{ type, ... }` and decide what to invalidate. Keep
// payloads small — they're hints, not state. The authoritative source remains
// the REST endpoints; the SSE channel just says "ask again, something
// changed." That keeps the consistency story simple (always re-fetch) and
// keeps this file from growing into a state-sync system.
//
// Adapter pattern: the public API (`subscribeUser`, `publishToUser`,
// `subscriberCounts`) is shaped so the in-memory implementation can be swapped
// for Redis pub/sub without touching call sites. Today's single-process
// deployment uses `InMemoryRealtimeBus`. When the API tier horizontally
// scales:
//
//   1. Install ioredis (or @redis/client).
//   2. Implement `RedisRealtimeBus` against the same `RealtimeBus` interface
//      below (publish to a per-user channel; subscribers stash the Response
//      object in a local Map keyed by userId and forward incoming Redis
//      messages to those Response writers).
//   3. Swap the `bus` export at the bottom of this file.
//
// Nothing else changes. webhookHandlers.ts and routes.ts only see the
// re-exported functions.
//
// Polling stays on at a longer cadence (30s) as a safety net: if a tab's SSE
// connection dropped silently (corporate proxy, sleeping laptop, etc.), the
// next poll re-syncs without the parent noticing. Belt and suspenders.

import type { Response } from 'express';

export type RealtimeEvent =
  // A new gift has finished post-payment processing for this user's fund.
  // Clients invalidate the dashboard-summary query for the named fundId.
  | { type: 'gift.arrived'; fundId: string; giftId: string }
  // Generic "this fund's state changed, re-fetch" — reserved for future use
  // (recurring schedule edits, custodian changes, etc.) where the dashboard
  // cares but no specific arrival happened.
  | { type: 'fund.updated'; fundId: string };

export interface RealtimeBus {
  /**
   * Register an SSE Response for events targeted at `userId`. Returns an
   * unsubscribe function the route handler MUST call on socket close.
   * Implementations are responsible for keeping the connection alive
   * (heartbeat comments) and cleaning up dead writers.
   */
  subscribeUser(userId: string, res: Response): () => void;

  /**
   * Fan an event out to every active subscriber for `userId`. Non-throwing:
   * dead writers are reaped silently by the implementation. Callers should
   * treat this as fire-and-forget; the webhook handler in particular must
   * never let a publish failure mask a gift completion.
   */
  publishToUser(userId: string, event: RealtimeEvent): void;

  /**
   * Diagnostic snapshot. Wired into /api/admin/realtime-stats so ops can
   * see "are tabs actually connected?" without grepping logs. Not on the
   * request path; safe to compute eagerly.
   */
  subscriberCounts(): { totalUsers: number; totalConnections: number };
}

type Subscriber = {
  res: Response;
  heartbeat: NodeJS.Timeout;
};

// SSE heartbeat. Comments (lines starting with `:`) keep the connection alive
// without firing onmessage on the client. 25s is comfortably under typical
// reverse-proxy idle timeouts (nginx default 60s, Cloudflare 100s) and under
// the browser's own 30s "is anything happening" instinct.
const HEARTBEAT_MS = 25_000;

class InMemoryRealtimeBus implements RealtimeBus {
  private readonly subscribersByUser: Map<string, Set<Subscriber>> = new Map();

  subscribeUser(userId: string, res: Response): () => void {
    let set = this.subscribersByUser.get(userId);
    if (!set) {
      set = new Set();
      this.subscribersByUser.set(userId, set);
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        // Write throws once the socket is gone; the close handler does the
        // cleanup, so swallow here.
      }
    }, HEARTBEAT_MS);

    const sub: Subscriber = { res, heartbeat };
    set.add(sub);

    return () => {
      clearInterval(heartbeat);
      const s = this.subscribersByUser.get(userId);
      if (!s) return;
      s.delete(sub);
      if (s.size === 0) this.subscribersByUser.delete(userId);
    };
  }

  publishToUser(userId: string, event: RealtimeEvent): void {
    const set = this.subscribersByUser.get(userId);
    if (!set || set.size === 0) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    // Array.from is the TS-compat way to iterate a Set without requiring
    // the --downlevelIteration flag.
    for (const sub of Array.from(set)) {
      try {
        sub.res.write(payload);
      } catch {
        // Close handler will reap the dead subscriber. Don't try to be
        // clever and reach into the Map here.
      }
    }
  }

  subscriberCounts(): { totalUsers: number; totalConnections: number } {
    let totalConnections = 0;
    // Array.from for Map.values() iteration without --downlevelIteration.
    for (const s of Array.from(this.subscribersByUser.values())) totalConnections += s.size;
    return { totalUsers: this.subscribersByUser.size, totalConnections };
  }
}

// The single bus instance the rest of the app talks to. Swap this assignment
// to `new RedisRealtimeBus(...)` when scaling horizontally — see file header.
export const bus: RealtimeBus = new InMemoryRealtimeBus();

// Re-exports keep the original call-site shape (server/routes.ts and
// server/webhookHandlers.ts both import `subscribeUser` / `publishToUser`
// directly). When the adapter swaps, these stay valid because they delegate
// to the bus instance above.
export function subscribeUser(userId: string, res: Response): () => void {
  return bus.subscribeUser(userId, res);
}

export function publishToUser(userId: string, event: RealtimeEvent): void {
  bus.publishToUser(userId, event);
}

export function subscriberCounts(): { totalUsers: number; totalConnections: number } {
  return bus.subscriberCounts();
}
